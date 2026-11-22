import { useRef, useState } from 'react';
import { DEFAULT_COLOR, PRESET_COLORS, themeVars } from '../lib/theme.js';
import { resizeLogo } from '../lib/image.js';
import { errText } from './common.js';

/** Поля брендинга (название, цвет, логотип, сайт) + живой предпросмотр. */
export default function BrandingForm({ value, onChange }) {
  const fileRef = useRef(null);
  const [logoError, setLogoError] = useState('');
  const set = (k, v) => onChange({ ...value, [k]: v });
  const color = value.color || DEFAULT_COLOR;
  const vars = themeVars(color);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError('');
    try {
      set('logo', await resizeLogo(file));
    } catch (err) {
      setLogoError(errText(err));
    }
  };

  return (
    <div className="br-wrap">
      <div className="br-fields">
        <label className="adm-field">
          <span>Название магазина *</span>
          <input className="input" value={value.name || ''} maxLength={60} onChange={(e) => set('name', e.target.value)} placeholder="Роза Флауэрс" />
        </label>

        <div className="adm-field">
          <span>Фирменный цвет</span>
          <div className="br-colors">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={'br-swatch' + (color === c ? ' on' : '')}
                style={{ background: c }}
                aria-label={c}
                onClick={() => set('color', c)}
              />
            ))}
            <label className="br-custom" title="Свой цвет">
              <input type="color" value={color} onChange={(e) => set('color', e.target.value)} />
              🎨
            </label>
          </div>
        </div>

        <div className="adm-field">
          <span>Логотип</span>
          <div className="br-logo-row">
            <div className="br-logo">{value.logo ? <img src={value.logo} alt="" /> : '💐'}</div>
            <button type="button" className="adm-btn" onClick={() => fileRef.current?.click()}>Загрузить</button>
            {value.logo && <button type="button" className="adm-btn" onClick={() => set('logo', null)}>Убрать</button>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
          </div>
          {logoError && <p className="adm-error">{logoError}</p>}
          <small>Квадратная картинка, лучше PNG с прозрачным фоном.</small>
        </div>

        <label className="adm-field">
          <span>Куда вести «Заказать букет»</span>
          <input className="input" value={value.orderLink || ''} maxLength={200} onChange={(e) => set('orderLink', e.target.value)} placeholder="+7 701 123 45 67 или ссылка на сайт" autoCapitalize="none" inputMode="url" />
          <small>Номер — откроется WhatsApp с готовым текстом заказа (дата, время, место). Кнопка придёт покупателю вместе с ответом девушки.</small>
        </label>

        <label className="adm-field">
          <span>Сайт или Instagram</span>
          <input className="input" value={value.website || ''} maxLength={200} onChange={(e) => set('website', e.target.value)} placeholder="instagram.com/roza_flowers" autoCapitalize="none" />
          <small>Ссылка под приглашением у девушки (логотип и название магазина).</small>
        </label>
      </div>

      <div className="br-preview" style={{ ...vars, background: `linear-gradient(135deg, ${vars['--bg1']}, ${vars['--bg2']})` }}>
        <span className="adm-small br-preview-label">Так увидит девушка</span>
        <div className="br-preview-card">
          <div className="br-preview-emoji">💗</div>
          <div className="br-preview-q" style={{ color: vars['--pink-dark'] }}>Аружан, сходишь со мной на свидание?</div>
          <div className="br-preview-btns">
            <span style={{ background: `linear-gradient(135deg, ${vars['--pink']}, ${vars['--pink-dark']})` }}>Да 💕</span>
            <span style={{ color: vars['--muted'], borderColor: vars['--pink-soft'] }}>Нет</span>
          </div>
        </div>
        <div className="br-preview-shop" style={{ color: vars['--text'] }}>
          {value.logo && <img src={value.logo} alt="" />}
          {value.name || 'Ваш магазин'}
        </div>
      </div>
    </div>
  );
}
