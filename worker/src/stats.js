import { json } from './util.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * GET /api/admin/stats?days=30&tz=-300[&shop=<id>|none]
 * tz — смещение часового пояса браузера в минутах (Date#getTimezoneOffset), чтобы дни
 * считались по местному времени.
 */
export async function getStats(env, auth, url) {
  const daysParam = parseInt(url.searchParams.get('days') || '30', 10);
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 0; // 0 = за всё время
  const tz = Math.max(-840, Math.min(840, parseInt(url.searchParams.get('tz') || '0', 10) || 0));

  // фильтр по магазину (отдельно — он нужен и для графика по дням)
  const shopConds = [];
  const shopArgs = [];
  if (auth.role === 'shop') {
    shopConds.push('shop_id = ?');
    shopArgs.push(auth.shopId);
  } else {
    const f = url.searchParams.get('shop');
    if (f === 'none') shopConds.push('shop_id IS NULL');
    else if (f) {
      shopConds.push('shop_id = ?');
      shopArgs.push(f);
    }
  }

  const conds = [...shopConds];
  const args = [...shopArgs];
  if (days) {
    conds.push('created_at >= ?');
    args.push(Date.now() - days * DAY);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS created,
       COALESCE(SUM(opened_at IS NOT NULL), 0) AS opened,
       COALESCE(SUM(buyer_chat_id IS NOT NULL), 0) AS connected,
       COALESCE(SUM(answer IS NOT NULL), 0) AS answered,
       COALESCE(SUM(delivered_at IS NOT NULL), 0) AS delivered,
       COALESCE(SUM(order_clicks > 0), 0) AS ordered,
       AVG(json_extract(answer, '$.escapes')) AS avg_escapes
     FROM invites ${where}`
  )
    .bind(...args)
    .first();

  const { results: places } = await env.DB.prepare(
    `SELECT json_extract(answer, '$.place') AS place, COUNT(*) AS count
     FROM invites ${where ? where + ' AND' : 'WHERE'} answer IS NOT NULL
     GROUP BY place ORDER BY count DESC LIMIT 8`
  )
    .bind(...args)
    .all();

  // по дням: за выбранный период, для «всё время» — последние 90 дней
  const span = days || 90;
  const since = Date.now() - span * DAY;
  const dayExpr = `date((created_at - ?) / 1000, 'unixepoch')`;
  const { results: dailyRows } = await env.DB.prepare(
    `SELECT ${dayExpr} AS day, COUNT(*) AS created, COALESCE(SUM(answer IS NOT NULL), 0) AS answered
     FROM invites WHERE ${[...shopConds, 'created_at >= ?'].join(' AND ')}
     GROUP BY day ORDER BY day`
  )
    .bind(tz * 60000, ...shopArgs, since)
    .all();

  // заполняем пустые дни нулями
  const byDay = Object.fromEntries(dailyRows.map((r) => [r.day, r]));
  const daily = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY - tz * 60000).toISOString().slice(0, 10);
    daily.push({ day: d, created: byDay[d]?.created ?? 0, answered: byDay[d]?.answered ?? 0 });
  }

  let shops;
  if (auth.role === 'super') {
    const shopConds = days ? 'AND i.created_at >= ?' : '';
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.name, s.active,
         COUNT(i.id) AS created,
         COALESCE(SUM(i.answer IS NOT NULL), 0) AS answered,
         COALESCE(SUM(i.delivered_at IS NOT NULL), 0) AS delivered,
         COALESCE(SUM(i.order_clicks > 0), 0) AS ordered
       FROM shops s LEFT JOIN invites i ON i.shop_id = s.id ${shopConds}
       GROUP BY s.id ORDER BY created DESC`
    )
      .bind(...(days ? [Date.now() - days * DAY] : []))
      .all();
    shops = results;
  }

  return json({
    days,
    totals: { ...totals, avg_escapes: totals.avg_escapes == null ? null : Math.round(totals.avg_escapes * 10) / 10 },
    places,
    daily,
    shops,
  });
}
