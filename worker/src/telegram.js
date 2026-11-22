import { esc, formatDateRu, normalizeUsername, now, safeEqual, timesWord } from './util.js';

export async function tg(env, method, body) {
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

export const sendMessage = (env, chatId, text, extra = {}) =>
  tg(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

export async function loadShop(env, shopId) {
  if (!shopId) return null;
  return env.DB.prepare('SELECT id, name, website, order_link FROM shops WHERE id = ?').bind(shopId).first();
}

/** Сообщение всем подключённым сотрудникам магазина. */
export async function notifyShop(env, shopId, text) {
  if (!shopId) return;
  const { results } = await env.DB.prepare('SELECT chat_id FROM shop_chats WHERE shop_id = ?').bind(shopId).all();
  await Promise.all(results.map((r) => sendMessage(env, r.chat_id, text)));
}

/** Ссылка на кнопку «Заказать букет»: через наш сервер, чтобы посчитать переход. */
export const orderRedirectUrl = (env, inviteId) => `${(env.API_URL || '').replace(/\/+$/, '')}/r/${inviteId}`;

function shopFooter(shop) {
  if (!shop) return '';
  const name = esc(shop.name);
  if (shop.order_link) return `\n\n💐 Букет к свиданию — в «${name}», кнопка ниже 👇`;
  return shop.website
    ? `\n\n💐 Цветы к свиданию — <a href="${esc(shop.website)}">${name}</a>`
    : `\n\n💐 ${name}`;
}

export function answerSummary(answer) {
  return `📍 ${esc(answer.place)} · 📅 ${formatDateRu(answer.date)} · ⏰ ${answer.time}`;
}

function answerMessage(inv, answer, isUpdate, shop) {
  const name = esc(inv.to_name);
  const head = isUpdate ? `✏️ <b>${name} изменила выбор</b>` : `💌 <b>${name} ответила ДА!</b>`;
  return (
    `${head}\n\n` +
    `📍 Куда: <b>${esc(answer.place)}</b>\n` +
    `📅 Когда: <b>${formatDateRu(answer.date)}</b>\n` +
    `⏰ Время: <b>${answer.time}</b>\n\n` +
    `🏃 Пыталась нажать «Нет»: ${answer.escapes} ${timesWord(answer.escapes)}` +
    shopFooter(shop)
  );
}

/** Отправляет сохранённый ответ покупателю, если он уже подключён к боту. */
export async function deliverAnswer(env, inv, isUpdate) {
  if (!inv.buyer_chat_id || !inv.answer) return false;
  const shop = await loadShop(env, inv.shop_id);
  const extra = shop?.order_link
    ? { reply_markup: { inline_keyboard: [[{ text: '💐 Заказать букет к свиданию', url: orderRedirectUrl(env, inv.id) }]] } }
    : {};
  const text = answerMessage(inv, JSON.parse(inv.answer), isUpdate, shop);
  let res = await sendMessage(env, inv.buyer_chat_id, text, extra);
  // если Telegram не принял кнопку — ответ девушки всё равно важнее, отправляем без неё
  if (!res.ok && extra.reply_markup) res = await sendMessage(env, inv.buyer_chat_id, text);
  if (res.ok) {
    await env.DB.prepare('UPDATE invites SET delivered_at = ? WHERE id = ?').bind(now(), inv.id).run();
  }
  return !!res.ok;
}

// ---------- вебхук ----------

async function connectShopChat(env, msg, code) {
  const chatId = msg.chat.id;
  const shop = await env.DB.prepare('SELECT id, name FROM shops WHERE tg_code = ?').bind(code).first();
  if (!shop) {
    await sendMessage(env, chatId, '😔 Ссылка для подключения устарела. Возьми новую в кабинете магазина.');
    return;
  }
  const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') + (msg.from?.username ? ` (@${msg.from.username})` : '');
  await env.DB.prepare(
    `INSERT INTO shop_chats (shop_id, chat_id, name, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(shop_id, chat_id) DO UPDATE SET name = excluded.name`
  )
    .bind(shop.id, chatId, name.slice(0, 80), now())
    .run();
  await sendMessage(
    env,
    chatId,
    `✅ Уведомления магазина «${esc(shop.name)}» подключены.\n\n` +
      'Сюда будут приходить:\n💌 новые ответы девушек\n🛒 переходы покупателей к заказу букета\n⏰ напоминания об оплате подписки'
  );
}

async function connectBuyer(env, msg, inviteId) {
  const chatId = msg.chat.id;
  const inv = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();
  if (!inv) {
    await sendMessage(env, chatId, '😔 Приглашение не найдено. Проверь ссылку или обратись в магазин.');
    return;
  }

  const username = normalizeUsername(msg.from?.username);
  if (inv.buyer_username && inv.buyer_username !== username) {
    await sendMessage(
      env,
      chatId,
      `🔒 Это приглашение оформлено на @${esc(inv.buyer_username)}.\nОткрой ссылку с этого аккаунта Telegram.`
    );
    return;
  }
  if (inv.buyer_chat_id && inv.buyer_chat_id !== chatId) {
    await sendMessage(env, chatId, '🔒 Это приглашение уже привязано к другому аккаунту.');
    return;
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
}

export async function handleWebhook(req, env) {
  if (!safeEqual(req.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', env.TG_WEBHOOK_SECRET || '')) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  // Telegram'у всегда отвечаем 200, иначе он будет повторять запрос
  if (!msg?.text || msg.chat?.type !== 'private') return new Response('ok');

  const m = msg.text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?/);
  const param = m?.[1];

  if (!param) {
    await sendMessage(
      env,
      msg.chat.id,
      '👋 Привет! Я доставляю ответы на приглашения на свидание 💌\n\n' +
        'Чтобы получить ответ, открой ссылку или отсканируй QR-код, который тебе дали в магазине — ' +
        'и я сразу пришлю его сюда.'
    );
  } else if (param.startsWith('s_')) {
    await connectShopChat(env, msg, param.slice(2));
  } else {
    await connectBuyer(env, msg, param);
  }
  return new Response('ok');
}

export async function setupWebhook(req, env) {
  const url = new URL('/tg/webhook', req.url).toString();
  const res = await tg(env, 'setWebhook', {
    url,
    secret_token: env.TG_WEBHOOK_SECRET,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  return { url, telegram: res };
}
