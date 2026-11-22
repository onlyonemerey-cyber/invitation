import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import BrandingForm from './BrandingForm.jsx';
import { errText, generatePassword, useCopy, fmtDateTime, fmtDate, fmtMoney, limitText, PLAN_BADGE } from './common.js';

const adminUrl = () => `${window.location.origin}${window.location.pathname}#/admin`;

/** Текст, который удобно переслать магазину после создания. */
const accessText = (login, password) =>
  `Доступ к кабинету приглашений 💌\n\nАдрес: ${adminUrl()}\nЛогин: ${login}\nПароль: ${password}\n\nПароль можно сменить во вкладке «Магазин».`;

function CreateShop({ onCreated }) {
  const [brand, setBrand] = useState({ name: '', color: '', logo: null, website: '', orderLink: '' });
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const shop = await api.createShop({ ...brand, login, password });
      onCreated(shop, password);
      setBrand({ name: '', color: '', logo: null, website: '', orderLink: '' });
      setLogin('');
      setPassword(generatePassword());
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm-card" onSubmit={submit}>
      <h2>Новый магазин</h2>
      <div className="adm-grid">
        <label className="adm-field">
          <span>Логин для входа *</span>
          <input className="input" value={login} onChange={(e) => setLogin(e.target.value.toLowerCase())} placeholder="roza" autoCapitalize="none" autoCorrect="off" spellCheck="false" maxLength={32} />
        </label>
        <label className="adm-field">
          <span>Пароль *</span>
          <div className="adm-inline">
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="adm-btn" onClick={() => setPassword(generatePassword())} title="Сгенерировать">🎲</button>
          </div>
          <small className={password.length < 8 ? 'adm-warn' : ''}>
            {password.length < 8 ? `Минимум 8 символов — сейчас ${password.length}` : 'Минимум 8 символов ✓'}
          </small>
        </label>
      </div>
      <BrandingForm value={brand} onChange={setBrand} />
      {error && <p className="adm-error">{error}</p>}
      <button className="btn btn-yes" style={{ marginTop: 16 }} disabled={busy || !brand.name.trim() || !login || password.length < 8}>
        {busy ? 'Создаю…' : 'Создать магазин'}
      </button>
    </form>
  );
}

function EditShop({ shop, onSaved, onCancel }) {
  const [brand, setBrand] = useState({
    name: shop.name,
    color: shop.color,
    logo: shop.logo,
    website: shop.website ? shop.website.replace(/^https:\/\//, '') : '',
    orderLink: shop.orderLink || '',
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.updateShop(shop.id, { ...brand, ...(password ? { password } : {}) });
      onSaved(password ? { login: shop.login, password } : null);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm-row-body" onSubmit={submit}>
      <BrandingForm value={brand} onChange={setBrand} />
      <label className="adm-field" style={{ marginTop: 14 }}>
        <span>Новый пароль (если нужно сбросить)</span>
        <div className="adm-inline">
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="оставь пустым, чтобы не менять" />
          <button type="button" className="adm-btn" onClick={() => setPassword(generatePassword())} title="Сгенерировать">🎲</button>
        </div>
        {password && password.length < 8 && <small className="adm-warn">Минимум 8 символов — сейчас {password.length}</small>}
      </label>
      {error && <p className="adm-error">{error}</p>}
      <div className="adm-actions" style={{ marginTop: 14 }}>
        <button className="btn btn-yes" disabled={busy || !brand.name?.trim() || (password && password.length < 8)}>
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button type="button" className="adm-btn" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

// ---------- оплата (вручную) ----------

const MONTHS = [
  [1, '1 месяц'],
  [3, '3 месяца'],
  [6, '6 месяцев'],
  [12, '12 месяцев'],
  [0, 'только сменить тариф'],
];

function ExtendForm({ shop, plans, onDone, onCancel }) {
  const paidPlans = plans.filter((p) => p.id !== 'trial');
  const [plan, setPlan] = useState(shop.plan !== 'trial' ? shop.plan : paidPlans[0]?.id || 'start');
  const [months, setMonths] = useState(1);
  const price = plans.find((p) => p.id === plan)?.price || 0;
  const [amount, setAmount] = useState(String(price));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // при смене тарифа/срока подставляем ожидаемую сумму
  useEffect(() => {
    setAmount(months ? String(price * months) : '');
  }, [plan, months, price]);

  const preview = (() => {
    if (!months) return shop.paidUntil;
    const base = new Date(Math.max(shop.paidUntil || 0, Date.now()));
    base.setUTCMonth(base.getUTCMonth() + months);
    return base.getTime();
  })();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.extendShop(shop.id, { plan, months, amount, note });
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm-row-body" onSubmit={submit}>
      <div className="adm-grid">
        <label className="adm-field">
          <span>Тариф</span>
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.price ? fmtMoney(p.price) + '/мес' : 'бесплатно'} · {limitText(p.limit)}</option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span>Продлить на</span>
          <select className="input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {MONTHS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          </select>
        </label>
        <label className="adm-field">
          <span>Получено, ₸</span>
          <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" />
        </label>
        <label className="adm-field">
          <span>Комментарий</span>
          <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Kaspi, перевод от 22.11" />
        </label>
      </div>
      <p className="adm-small adm-muted" style={{ marginBottom: 12 }}>
        Доступ будет до <b>{fmtDate(preview)}</b>{months > 0 && shop.paidUntil > Date.now() && ' (добавляется к текущему сроку)'}.
      </p>
      {error && <p className="adm-error">{error}</p>}
      <div className="adm-actions">
        <button className="btn btn-yes" disabled={busy}>{busy ? 'Сохраняю…' : months ? 'Отметить оплату' : 'Сменить тариф'}</button>
        <button type="button" className="adm-btn" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function Payments({ reloadKey }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.payments().then(setData).catch(() => {});
  }, [reloadKey]);
  if (!data) return null;
  return (
    <section className="adm-card">
      <h2>💰 Оплаты</h2>
      <div className="st-tiles" style={{ marginBottom: 14 }}>
        <div className="st-tile"><span className="st-label">В этом месяце</span><b className="st-value">{fmtMoney(data.totals.month)}</b></div>
        <div className="st-tile"><span className="st-label">Всего</span><b className="st-value">{fmtMoney(data.totals.total)}</b></div>
      </div>
      {data.payments.length === 0 ? (
        <p className="adm-muted adm-small">Оплат пока нет. Отметь оплату кнопкой «💳 Оплата» у магазина.</p>
      ) : (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr><th>Дата</th><th>Магазин</th><th>Тариф</th><th>Срок</th><th>Сумма</th></tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDateTime(p.createdAt)}</td>
                  <td>{p.shopName || '—'}{p.note && <div className="adm-small adm-muted">{p.note}</div>}</td>
                  <td>{p.planName}</td>
                  <td>{p.months ? `${p.months} мес.` : '—'}</td>
                  <td>{fmtMoney(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ServiceSettings({ onLoaded }) {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    api.settings().then((s) => {
      setForm({ paymentInstructions: s.paymentInstructions, contact: s.contact.replace(/^https:\/\//, '') });
      onLoaded(s.plans);
    });
  }, [onLoaded]);
  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.saveSettings(form);
      setMsg({ ok: true, text: '✓ Сохранено' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <form className="adm-card" onSubmit={save}>
      <h2>⚙️ Оплата сервиса</h2>
      <p className="adm-small adm-muted" style={{ marginBottom: 12 }}>Это видят магазины во вкладке «Магазин» → «Тариф».</p>
      <div className="adm-grid">
        <label className="adm-field adm-wide">
          <span>Как оплатить (реквизиты)</span>
          <textarea className="input" rows={3} maxLength={1000} value={form.paymentInstructions} onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })} placeholder="Kaspi Gold: +7 701 000 00 00 (Имя Ф.). В комментарии укажите логин магазина." />
        </label>
        <label className="adm-field adm-wide">
          <span>Контакт для связи</span>
          <input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="t.me/username или wa.me/77010000000" autoCapitalize="none" />
        </label>
      </div>
      {msg && <p className={msg.ok ? 'adm-ok' : 'adm-error'}>{msg.text}</p>}
      <button className="btn btn-yes">Сохранить</button>
    </form>
  );
}

function BillingLine({ s }) {
  const b = s.billing;
  if (!b) return null;
  const st = b.expired ? 'warn' : b.daysLeft <= 3 ? 'warn' : PLAN_BADGE[b.plan] ?? '';
  return (
    <div className="adm-badges" style={{ marginTop: 6 }}>
      <span className={'adm-badge ' + st}>
        {b.planName} · {b.expired ? 'истёк' : `до ${fmtDate(b.paidUntil)}`}
      </span>
      <span className={'adm-badge' + (b.limitReached ? ' warn' : '')}>
        {b.used}{b.limit != null ? `/${b.limit}` : ''} в этом мес.
      </span>
      <span className={'adm-badge' + (s.chats ? ' ok' : '')}>{s.chats ? `🔔 ${s.chats}` : '🔕 без уведомлений'}</span>
      {!s.orderLink && <span className="adm-badge">нет ссылки для заказа</span>}
    </div>
  );
}

export default function ShopsTab({ shops, onChange }) {
  const [open, setOpen] = useState(null); // {id, mode: 'edit' | 'pay'}
  const [access, setAccess] = useState(null);
  const [plans, setPlans] = useState([]);
  const [paymentsKey, setPaymentsKey] = useState(0);
  const [error, setError] = useState('');
  const [copied, copy] = useCopy();

  const toggle = (id, mode) => setOpen(open?.id === id && open.mode === mode ? null : { id, mode });

  const toggleActive = async (s) => {
    if (s.active && !window.confirm(`Отключить «${s.name}»? Магазин не сможет войти. Уже созданные приглашения продолжат работать.`)) return;
    try {
      await api.updateShop(s.id, { active: !s.active });
      onChange();
    } catch (err) {
      setError(errText(err));
    }
  };

  // сначала истёкшие и скоро истекающие — их надо продлить
  const sorted = [...shops].sort((a, b) => (a.billing?.paidUntil ?? 0) - (b.billing?.paidUntil ?? 0));

  return (
    <>
      {access && (
        <div className="adm-card adm-created">
          <h2>🔑 Доступ для магазина</h2>
          <pre className="adm-pre">{accessText(access.login, access.password)}</pre>
          <div className="adm-actions">
            <button type="button" className="adm-btn" onClick={() => copy(accessText(access.login, access.password), 'acc')}>
              {copied === 'acc' ? '✓ Скопировано' : 'Копировать'}
            </button>
            <a className="adm-btn wa" href={`https://wa.me/?text=${encodeURIComponent(accessText(access.login, access.password))}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <button type="button" className="adm-btn" onClick={() => setAccess(null)}>Скрыть</button>
          </div>
          <p className="adm-small adm-muted" style={{ marginTop: 10 }}>Пароль показывается только сейчас — сохрани или отправь его магазину.</p>
        </div>
      )}

      <section className="adm-card">
        <h2>Магазины <span className="adm-muted">({shops.length})</span></h2>
        {error && <p className="adm-error">{error}</p>}
        {shops.length === 0 ? (
          <p className="adm-muted">Пока нет ни одного магазина — создай первый ниже.</p>
        ) : (
          <ul className="adm-list">
            {sorted.map((s) => (
              <li key={s.id} className={'adm-row' + (open?.id === s.id ? ' open' : '') + (s.active ? '' : ' off')}>
                <div className="adm-row-head as-div">
                  <div className="adm-shop">
                    <span className="adm-shop-logo" style={{ borderColor: s.color || undefined }}>
                      {s.logo ? <img src={s.logo} alt="" /> : '💐'}
                    </span>
                    <div className="adm-row-main">
                      <b>{s.name}</b>
                      <div className="adm-muted adm-small">
                        логин: {s.login} · {s.invites ?? 0} приглаш. · {s.answered ?? 0} ответов
                      </div>
                      <BillingLine s={s} />
                    </div>
                  </div>
                  <div className="adm-actions">
                    {!s.active && <span className="adm-badge">Отключён</span>}
                    <button type="button" className="adm-btn accent" onClick={() => toggle(s.id, 'pay')}>💳 Оплата</button>
                    <button type="button" className="adm-btn" onClick={() => toggle(s.id, 'edit')}>
                      {open?.id === s.id && open.mode === 'edit' ? 'Свернуть' : 'Изменить'}
                    </button>
                    <button type="button" className={'adm-btn' + (s.active ? ' danger-soft' : '')} onClick={() => toggleActive(s)}>
                      {s.active ? 'Отключить' : 'Включить'}
                    </button>
                  </div>
                </div>
                {open?.id === s.id && open.mode === 'pay' && (
                  <ExtendForm
                    shop={s}
                    plans={plans}
                    onCancel={() => setOpen(null)}
                    onDone={() => {
                      setOpen(null);
                      setPaymentsKey((k) => k + 1);
                      onChange();
                    }}
                  />
                )}
                {open?.id === s.id && open.mode === 'edit' && (
                  <EditShop
                    shop={s}
                    onCancel={() => setOpen(null)}
                    onSaved={(acc) => {
                      setOpen(null);
                      if (acc) {
                        setAccess(acc);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                      onChange();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateShop
        onCreated={(shop, password) => {
          setAccess({ login: shop.login, password });
          onChange();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <Payments reloadKey={paymentsKey} />
      <ServiceSettings onLoaded={setPlans} />
    </>
  );
}
