import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { errText, fmtDateTime, useCopy } from './common.js';
import Qr from './Qr.jsx';

/** Подключение Telegram-уведомлений для сотрудников магазина. */
export default function TelegramCard() {
  const [data, setData] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState('');
  const [copied, copy] = useCopy();

  const load = useCallback(() => {
    api.telegram().then(setData).catch((e) => e.status !== 401 && setError(errText(e)));
  }, []);

  useEffect(() => {
    load();
    // пока окно открыто — проверяем, не подключился ли кто-то (после нажатия Start)
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const remove = async (c) => {
    if (!window.confirm(`Отключить уведомления для «${c.name || c.chatId}»?`)) return;
    try {
      await api.removeChat(c.chatId);
      load();
    } catch (e) {
      setError(errText(e));
    }
  };

  if (!data) return error ? <div className="adm-card"><p className="adm-error">{error}</p></div> : null;

  return (
    <section className="adm-card">
      <h2>🔔 Уведомления в Telegram</h2>
      <p className="adm-small adm-muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>
        Новые ответы девушек, переходы покупателей к заказу букета и напоминания об оплате.
        Откройте ссылку с телефона сотрудника и нажмите «Start». Можно подключить несколько человек.
      </p>

      <div className="adm-actions">
        <a className="adm-btn tg" href={data.link} target="_blank" rel="noreferrer">Открыть в Telegram</a>
        <button type="button" className="adm-btn" onClick={() => copy(data.link, 'tg')}>{copied === 'tg' ? '✓ Скопировано' : 'Копировать ссылку'}</button>
        <button type="button" className="adm-btn" onClick={() => setShowQr((v) => !v)}>{showQr ? 'Скрыть QR' : 'QR-код'}</button>
      </div>
      {showQr && (
        <div className="adm-qr" style={{ marginTop: 12 }}>
          <Qr text={data.link} size={200} />
          <span className="adm-small adm-muted">Отсканируйте камерой телефона сотрудника</span>
        </div>
      )}

      {error && <p className="adm-error" style={{ marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 14 }}>
        {data.chats.length === 0 ? (
          <p className="adm-small adm-muted">Пока никто не подключён.</p>
        ) : (
          <ul className="tg-chats">
            {data.chats.map((c) => (
              <li key={c.chatId}>
                <span>✅ <b>{c.name || 'Без имени'}</b> <span className="adm-muted adm-small">· с {fmtDateTime(c.createdAt)}</span></span>
                <button type="button" className="adm-btn danger-soft" onClick={() => remove(c)}>Отключить</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
