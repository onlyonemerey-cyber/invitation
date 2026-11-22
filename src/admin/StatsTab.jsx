import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { errText } from './common.js';

const PERIODS = [
  [7, '7 дней'],
  [30, '30 дней'],
  [90, '90 дней'],
  [0, 'Всё время'],
];

const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
const dayLabel = (iso, opts = { day: 'numeric', month: 'short' }) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', opts);
};

function Tile({ label, value, sub }) {
  return (
    <div className="st-tile">
      <span className="st-label">{label}</span>
      <b className="st-value">{value}</b>
      {sub && <span className="st-sub">{sub}</span>}
    </div>
  );
}

/** Столбики «приглашений в день»: один ряд, один цвет, подсказка при наведении. */
function DailyChart({ daily }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 180, L = 28, B = 22, T = 10;
  const n = daily.length;
  const max = Math.max(1, ...daily.map((d) => d.created));
  // «красивый» верх шкалы
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const plotW = W - L, plotH = H - B - T;
  const step = plotW / n;
  const gap = n > 60 ? 1 : 2;
  const bw = Math.max(1, step - gap);
  const y = (v) => T + plotH - (v / top) * plotH;
  const ticks = top <= 4 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, top / 4, top / 2, (top * 3) / 4, top];

  const bar = (x, h) => {
    if (h <= 0) return '';
    const r = Math.min(4, bw / 2, h);
    const yb = T + plotH, yt = yb - h;
    return `M${x} ${yb}V${yt + r}Q${x} ${yt} ${x + r} ${yt}H${x + bw - r}Q${x + bw} ${yt} ${x + bw} ${yt + r}V${yb}Z`;
  };

  const labelIdx = n <= 7 ? daily.map((_, i) => i) : [0, Math.floor(n / 2), n - 1];
  const h = hover != null ? daily[hover] : null;

  return (
    <div className="st-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Приглашений в день">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} className="st-grid" />
            <text x={L - 6} y={y(t) + 4} className="st-axis" textAnchor="end">{t}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const x = L + i * step + gap / 2;
          return (
            <g key={d.day}>
              <path d={bar(x, (d.created / top) * plotH)} className={'st-bar' + (hover === i ? ' on' : '')} />
              {/* зона наведения шире столбика */}
              <rect
                x={L + i * step}
                y={T}
                width={step}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={L + i * step + step / 2}
            y={H - 6}
            className="st-axis"
            textAnchor={i === 0 && n > 7 ? 'start' : i === n - 1 && n > 7 ? 'end' : 'middle'}
          >
            {dayLabel(daily[i].day)}
          </text>
        ))}
      </svg>
      {h && (
        <div className="st-tip" style={{ left: `${((L + hover * step + step / 2) / W) * 100}%` }}>
          <b>{dayLabel(h.day, { weekday: 'short', day: 'numeric', month: 'long' })}</b>
          <span>Создано: {h.created}</span>
          <span>Ответили: {h.answered}</span>
        </div>
      )}
    </div>
  );
}

function Places({ places }) {
  const max = Math.max(1, ...places.map((p) => p.count));
  return (
    <ul className="st-places">
      {places.map((p) => (
        <li key={p.place}>
          <span className="st-place-name">{p.place}</span>
          <span className="st-place-bar">
            <span style={{ width: `${(p.count / max) * 100}%` }} />
          </span>
          <b>{p.count}</b>
        </li>
      ))}
    </ul>
  );
}

export default function StatsTab({ me, shops }) {
  const [days, setDays] = useState(30);
  const [shop, setShop] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api
      .stats(days, shop)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && e.status !== 401 && setError(errText(e)));
    return () => {
      cancelled = true;
    };
  }, [days, shop]);

  const t = data?.totals;

  return (
    <>
      <div className="adm-card st-controls">
        <div className="adm-seg" role="radiogroup" aria-label="Период">
          {PERIODS.map(([d, label]) => (
            <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
              {label}
            </button>
          ))}
        </div>
        {me.role === 'super' && (
          <select className="input" value={shop} onChange={(e) => setShop(e.target.value)}>
            <option value="">Все магазины</option>
            <option value="none">Без магазина</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="adm-error">{error}</p>}
      {!data ? (
        <p className="adm-muted">Загрузка…</p>
      ) : (
        <>
          <div className="st-tiles">
            <Tile label="Создано" value={t.created} />
            <Tile label="Открыли" value={t.opened} sub={`${pct(t.opened, t.created)} от созданных`} />
            <Tile label="Ответили «Да»" value={t.answered} sub={`${pct(t.answered, t.opened)} от открывших`} />
            <Tile label="Доставлено" value={t.delivered} sub={`${pct(t.delivered, t.answered)} ответов`} />
            <Tile label="Покупатели в боте" value={t.connected} sub={`${pct(t.connected, t.created)} от созданных`} />
            <Tile label="Перешли к заказу 💐" value={t.ordered} sub={`${pct(t.ordered, t.answered)} ответивших`} />
            <Tile label="Попыток «Нет»" value={t.avg_escapes ?? '—'} sub="в среднем 😄" />
          </div>

          <section className="adm-card">
            <h2>Приглашений в день</h2>
            {data.daily.some((d) => d.created) ? (
              <DailyChart daily={data.daily} />
            ) : (
              <p className="adm-muted">За этот период приглашений нет.</p>
            )}
            {!days && <p className="adm-small adm-muted">График — за последние 90 дней.</p>}
          </section>

          <section className="adm-card">
            <h2>Куда хотят пойти</h2>
            {data.places.length ? <Places places={data.places} /> : <p className="adm-muted">Пока нет ответов.</p>}
          </section>

          {data.shops && (
            <section className="adm-card">
              <h2>Магазины</h2>
              {data.shops.length === 0 ? (
                <p className="adm-muted">Магазинов пока нет.</p>
              ) : (
                <div className="st-table-wrap">
                  <table className="st-table">
                    <thead>
                      <tr><th>Магазин</th><th>Создано</th><th>Ответили</th><th>Доставлено</th><th>К заказу</th><th>Конверсия</th></tr>
                    </thead>
                    <tbody>
                      {data.shops.map((s) => (
                        <tr key={s.id} className={s.active ? '' : 'off'}>
                          <td>{s.name}{!s.active && ' (откл.)'}</td>
                          <td>{s.created}</td>
                          <td>{s.answered}</td>
                          <td>{s.delivered}</td>
                          <td>{s.ordered}</td>
                          <td>{pct(s.answered, s.created)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
