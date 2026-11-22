import { useRef, useState } from 'react';
import FloatingHearts from './components/FloatingHearts.jsx';
import AskScreen from './components/AskScreen.jsx';
import PlaceScreen from './components/PlaceScreen.jsx';
import DateScreen from './components/DateScreen.jsx';
import FinalScreen from './components/FinalScreen.jsx';
import { PLACES } from './data.js';
import { addDays, formatRu, toISO } from './lib/dates.js';
import { sendTelegram, telegramConfigured } from './lib/telegram.js';

const STEPS = ['ask', 'place', 'date', 'final'];

export default function App() {
  const hearts = useRef(null);
  const [step, setStep] = useState('ask');
  const [escapes, setEscapes] = useState(0);
  const [place, setPlace] = useState('');
  const [customPlace, setCustomPlace] = useState('');
  const [date, setDate] = useState(() => toISO(addDays(new Date(), 1)));
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('sending');
  const lastSent = useRef('');

  const placeText =
    place === 'custom' ? customPlace.trim() : PLACES.find((p) => p.id === place)?.full ?? '';

  const go = (s, burst = 0) => {
    setStep(s);
    if (burst) hearts.current?.burst(burst);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finish = async () => {
    go('final', 70);
    const text =
      `💌 Она ответила ДА!\n\n` +
      `📍 Куда: ${placeText}\n` +
      `📅 Когда: ${formatRu(date)}\n` +
      `⏰ Время: ${time}\n\n` +
      `🏃 Пыталась нажать «Нет»: ${escapes} раз(а)`;

    // не шлём одно и то же повторно, если она просто вернулась и ничего не поменяла
    if (text === lastSent.current) return;
    if (!telegramConfigured) return setStatus('saved');

    setStatus('sending');
    try {
      await sendTelegram(text);
      lastSent.current = text;
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <>
      <FloatingHearts ref={hearts} />
      <main className="card">
        {stepIndex > 0 && (
          <div className="progress" aria-hidden="true">
            {STEPS.slice(1).map((s, i) => (
              <span key={s} className={i < stepIndex ? 'on' : ''} />
            ))}
          </div>
        )}

        <div className="screen-wrap" key={step}>
          {step === 'ask' && (
            <AskScreen
              escapes={escapes}
              onEscape={() => setEscapes((n) => n + 1)}
              onYes={() => go('place', 50)}
            />
          )}
          {step === 'place' && (
            <PlaceScreen
              place={place}
              customPlace={customPlace}
              onPlace={setPlace}
              onCustom={setCustomPlace}
              onNext={() => go('date')}
            />
          )}
          {step === 'date' && (
            <DateScreen
              date={date}
              time={time}
              onDate={setDate}
              onTime={setTime}
              onNext={finish}
              onBack={() => go('place')}
            />
          )}
          {step === 'final' && (
            <FinalScreen
              place={placeText}
              date={formatRu(date)}
              time={time}
              status={status}
              onRestart={() => go('place')}
            />
          )}
        </div>
      </main>
    </>
  );
}
