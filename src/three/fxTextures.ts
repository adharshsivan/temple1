import * as THREE from 'three';
import { rng } from './textures';

/** Cast-iron barrel skin: grey pitted iron, rust at the flared foot, black soot around the mouth. */
export function makeIronTexture(): THREE.CanvasTexture {
  const S = 256;
  const rand = rng(211);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#6a6966';
  g.fillRect(0, 0, S, S);

  // soft blotch that wraps horizontally so the lathe seam is invisible
  const blob = (x: number, y: number, r: number, rgb: string, a: number) => {
    for (const ox of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr;
      g.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  };
  for (let i = 0; i < 70; i++) blob(rand() * S, rand() * S, 12 + rand() * 40, '40,40,40', 0.1 + rand() * 0.14);
  for (let i = 0; i < 60; i++) blob(rand() * S, rand() * S, 10 + rand() * 34, '156,153,146', 0.08 + rand() * 0.12);
  // rust: concentrated low on the barrel (the lower half of the canvas is the flared foot)
  for (let i = 0; i < 46; i++) blob(rand() * S, S * (0.42 + rand() * 0.58), 8 + rand() * 26, '150,82,40', 0.16 + rand() * 0.28);
  // soot: the top of the canvas is the mouth and bore
  const sg = g.createLinearGradient(0, 0, 0, S * 0.34);
  sg.addColorStop(0, 'rgba(16,13,11,0.95)');
  sg.addColorStop(1, 'rgba(16,13,11,0)');
  g.fillStyle = sg;
  g.fillRect(0, 0, S, S * 0.34);
  // casting pits and bright flecks
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rand() < 0.55 ? 'rgba(20,18,16,0.55)' : 'rgba(192,188,180,0.35)';
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Billowy smoke / fire sprite. RGB carries the volume shading (lighter on top), alpha the density.
 * Fire and dust re-use it with their own colour ramps in the shader.
 */
export function makeSmokeTexture(): THREE.CanvasTexture {
  const S = 256;
  const rand = rng(131);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, S, S);

  const lobes = 26;
  for (let i = 0; i < lobes; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * 0.27 * S;
    const cx = S / 2 + Math.cos(a) * rr;
    const cy = S / 2 + Math.sin(a) * rr * 0.9;
    const r = (0.15 + rand() * 0.17) * S;
    const shade = Math.round(138 + 117 * (1 - cy / S)); // lighter toward the top of the puff
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, `rgba(${shade},${shade},${shade},0.5)`);
    gr.addColorStop(0.55, `rgba(${shade - 24},${shade - 24},${shade - 24},0.3)`);
    gr.addColorStop(1, `rgba(${shade - 40},${shade - 40},${shade - 40},0)`);
    g.fillStyle = gr;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // soft circular mask so no sprite edge is ever visible
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(0.7, 'rgba(0,0,0,0.85)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m;
  g.fillRect(0, 0, S, S);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}
