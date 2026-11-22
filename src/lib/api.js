const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const apiConfigured = Boolean(API);

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// страница девушки
export const getInvite = (id) => request(`/api/invites/${encodeURIComponent(id)}`);
export const sendAnswer = (id, answer) =>
  request(`/api/invites/${encodeURIComponent(id)}/answer`, { method: 'POST', body: answer });

// админка
export const admin = {
  check: (token) => request('/api/admin/check', { token }),
  list: (token) => request('/api/admin/invites', { token }),
  create: (token, data) => request('/api/admin/invites', { method: 'POST', body: data, token }),
  remove: (token, id) => request(`/api/admin/invites/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
};
