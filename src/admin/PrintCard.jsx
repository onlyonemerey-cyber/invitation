import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Qr from './Qr.jsx';
import { girlLink } from './common.js';
import { themeVars, DEFAULT_COLOR } from '../lib/theme.js';

/**
 * Открытка A6 (105×148 мм) с QR-кодом приглашения — вкладывается в букет.
 * Печать: только сама открытка, остальная страница скрыта (@media print).
 */
export default function PrintCard({ inv, shop, onClose }) {
  const [note, setNote] = useState('У меня к тебе есть один очень важный вопрос…');
  const vars = themeVars(shop?.color || DEFAULT_COLOR);

  useEffect(() => {
    document.body.classList.add('printing-card');
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('printing-card');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="pc-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pc-panel" role="dialog" aria-label="Открытка для печати">
        <div className="pc-tools">
          <b>Открытка к букету</b>
          <button type="button" className="adm-btn" onClick={onClose}>✕</button>
        </div>

        <label className="adm-field">
          <span>Текст на открытке</span>
          <input className="input" value={note} maxLength={90} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="pc-sheet">
          <div className="pc-card" style={vars}>
            <div className="pc-hearts" aria-hidden="true">💗 🌸 💕</div>
            <div className="pc-to">{inv.toName}, это тебе 💌</div>
            <p className="pc-note">{note}</p>
            <div className="pc-qr">
              <Qr text={girlLink(inv.id)} size={170} color={vars['--text']} />
            </div>
            <p className="pc-hint">Наведи камеру телефона на код 📱</p>
            {inv.fromName && <div className="pc-from">С любовью, {inv.fromName}</div>}
            {shop && (
              <div className="pc-shop">
                {shop.logo && <img src={shop.logo} alt="" />}
                <span>{shop.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="pc-actions">
          <button type="button" className="btn btn-yes" onClick={() => window.print()}>🖨 Печать</button>
          <span className="adm-small adm-muted">Формат A6 (105×148 мм). В настройках печати выбери «Без полей» или масштаб 100%.</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
