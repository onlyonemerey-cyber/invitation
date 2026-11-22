export const now = () => Date.now();

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}
export const fail = (status, code) => {
  throw new HttpError(status, code);
};

export async function readJson(req) {
  return req.json().catch(() => ({}));
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newId(len = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function safeEqual(a = '', b = '') {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** "@Name", "t.me/Name", "https://t.me/Name" → "name" */
export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@/, '')
    .toLowerCase();
}

export const clean = (s, max) => String(s ?? '').trim().slice(0, max);

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function formatDateRu(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

export function timesWord(n) {
  const a = n % 10, b = n % 100;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'раза';
  return 'раз';
}

// ---------- валидация полей магазина ----------

export function cleanColor(v) {
  const s = clean(v, 7);
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

export function cleanLogo(v) {
  if (v === null || v === '') return null;
  const s = String(v);
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) fail(400, 'bad_logo');
  if (s.length > 200_000) fail(400, 'logo_too_big');
  return s;
}

export function cleanUrl(v) {
  let s = clean(v, 200);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) fail(400, 'bad_website');
    return u.toString();
  } catch {
    fail(400, 'bad_website');
  }
}

export function cleanLogin(v) {
  const s = clean(v, 32).toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(s)) fail(400, 'bad_login');
  if (s === 'admin') fail(400, 'login_taken');
  return s;
}

export function checkPassword(v) {
  const s = String(v ?? '');
  if (s.length < 8 || s.length > 128) fail(400, 'weak_password');
  return s;
}
