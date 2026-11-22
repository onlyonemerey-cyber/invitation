import { fail, now, safeEqual } from './util.js';

const ITERATIONS = 100_000; // максимум, который разрешает Cloudflare Workers
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 дней
const MAX_FAILS = 8;
const FAIL_WINDOW = 15 * 60 * 1000; // 15 минут

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2') return false;
  const got = await pbkdf2(password, unb64(salt), Number(iter));
  return safeEqual(b64(got), hash);
}

async function sha256(s) {
  return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- защита от подбора ----------

async function checkLocked(env, login) {
  const row = await env.DB.prepare('SELECT * FROM login_attempts WHERE login = ?').bind(login).first();
  if (row && row.fails >= MAX_FAILS && now() - row.window_start < FAIL_WINDOW) fail(429, 'too_many_attempts');
}

async function registerFail(env, login) {
  const t = now();
  await env.DB.prepare(
    `INSERT INTO login_attempts (login, fails, window_start) VALUES (?, 1, ?)
     ON CONFLICT(login) DO UPDATE SET
       fails = CASE WHEN ? - window_start > ? THEN 1 ELSE fails + 1 END,
       window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`
  )
    .bind(login, t, t, FAIL_WINDOW, t, FAIL_WINDOW, t)
    .run();
}

// ---------- вход / выход ----------

/** login = "admin" → супер-админ (пароль ADMIN_PASSWORD), иначе — логин магазина. */
export async function login(env, rawLogin, password) {
  const loginName = String(rawLogin || '').trim().toLowerCase();
  if (!loginName || !password) fail(400, 'login_required');
  await checkLocked(env, loginName);

  let shopId = null;
  let ok = false;
  if (loginName === 'admin') {
    ok = !!env.ADMIN_PASSWORD && safeEqual(password, env.ADMIN_PASSWORD);
  } else {
    const shop = await env.DB.prepare('SELECT id, password_hash, active FROM shops WHERE login = ?').bind(loginName).first();
    if (shop && (await verifyPassword(password, shop.password_hash))) {
      if (!shop.active) fail(403, 'shop_disabled');
      ok = true;
      shopId = shop.id;
    }
  }

  if (!ok) {
    await registerFail(env, loginName);
    fail(401, 'bad_credentials');
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE login = ?').bind(loginName).run();

  const token = newToken();
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, shop_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), shopId, t, t + SESSION_TTL)
    .run();
  // заодно чистим просроченные сессии
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t).run();
  return token;
}

export async function logout(env, req) {
  const token = bearer(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

const bearer = (req) => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();

/**
 * Проверяет сессию. Возвращает { role: 'super' | 'shop', shopId, shop }.
 */
export async function authenticate(env, req) {
  const token = bearer(req);
  if (!token) fail(401, 'unauthorized');
  const s = await env.DB.prepare('SELECT * FROM sessions WHERE token_hash = ?').bind(await sha256(token)).first();
  if (!s || s.expires_at < now()) fail(401, 'unauthorized');

  if (!s.shop_id) return { role: 'super', shopId: null, shop: null };

  const shop = await env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(s.shop_id).first();
  if (!shop || !shop.active) fail(401, 'unauthorized');
  return { role: 'shop', shopId: shop.id, shop };
}

export function requireSuper(auth) {
  if (auth.role !== 'super') fail(403, 'forbidden');
}

/** Выходит из всех сессий магазина (после смены пароля / отключения). */
export async function dropShopSessions(env, shopId, exceptToken) {
  if (exceptToken) {
    await env.DB.prepare('DELETE FROM sessions WHERE shop_id = ? AND token_hash != ?')
      .bind(shopId, await sha256(exceptToken))
      .run();
  } else {
    await env.DB.prepare('DELETE FROM sessions WHERE shop_id = ?').bind(shopId).run();
  }
}

export { bearer };
