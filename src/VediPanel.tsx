import { useEffect, useState } from 'react';

export type VediMode = 'one' | 'salvo' | 'interval';

interface DockProps {
  heat: number[];
  pending: number;
  /** distance of the panel from the bottom of the viewport (px) */
  bottom: number;
  onFire: (mode: VediMode, count: number, interval: number) => void;
  onStop: () => void;
  onSound: (on: boolean) => void;
  onGoto: () => void;
}

const MODES: { v: VediMode; label: string; hint: (n: number, s: number) => string }[] = [
  { v: 'one', label: 'One shot', hint: () => 'Fires the next barrel in the row.' },
  { v: 'salvo', label: 'Salvo', hint: (n) => `${n} barrel${n > 1 ? 's' : ''} go off in a quick ripple.` },
  { v: 'interval', label: 'Interval', hint: (n, s) => `${n} barrel${n > 1 ? 's' : ''}, one every ${s.toFixed(1)} s.` },
];

/** Top-right toggle chip + the floating Kathina Vedi control panel (self-contained). */
export default function VediDock(p: DockProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<VediMode>('salvo');
  const [count, setCount] = useState(5);
  const [interval, setIntervalS] = useState(1.0);
  const [sound, setSound] = useState(true);
  const { onFire } = p;

  // F fires with the current settings while the panel is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' && !e.repeat) {
        e.preventDefault();
        onFire(mode, count, interval);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, count, interval, onFire]);

  const cur = MODES.find((m) => m.v === mode)!;
  const label = mode === 'one' ? 'Fire' : mode === 'salvo' ? `Fire ${count}` : `Start ${count}`;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`chip glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium ${open ? 'text-orange-200' : 'text-stone-300'}`}
      >
        <span className={`h-2 w-2 rounded-full ${open ? 'bg-orange-400' : 'bg-stone-500'}`} />
        Kathina Vedi
      </button>

      {open && (
        <div
          className="glass fixed left-3 z-20 w-[min(300px,calc(100vw-1.5rem))] rounded-2xl p-3 sm:left-5"
          style={{ bottom: p.bottom }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">Ritual</p>
              <h2 className="font-serif text-base font-semibold leading-tight text-amber-50">Kathina Vedi</h2>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="chip -mr-1 -mt-1 rounded-full px-2 py-1 text-stone-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="mt-2 flex rounded-full bg-black/25 p-0.5">
            {MODES.map((m) => (
              <button
                key={m.v}
                onClick={() => setMode(m.v)}
                className={`chip flex-1 rounded-full px-2 py-1.5 text-[11px] font-medium ${
                  mode === m.v ? 'bg-amber-200/90 text-stone-900' : 'text-stone-300 hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2.5">
            <label className={`block ${mode === 'one' ? 'pointer-events-none opacity-40' : ''}`}>
              <span className="flex justify-between text-[11px] text-stone-300">
                <span>Barrels</span>
                <b className="text-amber-200">{mode === 'one' ? 1 : count} / 10</b>
              </span>
              <input
                type="range" min={1} max={10} step={1} value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1 h-1 w-full cursor-pointer accent-amber-300"
              />
            </label>
            <label className={`block ${mode === 'interval' ? '' : 'pointer-events-none opacity-40'}`}>
              <span className="flex justify-between text-[11px] text-stone-300">
                <span>Interval</span>
                <b className="text-amber-200">{interval.toFixed(1)} s</b>
              </span>
              <input
                type="range" min={0.3} max={4} step={0.1} value={interval}
                onChange={(e) => setIntervalS(Number(e.target.value))}
                className="mt-1 h-1 w-full cursor-pointer accent-amber-300"
              />
            </label>
          </div>

          <p className="mt-2 text-[11px] leading-snug text-stone-400">{cur.hint(mode === 'one' ? 1 : count, interval)}</p>

          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => onFire(mode, count, interval)}
              className="chip flex-1 rounded-xl bg-gradient-to-b from-amber-300 to-orange-500 px-3 py-2 text-sm font-semibold text-stone-900 shadow-lg shadow-orange-900/40"
            >
              {label}
              <span className="ml-1.5 hidden rounded bg-black/15 px-1 text-[10px] font-medium sm:inline">F</span>
            </button>
            {p.pending > 0 && (
              <button onClick={p.onStop} className="chip rounded-xl bg-red-500/80 px-3 py-2 text-sm font-semibold text-white">
                Stop · {p.pending}
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1">
              {p.heat.map((h, i) => (
                <span
                  key={i}
                  className="h-3.5 w-3.5 rounded-full border border-white/10 transition-colors"
                  style={{
                    background: `rgba(255,${Math.round(110 + 60 * (1 - h))},40,${0.14 + 0.86 * h})`,
                    boxShadow: h > 0.45 ? `0 0 ${4 + 8 * h}px rgba(255,150,40,${0.8 * h})` : 'none',
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={p.onGoto} className="chip rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-stone-200 hover:bg-white/15">
                Go there
              </button>
              <button
                onClick={() => { const on = !sound; setSound(on); p.onSound(on); }}
                className={`chip rounded-full px-2.5 py-1 text-[11px] ${sound ? 'bg-amber-200/90 text-stone-900' : 'bg-white/5 text-stone-400'}`}
              >
                {sound ? 'Sound on' : 'Sound off'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-stone-500">Very loud: keep your volume low. Smoke drifts east.</p>
        </div>
      )}
    </>
  );
}
