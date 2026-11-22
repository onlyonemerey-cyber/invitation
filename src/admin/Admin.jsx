import { useCallback, useEffect, useState } from 'react';
import { admin, apiConfigured } from '../lib/api.js';
import { formatRu } from '../lib/dates.js';
import './admin.css';

const TOKEN_KEY = 'invite-admin-token';
const store = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } },
  set: (v) => { try { localStorage.setItem(TOKEN_KEY, v); } catch {} },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
};

const ERRORS = {
  to_name_required: 'Укажи имя девушки',
  bad_username: 'Неверный username: 4–32 символа, латиница, цифры и _',
  unauthorized: 'Неверный пароль',
};
const errText = (e) => ERRORS[e?.message] || 'Что-то пошло не так. Проверь интернет и попробуй ещё раз.';

/** Ссылка для девушки строится от адреса, где открыта админка (работает и локально, и на сайте). */
const girlLink = (id) => `${window.location.origin}${window.location.pathname}?i=${id}`;

function useCopy() {
  const [copied, setCopied] = useState('');
  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };
  return [copied, copy];
}

// ---------- вход ----------

function Login({ onLogin }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await admin.check(pwd);
      store.set(pwd);
      onLogin(pwd);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm adm-center">
      <form className="adm-card adm-login" onSubmit={submit}>
        <div className="adm-logo">💌</div>
        <h1>Админка приглашений</h1>
        {!apiConfigured && <p className="adm-error">Не указан адрес сервера (VITE_API_URL).</p>}
        <input
          className="input"
          type="password"
          placeholder="Пароль"
          autoComplete="current-password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          autoFocus
        />
        {error && <p className="adm-error">{error}</p>}
        <button className="btn btn-yes wide" disabled={!pwd || busy}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

// ---------- создание ----------

function CreateForm({ token, onCreated }) {
  const empty = { buyerUsername: '', toName: '', fromName: '', question: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const inv = await admin.create(token, form);
      setForm(empty);
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
        <label className="adm-field">
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
        <label className="adm-field">
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

// ---------- ссылки ----------

function Links({ inv, copied, copy }) {
  const girl = girlLink(inv.id);
  const buyerMsg =
    `Здравствуйте! Нажмите на ссылку и «Start» в Telegram — туда придёт ответ ${inv.toName} 💌\n${inv.buyerLink}\n\n` +
    `Ссылка-приглашение для неё:\n${girl}`;

  return (
    <div className="adm-links">
      <div className="adm-link">
        <span className="adm-link-label">💗 Для девушки</span>
        <code>{girl}</code>
        <div className="adm-actions">
          <button type="button" className="adm-btn" onClick={() => copy(girl, inv.id + 'g')}>
            {copied === inv.id + 'g' ? '✓ Скопировано' : 'Копировать'}
          </button>
          <a className="adm-btn" href={girl} target="_blank" rel="noreferrer">Открыть</a>
        </div>
      </div>
      <div className="adm-link">
        <span className="adm-link-label">🤵 Для покупателя (получать ответ)</span>
        <code>{inv.buyerLink}</code>
        <div className="adm-actions">
          <button type="button" className="adm-btn" onClick={() => copy(inv.buyerLink, inv.id + 'b')}>
            {copied === inv.id + 'b' ? '✓ Скопировано' : 'Копировать'}
          </button>
          <a className="adm-btn wa" href={`https://wa.me/?text=${encodeURIComponent(buyerMsg)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="adm-btn tg" href={`https://t.me/share/url?url=${encodeURIComponent(inv.buyerLink)}&text=${encodeURIComponent(`Нажмите «Start» — сюда придёт ответ ${inv.toName} 💌`)}`} target="_blank" rel="noreferrer">Telegram</a>
        </div>
      </div>
    </div>
  );
}

// ---------- список ----------

function statusOf(inv) {
  if (inv.answer && inv.deliveredAt) return { cls: 'ok', text: '💞 Ответ доставлен' };
  if (inv.answer) return { cls: 'warn', text: '💌 Ответила — покупатель ещё не нажал Start' };
  if (inv.openedAt) return { cls: 'info', text: '👀 Открыла, ещё не ответила' };
  return { cls: '', text: '⏳ Ещё не открыла' };
}

const fmtTime = (ms) =>
  new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function InviteRow({ inv, open, onToggle, onDelete, copied, copy }) {
  const st = statusOf(inv);
  return (
    <li className={'adm-row' + (open ? ' open' : '')}>
      <button type="button" className="adm-row-head" onClick={onToggle}>
        <div className="adm-row-main">
          <b>{inv.toName}</b>
          {inv.fromName && <span className="adm-muted"> от {inv.fromName}</span>}
          <div className="adm-muted adm-small">
            {inv.buyerUsername ? '@' + inv.buyerUsername : 'без username'} · {fmtTime(inv.createdAt)}
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
          <Links inv={inv} copied={copied} copy={copy} />
          <button type="button" className="adm-btn danger" onClick={() => onDelete(inv)}>Удалить</button>
        </div>
      )}
    </li>
  );
}

// ---------- страница ----------

export default function Admin() {
  const [token, setToken] = useState(store.get);
  const [invites, setInvites] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, copy] = useCopy();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setInvites(await admin.list(token));
      setError('');
    } catch (e) {
      if (e.status === 401) {
        store.clear();
        setToken('');
      } else setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000); // статусы обновляются сами
    return () => clearInterval(id);
  }, [load]);

  if (!token) return <Login onLogin={setToken} />;

  const onCreated = (inv) => {
    setCreated(inv);
    setInvites((list) => [inv, ...list]);
    setTimeout(() => document.getElementById('created')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const onDelete = async (inv) => {
    if (!window.confirm(`Удалить приглашение для ${inv.toName}? Ссылки перестанут работать.`)) return;
    try {
      await admin.remove(token, inv.id);
      setInvites((list) => list.filter((x) => x.id !== inv.id));
      if (created?.id === inv.id) setCreated(null);
    } catch (e) {
      setError(errText(e));
    }
  };

  return (
    <div className="adm">
      <header className="adm-header">
        <h1>💌 Приглашения</h1>
        <button
          type="button"
          className="adm-btn"
          onClick={() => {
            store.clear();
            setToken('');
          }}
        >
          Выйти
        </button>
      </header>

      <CreateForm token={token} onCreated={onCreated} />

      {created && (
        <div className="adm-card adm-created" id="created">
          <h2>✅ Приглашение для {created.toName} готово</h2>
          <ol className="adm-steps">
            <li>Отправь <b>покупателю</b> его ссылку — он нажмёт «Start» в боте, и ответ придёт ему.</li>
            <li>Ссылку <b>для девушки</b> покупатель отправляет ей сам (или её можно напечатать на открытке).</li>
          </ol>
          <Links inv={created} copied={copied} copy={copy} />
        </div>
      )}

      <section className="adm-card">
        <div className="adm-list-head">
          <h2>Все приглашения <span className="adm-muted">({invites.length})</span></h2>
          <button type="button" className="adm-btn" onClick={load} disabled={loading}>
            {loading ? '…' : '↻ Обновить'}
          </button>
        </div>
        {error && <p className="adm-error">{error}</p>}
        {invites.length === 0 ? (
          <p className="adm-muted">Пока пусто — создай первое приглашение выше.</p>
        ) : (
          <ul className="adm-list">
            {invites.map((inv) => (
              <InviteRow
                key={inv.id}
                inv={inv}
                open={openId === inv.id}
                onToggle={() => setOpenId(openId === inv.id ? null : inv.id)}
                onDelete={onDelete}
                copied={copied}
                copy={copy}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
