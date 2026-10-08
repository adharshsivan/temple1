import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { World } from './batch';
import { LampRig } from './lamps';
import { createMaterials, Mats } from './materials';
import { Sky } from './sky';
import { buildTemple, DEEPA_Z, GATE_Z, POND, X0, ZC } from './temple';
import { VediFx, VediMode } from './vedi';
import { Walker } from './walk';

export type Mode = 'orbit' | 'walk';

export interface HudState {
  night: boolean;
  mode: Mode;
  x: number;
  z: number;
  yaw: number;
  calls: number;
  tris: number;
  fps: number;
  vedi: { heat: number[]; pending: number };
}

export const SPOTS: Record<string, { x: number; z: number; yaw: number; pitch?: number }> = {
  gate: { x: X0, z: GATE_Z + 5.9, yaw: 0 },
  forecourt: { x: X0 + 1.0, z: DEEPA_Z + 3.5, yaw: 0.28, pitch: 0.28 }, // close enough to inspect the lamp
  mandapam: { x: X0, z: 1.6, yaw: 0 },
  sanctum: { x: X0 + 0.3, z: -0.55, yaw: 0 },
  murals: { x: X0, z: ZC - 4.2, yaw: Math.PI }, // circumambulation path behind the sreekovil, facing its back-wall murals
  chuttu: { x: X0, z: -9.8, yaw: Math.PI }, // view the illuminated Chuttuvilakku wall up close
  hall: { x: -10.8, z: -3.0, yaw: Math.PI / 2 },
  vazhipaadu: { x: 8.7, z: 7.2, yaw: Math.PI, pitch: 0.12 }, // centred, just outside the queue pen, facing the counter
  pond: { x: 6.0, z: 2.5, yaw: -Math.PI / 2 },
  kulam: { x: 18.08, z: 2.8, yaw: -Math.PI / 2, pitch: -0.08 }, // on the dry tread by the doorway, facing the pond
  vedi: { x: 6.5, z: -16.5, yaw: -0.15, pitch: 0.16 }, // outside the NE walk-through, looking towards the vedi barrels
};

export const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  iso: { pos: [46, 29, 44], target: [3, 1, 1.5] },
  plan: { pos: [4, 72, 10], target: [4, 0, 2] },
  front: { pos: [X0, 5.5, 46], target: [X0, 3.4, 1] },
  vedi: { pos: [6.0, 13.5, -8], target: [7.5, 6.0, -20.5] }, // angled aerial view over the NE compound wall
};

interface Look {
  sunColor: THREE.Color; sunI: number; hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number;
  envI: number; fog: THREE.Color; fogNear: number; fogFar: number; skyTop: THREE.Color; skyHorizon: THREE.Color;
}
const C = (h: number) => new THREE.Color(h);
const DAY: Look = {
  sunColor: C(0xffe8c2), sunI: 2.6, hemiSky: C(0xcfe4ff), hemiGround: C(0x9d8a68), hemiI: 0.95, envI: 0.32,
  fog: C(0xdbe4e4), fogNear: 80, fogFar: 280, skyTop: C(0x4f8fd8), skyHorizon: C(0xdde8ea),
};
const NIGHT: Look = {
  sunColor: C(0x93aee6), sunI: 0.4, hemiSky: C(0x34487f), hemiGround: C(0x1a1520), hemiI: 0.55, envI: 0.07,
  fog: C(0x0a1122), fogNear: 28, fogFar: 190, skyTop: C(0x040818), skyHorizon: C(0x15213d),
};
const DAY_WATER = C(0xffffff);
const NIGHT_WATER = C(0x7f9c82); // muted green at night, not blue
const SUN_DIR = new THREE.Vector3(13, 34, 24).normalize();
const MOON_DIR = new THREE.Vector3(-24, 30, -18).normalize();

const ease = (t: number) => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, x: number) => ease(Math.min(1, Math.max(0, (x - a) / (b - a))));

export class TempleEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  readonly world: World;
  readonly M: Mats;
  readonly triangles: number;

  private lamps: LampRig;
  private vedi: VediFx;
  private sky: Sky;
  private controls: OrbitControls;
  private walker: Walker;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private fog: THREE.Fog;
  private pointLights: { l: THREE.PointLight; base: number }[] = [];
  private pond = new THREE.Group();
  private pmrem: THREE.PMREMGenerator;
  private envTex: THREE.Texture;
  private lastTime = performance.now();
  private elapsed = 0;
  private ro: ResizeObserver;
  private tween: null | { t: number; dur: number; p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3 } = null;
  private saved = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private shakeOff = new THREE.Vector3();
  private night = false;
  private k = 0;
  private mode: Mode = 'orbit';
  private hudT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private fps = 60;
  private tmpA = new THREE.Color();
  private tmpB = new THREE.Color();
  private tmpV = new THREE.Vector3();
  private disposed = false;

  constructor(private container: HTMLElement, private onState: (s: HudState) => void) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    const dom = this.renderer.domElement;
    dom.style.display = 'block';
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.touchAction = 'none';
    dom.style.outline = 'none';
    container.appendChild(dom);

    // ---- build the site (textures -> materials -> merged static meshes) ----
    this.M = createMaterials();
    const built = buildTemple(this.M);
    this.world = built.world;
    this.triangles = built.triangles;
    this.scene.add(built.group);
    this.lamps = new LampRig(this.world, this.M);
    this.scene.add(this.lamps.group);
    // kathina vedi blast effects (fire / smoke / dust / flash light / sound)
    this.vedi = new VediFx(this.scene, this.world.vediBarrels);

    // ---- environment (for brass / gold reflections), lights ----
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTex = this.pmrem.fromScene(room, 0.04).texture;
    room.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
    this.scene.environment = this.envTex;

    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x9d8a68, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe8c2, 3);
    this.sun.castShadow = true;
    const ss = coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(ss, ss);
    const sc = this.sun.shadow.camera;
    sc.left = -36; sc.right = 36; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 170;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun, this.sun.target);
    this.sun.target.position.set(4, 0, 2);

    for (const l of this.world.lights) {
      const p = new THREE.PointLight(0xffa550, 0, l.distance, 2);
      p.position.set(l.x, l.y, l.z);
      this.scene.add(p);
      this.pointLights.push({ l: p, base: l.intensity });
    }

    this.fog = new THREE.Fog(0xdbe4e4, DAY.fogNear, DAY.fogFar);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0xdbe4e4);
    this.sky = new Sky(this.M.halo.uniforms.uMap.value as THREE.Texture);
    this.scene.add(this.sky.group);

    this.buildPondMarker();

    // ---- controls ----
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 140;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.tween = null; });
    this.walker = new Walker(dom, this.world);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.placeView('iso', true);
    this.applyLighting();

    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(this.tick);
  }

  /* ----------------------------- public API ----------------------------- */

  setNight(n: boolean) { this.night = n; }
  toggleNight() { this.night = !this.night; return this.night; }
  setRun(r: boolean) { this.walker.run = r; }
  setJoystick(x: number, y: number) { this.walker.joy.set(x, y); }
  setPondMarker(v: boolean) { this.pond.visible = v; }
  getMode() { return this.mode; }

  /** Kathina vedi: queue shots. one = next barrel, salvo = N in a ripple, interval = N one by one. */
  vediFire(mode: VediMode, count: number, interval: number) { this.vedi.request(mode, count, interval); }
  vediStop() { this.vedi.stop(); }
  setVediSound(on: boolean) { this.vedi.sound = on; }

  setMode(m: Mode) {
    if (m === this.mode) return;
    this.shakeOff.set(0, 0, 0);
    if (m === 'walk') {
      this.saved.pos.copy(this.camera.position);
      this.saved.target.copy(this.controls.target);
      this.controls.enabled = false;
      this.controls.autoRotate = false;
      this.tween = null;
      this.camera.fov = 70;
      this.camera.updateProjectionMatrix();
      this.walker.enabled = true;
      const s = SPOTS.gate;
      this.walker.teleport(s.x, s.z, s.yaw);
    } else {
      this.walker.enabled = false;
      this.walker.joy.set(0, 0);
      this.camera.fov = 45;
      this.camera.rotation.set(0, 0, 0);
      this.camera.updateProjectionMatrix();
      this.controls.enabled = true;
      this.camera.position.copy(this.saved.pos);
      this.controls.target.copy(this.saved.target);
      this.controls.update();
    }
    this.mode = m;
    this.emit();
  }

  goto(name: string) {
    const s = SPOTS[name];
    if (!s) return;
    if (this.mode !== 'walk') this.setMode('walk');
    this.walker.teleport(s.x, s.z, s.yaw, s.pitch ?? 0);
    this.emit();
  }

  setView(name: string) {
    if (this.mode !== 'orbit') this.setMode('orbit');
    this.controls.autoRotate = false;
    this.placeView(name, false);
  }

  getMapData() {
    return {
      footprints: this.world.footprints, reserved: this.world.reserved, compound: this.world.compound,
      pondPlot: this.world.pondPlot, kulam: this.world.kulam, kulamWater: this.world.kulamWater,
      pondDoor: this.world.pondDoor,
      vediPlot: this.world.vediPlot, vediDoor: this.world.vediDoor, vediBarrels: this.world.vediBarrels,
    };
  }

  /** Export the merged static temple + instanced lamps as a binary glTF (GLB). */
  exportGLB(): Promise<boolean> {
    return new Promise((resolve) => {
      const root = new THREE.Group();
      root.name = 'LokamSreeThiruvaazhikulamDeviKshethram';
      const stat = this.scene.getObjectByName('StaticTemple');
      if (stat) root.add(stat.clone());
      for (const n of ['wallLamps', 'stoneLamps', 'brassLamps']) {
        const o = this.scene.getObjectByName(n);
        if (o) root.add(o.clone());
      }
      new GLTFExporter().parse(
        root,
        (res) => {
          const blob = new Blob([res as ArrayBuffer], { type: 'model/gltf-binary' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'lokam-devi-kshethram.glb';
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          resolve(true);
        },
        (err) => {
          console.error(err);
          resolve(false);
        },
        { binary: true, onlyVisible: false },
      );
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.walker.dispose();
    this.controls.dispose();
    this.vedi.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.lamps.dispose();
    this.sky.dispose();
    this.pond.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
    this.M.dispose();
    this.envTex.dispose();
    this.pmrem.dispose();
    this.sun.shadow.map?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  /* ------------------------------ internals ------------------------------ */

  private buildPondMarker() {
    const w = POND.x1 - POND.x0;
    const d = POND.z1 - POND.z0;
    const cx = (POND.x0 + POND.x1) / 2;
    const cz = (POND.z0 + POND.z1) / 2;
    const fillM = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.09, depthWrite: false, fog: false });
    const edgeM = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fillM);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(cx, 0.07, cz);
    this.pond.add(fill);
    const strip = (sx: number, sz: number, px: number, pz: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), edgeM);
      m.rotation.x = -Math.PI / 2;
      m.position.set(px, 0.075, pz);
      this.pond.add(m);
    };
    strip(w, 0.16, cx, POND.z0);
    strip(w, 0.16, cx, POND.z1);
    strip(0.16, d, POND.x0, cz);
    strip(0.16, d, POND.x1, cz);
    this.pond.renderOrder = 3;
    this.pond.visible = false;
    this.scene.add(this.pond);
  }

  private placeView(name: string, instant: boolean) {
    const v = VIEWS[name] ?? VIEWS.iso;
    const aspect = this.camera.aspect || 1.6;
    const fit = aspect < 1.5 ? Math.min(2.2, 1.5 / aspect) : 1;
    const t = new THREE.Vector3(...v.target);
    const p = new THREE.Vector3(...v.pos).sub(t).multiplyScalar(fit).add(t);
    if (instant) {
      this.camera.position.copy(p);
      this.controls.target.copy(t);
      this.controls.update();
    } else {
      this.tween = { t: 0, dur: 1.6, p0: this.camera.position.clone(), p1: p, t0: this.controls.target.clone(), t1: t };
    }
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private lerpLook() {
    const e = ease(this.k);
    const lerp = (a: number, b: number) => a + (b - a) * e;
    this.sun.color.copy(DAY.sunColor).lerp(NIGHT.sunColor, e);
    this.sun.intensity = lerp(DAY.sunI, NIGHT.sunI);
    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, e);
    this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, e);
    this.hemi.intensity = lerp(DAY.hemiI, NIGHT.hemiI);
    this.scene.environmentIntensity = lerp(DAY.envI, NIGHT.envI);
    this.M.water.color.copy(DAY_WATER).lerp(NIGHT_WATER, e);
    this.tmpA.set(0xffffff).lerp(NIGHT_WATER, e * 0.8);
    this.M.waterBody.color.copy(this.tmpA);
    this.fog.color.copy(DAY.fog).lerp(NIGHT.fog, e);
    this.fog.near = lerp(DAY.fogNear, NIGHT.fogNear);
    this.fog.far = lerp(DAY.fogFar, NIGHT.fogFar);
    (this.scene.background as THREE.Color).copy(this.fog.color);
    // sun -> moon swing (sun fades first, moon fades in)
    this.tmpV.copy(SUN_DIR).lerp(MOON_DIR, e).normalize().multiplyScalar(62);
    this.sun.position.copy(this.tmpV).add(this.sun.target.position);
    return e;
  }

  private applyLighting() {
    this.lerpLook();
  }

  private emit() {
    const cam = this.camera;
    const yaw = this.mode === 'walk'
      ? this.walker.yaw
      : Math.atan2(cam.position.x - this.controls.target.x, cam.position.z - this.controls.target.z);
    const px = this.mode === 'walk' ? this.walker.x : cam.position.x;
    const pz = this.mode === 'walk' ? this.walker.z : cam.position.z;
    this.onState({
      night: this.night,
      mode: this.mode,
      x: px,
      z: pz,
      yaw,
      calls: this.renderer.info.render.calls,
      tris: this.renderer.info.render.triangles,
      fps: Math.round(this.fps),
      vedi: { heat: this.vedi.heatLevels(), pending: this.vedi.pending() },
    });
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.elapsed += dt;
    const t = this.elapsed;

    const target = this.night ? 1 : 0;
    let e = ease(this.k);
    if (this.k !== target) {
      const step = dt / 1.8;
      this.k = target > this.k ? Math.min(target, this.k + step) : Math.max(target, this.k - step);
      e = this.lerpLook();
    }
    const lampE = smoothstep(0.15, 0.85, e);
    this.lamps.update(t, lampE);
    // gentle kulam ripple: drift the water texture
    const wmap = this.M.water.map;
    if (wmap) wmap.offset.set((t * 0.008) % 1, (t * 0.005) % 1);
    this.pointLights.forEach((p, i) => {
      const fl = 1 + 0.05 * Math.sin(t * 7 + i * 2.1) + 0.03 * Math.sin(t * 13.3 + i);
      p.l.intensity = p.base * lampE * fl;
    });

    // take last frame's blast shake back off before the camera systems read the camera
    if (this.shakeOff.lengthSq() > 0) {
      this.camera.position.sub(this.shakeOff);
      this.shakeOff.set(0, 0, 0);
    }

    if (this.mode === 'walk') {
      this.walker.update(dt, this.camera);
    } else {
      if (this.tween) {
        const tw = this.tween;
        tw.t += dt;
        const u = ease(Math.min(1, tw.t / tw.dur));
        this.camera.position.lerpVectors(tw.p0, tw.p1, u);
        this.controls.target.lerpVectors(tw.t0, tw.t1, u);
        if (tw.t >= tw.dur) this.tween = null;
      }
      this.controls.update(dt);
    }

    // kathina vedi: queue, blasts, particles, flash light; then the felt shock of the bangs
    this.vedi.update(dt, this.camera, e, lampE);
    const sh = this.vedi.shake(this.camera.position);
    if (sh > 0.002) {
      const a = sh * 0.045;
      this.shakeOff.set((Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 1.4 * a, (Math.random() - 0.5) * 2 * a);
      this.camera.position.add(this.shakeOff);
      if (this.mode === 'walk') {
        this.camera.rotation.x += (Math.random() - 0.5) * sh * 0.02;
        this.camera.rotation.z += (Math.random() - 0.5) * sh * 0.012;
      }
    }

    this.tmpA.copy(DAY.skyTop).lerp(NIGHT.skyTop, e);
    this.tmpB.copy(DAY.skyHorizon).lerp(NIGHT.skyHorizon, e);
    this.sky.update(e, this.camera.position, SUN_DIR, MOON_DIR, this.tmpA, this.tmpB);

    this.renderer.render(this.scene, this.camera);

    this.fpsAcc += dt;
    this.fpsN++;
    this.hudT += dt;
    if (this.hudT > 0.15) {
      this.fps = this.fpsN / Math.max(this.fpsAcc, 1e-3);
      this.fpsAcc = 0;
      this.fpsN = 0;
      this.hudT = 0;
      this.emit();
    }
  };
}
