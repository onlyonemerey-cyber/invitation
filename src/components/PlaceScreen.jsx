import { useEffect, useRef } from 'react';
import { PLACES } from '../data.js';

export default function PlaceScreen({ place, customPlace, onPlace, onCustom, onNext }) {
  const inputRef = useRef(null);
  const ready = place && (place !== 'custom' || customPlace.trim());

  useEffect(() => {
    if (place === 'custom') inputRef.current?.focus();
  }, [place]);

  return (
    <section className="screen">
      <div className="big-emoji">🥰</div>
      <h2>Ура! Я знал!</h2>
      <p className="sub tight">Куда тебе хочется пойти?</p>

      <div className="options" role="radiogroup">
        {PLACES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={place === p.id}
            className={'opt' + (place === p.id ? ' selected' : '')}
            onClick={() => onPlace(p.id)}
          >
            <span className="e">{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>

      {place === 'custom' && (
        <input
          ref={inputRef}
          className="input custom-input"
          type="text"
          placeholder="Напиши, куда хочешь 💭"
          maxLength={60}
          value={customPlace}
          onChange={(e) => onCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ready && onNext()}
        />
      )}

      <button type="button" className="btn btn-yes wide" disabled={!ready} onClick={onNext}>
        Дальше →
      </button>
    </section>
  );
}
