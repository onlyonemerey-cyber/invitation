import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

function matrix(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push([c, r]);
  return { n, cells };
}

/** QR-код в SVG — чёткий при любом размере и при печати. */
export default function Qr({ text, size = 200, color = '#3a1f2c', className }) {
  const { n, cells } = useMemo(() => matrix(text), [text]);
  const m = 2; // «тихая зона» вокруг кода
  const d = cells.map(([x, y]) => `M${x + m} ${y + m}h1v1h-1z`).join('');
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${n + m * 2} ${n + m * 2}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR-код"
    >
      <rect width="100%" height="100%" fill="#fff" />
      <path d={d} fill={color} />
    </svg>
  );
}

/** Скачивает QR как PNG (для печати на кассе, в соцсетях и т.п.). */
export function downloadQrPng(text, filename, px = 1024, color = '#3a1f2c') {
  const { n, cells } = matrix(text);
  const m = 2;
  const total = n + m * 2;
  const cell = Math.floor(px / total);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cell * total;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  cells.forEach(([x, y]) => ctx.fillRect((x + m) * cell, (y + m) * cell, cell, cell));
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
