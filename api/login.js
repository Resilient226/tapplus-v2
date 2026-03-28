// api/login.js
// POST /api/login
//
// Body options:
//   { type: 'owner', idToken }            → Firebase Auth owner login
//   { type: 'staff', bizId, passcode }    → Staff PIN login
//   { type: 'manager', bizId, pin }       → Manager PIN login
//   { type: 'bizAdmin', bizId, pin }      → Business Admin PIN login
//   { type: 'superAdmin', pin }           → Super Admin login
//
// Returns: { token, role, bizId?, staffId?, name? }

const { db, auth } = require('../lib/firebase');
const {
  handleCors, ok, err,
  verifyPin, signToken,
} = require('../lib/utils');

const SUPER_ADMIN_PIN_HASH = process.env.SUPER_ADMIN_PIN_HASH; // sha256 hash of super admin PIN

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const { type } = req.body || {};
  if (!type) return err(res, 'Login type required');if (type === 'superAdmin') {
  const { pin } = req.body;
  if (!pin) return err(res, 'PIN required');

  console.log('SUPER_ADMIN_PIN_HASH exists:', !!SUPER_ADMIN_PIN_HASH);
  console.log('PIN_SALT exists:', !!process.env.PIN_SALT);

  if (!SUPER_ADMIN_PIN_HASH) return err(res, 'Super admin not configured', 500);
  if (!verifyPin(pin, SUPER_ADMIN_PIN_HASH)) {
    return err(res, 'Invalid PIN', 401);
  }

  const token = signToken({ role: 'superAdmin' });
  return ok(res, { token, role: 'superAdmin' });
}

  // ── Owner login via Firebase Auth ────────────────────────────────────────
  if (type === 'owner') {
    const { idToken } = req.body;
    if (!idToken) return err(res, 'idToken required');

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      return err(res, 'Invalid token', 401);
    }

    // Find businesses owned by this user
    const snap = await db.collection('businesses')
      .where('ownerId', '==', decoded.uid).get();

    const businesses = snap.docs.map(d => ({
      id:   d.id,
      name: d.data().name,
      slug: d.data().slug,
    }));

    // Issue a session token with owner role
    const token = signToken({
      uid:  decoded.uid,
      role: 'owner',
      businesses: businesses.map(b => b.id),
    });

    return ok(res, { token, role: 'owner', businesses });
  }

  // ── Staff PIN login ──────────────────────────────────────────────────────
  if (type === 'staff') {
    const { bizId, passcode } = req.body;
    if (!bizId)    return err(res, 'bizId required');
    if (!passcode) return err(res, 'Passcode required');

    // Find staff member by passcode hash
    const snap = await db.collection('businesses').doc(bizId)
      .collection('staff')
      .where('passcodeHash', '==', require('../lib/utils').hashPin(passcode))
      .where('active', '==', true)
      .limit(1).get();

    if (snap.empty) return err(res, 'Invalid passcode', 401);

    const staffDoc  = snap.docs[0];
    const staffData = staffDoc.data();
    const name      = `${staffData.firstName} ${staffData.lastInitial}.`;

    const token = signToken({
      bizId,
      staffId: staffDoc.id,
      role:    'staff',
      name,
    });

    return ok(res, {
      token,
      role:    'staff',
      bizId,
      staffId: staffDoc.id,
      name,
    });
  }

  // ── Manager PIN login ────────────────────────────────────────────────────
  if (type === 'manager') {
    const { bizId, pin } = req.body;
    if (!bizId) return err(res, 'bizId required');
    if (!pin)   return err(res, 'PIN required');

    const bizDoc = await db.collection('businesses').doc(bizId).get();
    if (!bizDoc.exists) return err(res, 'Business not found', 404);

    const biz = bizDoc.data();
    if (!verifyPin(pin, biz.mgrPinHash)) {
      return err(res, 'Invalid PIN', 401);
    }

    const token = signToken({ bizId, role: 'manager' });
    return ok(res, { token, role: 'manager', bizId, name: biz.name });
  }

  // ── Business Admin PIN login ─────────────────────────────────────────────
  if (type === 'bizAdmin') {
    const { bizId, pin } = req.body;
    if (!bizId) return err(res, 'bizId required');
    if (!pin)   return err(res, 'PIN required');

    const bizDoc = await db.collection('businesses').doc(bizId).get();
    if (!bizDoc.exists) return err(res, 'Business not found', 404);

    const biz = bizDoc.data();
    if (!verifyPin(pin, biz.adminPinHash)) {
      return err(res, 'Invalid PIN', 401);
    }

    const token = signToken({ bizId, role: 'bizAdmin' });
    return ok(res, { token, role: 'bizAdmin', bizId, name: biz.name });
  }

  // ── Super Admin PIN login ────────────────────────────────────────────────
  if (type === 'superAdmin') {
    const { pin } = req.body;
    if (!pin) return err(res, 'PIN required');

    if (!SUPER_ADMIN_PIN_HASH) return err(res, 'Super admin not configured', 500);
    if (!verifyPin(pin, SUPER_ADMIN_PIN_HASH)) {
      return err(res, 'Invalid PIN', 401);
    }

    const token = signToken({ role: 'superAdmin' });
    return ok(res, { token, role: 'superAdmin' });
  }

  return err(res, 'Unknown login type');
};
