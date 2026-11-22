import { useEffect, useRef, useState } from 'react';
import FloatingHearts from './components/FloatingHearts.jsx';
import AskScreen from './components/AskScreen.jsx';
import PlaceScreen from './components/PlaceScreen.jsx';
import DateScreen from './components/DateScreen.jsx';
import FinalScreen from './components/FinalScreen.jsx';
import { PLACES } from './data.js';
import { addDays, formatRu, toISO } from './lib/dates.js';
import { apiConfigured, getInvite, sendAnswer } from './lib/api.js';
import { applyTheme } from './lib/theme.js';

function ShopFooter({ shop }) {
  if (!shop) return null;
  const inner = (
    <>
      {shop.logo && <img src={shop.logo} alt="" />}
      <span>💐 {shop.name}</span>
    </>
  );
  return shop.website ? (
    <a className="shop-footer" href={shop.website} target="_blank" rel="noreferrer">{inner}</a>
  ) : (
    <div className="shop-footer">{inner}</div>
  );
}

const STEPS = ['ask', 'place', 'date', 'final'];

/**
 * inviteId есть  → настоящее приглашение: тексты с сервера, ответ уходит покупателю.
 * inviteId нет   → демо-режим: всё работает, но ничего никуда не отправляется.
 */
export default function App({ inviteId }) {
  const hearts = useRef(null);
  const [invite, setInvite] = useState(null);
  const [loadState, setLoadState] = useState(inviteId ? 'loading' : 'ready');

  const [step, setStep] = useState('ask');
  const [escapes, setEscapes] = useState(0);
  const [place, setPlace] = useState('');
  const [customPlace, setCustomPlace] = useState('');
  const [date, setDate] = useState(() => toISO(addDays(new Date(), 1)));
  const [time, setTime] = useState('');
  const [status, setStatus] = useState(inviteId ? 'sending' : 'demo');
  const lastSent = useRef('');

  // загрузка приглашения
  useEffect(() => {
    if (!inviteId) return;
    if (!apiConfigured) return setLoadState('error');
    let cancelled = false;
    getInvite(inviteId)
      .then((inv) => {
        if (cancelled) return;
        setInvite(inv);
        applyTheme(inv.shop?.color);
        // если она уже отвечала — сразу показываем её выбор
        if (inv.answer) {
          const a = inv.answer;
          const known = PLACES.find((p) => p.full === a.place);
          setPlace(known ? known.id : 'custom');
          if (!known) setCustomPlace(a.place);
          setDate(a.date);
          setTime(a.time);
          setEscapes(a.escapes || 0);
          setStatus('sent');
          setStep('final');
          lastSent.current = JSON.stringify(a);
        }
        setLoadState('ready');
      })
      .catch((e) => !cancelled && setLoadState(e.status === 404 ? 'not_found' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const placeText =
    place === 'custom' ? customPlace.trim() : PLACES.find((p) => p.id === place)?.full ?? '';

  const go = (s, burst = 0) => {
    setStep(s);
    if (burst) hearts.current?.burst(burst);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    if (!inviteId) return setStatus('demo');
    const answer = { place: placeText, date, time, escapes };
    const key = JSON.stringify(answer);
    // не шлём одно и то же повторно, если она вернулась и ничего не поменяла
    if (key === lastSent.current) return setStatus('sent');

    setStatus('sending');
    try {
      await sendAnswer(inviteId, answer);
      lastSent.current = key;
      setStatus('sent');
    } catch (e) {
      setStatus(e.status === 429 ? 'limit' : 'error');
    }
  };

  const finish = () => {
    go('final', 70);
    submit();
  };

  if (loadState !== 'ready') {
    const text = {
      loading: { e: '💌', t: 'Открываю…', s: '' },
      not_found: { e: '🥲', t: 'Приглашение не найдено', s: 'Проверь ссылку — возможно, в ней опечатка.' },
      error: { e: '📡', t: 'Не получилось загрузить', s: 'Проверь интернет и обнови страницу.' },
    }[loadState];
    return (
      <>
        <FloatingHearts ref={hearts} />
        <main className="card">
          <div className="screen-wrap">
            <div className={'big-emoji' + (loadState === 'loading' ? ' beat' : '')}>{text.e}</div>
            <h2>{text.t}</h2>
            {text.s && <p className="sub tight">{text.s}</p>}
          </div>
        </main>
      </>
    );
  }

  const toName = invite?.toName;
  const question =
    invite?.question || (toName ? `${toName}, сходишь со мной на свидание?` : 'Сходишь со мной на свидание?');
  const subtitle = invite?.fromName
    ? `С любовью, ${invite.fromName} 💌`
    : 'Я долго думал, как спросить… и решил просто спросить 🙈';

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
              question={question}
              subtitle={subtitle}
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
              onRetry={submit}
              onRestart={() => go('place')}
            />
          )}
        </div>
      </main>
      <ShopFooter shop={invite?.shop} />
    </>
  );
}
