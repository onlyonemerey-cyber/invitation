import { useState } from 'react';
import { api } from '../lib/api.js';
import BrandingForm from './BrandingForm.jsx';
import BillingCard from './BillingCard.jsx';
import TelegramCard from './TelegramCard.jsx';
import { errText } from './common.js';

const pick = (s) => ({
  name: s.name,
  color: s.color,
  logo: s.logo,
  website: s.website ? s.website.replace(/^https:\/\//, '') : '',
  orderLink: s.orderLink || '',
});

export default function SettingsTab({ me, onUpdated }) {
  const [form, setForm] = useState(() => pick(me.shop));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [pwMsg, setPwMsg] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const shop = await api.updateMyShop(form);
      onUpdated(shop);
      setForm(pick(shop));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.repeat) return setPwMsg({ err: true, text: 'Новые пароли не совпадают' });
    try {
      await api.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', repeat: '' });
      setPwMsg({ err: false, text: '✓ Пароль изменён. На других устройствах нужно войти заново.' });
    } catch (err) {
      setPwMsg({ err: true, text: errText(err) });
    }
  };

  return (
    <>
      <BillingCard />
      <TelegramCard />

      <form className="adm-card" onSubmit={save}>
        <h2>Брендинг</h2>
        <BrandingForm value={form} onChange={setForm} />
        {error && <p className="adm-error">{error}</p>}
        <div className="adm-actions" style={{ marginTop: 16, alignItems: 'center' }}>
          <button className="btn btn-yes" disabled={busy || !form.name?.trim()}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
          {saved && <span className="adm-ok">✓ Сохранено</span>}
        </div>
      </form>

      <form className="adm-card" onSubmit={changePw}>
        <h2>Пароль</h2>
        <p className="adm-small adm-muted" style={{ marginBottom: 12 }}>Логин: <b>{me.shop.login}</b></p>
        <div className="adm-grid">
          <label className="adm-field adm-wide">
            <span>Текущий пароль</span>
            <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </label>
          <label className="adm-field">
            <span>Новый пароль</span>
            <input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </label>
          <label className="adm-field">
            <span>Повтори новый</span>
            <input className="input" type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} />
          </label>
        </div>
        {pwMsg && <p className={pwMsg.err ? 'adm-error' : 'adm-ok'}>{pwMsg.text}</p>}
        <button className="btn btn-yes" disabled={!pw.current || pw.next.length < 8}>Сменить пароль</button>
      </form>
    </>
  );
}
