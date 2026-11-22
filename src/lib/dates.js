export const toISO = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function nextSaturday(from = new Date()) {
  const diff = (6 - from.getDay() + 7) % 7 || 7;
  return addDays(from, diff);
}

export function formatRu(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
