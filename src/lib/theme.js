/** Фирменная тема магазина из одного цвета. */

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export const DEFAULT_COLOR = '#e75a91';

export const PRESET_COLORS = ['#e75a91', '#d63a6e', '#c2185b', '#e5533d', '#f08a24', '#8e5bd6', '#5b6ee1', '#2e9e8f', '#3f8f4f', '#9a6b4f'];

/** Возвращает набор CSS-переменных для темы. */
export function themeVars(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
  let accent = hexToRgb(hex);
  // белый текст на кнопке должен читаться: слишком светлые цвета затемняем
  for (let i = 0; i < 8 && luminance(accent) > 0.3; i++) accent = mix(accent, BLACK, 0.15);

  const text = mix(accent, BLACK, 0.55);
  return {
    '--pink-dark': rgbToHex(accent),
    '--pink': rgbToHex(mix(accent, WHITE, 0.35)),
    '--pink-soft': rgbToHex(mix(accent, WHITE, 0.85)),
    '--text': rgbToHex(text),
    '--muted': rgbToHex(mix(text, WHITE, 0.35)),
    '--bg1': rgbToHex(mix(accent, WHITE, 0.94)),
    '--bg2': rgbToHex(mix(accent, WHITE, 0.8)),
    '--bg3': rgbToHex(mix(accent, WHITE, 0.65)),
    '--glow': accent.map(Math.round).join(', '),
  };
}

/** Применяет тему ко всей странице (или сбрасывает, если цвета нет). */
export function applyTheme(hex) {
  const vars = themeVars(hex);
  const root = document.documentElement;
  const keys = ['--pink-dark', '--pink', '--pink-soft', '--text', '--muted', '--bg1', '--bg2', '--bg3', '--glow'];
  keys.forEach((k) => root.style.removeProperty(k));
  if (vars) Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = vars ? vars['--pink-soft'] : '#ffe3ee';
}
