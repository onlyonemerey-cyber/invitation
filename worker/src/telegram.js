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

export const sendMessage = (env, chatId, text) =>
  tg(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });

export async function loadShop(env, shopId) {
  if (!shopId) return null;
  return env.DB.prepare('SELECT id, name, website FROM shops WHERE id = ?').bind(shopId).first();
}

function shopFooter(shop) {
  if (!shop) return '';
  const name = esc(shop.name);
  return shop.website
    ? `\n\n💐 Цветы к свиданию — <a href="${esc(shop.website)}">${name}</a>`
    : `\n\n💐 ${name}`;
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
  const res = await sendMessage(env, inv.buyer_chat_id, answerMessage(inv, JSON.parse(inv.answer), isUpdate, shop));
  if (res.ok) {
    await env.DB.prepare('UPDATE invites SET delivered_at = ? WHERE id = ?').bind(now(), inv.id).run();
  }
  return !!res.ok;
}

export async function handleWebhook(req, env) {
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
        'Чтобы получить ответ, открой ссылку или отсканируй QR-код, который тебе дали в магазине — ' +
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
