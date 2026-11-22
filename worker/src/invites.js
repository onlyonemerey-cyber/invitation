import { clean, fail, json, newId, normalizeUsername, now, readJson, esc } from './util.js';
import { deliverAnswer, sendMessage } from './telegram.js';

// ---------- публичное (страница девушки) ----------

export async function getPublicInvite(env, id, ctx) {
  const inv = await env.DB.prepare(
    `SELECT i.*, s.name AS shop_name, s.color AS shop_color, s.logo AS shop_logo, s.website AS shop_website
     FROM invites i LEFT JOIN shops s ON s.id = i.shop_id WHERE i.id = ?`
  )
    .bind(id)
    .first();
  if (!inv) fail(404, 'not_found');

  if (!inv.opened_at) {
    const res = await env.DB.prepare('UPDATE invites SET opened_at = ? WHERE id = ? AND opened_at IS NULL')
      .bind(now(), id)
      .run();
    // уведомляем только тот запрос, который реально поставил отметку (без дублей)
    if (inv.buyer_chat_id && res.meta?.changes === 1) {
      ctx.waitUntil(sendMessage(env, inv.buyer_chat_id, `👀 ${esc(inv.to_name)} открыла приглашение…`));
    }
  }

  return json({
    id: inv.id,
    toName: inv.to_name,
    fromName: inv.from_name,
    question: inv.question,
    answer: inv.answer ? JSON.parse(inv.answer) : null,
    shop: inv.shop_id
      ? { name: inv.shop_name, color: inv.shop_color, logo: inv.shop_logo, website: inv.shop_website }
      : null,
  });
}

export async function postAnswer(req, env, id) {
  const inv = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(id).first();
  if (!inv) fail(404, 'not_found');
  if (inv.answer_count >= 10) fail(429, 'too_many_changes');

  const body = await readJson(req);
  const answer = {
    place: clean(body.place, 80),
    date: clean(body.date, 10),
    time: clean(body.time, 5),
    escapes: Math.max(0, Math.min(9999, parseInt(body.escapes, 10) || 0)),
  };
  if (!answer.place) fail(400, 'place_required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(answer.date)) fail(400, 'bad_date');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(answer.time)) fail(400, 'bad_time');

  const isUpdate = !!inv.answer;
  inv.answer = JSON.stringify(answer);
  await env.DB.prepare(
    'UPDATE invites SET answer = ?, answered_at = ?, answer_count = answer_count + 1, delivered_at = NULL WHERE id = ?'
  )
    .bind(inv.answer, now(), id)
    .run();

  // если покупатель ещё не нажал Start — ответ сохранён и придёт после /start
  const delivered = await deliverAnswer(env, inv, isUpdate);
  return json({ ok: true, delivered });
}

// ---------- админка ----------

function adminView(inv, env) {
  return {
    id: inv.id,
    shopId: inv.shop_id,
    shopName: inv.shop_name ?? null,
    buyerUsername: inv.buyer_username,
    buyerConnected: !!inv.buyer_chat_id,
    toName: inv.to_name,
    fromName: inv.from_name,
    question: inv.question,
    createdAt: inv.created_at,
    openedAt: inv.opened_at,
    answer: inv.answer ? JSON.parse(inv.answer) : null,
    answeredAt: inv.answered_at,
    deliveredAt: inv.delivered_at,
    buyerLink: `https://t.me/${env.BOT_USERNAME}?start=${inv.id}`,
  };
}

/** Магазин видит только свои приглашения; супер-админ — все (или фильтр ?shop=). */
function scope(auth, url) {
  if (auth.role === 'shop') return { where: 'i.shop_id = ?', args: [auth.shopId] };
  const f = url.searchParams.get('shop');
  if (f === 'none') return { where: 'i.shop_id IS NULL', args: [] };
  if (f) return { where: 'i.shop_id = ?', args: [f] };
  return { where: '1 = 1', args: [] };
}

export async function listInvites(env, auth, url) {
  const { where, args } = scope(auth, url);
  const { results } = await env.DB.prepare(
    `SELECT i.*, s.name AS shop_name FROM invites i LEFT JOIN shops s ON s.id = i.shop_id
     WHERE ${where} ORDER BY i.created_at DESC LIMIT 500`
  )
    .bind(...args)
    .all();
  return json(results.map((r) => adminView(r, env)));
}

export async function createInvite(req, env, auth) {
  const body = await readJson(req);
  const buyer = normalizeUsername(body.buyerUsername);
  const toName = clean(body.toName, 40);
  if (!toName) fail(400, 'to_name_required');
  if (buyer && !/^[a-z0-9_]{4,32}$/.test(buyer)) fail(400, 'bad_username');

  // магазин создаёт только для себя; супер-админ может указать магазин
  let shopId = auth.shopId;
  if (auth.role === 'super' && body.shopId) {
    const s = await env.DB.prepare('SELECT id FROM shops WHERE id = ?').bind(body.shopId).first();
    if (!s) fail(400, 'shop_not_found');
    shopId = s.id;
  }

  const inv = {
    id: newId(),
    shop_id: shopId,
    buyer_username: buyer || null,
    to_name: toName,
    from_name: clean(body.fromName, 40) || null,
    question: clean(body.question, 120) || null,
    created_at: now(),
  };
  await env.DB.prepare(
    'INSERT INTO invites (id, shop_id, buyer_username, to_name, from_name, question, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(inv.id, inv.shop_id, inv.buyer_username, inv.to_name, inv.from_name, inv.question, inv.created_at)
    .run();

  if (shopId) {
    const s = await env.DB.prepare('SELECT name FROM shops WHERE id = ?').bind(shopId).first();
    inv.shop_name = s?.name;
  }
  return json(adminView(inv, env), 201);
}

export async function deleteInvite(env, auth, id) {
  const res =
    auth.role === 'super'
      ? await env.DB.prepare('DELETE FROM invites WHERE id = ?').bind(id).run()
      : await env.DB.prepare('DELETE FROM invites WHERE id = ? AND shop_id = ?').bind(id, auth.shopId).run();
  if (!res.meta?.changes) fail(404, 'not_found');
  return json({ ok: true });
}
