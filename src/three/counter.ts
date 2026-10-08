import * as THREE from 'three';
import { Batch, Ctx, V3, World } from './batch';
import type { Mats } from './materials';
import { PITCH, hipRafters, hipRoof } from './roof';

/** Centre of the counter, midway between the main-gate pier (x ≈ 0.4) and the east wall (x = 17). */
export const COUNTER_X = 8.7;

const PIPE = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Vazhipaadu (offering) counter. Deliberately NOT built from the generic temple-building
 * module: it is a symmetric service counter with a granite serving slab, five identical
 * open hatches, a centred staff door at the back and five parallel queue lanes out front.
 * It uses the same roof pitch, timber, lime and stone language so it still belongs.
 * Everything is rectilinear: no diagonal braces anywhere.
 *
 * Local frame: origin at the centre of the body, +z faces the courtyard (world -z).
 */
export function buildVazhipaaduCounter(b: Batch, world: World, M: Mats, wallZ: number) {
  const bays = 5;
  const bay = 1.7;
  const xl = (bays * bay) / 2; // post centre-lines at ±4.25
  const zl = 1.0; // front / back wall centre-lines at ±1.0
  const PH = 0.2; // low plinth: a counter, not a shrine
  const H = 2.6; // clear post height above the plinth
  const BH = 0.22; // wall plate
  const OH = 0.85; // eave overhang (same as every other roof on site)
  const TH = 0.14; // roof thickness
  const WT = 0.26; // wall thickness
  const vt = WT / 2;
  const y0 = PH;
  const L = 2 * xl + 0.8; // 9.3 m plinth
  const D = 2 * zl + 0.8; // 2.8 m plinth
  const zc = wallZ - 0.75 - D / 2; // back plinth edge stays 0.75 m clear of the front wall's lamp rail

  const c = new Ctx(b, world, COUNTER_X, zc, Math.PI, 0);
  const c0 = new Ctx(b, world, 0, 0, 0, 0);
  const flat = { weather: false };

  /* ---------------- plinth ---------------- */
  c.box(M.stoneDark, 0, 0.07, 0, L, 0.14, D);
  c.box(M.stone, 0, 0.17, 0, L - 0.1, 0.06, D - 0.1);

  /* ---------------- posts ---------------- */
  const xs = Array.from({ length: bays + 1 }, (_, i) => -xl + i * bay);
  for (const px of xs) {
    c.box(M.stoneDark, px, y0 + 0.06, zl, 0.42, 0.12, 0.42);
    c.box(M.timber, px, y0 + H / 2, zl, 0.3, H, 0.3);
    c.box(M.timberDark, px, y0 + H - 0.1, zl, 0.4, 0.2, 0.4);
  }
  for (const px of [xs[0], xs[bays]]) {
    c.box(M.stoneDark, px, y0 + 0.06, -zl, 0.42, 0.12, 0.42);
    c.box(M.timber, px, y0 + H / 2, -zl, 0.3, H, 0.3);
  }

  /* ---------------- wall plates ---------------- */
  const by = y0 + H + BH / 2;
  c.box(M.timberDark, 0, by, zl, 2 * xl + 0.34, BH, 0.32);
  c.box(M.timberDark, 0, by, -zl, 2 * xl + 0.34, BH, 0.32);
  c.box(M.timberDark, xl, by, 0, 0.32, BH, 2 * zl - 0.32);
  c.box(M.timberDark, -xl, by, 0, 0.32, BH, 2 * zl - 0.32);

  /* ---------------- front: panelled counter base + framed open hatch per bay ---------------- */
  const hw = (bay - 0.3) / 2; // half clear width between post faces
  const ledgeY0 = y0 + 0.99; // underside of the granite slab
  const ledgeY1 = y0 + 1.07; // serving surface
  const hatchTop = y0 + 2.05;
  const slabFront = zl + vt + 0.36;
  const slabX = xl + 0.2;

  for (let i = 0; i < bays; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    // lower body: stone dado + lime wall, with a raised timber panel moulding on the front face
    c.span(M.stoneDark, cx - hw, cx + hw, y0, y0 + 0.4, zl - vt - 0.03, zl + vt + 0.03);
    c.span(M.lime, cx - hw, cx + hw, y0, ledgeY0, zl - vt, zl + vt);
    const pw0 = cx - hw + 0.2;
    const pw1 = cx + hw - 0.2;
    const py0 = y0 + 0.5;
    const py1 = y0 + 0.86;
    const t = 0.04;
    const mz0 = zl + vt;
    const mz1 = zl + vt + 0.025;
    c.span(M.timberDark, pw0, pw1, py0, py0 + t, mz0, mz1);
    c.span(M.timberDark, pw0, pw1, py1 - t, py1, mz0, mz1);
    c.span(M.timberDark, pw0, pw0 + t, py0, py1, mz0, mz1);
    c.span(M.timberDark, pw1 - t, pw1, py0, py1, mz0, mz1);

    // hatch frame: jamb trims + a deep header beam
    for (const sx of [-1, 1]) {
      const jx = cx + sx * (hw - 0.03);
      c.span(M.timberDark, jx - 0.03, jx + 0.03, ledgeY1, hatchTop, zl - 0.15, zl + 0.15);
    }
    c.span(M.timberDark, cx - hw, cx + hw, hatchTop, hatchTop + 0.16, zl - 0.14, zl + 0.14);

    // above the header: a row of timber balusters instead of solid wall (ventilated, lighter)
    const barY0 = hatchTop + 0.16;
    const barY1 = y0 + H;
    const nBars = Math.floor((2 * hw - 0.14) / 0.1) + 1;
    for (let k = 0; k < nBars; k++) {
      const bx = cx - hw + 0.07 + k * 0.1;
      c.span(M.timberDark, bx - 0.017, bx + 0.017, barY0, barY1, zl - 0.017, zl + 0.017);
    }

  }

  // Continuous granite serving slab across every hatch. It is carried by a stepped timber
  // apron: flat layers only, no diagonal brackets.
  c.span(M.carvedStone, -slabX, slabX, ledgeY0, ledgeY1, zl, slabFront);
  c.span(M.timberDark, -slabX, slabX, ledgeY0 - 0.1, ledgeY0, zl + vt, slabFront - 0.1);
  c.span(M.timber, -slabX - 0.02, slabX + 0.02, ledgeY0 - 0.02, ledgeY1 + 0.03, slabFront, slabFront + 0.03); // front nosing
  c.span(M.brass, -slabX, slabX, ledgeY1 + 0.03, ledgeY1 + 0.036, slabFront - 0.02, slabFront + 0.03); // brass edge line

  /* ---------------- back wall with a centred staff door ---------------- */
  const dhw = 0.5;
  const dh = 2.05;
  const zb = -zl;
  c.span(M.stoneDark, -xl, -dhw, y0, y0 + 0.4, zb - vt - 0.03, zb + vt + 0.03);
  c.span(M.stoneDark, dhw, xl, y0, y0 + 0.4, zb - vt - 0.03, zb + vt + 0.03);
  c.span(M.lime, -xl, -dhw, y0, y0 + H, zb - vt, zb + vt);
  c.span(M.lime, dhw, xl, y0, y0 + H, zb - vt, zb + vt);
  c.span(M.lime, -dhw, dhw, y0 + dh, y0 + H, zb - vt, zb + vt);
  c.span(M.timberDark, -dhw - 0.09, -dhw, y0, y0 + dh, zb - vt - 0.03, zb + vt + 0.03);
  c.span(M.timberDark, dhw, dhw + 0.09, y0, y0 + dh, zb - vt - 0.03, zb + vt + 0.03);
  c.span(M.timberDark, -dhw - 0.09, dhw + 0.09, y0 + dh, y0 + dh + 0.13, zb - vt - 0.04, zb + vt + 0.04);
  c.span(M.stone, -dhw - 0.09, dhw + 0.09, y0, y0 + 0.04, zb - vt - 0.06, zb + vt + 0.06);
  // closed double door: solid backing + planked outer face + brass pulls
  c.span(M.timberDark, -dhw, dhw, y0 + 0.04, y0 + dh, zb - 0.06, zb + 0.06);
  for (const [u0, u1] of [[-dhw + 0.035, -0.006], [0.006, dhw - 0.035]] as [number, number][]) {
    const plankW = (u1 - u0 - 0.016) / 3;
    for (let k = 0; k < 3; k++) {
      const a = u0 + k * (plankW + 0.008);
      c.span(M.timber, a, a + plankW, y0 + 0.16, y0 + dh - 0.12, zb - 0.078, zb - 0.062);
    }
    for (const ry of [y0 + 0.12, y0 + 0.98, y0 + dh - 0.2]) {
      c.span(M.timberDark, u0, u1, ry, ry + 0.08, zb - 0.082, zb - 0.062);
    }
  }
  for (const sx of [-1, 1]) c.span(M.brass, sx * 0.075 - 0.015, sx * 0.075 + 0.015, y0 + 1.1, y0 + 1.22, zb - 0.1, zb - 0.082);
  c.span(M.stone, -0.75, 0.75, 0, 0.1, -D / 2 - 0.34, -D / 2 + 0.02); // service step

  /* ---------------- end walls ---------------- */
  for (const sx of [-1, 1]) {
    const wx = sx * xl;
    c.span(M.stoneDark, wx - vt - 0.03, wx + vt + 0.03, y0, y0 + 0.4, -zl, zl);
    c.span(M.lime, wx - vt, wx + vt, y0, y0 + H, -zl, zl);
  }

  /* ---------------- interior: ceiling and a plain staff desk (no display glasses or plates) ---------------- */
  c.span(M.timberDark, -xl + 0.15, xl - 0.15, y0 + H - 0.02, y0 + H + 0.04, -zl + 0.15, zl - 0.15);
  c.span(M.timber, -xl + 0.3, xl - 0.3, y0 + 0.76, y0 + 0.82, -0.2, 0.55); // desk
  for (const lx of [-xl + 0.4, xl - 0.4]) c.span(M.timberDark, lx - 0.05, lx + 0.05, y0, y0 + 0.76, -0.15, 0.5);

  /* ---------------- roof: same pitch / overhang / thickness as every other roof ---------------- */
  const aw = xl + 0.17;
  const bw = zl + 0.17;
  const a = aw + OH;
  const bb = bw + OH;
  const plateTop = y0 + H + BH;
  const ye = plateTop + 0.16 - PITCH * OH;
  const ho = { cx: 0, cz: 0, a, b: bb, ye, pitch: PITCH, thick: TH };
  hipRoof(c, M, ho, 'small');
  hipRafters(c, M.timberDark, { ...ho, aw, bw, spacing: 0.5 });

  /* ---------------- bilingual signboard, centred on the front eave ---------------- */
  {
    const sy = ye - 0.26; // hangs on the eave's outer edge so the overhang never hides it
    const sz = bb + 0.035;
    c.box(M.timberDark, 0, sy, sz, 5.0, 0.86, 0.07, flat); // teak backboard
    for (const dy of [-0.415, 0.415]) c.box(M.brass, 0, sy + dy, sz + 0.05, 4.96, 0.03, 0.03, flat);
    for (const sx of [-2.49, 2.49]) c.box(M.brass, sx, sy, sz + 0.05, 0.03, 0.86, 0.03, flat);
    const plane = new THREE.PlaneGeometry(4.88, 0.751);
    c.geo(M.counterSign, plane, new THREE.Matrix4().makeTranslation(0, sy, sz + 0.041), { uv: 'keep', weather: false });
    plane.dispose();
  }

  /* ---------------- collision + map ---------------- */
  c.collide(-L / 2, -D / 2, L / 2, slabFront + 0.03);
  const fp = c.rect(-L / 2, -D / 2, L / 2, D / 2);
  world.footprints.push({ ...fp, label: 'Vazhipaadu Counter', kind: 'aux' });
  const frontZ = zc - (slabFront + 0.03); // world z of the slab's outer edge

  /* ====================================================================
   * Queue pen: five identical, straight, equal-length lanes in blue steel pipe.
   * No crossbars, no turns and no diagonal segments: each customer simply walks
   * straight from the far end to one of the five corresponding service hatches.
   * ==================================================================== */
  const lanes = 5;
  const laneW = 1.2;
  const px0 = COUNTER_X - (lanes * laneW) / 2;
  const X = (k: number) => px0 + k * laneW;
  const zNear = frontZ - 1.0; // leaves a 1 m walkway in front of the hatches
  const zFar = 8.4; // stays clear of the reserved 10 × 6 m pond area (z ≤ 7.8)
  // paving under the whole pen, running up to the counter plinth
  c0.span(M.paving, px0 - 0.6, px0 + lanes * laneW + 0.6, 0, 0.04, zFar - 0.4, zc - D / 2, flat);

  const segs: [number, number, number, number][] = [];
  const run = (x0: number, z0: number, x1: number, z1: number) => segs.push([x0, z0, x1, z1]);

  for (let k = 0; k <= lanes; k++) run(X(k), zFar, X(k), zNear);

  // unique posts at every joint, spaced evenly (≤ 1.3 m) along each run
  const posts = new Map<string, [number, number]>();
  const addPost = (x: number, z: number) => posts.set(`${Math.round(x * 100)},${Math.round(z * 100)}`, [x, z]);
  for (const [x0, z0, x1, z1] of segs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / 1.3));
    for (let i = 0; i <= n; i++) addPost(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
  }

  const pipe = (p0: V3, p1: V3, r: number) => {
    const va = new THREE.Vector3(...p0);
    const vb = new THREE.Vector3(...p1);
    const d = vb.clone().sub(va);
    const len = d.length();
    const m = new THREE.Matrix4().compose(
      va.clone().add(vb).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()),
      new THREE.Vector3(r, len, r),
    );
    c0.geo(M.queueRail, PIPE, m, flat);
  };

  const PATH_TOP = 1.0;
  const PATH_MID = 0.55;
  const cap = new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const [px, pz] of posts.values()) {
    c0.cyl(M.queueRail, px, 0.04, pz, 0.12, 0.105, 0.022, 14, 0, flat); // round base flange
    c0.cyl(M.queueRail, px, 0.06, pz, 0.032, 0.032, PATH_TOP + 0.03, 10, 0, flat); // post
    c0.geo(M.queueRail, cap, new THREE.Matrix4().makeTranslation(px, 0.06 + PATH_TOP + 0.03, pz), flat); // dome cap
  }
  cap.dispose();

  for (const [x0, z0, x1, z1] of segs) {
    pipe([x0, PATH_TOP, z0], [x1, PATH_TOP, z1], 0.026); // top rail
    pipe([x0, PATH_MID, z0], [x1, PATH_MID, z1], 0.02); // mid rail
    world.colliders.push({
      x0: Math.min(x0, x1) - 0.09, x1: Math.max(x0, x1) + 0.09,
      z0: Math.min(z0, z1) - 0.09, z1: Math.max(z0, z1) + 0.09,
    });
  }

  // soft light under the eave so the counter and board read at night
  world.lights.push({ x: COUNTER_X, y: 2.2, z: frontZ - 0.5, intensity: 9, distance: 10 });

  return { ctx: c, frontZ };
}
