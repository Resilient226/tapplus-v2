// api/business.js
// GET  /api/business?slug=xxx         - get business by slug
// GET  /api/business?code=xxxx        - get business by store code
// POST /api/business                  - create business (Firebase Auth required)
// PUT  /api/business?id=xxx           - update business (bizAdmin+)
// DELETE /api/business?id=xxx         - delete business (superAdmin)

const { db, auth } = require('../lib/firebase');
const {
  handleCors, ok, err,
  getSession, requireRole,
  hashPin, toSlug, genCode, uid,
} = require('../lib/utils');

const COL = 'businesses';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function slugExists(slug, excludeId = null) {
  const snap = await db.collection(COL).where('slug', '==', slug).get();
  return snap.docs.some(d => d.id !== excludeId);
}

async function codeExists(code, excludeId = null) {
  const snap = await db.collection(COL).where('storeCode', '==', code).get();
  return snap.docs.some(d => d.id !== excludeId);
}

async function uniqueCode(excludeId = null) {
  let code, attempts = 0;
  do {
    code = genCode();
    attempts++;
    if (attempts > 20) throw new Error('Could not generate unique code');
  } while (await codeExists(code, excludeId));
  return code;
}

// Strip sensitive fields before sending to client
function sanitize(id, data) {
  const { adminPinHash, mgrPinHash, ownerId, ...safe } = data;
  return { id, ...safe };
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { slug, code, id } = req.query;

    // Get by Firestore ID
    if (id) {
      const doc = await db.collection(COL).doc(id).get();
      if (!doc.exists) return err(res, 'Business not found', 404);
      return ok(res, { business: sanitize(doc.id, doc.data()) });
    }

    // Get by slug
    if (slug) {
      const snap = await db.collection(COL).where('slug', '==', slug).limit(1).get();
      if (snap.empty) return err(res, 'Business not found', 404);
      const doc = snap.docs[0];
      return ok(res, { business: sanitize(doc.id, doc.data()) });
    }

    // Get by store code
    if (code) {
      const snap = await db.collection(COL).where('storeCode', '==', code).limit(1).get();
      if (snap.empty) return err(res, 'Invalid store code', 404);
      const doc = snap.docs[0];
      // Return minimal public info for store code lookup
      const d = doc.data();
      return ok(res, {
        business: {
          id:       doc.id,
          name:     d.name,
          slug:     d.slug,
          branding: d.branding || {},
        }
      });
    }

    // List all — super admin only
    const { listAll } = req.query;
    if (listAll) {
      const { getSession, requireRole } = require('../lib/utils');
      const session = getSession(req);
      const guard   = requireRole(session, 'superAdmin');
      if (guard) return err(res, guard.error, guard.status);

      const snap = await db.collection(COL).orderBy('name', 'asc').limit(200).get();
      const businesses = snap.docs.map(d => sanitize(d.id, d.data()));
      return ok(res, { businesses });
    }

    return err(res, 'Provide slug, code, or id');
  }

  // ── POST — Create business ───────────────────────────────────────────────
  if (req.method === 'POST') {
    // Verify Firebase Auth token (business owner must be authenticated)
    const authHeader = req.headers['authorization'] || '';
    const idToken    = authHeader.replace('Bearer ', '').trim();

    let uid_;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      uid_ = decoded.uid;
    } catch {
      return err(res, 'Invalid Firebase Auth token', 401);
    }

    const { name, adminPin, managerPin } = req.body || {};
    if (!name)       return err(res, 'Business name required');
    if (!adminPin)   return err(res, 'Admin PIN required');
    if (!managerPin) return err(res, 'Manager PIN required');
    if (adminPin.length < 4)   return err(res, 'PIN must be at least 4 digits');
    if (managerPin.length < 4) return err(res, 'Manager PIN must be at least 4 digits');

    // Build slug
    let slug = toSlug(name);
    if (await slugExists(slug)) slug = slug + '-' + uid().slice(0, 4);

    const storeCode = await uniqueCode();

    const bizData = {
      name,
      slug,
      storeCode,
      ownerId:      uid_,
      adminPinHash: hashPin(adminPin),
      mgrPinHash:   hashPin(managerPin),
      branding: {
        name,
        tagline:       '',
        logoUrl:       '',
        brandColor:    '#00e5a0',
        bgColor:       '#07080c',
        textColor:     '#ffffff',
        ratingQuestion:'How was your experience today?',
        reviewPrompt:  'Glad to hear it! Share your experience:',
        thankYouMsg:   'Thank you! Your feedback means a lot.',
        lowRatingMsg:  "We're sorry. Tell us what happened:",
        bulletinLinks: [],
        allowedStaffLinks: {
          spotify: true, phone: false, email: false,
          instagram: false, tiktok: false, custom: false,
        },
      },
      links:     [],
      teamGoals: [],
      createdAt: Date.now(),
    };

    const ref = await db.collection(COL).add(bizData);
    return ok(res, {
      business: sanitize(ref.id, bizData),
      message: 'Business created',
    }, 201);
  }

  // ── PUT — Update business ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const session = getSession(req);
    const guard   = requireRole(session, 'bizAdmin');
    if (guard) return err(res, guard.error, guard.status);

    const { id } = req.query;
    if (!id) return err(res, 'Business ID required');

    // bizAdmin can only update their own business
    if (session.role !== 'superAdmin' && session.bizId !== id) {
      return err(res, 'Forbidden', 403);
    }

    const doc = await db.collection(COL).doc(id).get();
    if (!doc.exists) return err(res, 'Business not found', 404);

    const body = req.body || {};
    const updates = {};

    // Allowed updatable fields
    const allowed = ['name', 'branding', 'links', 'teamGoals'];
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // PIN update (optional)
    if (body.adminPin)   updates.adminPinHash = hashPin(body.adminPin);
    if (body.managerPin) updates.mgrPinHash   = hashPin(body.managerPin);

    // Slug update if name changed
    if (body.name) {
      let newSlug = toSlug(body.name);
      if (await slugExists(newSlug, id)) newSlug = newSlug + '-' + uid().slice(0, 4);
      updates.slug = newSlug;
    }

    updates.updatedAt = Date.now();
    await db.collection(COL).doc(id).update(updates);

    const updated = await db.collection(COL).doc(id).get();
    return ok(res, { business: sanitize(updated.id, updated.data()) });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const session = getSession(req);
    const guard   = requireRole(session, 'superAdmin');
    if (guard) return err(res, guard.error, guard.status);

    const { id } = req.query;
    if (!id) return err(res, 'Business ID required');

    // Delete staff subcollection
    const staffSnap = await db.collection(COL).doc(id).collection('staff').get();
    const batch = db.batch();
    staffSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    await db.collection(COL).doc(id).delete();
    return ok(res, { message: 'Business deleted' });
  }

  return err(res, 'Method not allowed', 405);
};