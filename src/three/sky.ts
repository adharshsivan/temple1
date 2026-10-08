import * as THREE from 'three';

const _rgb = { r: 0, g: 0, b: 0 };

/** Gradient sky dome + stars + moon + sun glow. Follows the camera. */
export class Sky {
  readonly group = new THREE.Group();
  private dome: THREE.Mesh;
  private stars: THREE.Points;
  private moon: THREE.Mesh;
  private moonHalo: THREE.Sprite;
  private sunHalo: THREE.Sprite;
  private mat: THREE.ShaderMaterial;
  private disposables: { dispose(): void }[] = [];

  constructor(haloTex: THREE.Texture) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Vector3(0.3, 0.5, 0.8) },
        uHorizon: { value: new THREE.Vector3(0.85, 0.9, 0.92) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Vector3(1, 0.85, 0.6) },
        uGlow: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uGlow;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.5));
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(s, 28.0) * 0.45 + pow(s, 5.0) * 0.12) * uGlow;
          if (d.y < 0.0) col = uHorizon;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sg = new THREE.SphereGeometry(520, 24, 16);
    this.dome = new THREE.Mesh(sg, this.mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // stars
    const n = 700;
    const p = new Float32Array(n * 3);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = r();
      const v = r();
      const th = u * Math.PI * 2;
      const y = 0.06 + v * 0.94;
      const rr = Math.sqrt(1 - y * y);
      p[i * 3] = Math.cos(th) * rr * 480;
      p[i * 3 + 1] = y * 480;
      p[i * 3 + 2] = Math.sin(th) * rr * 480;
    }
    const stg = new THREE.BufferGeometry();
    stg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const stm = new THREE.PointsMaterial({
      size: 1.8, sizeAttenuation: false, color: 0xdfe8ff, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.stars = new THREE.Points(stg, stm);
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    const mg = new THREE.SphereGeometry(10, 20, 14);
    const mm = new THREE.MeshBasicMaterial({ color: 0xf6efd6, fog: false, transparent: true, opacity: 0, depthWrite: false });
    this.moon = new THREE.Mesh(mg, mm);
    this.moon.renderOrder = -8;
    this.moon.frustumCulled = false;
    this.group.add(this.moon);

    const hm = new THREE.SpriteMaterial({
      map: haloTex, color: 0x8fa8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.moonHalo = new THREE.Sprite(hm);
    this.moonHalo.scale.setScalar(110);
    this.moonHalo.renderOrder = -8;
    this.group.add(this.moonHalo);

    const sm = new THREE.SpriteMaterial({
      map: haloTex, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.sunHalo = new THREE.Sprite(sm);
    this.sunHalo.scale.setScalar(120);
    this.sunHalo.renderOrder = -8;
    this.group.add(this.sunHalo);

    this.disposables.push(sg, stg, stm, mg, mm, hm, sm, this.mat);
  }

  update(
    k: number, cam: THREE.Vector3, sunDir: THREE.Vector3, moonDir: THREE.Vector3,
    top: THREE.Color, horizon: THREE.Color,
  ) {
    this.group.position.copy(cam);
    const u = this.mat.uniforms;
    top.getRGB(_rgb, THREE.SRGBColorSpace);
    u.uTop.value.set(_rgb.r, _rgb.g, _rgb.b);
    horizon.getRGB(_rgb, THREE.SRGBColorSpace);
    u.uHorizon.value.set(_rgb.r, _rgb.g, _rgb.b);
    u.uSunDir.value.copy(sunDir);
    u.uGlow.value = Math.max(0, 1 - k * 1.6);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, (k - 0.55) / 0.45);
    this.moon.position.copy(moonDir).multiplyScalar(420);
    this.moonHalo.position.copy(this.moon.position);
    this.sunHalo.position.copy(sunDir).multiplyScalar(420);
    const mo = Math.max(0, (k - 0.4) / 0.6);
    (this.moon.material as THREE.MeshBasicMaterial).opacity = mo;
    (this.moonHalo.material as THREE.SpriteMaterial).opacity = mo * 0.4;
    (this.sunHalo.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k * 2) * 0.55;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
