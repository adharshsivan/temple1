import * as THREE from 'three';
import { makeIronTexture } from './fxTextures';
import { createMuralAtlas } from './murals';
import {
  makeCarvedStoneTexture, makeGrassTexture, makeHaloTexture, makeLateriteTexture, makeLimeTexture,
  makePavingTexture, makeStoneTexture, makeTileTextures, makeTimberTexture, makeWaterTexture,
} from './textures';

/**
 * Shared material library. Every static mesh in the compound uses one of these,
 * so the whole site collapses into ~12 merged draw calls.
 * `userData.texScale` = metres per texture repeat (used by the world-space UV projector).
 * `userData.grain`    = timber-like material (UVs are swapped on long horizontal members).
 */
export interface Mats {
  tile: THREE.MeshStandardMaterial;
  ridge: THREE.MeshStandardMaterial;
  lime: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  timberDark: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  carvedStone: THREE.MeshStandardMaterial;
  paving: THREE.MeshStandardMaterial;
  laterite: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  deepaBrass: THREE.MeshStandardMaterial;
  // lamp materials (instanced, no vertex colours)
  lampStone: THREE.MeshStandardMaterial;
  lampBrass: THREE.MeshStandardMaterial;
  flame: THREE.MeshBasicMaterial;
  halo: THREE.ShaderMaterial;
  water: THREE.MeshStandardMaterial;
  waterBody: THREE.MeshStandardMaterial;
  counterSign: THREE.MeshStandardMaterial;
  queueRail: THREE.MeshStandardMaterial;
  mural: THREE.MeshStandardMaterial;
  castIron: THREE.MeshStandardMaterial;
  scorch: THREE.MeshStandardMaterial;
  textures: THREE.Texture[];
  dispose(): void;
}

export function createMaterials(): Mats {
  const tile = makeTileTextures();
  const limeT = makeLimeTexture();
  const stoneT = makeStoneTexture();
  const carvedT = makeCarvedStoneTexture();
  const pavT = makePavingTexture();
  const latT = makeLateriteTexture();
  const grassT = makeGrassTexture();
  const timberT = makeTimberTexture();
  const haloT = makeHaloTexture();
  const waterT = makeWaterTexture();

  const std = (
    name: string, p: THREE.MeshStandardMaterialParameters, texScale: number, grain = false, vc = true,
  ) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, vertexColors: vc, ...p });
    m.name = name;
    m.userData.texScale = texScale;
    m.userData.grain = grain;
    return m;
  };

  const tileM = std('tile', { map: tile.map, bumpMap: tile.bump, bumpScale: 1.6, roughness: 0.86 }, 1);
  const ridge = std('ridge', { map: tile.map, color: 0xffeadb, roughness: 0.82 }, 0.5);
  const lime = std('lime', { map: limeT, roughness: 0.96 }, 2);
  const timber = std('timber', { map: timberT, roughness: 0.78 }, 1, true);
  const timberDark = std('timberDark', { map: timberT, color: 0x9a8a7c, roughness: 0.8 }, 1, true);
  const stone = std('stone', { map: stoneT, color: 0xf2ece0, roughness: 0.92 }, 2);
  const stoneDark = std('stoneDark', { map: stoneT, color: 0xa8a094, roughness: 0.94 }, 2);
  const carvedStone = std('carvedStone', { map: carvedT, color: 0xece6d8, roughness: 0.95 }, 0.8);
  const paving = std('paving', { map: pavT, roughness: 0.93 }, 2.4);
  const laterite = std('laterite', { map: latT, roughness: 1 }, 4);
  const grass = std('grass', { map: grassT, roughness: 1 }, 4);
  laterite.userData.noCast = true;
  grass.userData.noCast = true;
  paving.userData.noCast = true;
  const brass = std('brass', { color: 0xc99a3a, metalness: 0.85, roughness: 0.36 }, 1);
  const gold = std('gold', { color: 0xe6b640, metalness: 1, roughness: 0.26 }, 1);
  // Aged brass retains highlights without looking like a glowing gold plastic surface.
  const deepaBrass = std(
    'deepaBrass',
    { color: 0xbd8b43, metalness: 0.72, roughness: 0.43, emissive: 0x251507, emissiveIntensity: 0.12 },
    1,
  );

  const lampStone = std('lampStone', { map: stoneT, color: 0xd8d0c2, roughness: 0.9 }, 1, false, false);
  const lampBrass = std('lampBrass', { color: 0xc99a3a, metalness: 0.85, roughness: 0.34 }, 1, false, false);

  const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.45, 0.42), toneMapped: false });
  flame.name = 'flame';

  const halo = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: haloT },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(1.0, 0.58, 0.22) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        mv.xy += position.xy * s;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float a = texture2D(uMap, vUv).a * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  halo.name = 'halo';

  // Tropical pond water surface: own mesh (not batch-merged) so it can ripple.
  const water = new THREE.MeshStandardMaterial({
    name: 'water',
    map: waterT,
    transparent: true,
    opacity: 0.5,
    roughness: 0.08,
    metalness: 0.05,
    envMapIntensity: 1.8,
    depthWrite: false,
  });
  water.userData.texScale = 3;
  // The water's body: depth-shaded volume (vertex colours supply the emerald gradient).
  const waterBody = new THREE.MeshStandardMaterial({
    name: 'waterBody',
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    roughness: 0.4,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Bilingual signboard: Malayalam "വഴിപാട് കൗണ്ടർ" over English "VAZHIPAADU COUNTER". The canvas
  // aspect (6.5 : 1) matches the 4.88 x 0.751 m board face. System Malayalam fonts are used
  // immediately; if Noto Serif Malayalam loads from the page's font link, the board redraws.
  const SIGN_TEXT = 'വഴിപാട് കൗണ്ടർ';
  const SIGN_EN = 'VAZHIPAADU COUNTER';
  const SIGN_W = 1560;
  const SIGN_H = 240;
  const SIGN_FONT = '"Noto Serif Malayalam", "Noto Sans Malayalam", "Nirmala UI", "Kartika", "Malayalam MN", "Malayalam Sangam MN", "Manjari", "Meera", "Rachana", serif';
  const signCanvas = document.createElement('canvas');
  signCanvas.width = SIGN_W;
  signCanvas.height = SIGN_H;
  const signCtx = signCanvas.getContext('2d')!;
  const drawSign = () => {
    const g = signCtx;
    g.clearRect(0, 0, SIGN_W, SIGN_H);
    // dark teak board with a subtle vertical gradient
    const bg = g.createLinearGradient(0, 0, 0, SIGN_H);
    bg.addColorStop(0, '#4a3020');
    bg.addColorStop(1, '#33200f');
    g.fillStyle = bg;
    g.fillRect(0, 0, SIGN_W, SIGN_H);
    // double brass border
    g.strokeStyle = '#b8924f';
    g.lineWidth = 6;
    g.strokeRect(10, 10, SIGN_W - 20, SIGN_H - 20);
    g.lineWidth = 2;
    g.strokeRect(22, 22, SIGN_W - 44, SIGN_H - 44);
    g.textBaseline = 'middle';
    g.fillStyle = '#ecd29c';

    // Line 1: Malayalam, auto-fitted to the board width
    g.textAlign = 'center';
    let size = 94;
    g.font = `700 ${size}px ${SIGN_FONT}`;
    const maxW = SIGN_W - 400;
    const w = g.measureText(SIGN_TEXT).width;
    if (w > maxW) {
      size = Math.floor((size * maxW) / w);
      g.font = `700 ${size}px ${SIGN_FONT}`;
    }
    g.fillText(SIGN_TEXT, SIGN_W / 2, SIGN_H * 0.37);

    // thin brass rule between the two languages
    g.fillStyle = '#b8924f';
    g.fillRect(SIGN_W / 2 - 260, SIGN_H * 0.64, 520, 2);

    // Line 2: English, letter-spaced by hand (canvas letterSpacing is not universal)
    g.fillStyle = '#ecd29c';
    g.textAlign = 'left';
    g.font = '700 38px Georgia, "Times New Roman", serif';
    const track = 9;
    const chars = [...SIGN_EN];
    const adv = chars.map((ch) => g.measureText(ch).width + track);
    const total = adv.reduce((s, v) => s + v, 0) - track;
    let cx = SIGN_W / 2 - total / 2;
    chars.forEach((ch, i) => {
      g.fillText(ch, cx, SIGN_H * 0.8);
      cx += adv[i];
    });

  };
  drawSign();
  const signT = new THREE.CanvasTexture(signCanvas);
  signT.colorSpace = THREE.SRGBColorSpace;
  signT.anisotropy = 8;
  // Redraw once the Malayalam web font (if linked in index.html) has been fetched.
  if (typeof document !== 'undefined' && document.fonts?.load) {
    document.fonts
      .load(`700 64px "Noto Serif Malayalam"`, SIGN_TEXT)
      .then(() => {
        drawSign();
        signT.needsUpdate = true;
      })
      .catch(() => { /* system fallback font stays */ });
  }
  const counterSign = std('counterSign', { map: signT, roughness: 0.75 }, 1);
  // Queue barriers: painted blue steel pipe, like the reference photo, slightly worn so it sits in the scene.
  const queueRail = std('queueRail', { color: 0x3a74ae, metalness: 0.45, roughness: 0.46 }, 1);

  // Sreekovil murals: one shared atlas material (images load after the first frame).
  const muralAtlas = createMuralAtlas();
  const mural = std('mural', { map: muralAtlas.texture, roughness: 0.92 }, 1);

  // Kathina vedi: pitted cast-iron barrels and the scorched sand around them.
  const ironT = makeIronTexture();
  const castIron = std('castIron', { map: ironT, roughness: 0.78, metalness: 0.4 }, 1);
  // faint scorched-sand ring around a barrel's base (deliberately light, reads as sand not soot)
  const scorch = std('scorch', { color: 0x8a6f52, roughness: 1 }, 4);
  scorch.userData.noCast = true;

  const mats = [tileM, ridge, lime, timber, timberDark, stone, stoneDark, carvedStone, paving, laterite, grass, brass, gold, deepaBrass, lampStone, lampBrass, water, waterBody, counterSign, queueRail, mural, castIron, scorch];
  const textures = [tile.map, tile.bump, limeT, stoneT, carvedT, pavT, latT, grassT, timberT, haloT, waterT, signT, ironT];

  return {
    tile: tileM, ridge, lime, timber, timberDark, stone, stoneDark, carvedStone, paving, laterite, grass, brass, gold, deepaBrass,
    lampStone, lampBrass, flame, halo, water, waterBody, counterSign, queueRail, mural, castIron, scorch, textures,
    dispose() {
      mats.forEach((m) => m.dispose());
      flame.dispose();
      halo.dispose();
      muralAtlas.dispose();
      textures.forEach((t) => t.dispose());
    },
  };
}
