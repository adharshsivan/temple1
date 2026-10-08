import * as THREE from 'three';
import muralAUrl from '../assets/murals/mural-a.jpg';
import muralBUrl from '../assets/murals/mural-b.jpg';

/**
 * Sreekovil mural atlas.
 *
 * Two generated Kerala-style mural images are down-scaled into ONE 1024 x 1024 canvas atlas, so
 * every mural panel shares a single material / draw call and the GPU only ever holds a low-res
 * texture. Loading is deferred until after the first rendered frame: the panels show a plain
 * terracotta placeholder for a moment, then the paintings appear.
 */
const AW = 1024;
const AH = 1024;

export type MuralCell = 'c0' | 'c1' | 'c2' | 'c3' | 'n0' | 'n1';

interface Cell {
  x: number; y: number; w: number; h: number;
  src: 'A' | 'B';
  fx: number; fy: number; // which part of the source image is cropped (0..1)
}

// Wide panels are ~1.96 x 1.16 m (aspect 1.69); narrow front panels ~0.81 x 1.16 m (aspect 0.70).
const CELLS: Record<MuralCell, Cell> = {
  c0: { x: 0, y: 0, w: 480, h: 280, src: 'A', fx: 0, fy: 0.1 },
  c1: { x: 512, y: 0, w: 480, h: 280, src: 'A', fx: 1, fy: 0.9 },
  c2: { x: 0, y: 296, w: 480, h: 280, src: 'B', fx: 0, fy: 0.1 },
  c3: { x: 512, y: 296, w: 480, h: 280, src: 'B', fx: 1, fy: 0.9 },
  n0: { x: 0, y: 592, w: 196, h: 280, src: 'A', fx: 0.5, fy: 0.5 },
  n1: { x: 212, y: 592, w: 196, h: 280, src: 'B', fx: 0.5, fy: 0.5 },
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('mural image failed'));
    img.src = url;
  });
}

/** Cover-crop `img` into the destination rect, picking the crop window with (fx, fy). */
function drawCover(
  g: CanvasRenderingContext2D, img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number, fx: number, fy: number,
) {
  const ar = dw / dh;
  const iar = img.width / img.height;
  let sw: number;
  let sh: number;
  if (iar > ar) { sh = img.height; sw = sh * ar; } else { sw = img.width; sh = sw / ar; }
  const sx = (img.width - sw) * fx;
  const sy = (img.height - sh) * fy;
  g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

export function createMuralAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = AW;
  canvas.height = AH;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';

  // terracotta placeholder (visible only until the real paintings are drawn in)
  g.fillStyle = '#9c5a2e';
  g.fillRect(0, 0, AW, AH);
  for (const c of Object.values(CELLS)) {
    g.fillStyle = '#b36a35';
    g.fillRect(c.x, c.y, c.w, c.h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  let cancelled = false;
  const paint = (a: HTMLImageElement | null, b: HTMLImageElement | null) => {
    if (cancelled) return;
    for (const c of Object.values(CELLS)) {
      const img = c.src === 'A' ? a : b;
      if (!img) continue;
      drawCover(g, img, c.x, c.y, c.w, c.h, c.fx, c.fy);
      // gentle sepia multiply: aged pigment on lime plaster, and it tames the saturation under roof shade
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = 'rgb(240,222,196)';
      g.fillRect(c.x, c.y, c.w, c.h);
      g.restore();
    }
    texture.needsUpdate = true;
  };

  // Defer until after the first frame so the scene appears immediately.
  const timer = window.setTimeout(() => {
    Promise.allSettled([loadImage(muralAUrl), loadImage(muralBUrl)]).then(([ra, rb]) => {
      paint(ra.status === 'fulfilled' ? ra.value : null, rb.status === 'fulfilled' ? rb.value : null);
    });
  }, 350);

  return {
    texture,
    dispose() {
      cancelled = true;
      window.clearTimeout(timer);
      texture.dispose();
    },
  };
}

/** A plane whose UVs address one atlas cell (optionally mirrored horizontally). */
export function muralPlane(cell: MuralCell, w: number, h: number, flip = false) {
  const c = CELLS[cell];
  const pad = 3; // keep a few texels inside the cell so mip-mapping never bleeds a neighbour in
  let u0 = (c.x + pad) / AW;
  let u1 = (c.x + c.w - pad) / AW;
  const v1 = 1 - (c.y + pad) / AH;
  const v0 = 1 - (c.y + c.h - pad) / AH;
  if (flip) [u0, u1] = [u1, u0];
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) < 0.5 ? u0 : u1, uv.getY(i) < 0.5 ? v0 : v1);
  }
  return g;
}
