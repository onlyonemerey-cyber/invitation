/**
 * Уменьшает картинку логотипа до 256px и возвращает data URL (PNG — сохраняет прозрачность).
 * Если PNG получился тяжёлым — пробует WebP/JPEG.
 */
export async function resizeLogo(file, max = 256) {
  if (!file.type.startsWith('image/')) throw new Error('not_image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

    for (const [type, quality] of [['image/png'], ['image/webp', 0.9], ['image/jpeg', 0.85]]) {
      const data = canvas.toDataURL(type, quality);
      if (data.startsWith(`data:${type}`) && data.length < 190_000) return data;
    }
    throw new Error('logo_too_big');
  } finally {
    URL.revokeObjectURL(url);
  }
}
