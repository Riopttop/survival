import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Vite resolves these to URLs (small files are inlined).
const SPRITES = import.meta.glob('../assets/sprites/*.png', { eager: true, import: 'default' });
const MISC = import.meta.glob('../assets/*.png', { eager: true, import: 'default' });
const FX = import.meta.glob('../assets/fx/*.png', { eager: true, import: 'default' });
const MODELS = import.meta.glob('../assets/models/*.glb', { eager: true, import: 'default', query: '?url' });

const base = (p) => p.split('/').pop().replace(/\.\w+$/, '');
const byName = (glob) => Object.fromEntries(Object.entries(glob).map(([p, u]) => [base(p), u]));

export const urls = { sprites: byName(SPRITES), misc: byName(MISC), fx: byName(FX), models: byName(MODELS) };

export const tex = {}; // pixel textures (nearest filtered)
export const fx = {}; // soft effect textures (linear filtered)
export const models = {}; // name -> THREE.Group

export async function loadAll(onProgress) {
  const tl = new THREE.TextureLoader();
  const gl = new GLTFLoader();
  const jobs = [];
  let done = 0;
  const tick = () => onProgress?.(++done / jobs.length);

  for (const [k, u] of Object.entries({ ...urls.sprites, ...urls.misc })) {
    jobs.push(tl.loadAsync(u).then((t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      tex[k] = t; tick();
    }));
  }
  for (const [k, u] of Object.entries(urls.fx)) {
    jobs.push(tl.loadAsync(u).then((t) => { t.colorSpace = THREE.SRGBColorSpace; fx[k] = t; tick(); }));
  }
  for (const [k, u] of Object.entries(urls.models)) {
    jobs.push(gl.loadAsync(u).then((g) => { models[k] = g.scene; tick(); }));
  }
  await Promise.all(jobs);
}
