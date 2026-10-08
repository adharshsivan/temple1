import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface FloorRect extends Rect { h: number }
export interface Footprint extends Rect { label: string; kind: 'main' | 'aux' | 'gate' | 'lamp' }
export interface Spot { x: number; y: number; z: number; ry: number }
export interface Glow { x: number; y: number; z: number; s: number }
export interface LightSpec { x: number; y: number; z: number; intensity: number; distance: number }

/** Everything the player / HUD needs to know about the built site. */
export class World {
  colliders: Rect[] = [];
  floors: FloorRect[] = [];
  footprints: Footprint[] = [];
  reserved: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  compound: Rect = { x0: -17.5, x1: 17.5, z0: -12.5, z1: 12.5 };
  pondPlot: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  kulam: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  kulamWater: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  pondDoor: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  vediPlot: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  vediDoor: Rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  vediBarrels: { x: number; z: number }[] = [];
  stoneLamps: Spot[] = [];
  brassLamps: Spot[] = [];
  wallLamps: Spot[] = [];
  flames: Glow[] = []; // individual flame positions (s = flame scale)
  halos: Glow[] = []; // soft glow billboards (s = diameter)
  lights: LightSpec[] = [];

  /** Highest walkable surface under (x, z). Ground is 0; the sunken kulam treads are negative. */
  heightAt(x: number, z: number): number {
    let h: number | null = null;
    for (const f of this.floors) {
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && (h === null || f.h > h)) h = f.h;
    }
    return h ?? 0;
  }

  hits(x: number, z: number, r: number): boolean {
    for (const c of this.colliders) {
      const cx = Math.max(c.x0, Math.min(x, c.x1));
      const cz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* UV + vertex colour baking                                           */
/* ------------------------------------------------------------------ */

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** World-scale box projection: constant texel density on every surface. */
export function applyBoxUV(g: THREE.BufferGeometry, ts: number, swap = false) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z; v = y; }
    else { u = x; v = y; }
    if (swap) { const t = u; u = v; v = t; }
    uv[i * 2] = u / ts;
    uv[i * 2 + 1] = v / ts;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export interface AddOpt {
  uv?: 'box' | 'keep';
  swap?: boolean;
  tint?: number;
  weather?: boolean;
}

/**
 * Collects geometry per material, bakes world-space UVs + weathering vertex colours,
 * then merges everything into ONE mesh per material (GLB/GLTF friendly, minimal draw calls).
 */
export class Batch {
  private map = new Map<THREE.Material, THREE.BufferGeometry[]>();
  triangles = 0;

  add(mat: THREE.Material, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4, opt: AddOpt = {}) {
    let g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (g.index) {
      const ni = g.toNonIndexed();
      g.dispose();
      g = ni;
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
    const n = g.attributes.position.count;
    if (opt.uv !== 'keep' || !g.attributes.uv) {
      const ts = (mat.userData.texScale as number) || 1;
      applyBoxUV(g, ts, !!opt.swap);
    }
    const pos = g.attributes.position;
    const col = new Float32Array(n * 3);
    const tint = opt.tint ?? 1;
    const weather = opt.weather !== false;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let k = tint * (1 + (hash3(x * 1.31, y * 1.7, z * 1.13) - 0.5) * 0.12);
      if (weather) k *= 0.78 + 0.22 * smooth(0, 0.9, y);
      col[i * 3] = k;
      col[i * 3 + 1] = k * (weather && y < 0.5 ? 1.0 : 0.995);
      col[i * 3 + 2] = k * (weather && y < 0.5 ? 0.96 : 0.99);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.triangles += n / 3;
    let list = this.map.get(mat);
    if (!list) { list = []; this.map.set(mat, list); }
    list.push(g);
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'StaticTemple';
    for (const [mat, list] of this.map) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `static_${mat.name || 'mat'}`;
      mesh.castShadow = !mat.userData.noCast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.map.clear();
    return group;
  }
}

/* ------------------------------------------------------------------ */
/* Placement context: local (x, y, z) -> world, with 90° rotation      */
/* ------------------------------------------------------------------ */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const IDQ = new THREE.Quaternion();
const cylCache = new Map<string, THREE.BufferGeometry>();

function cylGeo(r0: number, r1: number, h: number, seg: number, ts: number) {
  const key = `${r0.toFixed(3)}|${r1.toFixed(3)}|${h.toFixed(3)}|${seg}|${ts}`;
  let g = cylCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(r1, r0, h, seg, 1);
    g.translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    const circ = Math.PI * 2 * Math.max(r0, r1, 0.01);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / ts, (uv.getY(i) * h) / ts);
    cylCache.set(key, g);
  }
  return g;
}

export class Ctx {
  readonly M = new THREE.Matrix4();
  private cs: number;
  private sn: number;

  constructor(
    readonly b: Batch,
    readonly world: World,
    readonly x = 0,
    readonly z = 0,
    readonly rot = 0,
    readonly y0 = 0,
  ) {
    this.M.makeRotationY(rot);
    this.M.setPosition(x, y0, z);
    this.cs = Math.cos(rot);
    this.sn = Math.sin(rot);
  }

  toWorld(lx: number, lz: number): [number, number] {
    return [this.x + lx * this.cs + lz * this.sn, this.z - lx * this.sn + lz * this.cs];
  }

  rect(lx0: number, lz0: number, lx1: number, lz1: number): Rect {
    const a = this.toWorld(lx0, lz0);
    const c = this.toWorld(lx1, lz1);
    const d = this.toWorld(lx0, lz1);
    const e = this.toWorld(lx1, lz0);
    const xs = [a[0], c[0], d[0], e[0]];
    const zs = [a[1], c[1], d[1], e[1]];
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  }

  collide(lx0: number, lz0: number, lx1: number, lz1: number) {
    this.world.colliders.push(this.rect(lx0, lz0, lx1, lz1));
  }
  collideBox(lcx: number, lcz: number, sx: number, sz: number) {
    this.collide(lcx - sx / 2, lcz - sz / 2, lcx + sx / 2, lcz + sz / 2);
  }
  floor(lcx: number, lcz: number, sx: number, sz: number, h: number) {
    const r = this.rect(lcx - sx / 2, lcz - sz / 2, lcx + sx / 2, lcz + sz / 2);
    this.world.floors.push({ ...r, h });
  }

  geo(mat: THREE.Material, g: THREE.BufferGeometry, local?: THREE.Matrix4, opt?: AddOpt) {
    const m = local ? local.clone().premultiply(this.M) : this.M;
    this.b.add(mat, g, m, opt);
  }

  box(mat: THREE.Material, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, opt: AddOpt = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), IDQ, new THREE.Vector3(sx, sy, sz));
    m.premultiply(this.M);
    const swap = opt.swap ?? (!!mat.userData.grain && Math.max(sx, sz) > 1.6 * sy);
    this.b.add(mat, UNIT_BOX, m, { uv: 'box', ...opt, swap });
  }

  /** box covering local ranges (x0..x1, y0..y1, z0..z1) */
  span(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, opt: AddOpt = {}) {
    this.box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), opt);
  }

  /** Box whose local X axis runs p0 -> p1 (rafters, hips, ridge caps…). */
  beam(mat: THREE.Material, p0: V3, p1: V3, w: number, h: number, opt: AddOpt = {}) {
    const a = new THREE.Vector3(...p0);
    const bb = new THREE.Vector3(...p1);
    const d = bb.clone().sub(a);
    const len = d.length();
    if (len < 1e-4) return;
    d.normalize();
    let up = UP.clone().sub(d.clone().multiplyScalar(UP.dot(d)));
    if (up.lengthSq() < 1e-6) up = new THREE.Vector3(0, 0, 1);
    up.normalize();
    const side = new THREE.Vector3().crossVectors(d, up);
    const m = new THREE.Matrix4().makeBasis(d, up, side);
    m.scale(new THREE.Vector3(len, h, w));
    m.setPosition(a.add(bb).multiplyScalar(0.5));
    m.premultiply(this.M);
    const swap = !!mat.userData.grain;
    this.b.add(mat, UNIT_BOX, m, { uv: 'box', ...opt, swap: opt.swap ?? swap });
  }

  /** Cylinder / cone, base at y = cy. */
  cyl(mat: THREE.Material, cx: number, cy: number, cz: number, r0: number, r1: number, h: number, seg = 10, ry = 0, opt: AddOpt = {}) {
    const ts = (mat.userData.texScale as number) || 1;
    const g = cylGeo(r0, r1, h, seg, ts);
    const m = new THREE.Matrix4().makeRotationY(ry);
    m.setPosition(cx, cy, cz);
    m.premultiply(this.M);
    this.b.add(mat, g, m, { uv: 'keep', ...opt });
  }
}
