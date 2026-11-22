import { useMemo } from 'react';
import { TIMES } from '../data.js';
import { addDays, nextSaturday, toISO } from '../lib/dates.js';

export default function DateScreen({ date, time, onDate, onTime, onNext, onBack }) {
  const today = useMemo(() => new Date(), []);
  const quick = useMemo(
    () => [
      { label: 'Сегодня', value: toISO(today) },
      { label: 'Завтра', value: toISO(addDays(today, 1)) },
      { label: 'В субботу', value: toISO(nextSaturday(today)) },
    ],
    [today]
  );
  const customTime = time && !TIMES.includes(time);

  return (
    <section className="screen">
      <div className="big-emoji">📅</div>
      <h2>Когда тебе удобно?</h2>

      <div className="field">
        <label htmlFor="date">Дата</label>
        <div className="chips">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              className={'chip' + (date === q.value ? ' selected' : '')}
              onClick={() => onDate(q.value)}
            >
              {q.label}
            </button>
          ))}
        </div>
        <input
          id="date"
          className="input"
          type="date"
          min={toISO(today)}
          value={date}
          onChange={(e) => onDate(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="time">Время</label>
        <div className="chips">
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              className={'chip' + (time === t ? ' selected' : '')}
              onClick={() => onTime(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          id="time"
          className={'input' + (customTime ? ' active' : '')}
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          aria-label="Своё время"
        />
      </div>

      <button type="button" className="btn btn-yes wide" disabled={!(date && time)} onClick={onNext}>
        Готово 💖
      </button>
      <button type="button" className="link" onClick={onBack}>
        ← изменить место
      </button>
    </section>
  );
}
