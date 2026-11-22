import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const CHARS = ['💗', '💕', '💖', '🌸', '💓', '🤍'];

/** Падающие сердечки. Работает напрямую с DOM, чтобы не перерисовывать React-дерево. */
const FloatingHearts = forwardRef(function FloatingHearts(_, ref) {
  const box = useRef(null);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const spawn = (isBurst = false) => {
    const el = box.current;
    if (!el) return;
    const h = document.createElement('span');
    h.textContent = CHARS[(Math.random() * CHARS.length) | 0];
    h.style.left = Math.random() * 100 + '%';
    h.style.fontSize = 14 + Math.random() * (isBurst ? 28 : 16) + 'px';
    const dur = isBurst ? 2.5 + Math.random() * 2 : 6 + Math.random() * 6;
    h.style.animationDuration = dur + 's';
    el.appendChild(h);
    setTimeout(() => h.remove(), dur * 1000);
  };

  useImperativeHandle(ref, () => ({
    burst(n = 40) {
      if (reduced) return;
      for (let i = 0; i < n; i++) setTimeout(() => spawn(true), i * 30);
    },
  }));

  useEffect(() => {
    if (reduced) return;
    // на маленьких экранах сердечек меньше — экономим батарею
    const every = window.innerWidth < 500 ? 900 : 550;
    const id = setInterval(() => spawn(), every);
    return () => clearInterval(id);
  }, []);

  return <div className="hearts" ref={box} aria-hidden="true" />;
});

export default FloatingHearts;
