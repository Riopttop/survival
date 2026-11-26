import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Additive camera-facing particles sharing one texture. Positions are in world units. */
export class Particles {
  constructor(scene, texture, { max = 600, tilt = 0.9, normal = false } = {}) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false,
      blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.set(1, 1, 1));
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
    this.max = max;
    this.tilt = tilt;
    this.list = [];
  }

  emit(o) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      x: o.x, y: o.y ?? 0.4, z: o.z,
      vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0,
      life: o.life ?? 0.6, max: o.life ?? 0.6,
      size: o.size ?? 0.5, sizeEnd: o.sizeEnd ?? 0,
      r: o.color?.[0] ?? 1, g: o.color?.[1] ?? 1, b: o.color?.[2] ?? 1,
      gravity: o.gravity ?? 0, drag: o.drag ?? 0,
      rot: o.rot ?? Math.random() * 6.28, spin: o.spin ?? 0,
      fadeIn: o.fadeIn ?? 0,
    });
  }

  burst(x, z, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      this.emit({ ...o, x, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (o.up ?? 2) * (0.5 + Math.random()), life: (o.life ?? 0.5) * (0.7 + Math.random() * 0.6) });
    }
  }

  update(dt) {
    let i = 0;
    const L = this.list;
    for (let k = L.length - 1; k >= 0; k--) {
      const p = L[k];
      p.life -= dt;
      if (p.life <= 0) { L[k] = L[L.length - 1]; L.pop(); continue; }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp; p.vz *= damp; p.vy = p.vy * damp - p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.gravity > 0) { p.y = 0.02; p.vy *= -0.3; }
      p.rot += p.spin * dt;
    }
    for (const p of L) {
      const t = 1 - p.life / p.max; // 0 -> 1
      const size = p.size + (p.sizeEnd - p.size) * t;
      let a = 1 - t;
      if (p.fadeIn > 0 && t < p.fadeIn) a *= t / p.fadeIn;
      _e.set(-this.tilt, 0, p.rot, 'XYZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(size, size, 1));
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.setRGB(p.r * a, p.g * a, p.b * a));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() { this.list.length = 0; }
}
