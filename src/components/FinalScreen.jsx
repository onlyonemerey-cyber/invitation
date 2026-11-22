const STATUS = {
  sending: 'Отправляю ответ… 💌',
  sent: 'Ответ отправлен! Скоро напишу 💕',
  saved: 'Ответ сохранён 💕',
  error: 'Не получилось отправить — напиши мне сама 🙈',
};

export default function FinalScreen({ place, date, time, status, onRestart }) {
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
      <button type="button" className="link" onClick={onRestart}>
        изменить выбор
      </button>
    </section>
  );
}
