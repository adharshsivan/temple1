import * as THREE from 'three';

/** Small deterministic PRNG so every load looks identical. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type G = CanvasRenderingContext2D;
type Rand = () => number;

function mk(size: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d') as G];
}

function finish(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function wrapDraw(size: number, x: number, y: number, r: number, fn: (x: number, y: number) => void) {
  const xs = [x];
  const ys = [y];
  if (x - r < 0) xs.push(x + size);
  if (x + r > size) xs.push(x - size);
  if (y - r < 0) ys.push(y + size);
  if (y + r > size) ys.push(y - size);
  for (const xx of xs) for (const yy of ys) fn(xx, yy);
}

/** Soft round blotches (stains, moss, mottling) that wrap around the tile edges. */
function blotch(
  g: G, size: number, rand: Rand, count: number, rMin: number, rMax: number,
  rgb: [number, number, number], aMin: number, aMax: number,
) {
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = rMin + rand() * (rMax - rMin);
    const a = aMin + rand() * (aMax - aMin);
    wrapDraw(size, x, y, r, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
      gr.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      g.fillStyle = gr;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
}

function speckle(g: G, size: number, rand: Rand, count: number, colors: string[], maxS = 2) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(rand() * colors.length)];
    g.fillRect(rand() * size, rand() * size, 1 + rand() * maxS, 1 + rand() * maxS);
  }
}

/** Clay (Mangalore-style) roof tiles: 5 courses x 5 columns per metre. */
export function makeTileTextures() {
  const S = 512;
  const n = 5;
  const cs = S / n;
  const rand = rng(11);
  const [c, g] = mk(S);
  const [cb, gb] = mk(S);
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, S, S);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * cs;
      const y = j * cs;
      const h = 10 + rand() * 9;
      const s = 56 + rand() * 16;
      const l = 37 + rand() * 11;
      g.fillStyle = `hsl(${h},${s}%,${l}%)`;
      g.fillRect(x, y, cs, cs);
      const gr = g.createLinearGradient(0, y, 0, y + cs);
      gr.addColorStop(0, 'rgba(25,8,4,0.62)');
      gr.addColorStop(0.28, 'rgba(25,8,4,0.12)');
      gr.addColorStop(0.8, 'rgba(255,190,140,0.10)');
      gr.addColorStop(0.93, 'rgba(20,6,2,0.15)');
      gr.addColorStop(1, 'rgba(10,3,1,0.72)');
      g.fillStyle = gr;
      g.fillRect(x, y, cs, cs);
      for (const f of [0.3, 0.7]) {
        g.fillStyle = 'rgba(20,6,2,0.30)';
        g.fillRect(x + cs * f - 2.5, y, 5, cs);
        g.fillStyle = 'rgba(255,200,160,0.10)';
        g.fillRect(x + cs * f + 2.5, y, 2.5, cs);
      }
      g.fillStyle = 'rgba(15,5,2,0.6)';
      g.fillRect(x, y, 2.5, cs);
      g.fillRect(x + cs - 2.5, y, 2.5, cs);

      // height map: rises toward the exposed lip, grooves cut in
      const bg = gb.createLinearGradient(0, y, 0, y + cs);
      bg.addColorStop(0, '#303030');
      bg.addColorStop(0.9, '#d8d8d8');
      bg.addColorStop(1, '#101010');
      gb.fillStyle = bg;
      gb.fillRect(x, y, cs, cs);
      gb.fillStyle = '#181818';
      for (const f of [0.3, 0.7]) gb.fillRect(x + cs * f - 3, y, 6, cs);
      gb.fillRect(x, y, 3, cs);
      gb.fillRect(x + cs - 3, y, 3, cs);
    }
  }
  blotch(g, S, rand, 70, 12, 46, [74, 92, 52], 0.10, 0.22); // moss
  blotch(g, S, rand, 50, 10, 40, [22, 16, 12], 0.10, 0.22); // soot / rain stains
  blotch(g, S, rand, 40, 14, 50, [214, 180, 146], 0.06, 0.14); // sun-faded dust
  speckle(g, S, rand, 5000, ['rgba(0,0,0,0.18)', 'rgba(255,220,190,0.14)', 'rgba(60,70,40,0.2)'], 2);
  return { map: finish(c), bump: finish(cb, false) };
}

/** Lime-washed plaster with rain streaks. 2 m per repeat. */
export function makeLimeTexture() {
  const S = 512;
  const rand = rng(23);
  const [c, g] = mk(S);
  g.fillStyle = '#e7e0cd';
  g.fillRect(0, 0, S, S);
  blotch(g, S, rand, 70, 40, 140, [190, 176, 146], 0.05, 0.12);
  blotch(g, S, rand, 40, 30, 110, [250, 246, 232], 0.08, 0.16);
  blotch(g, S, rand, 16, 25, 80, [120, 128, 96], 0.04, 0.09);
  for (let i = 0; i < 34; i++) {
    const x = rand() * S;
    const w = 3 + rand() * 12;
    const len = 90 + rand() * 330;
    const y = rand() * S;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    const a = 0.04 + rand() * 0.07;
    gr.addColorStop(0, `rgba(96,84,62,${a})`);
    gr.addColorStop(1, 'rgba(96,84,62,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, w, len);
    if (y + len > S) g.fillRect(x, y - S, w, len);
  }
  speckle(g, S, rand, 5200, ['rgba(110,96,70,0.10)', 'rgba(255,255,250,0.14)', 'rgba(80,70,50,0.08)'], 2);
  g.strokeStyle = 'rgba(80,70,52,0.16)';
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rand() * S;
    let y = rand() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += (rand() - 0.5) * 18;
      y += 6 + rand() * 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return finish(c);
}

/** Dressed granite / laterite blocks. 2 m per repeat (courses 0.25 m high). */
export function makeStoneTexture() {
  const S = 512;
  const rand = rng(37);
  const [c, g] = mk(S);
  g.fillStyle = '#4a453e';
  g.fillRect(0, 0, S, S);
  const rows = 8;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 128 + (rand() > 0.5 ? 0 : 0);
    for (let k = -1; k < 3; k++) {
      const bx = off + k * 256;
      const l = 50 + rand() * 12;
      const hue = 28 + rand() * 12;
      const x0 = bx + 2;
      const y0 = r * rh + 2;
      g.fillStyle = `hsl(${hue},${6 + rand() * 6}%,${l}%)`;
      g.fillRect(x0, y0, 252, rh - 4);
      const gr = g.createLinearGradient(0, y0, 0, y0 + rh);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)');
      gr.addColorStop(1, 'rgba(0,0,0,0.16)');
      g.fillStyle = gr;
      g.fillRect(x0, y0, 252, rh - 4);
      if (x0 + 252 > S) {
        // wrap block across the seam
        g.fillStyle = `hsl(${hue},8%,${l}%)`;
        g.fillRect(x0 - S, y0, 252, rh - 4);
      }
    }
  }
  blotch(g, S, rand, 60, 20, 80, [66, 82, 52], 0.05, 0.14);
  blotch(g, S, rand, 40, 20, 70, [20, 18, 14], 0.06, 0.16);
  speckle(g, S, rand, 7000, ['rgba(0,0,0,0.22)', 'rgba(255,255,255,0.18)', 'rgba(120,100,80,0.2)'], 2);
  return finish(c);
}

/** Fine-grained carved granite without masonry joints, for a single-piece pedestal. */
export function makeCarvedStoneTexture() {
  const S = 256;
  const rand = rng(83);
  const [c, g] = mk(S);
  g.fillStyle = '#a9a397';
  g.fillRect(0, 0, S, S);
  blotch(g, S, rand, 26, 14, 55, [61, 60, 54], 0.04, 0.11);
  blotch(g, S, rand, 25, 14, 48, [245, 239, 222], 0.04, 0.12);
  speckle(g, S, rand, 4800, [
    'rgba(33,30,26,0.24)', 'rgba(229,219,197,0.32)', 'rgba(72,69,62,0.18)',
  ], 1.5);
  return finish(c);
}

/** Granite paving slabs. 2.4 m per repeat (0.6 m slabs). */
export function makePavingTexture() {
  const S = 512;
  const rand = rng(41);
  const [c, g] = mk(S);
  g.fillStyle = '#3e3b37';
  g.fillRect(0, 0, S, S);
  const n = 4;
  const cs = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(${30 + rand() * 14},${4 + rand() * 6}%,${50 + rand() * 12}%)`;
      g.fillRect(i * cs + 2, j * cs + 2, cs - 4, cs - 4);
    }
  }
  blotch(g, S, rand, 50, 20, 80, [70, 90, 54], 0.05, 0.13);
  blotch(g, S, rand, 40, 20, 80, [20, 18, 14], 0.05, 0.12);
  speckle(g, S, rand, 6000, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.2)'], 2);
  return finish(c);
}

/** Laterite sand compound floor. 4 m per repeat. */
export function makeLateriteTexture() {
  const S = 512;
  const rand = rng(53);
  const [c, g] = mk(S);
  g.fillStyle = '#b79a74';
  g.fillRect(0, 0, S, S);
  blotch(g, S, rand, 120, 20, 90, [152, 118, 80], 0.06, 0.14);
  blotch(g, S, rand, 100, 20, 80, [214, 190, 150], 0.06, 0.14);
  blotch(g, S, rand, 40, 20, 70, [120, 104, 78], 0.05, 0.12);
  speckle(g, S, rand, 9000, ['rgba(110,84,56,0.35)', 'rgba(230,210,176,0.4)', 'rgba(90,76,58,0.3)'], 2);
  for (let i = 0; i < 160; i++) {
    const x = rand() * S;
    const y = rand() * S;
    g.fillStyle = rand() > 0.5 ? 'rgba(138,118,92,0.8)' : 'rgba(214,196,160,0.8)';
    g.beginPath();
    g.ellipse(x, y, 1 + rand() * 2.5, 1 + rand() * 1.8, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c);
}

/** Village lawn. 4 m per repeat. */
export function makeGrassTexture() {
  const S = 512;
  const rand = rng(61);
  const [c, g] = mk(S);
  g.fillStyle = '#5b7636';
  g.fillRect(0, 0, S, S);
  blotch(g, S, rand, 110, 20, 80, [76, 104, 44], 0.12, 0.28);
  blotch(g, S, rand, 90, 20, 80, [120, 140, 66], 0.08, 0.2);
  blotch(g, S, rand, 40, 20, 70, [140, 130, 70], 0.06, 0.14);
  for (let i = 0; i < 6000; i++) {
    const x = rand() * S;
    const y = rand() * S;
    g.strokeStyle = rand() > 0.5 ? 'rgba(48,78,28,0.5)' : 'rgba(132,158,70,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 6);
    g.stroke();
  }
  return finish(c);
}

/** Seasoned timber (grain mostly along v). 1 m per repeat. */
export function makeTimberTexture() {
  const S = 256;
  const rand = rng(71);
  const [c, g] = mk(S);
  g.fillStyle = '#86603a';
  g.fillRect(0, 0, S, S);
  blotch(g, S, rand, 20, 20, 70, [60, 40, 22], 0.10, 0.22);
  blotch(g, S, rand, 20, 20, 70, [170, 130, 84], 0.08, 0.16);
  for (let i = 0; i < 90; i++) {
    const x = rand() * S;
    const w = 1 + rand() * 2.5;
    g.fillStyle = rand() > 0.5 ? `rgba(40,24,12,${0.12 + rand() * 0.22})` : `rgba(200,160,110,${0.08 + rand() * 0.14})`;
    g.fillRect(x, 0, w, S);
  }
  for (let i = 0; i < 24; i++) {
    const y = rand() * S;
    g.fillStyle = `rgba(30,18,8,${0.05 + rand() * 0.08})`;
    g.fillRect(0, y, S, 1 + rand() * 1.5);
  }
  speckle(g, S, rand, 1200, ['rgba(0,0,0,0.18)', 'rgba(255,230,190,0.12)'], 1);
  return finish(c);
}

/** Quiet tropical-green water, with soft colour depth and fine broken reflections. */
export function makeWaterTexture() {
  const S = 256;
  const rand = rng(97);
  const [c, g] = mk(S);
  g.fillStyle = '#23795d';
  g.fillRect(0, 0, S, S);
  blotch(g, S, rand, 34, 26, 90, [8, 65, 52], 0.07, 0.15);
  blotch(g, S, rand, 26, 24, 80, [65, 151, 119], 0.05, 0.12);
  // Reflections stay narrow and irregular, not rings, leaves, or floating dots.
  for (let i = 0; i < 58; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const w = 7 + rand() * 22;
    const a = 0.025 + rand() * 0.065;
    const bend = (rand() - 0.5) * 3;
    wrapDraw(S, x, y, w + 2, (px, py) => {
      g.strokeStyle = `rgba(207,239,215,${a})`;
      g.lineWidth = 0.5 + rand() * 0.6;
      g.beginPath();
      g.moveTo(px - w / 2, py);
      g.quadraticCurveTo(px, py + bend, px + w / 2, py + bend * 0.3);
      g.stroke();
    });
  }
  const t = finish(c);
  t.repeat.set(2, 2);
  return t;
}

/** Soft radial glow used by the lamp halo billboards. */
export function makeHaloTexture() {
  const S = 128;
  const [c, g] = mk(S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
