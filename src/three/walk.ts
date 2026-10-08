import * as THREE from 'three';
import type { World } from './batch';

/**
 * First-person walker: WASD / arrows / touch joystick, drag-to-look,
 * 2D circle-vs-AABB collision, and a max step-up height so that plinths block
 * the player while the 0.22 m pond stair risers can be climbed.
 */
export class Walker {
  x = 0;
  z = 0;
  y = 1.65;
  yaw = 0;
  pitch = 0;
  groundH = 0;
  readonly joy = new THREE.Vector2(); // x: strafe, y: forward
  run = false;
  enabled = false;
  moving = 0;

  readonly radius = 0.34;
  readonly eye = 1.65;
  private keys = new Set<string>();
  private dragId = -1;
  private lastX = 0;
  private lastY = 0;
  private bob = 0;

  constructor(private dom: HTMLElement, private world: World) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    dom.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.dom.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  teleport(x: number, z: number, yaw: number, pitch = 0) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.pitch = pitch;
    this.groundH = this.world.heightAt(x, z);
    this.y = this.groundH + this.eye;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onBlur = () => this.keys.clear();

  private onDown = (e: PointerEvent) => {
    if (!this.enabled || this.dragId !== -1) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.dragId = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    try { this.dom.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  private onMove = (e: PointerEvent) => {
    if (!this.enabled || e.pointerId !== this.dragId) return;
    const k = e.pointerType === 'touch' ? 0.0052 : 0.0034;
    this.yaw -= (e.clientX - this.lastX) * k;
    this.pitch -= (e.clientY - this.lastY) * k;
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.dragId) this.dragId = -1;
  };

  private canStand(nx: number, nz: number) {
    if (this.world.hits(nx, nz, this.radius)) return false;
    // A little tolerance for floating-point rounding at the exact 0.22 m risers.
    return this.world.heightAt(nx, nz) - this.groundH <= 0.225;
  }

  update(dt: number, cam: THREE.PerspectiveCamera) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    let f = 0;
    let s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('KeyA')) s -= 1;
    if (k.has('ArrowLeft') || k.has('KeyQ')) this.yaw += 1.8 * dt;
    if (k.has('ArrowRight') || k.has('KeyE')) this.yaw -= 1.8 * dt;
    f += this.joy.y;
    s += this.joy.x;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const fast = this.run || k.has('ShiftLeft') || k.has('ShiftRight');
    const sp = fast ? 5.4 : 3.0;
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    const dx = (-sy * f + cy * s) * sp * dt;
    const dz = (-cy * f - sy * s) * sp * dt;
    if (dx !== 0 && this.canStand(this.x + dx, this.z)) this.x += dx;
    if (dz !== 0 && this.canStand(this.x, this.z + dz)) this.z += dz;
    this.x = Math.max(-80, Math.min(80, this.x));
    this.z = Math.max(-45, Math.min(80, this.z));
    this.groundH = this.world.heightAt(this.x, this.z);
    this.moving = Math.min(1, Math.hypot(f, s));
    this.bob += dt * (fast ? 11 : 8) * this.moving;
    const target = this.groundH + this.eye + Math.sin(this.bob) * 0.025 * this.moving;
    this.y += (target - this.y) * Math.min(1, dt * 11);
    cam.position.set(this.x, this.y, this.z);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
