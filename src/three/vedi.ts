import * as THREE from 'three';
import type { Ctx, World } from './batch';
import { makeSmokeTexture } from './fxTextures';
import type { Mats } from './materials';

/* ====================================================================
 * KATHINA VEDI: iron barrel crackers set into a sand ground.
 * A kathina vedi is only a very loud shot: a flash and a short column of fire at the barrel
 * mouth, a hard shock-wave across the sand, then a heavy cloud of white-grey smoke.
 * No firework colours, no sparks showers.
 * ==================================================================== */

export interface VediBarrel { x: number; z: number }
export type VediMode = 'one' | 'salvo' | 'interval';
export const VEDI_MAX = 10;

const TAU = Math.PI * 2;
const MOUTH_Y = 0.345; // barrel mouth height above the sand
const FUSE = 0.32; // seconds of wick sizzle before each bang
const COOLDOWN = 1.2; // seconds before a fired barrel may be fired again

/** Where the sand ground, its opening and the barrels go, relative to the temple axis. */
export function vediLayout(_axisX: number) {
  // Positioned in the open north ground, shifted to the North-East side of the compound
  const plot = { x0: 1.5, x1: 15.5, z0: -26.5, z1: -12.5 };
  // Natural gap left in the compound wall on the North-East flank (no gopuram or arch)
  const door = { x0: 5.5, x1: 7.5 };
  // Barrels arranged in a neat row on the open sandy ground
  const barrels: VediBarrel[] = Array.from({ length: VEDI_MAX }, (_, i) => ({
    x: 3.9 + i * 0.9,
    z: -20.5,
  }));
  return { plot, door, barrels };
}

/* ------------------------------------------------------------------ */
/* Static geometry: the barrels themselves + scorched sand              */
/* ------------------------------------------------------------------ */

export function buildVediBarrels(c: Ctx, world: World, M: Mats, barrels: VediBarrel[]) {
  // Squat cast-iron barrel: flared foot, narrow waist, thick lip, deep bore. Foot is sunk in the sand.
  const prof: [number, number][] = [
    [0, -0.06], [0.13, -0.06], [0.14, 0.0], [0.145, 0.03], [0.128, 0.075], [0.103, 0.13],
    [0.094, 0.19], [0.098, 0.26], [0.108, 0.31], [0.114, 0.335],
    [0.11, 0.345], [0.046, 0.345], [0.04, 0.33], [0.038, 0.14], [0, 0.14],
  ];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 16);
  const flat = { weather: false };

  for (const b of barrels) {
    // the barrel sits right in the open sand: only a faint scorched ring pressed around its base
    c.cyl(M.scorch, b.x, 0, b.z, 0.24, 0.24, 0.006, 16, 0, { ...flat, tint: 0.85 });
    c.cyl(M.scorch, b.x, 0, b.z, 0.155, 0.155, 0.009, 12, 0, { ...flat, tint: 0.7 });
    c.geo(M.castIron, geo, new THREE.Matrix4().makeTranslation(b.x, 0, b.z), { uv: 'keep', ...flat });
    c.collideBox(b.x, b.z, 0.34, 0.34);
  }
  geo.dispose();
  void world;
}

/* ------------------------------------------------------------------ */
/* Synthesised blast audio (no assets)                                 */
/* ------------------------------------------------------------------ */

class BoomAudio {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;

  /** Must be called from a user gesture the first time. */
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 9;
      comp.attack.value = 0.003;
      comp.release.value = 0.3;
      this.master = ctx.createGain();
      this.master.gain.value = 1.45; // Louder, punchier overall master
      this.master.connect(comp);
      comp.connect(ctx.destination);

      // open-air tail: decaying stereo noise
      const len = Math.floor(ctx.sampleRate * 2.6);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const dd = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
      }
      this.verb = ctx.createConvolver();
      this.verb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.42;
      this.verb.connect(wet);
      wet.connect(this.master);

      const nlen = Math.floor(ctx.sampleRate * 1.4);
      this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** One crack + thump + body. `dist` (m) delays and softens it like real distance would. */
  play(dist: number) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + Math.min(dist / 343, 0.5) + 0.005;
    // Louder perceived volume curve with high punch even at distance
    const vol = 1.6 / (1 + dist * 0.028);

    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = Math.max(1100, 14000 / (1 + dist * 0.07));
    const out = ctx.createGain();
    out.gain.value = vol;
    air.connect(out);
    out.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.55;
    out.connect(send);
    send.connect(this.verb);

    const pr = 0.88 + Math.random() * 0.26;

    // 1. Sub-bass punch: extremely loud, deep rumble that vibrates through the ground
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t0);
    osc.frequency.exponentialRampToValueAtTime(24, t0 + 1.2); // sweeps deep down to 24Hz
    const go = ctx.createGain();
    go.gain.setValueAtTime(0.0001, t0);
    go.gain.exponentialRampToValueAtTime(3.2, t0 + 0.005); // visceral loud thump!
    go.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    osc.connect(go);
    go.connect(air);
    osc.start(t0);
    osc.stop(t0 + 2.3);

    // 2. Deep body rumble (low-passed rolling thunder, no high frequencies)
    const body = ctx.createBufferSource();
    body.buffer = this.noise;
    body.playbackRate.value = pr * 0.65; // much lower, slower rumble
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(900, t0); // severely filtered for deep bass-only sound
    lp.frequency.exponentialRampToValueAtTime(50, t0 + 1.5);
    const gb = ctx.createGain();
    gb.gain.setValueAtTime(0.0001, t0);
    gb.gain.exponentialRampToValueAtTime(2.4, t0 + 0.008);
    gb.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
    body.connect(lp);
    lp.connect(gb);
    gb.connect(air);
    body.start(t0);
    body.stop(t0 + 2.8);

    // 3. Sharp snap (the immediate short ignition, quickly muffled)
    const crack = ctx.createBufferSource();
    crack.buffer = this.noise;
    crack.playbackRate.value = pr;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const gc = ctx.createGain();
    gc.gain.setValueAtTime(0.0001, t0);
    gc.gain.exponentialRampToValueAtTime(1.1, t0 + 0.0018);
    gc.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    crack.connect(hp);
    hp.connect(gc);
    gc.connect(air);
    crack.start(t0, Math.random() * 0.5);
    crack.stop(t0 + 0.12);
  }

  dispose() {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}

/* ------------------------------------------------------------------ */
/* GPU billboards: one instanced mesh per layer                         */
/* ------------------------------------------------------------------ */

const STRIDE = 25;
const X = 0, Y = 1, Z = 2, VX = 3, VY = 4, VZ = 5, AGE = 6, LIFE = 7, S0 = 8, S1 = 9;
const ROT = 10, RV = 11, SEED = 12, CR = 13, CG = 14, CB = 15, DRAG = 16, BUOY = 17, GRAV = 18;
const WIND = 19, HEAT = 20, HDEC = 21, ALPHA = 22, FLOOR = 23, GROW = 24;

interface Spawn {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  delay?: number; life: number; s0: number; s1: number; rv?: number;
  color?: [number, number, number];
  drag?: number; buoy?: number; grav?: number; wind?: number;
  heat?: number; hdec?: number; alpha?: number; floor?: number; grow?: number;
}

/** CPU-simulated particle pool drawn as a single instanced draw call. */
class Layer {
  readonly d: Float32Array;
  readonly mesh: THREE.Mesh;
  active = false;
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly pos: Float32Array;
  private readonly data: Float32Array;
  private readonly tint: Float32Array;
  private readonly aPos: THREE.InstancedBufferAttribute;
  private readonly aData: THREE.InstancedBufferAttribute;
  private readonly aTint: THREE.InstancedBufferAttribute;
  private readonly depth: Float32Array;
  private readonly order: number[] = [];
  private cursor = 0;

  constructor(
    private readonly max: number,
    mat: THREE.Material,
    base: THREE.BufferGeometry,
    private readonly sort: boolean,
    renderOrder: number,
  ) {
    this.d = new Float32Array(max * STRIDE);
    this.pos = new Float32Array(max * 4);
    this.data = new Float32Array(max * 4);
    this.tint = new Float32Array(max * 4);
    this.depth = new Float32Array(max);
    this.geo.setIndex(base.getIndex());
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 4);
    this.aData = new THREE.InstancedBufferAttribute(this.data, 4);
    this.aTint = new THREE.InstancedBufferAttribute(this.tint, 4);
    for (const a of [this.aPos, this.aData, this.aTint]) a.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iPos', this.aPos);
    this.geo.setAttribute('iData', this.aData);
    this.geo.setAttribute('iTint', this.aTint);
    this.geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
  }

  spawn(s: Spawn) {
    const o = this.cursor * STRIDE;
    this.cursor = (this.cursor + 1) % this.max;
    const d = this.d;
    d[o + X] = s.x; d[o + Y] = s.y; d[o + Z] = s.z;
    d[o + VX] = s.vx ?? 0; d[o + VY] = s.vy ?? 0; d[o + VZ] = s.vz ?? 0;
    d[o + AGE] = -(s.delay ?? 0);
    d[o + LIFE] = s.life;
    d[o + S0] = s.s0; d[o + S1] = s.s1;
    d[o + ROT] = Math.random() * TAU;
    d[o + RV] = s.rv ?? 0;
    d[o + SEED] = Math.random();
    const c = s.color ?? [1, 1, 1];
    d[o + CR] = c[0]; d[o + CG] = c[1]; d[o + CB] = c[2];
    d[o + DRAG] = s.drag ?? 0;
    d[o + BUOY] = s.buoy ?? 0;
    d[o + GRAV] = s.grav ?? 0;
    d[o + WIND] = s.wind ?? 0;
    d[o + HEAT] = s.heat ?? 0;
    d[o + HDEC] = s.hdec ?? 3;
    d[o + ALPHA] = s.alpha ?? 1;
    d[o + FLOOR] = s.floor ?? -1;
    d[o + GROW] = s.grow ?? 2;
    this.active = true;
  }

  update(dt: number, wx: number, wz: number) {
    if (!this.active) return;
    const d = this.d;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const o = i * STRIDE;
      if (d[o + LIFE] <= 0) continue;
      const age = d[o + AGE] + dt;
      d[o + AGE] = age;
      if (age >= d[o + LIFE]) { d[o + LIFE] = 0; continue; }
      alive++;
      if (age < 0) continue;
      const k = Math.exp(-d[o + DRAG] * dt);
      const vx = d[o + VX] * k;
      let vy = d[o + VY] * k;
      const vz = d[o + VZ] * k;
      vy += (d[o + BUOY] - d[o + GRAV]) * dt;
      d[o + VX] = vx; d[o + VY] = vy; d[o + VZ] = vz;
      const wf = d[o + WIND] * Math.min(1, d[o + Y] / 2 + 0.15);
      d[o + X] += (vx + wx * wf) * dt;
      d[o + Y] += vy * dt;
      d[o + Z] += (vz + wz * wf) * dt;
      if (d[o + Y] < d[o + FLOOR]) {
        d[o + Y] = d[o + FLOOR];
        d[o + VY] = d[o + GRAV] > 0 ? Math.abs(vy) * 0.25 : 0;
      }
      d[o + ROT] += d[o + RV] * dt;
    }
    this.active = alive > 0;
  }

  /** Pack live particles (back-to-front when `sort`) into the instance buffers. */
  upload(cam: THREE.Vector3) {
    if (!this.active && !this.mesh.visible) return;
    const d = this.d;
    const idx = this.order;
    idx.length = 0;
    for (let i = 0; i < this.max; i++) {
      const o = i * STRIDE;
      if (d[o + LIFE] > 0 && d[o + AGE] >= 0) idx.push(i);
    }
    if (this.sort && idx.length > 1) {
      const dep = this.depth;
      for (const i of idx) {
        const o = i * STRIDE;
        const dx = d[o + X] - cam.x;
        const dy = d[o + Y] - cam.y;
        const dz = d[o + Z] - cam.z;
        dep[i] = dx * dx + dy * dy + dz * dz;
      }
      idx.sort((a, b) => dep[b] - dep[a]);
    }
    let n = 0;
    for (const i of idx) {
      const o = i * STRIDE;
      const u = d[o + AGE] / d[o + LIFE];
      const e = 1 - Math.pow(1 - u, d[o + GROW]);
      const size = d[o + S0] + (d[o + S1] - d[o + S0]) * e;
      const p = n * 4;
      this.pos[p] = d[o + X];
      this.pos[p + 1] = d[o + Y];
      this.pos[p + 2] = d[o + Z];
      this.pos[p + 3] = d[o + HEAT] * Math.exp(-d[o + HDEC] * d[o + AGE]);
      this.data[p] = size;
      this.data[p + 1] = u;
      this.data[p + 2] = d[o + ROT];
      this.data[p + 3] = d[o + SEED];
      this.tint[p] = d[o + CR];
      this.tint[p + 1] = d[o + CG];
      this.tint[p + 2] = d[o + CB];
      this.tint[p + 3] = d[o + ALPHA];
      n++;
    }
    this.geo.instanceCount = n;
    this.mesh.visible = n > 0;
    this.aPos.needsUpdate = true;
    this.aData.needsUpdate = true;
    this.aTint.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
  }
}

const PART_VERT = /* glsl */ `
  attribute vec4 iPos;
  attribute vec4 iData;
  attribute vec4 iTint;
  varying vec2 vUv;
  varying float vAge;
  varying float vSeed;
  varying float vHeat;
  varying float vDepth;
  varying vec4 vTint;
  void main() {
    vUv = uv;
    vAge = iData.y;
    vSeed = iData.w;
    vHeat = iPos.w;
    vTint = iTint;
    float c = cos(iData.z);
    float s = sin(iData.z);
    vec2 p = position.xy;
    vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c) * iData.x;
    vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
    vDepth = -mv.z;
    mv.xy += r;
    gl_Position = projectionMatrix * mv;
  }
`;

const SMOKE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLight;
  uniform float uLamp;
  uniform float uFlash;
  varying vec2 vUv;
  varying float vAge;
  varying float vSeed;
  varying float vHeat;
  varying float vDepth;
  varying vec4 vTint;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float fadeIn = smoothstep(0.0, 0.05, vAge);
    float fadeOut = 1.0 - smoothstep(0.5, 1.0, vAge);
    float near = smoothstep(0.4, 3.2, vDepth);
    float a = t.a * fadeIn * fadeOut * near * vTint.w * 0.7;
    vec3 col = vTint.rgb * t.r * uLight;
    col += vec3(1.0, 0.56, 0.24) * uLamp * 0.1 * t.r;
    col += vec3(1.0, 0.62, 0.3) * uFlash * 0.45 * t.r;
    col += vec3(1.0, 0.5, 0.15) * vHeat * 1.7 * t.r;
    gl_FragColor = vec4(col, a);
  }
`;

const FIRE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vAge;
  varying float vSeed;
  varying float vDepth;
  varying vec4 vTint;
  void main() {
    float kind = vTint.x;
    float near = smoothstep(0.3, 2.5, vDepth);
    vec4 t1 = texture2D(uMap, vUv);
    vec4 t2 = texture2D(uMap, fract(vUv * 1.35 + vec2(vSeed, vSeed * 0.37)));
    float a;
    vec3 col;
    if (kind < 0.5) {
      // fire column: dissolves into ragged tongues as it ages
      a = clamp(t1.a * 1.15 + t2.a * 0.35 - 0.2 - vAge * 0.75, 0.0, 1.0);
      a *= 1.0 - smoothstep(0.55, 1.0, vAge);
      vec3 c0 = vec3(1.0, 0.93, 0.62);
      vec3 c1 = vec3(1.0, 0.62, 0.16);
      vec3 c2 = vec3(0.86, 0.24, 0.05);
      vec3 c3 = vec3(0.25, 0.06, 0.02);
      col = mix(c0, c1, smoothstep(0.0, 0.25, vAge));
      col = mix(col, c2, smoothstep(0.2, 0.6, vAge));
      col = mix(col, c3, smoothstep(0.55, 1.0, vAge));
      a *= 0.55;
    } else if (kind < 1.5) {
      // muzzle flash
      a = t1.a * pow(1.0 - vAge, 2.0);
      col = vec3(1.0, 0.95, 0.78);
    } else if (kind < 2.5) {
      // orange glow thrown onto the sand
      a = t1.a * pow(1.0 - vAge, 1.6) * 0.5;
      col = vec3(1.0, 0.55, 0.18);
    } else {
      // ember
      float r = length(vUv - 0.5) * 2.0;
      a = pow(1.0 - clamp(r, 0.0, 1.0), 1.5) * (1.0 - vAge * 0.8) * 1.2;
      col = vec3(1.0, 0.72, 0.28) * 1.2;
    }
    gl_FragColor = vec4(col, a * near * vTint.w);
  }
`;

const RING_VERT = /* glsl */ `
  attribute vec4 iPos;
  attribute vec4 iData;
  attribute vec4 iTint;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    vUv = uv;
    vAge = iData.y;
    vec3 wp = iPos.xyz + vec3(position.x, 0.0, position.z) * iData.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform vec3 uLight;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float prog = 1.0 - pow(1.0 - vAge, 2.2);
    float r = 0.08 + 0.9 * prog;
    float w = 0.07 + 0.14 * prog;
    float ring = exp(-pow((d - r) / w, 2.0));
    float a = ring * pow(1.0 - vAge, 1.5) * 0.5 * smoothstep(1.0, 0.85, d);
    gl_FragColor = vec4(vec3(0.8, 0.69, 0.54) * uLight, a);
  }
`;

/* ------------------------------------------------------------------ */
/* Blast controller: queue, fuse, explosion, light, shake, sound        */
/* ------------------------------------------------------------------ */

interface Blast { t: number; x: number; y: number; z: number }

export class VediFx {
  sound = true;

  private readonly group = new THREE.Group();
  private readonly plane = new THREE.PlaneGeometry(1, 1);
  private readonly ringPlane = new THREE.PlaneGeometry(1, 1);
  private readonly tex = makeSmokeTexture();
  private readonly uniforms = {
    uMap: { value: this.tex },
    uLight: { value: new THREE.Vector3(0.96, 0.94, 0.9) },
    uLamp: { value: 0 },
    uFlash: { value: 0 },
  };
  private readonly smoke: Layer;
  private readonly fire: Layer;
  private readonly rings: Layer;
  private readonly mats: THREE.ShaderMaterial[];
  private readonly light: THREE.PointLight;
  private readonly audio = new BoomAudio();

  private clock = 0;
  private pointer = 0;
  private readonly queue: number[] = [];
  private readonly booms: { t: number; i: number }[] = [];
  private readonly blasts: Blast[] = [];
  private readonly busyUntil: number[];
  private readonly lastBoom: number[];
  private readonly armed: boolean[];
  private readonly camPos = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene, private readonly barrels: VediBarrel[]) {
    this.ringPlane.rotateX(-Math.PI / 2);
    const mk = (frag: string, blending: THREE.Blending, vert = PART_VERT) =>
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending,
        fog: false,
      });
    const smokeMat = mk(SMOKE_FRAG, THREE.NormalBlending);
    const fireMat = mk(FIRE_FRAG, THREE.AdditiveBlending);
    const ringMat = mk(RING_FRAG, THREE.NormalBlending, RING_VERT);
    ringMat.polygonOffset = true;
    ringMat.polygonOffsetFactor = -2;
    ringMat.polygonOffsetUnits = -2;
    this.mats = [smokeMat, fireMat, ringMat];

    this.rings = new Layer(24, ringMat, this.ringPlane, false, 5);
    this.smoke = new Layer(1500, smokeMat, this.plane, true, 6);
    this.fire = new Layer(700, fireMat, this.plane, false, 7);

    // one shared flash light (created now so the scene's light count never changes later)
    const mid = barrels[Math.floor(barrels.length / 2)];
    this.light = new THREE.PointLight(0xffa04a, 0, 26, 2);
    this.light.position.set(mid.x, 1.6, mid.z);

    this.group.name = 'KathinaVediFx';
    this.group.add(this.rings.mesh, this.smoke.mesh, this.fire.mesh, this.light);
    scene.add(this.group);

    this.busyUntil = barrels.map(() => 0);
    this.lastBoom = barrels.map(() => -99);
    this.armed = barrels.map(() => false);
  }

  /* ------------------------------ control ------------------------------ */

  /** Queue shots. one: next barrel · salvo: N barrels in a rapid ripple · interval: N barrels, one every `interval` s. */
  request(mode: VediMode, count: number, interval: number) {
    this.audio.enabled = this.sound;
    if (this.sound) this.audio.unlock();
    if (this.queue.length + this.booms.length > 30) return;
    const n = mode === 'one' ? 1 : Math.max(1, Math.min(VEDI_MAX, Math.round(count)));
    const gap = Math.max(0.15, interval);
    let acc = 0;
    for (let k = 0; k < n; k++) {
      this.queue.push(this.clock + (mode === 'interval' ? k * gap : acc));
      acc += 0.06 + Math.random() * 0.05;
    }
    this.queue.sort((a, b) => a - b);
  }

  /** Cancel everything not yet lit (barrels already sizzling still go off). */
  stop() {
    this.queue.length = 0;
  }

  pending() {
    return this.queue.length + this.booms.length;
  }

  /** 0..1 per barrel: sizzling = ~0.4, just fired = 1, cooling back to 0. */
  heatLevels() {
    return this.barrels.map((_, i) => {
      if (this.armed[i]) return 0.4;
      return Math.max(0, Math.min(1, 1 - (this.clock - this.lastBoom[i]) / 1.8));
    });
  }

  /** Strength 0..1.4 of the ground shake felt at world point p. */
  shake(p: THREE.Vector3) {
    let s = 0;
    for (const b of this.blasts) {
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      s += Math.exp(-b.t * 5.5) / (1 + d * 0.28);
    }
    return Math.min(s, 1.4);
  }

  /* ------------------------------ frame ------------------------------ */

  update(dt: number, cam: THREE.Camera, night: number, lamp: number) {
    this.clock += dt;
    this.camPos.copy(cam.position);

    while (this.queue.length && this.queue[0] <= this.clock) {
      this.queue.shift();
      this.armNext();
    }
    while (this.booms.length && this.booms[0].t <= this.clock) {
      const b = this.booms.shift()!;
      this.explode(b.i);
    }

    // flash light: sum of decaying blasts, placed at their weighted centre
    let level = 0;
    let lx = 0;
    let lz = 0;
    for (let k = this.blasts.length - 1; k >= 0; k--) {
      const b = this.blasts[k];
      b.t += dt;
      if (b.t > 1.4) { this.blasts.splice(k, 1); continue; }
      const e = Math.exp(-b.t * 8) + 0.3 * Math.exp(-b.t * 2.4);
      level += e;
      lx += b.x * e;
      lz += b.z * e;
    }
    if (level > 0) this.light.position.set(lx / level, 1.6, lz / level);
    this.light.intensity = Math.min(level, 2.2) * 28;

    const u = this.uniforms;
    u.uLight.value.set(0.96 + (0.2 - 0.96) * night, 0.94 + (0.23 - 0.94) * night, 0.9 + (0.34 - 0.9) * night);
    u.uLamp.value = lamp;
    u.uFlash.value = Math.min(1, level * 0.5);

    const wx = 0.7 + 0.25 * Math.sin(this.clock * 0.23);
    const wz = 0.18 * Math.sin(this.clock * 0.17 + 1);
    this.smoke.update(dt, wx, wz);
    this.fire.update(dt, wx * 0.3, wz * 0.3);
    this.rings.update(dt, 0, 0);
    this.smoke.upload(this.camPos);
    this.fire.upload(this.camPos);
    this.rings.upload(this.camPos);
  }

  /* ------------------------------ effects ------------------------------ */

  private armNext() {
    const n = this.barrels.length;
    for (let k = 0; k < n; k++) {
      const i = (this.pointer + k) % n;
      if (this.clock < this.busyUntil[i]) continue;
      this.pointer = (i + 1) % n;
      this.busyUntil[i] = this.clock + FUSE + COOLDOWN;
      this.armed[i] = true;
      this.booms.push({ t: this.clock + FUSE + Math.random() * 0.04, i });
      this.booms.sort((a, b) => a.t - b.t);
      this.sizzle(i);
      return;
    }
    // every barrel is still cooling: hold this shot until the first one is ready again
    const soonest = Math.min(...this.busyUntil);
    this.queue.push(soonest + 0.02);
    this.queue.sort((a, b) => a - b);
  }

  /** The wick spitting small sparks just before the bang. */
  private sizzle(i: number) {
    const b = this.barrels[i];
    const R = Math.random;
    for (let k = 0; k < 7; k++) {
      this.fire.spawn({
        x: b.x + (R() - 0.5) * 0.05, y: MOUTH_Y + 0.02, z: b.z + (R() - 0.5) * 0.05,
        vx: (R() - 0.5) * 1.2, vy: 0.8 + R() * 1.6, vz: (R() - 0.5) * 1.2,
        delay: R() * FUSE * 0.9, life: 0.28 + R() * 0.3, s0: 0.07 + R() * 0.05, s1: 0.03,
        color: [3, 0, 0], drag: 1.2, grav: 5, floor: 0.03,
      });
    }
  }

  private explode(i: number) {
    const b = this.barrels[i];
    const R = Math.random;
    const mx = b.x;
    const mz = b.z;
    const my = MOUTH_Y;
    this.armed[i] = false;
    this.lastBoom[i] = this.clock;
    const { fire, smoke } = this;

    // 1. Muzzle flash at the barrel mouth + bright ground flash
    fire.spawn({ x: mx, y: my + 0.4, z: mz, life: 0.18, s0: 2.5, s1: 5.6, color: [1, 0, 0], grow: 1.6 });
    fire.spawn({ x: mx, y: 0.4, z: mz, life: 0.65, s0: 4.5, s1: 8.5, color: [2, 0, 0], grow: 1.5 });

    // 2. Tall fire pillar rocketing out of the barrel mouth
    for (let k = 0; k < 12; k++) {
      const a = R() * TAU;
      const hs = (0.08 + R() * 0.9) * (k < 5 ? 0.35 : 0.85);
      fire.spawn({
        x: mx + (R() - 0.5) * 0.08, y: my + R() * 0.15, z: mz + (R() - 0.5) * 0.08,
        vx: Math.cos(a) * hs, vz: Math.sin(a) * hs, vy: 14.0 + R() * 16.0,
        delay: k < 5 ? 0 : R() * 0.1, life: 0.6 + R() * 0.45,
        s0: 0.4 + R() * 0.35, s1: 2.2 + R() * 1.4, rv: (R() - 0.5) * 2.8,
        color: [0, 0, 0], drag: 1.1, buoy: 4.5, grow: 1.6,
      });
    }

    // 3. A few high-flying embers
    for (let k = 0; k < 8; k++) {
      const a = R() * TAU;
      const cone = 0.08 + R() * 0.35;
      const sp = 14.0 + R() * 14.0;
      fire.spawn({
        x: mx, y: my + 0.05, z: mz,
        vx: Math.cos(a) * Math.sin(cone) * sp, vy: Math.cos(cone) * sp, vz: Math.sin(a) * Math.sin(cone) * sp,
        delay: R() * 0.04, life: 0.75 + R() * 0.8, s0: 0.14 + R() * 0.08, s1: 0.04,
        color: [3, 0, 0], drag: 0.5, grav: 8.5, floor: 0.04,
      });
    }

    // 4. Realistic white-grey smoke: a tight column that rises ~10 m, billows out, then fades
    for (let k = 0; k < 10; k++) {
      const a = R() * TAU;
      const hs = 0.1 + R() * 0.7;
      const vertSpeed = 4.5 + R() * 7.5;
      const lum = 0.88 + R() * 0.1;
      smoke.spawn({
        x: mx + (R() - 0.5) * 0.12, y: my + 0.15 + R() * 0.4, z: mz + (R() - 0.5) * 0.12,
        vx: Math.cos(a) * hs, vz: Math.sin(a) * hs, vy: vertSpeed,
        delay: 0.02 + R() * 0.3, life: 7.0 + R() * 4.0,
        s0: 0.6 + R() * 0.5, s1: 4.2 + R() * 2.8, rv: (R() - 0.5) * 0.4,
        color: [lum, lum * 0.985, lum * 0.96], drag: 0.8, buoy: 1.6 + R() * 0.9,
        wind: 1, heat: 1.1, hdec: 2.6, alpha: 0.7, grow: 2.2, floor: 0.3,
      });
    }

    // 5. A ring of sand kicked up at the base, rolling out and settling quickly
    for (let k = 0; k < 6; k++) {
      const a = R() * TAU;
      const sp = 2.8 + R() * 2.6;
      smoke.spawn({
        x: mx + (R() - 0.5) * 0.2, y: 0.05, z: mz + (R() - 0.5) * 0.2,
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 0.3 + R() * 0.8,
        delay: R() * 0.08, life: 3.0 + R() * 1.8, s0: 0.8, s1: 2.4 + R() * 1.2,
        color: [0.76, 0.66, 0.5], drag: 1.7, buoy: 0.1, wind: 0.5, heat: 0.1, hdec: 4,
        alpha: 0.45, grow: 2, floor: 0.06, rv: (R() - 0.5) * 0.3,
      });
    }

    // 6. A single thin wisp of haze that lingers a few seconds
    smoke.spawn({
      x: mx + (R() - 0.5) * 0.8, y: 1.2, z: mz + (R() - 0.5) * 0.8,
      vx: (R() - 0.5) * 0.4, vz: (R() - 0.5) * 0.4, vy: 0.5,
      delay: 0.6, life: 8 + R() * 3, s0: 1.6, s1: 4.5,
      color: [0.8, 0.8, 0.8], drag: 0.8, buoy: 0.1, wind: 1, alpha: 0.3, grow: 1.8, floor: 0.5,
      rv: (R() - 0.5) * 0.15,
    });

    // 7. ground shock-wave ring
    this.rings.spawn({ x: mx, y: 0.05, z: mz, life: 0.9, s0: 9, s1: 9 });

    this.blasts.push({ t: 0, x: mx, y: my, z: mz });
    if (this.sound) this.audio.play(this.tmp.set(mx, my, mz).distanceTo(this.camPos));
  }

  dispose() {
    this.scene.remove(this.group);
    this.smoke.dispose();
    this.fire.dispose();
    this.rings.dispose();
    this.plane.dispose();
    this.ringPlane.dispose();
    this.mats.forEach((m) => m.dispose());
    this.tex.dispose();
    this.audio.dispose();
    this.light.dispose();
  }
}
