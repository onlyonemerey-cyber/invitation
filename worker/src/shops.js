import {
  checkPassword, clean, cleanColor, cleanLogin, cleanLogo, cleanOrderLink, cleanUrl,
  fail, json, newId, now, orderLinkView, readJson,
} from './util.js';
import { dropShopSessions, hashPassword, verifyPassword, bearer } from './auth.js';
import { DAY, PLANS, TRIAL_DAYS, billingState, extendUntil, monthStart, planOf, usedThisMonth } from './plans.js';

export function shopView(s, extra = {}) {
  return {
    id: s.id,
    login: s.login,
    name: s.name,
    color: s.color,
    logo: s.logo,
    website: s.website,
    orderLink: orderLinkView(s.order_link),
    plan: s.plan,
    paidUntil: s.paid_until,
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
  if ('orderLink' in body) patch.order_link = cleanOrderLink(body.orderLink);
  return patch;
}

async function applyPatch(env, id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  await env.DB.prepare(`UPDATE shops SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => patch[k]), id)
    .run();
}

// ---------- настройки сервиса ----------

const SETTING_KEYS = { paymentInstructions: 'payment_instructions', contact: 'contact' };

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const map = Object.fromEntries(results.map((r) => [r.key, r.value]));
  return {
    paymentInstructions: map.payment_instructions || '',
    contact: map.contact || '',
  };
}

export async function updateSettings(req, env) {
  const body = await readJson(req);
  const values = {
    paymentInstructions: clean(body.paymentInstructions, 1000),
    contact: body.contact ? cleanUrl(body.contact) : '',
  };
  for (const [k, col] of Object.entries(SETTING_KEYS)) {
    if (!(k in body)) continue;
    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(col, values[k])
      .run();
  }
  return json(await getSettings(env));
}

const plansList = () => Object.values(PLANS);

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

export async function getOwnBilling(env, auth) {
  const state = billingState(auth.shop, await usedThisMonth(env, auth.shopId));
  return json({ ...state, plans: plansList(), ...(await getSettings(env)) });
}

/** Ссылка для подключения Telegram-уведомлений + список подключённых. */
export async function getOwnTelegram(env, auth) {
  let code = auth.shop.tg_code;
  if (!code) {
    code = newId(16);
    await env.DB.prepare('UPDATE shops SET tg_code = ? WHERE id = ?').bind(code, auth.shopId).run();
  }
  const { results } = await env.DB.prepare('SELECT chat_id, name, created_at FROM shop_chats WHERE shop_id = ? ORDER BY created_at')
    .bind(auth.shopId)
    .all();
  return json({
    link: `https://t.me/${env.BOT_USERNAME}?start=s_${code}`,
    chats: results.map((r) => ({ chatId: r.chat_id, name: r.name, createdAt: r.created_at })),
  });
}

export async function removeOwnChat(env, auth, chatId) {
  await env.DB.prepare('DELETE FROM shop_chats WHERE shop_id = ? AND chat_id = ?').bind(auth.shopId, Number(chatId)).run();
  return json({ ok: true });
}

// ---------- супер-админ: управление магазинами ----------

export async function listShops(env) {
  const ms = monthStart();
  const { results } = await env.DB.prepare(
    `SELECT s.*,
       (SELECT COUNT(*) FROM invites i WHERE i.shop_id = s.id) AS invites,
       (SELECT COUNT(*) FROM invites i WHERE i.shop_id = s.id AND i.answer IS NOT NULL) AS answered,
       (SELECT COUNT(*) FROM invites i WHERE i.shop_id = s.id AND i.created_at >= ?) AS used_month,
       (SELECT COUNT(*) FROM shop_chats c WHERE c.shop_id = s.id) AS chats
     FROM shops s ORDER BY s.created_at DESC`
  )
    .bind(ms)
    .all();
  return json(
    results.map((s) =>
      shopView(s, {
        invites: s.invites,
        answered: s.answered,
        chats: s.chats,
        billing: billingState(s, s.used_month),
      })
    )
  );
}

export async function createShop(req, env) {
  const body = await readJson(req);
  const login = cleanLogin(body.login);
  const password = checkPassword(body.password);
  const patch = brandingPatch(body);
  if (!patch.name) fail(400, 'name_required');

  const exists = await env.DB.prepare('SELECT 1 FROM shops WHERE login = ?').bind(login).first();
  if (exists) fail(409, 'login_taken');

  const t = now();
  const shop = {
    id: newId(8),
    login,
    password_hash: await hashPassword(password),
    name: patch.name,
    color: patch.color ?? null,
    logo: patch.logo ?? null,
    website: patch.website ?? null,
    order_link: patch.order_link ?? null,
    plan: 'trial',
    paid_until: t + TRIAL_DAYS * DAY,
    active: 1,
    created_at: t,
  };
  await env.DB.prepare(
    `INSERT INTO shops (id, login, password_hash, name, color, logo, website, order_link, plan, paid_until, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(shop.id, shop.login, shop.password_hash, shop.name, shop.color, shop.logo, shop.website, shop.order_link,
      shop.plan, shop.paid_until, shop.active, shop.created_at)
    .run();
  return json(shopView(shop, { invites: 0, answered: 0, chats: 0, billing: billingState(shop, 0) }), 201);
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

/**
 * POST /api/super/shops/:id/extend — {plan, months, amount, note}
 * Отмечает оплату: меняет тариф и продлевает доступ. months = 0 — только сменить тариф.
 */
export async function extendShop(req, env, id) {
  const s = await env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(id).first();
  if (!s) fail(404, 'not_found');
  const body = await readJson(req);

  const plan = PLANS[body.plan] ? body.plan : s.plan;
  const months = Math.max(0, Math.min(24, parseInt(body.months, 10) || 0));
  const amount = body.amount === '' || body.amount == null ? null : Math.max(0, parseInt(body.amount, 10) || 0);
  const paidUntil = months ? extendUntil(s.paid_until, months) : s.paid_until;

  await env.DB.prepare('UPDATE shops SET plan = ?, paid_until = ? WHERE id = ?').bind(plan, paidUntil, id).run();
  if (months || amount) {
    await env.DB.prepare(
      'INSERT INTO payments (id, shop_id, plan, months, amount, note, paid_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(newId(), id, plan, months, amount, clean(body.note, 200) || null, paidUntil, now())
      .run();
  }
  const updated = await env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(id).first();
  return json(shopView(updated, { billing: billingState(updated, await usedThisMonth(env, id)) }));
}

/** GET /api/super/payments — журнал оплат и выручка. */
export async function listPayments(env) {
  const { results } = await env.DB.prepare(
    `SELECT p.*, s.name AS shop_name FROM payments p LEFT JOIN shops s ON s.id = p.shop_id
     ORDER BY p.created_at DESC LIMIT 200`
  ).all();
  const ms = monthStart();
  const totals = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total,
       COALESCE(SUM(CASE WHEN created_at >= ? THEN amount ELSE 0 END), 0) AS month
     FROM payments`
  )
    .bind(ms)
    .first();
  return json({
    totals,
    payments: results.map((p) => ({
      id: p.id,
      shopId: p.shop_id,
      shopName: p.shop_name,
      plan: p.plan,
      planName: planOf(p.plan).name,
      months: p.months,
      amount: p.amount,
      note: p.note,
      paidUntil: p.paid_until,
      createdAt: p.created_at,
    })),
  });
}

export async function getSuperSettings(env) {
  return json({ ...(await getSettings(env)), plans: plansList() });
}
