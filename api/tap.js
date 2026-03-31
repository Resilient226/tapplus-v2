// api/tap.js
// POST /api/tap   - log a new tap
// GET  /api/tap?bizId=xxx&staffId=xxx&from=ts&to=ts  - fetch taps

const { db } = require('../lib/firebase');
const { handleCors, ok, err, getSession, uid } = require('../lib/utils');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  // ── POST — Log a tap ─────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      bizId, bizSlug, staffId, staffName,
      rating, platform, review, feedback,
      feedbackPhoto, redirected, status,
    } = req.body || {};

    if (!bizId)   return err(res, 'bizId required');
    if (!staffId) return err(res, 'staffId required');

    const tapData = {
      id:           uid(),
      ts:           Date.now(),
      bizId,
      bizSlug:      bizSlug || '',
      staffId,
      staffName:    staffName || '',
      rating:       rating   || null,
      platform:     platform || null,
      review:       review   || false,
      feedback:     feedback || '',
      feedbackPhoto:feedbackPhoto || '',
      redirected:   redirected || false,
      status:       status || 'tapped',
    };

    await db.collection('taps').doc(tapData.id).set(tapData);
    return ok(res, { tap: tapData }, 201);
  }

  // ── PUT — Update tap (add rating/feedback after tap) ─────────────────────
  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return err(res, 'Tap ID required');

    const {
      rating, platform, review, feedback,
      feedbackPhoto, redirected, status,
    } = req.body || {};

    const updates = { updatedAt: Date.now() };
    if (rating       !== undefined) updates.rating        = rating;
    if (platform     !== undefined) updates.platform      = platform;
    if (review       !== undefined) updates.review        = review;
    if (feedback     !== undefined) updates.feedback      = feedback;
    if (feedbackPhoto!== undefined) updates.feedbackPhoto = feedbackPhoto;
    if (redirected   !== undefined) updates.redirected    = redirected;
    if (status       !== undefined) updates.status        = status;

    const doc = await db.collection('taps').doc(id).get();
    if (!doc.exists) return err(res, 'Tap not found', 404);

    await db.collection('taps').doc(id).update(updates);
    return ok(res, { message: 'Tap updated' });
  }

  // ── GET — Fetch taps ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // Require valid session
    const session = getSession(req);
    if (!session) return err(res, 'Unauthorized', 401);

    const { bizId, staffId, from, to, limit: lim } = req.query;
    if (!bizId) return err(res, 'bizId required');

    // Session must be for this business (or superAdmin)
    if (session.bizId !== bizId && session.role !== 'superAdmin') {
      return err(res, 'Forbidden', 403);
    }

    try {
      let query = db.collection('taps').where('bizId', '==', bizId);

      if (staffId) query = query.where('staffId', '==', staffId);
      if (from)    query = query.where('ts', '>=', parseInt(from));
      if (to)      query = query.where('ts', '<=', parseInt(to));

      query = query.orderBy('ts', 'desc').limit(parseInt(lim) || 500);

      const snap = await query.get();
      const taps = snap.docs.map(d => d.data());
      return ok(res, { taps });
    } catch (e) {
      console.error('Taps GET error:', e.message);
      // Firestore composite index missing — retry without orderBy
      if (e.code === 9 || e.message.includes('index')) {
        try {
          let query = db.collection('taps').where('bizId', '==', bizId);
          if (staffId) query = query.where('staffId', '==', staffId);
          const snap = await query.limit(parseInt(lim) || 500).get();
          const taps = snap.docs.map(d => d.data()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
          return ok(res, { taps });
        } catch (e2) {
          return err(res, 'Database error: ' + e2.message, 500);
        }
      }
      return err(res, 'Database error: ' + e.message, 500);
    }
  }

  return err(res, 'Method not allowed', 405);
};
