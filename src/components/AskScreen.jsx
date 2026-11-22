import { useRef } from 'react';
import RunawayButton from './RunawayButton.jsx';

export default function AskScreen({ question, subtitle, escapes, onEscape, onYes }) {
  const yesRef = useRef(null);
  const scale = Math.min(1 + escapes * 0.08, 1.7);

  return (
    <section className="screen">
      <div className="big-emoji beat">💗</div>
      <h1>{question}</h1>
      <p className="sub">{subtitle}</p>
      <div className="btns">
        <button
          ref={yesRef}
          type="button"
          className="btn btn-yes"
          style={{ transform: `scale(${scale})` }}
          onClick={onYes}
        >
          Да 💕
        </button>
        <RunawayButton avoidRef={yesRef} onEscape={onEscape} />
      </div>
    </section>
  );
}
