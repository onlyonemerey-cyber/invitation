const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const apiConfigured = Boolean(API);

// ---------- сессия админки ----------

const TOKEN_KEY = 'invite-admin-session';
let token = (() => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
})();

export const session = {
  get: () => token,
  set(v) {
    token = v || '';
    try {
      v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

/** Подписка на «сессия истекла» — админка возвращается на экран входа. */
const expiredListeners = new Set();
export const onSessionExpired = (fn) => {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
};

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (auth && res.status === 401) {
      session.set('');
      expiredListeners.forEach((fn) => fn());
    }
    const err = new Error(data.error || `http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const q = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return s ? `?${s}` : '';
};

// ---------- страница девушки ----------

export const getInvite = (id) => request(`/api/invites/${encodeURIComponent(id)}`);
export const sendAnswer = (id, answer) =>
  request(`/api/invites/${encodeURIComponent(id)}/answer`, { method: 'POST', body: answer });

// ---------- админка ----------

export const api = {
  async login(login, password) {
    const r = await request('/api/auth/login', { method: 'POST', body: { login, password } });
    session.set(r.token);
    return r.me;
  },
  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST', auth: true });
    } finally {
      session.set('');
    }
  },
  me: () => request('/api/me', { auth: true }),
  updateMyShop: (data) => request('/api/me/shop', { method: 'PUT', body: data, auth: true }),
  changePassword: (current, next) => request('/api/me/password', { method: 'PUT', body: { current, next }, auth: true }),

  invites: (shop) => request(`/api/admin/invites${q({ shop })}`, { auth: true }),
  createInvite: (data) => request('/api/admin/invites', { method: 'POST', body: data, auth: true }),
  deleteInvite: (id) => request(`/api/admin/invites/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  stats: (days, shop) =>
    request(`/api/admin/stats${q({ days, shop, tz: new Date().getTimezoneOffset() })}`, { auth: true }),

  shops: () => request('/api/super/shops', { auth: true }),
  createShop: (data) => request('/api/super/shops', { method: 'POST', body: data, auth: true }),
  updateShop: (id, data) => request(`/api/super/shops/${encodeURIComponent(id)}`, { method: 'PUT', body: data, auth: true }),
};
