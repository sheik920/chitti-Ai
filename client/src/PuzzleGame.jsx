import { useState, useEffect, useCallback, useRef } from 'react';
import { X, RotateCcw, Trophy, Timer, Shuffle, Gamepad2, ChevronUp, Zap } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

const SIZE_MAP = { easy: 3, medium: 4, hard: 5 };

function buildSolved(n) {
  return [...Array(n * n).keys()].map(i => (i === n * n - 1 ? 0 : i + 1));
}

function isSolvable(tiles, n) {
  const arr = tiles.filter(x => x !== 0);
  let inversions = 0;
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      if (arr[i] > arr[j]) inversions++;
  if (n % 2 === 1) return inversions % 2 === 0;
  const blankRow = Math.floor(tiles.indexOf(0) / n);
  const rowFromBottom = n - blankRow;
  return rowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0;
}

function shuffle(n) {
  let tiles;
  do {
    tiles = [...buildSolved(n)].sort(() => Math.random() - 0.5);
  } while (!isSolvable(tiles, n) || JSON.stringify(tiles) === JSON.stringify(buildSolved(n)));
  return tiles;
}

function isSolved(tiles, n) {
  const goal = buildSolved(n);
  return tiles.every((v, i) => v === goal[i]);
}

function getNeighbours(idx, n) {
  const row = Math.floor(idx / n), col = idx % n, nb = [];
  if (row > 0) nb.push(idx - n);
  if (row < n - 1) nb.push(idx + n);
  if (col > 0) nb.push(idx - 1);
  if (col < n - 1) nb.push(idx + 1);
  return nb;
}

function fmt(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: Math.random() * 8 + 4,
      color: `hsl(${Math.random() * 360},80%,60%)`,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      angle: Math.random() * 360,
      spin: (Math.random() - 0.5) * 8,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
        ctx.restore();
        p.x += p.vx; p.y += p.vy; p.angle += p.spin;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }} />;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PuzzleGame({ onClose }) {
  const [difficulty, setDifficulty] = useState('medium');
  const [tiles, setTiles] = useState(() => shuffle(SIZE_MAP['medium']));
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(true);
  const [won, setWon] = useState(false);
  const [bestScores, setBestScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('puzzle_best') || '{}'); } catch { return {}; }
  });
  const [animIdx, setAnimIdx] = useState(null);
  const [shake, setShake] = useState(false);

  const n = SIZE_MAP[difficulty];

  // Timer
  useEffect(() => {
    if (!running || won) return;
    const id = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [running, won]);

  const startNew = useCallback((diff = difficulty) => {
    const size = SIZE_MAP[diff];
    setTiles(shuffle(size));
    setMoves(0);
    setTime(0);
    setWon(false);
    setRunning(true);
    setAnimIdx(null);
  }, [difficulty]);

  const changeDiff = (d) => {
    setDifficulty(d);
    startNew(d);
  };

  const moveTile = (idx) => {
    if (won) return;
    const blankIdx = tiles.indexOf(0);
    if (!getNeighbours(blankIdx, n).includes(idx)) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setAnimIdx(idx);
    setTimeout(() => setAnimIdx(null), 180);
    const next = [...tiles];
    [next[blankIdx], next[idx]] = [next[idx], next[blankIdx]];
    const newMoves = moves + 1;
    setTiles(next);
    setMoves(newMoves);
    if (isSolved(next, n)) {
      setWon(true);
      setRunning(false);
      // Save best score
      const key = difficulty;
      const score = { moves: newMoves, time };
      const current = bestScores[key];
      if (!current || newMoves < current.moves || (newMoves === current.moves && time < current.time)) {
        const updated = { ...bestScores, [key]: score };
        setBestScores(updated);
        localStorage.setItem('puzzle_best', JSON.stringify(updated));
      }
    }
  };

  const handleKeyDown = useCallback((e) => {
    const blankIdx = tiles.indexOf(0);
    const blankRow = Math.floor(blankIdx / n);
    const blankCol = blankIdx % n;
    let target = null;
    if (e.key === 'ArrowUp'    && blankRow < n - 1) target = blankIdx + n;
    if (e.key === 'ArrowDown'  && blankRow > 0)     target = blankIdx - n;
    if (e.key === 'ArrowLeft'  && blankCol < n - 1) target = blankIdx + 1;
    if (e.key === 'ArrowRight' && blankCol > 0)     target = blankIdx - 1;
    if (target !== null) { e.preventDefault(); moveTile(target); }
  }, [tiles, n, won]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const best = bestScores[difficulty];

  // Tile color based on position proximity to correct
  const tileColor = (val, idx) => {
    if (val === 0) return 'transparent';
    const correct = val - 1; // correct index
    const dist = Math.abs(Math.floor(idx / n) - Math.floor(correct / n)) + Math.abs((idx % n) - (correct % n));
    if (dist === 0) return 'linear-gradient(145deg, #10b981, #059669)';
    if (dist <= 1) return 'linear-gradient(145deg, #3b82f6, #2563eb)';
    if (dist <= 2) return 'linear-gradient(145deg, #8b5cf6, #6d28d9)';
    if (dist <= 4) return 'linear-gradient(145deg, #f59e0b, #d97706)';
    return 'linear-gradient(145deg, #ef4444, #b91c1c)';
  };

  const tileSize = n === 3 ? 96 : n === 4 ? 78 : 62;
  const gap = n === 3 ? 8 : n === 4 ? 6 : 5;

  return (
    <>
      {won && <Confetti />}

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Modal */}
        <div
          onClick={e => e.stopPropagation()}
          className={`puzzle-modal${shake ? ' puzzle-shake' : ''}`}
          style={{
            background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 24,
            padding: '28px 24px',
            width: '100%',
            maxWidth: 520,
            maxHeight: '95vh',
            overflowY: 'auto',
            boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 60px rgba(139,92,246,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            animation: 'puzzleModalIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
          }}
        >
          {/* Header */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Gamepad2 size={22} color="#a78bfa" />
              <span style={{ fontSize: '1.3rem', fontWeight: 700, background: 'linear-gradient(to right,#fff,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Sliding Puzzle
              </span>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#94a3b8', cursor: 'pointer', padding: '6px 10px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Difficulty Tabs */}
          <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 4 }}>
            {['easy', 'medium', 'hard'].map(d => (
              <button
                key={d}
                onClick={() => changeDiff(d)}
                style={{
                  padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                  background: difficulty === d ? 'linear-gradient(145deg,#7c3aed,#4f46e5)' : 'transparent',
                  color: difficulty === d ? 'white' : '#64748b',
                  boxShadow: difficulty === d ? '0 4px 12px rgba(124,58,237,0.4)' : 'none',
                }}
              >
                {d === 'easy' ? '3×3' : d === 'medium' ? '4×4' : '5×5'} {d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { icon: <Timer size={15} />, label: 'Time', val: fmt(time), color: '#38bdf8' },
              { icon: <ChevronUp size={15} />, label: 'Moves', val: moves, color: '#a78bfa' },
              { icon: <Trophy size={15} />, label: 'Best', val: best ? `${best.moves}m ${fmt(best.time)}` : '—', color: '#fbbf24' },
            ].map(({ icon, label, val, color }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(0,0,0,0.35)', borderRadius: 12,
                padding: '8px 14px', border: '1px solid rgba(255,255,255,0.06)',
                flex: '1 0 auto', minWidth: 100,
              }}>
                <span style={{ color }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: '0.92rem', color: 'white', fontWeight: 700 }}>{val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Win Banner */}
          {won && (
            <div style={{
              background: 'linear-gradient(145deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))',
              border: '1px solid #10b981',
              borderRadius: 16, padding: '14px 24px', textAlign: 'center', width: '100%',
              animation: 'popIn3D 0.5s cubic-bezier(0.175,0.885,0.32,1.275)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🎉 Puzzle Solved!</div>
              <div style={{ color: '#6ee7b7', fontSize: '0.9rem' }}>
                Completed in <strong>{moves} moves</strong> and <strong>{fmt(time)}</strong>
              </div>
            </div>
          )}

          {/* Board */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${n}, ${tileSize}px)`,
            gap,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 18,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
          }}>
            {tiles.map((val, idx) => (
              <button
                key={`${idx}-${val}`}
                onClick={() => val !== 0 && moveTile(idx)}
                style={{
                  width: tileSize, height: tileSize,
                  borderRadius: n <= 4 ? 12 : 8,
                  border: val === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  cursor: val === 0 ? 'default' : 'pointer',
                  background: tileColor(val, idx),
                  color: 'white',
                  fontSize: n === 3 ? '1.8rem' : n === 4 ? '1.4rem' : '1.1rem',
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: val === 0 ? 'inset 0 0 20px rgba(0,0,0,0.8)' : [
                    '4px 4px 10px rgba(0,0,0,0.6)',
                    '-2px -2px 6px rgba(255,255,255,0.1)',
                    'inset 2px 2px 5px rgba(255,255,255,0.25)',
                  ].join(','),
                  transition: 'all 0.13s cubic-bezier(0.175,0.885,0.32,1.275)',
                  transform: animIdx === idx ? 'scale(0.92) translateZ(5px)' : val !== 0 ? 'translateZ(0)' : 'none',
                  outline: 'none',
                  opacity: val === 0 ? 0 : 1,
                  userSelect: 'none',
                  textShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}
                onMouseEnter={e => { if (val !== 0) e.currentTarget.style.transform = 'scale(1.06) translateY(-2px)'; }}
                onMouseLeave={e => { if (val !== 0) e.currentTarget.style.transform = 'translateZ(0)'; }}
              >
                {val !== 0 ? val : ''}
              </button>
            ))}
          </div>

          {/* Hint */}
          <p style={{ color: '#475569', fontSize: '0.78rem', textAlign: 'center' }}>
            🖱️ Click tiles or use ← → ↑ ↓ arrow keys to move
          </p>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => startNew(difficulty)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(145deg,#7c3aed,#4f46e5)', color: 'white',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(124,58,237,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <Shuffle size={16} /> New Game
            </button>
            <button
              onClick={() => { setTiles(buildSolved(n)); setWon(true); setRunning(false); }}
              title="Auto-solve (peek answer)"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <Zap size={16} /> Solve
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes puzzleModalIn {
          from { opacity: 0; transform: scale(0.85) translateY(30px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .puzzle-shake {
          animation: puzzleShake 0.4s ease !important;
        }
        @keyframes puzzleShake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
      `}</style>
    </>
  );
}
