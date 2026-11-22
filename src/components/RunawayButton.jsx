import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NO_PHRASES } from '../data.js';

const PAD = 12;

function viewport() {
  const v = window.visualViewport;
  return {
    w: v?.width ?? window.innerWidth,
    h: v?.height ?? window.innerHeight,
    ox: v?.offsetLeft ?? 0,
    oy: v?.offsetTop ?? 0,
  };
}

const overlaps = (x, y, w, h, r, gap = 16) =>
  x < r.right + gap && x + w > r.left - gap && y < r.bottom + gap && y + h > r.top - gap;

/**
 * Кнопка «Нет», которую невозможно нажать.
 * Убегает при наведении мыши или касании пальцем. Пока она «бегает», рендерится
 * через портал в <body>, чтобы position: fixed считался от экрана, а не от карточки
 * (backdrop-filter у карточки ломает fixed-позиционирование).
 */
export default function RunawayButton({ avoidRef, onEscape }) {
  const btn = useRef(null);
  const placeholder = useRef(null);
  const [pos, setPos] = useState(null);
  const [count, setCount] = useState(0);
  const lastRun = useRef(0);

  const nextPos = useCallback(
    (from) => {
      const { w: vw, h: vh, ox, oy } = viewport();
      const { width: bw, height: bh } = from;
      const avoid = avoidRef.current?.getBoundingClientRect();
      const maxX = ox + vw - bw - PAD;
      const maxY = oy + vh - bh - PAD;
      // прыжок пропорционален экрану: на телефоне ближе, на компьютере дальше
      const minD = Math.min(80, vw * 0.2);
      const maxD = Math.min(220, vw * 0.45);

      let best = null;
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = minD + Math.random() * (maxD - minD);
        const x = Math.min(Math.max(from.left + Math.cos(a) * d, ox + PAD), maxX);
        const y = Math.min(Math.max(from.top + Math.sin(a) * d, oy + PAD), maxY);
        const moved = Math.hypot(x - from.left, y - from.top);
        if (moved < minD * 0.7) continue; // упёрлась в край — ищем другое направление
        if (avoid && overlaps(x, y, bw, bh, avoid)) continue;
        best = { x, y };
        break;
      }
      // запасной вариант: случайное место на экране
      return (
        best ?? {
          x: ox + PAD + Math.random() * Math.max(0, maxX - ox - PAD),
          y: oy + PAD + Math.random() * Math.max(0, maxY - oy - PAD),
        }
      );
    },
    [avoidRef]
  );

  const run = useCallback(() => {
    const now = performance.now();
    if (now - lastRun.current < 120) return; // защита от двойных событий
    lastRun.current = now;

    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const target = nextPos(r);

    if (!pos) {
      // сначала «отрываем» кнопку на её текущем месте, затем анимируем прыжок
      setPos({ x: r.left, y: r.top, w: r.width, h: r.height });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setPos((p) => ({ ...p, ...target })))
      );
    } else {
      setPos((p) => ({ ...p, ...target }));
    }
    setCount((c) => c + 1);
    onEscape?.();
  }, [pos, nextPos, onEscape]);

  // touchstart с passive:false — чтобы preventDefault не дал сработать клику
  useEffect(() => {
    const el = btn.current;
    if (!el) return;
    const onTouch = (e) => {
      e.preventDefault();
      run();
    };
    el.addEventListener('touchstart', onTouch, { passive: false });
    return () => el.removeEventListener('touchstart', onTouch);
  }, [run, pos]);

  // при повороте экрана / изменении размера возвращаем кнопку в видимую область
  useEffect(() => {
    if (!pos) return;
    const fit = () => {
      const { w: vw, h: vh, ox, oy } = viewport();
      setPos((p) =>
        p && {
          ...p,
          x: Math.min(Math.max(p.x, ox + PAD), ox + vw - p.w - PAD),
          y: Math.min(Math.max(p.y, oy + PAD), oy + vh - p.h - PAD),
        }
      );
    };
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, [!!pos]);

  const button = (
    <button
      ref={btn}
      type="button"
      tabIndex={-1}
      className={'btn btn-no' + (pos ? ' running' : '')}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && run()}
      onClick={(e) => {
        e.preventDefault();
        run();
      }}
    >
      {NO_PHRASES[count % NO_PHRASES.length]}
    </button>
  );

  if (!pos) return button;

  return (
    <>
      {/* пустое место той же ширины, чтобы «Да» не прыгала */}
      <span ref={placeholder} style={{ width: pos.w, height: pos.h, display: 'inline-block' }} />
      {createPortal(button, document.body)}
    </>
  );
}
