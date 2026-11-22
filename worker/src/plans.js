/**
 * Тарифы. Цены и лимиты — ЧЕРНОВЫЕ, поменяй под себя.
 * limit — сколько приглашений можно создать за календарный месяц (null = без ограничений).
 */
export const PLANS = {
  trial: { id: 'trial', name: 'Пробный', price: 0, limit: 10, note: '14 дней бесплатно' },
  start: { id: 'start', name: 'Старт', price: 4990, limit: 30 },
  business: { id: 'business', name: 'Бизнес', price: 9990, limit: 150 },
  unlimited: { id: 'unlimited', name: 'Безлимит', price: 19990, limit: null },
};

export const TRIAL_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;
const TZ_OFFSET = 5 * 60 * 60 * 1000; // Казахстан, UTC+5

export const planOf = (id) => PLANS[id] || PLANS.trial;

/** Начало текущего календарного месяца по времени Казахстана (мс UTC). */
export function monthStart(t = Date.now()) {
  const local = new Date(t + TZ_OFFSET);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_OFFSET;
}

/** Добавляет месяцы к дате окончания: от сегодня, если подписка уже кончилась. */
export function extendUntil(paidUntil, months, t = Date.now()) {
  const base = new Date(Math.max(paidUntil || 0, t));
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.getTime();
}

export async function usedThisMonth(env, shopId) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE shop_id = ? AND created_at >= ?')
    .bind(shopId, monthStart())
    .first();
  return r?.n ?? 0;
}

/** Состояние подписки магазина. */
export function billingState(shop, used, t = Date.now()) {
  const plan = planOf(shop.plan);
  const expired = !shop.paid_until || shop.paid_until <= t;
  const daysLeft = shop.paid_until ? Math.ceil((shop.paid_until - t) / DAY) : 0;
  const limitReached = plan.limit != null && used >= plan.limit;
  return {
    plan: plan.id,
    planName: plan.name,
    limit: plan.limit,
    used,
    paidUntil: shop.paid_until,
    daysLeft: Math.max(0, daysLeft),
    expired,
    limitReached,
    canCreate: !expired && !limitReached,
  };
}

export { DAY };
