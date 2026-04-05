import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Keyboard, Timer, Zap, Trophy, RotateCcw, ChevronRight, Flame, Target } from 'lucide-react';

// ── Word Banks ────────────────────────────────────────────────────────────────
const BANKS = {
  easy: [
    'the quick brown fox jumps over the lazy dog',
    'practice makes perfect every single day',
    'keep calm and carry on typing fast',
    'a journey of a thousand miles begins with one step',
    'life is what happens when you are busy making plans',
    'in the middle of every difficulty lies opportunity',
    'success is not final failure is not fatal',
    'the only way to do great work is to love what you do',
    'be the change you wish to see in the world',
    'all our dreams can come true if we have the courage',
  ],
  medium: [
    'artificial intelligence is transforming the world at an unprecedented pace',
    'quantum computing promises to revolutionize cryptography and drug discovery',
    'the internet of things connects billions of devices across the globe daily',
    'machine learning algorithms can now detect diseases earlier than doctors',
    'blockchain technology ensures transparent and immutable digital transactions',
    'neural networks mimic the human brain to solve complex pattern recognition',
    'autonomous vehicles rely on LiDAR sensors and deep learning navigation',
    'cloud computing enables scalable infrastructure for modern applications',
    'cybersecurity threats evolve faster than traditional defense mechanisms',
    'augmented reality overlays digital information onto the physical world',
  ],
  hard: [
    'Photosynthesis converts solar energy into glucose through chlorophyll pigments in plant cells.',
    'Cryptographic hash functions generate fixed-length fingerprints from arbitrary data inputs.',
    'Neuroplasticity refers to the brain\'s ability to reorganize synaptic connections throughout life.',
    'Quantum entanglement enables instantaneous correlation between spatially separated particles.',
    'Mitochondrial DNA inheritance follows maternal lineage due to cytoplasmic transmission.',
    'Heisenberg\'s uncertainty principle states position and momentum cannot both be precisely known.',
    'Polymorphism in object-oriented programming allows objects to take on multiple forms.',
    'Electroencephalography measures spontaneous electrical activity produced by neuronal firing.',
    'Microprocessor architecture determines throughput via pipeline stages and cache hierarchies.',
    'Bioluminescence occurs when luciferin oxidizes in the presence of luciferase enzyme catalysts.',
  ],
};

const TIMES = { '30s': 30, '60s': 60, '120s': 120 };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Spark Particle ────────────────────────────────────────────────────────────
function Sparks({ active }) {
  return active ? (
    <div className="tg-sparks" aria-hidden>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="tg-spark" style={{ '--d': i }} />
      ))}
    </div>
  ) : null;
}

// ── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ wpm, accuracy, correct, incorrect, streak, best, onRetry, onClose, difficulty, duration }) {
  const grade =
    accuracy >= 98 && wpm >= 60 ? { label: 'S', color: '#fbbf24', msg: 'Legendary Typist! 🏆' } :
    accuracy >= 95 && wpm >= 45 ? { label: 'A', color: '#10b981', msg: 'Excellent! Keep it up 🎯' } :
    accuracy >= 90 && wpm >= 30 ? { label: 'B', color: '#38bdf8', msg: 'Great job! 👍' } :
    accuracy >= 80              ? { label: 'C', color: '#a78bfa', msg: 'Good effort! 💪' } :
                                  { label: 'D', color: '#f87171', msg: 'Keep practicing! 🔥' };

  return (
    <div className="tg-result" style={{ animation: 'tgSlideUp 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
      <div className="tg-grade" style={{ '--gc': grade.color }}>
        {grade.label}
      </div>
      <p className="tg-grade-msg">{grade.msg}</p>

      <div className="tg-stat-grid">
        {[
          { icon: <Zap size={18}/>, label: 'WPM', val: wpm,      sub: best ? `Best ${best.wpm}` : null, color: '#38bdf8' },
          { icon: <Target size={18}/>, label: 'Accuracy', val: `${accuracy}%`, color: '#10b981' },
          { icon: <ChevronRight size={18}/>, label: 'Correct', val: correct,   color: '#a78bfa' },
          { icon: <Flame size={18}/>, label: 'Best Streak', val: streak,      color: '#f59e0b' },
        ].map(({ icon, label, val, sub, color }) => (
          <div className="tg-stat-card" key={label}>
            <span style={{ color }}>{icon}</span>
            <div className="tg-stat-val" style={{ color }}>{val}</div>
            <div className="tg-stat-label">{label}</div>
            {sub && <div className="tg-stat-sub">{sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="tg-btn tg-btn-primary" onClick={onRetry}>
          <RotateCcw size={15} /> Try Again
        </button>
        <button className="tg-btn tg-btn-ghost" onClick={onClose}>
          <X size={15} /> Close
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TypingGame({ onClose }) {
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration]   = useState(60);
  const [phase, setPhase]         = useState('idle'); // idle | playing | done
  const [text, setText]           = useState('');
  const [typed, setTyped]         = useState('');
  const [timeLeft, setTimeLeft]   = useState(60);
  const [wpm, setWpm]             = useState(0);
  const [liveWpm, setLiveWpm]     = useState(0);
  const [accuracy, setAccuracy]   = useState(100);
  const [streak, setStreak]       = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [errors, setErrors]       = useState(0);
  const [combo, setCombo]         = useState(0);
  const [showSpark, setShowSpark] = useState(false);
  const [best, setBest]           = useState(() => {
    try { return JSON.parse(localStorage.getItem('typing_best') || 'null'); } catch { return null; }
  });

  const inputRef   = useRef(null);
  const startRef   = useRef(null);
  const comboTimer = useRef(null);

  // Derived character stats
  const correctCount = [...typed].filter((ch, i) => ch === text[i]).length;
  const errorCount   = [...typed].filter((ch, i) => ch !== text[i]).length;

  const loadText = useCallback((diff = difficulty) => {
    setText(pick(BANKS[diff]));
    setTyped('');
    setErrors(0);
    setStreak(0);
    setMaxStreak(0);
    setCombo(0);
    setLiveWpm(0);
    setWpm(0);
    setAccuracy(100);
  }, [difficulty]);

  const startGame = (diff = difficulty, dur = duration) => {
    loadText(diff);
    setTimeLeft(dur);
    setPhase('playing');
    startRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  // Countdown
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) { endGame(); return; }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft]);

  // Live WPM update every 500ms
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - (startRef.current || Date.now())) / 60000;
      if (elapsed > 0) setLiveWpm(Math.round(correctCount / 5 / elapsed));
    }, 500);
    return () => clearInterval(id);
  }, [phase, correctCount]);

  const endGame = useCallback(() => {
    const elapsed = (Date.now() - (startRef.current || Date.now())) / 60000;
    const finalWpm = Math.round(correctCount / 5 / Math.max(elapsed, 0.01));
    const total = typed.length || 1;
    const acc = Math.round((correctCount / total) * 100);
    setWpm(finalWpm);
    setAccuracy(acc);
    setPhase('done');
    // Save best
    if (!best || finalWpm > best.wpm) {
      const nb = { wpm: finalWpm, acc };
      setBest(nb);
      localStorage.setItem('typing_best', JSON.stringify(nb));
    }
  }, [correctCount, typed, best]);

  const handleChange = (e) => {
    if (phase !== 'playing') return;
    const val = e.target.value;
    if (val.length > text.length) return;

    const prev = typed;
    setTyped(val);

    // Streak / combo logic
    const lastChar = val[val.length - 1];
    const expected = text[val.length - 1];
    if (lastChar === expected) {
      setStreak(s => {
        const ns = s + 1;
        setMaxStreak(m => Math.max(m, ns));
        return ns;
      });
      setCombo(c => {
        const nc = c + 1;
        if (nc % 10 === 0) { setShowSpark(true); setTimeout(() => setShowSpark(false), 600); }
        return nc;
      });
    } else {
      setStreak(0);
      setErrors(er => er + 1);
      clearTimeout(comboTimer.current);
      comboTimer.current = setTimeout(() => setCombo(0), 1500);
    }

    // Finished the text
    if (val.length === text.length) {
      endGame();
    }
  };

  const timerPercent = (timeLeft / duration) * 100;
  const timerColor   = timeLeft > duration * 0.5 ? '#10b981' : timeLeft > duration * 0.2 ? '#f59e0b' : '#ef4444';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(145deg,#12122a,#0e0e20)',
            border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 24, padding: '28px 28px',
            width: '100%', maxWidth: 700, maxHeight: '95vh', overflowY: 'auto',
            boxShadow: '0 40px 100px rgba(0,0,0,0.95), 0 0 80px rgba(56,189,248,0.08)',
            display: 'flex', flexDirection: 'column', gap: 20,
            animation: 'tgModalIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Keyboard size={22} color="#38bdf8" />
              <span style={{
                fontSize: '1.4rem', fontWeight: 700,
                background: 'linear-gradient(to right,#fff,#38bdf8)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Typing Speed</span>
              {combo >= 5 && phase === 'playing' && (
                <div className="tg-combo-badge">
                  <Flame size={13} /> {combo}x COMBO
                  <Sparks active={showSpark} />
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#94a3b8', cursor: 'pointer', padding: '6px 10px',
                display: 'flex', alignItems: 'center', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            ><X size={18} /></button>
          </div>

          {/* Config row */}
          {phase !== 'playing' && phase !== 'done' && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {/* Difficulty */}
              <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 4 }}>
                {Object.keys(BANKS).map(d => (
                  <button key={d} className={`tg-tab ${difficulty === d ? 'tg-tab-active' : ''}`}
                    onClick={() => { setDifficulty(d); loadText(d); }}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
              {/* Duration */}
              <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 4 }}>
                {Object.entries(TIMES).map(([label, val]) => (
                  <button key={label} className={`tg-tab ${duration === val ? 'tg-tab-active' : ''}`}
                    onClick={() => setDuration(val)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timer bar (playing) */}
          {phase === 'playing' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                flex: 1, height: 6, background: 'rgba(255,255,255,0.06)',
                borderRadius: 99, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 99, transition: 'width 1s linear, background 0.5s',
                  width: `${timerPercent}%`,
                  background: `linear-gradient(to right, ${timerColor}, ${timerColor}88)`,
                  boxShadow: `0 0 10px ${timerColor}`,
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 60 }}>
                <Timer size={14} color={timerColor} />
                <span style={{ color: timerColor, fontWeight: 700, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums' }}>
                  {timeLeft}s
                </span>
              </div>
              {/* Live stats */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>{liveWpm}</div>
                  <div style={{ fontSize: '0.65rem', color: '#475569' }}>WPM</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: streak >= 10 ? '#fbbf24' : '#a78bfa' }}>{streak}</div>
                  <div style={{ fontSize: '0.65rem', color: '#475569' }}>STREAK</div>
                </div>
              </div>
            </div>
          )}

          {/* Result or Text + Input */}
          {phase === 'done' ? (
            <ResultCard
              wpm={wpm} accuracy={accuracy}
              correct={correctCount} incorrect={errorCount}
              streak={maxStreak} best={best}
              difficulty={difficulty} duration={duration}
              onRetry={() => startGame(difficulty, duration)}
              onClose={onClose}
            />
          ) : (
            <>
              {/* Text Display */}
              <div className="tg-text-box">
                {text.split('').map((ch, i) => {
                  let cls = 'tg-char';
                  if (i < typed.length) {
                    cls += typed[i] === ch ? ' tg-correct' : ' tg-wrong';
                  } else if (i === typed.length) {
                    cls += ' tg-cursor';
                  }
                  return (
                    <span key={i} className={cls}>
                      {ch === ' ' ? '\u00A0' : ch}
                    </span>
                  );
                })}
              </div>

              {/* Input */}
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={typed}
                  onChange={handleChange}
                  disabled={phase !== 'playing'}
                  placeholder={phase === 'idle' ? 'Press Start to begin...' : ''}
                  className="tg-input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {phase === 'playing' && (
                  <div className="tg-input-accent" />
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {phase === 'idle' ? (
                  <button className="tg-btn tg-btn-primary tg-btn-lg" onClick={() => startGame()}>
                    <Zap size={17} /> Start Typing
                  </button>
                ) : (
                  <>
                    <button className="tg-btn tg-btn-primary" onClick={() => startGame()}>
                      <RotateCcw size={15} /> Restart
                    </button>
                    <button className="tg-btn tg-btn-ghost" onClick={() => { setPhase('idle'); loadText(); }}>
                      New Text
                    </button>
                  </>
                )}
                {best && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#fbbf24', fontSize: '0.82rem' }}>
                    <Trophy size={14} /> Best: {best.wpm} WPM / {best.acc}%
                  </div>
                )}
              </div>

              {/* Progress bar (chars) */}
              {phase === 'playing' && (
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(to right,#7c3aed,#38bdf8)',
                    width: `${(typed.length / text.length) * 100}%`,
                    transition: 'width 0.1s',
                    boxShadow: '0 0 8px #38bdf8',
                  }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tgModalIn {
          from { opacity:0; transform: scale(0.88) translateY(24px); }
          to   { opacity:1; transform: scale(1)    translateY(0); }
        }
        @keyframes tgSlideUp {
          from { opacity:0; transform: translateY(20px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes tgCursorBlink {
          0%,100% { opacity:1; } 50% { opacity:0; }
        }
        @keyframes tgSparkFly {
          0%   { transform: translate(0,0) scale(1); opacity:1; }
          100% { transform: translate(var(--tx,20px),var(--ty,-30px)) scale(0); opacity:0; }
        }
        @keyframes tgGradeIn {
          from { transform: scale(0.5) rotateY(90deg); opacity:0; }
          to   { transform: scale(1)   rotateY(0deg);  opacity:1; }
        }

        .tg-text-box {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 22px 24px;
          font-size: 1.25rem;
          line-height: 2.1;
          letter-spacing: 0.03em;
          font-family: 'Outfit', monospace;
          min-height: 120px;
          word-break: break-word;
          box-shadow: inset 0 0 30px rgba(0,0,0,0.5);
          user-select: none;
        }

        .tg-char            { color: #374151; transition: color 0.05s; }
        .tg-correct         { color: #34d399; text-shadow: 0 0 8px rgba(52,211,153,0.5); }
        .tg-wrong           {
          color: #f87171;
          background: rgba(248,113,113,0.12);
          border-radius: 3px;
          text-shadow: 0 0 6px rgba(248,113,113,0.6);
          animation: tgWrongFlash 0.15s ease;
        }
        @keyframes tgWrongFlash {
          from { background: rgba(248,113,113,0.35); }
          to   { background: rgba(248,113,113,0.12); }
        }
        .tg-cursor {
          color: white;
          border-left: 2px solid #38bdf8;
          margin-left: -1px;
          padding-left: 1px;
          animation: tgCursorBlink 0.8s infinite;
          text-shadow: 0 0 10px #38bdf8;
        }

        .tg-input {
          width: 100%;
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(56,189,248,0.2);
          border-radius: 14px;
          padding: 14px 18px;
          color: white;
          font-size: 1.05rem;
          font-family: 'Outfit', monospace;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.4);
          letter-spacing: 0.05em;
        }
        .tg-input:focus {
          border-color: rgba(56,189,248,0.5);
          box-shadow: 0 0 20px rgba(56,189,248,0.1), inset 0 0 20px rgba(0,0,0,0.4);
        }
        .tg-input:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .tg-input-accent {
          height: 2px;
          background: linear-gradient(to right,#7c3aed,#38bdf8,#10b981);
          border-radius: 99px;
          margin-top: 4px;
          animation: tgAccentPulse 2s infinite;
        }
        @keyframes tgAccentPulse {
          0%,100% { opacity:0.6; } 50% { opacity:1; }
        }

        .tg-tab {
          padding: 7px 14px; border-radius: 9px; border: none; cursor: pointer;
          font-size: 0.84rem; font-weight: 600; transition: all 0.2s;
          background: transparent; color: #64748b; font-family: 'Outfit', sans-serif;
        }
        .tg-tab-active {
          background: linear-gradient(145deg,#0ea5e9,#4f46e5) !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(14,165,233,0.35);
        }
        .tg-tab:hover:not(.tg-tab-active) { color: #94a3b8; background: rgba(255,255,255,0.04); }

        .tg-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 12px; border: none;
          font-weight: 600; font-size: 0.9rem; cursor: pointer;
          font-family: 'Outfit', sans-serif; transition: all 0.2s;
        }
        .tg-btn-primary {
          background: linear-gradient(145deg,#0ea5e9,#4f46e5);
          color: white;
          box-shadow: 0 6px 20px rgba(14,165,233,0.35);
        }
        .tg-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(14,165,233,0.5); }
        .tg-btn-primary:active { transform: translateY(1px); }
        .tg-btn-ghost {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #94a3b8;
        }
        .tg-btn-ghost:hover { background: rgba(255,255,255,0.1); color: white; }
        .tg-btn-lg { padding: 14px 28px; font-size: 1.05rem; border-radius: 14px; }

        .tg-combo-badge {
          position: relative;
          display: flex; align-items: center; gap: 5px;
          background: linear-gradient(145deg,#f59e0b,#ef4444);
          color: white; font-size: 0.75rem; font-weight: 800;
          padding: 4px 10px; border-radius: 99px;
          box-shadow: 0 0 16px rgba(245,158,11,0.5);
          animation: tgComboPop 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
          letter-spacing: 0.05em;
        }
        @keyframes tgComboPop {
          from { transform: scale(0.7); } to { transform: scale(1); }
        }

        .tg-sparks { position:absolute; top:50%; left:50%; pointer-events:none; }
        .tg-spark {
          position:absolute; width:6px; height:6px; border-radius:50%;
          background: #fbbf24;
          --tx: calc(cos(calc(var(--d) * 60deg)) * 30px);
          --ty: calc(sin(calc(var(--d) * 60deg)) * -30px);
          animation: tgSparkFly 0.6s ease forwards;
          animation-delay: calc(var(--d) * 0.04s);
        }

        /* Result */
        .tg-result {
          display: flex; flex-direction: column; align-items: center; gap: 20px;
          padding: 10px 0;
        }
        .tg-grade {
          width: 90px; height: 90px; border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, white 0%, var(--gc) 60%);
          display: flex; align-items: center; justify-content: center;
          font-size: 2.6rem; font-weight: 900; color: white;
          box-shadow: 0 0 40px var(--gc), 0 0 80px color-mix(in srgb,var(--gc),transparent 70%);
          animation: tgGradeIn 0.6s cubic-bezier(0.175,0.885,0.32,1.275) 0.1s both;
          text-shadow: 0 2px 10px rgba(0,0,0,0.4);
        }
        .tg-grade-msg {
          font-size: 1.1rem; font-weight: 600; color: #e2e8f0; text-align: center;
        }
        .tg-stat-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 10px; width: 100%;
        }
        .tg-stat-card {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 16px;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .tg-stat-val { font-size: 1.8rem; font-weight: 800; }
        .tg-stat-label { font-size: 0.72rem; color: #475569; font-weight: 600; letter-spacing: 0.1em; }
        .tg-stat-sub { font-size: 0.72rem; color: #64748b; }
      `}</style>
    </>
  );
}
