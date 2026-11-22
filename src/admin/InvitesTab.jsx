import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatRu } from '../lib/dates.js';
import { errText, fmtDateTime, girlLink, useCopy } from './common.js';
import Qr, { downloadQrPng } from './Qr.jsx';
import PrintCard from './PrintCard.jsx';

// ---------- создание ----------

function CreateForm({ me, shops, onCreated }) {
  const empty = { buyerUsername: '', toName: '', fromName: '', question: '', shopId: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const inv = await api.createInvite(form);
      setForm({ ...empty, shopId: form.shopId });
      onCreated(inv);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm-card" onSubmit={submit}>
      <h2>Новое приглашение</h2>
      <div className="adm-grid">
        {me.role === 'super' && (
          <label className="adm-field adm-wide">
            <span>Магазин</span>
            <select className="input" value={form.shopId} onChange={set('shopId')}>
              <option value="">— без магазина —</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="adm-field adm-wide">
          <span>Telegram покупателя</span>
          <input className="input" placeholder="@username" value={form.buyerUsername} onChange={set('buyerUsername')} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
          <small>Ответ придёт только этому аккаунту. Можно оставить пустым — тогда тому, кто первым откроет ссылку покупателя.</small>
        </label>
        <label className="adm-field">
          <span>Имя девушки *</span>
          <input className="input" placeholder="Аружан" value={form.toName} onChange={set('toName')} maxLength={40} required />
        </label>
        <label className="adm-field">
          <span>От кого</span>
          <input className="input" placeholder="Мерей" value={form.fromName} onChange={set('fromName')} maxLength={40} />
        </label>
        <label className="adm-field adm-wide">
          <span>Свой вопрос</span>
          <input className="input" placeholder="По умолчанию: «Аружан, сходишь со мной на свидание?»" value={form.question} onChange={set('question')} maxLength={120} />
        </label>
      </div>
      {error && <p className="adm-error">{error}</p>}
      <button className="btn btn-yes" disabled={busy || !form.toName.trim()}>
        {busy ? 'Создаю…' : 'Создать приглашение'}
      </button>
    </form>
  );
}

// ---------- ссылки + QR ----------

function LinkBox({ label, hint, url, qrName, copyKey, copied, copy, children }) {
  const [showQr, setShowQr] = useState(false);
  return (
    <div className="adm-link">
      <span className="adm-link-label">{label}</span>
      {hint && <span className="adm-small adm-muted">{hint}</span>}
      <code>{url}</code>
      <div className="adm-actions">
        <button type="button" className="adm-btn" onClick={() => copy(url, copyKey)}>
          {copied === copyKey ? '✓ Скопировано' : 'Копировать'}
        </button>
        <button type="button" className="adm-btn" onClick={() => setShowQr((v) => !v)}>
          {showQr ? 'Скрыть QR' : 'QR-код'}
        </button>
        {children}
      </div>
      {showQr && (
        <div className="adm-qr">
          <Qr text={url} size={220} />
          <button type="button" className="adm-btn" onClick={() => downloadQrPng(url, qrName)}>
            Скачать PNG
          </button>
        </div>
      )}
    </div>
  );
}

function Links({ inv, copied, copy, onPrint }) {
  const girl = girlLink(inv.id);
  const buyerMsg =
    `Здравствуйте! Нажмите на ссылку и «Start» в Telegram — туда придёт ответ ${inv.toName} 💌\n${inv.buyerLink}\n\n` +
    `Ссылка-приглашение для неё:\n${girl}`;

  return (
    <div className="adm-links">
      <LinkBox
        label="🤵 Для покупателя — получать ответ"
        hint="Покажи QR на кассе или отправь ссылку: он нажмёт «Start» в Telegram."
        url={inv.buyerLink}
        qrName={`buyer-${inv.id}.png`}
        copyKey={inv.id + 'b'}
        copied={copied}
        copy={copy}
      >
        <a className="adm-btn wa" href={`https://wa.me/?text=${encodeURIComponent(buyerMsg)}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="adm-btn tg" href={`https://t.me/share/url?url=${encodeURIComponent(inv.buyerLink)}&text=${encodeURIComponent(`Нажмите «Start» — сюда придёт ответ ${inv.toName} 💌`)}`} target="_blank" rel="noreferrer">Telegram</a>
      </LinkBox>
      <LinkBox
        label="💗 Для девушки"
        hint="Напечатай открытку с QR к букету или отправь ссылку."
        url={girl}
        qrName={`invite-${inv.id}.png`}
        copyKey={inv.id + 'g'}
        copied={copied}
        copy={copy}
      >
        <a className="adm-btn" href={girl} target="_blank" rel="noreferrer">Открыть</a>
        <button type="button" className="adm-btn accent" onClick={() => onPrint(inv)}>🖨 Открытка</button>
      </LinkBox>
    </div>
  );
}

// ---------- список ----------

function statusOf(inv) {
  if (inv.answer && inv.deliveredAt) return { cls: 'ok', text: '💞 Ответ доставлен' };
  if (inv.answer) return { cls: 'warn', text: '💌 Ответила — покупатель не нажал Start' };
  if (inv.openedAt) return { cls: 'info', text: '👀 Открыла' };
  return { cls: '', text: '⏳ Не открыта' };
}

function InviteRow({ inv, showShop, open, onToggle, onDelete, onPrint, copied, copy }) {
  const st = statusOf(inv);
  return (
    <li className={'adm-row' + (open ? ' open' : '')}>
      <button type="button" className="adm-row-head" onClick={onToggle} aria-expanded={open}>
        <div className="adm-row-main">
          <b>{inv.toName}</b>
          {inv.fromName && <span className="adm-muted"> от {inv.fromName}</span>}
          <div className="adm-muted adm-small">
            {showShop && <>{inv.shopName || 'без магазина'} · </>}
            {inv.buyerUsername ? '@' + inv.buyerUsername : 'без username'} · {fmtDateTime(inv.createdAt)}
          </div>
        </div>
        <div className="adm-badges">
          <span className={'adm-badge ' + (inv.buyerConnected ? 'ok' : '')}>
            {inv.buyerConnected ? '✓ Покупатель в боте' : 'Покупатель не в боте'}
          </span>
          <span className={'adm-badge ' + st.cls}>{st.text}</span>
        </div>
      </button>

      {open && (
        <div className="adm-row-body">
          {inv.answer && (
            <div className="adm-answer">
              📍 {inv.answer.place} · 📅 {formatRu(inv.answer.date)} · ⏰ {inv.answer.time}
              <span className="adm-muted"> · «Нет» пыталась нажать {inv.answer.escapes} раз</span>
            </div>
          )}
          <Links inv={inv} copied={copied} copy={copy} onPrint={onPrint} />
          <button type="button" className="adm-btn danger" onClick={() => onDelete(inv)}>Удалить</button>
        </div>
      )}
    </li>
  );
}

const FILTERS = [
  ['all', 'Все'],
  ['waiting', 'Ждут ответа'],
  ['answered', 'Ответили'],
  ['undelivered', 'Не доставлено'],
];
const matches = (inv, f) =>
  f === 'all' ||
  (f === 'waiting' && !inv.answer) ||
  (f === 'answered' && inv.answer) ||
  (f === 'undelivered' && inv.answer && !inv.deliveredAt);

export default function InvitesTab({ me, shops, shopsById }) {
  const [invites, setInvites] = useState([]);
  const [shopFilter, setShopFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [created, setCreated] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, copy] = useCopy();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInvites(await api.invites(shopFilter));
      setError('');
    } catch (e) {
      if (e.status !== 401) setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [shopFilter]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000); // статусы обновляются сами
    return () => clearInterval(id);
  }, [load]);

  const onCreated = (inv) => {
    setCreated(inv);
    setInvites((list) => [inv, ...list]);
    setTimeout(() => document.getElementById('created')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const onDelete = async (inv) => {
    if (!window.confirm(`Удалить приглашение для ${inv.toName}? Ссылки перестанут работать.`)) return;
    try {
      await api.deleteInvite(inv.id);
      setInvites((list) => list.filter((x) => x.id !== inv.id));
      if (created?.id === inv.id) setCreated(null);
    } catch (e) {
      setError(errText(e));
    }
  };

  // брендинг для открытки: свой магазин или магазин приглашения (для супер-админа)
  const shopFor = (inv) => (me.role === 'shop' ? me.shop : shopsById[inv.shopId] || null);

  const q = search.trim().toLowerCase();
  const visible = invites.filter(
    (inv) =>
      matches(inv, statusFilter) &&
      (!q || [inv.toName, inv.fromName, inv.buyerUsername].some((v) => v && v.toLowerCase().includes(q)))
  );

  return (
    <>
      <CreateForm me={me} shops={shops} onCreated={onCreated} />

      {created && (
        <div className="adm-card adm-created" id="created">
          <h2>✅ Приглашение для {created.toName} готово</h2>
          <ol className="adm-steps">
            <li><b>Покупателю</b>: покажи QR на кассе или отправь ссылку — он нажмёт «Start» в Telegram, и ответ придёт ему.</li>
            <li><b>Для девушки</b>: напечатай открытку с QR и вложи в букет — или покупатель отправит ей ссылку сам.</li>
          </ol>
          <Links inv={created} copied={copied} copy={copy} onPrint={setPrinting} />
        </div>
      )}

      <section className="adm-card">
        <div className="adm-list-head">
          <h2>Приглашения <span className="adm-muted">({visible.length})</span></h2>
          <button type="button" className="adm-btn" onClick={load} disabled={loading}>
            {loading ? '…' : '↻ Обновить'}
          </button>
        </div>

        <div className="adm-filters">
          <input className="input adm-search" type="search" placeholder="Поиск: имя или @username" value={search} onChange={(e) => setSearch(e.target.value)} />
          {me.role === 'super' && (
            <select className="input" value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
              <option value="">Все магазины</option>
              <option value="none">Без магазина</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <div className="adm-seg" role="radiogroup">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={statusFilter === id} className={statusFilter === id ? 'on' : ''} onClick={() => setStatusFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="adm-error">{error}</p>}
        {visible.length === 0 ? (
          <p className="adm-muted adm-empty">{invites.length ? 'Ничего не найдено.' : 'Пока пусто — создай первое приглашение выше.'}</p>
        ) : (
          <ul className="adm-list">
            {visible.map((inv) => (
              <InviteRow
                key={inv.id}
                inv={inv}
                showShop={me.role === 'super'}
                open={openId === inv.id}
                onToggle={() => setOpenId(openId === inv.id ? null : inv.id)}
                onDelete={onDelete}
                onPrint={setPrinting}
                copied={copied}
                copy={copy}
              />
            ))}
          </ul>
        )}
      </section>

      {printing && <PrintCard inv={printing} shop={shopFor(printing)} onClose={() => setPrinting(null)} />}
    </>
  );
}
