import * as THREE from 'three';

// World scale: game logic works in "pixels" (16 px = 1 world unit) so balance numbers stay readable.
export const U = 1 / 16;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Draws many copies of one pixel sprite as camera-facing quads standing on the ground (HD-2D style).
 * Call begin(), push(...) per sprite, then end() every frame.
 */
export class SpriteBatch {
  constructor(scene, texture, {
    max = 512, lit = true, additive = false, soft = false, anchor = 'bottom', tilt = 0.55, shadow = true, size, opacity = 1, scale = 1,
  } = {}) {
    const img = texture.image;
    const w = (size?.[0] ?? img.width) * U * scale;
    const h = (size?.[1] ?? img.height) * U * scale;
    const geo = new THREE.PlaneGeometry(w, h);
    if (anchor === 'bottom') geo.translate(0, h / 2, 0);
    // Normals point up so sprites are lit like the ground they stand on, whatever side the light is.
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0.35);
    this.tilt = tilt;

    let mat;
    if (additive) {
      mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    } else if (soft) {
      mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    } else if (lit) {
      mat = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
      // Mirrored sprites (negative x scale) render their back face; keep them lit like the front.
      mat.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
      };
    } else {
      mat = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
    }
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (additive || soft) this.mesh.renderOrder = 5;
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
    if (shadow && !additive && !soft) {
      this.mesh.castShadow = true;
      this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
    }
    this.max = max;
    this.i = 0;
    scene.add(this.mesh);
  }

  begin() { this.i = 0; }

  // x,z in world units; y lifts off the ground. sx/sy scale (negative sx flips). rot spins in the sprite plane.
  push(x, z, sx = 1, sy = 1, r = 1, g = 1, b = 1, rot = 0, y = 0) {
    if (this.i >= this.max) return;
    _e.set(-this.tilt, 0, rot, 'XYZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, 1));
    this.mesh.setMatrixAt(this.i, _m);
    this.mesh.setColorAt(this.i, _c.setRGB(r, g, b));
    this.i++;
  }

  end() {
    this.mesh.count = this.i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
