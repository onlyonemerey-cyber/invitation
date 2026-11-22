/**
 * API приглашений + Telegram-бот.
 *
 * Публичное (страница девушки):
 *   GET  /api/invites/:id             — данные приглашения + брендинг магазина
 *   POST /api/invites/:id/answer      — ответ {place, date, time, escapes}
 *
 * Вход (магазин или супер-админ с логином "admin"):
 *   POST /api/auth/login              — {login, password} → {token, me}
 *   POST /api/auth/logout
 *   GET  /api/me
 *
 * Магазин / супер-админ (Authorization: Bearer <token>):
 *   GET    /api/admin/invites[?shop=]
 *   POST   /api/admin/invites         — {buyerUsername, toName, fromName, question, shopId?}
 *   DELETE /api/admin/invites/:id
 *   GET    /api/admin/stats?days=&tz=[&shop=]
 *   PUT    /api/me/shop               — брендинг своего магазина
 *   PUT    /api/me/password           — {current, next}
 *
 * Только супер-админ:
 *   GET  /api/super/shops
 *   POST /api/super/shops             — {login, password, name, color, logo, website}
 *   PUT  /api/super/shops/:id         — любые поля + active + password
 *   POST /api/super/setup-webhook
 *
 * Telegram:
 *   POST /tg/webhook
 */
import { HttpError, json, readJson } from './util.js';
import { authenticate, login, logout, requireSuper } from './auth.js';
import { handleWebhook, setupWebhook } from './telegram.js';
import { createInvite, deleteInvite, getPublicInvite, listInvites, postAnswer } from './invites.js';
import { changeOwnPassword, createShop, listShops, shopView, updateOwnShop, updateShop } from './shops.js';
import { getStats } from './stats.js';

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const ID = '([A-Za-z0-9_-]{1,64})';

function meView(auth) {
  return auth.role === 'super' ? { role: 'super', shop: null } : { role: 'shop', shop: shopView(auth.shop) };
}

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '');
  const method = req.method;
  let m;

  if (p === '/tg/webhook' && method === 'POST') return handleWebhook(req, env);

  // публичное
  if ((m = p.match(new RegExp(`^/api/invites/${ID}$`))) && method === 'GET') return getPublicInvite(env, m[1], ctx);
  if ((m = p.match(new RegExp(`^/api/invites/${ID}/answer$`))) && method === 'POST') return postAnswer(req, env, m[1]);

  // вход
  if (p === '/api/auth/login' && method === 'POST') {
    const body = await readJson(req);
    const token = await login(env, body.login, body.password);
    const auth = await authenticate(env, new Request(req.url, { headers: { Authorization: `Bearer ${token}` } }));
    return json({ token, me: meView(auth) });
  }
  if (p === '/api/auth/logout' && method === 'POST') {
    await logout(env, req);
    return json({ ok: true });
  }

  if (!p.startsWith('/api/')) {
    if (p === '') return new Response('invitation-api ok 💌');
    return json({ error: 'not_found' }, 404);
  }

  // всё ниже — только после входа
  const auth = await authenticate(env, req);

  if (p === '/api/me' && method === 'GET') return json(meView(auth));
  if (p === '/api/me/shop' && method === 'PUT') {
    if (auth.role !== 'shop') return json({ error: 'forbidden' }, 403);
    return updateOwnShop(req, env, auth);
  }
  if (p === '/api/me/password' && method === 'PUT') {
    if (auth.role !== 'shop') return json({ error: 'forbidden' }, 403);
    return changeOwnPassword(req, env, auth);
  }

  if (p === '/api/admin/invites' && method === 'GET') return listInvites(env, auth, url);
  if (p === '/api/admin/invites' && method === 'POST') return createInvite(req, env, auth);
  if ((m = p.match(new RegExp(`^/api/admin/invites/${ID}$`))) && method === 'DELETE') return deleteInvite(env, auth, m[1]);
  if (p === '/api/admin/stats' && method === 'GET') return getStats(env, auth, url);

  if (p.startsWith('/api/super/')) {
    requireSuper(auth);
    if (p === '/api/super/shops' && method === 'GET') return listShops(env);
    if (p === '/api/super/shops' && method === 'POST') return createShop(req, env);
    if ((m = p.match(new RegExp(`^/api/super/shops/${ID}$`))) && method === 'PUT') return updateShop(req, env, m[1]);
    if (p === '/api/super/setup-webhook' && method === 'POST') {
      const r = await setupWebhook(req, env);
      return json(r, r.telegram.ok ? 200 : 502);
    }
  }

  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      res = await route(req, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) res = json({ error: e.message }, e.status);
      else {
        console.error(e);
        res = json({ error: 'server_error' }, 500);
      }
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
