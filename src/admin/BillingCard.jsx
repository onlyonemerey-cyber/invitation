import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { errText, fmtDate, fmtMoney, limitText } from './common.js';

/** Блок «Тариф» в кабинете магазина: текущий тариф, расход лимита, как оплатить. */
export default function BillingCard() {
  const [b, setB] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.billing().then(setB).catch((e) => e.status !== 401 && setError(errText(e)));
  }, []);

  if (error) return <div className="adm-card"><p className="adm-error">{error}</p></div>;
  if (!b) return null;

  const pct = b.limit ? Math.min(100, Math.round((b.used / b.limit) * 100)) : 0;
  const status = b.expired
    ? { cls: 'warn', text: 'Подписка закончилась' }
    : b.daysLeft <= 3
      ? { cls: 'warn', text: `Осталось ${b.daysLeft} дн.` }
      : { cls: 'ok', text: `Активна до ${fmtDate(b.paidUntil)}` };

  const payMsg = `Здравствуйте! Хочу оплатить/продлить тариф для магазина.`;
  const contactHref = b.contact
    ? b.contact.includes('wa.me') || b.contact.includes('whatsapp')
      ? `${b.contact}${b.contact.includes('?') ? '&' : '?'}text=${encodeURIComponent(payMsg)}`
      : b.contact
    : null;

  return (
    <section className="adm-card bl-card" id="billing">
      <div className="adm-list-head">
        <h2>💳 Тариф «{b.planName}»</h2>
        <span className={'adm-badge ' + status.cls}>{status.text}</span>
      </div>

      <div className="bl-usage">
        <div className="bl-usage-top">
          <span>Приглашений в этом месяце</span>
          <b>{b.used}{b.limit != null && ` из ${b.limit}`}</b>
        </div>
        {b.limit != null && (
          <div className={'bl-bar' + (pct >= 90 ? ' hot' : '')}>
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        {b.limitReached && <p className="adm-error" style={{ marginTop: 10 }}>Лимит исчерпан — новые приглашения можно будет создать после смены тарифа или в следующем месяце.</p>}
        {b.expired && <p className="adm-error" style={{ marginTop: 10 }}>Новые приглашения создавать нельзя, пока подписка не продлена. Уже отправленные продолжают работать.</p>}
      </div>

      <div className="bl-plans">
        {b.plans.filter((p) => p.id !== 'trial').map((p) => (
          <div key={p.id} className={'bl-plan' + (p.id === b.plan ? ' on' : '')}>
            <b>{p.name}</b>
            <span className="bl-price">{fmtMoney(p.price)}<small> / мес</small></span>
            <span className="adm-small adm-muted">{limitText(p.limit)}</span>
            {p.id === b.plan && <span className="adm-badge ok">текущий</span>}
          </div>
        ))}
      </div>

      <div className="bl-pay">
        <b>Как оплатить</b>
        <p>{b.paymentInstructions || 'Свяжитесь с администратором сервиса — он пришлёт реквизиты.'}</p>
        <p className="adm-small adm-muted">После оплаты доступ продлевается администратором, обычно в течение дня.</p>
        {contactHref && (
          <a className="adm-btn accent" href={contactHref} target="_blank" rel="noreferrer">Написать об оплате</a>
        )}
      </div>
    </section>
  );
}
