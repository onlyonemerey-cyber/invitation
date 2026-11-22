import { useState } from 'react';
import { api, apiConfigured } from '../lib/api.js';
import { errText } from './common.js';

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(login.trim(), pwd));
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm adm-center">
      <form className="adm-card adm-login" onSubmit={submit}>
        <div className="adm-logo">💐</div>
        <h1>Вход для магазинов</h1>
        {!apiConfigured && <p className="adm-error">Не указан адрес сервера (VITE_API_URL).</p>}
        <input
          className="input"
          placeholder="Логин"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoFocus
        />
        <input
          className="input"
          type="password"
          placeholder="Пароль"
          autoComplete="current-password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
        {error && <p className="adm-error">{error}</p>}
        <button className="btn btn-yes wide" disabled={!login.trim() || !pwd || busy}>
          {busy ? 'Вхожу…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
