// api/layout.js
// GET  /api/layout          - get current dashboard layouts
// PUT  /api/layout          - update layouts (superAdmin only)

const { db } = require('../lib/firebase');
const { handleCors, ok, err, getSession, requireRole } = require('../lib/utils');

const DOC = db.collection('platformSettings').doc('dashboardLayouts');

const DEFAULT_LAYOUTS = {
  staff:    ['coaching', 'feedback', 'goals', 'stats', 'branding'],
  manager:  ['ai', 'team', 'staff', 'links', 'goals', 'estimator'],
  bizAdmin: ['ai', 'team', 'staff', 'links', 'goals', 'branding', 'settings'],
};

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  // ── GET — public, any session ────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const doc = await DOC.get();
      const layouts = doc.exists ? doc.data() : DEFAULT_LAYOUTS;
      return ok(res, { layouts });
    } catch (e) {
      console.error('Layout GET error:', e.message);
      return err(res, 'Database error: ' + e.message, 500);
    }
  }

  // ── PUT — superAdmin only ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const session = getSession(req);
    const guard   = requireRole(session, 'superAdmin');
    if (guard) return err(res, guard.error, guard.status);

    const { staff, manager, bizAdmin } = req.body || {};

    const VALID_STAFF    = ['coaching','feedback','goals','stats','branding'];
    const VALID_MANAGER  = ['ai','team','staff','links','goals','estimator'];
    const VALID_BIZADMIN = ['ai','team','staff','links','goals','branding','settings','estimator'];

    function validate(arr, valid, label) {
      if (!Array.isArray(arr)) return `${label} must be an array`;
      for (const item of arr) {
        if (!valid.includes(item)) return `Unknown section "${item}" in ${label}`;
      }
      return null;
    }

    if (staff) {
      const e = validate(staff, VALID_STAFF, 'staff');
      if (e) return err(res, e);
    }
    if (manager) {
      const e = validate(manager, VALID_MANAGER, 'manager');
      if (e) return err(res, e);
    }
    if (bizAdmin) {
      const e = validate(bizAdmin, VALID_BIZADMIN, 'bizAdmin');
      if (e) return err(res, e);
    }

    const updates = {};
    if (staff)    updates.staff    = staff;
    if (manager)  updates.manager  = manager;
    if (bizAdmin) updates.bizAdmin = bizAdmin;
    updates.updatedAt = Date.now();

    await DOC.set(updates, { merge: true });
    const updated = await DOC.get();
    return ok(res, { layouts: updated.data() });
  }

  return err(res, 'Method not allowed', 405);
};
