import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, onSessionExpired, session } from '../lib/api.js';
import Login from './Login.jsx';
import InvitesTab from './InvitesTab.jsx';
import StatsTab from './StatsTab.jsx';
import SettingsTab from './SettingsTab.jsx';
import ShopsTab from './ShopsTab.jsx';
import './admin.css';

const TABS = {
  shop: [
    ['invites', '💌 Приглашения'],
    ['stats', '📊 Статистика'],
    ['settings', '🎨 Магазин'],
  ],
  super: [
    ['invites', '💌 Приглашения'],
    ['stats', '📊 Статистика'],
    ['shops', '🏪 Магазины'],
  ],
};

export default function Admin() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(!!session.get());
  const [tab, setTab] = useState('invites');
  const [shops, setShops] = useState([]);

  // проверяем сохранённую сессию
  useEffect(() => {
    if (!session.get()) return;
    api
      .me()
      .then(setMe)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => onSessionExpired(() => setMe(null)), []);

  const loadShops = useCallback(async () => {
    if (me?.role !== 'super') return;
    try {
      setShops(await api.shops());
    } catch {}
  }, [me?.role]);
  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const shopsById = useMemo(() => Object.fromEntries(shops.map((s) => [s.id, s])), [shops]);

  if (checking) return <div className="adm adm-center adm-muted">Загрузка…</div>;
  if (!me) return <Login onLogin={(m) => { setMe(m); setTab('invites'); }} />;

  const logout = async () => {
    await api.logout().catch(() => {});
    setMe(null);
  };

  const title = me.role === 'super' ? 'Супер-админ' : me.shop.name;

  return (
    <div className="adm">
      <header className="adm-header">
        <div className="adm-brand">
          {me.shop?.logo ? <img src={me.shop.logo} alt="" /> : <span className="adm-brand-emoji">💌</span>}
          <div>
            <h1>{title}</h1>
            <span className="adm-muted adm-small">{me.role === 'super' ? 'все магазины' : 'кабинет магазина'}</span>
          </div>
        </div>
        <button type="button" className="adm-btn" onClick={logout}>Выйти</button>
      </header>

      <nav className="adm-tabs" role="tablist">
        {TABS[me.role].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={'adm-tab' + (tab === id ? ' on' : '')}
            onClick={() => setTab(id)}
          >
            <span className="adm-tab-emoji">{label.split(' ')[0]} </span>
            {label.split(' ').slice(1).join(' ')}
          </button>
        ))}
      </nav>

      {tab === 'invites' && <InvitesTab me={me} shops={shops} shopsById={shopsById} />}
      {tab === 'stats' && <StatsTab me={me} shops={shops} />}
      {tab === 'settings' && me.role === 'shop' && <SettingsTab me={me} onUpdated={(shop) => setMe({ ...me, shop })} />}
      {tab === 'shops' && me.role === 'super' && <ShopsTab shops={shops} onChange={loadShops} />}
    </div>
  );
}
