import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Ctx, World } from './batch';
import type { Mats } from './materials';
import { kalasamGeometry } from './roof';

/* ------------------------------------------------------------------ */
/* Reusable Kerala Wall Lamp (Chirathu / Vilakku Thalika) Geometry     */
/* ------------------------------------------------------------------ */

/**
 * Traditional Kerala wall-mounted brass oil lamp:
 * - Rear rectangular mounting lug (hooks onto the horizontal wooden rail)
 * - Forward-projecting arm/stem
 * - Circular dish base/pedestal
 * - Shallow brass oil dish (chirathu bowl)
 * - Pinched front pouring lip/beak where the burning cotton wick rests
 * Proportions: delicate, authentic (~64mm diameter saucer), approx 90 triangles.
 */
export function wallLampGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Rear mounting bracket (flush with rail front face at local z = 0)
  const bracket = new THREE.BoxGeometry(0.022, 0.030, 0.014);
  bracket.translate(0, 0, 0.007);
  parts.push(bracket);

  // 2. Slender horizontal forward arm
  const arm = new THREE.CylinderGeometry(0.0055, 0.0055, 0.032, 7);
  arm.rotateX(Math.PI / 2);
  arm.translate(0, 0, 0.024);
  parts.push(arm);

  // 3. Small circular pedestal base
  const pedestal = new THREE.CylinderGeometry(0.016, 0.019, 0.007, 10);
  pedestal.translate(0, 0.0035, 0.046);
  parts.push(pedestal);

  // 4. Shallow circular brass oil dish (chirathu bowl)
  const dishProf: [number, number][] = [
    [0.0, 0.007],
    [0.015, 0.007],
    [0.025, 0.011],
    [0.031, 0.020],
    [0.029, 0.020],
    [0.023, 0.013],
    [0.012, 0.010],
    [0.0, 0.010],
  ];
  const dish = new THREE.LatheGeometry(
    dishProf.map(([r, y]) => new THREE.Vector2(r, y)),
    12,
  );
  dish.translate(0, 0.007, 0.046);
  parts.push(dish);

  // 5. Outward pinched beak / pouring lip extending forward
  const lip = new THREE.ConeGeometry(0.009, 0.018, 5);
  lip.rotateX(Math.PI / 2);
  lip.scale(1.0, 0.5, 1.0);
  lip.translate(0, 0.021, 0.071);
  parts.push(lip);

  const merged = mergeGeometries(parts, false) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** 3D teardrop oil-lamp flame geometry with base at origin. */
export function flameGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.012, 6, 6);
  g.scale(0.65, 1.85, 0.65);
  g.translate(0, 0.018, 0); // base at y=0, tip at y=0.036
  return g;
}

/* ------------------------------------------------------------------ */
/* Chuttuvilakku System: Wall-Mounted Continuous Rows                  */
/* ------------------------------------------------------------------ */

interface ChuttuSegment {
  name: string;
  along: 'x' | 'z';
  start: number;
  end: number;
  wallCoord: number; // coordinate of the inner plaster wall face
  facing: 'S' | 'N' | 'E' | 'W'; // inward direction into the temple courtyard
}

/**
 * Builds the traditional Kerala Chuttuvilakku wall-lamp installation:
 * - Structural dark timber support frame (vertical uprights + 4 continuous horizontal battens)
 *   fixed directly and structurally to the inner-facing compound walls (projection ~100 mm).
 * - 4 horizontal rows of brass lamps with 300 mm vertical spacing and ~300 mm individual spacing.
 * - Clean termination before gate piers, openings and wall corners (no clipping or corner overlaps).
 * - Instanced brass lamps + glowing flickering flames + soft collective wall illumination.
 */
export function buildChuttuvilakku(c: Ctx, world: World, M: Mats, frontZ = 12) {
  // 4 horizontal row heights above ground (on the 1.8 m compound wall above the 0.45 m plinth)
  const rowHeights = [0.65, 0.95, 1.25, 1.55];

  // Compound inner wall coordinates:
  // North wall inner face at z = -12.00 (facing South into courtyard)
  // South (front) wall inner face at z = frontZ (facing North into courtyard)
  // West wall inner face at x = -17.00 (facing East into courtyard)
  // East wall inner face at x = +17.00 (facing West into courtyard)
  const sideEnd = frontZ - 1.2; // stop cleanly before the front corner piers
  const segments: ChuttuSegment[] = [
    // 1. North inner wall (stops cleanly before NW and NE corner piers)
    // The north wall has an open sand walk to the kathina vedi ground at x = 6.5m ± 1.0m.
    // Lamp rows split cleanly around the North-East opening.
    { name: 'north-west', along: 'x', start: -15.9, end: 4.8, wallCoord: -12.0, facing: 'S' },
    { name: 'north-east', along: 'x', start: 8.2, end: 15.9, wallCoord: -12.0, facing: 'S' },
    // 2. West inner wall (stops cleanly before NW and SW corner piers)
    { name: 'west', along: 'z', start: -10.8, end: sideEnd, wallCoord: -17.0, facing: 'E' },
    // 3a/3b. East inner wall, split around the pond-plot doorway (opening z 2.0..3.6)
    { name: 'east-north', along: 'z', start: -10.8, end: 1.1, wallCoord: 17.0, facing: 'W' },
    { name: 'east-south', along: 'z', start: 4.5, end: sideEnd, wallCoord: 17.0, facing: 'W' },
    // 4. Front inner wall (West of gate: stops before SW corner pier and West gate pier)
    { name: 'south-west', along: 'x', start: -15.9, end: -5.7, wallCoord: frontZ, facing: 'N' },
    // 5. Front inner wall (East of gate: starts after East gate pier, stops before SE corner pier)
    { name: 'south-east', along: 'x', start: 0.9, end: 15.9, wallCoord: frontZ, facing: 'N' },
  ];

  // Frame parameters (timber uprights and horizontal battens)
  const postW = 0.04; // 40 mm width
  const postH = 1.08; // spans from y=0.52 to y=1.60
  const postDepth = 0.068; // 68 mm projection from plaster
  const railH = 0.026; // 26 mm batten height
  const railDepth = 0.032; // 32 mm batten depth
  // Total frame projection: 68 + 32 = 100 mm (within 80–120 mm specification!)

  for (const seg of segments) {
    const isX = seg.along === 'x';
    const span = Math.abs(seg.end - seg.start);
    const intervals = Math.max(1, Math.round(span / 0.30));
    const step = span / intervals;
    const count = intervals + 1;

    // Uprights (vertical posts) spaced every ~1.5 m
    const numPosts = Math.max(2, Math.round(span / 1.5) + 1);
    const postStep = span / (numPosts - 1);

    // Orientation & offsets based on wall facing direction
    let ryAngle = 0;
    let railCenterCoord = 0;
    let railFrontCoord = 0;
    let postCenterCoord = 0;

    if (seg.facing === 'S') {
      // Facing South (+Z direction)
      ryAngle = 0;
      postCenterCoord = seg.wallCoord + postDepth / 2; // -12.00 + 0.034 = -11.966
      railCenterCoord = seg.wallCoord + postDepth + railDepth / 2; // -11.916
      railFrontCoord = seg.wallCoord + postDepth + railDepth; // -11.900
    } else if (seg.facing === 'N') {
      // Facing North (-Z direction)
      ryAngle = Math.PI;
      postCenterCoord = seg.wallCoord - postDepth / 2; // +11.966
      railCenterCoord = seg.wallCoord - postDepth - railDepth / 2; // +11.916
      railFrontCoord = seg.wallCoord - postDepth - railDepth; // +11.900
    } else if (seg.facing === 'E') {
      // Facing East (+X direction)
      ryAngle = Math.PI / 2;
      postCenterCoord = seg.wallCoord + postDepth / 2; // -16.966
      railCenterCoord = seg.wallCoord + postDepth + railDepth / 2; // -16.916
      railFrontCoord = seg.wallCoord + postDepth + railDepth; // -16.900
    } else {
      // Facing West (-X direction)
      ryAngle = -Math.PI / 2;
      postCenterCoord = seg.wallCoord - postDepth / 2; // +16.966
      railCenterCoord = seg.wallCoord - postDepth - railDepth / 2; // +16.916
      railFrontCoord = seg.wallCoord - postDepth - railDepth; // +16.900
    }

    // 1. Structural vertical uprights fixed to the wall
    for (let p = 0; p < numPosts; p++) {
      const pos = seg.start + p * postStep;
      if (isX) {
        c.box(M.timberDark, pos, 1.06, postCenterCoord, postW, postH, postDepth, { weather: false });
        // small wall anchor pins at top and bottom connecting into the lime wall
        c.box(M.stoneDark, pos, 0.58, seg.wallCoord + (seg.facing === 'S' ? 0.015 : -0.015), 0.026, 0.04, 0.03, { weather: false });
        c.box(M.stoneDark, pos, 1.54, seg.wallCoord + (seg.facing === 'S' ? 0.015 : -0.015), 0.026, 0.04, 0.03, { weather: false });
      } else {
        c.box(M.timberDark, postCenterCoord, 1.06, pos, postDepth, postH, postW, { weather: false });
        c.box(M.stoneDark, seg.wallCoord + (seg.facing === 'E' ? 0.015 : -0.015), 0.58, pos, 0.03, 0.04, 0.026, { weather: false });
        c.box(M.stoneDark, seg.wallCoord + (seg.facing === 'E' ? 0.015 : -0.015), 1.54, pos, 0.03, 0.04, 0.026, { weather: false });
      }
    }

    // 2. Horizontal continuous wooden battens / rails (4 rows)
    for (const yh of rowHeights) {
      if (isX) {
        const midX = (seg.start + seg.end) / 2;
        c.box(M.timberDark, midX, yh, railCenterCoord, span, railH, railDepth, { weather: false });
      } else {
        const midZ = (seg.start + seg.end) / 2;
        c.box(M.timberDark, railCenterCoord, yh, midZ, railDepth, railH, span, { weather: false });
      }

      // 3. Brass lamps mounted on the front face of each rail
      for (let i = 0; i < count; i++) {
        const coord = seg.start + i * step;
        let lx = 0;
        let lz = 0;
        let fx = 0;
        let fz = 0;
        const fy = yh + 0.028;

        if (seg.facing === 'S') {
          lx = coord;
          lz = railFrontCoord;
          fx = coord;
          fz = railFrontCoord + 0.074; // flame tip in front of rail
        } else if (seg.facing === 'N') {
          lx = coord;
          lz = railFrontCoord;
          fx = coord;
          fz = railFrontCoord - 0.074;
        } else if (seg.facing === 'E') {
          lx = railFrontCoord;
          lz = coord;
          fx = railFrontCoord + 0.074;
          fz = coord;
        } else {
          lx = railFrontCoord;
          lz = coord;
          fx = railFrontCoord - 0.074;
          fz = coord;
        }

        // Register brass lamp instance
        world.wallLamps.push({ x: lx, y: yh, z: lz, ry: ryAngle });

        // Register flame (scale 0.55 for delicate, proportional oil wick flame)
        world.flames.push({ x: fx, y: fy, z: fz, s: 0.55 });
      }
    }
  }

  // Soft warm perimeter point lights along the compound walls to simulate the collective
  // ambient illumination of the hundreds of glowing oil lamps on the lime plaster and ground.
  world.lights.push(
    // North wall (3 soft diffuse lights along the 32m wall)
    { x: -10.0, y: 1.15, z: -11.5, intensity: 12, distance: 13 },
    { x: 0.0, y: 1.15, z: -11.5, intensity: 14, distance: 14 },
    { x: 10.0, y: 1.15, z: -11.5, intensity: 12, distance: 13 },

    // West wall (2 soft lights along the long wall)
    { x: -16.5, y: 1.15, z: -5, intensity: 11, distance: 12 },
    { x: -16.5, y: 1.15, z: frontZ - 3.5, intensity: 11, distance: 12 },

    // East wall (2 soft lights along the long wall)
    { x: 16.5, y: 1.15, z: -5, intensity: 11, distance: 12 },
    { x: 16.5, y: 1.15, z: frontZ - 3.5, intensity: 11, distance: 12 },

    // Front wall (west of gate and east of gate)
    { x: -10.5, y: 1.15, z: frontZ - 0.5, intensity: 11, distance: 12 },
    { x: 8.0, y: 1.15, z: frontZ - 0.5, intensity: 13, distance: 13 },
  );
}

/* ------------------------------------------------------------------ */
/* The Central Deepastambham (Visual Focal Point in Forecourt)         */
/* ------------------------------------------------------------------ */

/**
 * Stone-to-brass deepastambham. All lathed parts meet or overlap at their sockets;
 * the carved relief sits directly on the pedestal instead of hanging off it.
 */
export function buildDeepastambham(c: Ctx, world: World, M: Mats, x: number, z: number) {
  const V = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(r, y));
  const T = (px: number, py: number, pz: number) => new THREE.Matrix4().makeTranslation(px, py, pz);
  const lathe = (mat: THREE.Material, pts: [number, number][], seg: number, oy = 0) => {
    const g = new THREE.LatheGeometry(V(pts), seg);
    c.geo(mat, g, T(x, oy, z), { uv: mat === M.carvedStone ? 'box' : 'keep', weather: false });
    g.dispose();
  };
  const bronze = M.deepaBrass;

  // Stepped granite is part of the courtyard paving; no loose corner finials.
  c.box(M.stoneDark, x, 0.07, z, 2.0, 0.14, 2.0);
  c.box(M.stone, x, 0.21, z, 1.6, 0.14, 1.6);
  c.box(M.stoneDark, x, 0.35, z, 1.2, 0.14, 1.2);
  // A single dressed stone, not textured as stacked masonry blocks.
  const pedestal: [number, number][] = [
    [0, 0.42], [0.44, 0.42], [0.47, 0.45], [0.47, 0.49],
    [0.425, 0.52], [0.395, 0.56], [0.395, 0.63], [0.35, 0.75],
    [0.32, 0.85], [0.29, 0.96], [0.23, 1.05], [0.22, 1.12],
    [0.215, 1.38], [0.25, 1.43], [0.28, 1.48], [0.29, 1.52],
    [0.285, 1.56], [0.265, 1.6], [0, 1.6],
  ];
  lathe(M.carvedStone, pedestal, 32);

  // Low-relief lotus leaves follow the stone's exact taper. Their edges meet the drum,
  // instead of separate petal-shaped spheres poking out of it.
  const radiusAt = (y: number) => {
    for (let i = 1; i < pedestal.length; i++) {
      const [r0, y0] = pedestal[i - 1];
      const [r1, y1] = pedestal[i];
      if (y >= y0 && y <= y1 && y1 > y0) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return 0.3;
  };
  const relief: number[] = [];
  const nPetals = 16;
  const point = (a: number, y: number, raised: number): [number, number, number] => {
    const r = radiusAt(y) + raised;
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  };
  const tri = (a: number[], b: number[], d: number[]) => relief.push(...a, ...b, ...d);
  for (let i = 0; i < nPetals; i++) {
    const a = (i / nPetals) * Math.PI * 2;
    const half = (Math.PI / nPetals) * 0.89;
    const bl = point(a - half, 0.566, 0.007);
    const bc = point(a, 0.555, 0.013);
    const br = point(a + half, 0.566, 0.007);
    const sl = point(a - half * 0.7, 0.675, 0.015);
    const mid = point(a, 0.705, 0.03);
    const sr = point(a + half * 0.7, 0.675, 0.015);
    const tl = point(a - half * 0.21, 0.817, 0.008);
    const tip = point(a, 0.84, 0.006);
    const tr = point(a + half * 0.21, 0.817, 0.008);
    tri(bl, bc, mid); tri(bc, br, mid);
    tri(bl, mid, sl); tri(mid, br, sr);
    tri(sl, mid, tl); tri(mid, tip, tl);
    tri(mid, sr, tr); tri(mid, tr, tip);
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.Float32BufferAttribute(relief, 3));
  petalGeo.computeVertexNormals();
  c.geo(M.carvedStone, petalGeo, T(x, 0, z), { uv: 'box', tint: 0.91, weather: false });
  petalGeo.dispose();

  // Bronze boot overlaps the stone cap by 15 mm, so the change of material feels fixed.
  const shaft: [number, number][] = [
    [0, 1.585], [0.19, 1.585], [0.19, 1.61], [0.16, 1.64],
    [0.11, 1.72], [0.095, 1.77], [0.12, 1.84], [0.125, 1.87],
    [0.105, 1.91], [0.083, 1.96],
  ];

  // Repeated turned collars are intentionally modest. The shaft stays continuous
  // through the centre of every tray; no large gold urns appear between levels.
  const tiers = [2.20, 2.62, 3.03, 3.43, 3.82, 4.20, 4.57, 4.93];
  const radii = [0.72, 0.66, 0.60, 0.54, 0.48, 0.42, 0.36, 0.30];
  const counts = [18, 16, 14, 12, 12, 10, 8, 6];
  tiers.forEach((yt, i) => {
    const r = 0.083 - i * 0.004;
    shaft.push(
      [r, yt - 0.21], [r + 0.012, yt - 0.17],
      [r + 0.037, yt - 0.135], [r + 0.038, yt - 0.11],
      [r + 0.012, yt - 0.085], [r, yt - 0.055], [r, yt + 0.035],
    );
  });
  shaft.push([0.07, 5.0], [0.105, 5.045], [0.12, 5.07], [0.075, 5.12], [0, 5.12]);
  lathe(bronze, shaft, 20);

  // The oil-cup geometry is shared by every tier. It is a shallow dish rather than
  // a goblet, and its base is set down into the rolled lip of the platter.
  const cupGeo = new THREE.LatheGeometry(
    V([[0, 0], [0.022, 0], [0.029, 0.008], [0.036, 0.022],
      [0.037, 0.03], [0.031, 0.029], [0.022, 0.017], [0, 0.014]]), 10,
  );
  tiers.forEach((yt, i) => {
    const r = radii[i];
    const n = counts[i];
    const seg = 24;

    // Thin cast oil platter with a load-bearing central hub and a rolled outer rim.
    lathe(bronze, [
      [0, -0.075], [0.12, -0.075], [r * 0.3, -0.064],
      [r * 0.61, -0.037], [r * 0.88, -0.008], [r - 0.02, 0.011],
      [r, 0.018], [r + 0.004, 0.029], [r - 0.004, 0.035],
      [r - 0.019, 0.031], [r - 0.037, 0.018],
      [r * 0.77, 0.009], [r * 0.46, 0.01], [0.12, 0.027], [0, 0.027],
    ], seg, yt);

    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rc = r - 0.045;
      c.geo(bronze, cupGeo, T(x + ca * rc, yt + 0.019, z + sa * rc), { uv: 'keep', weather: false });
      world.flames.push({ x: x + ca * (rc + 0.013), y: yt + 0.052, z: z + sa * (rc + 0.013), s: 1.15 });
    }
    world.halos.push({ x, y: yt + 0.07, z, s: 0.6 + r });
  });
  cupGeo.dispose();

  // A single finial, seated in the brass collar rather than floating over it.
  const crown = kalasamGeometry(0.44, 0.19);
  c.geo(bronze, crown, T(x, 5.105, z), { uv: 'keep', weather: false });
  crown.dispose();
  c.cyl(M.brass, x, 5.53, z, 0.014, 0.0, 0.1, 8, 0, { weather: false });

  world.halos.push({ x, y: 3.6, z, s: 2.4 });
  c.collideBox(x, z, 2.0, 2.0);

  world.lights.push({ x, y: 3.5, z, intensity: 38, distance: 20 });
}

/* ------------------------------------------------------------------ */
/* Instanced Lamp Rig: Optimized GPU rendering of all lights          */
/* ------------------------------------------------------------------ */

export class LampRig {
  readonly group = new THREE.Group();
  private wallLampsMesh: THREE.InstancedMesh | null = null;
  private flames: THREE.InstancedMesh | null = null;
  private halos: THREE.InstancedMesh | null = null;
  private geos: THREE.BufferGeometry[] = [];
  private dummy = new THREE.Object3D();

  constructor(private world: World, private M: Mats) {
    this.group.name = 'Lamps';
    const d = this.dummy;

    // 1. Repeated Wall-Mounted Chuttuvilakku Lamps (Single InstancedMesh)
    if (world.wallLamps.length > 0) {
      const wlg = wallLampGeometry();
      this.geos.push(wlg);
      this.wallLampsMesh = new THREE.InstancedMesh(wlg, M.lampBrass, world.wallLamps.length);
      this.wallLampsMesh.name = 'wallLamps';
      this.wallLampsMesh.castShadow = true;
      this.wallLampsMesh.receiveShadow = true;

      world.wallLamps.forEach((s, i) => {
        d.position.set(s.x, s.y, s.z);
        d.rotation.set(0, s.ry, 0);
        d.scale.setScalar(1);
        d.updateMatrix();
        this.wallLampsMesh!.setMatrixAt(i, d.matrix);
      });
      this.wallLampsMesh.instanceMatrix.needsUpdate = true;
      this.group.add(this.wallLampsMesh);
    }

    // 2. All Flames (Wall Lamps + Deepastambham + Inner Shrine Flame) in ONE Draw Call
    if (world.flames.length > 0) {
      const fg = flameGeometry();
      this.geos.push(fg);
      this.flames = new THREE.InstancedMesh(fg, M.flame, world.flames.length);
      this.flames.frustumCulled = false;
      this.flames.name = 'flames';
      this.flames.visible = false;

      world.flames.forEach((f, i) => {
        d.position.set(f.x, f.y, f.z);
        d.rotation.set(0, 0, 0);
        d.scale.set(f.s, f.s, f.s);
        d.updateMatrix();
        this.flames!.setMatrixAt(i, d.matrix);
      });
      this.flames.instanceMatrix.needsUpdate = true;
      this.group.add(this.flames);
    }

    // 3. Deepastambham Glow Halos
    if (world.halos.length > 0) {
      const pg = new THREE.PlaneGeometry(1, 1);
      this.geos.push(pg);
      this.halos = new THREE.InstancedMesh(pg, M.halo, world.halos.length);
      this.halos.frustumCulled = false;
      this.halos.renderOrder = 5;
      this.halos.name = 'halos';
      this.halos.visible = false;

      world.halos.forEach((h, i) => {
        d.position.set(h.x, h.y, h.z);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(h.s);
        d.updateMatrix();
        this.halos!.setMatrixAt(i, d.matrix);
      });
      this.halos.instanceMatrix.needsUpdate = true;
      this.group.add(this.halos);
    }
  }

  /**
   * Updates lamp illumination and subtle flame flicker.
   * @param t Elapsed time in seconds
   * @param night Day/night blend factor (0 = day, 1 = full night)
   */
  update(t: number, night: number) {
    const on = night > 0.02;

    if (this.flames) {
      this.flames.visible = on;
      if (on) {
        const d = this.dummy;
        const e = night;
        this.world.flames.forEach((f, i) => {
          // Subtle, organic flame dancing with unique phase per flame
          const fl = 1 + 0.08 * Math.sin(t * 8.5 + i * 1.61) + 0.04 * Math.sin(t * 15.2 + i * 0.77);
          d.position.set(f.x, f.y, f.z);
          d.rotation.set(0, 0, 0);
          const sc = f.s * e;
          d.scale.set(sc * (0.94 + 0.06 * fl), sc * fl, sc * (0.94 + 0.06 * fl));
          d.updateMatrix();
          this.flames!.setMatrixAt(i, d.matrix);
        });
        this.flames.instanceMatrix.needsUpdate = true;
      }
    }

    if (this.halos) {
      this.halos.visible = on;
      this.M.halo.uniforms.uOpacity.value = night * night * 0.5;
    }
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
  }
}
