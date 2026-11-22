const STATUS = {
  sending: 'Отправляю ответ… 💌',
  sent: 'Ответ отправлен! Скоро напишу 💕',
  demo: 'Это демо-версия — ответ никуда не отправлен 💕',
  limit: 'Слишком много изменений — напиши мне напрямую 🙈',
  error: 'Не получилось отправить 😔',
};

export default function FinalScreen({ place, date, time, status, onRetry, onRestart }) {
  return (
    <section className="screen">
      <div className="big-emoji beat">💞</div>
      <h2>Это свидание!</h2>
      <p className="sub tight">Уже жду не дождусь ✨</p>

      <div className="ticket">
        <div className="row">
          <span className="i">📍</span>
          <div><small>Куда</small><b>{place}</b></div>
        </div>
        <div className="row">
          <span className="i">📅</span>
          <div><small>Когда</small><b>{date}</b></div>
        </div>
        <div className="row">
          <span className="i">⏰</span>
          <div><small>Во сколько</small><b>{time}</b></div>
        </div>
      </div>

      <p className="status" aria-live="polite">{STATUS[status]}</p>
      {status === 'error' && (
        <button type="button" className="btn btn-yes" style={{ marginTop: 12 }} onClick={onRetry}>
          Попробовать ещё раз
        </button>
      )}
      <button type="button" className="link" onClick={onRestart}>
        изменить выбор
      </button>
    </section>
  );
}
