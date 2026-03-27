// api/staff.js
// GET    /api/staff?bizId=xxx          - list all staff for a business
// GET    /api/staff?bizId=xxx&id=xxx   - get single staff member
// POST   /api/staff?bizId=xxx         - create staff member (manager+)
// PUT    /api/staff?bizId=xxx&id=xxx  - update staff (self or manager+)
// DELETE /api/staff?bizId=xxx&id=xxx  - delete staff (manager+)

const { db } = require('../lib/firebase');
const {
  handleCors, ok, err,
  getSession, requireRole,
  hashPin, uid,
} = require('../lib/utils');

const COLORS = [
  '#00e5a0','#7c6aff','#ff6b35','#ffd166',
  '#ff4455','#38bdf8','#f472b6','#a3e635',
];

function staffCol(bizId) {
  return db.collection('businesses').doc(bizId).collection('staff');
}

function sanitizeStaff(id, data) {
  const { passcodeHash, ...safe } = data;
  return { id, ...safe };
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const { bizId, id } = req.query;
  if (!bizId) return err(res, 'bizId required');

  const session = getSession(req);

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // Any authenticated session for this business can read staff
    if (!session || (session.bizId !== bizId && session.role !== 'superAdmin')) {
      return err(res, 'Unauthorized', 401);
    }

    if (id) {
      const doc = await staffCol(bizId).doc(id).get();
      if (!doc.exists) return err(res, 'Staff not found', 404);
      return ok(res, { staff: sanitizeStaff(doc.id, doc.data()) });
    }

    const snap = await staffCol(bizId).orderBy('createdAt', 'asc').get();
    const staff = snap.docs.map(d => sanitizeStaff(d.id, d.data()));
    return ok(res, { staff });
  }

  // ── POST — Create staff ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const guard = requireRole(session, 'manager');
    if (guard) return err(res, guard.error, guard.status);
    if (session.bizId !== bizId && session.role !== 'superAdmin') {
      return err(res, 'Forbidden', 403);
    }

    const { firstName, lastInitial, passcode, title, color } = req.body || {};
    if (!firstName)    return err(res, 'First name required');
    if (!lastInitial)  return err(res, 'Last initial required');
    if (!passcode)     return err(res, 'Passcode required');
    if (passcode.length < 4) return err(res, 'Passcode must be at least 4 digits');

    // Check passcode uniqueness within business
    const existing = await staffCol(bizId)
      .where('passcodeHash', '==', hashPin(passcode)).get();
    if (!existing.empty) return err(res, 'Passcode already in use by another staff member');

    // Count staff for color assignment
    const countSnap = await staffCol(bizId).get();
    const autoColor = COLORS[countSnap.size % COLORS.length];

    const staffData = {
      firstName,
      lastInitial: lastInitial.toUpperCase(),
      passcodeHash: hashPin(passcode),
      title:        title || '',
      color:        color || autoColor,
      photo:        '',
      active:       true,
      links:        [],
      createdAt:    Date.now(),
    };

    const ref = await staffCol(bizId).add(staffData);
    return ok(res, { staff: sanitizeStaff(ref.id, staffData) }, 201);
  }

  // ── PUT — Update staff ───────────────────────────────────────────────────
  if (req.method === 'PUT') {
    if (!id) return err(res, 'Staff ID required');

    // Staff can update their own profile; managers can update any
    const isSelf    = session && session.staffId === id && session.bizId === bizId;
    const isManager = session && (session.role === 'manager' || session.role === 'bizAdmin' || session.role === 'superAdmin');

    if (!isSelf && !isManager) return err(res, 'Forbidden', 403);

    const doc = await staffCol(bizId).doc(id).get();
    if (!doc.exists) return err(res, 'Staff not found', 404);

    const body    = req.body || {};
    const updates = {};

    // Fields staff can update themselves
    const selfFields = ['title', 'photo', 'links'];
    for (const f of selfFields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    // Fields only managers can update
    if (isManager) {
      const mgrFields = ['firstName', 'lastInitial', 'color', 'active'];
      for (const f of mgrFields) {
        if (body[f] !== undefined) updates[f] = body[f];
      }
    }

    // Passcode update
    if (body.passcode) {
      if (body.passcode.length < 4) return err(res, 'Passcode must be at least 4 digits');
      // Check uniqueness
      const newHash   = hashPin(body.passcode);
      const existing  = await staffCol(bizId).where('passcodeHash', '==', newHash).get();
      const conflict  = existing.docs.find(d => d.id !== id);
      if (conflict) return err(res, 'Passcode already in use');
      updates.passcodeHash = newHash;
    }

    updates.updatedAt = Date.now();
    await staffCol(bizId).doc(id).update(updates);

    const updated = await staffCol(bizId).doc(id).get();
    return ok(res, { staff: sanitizeStaff(updated.id, updated.data()) });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const guard = requireRole(session, 'manager');
    if (guard) return err(res, guard.error, guard.status);
    if (session.bizId !== bizId && session.role !== 'superAdmin') {
      return err(res, 'Forbidden', 403);
    }
    if (!id) return err(res, 'Staff ID required');

    const doc = await staffCol(bizId).doc(id).get();
    if (!doc.exists) return err(res, 'Staff not found', 404);

    await staffCol(bizId).doc(id).delete();
    return ok(res, { message: 'Staff deleted' });
  }

  return err(res, 'Method not allowed', 405);
};
