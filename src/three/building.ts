import * as THREE from 'three';
import { Batch, Ctx, World } from './batch';
import type { Mats } from './materials';
import { PITCH, hipRafters, hipRoof, kalasamGeometry } from './roof';

/**
 * ONE reusable Kerala temple-building module.
 * Every auxiliary building (shrine, store, office, side hall, gatehouse) is generated from this
 * function by changing length / width / bay layout / openings only. Roof pitch, post height,
 * plinth, overhang, wall thickness and materials are constants shared by every variant.
 *
 * Bay codes (one char per bay):
 *   w wall   h half-wall (seat wall)   o open (columns only)
 *   d open door   D closed door   W closed timber-shutter window   g grilled door (shrine)
 *   C open service counter hatch with a fixed timber sill
 */
export interface BuildingSpec {
  label: string;
  kind: 'aux' | 'gate';
  L: number; // length along local X (footprint at plinth)
  W: number; // depth along local Z
  bays?: number;
  bayW?: number[];
  front: string; // +Z side, one char per bay
  back: string; // -Z side
  left: string; // -X end (single bay)
  right: string; // +X end
  stepsBoth?: boolean;
  interior?: 'peetham' | 'none';
}

export const MODULE = {
  plinth: 0.45,
  post: 2.6, // clear post height above the plinth
  beam: 0.22, // wall-plate depth
  overhang: 0.85,
  thick: 0.14,
  wall: 0.26,
  inset: 0.4, // plinth edge -> wall centre-line
};

export function buildKeralaBuilding(
  b: Batch, world: World, M: Mats, s: BuildingSpec, x: number, z: number, rotDeg: number,
) {
  const c = new Ctx(b, world, x, z, THREE.MathUtils.degToRad(rotDeg), 0);
  const { plinth: PH, post: H, beam: BH, overhang: OH, thick: TH, wall: WT, inset: IN } = MODULE;
  const xl = s.L / 2 - IN;
  const zl = s.W / 2 - IN;
  const nb = s.bayW ? s.bayW.length : s.bays ?? 1;
  const bw = s.bayW ?? Array.from({ length: nb }, () => (2 * xl) / nb);
  const xs: number[] = [-xl];
  for (const w of bw) xs.push(xs[xs.length - 1] + w);
  const y0 = PH;

  /* ---------- stone plinth (raised, two courses) ---------- */
  c.box(M.stoneDark, 0, 0.1, 0, s.L, 0.2, s.W);
  c.box(M.stone, 0, 0.325, 0, s.L - 0.08, 0.25, s.W - 0.08);
  c.floor(0, 0, s.L, s.W, PH);

  /* ---------- steps ---------- */
  const entryOf = (code: string) => {
    const idx: number[] = [];
    for (let i = 0; i < code.length; i++) if ('odDgS'.includes(code[i])) idx.push(i);
    if (!idx.length) return null;
    const a = xs[idx[0]];
    const e = xs[idx[idx.length - 1] + 1];
    return { cx: (a + e) / 2, w: Math.min(4, Math.max(1.2, e - a - 0.3)) };
  };
  const steps = (dirZ: 1 | -1, cx: number, width: number) => {
    const n = 3;
    const rise = PH / n;
    const tread = 0.3;
    for (let k = 1; k < n; k++) {
      const dz0 = (n - 1 - k) * tread;
      const za = dirZ * (s.W / 2 - 0.04 + dz0);
      const zb = dirZ * (s.W / 2 - 0.04 + dz0 + tread);
      c.span(M.stone, cx - width / 2, cx + width / 2, 0, k * rise, Math.min(za, zb), Math.max(za, zb));
      c.floor(cx, (za + zb) / 2, width, tread, k * rise);
    }
  };
  const ef = entryOf(s.front);
  if (ef) steps(1, ef.cx, ef.w);
  const eb = entryOf(s.back);
  if (eb && (s.stepsBoth || !ef)) steps(-1, eb.cx, eb.w);

  /* ---------- posts / columns ---------- */
  const isOpen = (ch: string | undefined) => ch === 'o' || ch === 'h';
  const square = (px: number, pz: number, size: number) => {
    c.box(M.timber, px, y0 + H / 2, pz, size, H, size);
    c.collideBox(px, pz, size, size);
  };
  const column = (px: number, pz: number) => {
    c.cyl(M.stoneDark, px, y0, pz, 0.21, 0.19, 0.16, 10);
    c.cyl(M.timber, px, y0 + 0.16, pz, 0.135, 0.115, H - 0.36, 10);
    c.cyl(M.timber, px, y0 + H - 0.2, pz, 0.115, 0.2, 0.2, 10);
    c.collideBox(px, pz, 0.3, 0.3);
  };
  for (const side of [1, -1]) {
    const code = side === 1 ? s.front : s.back;
    for (let i = 0; i <= nb; i++) {
      const corner = i === 0 || i === nb;
      if (corner) square(xs[i], side * zl, 0.34);
      else if (isOpen(code[i - 1]) || isOpen(code[i])) column(xs[i], side * zl);
      else square(xs[i], side * zl, 0.32);
    }
  }

  /* ---------- wall plates ---------- */
  const by = y0 + H + BH / 2;
  c.box(M.timberDark, 0, by, zl, 2 * xl + 0.34, BH, 0.32);
  c.box(M.timberDark, 0, by, -zl, 2 * xl + 0.34, BH, 0.32);
  c.box(M.timberDark, xl, by, 0, 0.32, BH, 2 * zl - 0.32);
  c.box(M.timberDark, -xl, by, 0, 0.32, BH, 2 * zl - 0.32);

  /* ---------- wall runs ---------- */
  const run = (cx: number, cz: number, len: number, alongX: boolean, type: string, _out: 1 | -1) => {
    const B = (mat: THREE.Material, u0: number, u1: number, ya: number, yb: number, v0: number, v1: number) => {
      if (alongX) c.span(mat, cx + u0, cx + u1, ya, yb, cz + v0, cz + v1);
      else c.span(mat, cx + v0, cx + v1, ya, yb, cz + u0, cz + u1);
    };
    const block = () => {
      if (alongX) c.collide(cx - len / 2, cz - WT / 2, cx + len / 2, cz + WT / 2);
      else c.collide(cx - WT / 2, cz - len / 2, cx + WT / 2, cz + len / 2);
    };
    const hl = len / 2;
    const vt = WT / 2;
    const dado = (u0: number, u1: number) => B(M.stoneDark, u0, u1, y0, y0 + 0.4, -vt - 0.03, vt + 0.03);
    if (type === 'w') {
      dado(-hl, hl);
      B(M.lime, -hl, hl, y0, y0 + H, -vt, vt);
      block();
    } else if (type === 'h') {
      dado(-hl, hl);
      B(M.lime, -hl, hl, y0, y0 + 0.9, -vt, vt);
      B(M.timberDark, -hl, hl, y0 + 0.9, y0 + 1.0, -0.17, 0.17);
      block();
    } else if (type === 'd' || type === 'D' || type === 'g' || type === 'S') {
      const dw = Math.min(1.1, len - 0.55);
      const hw = dw / 2;
      const dh = 2.05;
      dado(-hl, -hw);
      dado(hw, hl);
      B(M.lime, -hl, -hw, y0, y0 + H, -vt, vt);
      B(M.lime, hw, hl, y0, y0 + H, -vt, vt);
      B(M.lime, -hw, hw, y0 + dh, y0 + H, -vt, vt);
      B(M.timberDark, -hw - 0.09, -hw, y0, y0 + dh, -vt - 0.03, vt + 0.03);
      B(M.timberDark, hw, hw + 0.09, y0, y0 + dh, -vt - 0.03, vt + 0.03);
      B(M.timberDark, -hw - 0.09, hw + 0.09, y0 + dh, y0 + dh + 0.13, -vt - 0.04, vt + 0.04);
      B(M.stone, -hw - 0.09, hw + 0.09, y0, y0 + 0.04, -vt - 0.06, vt + 0.06);
      if (type === 'S') {
        // Shrine door: closed, with modest brass detailing (less grand than the sreekovil door).
        const out = _out;
        const W0 = (u: number, y: number, v: number): THREE.Matrix4 =>
          alongX
            ? new THREE.Matrix4().makeTranslation(cx + u, y, cz + v)
            : new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(cx + v, y, cz + u);
        const stud = new THREE.SphereGeometry(0.014, 6, 4);
        stud.scale(1, 1, 0.6);
        const ring = new THREE.TorusGeometry(0.045, 0.007, 5, 14);
        const db = y0 + 0.04;
        const dt = y0 + dh;
        const fv = out * 0.07; // exterior face
        B(M.timberDark, -hw, hw, db, dt, -0.05, 0.05);
        for (const [u0, u1] of [[-hw + 0.02, -0.006], [0.006, hw - 0.02]] as [number, number][]) {
          B(M.timber, u0, u1, db + 0.03, dt - 0.03, Math.min(out * 0.05, fv), Math.max(out * 0.05, fv));
          for (const y of [db + 0.18, y0 + 1.05, dt - 0.18]) {
            B(M.timberDark, u0, u1, y - 0.05, y + 0.05, Math.min(out * 0.07, out * 0.085), Math.max(out * 0.07, out * 0.085));
            for (let k = 0; k < 3; k++) {
              c.geo(M.brass, stud, W0(u0 + 0.07 + (k * (u1 - u0 - 0.14)) / 2, y, out * 0.09), { uv: 'box', weather: false });
            }
          }
        }
        for (const su of [-1, 1]) {
          c.geo(M.brass, ring, W0(su * 0.09, y0 + 1.2, out * 0.092), { uv: 'box', weather: false });
        }
        B(M.brass, -hw - 0.09, hw + 0.09, y0 + dh + 0.05, y0 + dh + 0.08, Math.min(out * 0.17, out * 0.18), Math.max(out * 0.17, out * 0.18));
        B(M.timber, -hw - 0.14, hw + 0.14, y0 + dh + 0.13, y0 + dh + 0.19, -vt - 0.06, vt + 0.06);
        stud.dispose();
        ring.dispose();
        block();
      } else if (type === 'D') {
        // Solid backing closes the opening; timber boards and rails dress both faces.
        const doorBottom = y0 + 0.04;
        const doorTop = y0 + dh;
        B(M.timberDark, -hw, hw, doorBottom, doorTop, -0.06, 0.06);
        for (const face of [-1, 1]) {
          const v0 = face > 0 ? 0.062 : -0.078;
          const v1 = face > 0 ? 0.078 : -0.062;
          const gap = 0.012;
          const leaves: [number, number][] = [
            [-hw + 0.035, -gap / 2],
            [gap / 2, hw - 0.035],
          ];
          for (const [u0, u1] of leaves) {
            const count = 3;
            const plankGap = 0.008;
            const plankW = (u1 - u0 - plankGap * (count - 1)) / count;
            for (let k = 0; k < count; k++) {
              const a = u0 + k * (plankW + plankGap);
              B(M.timber, a, a + plankW, doorBottom + 0.12, doorTop - 0.12, v0, v1);
            }
            B(M.timberDark, u0, u1, doorBottom + 0.08, doorBottom + 0.15, v0, v1);
            B(M.timberDark, u0, u1, y0 + 0.92, y0 + 1.02, v0, v1);
            B(M.timberDark, u0, u1, doorTop - 0.15, doorTop - 0.08, v0, v1);
          }
          B(M.timberDark, -hw + 0.015, -hw + 0.055, doorBottom + 0.05, doorTop - 0.05, v0, v1);
          B(M.timberDark, hw - 0.055, hw - 0.015, doorBottom + 0.05, doorTop - 0.05, v0, v1);
          B(M.timberDark, -0.025, 0.025, doorBottom + 0.05, doorTop - 0.05, v0, v1);
          B(M.brass, -0.085, -0.055, y0 + 1.13, y0 + 1.22, face > 0 ? 0.079 : -0.082, face > 0 ? 0.092 : -0.079);
          B(M.brass, 0.055, 0.085, y0 + 1.13, y0 + 1.22, face > 0 ? 0.079 : -0.082, face > 0 ? 0.092 : -0.079);
        }
        block();
      } else {
        // open leaf swung back against the inside face
        B(M.timberDark, -hw + 0.01, -hw + 0.07, y0 + 0.04, y0 + dh, -vt - dw * 0.92, -vt);
        if (type === 'g') {
          for (let u = -hw + 0.12; u <= hw - 0.1; u += 0.14) B(M.timber, u - 0.018, u + 0.018, y0 + 0.1, y0 + dh - 0.08, -0.018, 0.018);
          B(M.timber, -hw, hw, y0 + 0.55, y0 + 0.6, -0.025, 0.025);
          B(M.timber, -hw, hw, y0 + 1.5, y0 + 1.55, -0.025, 0.025);
          block();
        } else {
          if (alongX) {
            c.collide(cx - hl, cz - vt, cx - hw, cz + vt);
            c.collide(cx + hw, cz - vt, cx + hl, cz + vt);
          } else {
            c.collide(cx - vt, cz - hl, cx + vt, cz - hw);
            c.collide(cx - vt, cz + hw, cx + vt, cz + hl);
          }
        }
      }
    } else if (type === 'C') {
      // A waist-height masonry counter closes the lower bay. Only the serving hatch
      // is open, so the player cannot walk through it as if it were a doorway.
      const opening = Math.max(0.8, len - 0.34);
      const half = opening / 2;
      const sill = y0 + 0.82;
      const head = y0 + 2.1;
      dado(-hl, hl);
      B(M.lime, -hl, hl, y0, sill, -vt, vt);
      B(M.lime, -hl, -half, sill, y0 + H, -vt, vt);
      B(M.lime, half, hl, sill, y0 + H, -vt, vt);
      B(M.lime, -half, half, head, y0 + H, -vt, vt);
      B(M.timberDark, -half - 0.07, -half, sill, head, -vt - 0.04, vt + 0.04);
      B(M.timberDark, half, half + 0.07, sill, head, -vt - 0.04, vt + 0.04);
      B(M.timberDark, -half - 0.07, half + 0.07, head, head + 0.12, -vt - 0.04, vt + 0.04);
      // Serving ledge projects into the courtyard; a second narrow slab braces it inside.
      const outside = _out === 1 ? [vt - 0.04, vt + 0.38] : [-vt - 0.38, -vt + 0.04];
      B(M.timberDark, -half - 0.08, half + 0.08, sill - 0.075, sill + 0.025, outside[0], outside[1]);
      B(M.timber, -half, half, sill - 0.045, sill + 0.005, -vt - 0.13, vt + 0.13);
      // Short folded-back timber shutter sits under the lintel, leaving the hatch usable.
      B(M.timber, -half + 0.06, half - 0.06, head - 0.18, head - 0.08,
        _out === 1 ? vt + 0.06 : -vt - 0.12, _out === 1 ? vt + 0.12 : -vt - 0.06);
      block();
    } else if (type === 'W') {
      const ww = Math.min(0.9, len - 0.7);
      const hw = ww / 2;
      const winBottom = y0 + 1.02;
      const winTop = y0 + 1.93;
      const out = _out;
      // Keep the shutter close to the exterior face while fully covering the opening.
      const panelFace = out * (vt - 0.03);
      const panelInnerA = panelFace - out * 0.024;
      const panelInnerB = panelFace - out * 0.006;
      const slatFace = panelFace + out * 0.012;
      const slatV0 = slatFace - out * 0.018;
      const slatV1 = slatFace + out * 0.018;
      dado(-hl, hl);
      B(M.lime, -hl, -hw, y0, y0 + H, -vt, vt);
      B(M.lime, hw, hl, y0, y0 + H, -vt, vt);
      B(M.lime, -hw, hw, y0, y0 + 1.0, -vt, vt);
      B(M.lime, -hw, hw, y0 + 1.95, y0 + H, -vt, vt);
      B(M.timberDark, -hw - 0.08, hw + 0.08, y0 + 0.94, y0 + 1.02, -vt - 0.05, vt + 0.05);
      B(M.timberDark, -hw - 0.08, hw + 0.08, y0 + 1.95, y0 + 2.05, -vt - 0.04, vt + 0.04);
      B(M.timberDark, -hw - 0.08, -hw, y0 + 1.0, y0 + 1.95, -vt - 0.03, vt + 0.03);
      B(M.timberDark, hw, hw + 0.08, y0 + 1.0, y0 + 1.95, -vt - 0.03, vt + 0.03);
      // Solid backing guarantees the window is closed; paired planks read as timber shutters.
      B(M.timberDark, -hw + 0.025, hw - 0.025, winBottom + 0.015, winTop - 0.015, panelInnerA, panelInnerB);
      const leafGap = 0.012;
      const leafRanges: [number, number][] = [
        [-hw + 0.045, -leafGap / 2],
        [leafGap / 2, hw - 0.045],
      ];
      const slats = 6;
      const slatH = (winTop - winBottom - 0.07) / slats;
      for (const [u0, u1] of leafRanges) {
        for (let k = 0; k < slats; k++) {
          const ya = winBottom + 0.035 + k * slatH;
          const yb = Math.min(winTop - 0.035, ya + slatH - 0.009);
          B(M.timber, u0, u1, ya, yb, slatV0, slatV1);
        }
      }
      // Outer stiles, centre seam and a small brass latch make the closed leaves legible.
      B(M.timberDark, -hw + 0.01, -hw + 0.055, winBottom, winTop, slatV0, slatV1);
      B(M.timberDark, hw - 0.055, hw - 0.01, winBottom, winTop, slatV0, slatV1);
      B(M.timberDark, -0.025, 0.025, winBottom, winTop, slatV0, slatV1);
      B(M.timberDark, -hw + 0.04, hw - 0.04, y0 + 1.45, y0 + 1.49, slatFace + out * 0.015, slatFace + out * 0.035);
      B(M.brass, -0.035, 0.035, y0 + 1.47, y0 + 1.54, slatFace + out * 0.035, slatFace + out * 0.055);
      block();
    }
  };
  for (let i = 0; i < nb; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    run(cx, zl, bw[i], true, s.front[i] ?? 'w', 1);
    run(cx, -zl, bw[i], true, s.back[i] ?? 'w', -1);
  }
  run(xl, 0, 2 * zl, false, s.right[0] ?? 'w', 1);
  run(-xl, 0, 2 * zl, false, s.left[0] ?? 'w', -1);

  /* ---------- ceiling + interior ---------- */
  c.span(M.timberDark, -xl + 0.15, xl - 0.15, y0 + H - 0.02, y0 + H + 0.04, -zl + 0.15, zl - 0.15);
  if (s.interior === 'peetham') {
    c.box(M.stoneDark, 0, y0 + 0.12, 0, 0.9, 0.24, 0.9);
    c.box(M.stone, 0, y0 + 0.36, 0, 0.7, 0.24, 0.7);
    c.geo(M.brass, kalasamGeometry(0.36, 0.2), new THREE.Matrix4().makeTranslation(0, y0 + 0.48, 0), { uv: 'keep', weather: false });
    const [fx, fz] = c.toWorld(0, 0.0);
    world.flames.push({ x: fx, y: y0 + 1.0, z: fz, s: 1 });
    world.halos.push({ x: fx, y: y0 + 1.0, z: fz, s: 1.6 });
    c.box(M.brass, 0, y0 + 0.62, 0, 0.14, 0.03, 0.14);
    c.box(M.brass, 0, y0 + 0.85, 0, 0.03, 0.44, 0.03);
    c.box(M.brass, 0, y0 + 0.99, 0, 0.12, 0.03, 0.12);
    c.collideBox(0, 0, 1.0, 1.0);
  }

  /* ---------- roof (shared pitch, overhang, thickness) ---------- */
  const aw = xl + 0.17;
  const bwp = zl + 0.17;
  const a = aw + OH;
  const bb = bwp + OH;
  const plateTop = y0 + H + BH;
  const ye = plateTop + 0.16 - PITCH * OH;
  const ho = { cx: 0, cz: 0, a, b: bb, ye, pitch: PITCH, thick: TH };
  const { yr } = hipRoof(c, M, ho, 'small');
  hipRafters(c, M.timberDark, { ...ho, aw, bw: bwp, spacing: 0.5 });

  const fp = c.rect(-s.L / 2, -s.W / 2, s.L / 2, s.W / 2);
  world.footprints.push({ ...fp, label: s.label, kind: s.kind });
  return { footprint: fp, ridgeY: yr, ctx: c, entryFront: ef, xl, zl };
}
