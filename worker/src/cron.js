import { notifyShop } from './telegram.js';
import { DAY, planOf } from './plans.js';
import { esc } from './util.js';

/**
 * Раз в день: напоминаем магазинам об окончании подписки
 * (за 3 дня, за 1 день и в день окончания).
 */
export async function dailyReminders(env) {
  const t = Date.now();
  const { results } = await env.DB.prepare(
    'SELECT id, name, plan, paid_until FROM shops WHERE active = 1 AND paid_until BETWEEN ? AND ?'
  )
    .bind(t - DAY, t + 3 * DAY)
    .all();

  for (const s of results) {
    const days = Math.ceil((s.paid_until - t) / DAY);
    let text;
    if (days === 3 || days === 1) {
      text = `⏰ Подписка «${esc(planOf(s.plan).name)}» заканчивается через ${days} ${days === 1 ? 'день' : 'дня'}.\nПродлите её в кабинете, во вкладке «Магазин» → «Тариф».`;
    } else if (days <= 0) {
      text = '⚠️ Подписка закончилась — новые приглашения создавать нельзя. Уже отправленные продолжают работать.\nПродлите в кабинете: «Магазин» → «Тариф».';
    }
    if (text) await notifyShop(env, s.id, text);
  }
}
