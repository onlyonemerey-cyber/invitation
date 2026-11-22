import { checkPassword, clean, cleanColor, cleanLogin, cleanLogo, cleanUrl, fail, json, newId, now, readJson } from './util.js';
import { dropShopSessions, hashPassword, verifyPassword, bearer } from './auth.js';

export function shopView(s, extra = {}) {
  return {
    id: s.id,
    login: s.login,
    name: s.name,
    color: s.color,
    logo: s.logo,
    website: s.website,
    active: !!s.active,
    createdAt: s.created_at,
    ...extra,
  };
}

/** Общие поля брендинга: правит и магазин, и супер-админ. */
function brandingPatch(body) {
  const patch = {};
  if ('name' in body) {
    patch.name = clean(body.name, 60);
    if (!patch.name) fail(400, 'name_required');
  }
  if ('color' in body) patch.color = body.color ? cleanColor(body.color) : null;
  if ('logo' in body) patch.logo = cleanLogo(body.logo);
  if ('website' in body) patch.website = cleanUrl(body.website);
  return patch;
}

async function applyPatch(env, id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  await env.DB.prepare(`UPDATE shops SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => patch[k]), id)
    .run();
}

// ---------- магазин: свой профиль ----------

export async function updateOwnShop(req, env, auth) {
  const patch = brandingPatch(await readJson(req));
  await applyPatch(env, auth.shopId, patch);
  const s = await env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(auth.shopId).first();
  return json(shopView(s));
}

export async function changeOwnPassword(req, env, auth) {
  const body = await readJson(req);
  if (!(await verifyPassword(String(body.current || ''), auth.shop.password_hash))) fail(400, 'bad_current_password');
  const hash = await hashPassword(checkPassword(body.next));
  await env.DB.prepare('UPDATE shops SET password_hash = ? WHERE id = ?').bind(hash, auth.shopId).run();
  await dropShopSessions(env, auth.shopId, bearer(req)); // выкидываем с других устройств
  return json({ ok: true });
}

// ---------- супер-админ: управление магазинами ----------

export async function listShops(env) {
  const { results } = await env.DB.prepare(
    `SELECT s.*,
       (SELECT COUNT(*) FROM invites i WHERE i.shop_id = s.id) AS invites,
       (SELECT COUNT(*) FROM invites i WHERE i.shop_id = s.id AND i.answer IS NOT NULL) AS answered
     FROM shops s ORDER BY s.created_at DESC`
  ).all();
  return json(results.map((s) => shopView(s, { invites: s.invites, answered: s.answered })));
}

export async function createShop(req, env) {
  const body = await readJson(req);
  const login = cleanLogin(body.login);
  const password = checkPassword(body.password);
  const patch = brandingPatch({ name: body.name, ...body });
  if (!patch.name) fail(400, 'name_required');

  const exists = await env.DB.prepare('SELECT 1 FROM shops WHERE login = ?').bind(login).first();
  if (exists) fail(409, 'login_taken');

  const shop = {
    id: newId(8),
    login,
    password_hash: await hashPassword(password),
    name: patch.name,
    color: patch.color ?? null,
    logo: patch.logo ?? null,
    website: patch.website ?? null,
    active: 1,
    created_at: now(),
  };
  await env.DB.prepare(
    'INSERT INTO shops (id, login, password_hash, name, color, logo, website, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(shop.id, shop.login, shop.password_hash, shop.name, shop.color, shop.logo, shop.website, shop.active, shop.created_at)
    .run();
  return json(shopView(shop, { invites: 0, answered: 0 }), 201);
}

export async function updateShop(req, env, id) {
  const s = await env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(id).first();
  if (!s) fail(404, 'not_found');
  const body = await readJson(req);
  const patch = brandingPatch(body);

  if ('active' in body) patch.active = body.active ? 1 : 0;
  if (body.password) patch.password_hash = await hashPassword(checkPassword(body.password));
  await applyPatch(env, id, patch);

  if (patch.active === 0 || patch.password_hash) await dropShopSessions(env, id);
  const updated = await env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(id).first();
  return json(shopView(updated));
}
