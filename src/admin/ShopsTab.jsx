import { useState } from 'react';
import { api } from '../lib/api.js';
import BrandingForm from './BrandingForm.jsx';
import { errText, generatePassword, useCopy, fmtDateTime } from './common.js';

const adminUrl = () => `${window.location.origin}${window.location.pathname}#/admin`;

/** Текст, который удобно переслать магазину после создания. */
const accessText = (login, password) =>
  `Доступ к кабинету приглашений 💌\n\nАдрес: ${adminUrl()}\nЛогин: ${login}\nПароль: ${password}\n\nПароль можно сменить во вкладке «Магазин».`;

function CreateShop({ onCreated }) {
  const [brand, setBrand] = useState({ name: '', color: '', logo: null, website: '' });
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
      setBrand({ name: '', color: '', logo: null, website: '' });
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

export default function ShopsTab({ shops, onChange }) {
  const [editing, setEditing] = useState(null);
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  const [copied, copy] = useCopy();

  const toggleActive = async (s) => {
    if (s.active && !window.confirm(`Отключить «${s.name}»? Магазин не сможет войти. Уже созданные приглашения продолжат работать.`)) return;
    try {
      await api.updateShop(s.id, { active: !s.active });
      onChange();
    } catch (err) {
      setError(errText(err));
    }
  };

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

      <CreateShop
        onCreated={(shop, password) => {
          setAccess({ login: shop.login, password });
          onChange();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <section className="adm-card">
        <h2>Магазины <span className="adm-muted">({shops.length})</span></h2>
        {error && <p className="adm-error">{error}</p>}
        {shops.length === 0 ? (
          <p className="adm-muted">Пока нет ни одного магазина.</p>
        ) : (
          <ul className="adm-list">
            {shops.map((s) => (
              <li key={s.id} className={'adm-row' + (editing === s.id ? ' open' : '') + (s.active ? '' : ' off')}>
                <div className="adm-row-head as-div">
                  <div className="adm-shop">
                    <span className="adm-shop-logo" style={{ borderColor: s.color || undefined }}>
                      {s.logo ? <img src={s.logo} alt="" /> : '💐'}
                    </span>
                    <div className="adm-row-main">
                      <b>{s.name}</b>
                      <div className="adm-muted adm-small">
                        логин: {s.login} · {s.invites ?? 0} приглаш. · {s.answered ?? 0} ответов · с {fmtDateTime(s.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="adm-actions">
                    {!s.active && <span className="adm-badge">Отключён</span>}
                    <button type="button" className="adm-btn" onClick={() => setEditing(editing === s.id ? null : s.id)}>
                      {editing === s.id ? 'Свернуть' : 'Изменить'}
                    </button>
                    <button type="button" className={'adm-btn' + (s.active ? ' danger-soft' : '')} onClick={() => toggleActive(s)}>
                      {s.active ? 'Отключить' : 'Включить'}
                    </button>
                  </div>
                </div>
                {editing === s.id && (
                  <EditShop
                    shop={s}
                    onCancel={() => setEditing(null)}
                    onSaved={(acc) => {
                      setEditing(null);
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
    </>
  );
}
