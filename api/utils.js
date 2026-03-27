const crypto = require('crypto');
const jwt    = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tapplus-dev-secret-change-in-prod';

// ── PIN hashing ───────────────────────────────────────────────────────────────
function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + process.env.PIN_SALT).digest('hex');
}

function verifyPin(pin, hash) {
  return hashPin(pin) === hash;
}

// ── JWT ───────────────────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ── Auth middleware ───────────────────────────────────────────────────────────
// Extracts and verifies the session JWT from Authorization header
// Returns { bizId, role, staffId? } or null
function getSession(req) {
  const header = req.headers['authorization'] || '';
  const token  = header.replace('Bearer ', '').trim();
  if (!token) return null;
  return verifyToken(token);
}

// Role guard - returns error response if insufficient role
// roles: 'staff' | 'manager' | 'bizAdmin' | 'superAdmin'
const ROLE_RANK = { staff: 1, manager: 2, bizAdmin: 3, superAdmin: 4 };

function requireRole(session, minRole) {
  if (!session) return { error: 'Unauthorized', status: 401 };
  if ((ROLE_RANK[session.role] || 0) < (ROLE_RANK[minRole] || 99)) {
    return { error: 'Forbidden', status: 403 };
  }
  return null;
}

// ── CORS ──────────────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function handleCors(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// ── Response helpers ──────────────────────────────────────────────────────────
function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

function err(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

// ── Slug generator ────────────────────────────────────────────────────────────
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Store code generator ──────────────────────────────────────────────────────
function genCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ── ID generator ─────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = {
  hashPin, verifyPin,
  signToken, verifyToken, getSession, requireRole,
  setCors, handleCors,
  ok, err,
  toSlug, genCode, uid,
};
