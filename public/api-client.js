// public/api-client.js
// All frontend → backend communication lives here.
// No business logic, no UI — just fetch wrappers.

const API = (() => {

  // ── Session management ────────────────────────────────────────────────────
  // Token lives in sessionStorage only — cleared when browser/tab closes
  const SESSION_KEY = 'tp_session';

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setSession(data) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getToken() {
    return getSession()?.token || null;
  }

  // ── Base fetch ────────────────────────────────────────────────────────────
  async function request(method, path, body = null, requireAuth = true) {
    const headers = { 'Content-Type': 'application/json' };

    if (requireAuth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res  = await fetch(path, opts);
    const data = await res.json().catch(() => ({ success: false, error: 'Invalid response' }));

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  function get(path, params = {}, auth = true) {
    const q = new URLSearchParams(params).toString();
    return request('GET', q ? `${path}?${q}` : path, null, auth);
  }

  function post(path, body, auth = true)   { return request('POST',   path, body, auth); }
  function put(path, body, auth = true)    { return request('PUT',    path, body, auth); }
  function del(path, params = {}, auth = true) {
    const q = new URLSearchParams(params).toString();
    return request('DELETE', q ? `${path}?${q}` : path, null, auth);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = {
    // Firebase Auth owner login (pass idToken from Firebase SDK)
    async loginOwner(idToken) {
      const data = await post('/api/login', { type: 'owner', idToken }, false);
      setSession(data);
      return data;
    },

    // Staff PIN login
    async loginStaff(bizId, passcode) {
      const data = await post('/api/login', { type: 'staff', bizId, passcode }, false);
      setSession(data);
      return data;
    },

    // Manager PIN login
    async loginManager(bizId, pin) {
      const data = await post('/api/login', { type: 'manager', bizId, pin }, false);
      setSession(data);
      return data;
    },

    // Business admin PIN login
    async loginBizAdmin(bizId, pin) {
      const data = await post('/api/login', { type: 'bizAdmin', bizId, pin }, false);
      setSession(data);
      return data;
    },

    // Super admin PIN login
    async loginSuperAdmin(pin) {
      const data = await post('/api/login', { type: 'superAdmin', pin }, false);
      setSession(data);
      return data;
    },

    logout() { clearSession(); },
    getSession,
    getToken,
    isLoggedIn: () => !!getToken(),
  };

  // ── Business ──────────────────────────────────────────────────────────────
  const business = {
    getBySlug:  (slug)  => get('/api/business', { slug }),
    getByCode:  (code)  => get('/api/business', { code }, false),
    getById:    (id)    => get('/api/business', { id }),
    create:     (data)  => post('/api/business', data),
    update:     (id, data) => put(`/api/business?id=${id}`, data),
    delete:     (id)    => del('/api/business', { id }),
  };

  // ── Staff ─────────────────────────────────────────────────────────────────
  const staff = {
    list:   (bizId)       => get('/api/staff', { bizId }),
    get:    (bizId, id)   => get('/api/staff', { bizId, id }),
    create: (bizId, data) => post(`/api/staff?bizId=${bizId}`, data),
    update: (bizId, id, data) => put(`/api/staff?bizId=${bizId}&id=${id}`, data),
    delete: (bizId, id)   => del('/api/staff', { bizId, id }),
  };

  // ── Taps ──────────────────────────────────────────────────────────────────
  const taps = {
    log:    (data)  => post('/api/tap', data, false),
    update: (id, data) => put(`/api/tap?id=${id}`, data, false),
    list:   (params) => get('/api/tap', params),
  };

  // ── AI ────────────────────────────────────────────────────────────────────
  const ai = {
    ask: (prompt) => post('/api/ai', { prompt }),
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  const layout = {
    get:    ()     => get('/api/layout', {}, false),
    update: (data) => put('/api/layout', data),
  };

  return { auth, business, staff, taps, ai, layout };
})();

// Export for use in app.js
if (typeof module !== 'undefined') module.exports = API;
