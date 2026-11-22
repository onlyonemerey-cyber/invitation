const TOKEN = import.meta.env.VITE_TG_BOT_TOKEN;
const CHAT_ID = import.meta.env.VITE_TG_CHAT_ID;

export const telegramConfigured = Boolean(TOKEN && CHAT_ID);

/**
 * Отправляет сообщение в Telegram.
 * mode: 'no-cors' + form-urlencoded — «простой» запрос, браузер не блокирует его CORS-ом.
 * Минус: ответ сервера прочитать нельзя, поэтому успех = «запрос ушёл».
 */
export async function sendTelegram(text) {
  if (!telegramConfigured) {
    console.warn('Telegram не настроен: заполни VITE_TG_BOT_TOKEN и VITE_TG_CHAT_ID в .env');
    return false;
  }
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ chat_id: CHAT_ID, text }),
  });
  return true;
}
