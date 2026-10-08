import * as THREE from 'three';
import { Batch, Ctx, V3, World } from './batch';
import { BuildingSpec, buildKeralaBuilding } from './building';
import { buildVazhipaaduCounter } from './counter';
import { MuralCell, muralPlane } from './murals';
import { buildVediBarrels, vediLayout } from './vedi';
import { buildChuttuvilakku, buildDeepastambham } from './lamps';
import type { Mats } from './materials';
import { PITCH, PolyBuf, hipRafters, hipRoof, kalasamGeometry, mainRoof } from './roof';

/* ------------------------------------------------------------------ */
/* Site constants (metres). Compound 35 x 29 (front wall pushed 4 m     */
/* forward for a roomier forecourt), x origin at the compound centre.  */
/* ------------------------------------------------------------------ */
export const X0 = -2.5; // temple axis (x)
export const ZC = -4.8; // sreekovil / chuttambalam centre (z)
/** Clear, unobstructed 6 x 10 m reserve for the future temple pond (kulam). */
export const POND = { x0: 9, x1: 15, z0: -2.2, z1: 7.8 };
export const FRONT_SHIFT = 4; // how far the front wall + gate moved forward
export const WALL_Z = 12 + FRONT_SHIFT; // inner face of the front (south) wall
export const GATE_Z = 11.65 + FRONT_SHIFT; // gate building centre
export const DEEPA_Z = 7.4; // deepastambham centre
/** Real temple pond (kulam) in the next plot east of the main compound. The POND reserve above stays untouched. */
export const POND_PLOT = { x0: 17.5, x1: 33.5, z0: -4.5, z1: 10.5 };
/** Excavation runs edge-to-edge inside the plot walls: only a 0.35 m stone coping separates water from masonry. */
export const KULAM = { x0: 19.5, x1: 31.5, z0: -3.0, z1: 9.0 };
export const KULAM_TREAD = 0.45; // step depth (horizontal)
export const KULAM_RISE = 0.22; // step height — kept under the 0.22 m walk step-up limit
export const KULAM_STEPS = 6;
/** Water fills the pit to just below the first dry tread. */
export const KULAM_WATER = {
  x0: KULAM.x0 + KULAM_TREAD, x1: KULAM.x1 - KULAM_TREAD,
  z0: KULAM.z0 + KULAM_TREAD, z1: KULAM.z1 - KULAM_TREAD,
};
export const KULAM_WATER_Y = -0.36; // 0.14 m below the dry tread, 0.08 m above the next step
export const KULAM_BOTTOM_Y = -(KULAM_STEPS * KULAM_RISE) - 0.2; // -1.76
export const POND_DOOR = { z0: 1.45, z1: 4.15 }; // 2.7 m clear doorway in the east compound wall
const COMPOUND_Z0 = -12.5;
const COMPOUND_Z1 = WALL_Z + 0.5;
const COMPOUND_ZC = (COMPOUND_Z0 + COMPOUND_Z1) / 2;
const COMPOUND_D = COMPOUND_Z1 - COMPOUND_Z0;

const P1 = 0.5; // chuttambalam + mandapam floor
const P2 = 0.9; // sreekovil plinth top
const COL_H = 2.2;
const BEAM_H = 0.22;
const PLATE_TOP = P1 + COL_H + BEAM_H; // 2.92
const SREE_PLATE_TOP = 5.4;

interface StairOpt {
  axis: 'x' | 'z'; at: number; edge: number; dir: 1 | -1; width: number;
  base: number; total: number; n: number; tread: number;
}

function stairs(c: Ctx, M: Mats, o: StairOpt) {
  const rise = o.total / o.n;
  for (let k = 1; k < o.n; k++) {
    const d0 = (o.n - 1 - k) * o.tread;
    const e0 = o.edge + o.dir * d0;
    const e1 = o.edge + o.dir * (d0 + o.tread);
    const lo = Math.min(e0, e1);
    const hi = Math.max(e0, e1);
    const h = o.base + k * rise;
    if (o.axis === 'z') {
      c.span(M.stone, o.at - o.width / 2, o.at + o.width / 2, o.base, h, lo, hi);
      c.floor(o.at, (lo + hi) / 2, o.width, hi - lo, h);
    } else {
      c.span(M.stone, lo, hi, o.base, h, o.at - o.width / 2, o.at + o.width / 2);
      c.floor((lo + hi) / 2, o.at, hi - lo, o.width, h);
    }
  }
}

export function buildTemple(M: Mats) {
  const world = new World();
  const b = new Batch();
  const c0 = new Ctx(b, world, 0, 0, 0, 0);
  const flat = { weather: false };

  /* ============================ GROUND ============================ */
  // Village grass base with a hole left for the dug-in kulam (steps overlap the cut edges)
  c0.box(M.grass, (KULAM.x0 - 320) / 2, -0.13, 0, KULAM.x0 + 320, 0.2, 320, flat); // west of pond
  c0.box(M.grass, (KULAM.x1 + 320) / 2, -0.13, 0, 320 - KULAM.x1, 0.2, 320, flat); // east of pond
  c0.box(M.grass, (KULAM.x0 + KULAM.x1) / 2, -0.13, (KULAM.z0 - 320) / 2, KULAM.x1 - KULAM.x0, 0.2, KULAM.z0 + 320, flat); // north of pond
  c0.box(M.grass, (KULAM.x0 + KULAM.x1) / 2, -0.13, (KULAM.z1 + 320) / 2, KULAM.x1 - KULAM.x0, 0.2, 320 - KULAM.z1, flat); // south of pond
  c0.box(M.laterite, 0, -0.05, COMPOUND_ZC, 35.2, 0.1, COMPOUND_D + 0.2, flat);
  c0.box(M.laterite, X0, -0.035, COMPOUND_Z1 + 9.7, 3.4, 0.07, 19.4, flat); // village lane to the gate

  const strip = (x0: number, x1: number, z0: number, z1: number) => c0.span(M.grass, x0, x1, 0, 0.03, z0, z1, flat);
  strip(-17, 17, -12, -11.1);
  strip(-17, -16.1, -11.1, WALL_Z - 0.9);
  strip(16.1, 17, -11.1, WALL_Z - 0.9);
  strip(-17, X0 - 3.0, WALL_Z - 0.9, WALL_Z);
  strip(X0 + 3.0, 17, WALL_Z - 0.9, WALL_Z);

  /* ============================ PAVING ============================ */
  const pv = (x0: number, x1: number, z0: number, z1: number) => c0.span(M.paving, x0, x1, 0, 0.04, z0, z1, flat);
  pv(X0 - 1.5, X0 + 1.5, 4.1, 5.0); // axial path: gate -> forecourt -> mandapam
  pv(X0 - 2.9, X0 + 2.9, 5.0, DEEPA_Z + 2.4); // deepastambham plaza (6 m wide, 2.4 m clear around the base)
  pv(X0 - 1.5, X0 + 1.5, DEEPA_Z + 2.4, GATE_Z - 4.2); // processional path to the gate
  pv(X0 - 2.9, X0 + 2.9, GATE_Z - 4.2, GATE_Z - 1.7); // landing just inside the gate
  // Continuous stone path loop around the kulam, plus a clear approach from its entrance.
  const pathOuter = 0.8;
  const coping = 0.35;
  pv(17.5, KULAM.x0 - coping, KULAM.z0 - pathOuter, KULAM.z1 + pathOuter); // west / entrance side
  pv(KULAM.x1 + coping, 33.0, KULAM.z0 - pathOuter, KULAM.z1 + pathOuter); // east side
  pv(KULAM.x0 - coping, KULAM.x1 + coping, KULAM.z0 - coping - pathOuter, KULAM.z0 - coping); // north side
  pv(KULAM.x0 - coping, KULAM.x1 + coping, KULAM.z1 + coping, KULAM.z1 + coping + pathOuter); // south side
  pv(X0 - 6.7, X0 - 5.5, -11.1, 1.9); // circulation apron around the chuttambalam
  pv(X0 + 5.5, X0 + 6.7, -11.1, 1.9);
  pv(X0 - 5.5, X0 + 5.5, -11.1, -10.3);
  pv(X0 - 5.5, X0 - 3.5, 0.7, 1.9);
  pv(X0 + 3.5, X0 + 5.5, 0.7, 1.9);

  /* ========================= COMPOUND WALL ========================= */
  const wallSeg = (x0: number, x1: number, z0: number, z1: number) => {
    const alongX = x1 - x0 > z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const T = alongX ? z1 - z0 : x1 - x0;
    const sp = (mat: THREE.Material, ya: number, yb: number, th: number) => {
      if (alongX) c0.span(mat, x0, x1, ya, yb, cz - th / 2, cz + th / 2);
      else c0.span(mat, cx - th / 2, cx + th / 2, ya, yb, z0, z1);
    };
    sp(M.stoneDark, 0, 0.45, T);
    sp(M.lime, 0.45, 1.62, T - 0.1);
    sp(M.ridge, 1.62, 1.72, T + 0.04);
    sp(M.ridge, 1.72, 1.8, T - 0.16);
    c0.collide(x0, z0, x1, z1);
  };
  wallSeg(-17.5, -17, -12.5, COMPOUND_Z1);
  wallSeg(17, 17.5, -12.5, POND_DOOR.z0); // east wall, north of the pond doorway
  wallSeg(17, 17.5, POND_DOOR.z1, COMPOUND_Z1); // east wall, south of the pond doorway
  // north wall, split by a simple widened gap to the kathina vedi ground (no gopuram, no arch, no gate structure)
  const vediGate = vediLayout(X0);
  wallSeg(-17, vediGate.door.x0 - 0.35, -12.5, -12);
  wallSeg(vediGate.door.x1 + 0.35, 17, -12.5, -12);
  wallSeg(-17, X0 - 1.74, WALL_Z, COMPOUND_Z1);
  wallSeg(X0 + 1.74, 17, WALL_Z, COMPOUND_Z1);

  const pier = (px: number, pz: number, h = 2.45) => {
    c0.box(M.stoneDark, px, 0.3, pz, 0.88, 0.6, 0.88);
    c0.box(M.stone, px, 0.6 + (h - 0.95) / 2, pz, 0.74, h - 0.95, 0.74);
    c0.box(M.stoneDark, px, h - 0.325, pz, 0.94, 0.13, 0.94);
    c0.cyl(M.stone, px, h - 0.26, pz, 0.62, 0.05, 0.3, 4, Math.PI / 4);
    c0.geo(M.brass, kalasamGeometry(0.34, 0.12), new THREE.Matrix4().makeTranslation(px, h + 0.03, pz), { uv: 'keep', weather: false });
    c0.collideBox(px, pz, 0.88, 0.88);
  };
  pier(-17.1, -12.1);
  pier(17.1, -12.1);
  pier(-17.1, WALL_Z + 0.1);
  pier(17.1, WALL_Z + 0.1);
  pier(X0 - 2.45, WALL_Z + 0.25);
  pier(X0 + 2.45, WALL_Z + 0.25);

  /* ---- pond-plot doorway through the east wall ---- */
  {
    const dz0 = POND_DOOR.z0;
    const dz1 = POND_DOOR.z1;
    const midZ = (dz0 + dz1) / 2;
    const arch = new Ctx(b, world, 17.55, midZ, Math.PI / 2, 0);
    // Flush threshold across the wall thickness and a level floor through the opening.
    c0.span(M.stone, 16.9, 18.0, 0, 0.07, dz0 - 0.08, dz1 + 0.08);
    c0.floor(17.45, midZ, 1.1, dz1 - dz0, 0.07);

    // Smaller open Padippura: paired granite piers, timber architrave, and a real tiled hip roof.
    // No gate leaf or door is fitted; the full central passage remains clear.
    for (const sx of [-1, 1]) {
      const px = sx * 1.68;
      arch.box(M.stoneDark, px, 0.19, 0, 0.58, 0.38, 0.68);
      arch.box(M.stone, px, 1.12, 0, 0.38, 1.52, 0.42);
      arch.box(M.stoneDark, px, 1.91, 0, 0.56, 0.22, 0.62);
      arch.box(M.timberDark, px, 2.08, 0, 0.46, 0.12, 0.5);
      arch.collideBox(px, 0, 0.46, 0.5);
    }
    arch.box(M.timberDark, 0, 2.14, 0, 3.9, 0.28, 0.58); // heavy cross-lintel
    arch.box(M.brass, 0, 2.29, 0.31, 3.35, 0.035, 0.035); // subtle front bead
    arch.box(M.timberDark, 0, 2.37, 0, 3.75, 0.13, 0.54); // wall plate beneath rafters
    arch.box(M.timberDark, 0, 2.37, -1.05, 3.2, 0.13, 0.3);
    arch.box(M.timberDark, 0, 2.37, 1.05, 3.2, 0.13, 0.3);

    const roofOpt = { cx: 0, cz: 0, a: 2.05, b: 1.55, ye: 2.52, pitch: PITCH, thick: 0.14 };
    hipRoof(arch, M, roofOpt, 'small');
    hipRafters(arch, M.timberDark, { ...roofOpt, aw: 1.72, bw: 1.1, spacing: 0.45, w: 0.065, h: 0.09 });

  }

  /* ---- pond-plot boundary walls (west side is the shared east compound wall) ---- */
  wallSeg(POND_PLOT.x0, POND_PLOT.x1, POND_PLOT.z0, POND_PLOT.z0 + 0.5); // north
  wallSeg(POND_PLOT.x1 - 0.5, POND_PLOT.x1, POND_PLOT.z0, POND_PLOT.z1); // east
  wallSeg(POND_PLOT.x0, POND_PLOT.x1, POND_PLOT.z1 - 0.5, POND_PLOT.z1); // south
  pier(17.35, -4.25);
  pier(17.35, 10.25);
  pier(33.25, -4.25);
  pier(33.25, 10.25);

  /* ============================ MAIN GATE ============================ */
  const gate: BuildingSpec = {
    label: 'Main Gate (Padippura)', kind: 'gate', L: 4, W: 2.5, bayW: [0.6, 2.0, 0.6],
    front: 'wow', back: 'wow', left: 'w', right: 'w', stepsBoth: true,
  };
  const gateB = buildKeralaBuilding(b, world, M, gate, X0, GATE_Z, 0);
  {
    // two heavy timber gate leaves standing open against the passage sides
    const gc = gateB.ctx;
    for (const sx of [1, -1]) {
      gc.span(M.timberDark, sx * 0.8, sx * 0.87, 0.5, 2.5, -0.62, 0.72);
      gc.span(M.timber, sx * 0.78, sx * 0.89, 0.95, 1.05, -0.6, 0.7);
      gc.span(M.timber, sx * 0.78, sx * 0.89, 1.85, 1.95, -0.6, 0.7);
    }
  }

  /* ====================== CHUTTAMBALAM + SREEKOVIL ====================== */
  const R = new Ctx(b, world, X0, ZC, 0, 0); // local origin = centre of the sreekovil

  // stone plinth: 11 x 11, with the mandapam platform projecting at the front
  R.box(M.stoneDark, 0, 0.1, 0, 11, 0.2, 11);
  R.box(M.stone, 0, 0.35, 0, 10.92, 0.3, 10.92);
  R.floor(0, 0, 11, 11, P1);
  R.span(M.stoneDark, -3.5, 3.5, 0, 0.2, 5.5, 8.0);
  R.span(M.stone, -3.46, 3.46, 0.2, P1, 5.46, 7.96);
  R.floor(0, 6.75, 7, 2.5, P1);
  stairs(R, M, { axis: 'z', at: 0, edge: 7.96, dir: 1, width: 2.0, base: 0, total: P1, n: 3, tread: 0.33 });
  for (const sx of [1, -1]) {
    stairs(R, M, { axis: 'x', at: 0, edge: sx * 5.46, dir: sx as 1 | -1, width: 1.6, base: 0, total: P1, n: 3, tread: 0.33 });
  }

  // round timber columns on stone bases
  const ringColumn = (px: number, pz: number) => {
    R.cyl(M.stoneDark, px, P1, pz, 0.27, 0.24, 0.2, 10);
    R.cyl(M.timber, px, P1 + 0.2, pz, 0.175, 0.15, COL_H - 0.42, 10);
    R.cyl(M.timber, px, P1 + COL_H - 0.22, pz, 0.15, 0.25, 0.22, 10);
    R.collideBox(px, pz, 0.38, 0.38);
  };
  const O = [-5.2, -3.12, -1.04, 1.04, 3.12, 5.2];
  for (const o of O) {
    ringColumn(o, 5.2);
    ringColumn(o, -5.2);
  }
  for (const o of O.slice(1, 5)) {
    ringColumn(5.2, o);
    ringColumn(-5.2, o);
  }
  for (const x of [-3.12, -1.04, 1.04, 3.12]) ringColumn(x, 7.8); // mandapam front row

  // wall plates (dark timber beams)
  const by = P1 + COL_H + BEAM_H / 2;
  R.box(M.timberDark, 0, by, 5.2, 10.7, BEAM_H, 0.32);
  R.box(M.timberDark, 0, by, -5.2, 10.7, BEAM_H, 0.32);
  R.box(M.timberDark, 5.2, by, 0, 0.32, BEAM_H, 10.4 - 0.32);
  R.box(M.timberDark, -5.2, by, 0, 0.32, BEAM_H, 10.4 - 0.32);
  R.box(M.timberDark, 0, by, 7.8, 6.54, BEAM_H, 0.32); // mandapam front beam
  R.box(M.timberDark, 3.12, by, 6.5, 0.32, BEAM_H, 2.6 - 0.32);
  R.box(M.timberDark, -3.12, by, 6.5, 0.32, BEAM_H, 2.6 - 0.32);
  // radial tie beams: columns -> sanctum wall (clean roof / wall / column connection)
  const tb = (x0: number, z0: number, x1: number, z1: number) =>
    R.beam(M.timberDark, [x0, by, z0], [x1, by, z1], 0.2, BEAM_H - 0.02);
  for (const o of O.slice(1, 5)) {
    tb(o, 5.2, o, 2.45);
    tb(o, -5.2, o, -2.45);
    tb(5.2, o, 2.45, o);
    tb(-5.2, o, -2.45, o);
  }

  // seat-wall parapets between columns (kakshasana)
  const parapet = (x0: number, z0: number, x1: number, z1: number) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    if (alongX) {
      const cz = (z0 + z1) / 2;
      R.span(M.stoneDark, x0, x1, P1, P1 + 0.25, cz - 0.17, cz + 0.17);
      R.span(M.lime, x0, x1, P1 + 0.25, P1 + 0.8, cz - 0.13, cz + 0.13);
      R.span(M.timberDark, x0, x1, P1 + 0.8, P1 + 0.9, cz - 0.19, cz + 0.19);
      R.collide(x0, cz - 0.17, x1, cz + 0.17);
    } else {
      const cx = (x0 + x1) / 2;
      R.span(M.stoneDark, cx - 0.17, cx + 0.17, P1, P1 + 0.25, z0, z1);
      R.span(M.lime, cx - 0.13, cx + 0.13, P1 + 0.25, P1 + 0.8, z0, z1);
      R.span(M.timberDark, cx - 0.19, cx + 0.19, P1 + 0.8, P1 + 0.9, z0, z1);
      R.collide(cx - 0.17, Math.min(z0, z1), cx + 0.17, Math.max(z0, z1));
    }
  };
  for (let i = 0; i < 5; i++) parapet(O[i], -5.2, O[i + 1], -5.2); // back
  for (const i of [0, 1, 3, 4]) {
    parapet(5.2, O[i], 5.2, O[i + 1]); // east (centre bay open = side entrance)
    parapet(-5.2, O[i], -5.2, O[i + 1]); // west
  }
  parapet(-5.2, 5.2, -3.12, 5.2); // front flanks
  parapet(3.12, 5.2, 5.2, 5.2);
  parapet(-3.12, 5.2, -3.12, 7.8); // mandapam side seat-walls
  parapet(3.12, 5.2, 3.12, 7.8);
  parapet(-3.12, 7.8, -1.04, 7.8); // mandapam front, central aisle open
  parapet(1.04, 7.8, 3.12, 7.8);

  /* ---- sreekovil ---- */
  R.box(M.stoneDark, 0, 0.6, 0, 5.8, 0.2, 5.8);
  R.box(M.stone, 0, 0.8, 0, 5.72, 0.2, 5.72);
  R.floor(0, 0, 5.8, 5.8, P2);
  stairs(R, M, { axis: 'z', at: 0, edge: 2.9, dir: 1, width: 2.0, base: P1, total: P2 - P1, n: 2, tread: 0.4 });
  R.collide(-2.5, -2.5, 2.5, 2.5);

  const SY0 = P2;
  const SY1 = SREE_PLATE_TOP - BEAM_H; // 5.18 wall top
  const IN = 1.9;
  const OUT = 2.5;
  R.span(M.lime, -OUT, OUT, SY0, SY1, -OUT, -IN); // back
  R.span(M.lime, -OUT, -IN, SY0, SY1, -IN, IN); // west
  R.span(M.lime, IN, OUT, SY0, SY1, -IN, IN); // east
  R.span(M.lime, -OUT, -0.65, SY0, SY1, IN, OUT); // front, left of door
  R.span(M.lime, 0.65, OUT, SY0, SY1, IN, OUT);
  R.span(M.lime, -0.65, 0.65, SY0 + 2.3, SY1, IN, OUT); // lintel wall above door
  // stone dado + timber belt course
  const dd = OUT + 0.06;
  R.span(M.stoneDark, -dd, dd, SY0, SY0 + 0.5, -dd, -OUT);
  R.span(M.stoneDark, -dd, -OUT, SY0, SY0 + 0.5, -OUT, OUT);
  R.span(M.stoneDark, OUT, dd, SY0, SY0 + 0.5, -OUT, OUT);
  R.span(M.stoneDark, -dd, -0.75, SY0, SY0 + 0.5, OUT, dd);
  R.span(M.stoneDark, 0.75, dd, SY0, SY0 + 0.5, OUT, dd);
  R.span(M.timberDark, -dd, dd, 3.0, 3.14, -dd, -OUT);
  R.span(M.timberDark, -dd, -OUT, 3.0, 3.14, -OUT, OUT);
  R.span(M.timberDark, OUT, dd, 3.0, 3.14, -OUT, OUT);
  R.span(M.timberDark, -dd, -0.75, 3.0, 3.14, OUT, dd);
  R.span(M.timberDark, 0.75, dd, 3.0, 3.14, OUT, dd);
  for (const sx of [1, -1]) for (const sz of [1, -1]) R.box(M.timber, sx * 2.4, (SY0 + SY1) / 2, sz * 2.4, 0.4, SY1 - SY0, 0.4);
  // sanctum plate beams
  R.box(M.timberDark, 0, SY1 + BEAM_H / 2, 2.45, 5.3, BEAM_H, 0.36);
  R.box(M.timberDark, 0, SY1 + BEAM_H / 2, -2.45, 5.3, BEAM_H, 0.36);
  R.box(M.timberDark, 2.45, SY1 + BEAM_H / 2, 0, 0.36, BEAM_H, 4.6);
  R.box(M.timberDark, -2.45, SY1 + BEAM_H / 2, 0, 0.36, BEAM_H, 4.6);
  // Closed double-leaf teak door fills the sanctum opening.
  R.span(M.timberDark, -0.77, -0.65, SY0, SY0 + 2.3, IN - 0.02, OUT + 0.03);
  R.span(M.timberDark, 0.65, 0.77, SY0, SY0 + 2.3, IN - 0.02, OUT + 0.03);
  R.span(M.timberDark, -0.77, 0.77, SY0 + 2.3, SY0 + 2.46, IN - 0.02, OUT + 0.04);
  R.span(M.stone, -0.8, 0.8, SY0, SY0 + 0.06, IN, OUT + 0.08);
  const doorBottom = SY0 + 0.06;
  const doorTop = SY0 + 2.28;
  // Opaque backing keeps the sanctum fully closed from every view angle.
  R.span(M.timberDark, -0.65, 0.65, doorBottom, doorTop, 2.08, 2.17);
  // interior face: plain boards
  R.span(M.timber, -0.63, 0.63, doorBottom + 0.05, doorTop - 0.05, 2.05, 2.08);
  {
    // ---- ornate exterior face: panelled teak leaves, brass bosses, ring knockers ----
    const studGeo = new THREE.SphereGeometry(0.017, 8, 5);
    studGeo.scale(1, 1, 0.55);
    const stud = (x: number, y: number, z = 2.214, s = 1) => {
      const m = new THREE.Matrix4().makeScale(s, s, s).setPosition(x, y, z);
      R.geo(M.brass, studGeo, m, { uv: 'box', weather: false });
    };
    const leaves: [number, number][] = [[-0.63, -0.012], [0.012, 0.63]];
    const panels: [number, number][] = [
      [doorBottom + 0.16, doorBottom + 0.62],
      [doorBottom + 0.74, doorBottom + 1.42],
      [doorBottom + 1.54, doorTop - 0.16],
    ];
    const railYs: [number, number][] = [
      [doorBottom, doorBottom + 0.16], [doorBottom + 0.62, doorBottom + 0.74],
      [doorBottom + 1.42, doorBottom + 1.54], [doorTop - 0.16, doorTop],
    ];
    for (const [u0, u1] of leaves) {
      R.span(M.timberDark, u0, u0 + 0.09, doorBottom, doorTop, 2.17, 2.205);
      R.span(M.timberDark, u1 - 0.09, u1, doorBottom, doorTop, 2.17, 2.205);
      for (const [ya, yb] of railYs) R.span(M.timberDark, u0 + 0.09, u1 - 0.09, ya, yb, 2.17, 2.205);
      for (const [ya, yb] of panels) {
        const a = u0 + 0.09;
        const e = u1 - 0.09;
        R.span(M.timber, a, e, ya, yb, 2.17, 2.182);
        R.span(M.timber, a + 0.045, e - 0.045, ya + 0.045, yb - 0.045, 2.182, 2.196);
        R.span(M.brass, a + 0.03, e - 0.03, ya + 0.03, ya + 0.04, 2.182, 2.19);
        R.span(M.brass, a + 0.03, e - 0.03, yb - 0.04, yb - 0.03, 2.182, 2.19);
        R.span(M.brass, a + 0.03, a + 0.04, ya + 0.03, yb - 0.03, 2.182, 2.19);
        R.span(M.brass, e - 0.04, e - 0.03, ya + 0.03, yb - 0.03, 2.182, 2.19);
        stud((a + e) / 2, (ya + yb) / 2, 2.2, 1.6); // central rosette boss
      }
      for (const [ya, yb] of railYs) {
        const y = (ya + yb) / 2;
        for (let k = 0; k <= 5; k++) stud(u0 + 0.045 + (k * (u1 - u0 - 0.09)) / 5, y);
      }
      for (let k = 1; k < 13; k++) {
        const y = doorBottom + (k * (doorTop - doorBottom)) / 13;
        stud(u0 + 0.045, y);
        stud(u1 - 0.045, y);
      }
      for (const yc of [doorBottom + 0.02, doorTop - 0.1]) {
        R.span(M.brass, u0 + 0.005, u0 + 0.16, yc, yc + 0.08, 2.205, 2.212);
        R.span(M.brass, u1 - 0.16, u1 - 0.005, yc, yc + 0.08, 2.205, 2.212);
      }
    }
    R.span(M.brass, -0.03, 0.03, doorBottom, doorTop, 2.17, 2.215); // brass-sheathed astragal
    const ring = new THREE.TorusGeometry(0.07, 0.009, 6, 20);
    for (const sx of [-1, 1]) {
      const x = sx * 0.13;
      R.span(M.brass, x - 0.05, x + 0.05, SY0 + 1.24, SY0 + 1.36, 2.205, 2.215);
      stud(x, SY0 + 1.3, 2.222, 1.3);
      R.geo(M.brass, ring, new THREE.Matrix4().makeTranslation(x, SY0 + 1.22, 2.225), { uv: 'box', weather: false });
    }
    R.span(M.brass, -0.72, 0.72, SY0 + 0.06, SY0 + 0.09, 2.17, OUT + 0.06); // threshold sheath

    // ---- grand stepped architrave, carved lintel and pediment on the outer wall face ----
    for (const sx of [-1, 1]) {
      const xa = Math.min(sx * 0.77, sx * 0.97);
      const xb = Math.max(sx * 0.77, sx * 0.97);
      R.span(M.timberDark, xa, xb, SY0, SY0 + 2.46, OUT, OUT + 0.07);
      R.span(M.brass, Math.min(sx * 0.77, sx * 0.8), Math.max(sx * 0.77, sx * 0.8), SY0 + 0.06, SY0 + 2.4, OUT + 0.07, OUT + 0.085);
      R.span(M.timber, Math.min(sx * 0.9, sx * 1.0), Math.max(sx * 0.9, sx * 1.0), SY0, SY0 + 0.22, OUT, OUT + 0.1);
      for (let k = 0; k < 7; k++) stud(sx * 0.875, SY0 + 0.4 + k * 0.3, OUT + 0.075);
    }
    R.span(M.timberDark, -1.0, 1.0, SY0 + 2.46, SY0 + 2.64, OUT, OUT + 0.1);
    R.span(M.brass, -0.96, 0.96, SY0 + 2.5, SY0 + 2.53, OUT + 0.1, OUT + 0.11);
    for (let k = 0; k < 9; k++) stud(-0.8 + k * 0.2, SY0 + 2.585, OUT + 0.105);
    R.span(M.timberDark, -1.08, 1.08, SY0 + 2.64, SY0 + 2.71, OUT, OUT + 0.14); // cornice
    const apex = SY0 + 3.08;
    for (const sx of [-1, 1]) {
      R.beam(M.timberDark, [sx * 1.04, SY0 + 2.74, OUT + 0.07], [0, apex, OUT + 0.07], 0.12, 0.11);
    }
    R.geo(M.gold, kalasamGeometry(0.24, 0.1), new THREE.Matrix4().makeTranslation(0, apex + 0.02, OUT + 0.07), { uv: 'keep', weather: false });
    for (const sx of [-1, 1]) {
      R.geo(M.brass, kalasamGeometry(0.16, 0.07), new THREE.Matrix4().makeTranslation(sx * 0.95, SY0 + 2.71, OUT + 0.07), { uv: 'keep', weather: false });
    }
    studGeo.dispose();
    ring.dispose();
  }

  // Keep the sanctum interior empty: no deity or idol is modeled or visible.
  R.span(M.timberDark, -IN, IN, 4.0, 4.1, -IN, IN);

  /* ---- Kerala mural panels on the sreekovil's outer walls (floral / bird / lotus friezes, no figures) ---- */
  {
    const Y0 = 1.58; // frame bottom: just above the stone dado (top at 1.4)
    const Y1 = 2.88; // frame top: just under the timber belt course (3.0)
    const F = 0.07; // frame width
    const FD = 0.05; // frame projection from the wall face
    const PD = 0.03; // painted face sits 3 cm proud of the wall, recessed inside the frame
    const yc = (Y0 + Y1) / 2;
    type Wall = 'back' | 'front' | 'west' | 'east';

    // box in (along-wall, height, depth-from-wall-face) space -> local sreekovil coordinates
    const wallBox = (wall: Wall, mat: THREE.Material, a0: number, a1: number, y0: number, y1: number, d0: number, d1: number) => {
      if (wall === 'back') R.span(mat, a0, a1, y0, y1, -OUT - d1, -OUT - d0, { weather: false });
      else if (wall === 'front') R.span(mat, a0, a1, y0, y1, OUT + d0, OUT + d1, { weather: false });
      else if (wall === 'west') R.span(mat, -OUT - d1, -OUT - d0, y0, y1, a0, a1, { weather: false });
      else R.span(mat, OUT + d0, OUT + d1, y0, y1, a0, a1, { weather: false });
    };

    const panel = (wall: Wall, uc: number, wo: number, cell: MuralCell, flip = false) => {
      const a0 = uc - wo / 2;
      const a1 = uc + wo / 2;
      // teak frame: top + bottom bars, two stiles
      wallBox(wall, M.timberDark, a0, a1, Y1 - F, Y1, 0, FD);
      wallBox(wall, M.timberDark, a0, a1, Y0, Y0 + F, 0, FD);
      wallBox(wall, M.timberDark, a0, a0 + F, Y0 + F, Y1 - F, 0, FD);
      wallBox(wall, M.timberDark, a1 - F, a1, Y0 + F, Y1 - F, 0, FD);
      // fine brass bead along the inside edge of the frame
      const bd = 0.012;
      wallBox(wall, M.brass, a0 + F, a1 - F, Y1 - F - bd, Y1 - F, 0, FD + 0.006);
      wallBox(wall, M.brass, a0 + F, a1 - F, Y0 + F, Y0 + F + bd, 0, FD + 0.006);
      wallBox(wall, M.brass, a0 + F, a0 + F + bd, Y0 + F + bd, Y1 - F - bd, 0, FD + 0.006);
      wallBox(wall, M.brass, a1 - F - bd, a1 - F, Y0 + F + bd, Y1 - F - bd, 0, FD + 0.006);

      // the painting itself
      const pw = wo - 2 * F;
      const ph = Y1 - Y0 - 2 * F;
      const g = muralPlane(cell, pw, ph, flip);
      const m = new THREE.Matrix4();
      if (wall === 'back') m.makeRotationY(Math.PI).setPosition(uc, yc, -OUT - PD);
      else if (wall === 'front') m.makeTranslation(uc, yc, OUT + PD);
      else if (wall === 'west') m.makeRotationY(-Math.PI / 2).setPosition(-OUT - PD, yc, uc);
      else m.makeRotationY(Math.PI / 2).setPosition(OUT + PD, yc, uc);
      R.geo(M.mural, g, m, { uv: 'keep', weather: false });
      g.dispose();
    };

    const WO = 2.1; // wide panel frame width (two per wall, 0.1 m divider between)
    for (const wall of ['back', 'west', 'east'] as Wall[]) {
      wallBox(wall, M.timberDark, -0.05, 0.05, Y0, Y1, 0, FD); // centre divider post
    }
    panel('back', -1.1, WO, 'c0');
    panel('back', 1.1, WO, 'c1');
    panel('west', -1.1, WO, 'c2');
    panel('west', 1.1, WO, 'c3');
    panel('east', -1.1, WO, 'c3', true);
    panel('east', 1.1, WO, 'c2', true);
    // narrow panels either side of the sanctum door
    panel('front', -1.675, 0.95, 'n0');
    panel('front', 1.675, 0.95, 'n1');
  }

  // sreekovil hip roof (same pitch as everything else) + golden kalasam
  const so = { cx: 0, cz: 0, a: 3.52, b: 3.52, ye: SREE_PLATE_TOP + 0.16 - PITCH * 0.92, pitch: PITCH, thick: 0.15 };
  const { yr: sreeApex } = hipRoof(R, M, so, 'none');
  hipRafters(R, M.timberDark, { ...so, aw: 2.6, bw: 2.6, spacing: 0.45, w: 0.08, h: 0.12 });
  R.cyl(M.ridge, 0, sreeApex - 0.02, 0, 0.32, 0.14, 0.16, 8);
  R.geo(M.gold, kalasamGeometry(0.42, 0.24), new THREE.Matrix4().makeTranslation(0, sreeApex + 0.12, 0), { uv: 'keep', weather: false });

  /* ---- lower main roof: ring pyramid ∪ mandapam gable (real valleys) ---- */
  const RING = { cx: 0, cz: 0, R: 6.3, hole: 2.4, ye: PLATE_TOP + 0.16 - PITCH * 1.1, pitch: PITCH, thick: 0.14 };
  const gab = { halfW: 4.2, z0: 2.4, z1: 9.0, ye: PLATE_TOP + 0.16 - PITCH * (4.2 - 3.12) };
  const roof = mainRoof(R, M, { ...RING, g: gab, cell: 0.3 });
  R.geo(M.brass, kalasamGeometry(0.5, 0.17), new THREE.Matrix4().makeTranslation(0, roof.gableY(0) + 0.12, gab.z1 - 0.12), { uv: 'keep', weather: false });

  // mandapam gable front: lime tympanum with exposed timber framing (koodu)
  {
    const zf = 7.8;
    const sof = (x: number) => gab.ye + PITCH * (gab.halfW - Math.abs(x)) - 0.14;
    const pts = (z: number): [number, number, number][] => [
      [-3.12, PLATE_TOP - 0.07, z], [3.12, PLATE_TOP - 0.07, z], [3.12, sof(3.12), z], [0, sof(0), z], [-3.12, sof(3.12), z],
    ];
    const pb = new PolyBuf();
    pb.face(pts(zf + 0.03), [0, 0, 1]);
    pb.face(pts(zf - 0.03), [0, 0, -1]);
    R.geo(M.lime, pb.geometry(), undefined, { uv: 'box' });
    const top = sof(0);
    R.box(M.timberDark, 0, (PLATE_TOP + top) / 2, zf, 0.18, top - PLATE_TOP, 0.2); // king post
    R.box(M.timberDark, 0, 3.7, zf, 3.4, 0.13, 0.18); // collar
    R.box(M.timberDark, 0, (PLATE_TOP + top) / 2, 5.2, 0.18, top - PLATE_TOP, 0.2); // second truss post
    R.beam(M.timberDark, [-3.12, sof(3.12) - 0.07, zf + 0.06], [0, top - 0.07, zf + 0.06], 0.1, 0.16);
    R.beam(M.timberDark, [3.12, sof(3.12) - 0.07, zf + 0.06], [0, top - 0.07, zf + 0.06], 0.1, 0.16);
    R.beam(M.timberDark, [0, top - 0.09, 2.4], [0, top - 0.09, gab.z1], 0.16, 0.18); // ridge beam
    for (const sx of [1, -1]) R.beam(M.timberDark, [sx * 1.7, 3.62, zf + 0.04], [sx * 0.3, 4.3, zf + 0.04], 0.08, 0.1);
  }

  /* ============================ DEEPASTAMBHAM ============================ */
  // The large central multi-tier brass deepastambham directly in front of the temple
  buildDeepastambham(c0, world, M, X0, DEEPA_Z);

  /* ========================= AUXILIARY BUILDINGS ========================= */
  // all produced by the same procedural module
  buildKeralaBuilding(b, world, M, {
    label: 'Bali Peetham Shrine 3×3', kind: 'aux', L: 3, W: 3, bays: 1,
    front: 'S', back: 'w', left: 'w', right: 'w',
  }, X0 - 5, 7.5, 90);
  buildKeralaBuilding(b, world, M, {
    label: 'Office / Store 6×3', kind: 'aux', L: 6, W: 3, bays: 3,
    front: 'WdW', back: 'www', left: 'w', right: 'W',
  }, -14.3, 6.0, 90);
  buildKeralaBuilding(b, world, M, {
    label: 'Side Hall 9×3', kind: 'aux', L: 9, W: 3, bays: 4,
    front: 'hooh', back: 'wwww', left: 'W', right: 'W',
  }, -14.3, -4.5, 90);
  buildKeralaBuilding(b, world, M, {
    label: 'Utility Store 5×3', kind: 'aux', L: 5, W: 3, bays: 2,
    front: 'DW', back: 'ww', left: 'w', right: 'w',
  }, 13.6, -8.5, 270);

  // Front-right forecourt: the Vazhipaadu counter is its own purpose-built structure
  // (symmetric hatches, continuous ledge, queue pen) centred between the gate and east wall.
  buildVazhipaaduCounter(b, world, M, WALL_Z);

  /* ================== KATHINA VEDI GROUND (open sandy terrain, NE walk-through) ================== */
  // Dedicated open sandy ground outside the temple compound, reached through a simple walk-through gap
  // in the North-East wall. NO gopuram, NO gate structure, and NO archway. The entire cracker ground
  // features its own authentic sandy base, cleanly separating it from the village landscape.
  const VL = vediLayout(X0);
  {
    const g0 = VL.door.x0;
    const g1 = VL.door.x1;
    const midX = (g0 + g1) / 2;
    const p = VL.plot;

    // 1. Authentic sandy terrain for the cracker ground (visible, distinct sandy soil, no grass inside)
    c0.span(M.laterite, p.x0, p.x1, -0.08, 0, p.z0, -12.55, { weather: false, tint: 1.15 });

    // 2. Minimal wall-side stones to frame the walk through without building any gate/gopuram
    for (const [ax0, ax1] of [[g0 - 0.35, g0], [g1, g1 + 0.35]] as [number, number][]) {
      c0.span(M.stoneDark, ax0 - 0.05, ax1 + 0.05, 0, 0.45, -12.55, -11.95);
      c0.span(M.stoneDark, ax0 - 0.05, ax1 + 0.05, 0.45, 1.05, -12.5, -12.0);
      c0.collide(ax0 - 0.05, -12.55, ax1 + 0.05, -11.95);
    }

    // 3. Sandy threshold immediately connecting the alley to the open ground
    c0.span(M.stone, g0 - 0.1, g1 + 0.1, 0, 0.04, -12.6, -11.9, { weather: false });
    c0.floor(midX, -12.25, g1 - g0, 0.7, 0.04);

    // Open cracker ground on sandy terrain: cast-iron barrels set into the sand row-by-row
    buildVediBarrels(c0, world, M, VL.barrels);
  }

  /* ================== TEMPLE POND (KULAM), EAST PLOT ================== */
  // Stepped stone pond excavated edge-to-edge inside the plot walls: solid coping at the
  // masonry, then KULAM_STEPS crisp granite treads descending into green water.
  {
    const kx0 = KULAM.x0, kx1 = KULAM.x1, kz0 = KULAM.z0, kz1 = KULAM.z1;
    const N = KULAM_STEPS, rise = KULAM_RISE, tread = KULAM_TREAD;
    const bot = KULAM_BOTTOM_Y - 0.05; // structure runs below the basin floor so no gaps show
    const inset = (i: number) => ({
      x0: kx0 + i * tread, x1: kx1 - i * tread, z0: kz0 + i * tread, z1: kz1 - i * tread,
    });
    // Each step ring is 4 solid strips running down to the pit bottom.
    for (let i = 1; i <= N; i++) {
      const top = -i * rise;
      const o = inset(i - 1);
      const q = inset(i);
      if (i === 1) { o.x0 -= 0.08; o.x1 += 0.08; o.z0 -= 0.08; o.z1 += 0.08; } // tuck under the coping
      const strips: [number, number, number, number][] = [
        [o.x0, q.x0, o.z0, o.z1], // west tread
        [q.x1, o.x1, o.z0, o.z1], // east tread
        [q.x0, q.x1, o.z0, q.z0], // north tread
        [q.x0, q.x1, q.z1, o.z1], // south tread
      ];
      for (const [sx0, sx1, sz0, sz1] of strips) {
        c0.span(M.stone, sx0, sx1, bot, top, sz0, sz1);
        c0.floor((sx0 + sx1) / 2, (sz0 + sz1) / 2, sx1 - sx0, sz1 - sz0, top);
      }
      // Dark stone nosing along each tread's inner edge so every step reads crisply,
      // both above and below the waterline.
      const nh = 0.05;
      c0.span(M.stoneDark, q.x0, q.x0 + 0.08, top - nh, top + 0.012, q.z0, q.z1);
      c0.span(M.stoneDark, q.x1 - 0.08, q.x1, top - nh, top + 0.012, q.z0, q.z1);
      c0.span(M.stoneDark, q.x0 + 0.08, q.x1 - 0.08, top - nh, top + 0.012, q.z0, q.z0 + 0.08);
      c0.span(M.stoneDark, q.x0 + 0.08, q.x1 - 0.08, top - nh, top + 0.012, q.z1 - 0.08, q.z1);
    }
    // Basin floor
    const bb = inset(N);
    c0.span(M.stoneDark, bb.x0 - 0.12, bb.x1 + 0.12, bot, KULAM_BOTTOM_Y, bb.z0 - 0.12, bb.z1 + 0.12);
    // Flush granite coping meets the outer path at grade, so players can enter the stairs.
    c0.span(M.stoneDark, kx0 - 0.35, kx0, -0.22, 0, kz0 - 0.35, kz1 + 0.35);
    c0.span(M.stoneDark, kx1, kx1 + 0.35, -0.22, 0, kz0 - 0.35, kz1 + 0.35);
    c0.span(M.stoneDark, kx0, kx1, -0.22, 0, kz0 - 0.35, kz0);
    c0.span(M.stoneDark, kx0, kx1, -0.22, 0, kz1, kz1 + 0.35);
    c0.floor(kx0 - 0.175, (kz0 + kz1) / 2, 0.35, kz1 - kz0 + 0.7, 0);
    c0.floor(kx1 + 0.175, (kz0 + kz1) / 2, 0.35, kz1 - kz0 + 0.7, 0);
    c0.floor((kx0 + kx1) / 2, kz0 - 0.175, kx1 - kx0, 0.35, 0);
    c0.floor((kx0 + kx1) / 2, kz1 + 0.175, kx1 - kx0, 0.35, 0);
    // Ground the player on the actual basin bottom, never on the visual water surface.
    // Submerged tread rings remain independently walkable via their own floor rectangles.
    c0.floor(
      (KULAM_WATER.x0 + KULAM_WATER.x1) / 2,
      (KULAM_WATER.z0 + KULAM_WATER.z1) / 2,
      KULAM_WATER.x1 - KULAM_WATER.x0,
      KULAM_WATER.z1 - KULAM_WATER.z0,
      KULAM_BOTTOM_Y,
    );
  }

  /* ===================== TRADITIONAL CHUTTUVILAKKU ===================== */
  // Continuous rows of small brass oil lamps mounted on structural timber framing
  // along the inner-facing compound walls (pathways remain clean and unobstructed)
  buildChuttuvilakku(c0, world, M, WALL_Z);

  // No interior shrine lights: closed doors stay opaque, with no deity silhouette or glow.

  /* ========================== MAP DATA ========================== */
  world.reserved = { ...POND };
  world.compound = { x0: -17.5, x1: 17.5, z0: COMPOUND_Z0, z1: COMPOUND_Z1 };
  world.pondPlot = { ...POND_PLOT };
  world.kulam = { ...KULAM };
  world.kulamWater = { ...KULAM_WATER };
  world.pondDoor = { x0: 17, x1: 17.5, z0: POND_DOOR.z0, z1: POND_DOOR.z1 };
  world.vediPlot = { ...VL.plot };
  world.vediDoor = { x0: VL.door.x0, x1: VL.door.x1, z0: -12.5, z1: -12 };
  world.vediBarrels = VL.barrels.map((b) => ({ ...b }));
  world.footprints.push(
    { x0: X0 - 5.5, x1: X0 + 5.5, z0: ZC - 5.5, z1: ZC + 5.5, label: 'Chuttambalam 11×11', kind: 'main' },
    { x0: X0 - 2.5, x1: X0 + 2.5, z0: ZC - 2.5, z1: ZC + 2.5, label: 'Sreekovil 5×5', kind: 'main' },
    { x0: X0 - 3.5, x1: X0 + 3.5, z0: ZC + 5.5, z1: ZC + 8.0, label: 'Namaskara Mandapam 7×5', kind: 'main' },
    { x0: X0 - 1.0, x1: X0 + 1.0, z0: DEEPA_Z - 1.0, z1: DEEPA_Z + 1.0, label: 'Deepastambham', kind: 'lamp' },
  );

  const group = b.build();

  /* ---- Kulam water: real volume (tinted body) + drifting reflective surface ---- */
  {
    // The body is inset 3 cm so its walls never z-fight the step risers.
    const wx0 = KULAM_WATER.x0 + 0.03, wx1 = KULAM_WATER.x1 - 0.03;
    const wz0 = KULAM_WATER.z0 + 0.03, wz1 = KULAM_WATER.z1 - 0.03;
    const yT = KULAM_WATER_Y;
    const yB = KULAM_BOTTOM_Y + 0.02;
    const shallow: V3 = [0.17, 0.62, 0.42];
    const deep: V3 = [0.012, 0.13, 0.085];
    const pos: number[] = [];
    const col: number[] = [];
    const quad = (
      a: V3, b2: V3, c2: V3, d2: V3,
      ca: V3, cb: V3, cc: V3, cd: V3,
    ) => {
      pos.push(...a, ...b2, ...c2, ...a, ...c2, ...d2);
      col.push(...ca, ...cb, ...cc, ...ca, ...cc, ...cd);
    };
    // basin bottom
    quad([wx0, yB, wz0], [wx1, yB, wz0], [wx1, yB, wz1], [wx0, yB, wz1], deep, deep, deep, deep);
    // four side walls: bright at the waterline, darkening with depth
    quad([wx0, yT, wz0], [wx1, yT, wz0], [wx1, yB, wz0], [wx0, yB, wz0], shallow, shallow, deep, deep);
    quad([wx1, yT, wz1], [wx0, yT, wz1], [wx0, yB, wz1], [wx1, yB, wz1], shallow, shallow, deep, deep);
    quad([wx1, yT, wz0], [wx1, yT, wz1], [wx1, yB, wz1], [wx1, yB, wz0], shallow, shallow, deep, deep);
    quad([wx0, yT, wz1], [wx0, yT, wz0], [wx0, yB, wz0], [wx0, yB, wz1], shallow, shallow, deep, deep);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    bg.computeVertexNormals();
    const body = new THREE.Mesh(bg, M.waterBody);
    body.name = 'kulamWaterBody';
    body.renderOrder = 1;
    group.add(body);

    // surface sheet, oversized under the dry tread so the waterline seam stays hidden
    const sg = new THREE.PlaneGeometry(KULAM_WATER.x1 - KULAM_WATER.x0 + 0.14, KULAM_WATER.z1 - KULAM_WATER.z0 + 0.14);
    sg.rotateX(-Math.PI / 2);
    const sm = new THREE.Mesh(sg, M.water);
    sm.name = 'kulamWater';
    sm.position.set((KULAM_WATER.x0 + KULAM_WATER.x1) / 2, KULAM_WATER_Y, (KULAM_WATER.z0 + KULAM_WATER.z1) / 2);
    sm.receiveShadow = true;
    sm.renderOrder = 2;
    group.add(sm);
  }
  return { world, group, triangles: b.triangles };
}
