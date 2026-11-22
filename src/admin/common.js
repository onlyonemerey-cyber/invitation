import { useState } from 'react';

const ERRORS = {
  to_name_required: 'Укажи имя девушки',
  bad_username: 'Неверный username: 4–32 символа, латиница, цифры и _',
  bad_credentials: 'Неверный логин или пароль',
  too_many_attempts: 'Слишком много попыток. Подожди 15 минут.',
  shop_disabled: 'Доступ магазина отключён. Свяжитесь с администратором.',
  login_required: 'Введи логин и пароль',
  bad_login: 'Логин: 3–32 символа, латиница, цифры, точка, _ или -',
  login_taken: 'Такой логин уже занят',
  weak_password: 'Пароль должен быть не короче 8 символов',
  bad_current_password: 'Текущий пароль неверный',
  name_required: 'Укажи название',
  bad_logo: 'Логотип должен быть картинкой PNG, JPG или WebP',
  logo_too_big: 'Логотип слишком большой — попробуй картинку попроще',
  not_image: 'Это не картинка',
  bad_website: 'Неверная ссылка на сайт',
  forbidden: 'Нет доступа',
  not_found: 'Не найдено',
};

export const errText = (e) => ERRORS[e?.message] || 'Что-то пошло не так. Проверь интернет и попробуй ещё раз.';

/** Ссылка для девушки строится от адреса, где открыта админка. */
export const girlLink = (id) => `${window.location.origin}${window.location.pathname}?i=${id}`;

export function useCopy() {
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

export function generatePassword(len = 10) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export const fmtDateTime = (ms) =>
  new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
