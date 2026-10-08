import * as THREE from 'three';
import { Ctx, V3 } from './batch';
import type { Mats } from './materials';

/** Shared roof pitch (rise / run ≈ 28.8°) – every roof on the site uses it. */
export const PITCH = 0.55;

export interface PlaneAxes { u: V3; v: V3 }

/** Horizontal (u) + up-slope (v) texture axes for a roof plane with normal n. */
export function roofAxes(n: V3): PlaneAxes {
  let ux = n[2];
  let uz = -n[0];
  const ul = Math.hypot(ux, uz);
  if (ul < 1e-6) { ux = 1; uz = 0; } else { ux /= ul; uz /= ul; }
  let vx = n[1] * uz;
  let vy = n[2] * ux - n[0] * uz;
  let vz = -n[1] * ux;
  const vl = Math.hypot(vx, vy, vz) || 1;
  vx /= vl; vy /= vl; vz /= vl;
  if (vy < 0) { vx = -vx; vy = -vy; vz = -vz; }
  return { u: [ux, 0, uz], v: [vx, vy, vz] };
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Tiny polygon accumulator – flat-shaded, auto-orients each face toward `want`. */
export class PolyBuf {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];

  face(vs: V3[], want: V3, uvInfo?: { ts: number; axes?: PlaneAxes }) {
    const v: V3[] = [];
    for (const p of vs) {
      const q = v[v.length - 1];
      if (!q || dist(p, q) > 1e-4) v.push(p);
    }
    while (v.length > 2 && dist(v[0], v[v.length - 1]) < 1e-4) v.pop();
    if (v.length < 3) return;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < v.length; i++) {
      const a = v[i];
      const b = v[(i + 1) % v.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) {
      v.reverse();
      nx = -nx; ny = -ny; nz = -nz;
    }
    const axes = uvInfo ? uvInfo.axes ?? roofAxes([nx, ny, nz]) : null;
    const ts = uvInfo?.ts ?? 1;
    for (let i = 1; i < v.length - 1; i++) {
      for (const p of [v[0], v[i], v[i + 1]]) {
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(nx, ny, nz);
        if (axes) {
          this.uv.push(
            (p[0] * axes.u[0] + p[1] * axes.u[1] + p[2] * axes.u[2]) / ts,
            (p[0] * axes.v[0] + p[1] * axes.v[1] + p[2] * axes.v[2]) / ts,
          );
        } else this.uv.push(0, 0);
      }
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
  get empty() { return this.pos.length === 0; }
}

/** Traditional brass / gold finial (kalasam): lathe profile, ~100 triangles. */
export function kalasamGeometry(h: number, w: number) {
  const prof: [number, number][] = [
    [0, 0], [0.3, 0], [0.36, 0.05], [0.24, 0.11], [0.22, 0.17], [0.4, 0.3], [0.44, 0.4],
    [0.34, 0.52], [0.14, 0.6], [0.08, 0.68], [0.12, 0.76], [0.06, 0.86], [0, 1],
  ];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * w, y * h)), 12);
}

/* ------------------------------------------------------------------ */
/* Hip roof (small buildings, sreekovil)                               */
/* ------------------------------------------------------------------ */

export interface HipOpts {
  cx: number; cz: number; // local centre
  a: number; b: number; // half extents at the eave tip
  ye: number; // eave tip height (top surface)
  pitch: number;
  thick: number;
}

/**
 * Hip roof with real thickness: tiled top hull (tile material), timber soffit + fascia,
 * terracotta ridge + hip caps. Equal pitch on all four faces.
 */
export function hipRoof(c: Ctx, M: Mats, o: HipOpts, finial: 'small' | 'none' = 'small') {
  const sw = o.b > o.a;
  const A = sw ? o.b : o.a;
  const B = sw ? o.a : o.b;
  const rl = A - B;
  const yr = o.ye + B * o.pitch;
  const t = o.thick;
  const P = (x: number, y: number, z: number): V3 => (sw ? [o.cx + z, y, o.cz + x] : [o.cx + x, y, o.cz + z]);

  const E: [number, number][] = [[-A, -B], [A, -B], [A, B], [-A, B]];
  const R0: [number, number] = [-rl, 0];
  const R1: [number, number] = [rl, 0];
  const ep = (p: [number, number]): V3 => [p[0], o.ye, p[1]];
  const rp = (p: [number, number]): V3 => [p[0], yr, p[1]];
  const quads: V3[][] = [
    [ep(E[0]), ep(E[1]), rp(R1), rp(R0)],
    [ep(E[2]), ep(E[3]), rp(R0), rp(R1)],
    [ep(E[1]), ep(E[2]), rp(R1)],
    [ep(E[3]), ep(E[0]), rp(R0)],
  ];
  const top = new PolyBuf();
  const under = new PolyBuf();
  for (const q of quads) {
    top.face(q.map((p) => P(p[0], p[1], p[2])), [0, 1, 0], { ts: 1 });
    under.face(q.map((p) => P(p[0], p[1] - t, p[2])), [0, -1, 0]);
  }
  for (let i = 0; i < 4; i++) {
    const a = E[i];
    const b = E[(i + 1) % 4];
    const m = P((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    under.face(
      [P(a[0], o.ye, a[1]), P(b[0], o.ye, b[1]), P(b[0], o.ye - t, b[1]), P(a[0], o.ye - t, a[1])],
      [m[0] - o.cx, 0, m[2] - o.cz],
    );
  }
  c.geo(M.tile, top.geometry(), undefined, { uv: 'keep', weather: false });
  c.geo(M.timberDark, under.geometry(), undefined, { uv: 'box', weather: false });

  // ridge + hip caps (terracotta)
  const cap = 0.04;
  if (rl > 0.05) c.beam(M.ridge, P(-rl - 0.12, yr + cap, 0), P(rl + 0.12, yr + cap, 0), 0.28, 0.17, { weather: false });
  const hipEnd = [R0, R1, R1, R0];
  for (let i = 0; i < 4; i++) {
    c.beam(M.ridge, P(E[i][0], o.ye + cap, E[i][1]), P(hipEnd[i][0], yr + cap, hipEnd[i][1]), 0.22, 0.13, { weather: false });
  }
  if (finial === 'small') {
    const g = kalasamGeometry(0.42, 0.16);
    const ends: [number, number][] = rl > 0.05 ? [R0, R1] : [[0, 0]];
    for (const e of ends) {
      const p = P(e[0], yr + cap + 0.06, e[1]);
      c.geo(M.brass, g, new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]), { uv: 'keep', weather: false });
    }
  }
  return { yr, rl };
}

/** Exposed rafter tails under a hip roof (wall plate half extents aw/bw, eave a/b). */
export function hipRafters(
  c: Ctx, mat: THREE.Material,
  o: HipOpts & { aw: number; bw: number; spacing?: number; w?: number; h?: number },
) {
  const sp = o.spacing ?? 0.5;
  const w = o.w ?? 0.07;
  const h = o.h ?? 0.11;
  const yAt = (x: number, z: number) =>
    o.ye - o.thick + o.pitch * Math.min(o.a - Math.abs(x), o.b - Math.abs(z)) - h / 2;
  const cnt = (len: number) => Math.max(2, Math.round(len / sp) + 1);

  const nx = cnt(2 * (o.aw - 0.2));
  for (let k = 0; k < nx; k++) {
    const x = -(o.aw - 0.2) + (k * 2 * (o.aw - 0.2)) / (nx - 1);
    for (const s of [1, -1]) {
      const z0 = s * (o.bw - 0.3);
      const z1 = s * o.b;
      c.beam(mat, [o.cx + x, yAt(x, z0), o.cz + z0], [o.cx + x, yAt(x, z1), o.cz + z1], w, h);
    }
  }
  const nz = cnt(2 * (o.bw - 0.2));
  for (let k = 0; k < nz; k++) {
    const z = -(o.bw - 0.2) + (k * 2 * (o.bw - 0.2)) / (nz - 1);
    for (const s of [1, -1]) {
      const x0 = s * (o.aw - 0.3);
      const x1 = s * o.a;
      c.beam(mat, [o.cx + x0, yAt(x0, z), o.cz + z], [o.cx + x1, yAt(x1, z), o.cz + z], w, h);
    }
  }
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const x0 = sx * (o.aw - 0.15);
      const z0 = sz * (o.bw - 0.15);
      c.beam(mat, [o.cx + x0, yAt(x0, z0), o.cz + z0], [o.cx + sx * o.a, yAt(sx * o.a, sz * o.b), o.cz + sz * o.b], w * 1.4, h * 1.2);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Main lower roof: ring (chuttambalam) ∪ mandapam gable               */
/* ------------------------------------------------------------------ */

export interface MainRoofOpts {
  cx: number; cz: number; // ring centre
  R: number; // eave half extent of the ring roof
  hole: number; // half extent of the sanctum cut-out
  ye: number; // ring eave tip height
  pitch: number;
  thick: number;
  g: { halfW: number; z0: number; z1: number; ye: number }; // mandapam gable (relative to ring centre)
  cell: number;
}

/**
 * Builds the union (upper envelope) of the pyramid roof over the circumambulatory ring and the
 * gabled mandapam roof. Valleys, hips and the point where the porch pushes through the main slope
 * fall out of the max() naturally – no interpenetrating meshes, no z-fighting.
 */
export function mainRoof(c: Ctx, M: Mats, o: MainRoofOpts) {
  const { R, hole, pitch: p, thick: t, g, cell: s } = o;
  const eps = 1e-6;
  const ringY = (x: number, z: number) => o.ye + p * (R - Math.max(Math.abs(x), Math.abs(z)));
  const ringId = (x: number, z: number) => (Math.abs(x) >= Math.abs(z) ? (x >= 0 ? 0 : 1) : z >= 0 ? 2 : 3);
  const gableY = (x: number) => g.ye + p * (g.halfW - Math.abs(x));
  const inRing = (x: number, z: number) => Math.abs(x) <= R + eps && Math.abs(z) <= R + eps;
  const inGable = (x: number, z: number) => Math.abs(x) <= g.halfW + eps && z >= g.z0 - eps && z <= g.z1 + eps;
  const sample = (x: number, z: number) => {
    let y = -Infinity;
    let id = -1;
    if (inRing(x, z)) { y = ringY(x, z); id = ringId(x, z); }
    if (inGable(x, z)) {
      const gy = gableY(x);
      if (gy > y) { y = gy; id = x >= 0 ? 4 : 5; }
    }
    return { y, id };
  };

  const L = Math.hypot(1, p);
  const normals: V3[] = [[p / L, 1 / L, 0], [-p / L, 1 / L, 0], [0, 1 / L, p / L], [0, 1 / L, -p / L], [p / L, 1 / L, 0], [-p / L, 1 / L, 0]];
  const axes = normals.map((n) => roofAxes(n));

  const nx = Math.round((2 * R) / s);
  const nz = Math.round((R + g.z1) / s);
  const X = (i: number) => -R + i * s;
  const Z = (j: number) => -R + j * s;
  const inHole = (x: number, z: number) => Math.abs(x) < hole && Math.abs(z) < hole;
  const incl = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
    const x = X(i) + s / 2;
    const z = Z(j) + s / 2;
    if (inHole(x, z)) return false;
    return inRing(x, z) || inGable(x, z);
  };
  const H: number[][] = [];
  for (let i = 0; i <= nx; i++) {
    H[i] = [];
    for (let j = 0; j <= nz; j++) H[i][j] = sample(X(i), Z(j)).y;
  }

  const top = new PolyBuf();
  const under = new PolyBuf();
  const W = (x: number, y: number, z: number): V3 => [o.cx + x, y, o.cz + z];

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (!incl(i, j)) continue;
      const x0 = X(i), x1 = X(i + 1), z0 = Z(j), z1 = Z(j + 1);
      const h00 = H[i][j], h10 = H[i + 1][j], h11 = H[i + 1][j + 1], h01 = H[i][j + 1];
      if (![h00, h10, h11, h01].every(Number.isFinite)) continue;
      const v00: V3 = [x0, h00, z0], v10: V3 = [x1, h10, z0], v11: V3 = [x1, h11, z1], v01: V3 = [x0, h01, z1];
      const tris: V3[][] = Math.abs(h00 - h11) <= Math.abs(h10 - h01)
        ? [[v00, v10, v11], [v00, v11, v01]]
        : [[v00, v10, v01], [v10, v11, v01]];
      for (const tri of tris) {
        const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const mz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
        const id = Math.max(0, sample(mx, mz).id);
        top.face(tri.map((q) => W(q[0], q[1], q[2])), [0, 1, 0], { ts: 1, axes: axes[id] });
        under.face(tri.map((q) => W(q[0], q[1] - t, q[2])), [0, -1, 0]);
      }
      // fascia along free edges
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (incl(i + di, j + dj)) continue;
        const ncx = X(i + di) + s / 2;
        const ncz = Z(j + dj) + s / 2;
        if (inHole(ncx, ncz)) continue;
        let a: V3, b: V3;
        if (di === 1) { a = v10; b = v11; }
        else if (di === -1) { a = v00; b = v01; }
        else if (dj === 1) { a = v01; b = v11; }
        else { a = v00; b = v10; }
        under.face([W(a[0], a[1], a[2]), W(b[0], b[1], b[2]), W(b[0], b[1] - t, b[2]), W(a[0], a[1] - t, a[2])], [di, 0, dj]);
      }
    }
  }
  c.geo(M.tile, top.geometry(), undefined, { uv: 'keep', weather: false });
  c.geo(M.timberDark, under.geometry(), undefined, { uv: 'box', weather: false });

  /* ---- exposed rafters (only along the plane that actually owns that stretch) ---- */
  const rw = 0.09;
  const rh = 0.13;
  const run = (p0: [number, number], p1: [number, number], id: number) => {
    const total = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const N = Math.max(8, Math.ceil(total / 0.06));
    const stepLen = total / N;
    let start = -1;
    const at = (k: number): [number, number] => [p0[0] + ((p1[0] - p0[0]) * k) / N, p0[1] + ((p1[1] - p0[1]) * k) / N];
    const emit = (a: number, b: number) => {
      if ((b - a) * stepLen < 0.35) return;
      const pa = at(a), pb = at(b);
      const ya = sample(pa[0], pa[1]).y - t - rh / 2;
      const yb = sample(pb[0], pb[1]).y - t - rh / 2;
      c.beam(M.timberDark, W(pa[0], ya, pa[1]), W(pb[0], yb, pb[1]), rw, rh);
    };
    for (let k = 0; k <= N; k++) {
      const q = at(k);
      const ok = sample(q[0], q[1]).id === id && !(Math.abs(q[0]) < hole - 0.001 && Math.abs(q[1]) < hole - 0.001);
      if (ok && start < 0) start = k;
      if ((!ok || k === N) && start >= 0) {
        emit(start, ok ? k : k - 1);
        start = -1;
      }
    }
  };
  const nr = 22;
  const lim = R - 0.35;
  for (let k = 0; k < nr; k++) {
    const l = -lim + (k * 2 * lim) / (nr - 1);
    run([l, R], [l, hole], 2);
    run([l, -R], [l, -hole], 3);
    run([R, l], [hole, l], 0);
    run([-R, l], [-hole, l], 1);
  }
  const ng = Math.round((g.z1 - g.z0 - 0.3) / 0.55) + 1;
  for (let k = 0; k < ng; k++) {
    const z = g.z0 + 0.15 + (k * (g.z1 - g.z0 - 0.3)) / (ng - 1);
    run([g.halfW, z], [0, z], 4);
    run([-g.halfW, z], [0, z], 5);
  }

  /* ---- terracotta hip caps, ridge cap and valley flashing ---- */
  const cap = 0.035;
  const hi = hole + 0.1;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      c.beam(M.ridge, W(sx * R, ringY(R, R) + cap, sz * R), W(sx * hi, ringY(hi, hi) + cap, sz * hi), 0.26, 0.14, { weather: false });
    }
  }
  const gy = gableY(0);
  c.beam(M.ridge, W(0, gy + cap, g.z1 + 0.12), W(0, gy + cap, g.z0 + 0.05), 0.3, 0.18, { weather: false });
  const zc0 = R - (g.ye - o.ye) / p - g.halfW; // valley: z = |x| + zc0
  const xa = g.z0 - zc0;
  for (const sx of [1, -1]) {
    const za = g.z0;
    const zb = g.halfW + zc0;
    c.beam(
      M.ridge,
      W(sx * xa, o.ye + p * (R - za) + 0.01, za),
      W(sx * g.halfW, o.ye + p * (R - zb) + 0.01, zb),
      0.4, 0.07, { weather: false },
    );
  }
  return { sample, ringY, gableY };
}
