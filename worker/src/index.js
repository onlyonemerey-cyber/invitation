/**
 * API приглашений + Telegram-бот.
 *
 * Публичное (страница девушки):
 *   GET  /api/invites/:id           — данные приглашения
 *   POST /api/invites/:id/answer    — ответ {place, date, time, escapes}
 *
 * Админка (заголовок Authorization: Bearer <ADMIN_PASSWORD>):
 *   GET    /api/admin/check
 *   GET    /api/admin/invites
 *   POST   /api/admin/invites       — {buyerUsername, toName, fromName, question}
 *   DELETE /api/admin/invites/:id
 *   POST   /api/admin/setup-webhook — подключает бота к этому серверу
 *
 * Telegram:
 *   POST /tg/webhook                — сюда Telegram присылает сообщения боту
 */

// ---------- утилиты ----------

const now = () => Date.now();

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

const fail = (status, error) => json({ error }, status);

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newId(len = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function safeEqual(a = '', b = '') {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** "@Name", "t.me/Name", "https://t.me/Name" → "name" */
function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@/, '')
    .toLowerCase();
}

const clean = (s, max) => String(s ?? '').trim().slice(0, max);

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function formatDateRu(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

function timesWord(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'раз';
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'раза';
  return 'раз';
}

// ---------- Telegram ----------

async function tg(env, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!data.ok) console.error('telegram', method, data);
    return data;
  } catch (e) {
    console.error('telegram', method, e);
    return { ok: false };
  }
}

const sendMessage = (env, chatId, text) =>
  tg(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });

function answerMessage(inv, answer, isUpdate) {
  const name = esc(inv.to_name);
  const head = isUpdate ? `✏️ <b>${name} изменила выбор</b>` : `💌 <b>${name} ответила ДА!</b>`;
  return (
    `${head}\n\n` +
    `📍 Куда: <b>${esc(answer.place)}</b>\n` +
    `📅 Когда: <b>${formatDateRu(answer.date)}</b>\n` +
    `⏰ Время: <b>${answer.time}</b>\n\n` +
    `🏃 Пыталась нажать «Нет»: ${answer.escapes} ${timesWord(answer.escapes)}`
  );
}

/** Отправляет сохранённый ответ покупателю, если он уже подключён к боту. */
async function deliverAnswer(env, inv, isUpdate) {
  if (!inv.buyer_chat_id || !inv.answer) return false;
  const res = await sendMessage(env, inv.buyer_chat_id, answerMessage(inv, JSON.parse(inv.answer), isUpdate));
  if (res.ok) {
    await env.DB.prepare('UPDATE invites SET delivered_at = ? WHERE id = ?').bind(now(), inv.id).run();
  }
  return !!res.ok;
}

async function handleTelegram(req, env) {
  if (!safeEqual(req.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', env.TG_WEBHOOK_SECRET || '')) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  // Telegram'у всегда отвечаем 200, иначе он будет повторять запрос
  if (!msg?.text || msg.chat?.type !== 'private') return new Response('ok');

  const chatId = msg.chat.id;
  const m = msg.text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?/);

  if (!m || !m[1]) {
    await sendMessage(
      env,
      chatId,
      '👋 Привет! Я доставляю ответы на приглашения на свидание 💌\n\n' +
        'Чтобы получить ответ, открой ссылку, которую тебе дали в магазине — ' +
        'и я сразу пришлю его сюда.'
    );
    return new Response('ok');
  }

  const inv = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(m[1]).first();
  if (!inv) {
    await sendMessage(env, chatId, '😔 Приглашение не найдено. Проверь ссылку или обратись в магазин.');
    return new Response('ok');
  }

  const username = normalizeUsername(msg.from?.username);
  if (inv.buyer_username && inv.buyer_username !== username) {
    await sendMessage(
      env,
      chatId,
      `🔒 Это приглашение оформлено на @${esc(inv.buyer_username)}.\nОткрой ссылку с этого аккаунта Telegram.`
    );
    return new Response('ok');
  }
  if (inv.buyer_chat_id && inv.buyer_chat_id !== chatId) {
    await sendMessage(env, chatId, '🔒 Это приглашение уже привязано к другому аккаунту.');
    return new Response('ok');
  }

  if (!inv.buyer_chat_id) {
    await env.DB.prepare('UPDATE invites SET buyer_chat_id = ? WHERE id = ?').bind(chatId, inv.id).run();
    inv.buyer_chat_id = chatId;
  }

  const name = esc(inv.to_name);
  if (inv.answer) {
    await sendMessage(env, chatId, `✅ Готово! Ответ от ${name} уже есть 👇`);
    await deliverAnswer(env, inv, false);
  } else {
    const opened = inv.opened_at ? `\n👀 ${name} уже открыла приглашение.` : '';
    await sendMessage(env, chatId, `✅ Готово! Как только ${name} ответит, я сразу напишу сюда 💌${opened}`);
  }
  return new Response('ok');
}

// ---------- публичное API ----------

function publicInvite(inv) {
  return {
    id: inv.id,
    toName: inv.to_name,
    fromName: inv.from_name,
    question: inv.question,
    answer: inv.answer ? JSON.parse(inv.answer) : null,
  };
}

async function getInvite(env, id, ctx) {
  const inv = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(id).first();
  if (!inv) return fail(404, 'not_found');

  if (!inv.opened_at) {
    const res = await env.DB.prepare('UPDATE invites SET opened_at = ? WHERE id = ? AND opened_at IS NULL')
      .bind(now(), id)
      .run();
    // уведомляем только тот запрос, который реально поставил отметку (без дублей)
    if (inv.buyer_chat_id && res.meta?.changes === 1) {
      ctx.waitUntil(sendMessage(env, inv.buyer_chat_id, `👀 ${esc(inv.to_name)} открыла приглашение…`));
    }
  }
  return json(publicInvite(inv));
}

async function postAnswer(req, env, id) {
  const inv = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(id).first();
  if (!inv) return fail(404, 'not_found');
  if (inv.answer_count >= 10) return fail(429, 'too_many_changes');

  const body = await req.json().catch(() => ({}));
  const answer = {
    place: clean(body.place, 80),
    date: clean(body.date, 10),
    time: clean(body.time, 5),
    escapes: Math.max(0, Math.min(9999, parseInt(body.escapes, 10) || 0)),
  };
  if (!answer.place) return fail(400, 'place_required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(answer.date)) return fail(400, 'bad_date');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(answer.time)) return fail(400, 'bad_time');

  const isUpdate = !!inv.answer;
  inv.answer = JSON.stringify(answer);
  await env.DB.prepare(
    'UPDATE invites SET answer = ?, answered_at = ?, answer_count = answer_count + 1, delivered_at = NULL WHERE id = ?'
  )
    .bind(inv.answer, now(), id)
    .run();

  const delivered = await deliverAnswer(env, inv, isUpdate);
  // если покупатель ещё не нажал Start — ответ сохранён и придёт после /start
  return json({ ok: true, delivered });
}

// ---------- админка ----------

function adminView(inv, env) {
  return {
    id: inv.id,
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
    girlLink: `${env.SITE_URL}?i=${inv.id}`,
    buyerLink: `https://t.me/${env.BOT_USERNAME}?start=${inv.id}`,
  };
}

async function createInvite(req, env) {
  const body = await req.json().catch(() => ({}));
  const buyer = normalizeUsername(body.buyerUsername);
  const toName = clean(body.toName, 40);
  if (!toName) return fail(400, 'to_name_required');
  if (buyer && !/^[a-z0-9_]{4,32}$/.test(buyer)) return fail(400, 'bad_username');

  const inv = {
    id: newId(),
    buyer_username: buyer || null,
    to_name: toName,
    from_name: clean(body.fromName, 40) || null,
    question: clean(body.question, 120) || null,
    created_at: now(),
  };
  await env.DB.prepare(
    'INSERT INTO invites (id, buyer_username, to_name, from_name, question, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(inv.id, inv.buyer_username, inv.to_name, inv.from_name, inv.question, inv.created_at)
    .run();
  return json(adminView(inv, env), 201);
}

async function listInvites(env) {
  const { results } = await env.DB.prepare('SELECT * FROM invites ORDER BY created_at DESC LIMIT 300').all();
  return json(results.map((r) => adminView(r, env)));
}

async function setupWebhook(req, env) {
  const url = new URL('/tg/webhook', req.url).toString();
  const res = await tg(env, 'setWebhook', {
    url,
    secret_token: env.TG_WEBHOOK_SECRET,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  return json({ url, telegram: res }, res.ok ? 200 : 502);
}

// ---------- роутер ----------

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '');
  const method = req.method;

  if (p === '/tg/webhook' && method === 'POST') return handleTelegram(req, env);

  let m;
  if ((m = p.match(/^\/api\/invites\/([A-Za-z0-9_-]{1,64})$/)) && method === 'GET') return getInvite(env, m[1], ctx);
  if ((m = p.match(/^\/api\/invites\/([A-Za-z0-9_-]{1,64})\/answer$/)) && method === 'POST') return postAnswer(req, env, m[1]);

  if (p.startsWith('/api/admin/')) {
    const auth = req.headers.get('Authorization') || '';
    if (!env.ADMIN_PASSWORD || !safeEqual(auth, `Bearer ${env.ADMIN_PASSWORD}`)) return fail(401, 'unauthorized');

    if (p === '/api/admin/check' && method === 'GET') return json({ ok: true });
    if (p === '/api/admin/invites' && method === 'GET') return listInvites(env);
    if (p === '/api/admin/invites' && method === 'POST') return createInvite(req, env);
    if ((m = p.match(/^\/api\/admin\/invites\/([A-Za-z0-9_-]{1,64})$/)) && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM invites WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }
    if (p === '/api/admin/setup-webhook' && method === 'POST') return setupWebhook(req, env);
  }

  if (p === '' || p === '/') return new Response('invitation-api ok 💌');
  return fail(404, 'not_found');
}

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      res = await route(req, env, ctx);
    } catch (e) {
      console.error(e);
      res = fail(500, 'server_error');
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
