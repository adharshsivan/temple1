import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VediDock from './VediPanel';
import { HudState, TempleEngine } from './three/engine';

const SPOT_LABELS: [string, string][] = [
  ['gate', 'Main Gate'],
  ['forecourt', 'Deepastambham'],
  ['mandapam', 'Mandapam'],
  ['sanctum', 'Sreekovil'],
  ['murals', 'Murals'],
  ['chuttu', 'Chuttuvilakku'],
  ['hall', 'Side Hall'],
  ['vazhipaadu', 'Vazhipaadu'],
  ['vedi', 'Kathina Vedi'],
  ['pond', 'Pond Reserve'],
  ['kulam', 'Temple Pond'],
];
const VIEW_LABELS: [string, string][] = [
  ['iso', 'Aerial'],
  ['plan', 'Plan'],
  ['front', 'Front'],
  ['vedi', 'Vedi'],
];

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </svg>
);

function Seg<T extends string>({
  value, options, onChange,
}: { value: T; options: { v: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="glass flex rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`chip flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide ${
            value === o.v ? 'bg-amber-200/90 text-stone-900 shadow' : 'text-stone-200 hover:bg-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Joystick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const id = useRef(-1);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 44;
  const upd = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    onChange(dx / R, -dy / R);
  };
  const end = (e: React.PointerEvent) => {
    if (e.pointerId !== id.current) return;
    id.current = -1;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };
  return (
    <div
      ref={base}
      className="glass relative h-[120px] w-[120px] rounded-full"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        upd(e);
      }}
      onPointerMove={(e) => e.pointerId === id.current && upd(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute left-1/2 top-1/2 h-[52px] w-[52px] rounded-full border border-amber-100/40 bg-amber-200/70 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

type MapData = ReturnType<TempleEngine['getMapData']>;

function MiniMap({ data, hud }: { data: MapData | null; hud: HudState | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = 214;
  const H = 180;
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !data) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cp = data.compound;
    const pp = data.pondPlot;
    const vp = data.vediPlot;
    const x0 = Math.min(cp.x0, pp.x0, vp.x0);
    const x1 = Math.max(cp.x1, pp.x1, vp.x1);
    const z0 = Math.min(cp.z0, pp.z0, vp.z0);
    const z1 = Math.max(cp.z1, pp.z1, vp.z1);
    const cw = x1 - x0;
    const ch = z1 - z0;
    const pad = 8;
    const s = Math.min((W - pad * 2) / cw, (H - pad * 2) / ch);
    const ox = (W - cw * s) / 2;
    const oy = (H - ch * s) / 2;
    const mx = (x: number) => ox + (x - x0) * s;
    const my = (z: number) => oy + (z - z0) * s;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#e9dfc8';
    g.fillRect(mx(cp.x0), my(cp.z0), (cp.x1 - cp.x0) * s, (cp.z1 - cp.z0) * s);
    g.fillRect(mx(pp.x0), my(pp.z0), (pp.x1 - pp.x0) * s, (pp.z1 - pp.z0) * s);
    // kathina vedi barrels in the open north ground (no enclosing wall, natural ground)
    g.fillStyle = '#2a2623';
    for (const b of data.vediBarrels) {
      g.beginPath();
      g.arc(mx(b.x), my(b.z), 2.2, 0, Math.PI * 2);
      g.fill();
    }
    // Continuous paved perimeter path around the pond plot's stepped water basin.
    const k = data.kulam;
    const kw = data.kulamWater;
    const wallW = 0.5;
    const pathW = 0.8;
    const copingW = 0.35;
    g.fillStyle = '#aaa69b';
    g.fillRect(mx(cp.x1), my(k.z0 - pathW), (k.x0 - copingW - cp.x1) * s, (k.z1 - k.z0 + pathW * 2) * s);
    g.fillRect(mx(k.x1 + copingW), my(k.z0 - pathW), (pp.x1 - wallW - (k.x1 + copingW)) * s, (k.z1 - k.z0 + pathW * 2) * s);
    g.fillRect(mx(k.x0 - copingW), my(k.z0 - copingW - pathW), (k.x1 - k.x0 + copingW * 2) * s, pathW * s);
    g.fillRect(mx(k.x0 - copingW), my(k.z1 + copingW), (k.x1 - k.x0 + copingW * 2) * s, pathW * s);
    g.strokeStyle = '#6a4a30';
    g.lineWidth = 2.5;
    g.strokeRect(mx(cp.x0), my(cp.z0), (cp.x1 - cp.x0) * s, (cp.z1 - cp.z0) * s);
    g.strokeRect(mx(pp.x0), my(pp.z0), (pp.x1 - pp.x0) * s, (pp.z1 - pp.z0) * s);
    // gate gap in the front wall
    g.fillStyle = '#e9dfc8';
    g.fillRect(mx(-4.25), my(cp.z1) - 3, 3.5 * s, 6);
    // pond doorway gap in the east wall
    const door = data.pondDoor;
    g.fillRect(mx(door.x0) - 2, my(door.z0), (door.x1 - door.x0) * s + 4, (door.z1 - door.z0) * s);
    // small opening in the north wall leading to the vedi ground
    const vd = data.vediDoor;
    g.fillRect(mx(vd.x0), my(vd.z0) - 2, (vd.x1 - vd.x0) * s, 5);
    // stepped kulam: stone rim + green water
    g.fillStyle = '#8d8578';
    g.fillRect(mx(k.x0), my(k.z0), (k.x1 - k.x0) * s, (k.z1 - k.z0) * s);
    g.fillStyle = '#3d9a3a';
    g.fillRect(mx(kw.x0), my(kw.z0), (kw.x1 - kw.x0) * s, (kw.z1 - kw.z0) * s);
    // pond reserve
    const r = data.reserved;
    g.setLineDash([4, 3]);
    g.strokeStyle = '#1b8fb0';
    g.fillStyle = 'rgba(70,170,200,0.22)';
    g.lineWidth = 1.5;
    g.fillRect(mx(r.x0), my(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    g.strokeRect(mx(r.x0), my(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    g.setLineDash([]);
    // footprints
    const col: Record<string, string> = { main: '#b4532e', aux: '#cf8a58', gate: '#7a5638', lamp: '#d8a52c' };
    for (const f of data.footprints) {
      g.fillStyle = col[f.kind] ?? '#b4532e';
      g.fillRect(mx(f.x0), my(f.z0), (f.x1 - f.x0) * s, (f.z1 - f.z0) * s);
      g.strokeStyle = 'rgba(40,24,12,0.7)';
      g.lineWidth = 1;
      g.strokeRect(mx(f.x0), my(f.z0), (f.x1 - f.x0) * s, (f.z1 - f.z0) * s);
    }
    // sreekovil highlight (drawn on top of the chuttambalam)
    // player / camera
    if (hud) {
      const px = Math.max(x0, Math.min(x1, hud.x));
      const pz = Math.max(z0, Math.min(z1 + 2, hud.z));
      const cx = mx(px);
      const cy = my(pz);
      const dx = -Math.sin(hud.yaw);
      const dy = -Math.cos(hud.yaw);
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.atan2(dy, dx) + Math.PI / 2);
      g.fillStyle = hud.mode === 'walk' ? '#ffffff' : '#ffe08a';
      g.strokeStyle = '#2a1a0c';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 6);
      g.lineTo(0, 3);
      g.lineTo(-5, 6);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    g.fillStyle = '#4a3320';
    g.font = '600 9px ui-sans-serif, system-ui';
    g.fillText('N ↑', 6, 12);
  }, [data, hud]);
  return <canvas ref={ref} style={{ width: W, height: H }} className="rounded-lg" />;
}

export default function App() {
  const holder = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TempleEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [map, setMap] = useState<MapData | null>(null);
  const [night, setNight] = useState(false);
  const [pond, setPond] = useState(false);
  const [info, setInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState(false);
  const [exporting, setExporting] = useState(false);
  const touch = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);

  useEffect(() => {
    if (!holder.current) return;
    let eng: TempleEngine | null = null;
    const id = requestAnimationFrame(() => {
      try {
        eng = new TempleEngine(holder.current!, setHud);
        engineRef.current = eng;
        setMap(eng.getMapData());
        setReady(true);
      } catch (e) {
        console.error(e);
        setError('Your browser could not start WebGL. Please try a recent Chrome, Edge, Safari or Firefox.');
      }
    });
    return () => {
      cancelAnimationFrame(id);
      if (eng) eng.dispose();
      engineRef.current = null;
    };
  }, []);

  const mode = hud?.mode ?? 'orbit';

  const toggleNight = useCallback((v?: boolean) => {
    setNight((n) => {
      const nv = v ?? !n;
      engineRef.current?.setNight(nv);
      return nv;
    });
  }, []);

  const setMode = useCallback((m: 'orbit' | 'walk') => engineRef.current?.setMode(m), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      if (e.code === 'KeyN') toggleNight();
      else if (e.code === 'KeyV') eng.setMode(eng.getMode() === 'walk' ? 'orbit' : 'walk');
      else if (e.code === 'Escape') eng.setMode('orbit');
      else if (e.code === 'KeyP') setPond((p) => { eng.setPondMarker(!p); return !p; });
      else if (e.code === 'Digit1') eng.setView('iso');
      else if (e.code === 'Digit2') eng.setView('plan');
      else if (e.code === 'Digit3') eng.setView('front');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleNight]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0f1a] text-stone-100">
      <div ref={holder} className="absolute inset-0" />

      {!ready && !error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0b0f1a] text-stone-300">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200/20 border-t-amber-200" />
          <p className="font-serif text-lg tracking-wide">Raising the temple…</p>
          <p className="mt-1 text-xs text-stone-500">Generating textures · merging geometry</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0f1a] p-8 text-center text-stone-300">
          <p className="max-w-sm text-sm">{error}</p>
        </div>
      )}

      {/* title card */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[50vw] sm:left-5 sm:top-5 sm:max-w-[380px]">
        <div className="glass pointer-events-auto rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-200/80 sm:text-[10px]">Kerala village temple · Chuttuvilakku</p>
          <h1 className="mt-1 font-serif text-[14px] font-semibold leading-snug text-amber-50 sm:text-xl">
            Lokam Sree Thiruvaazhikulam Devi Kshethram
          </h1>
          <p className="mt-1.5 hidden text-[11px] leading-relaxed text-stone-300/90 sm:block">
            35 × 29 m compound · East kulam plot · Central Deepastambham
          </p>
          <button onClick={() => setInfo((v) => !v)} className="chip mt-2 text-[11px] font-medium text-amber-200/90 underline-offset-2 hover:underline">
            {info ? 'Hide layout' : 'Show layout'}
          </button>
          {info && (
            <ul className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px] text-stone-300">
              <li><span className="text-amber-200/90">Chuttuvilakku ·</span> Continuous rows of brass oil lamps mounted on timber framing along the perimeter walls</li>
              <li><span className="text-amber-200/90">Deepastambham ·</span> 5-tier central brass lamp in the forecourt as primary visual focal point</li>
              <li><span className="text-amber-200/90">Axis ·</span> Gate → forecourt → deepastambham → mandapam → chuttambalam → sreekovil</li>
              <li><span className="text-amber-200/90">Counter ·</span> Vazhipaadu counter with five open hatches and a serpentine queue pen, front-right courtyard</li>
              <li><span className="text-amber-200/90">Module ·</span> one procedural building system builds the shrine, stores, side hall, gate and counter</li>
              <li><span className="text-amber-200/90">Kulam ·</span> Open Padippura entry, stone walk on all four sides, and steps down to the pond floor</li>
              <li><span className="text-amber-200/90">Reserve ·</span> 10 × 6 m zone inside the compound kept clear (not built)</li>
              <li><span className="text-amber-200/90">Keys ·</span> N night · V walk/aerial · P pond zone · 1-2-3 views</li>
            </ul>
          )}
        </div>
      </div>

      {/* top-right controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
        <Seg
          value={night ? 'night' : 'day'}
          onChange={(v) => toggleNight(v === 'night')}
          options={[
            { v: 'day', label: (<><SunIcon /> Day</>) },
            { v: 'night', label: (<><MoonIcon /> Night</>) },
          ]}
        />
        <Seg
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { v: 'orbit', label: 'Aerial' },
            { v: 'walk', label: 'Walk' },
          ]}
        />
        <button
          onClick={() => setPond((p) => { engineRef.current?.setPondMarker(!p); return !p; })}
          className={`chip glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium ${pond ? 'text-amber-200' : 'text-stone-300'}`}
        >
          <span className={`h-2 w-2 rounded-full ${pond ? 'bg-amber-300' : 'bg-stone-500'}`} />
          Pond zone<span className="hidden sm:inline"> · 10×6 m</span>
        </button>
        <button
          onClick={async () => {
            setExporting(true);
            await engineRef.current?.exportGLB();
            setExporting(false);
          }}
          className="chip glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-stone-300 hover:text-amber-100"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
          </svg>
          {exporting ? 'Exporting…' : <>GLB<span className="hidden sm:inline"> export</span></>}
        </button>
        <VediDock
          heat={hud?.vedi.heat ?? []}
          pending={hud?.vedi.pending ?? 0}
          bottom={touch && mode === 'walk' ? 224 : 140}
          onFire={(m, n, s) => engineRef.current?.vediFire(m, n, s)}
          onStop={() => engineRef.current?.vediStop()}
          onSound={(on) => engineRef.current?.setVediSound(on)}
          onGoto={() => engineRef.current?.goto('vedi')}
        />
      </div>

      {/* bottom chips */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-2 sm:bottom-5">
        <div className="glass pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2">
          {mode === 'orbit'
            ? VIEW_LABELS.map(([k, l]) => (
                <button key={k} onClick={() => engineRef.current?.setView(k)} className="chip rounded-full bg-white/5 px-3 py-1 text-xs text-stone-100 hover:bg-amber-200/90 hover:text-stone-900">
                  {l}
                </button>
              ))
            : null}
          {mode === 'orbit' && <span className="mx-1 h-4 w-px bg-white/15" />}
          <span className="px-1 text-[10px] uppercase tracking-widest text-stone-400">Go to</span>
          {SPOT_LABELS.map(([k, l]) => (
            <button key={k} onClick={() => engineRef.current?.goto(k)} className="chip rounded-full bg-white/5 px-3 py-1 text-xs text-stone-100 hover:bg-amber-200/90 hover:text-stone-900">
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* minimap + stats */}
      <div className="absolute bottom-[88px] right-3 z-10 sm:bottom-[76px] sm:right-5">
        <div className="glass rounded-xl p-1.5">
          <MiniMap data={map} hud={hud} />
          <div className="mt-1 flex items-center justify-between px-1 text-[9px] uppercase tracking-wider text-stone-400">
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 border border-dashed border-cyan-400 bg-cyan-400/30" />pond zone</span>
            <span>{hud ? `${hud.calls} calls · ${(hud.tris / 1000).toFixed(0)}k tris · ${hud.fps} fps` : ''}</span>
          </div>
        </div>
      </div>

      {/* walk helpers */}
      {mode === 'walk' && (
        <>
          <div className="pointer-events-none absolute bottom-[88px] left-3 z-10 sm:bottom-[76px] sm:left-5">
            {touch ? (
              <div className="pointer-events-auto flex items-end gap-3">
                <Joystick onChange={(x, y) => engineRef.current?.setJoystick(x, y)} />
                <button
                  onClick={() => { setRun((r) => { engineRef.current?.setRun(!r); return !r; }); }}
                  className={`chip glass mb-1 rounded-full px-4 py-2 text-xs font-medium ${run ? 'bg-amber-200/90 text-stone-900' : 'text-stone-200'}`}
                >
                  Run
                </button>
              </div>
            ) : (
              <div className="glass rounded-xl px-3 py-2 text-[11px] leading-relaxed text-stone-300">
                <b className="text-amber-200/90">WASD</b> move · <b className="text-amber-200/90">drag</b> look · <b className="text-amber-200/90">Shift</b> run
                <br />
                <b className="text-amber-200/90">←/→</b> turn · <b className="text-amber-200/90">Esc</b> aerial
              </div>
            )}
          </div>
        </>
      )}
      {mode === 'orbit' && (
        <div className="pointer-events-none absolute bottom-[88px] left-3 z-10 hidden sm:bottom-[76px] sm:left-5 sm:block">
          <div className="glass rounded-xl px-3 py-2 text-[11px] leading-relaxed text-stone-300">
            <b className="text-amber-200/90">Drag</b> orbit · <b className="text-amber-200/90">scroll</b> zoom · <b className="text-amber-200/90">right-drag</b> pan
          </div>
        </div>
      )}
    </div>
  );
}
