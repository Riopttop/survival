import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { models } from './assets.js';

export const PITCH = 0.82; // camera angle below the horizon (radians)

// ------------------------------------------------------------------ post effect
// HD-2D look: tilt-shift blur at the top/bottom of the screen, vignette and a cool/warm grade.
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    blur: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float blur; varying vec2 vUv;
    void main(){
      float focus = smoothstep(0.22, 0.5, abs(vUv.y - 0.47)) * blur;
      vec2 px = 1.0 / resolution;
      vec4 col = texture2D(tDiffuse, vUv);
      if (focus > 0.01) {
        vec4 acc = col; float wsum = 1.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt(float(i) + 0.5) * focus * 2.2;
          vec2 o = vec2(cos(a), sin(a)) * r * px;
          acc += texture2D(tDiffuse, vUv + o); wsum += 1.0;
        }
        col = acc / wsum;
      }
      // grade: lift shadows toward teal, warm highlights
      float l = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb += vec3(-0.01, 0.012, 0.03) * (1.0 - l);
      col.rgb *= mix(vec3(1.0), vec3(1.05, 1.0, 0.94), smoothstep(0.4, 1.0, l));
      // vignette
      vec2 d = vUv - 0.5; d.x *= resolution.x / resolution.y;
      col.rgb *= mix(1.0, 0.55, smoothstep(0.35, 1.05, length(d)));
      gl_FragColor = col;
    }`,
};

// ------------------------------------------------------------------ ground shader
function makeGroundTextures() {
  // Small hand-tuned pixel textures drawn at runtime, sampled with nearest filtering.
  const mk = (draw) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); draw(g);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grass = mk((g) => {
    g.fillStyle = '#3d6b35'; g.fillRect(0, 0, 64, 64);
    const cols = ['#477a3c', '#356030', '#4f8442', '#2f5629'];
    for (let i = 0; i < 520; i++) { g.fillStyle = cols[i % 4]; g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1, 1 + (rnd() < 0.3)); }
    for (let i = 0; i < 26; i++) { // little blades
      const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64);
      g.fillStyle = '#5b9a4b'; g.fillRect(x, y, 1, 2); g.fillRect(x + 1, y + 1, 1, 1);
    }
  });
  const dirt = mk((g) => {
    g.fillStyle = '#6b5236'; g.fillRect(0, 0, 64, 64);
    const cols = ['#7a5f40', '#5d462e', '#846947', '#54402a'];
    for (let i = 0; i < 600; i++) { g.fillStyle = cols[i % 4]; g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1 + (rnd() < 0.2), 1); }
    for (let i = 0; i < 14; i++) { // pebbles
      const x = Math.floor(rnd() * 62), y = Math.floor(rnd() * 62);
      g.fillStyle = '#9a8b78'; g.fillRect(x, y, 2, 1); g.fillStyle = '#4a3a28'; g.fillRect(x, y + 1, 2, 1);
    }
  });
  return { grass, dirt };
}

function makeGround() {
  const { grass, dirt } = makeGroundTextures();
  const mat = new THREE.MeshLambertMaterial({ map: grass });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.dirtMap = { value: dirt };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform sampler2D dirtMap;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ return vnoise(p)*0.55 + vnoise(p*2.1)*0.3 + vnoise(p*4.3)*0.15; }`)
      .replace('#include <map_fragment>', `
        vec2 wuv = vWPos.xz / 4.0;            // one 64px texture = 4 world units = 16px per unit
        vec4 gC = texture2D(map, wuv);
        vec4 dC = texture2D(dirtMap, wuv);
        float n = fbm(vWPos.xz * 0.06);
        // snap the blend edge to the pixel grid so it reads as pixel art
        vec2 snapped = floor(vWPos.xz * 16.0) / 16.0;
        float n2 = fbm(snapped * 0.06) + (h21(floor(vWPos.xz*16.0)) - 0.5) * 0.04;
        float m = step(0.62, n2);
        vec4 texel = mix(gC, dC, m);
        // large-scale tint variation so the field never looks tiled
        texel.rgb *= 0.86 + 0.28 * fbm(vWPos.xz * 0.015 + 3.0);
        diffuseColor *= texel;`);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

// ------------------------------------------------------------------ props (Kenney Nature Kit)
// Each prop type becomes InstancedMeshes (one per sub-mesh) so hundreds cost a handful of draw calls.
const PROP_TYPES = {
  pineA: { m: 'tree_pineRoundA', s: 3.2, r: 10, tree: true },
  pineB: { m: 'tree_pineRoundB', s: 3.4, r: 10, tree: true },
  pineC: { m: 'tree_pineRoundC', s: 3.0, r: 9, tree: true },
  pineTall: { m: 'tree_pineTallB_detailed', s: 3.0, r: 7, tree: true },
  pineTall2: { m: 'tree_pineTallA_detailed', s: 3.2, r: 7, tree: true },
  oak: { m: 'tree_oak_dark', s: 3.4, r: 11, tree: true },
  treeD: { m: 'tree_detailed_dark', s: 3.4, r: 12, tree: true },
  treeFat: { m: 'tree_fat_darkh', s: 3.0, r: 11, tree: true },
  rockA: { m: 'rock_largeA', s: 2.4, r: 12 },
  rockB: { m: 'rock_largeB', s: 2.4, r: 12 },
  rockC: { m: 'rock_largeC', s: 2.2, r: 13 },
  rockTall: { m: 'rock_tallA', s: 2.2, r: 12 },
  rockS1: { m: 'rock_smallA', s: 2.2 },
  rockS2: { m: 'rock_smallC', s: 2.4 },
  rockS3: { m: 'rock_smallE', s: 2.2 },
  column: { m: 'statue_columnDamaged', s: 3.0, r: 6 },
  column2: { m: 'statue_column', s: 3.0, r: 6 },
  obelisk: { m: 'statue_obelisk', s: 3.2, r: 6 },
  ring: { m: 'statue_ring', s: 3.0, r: 9 },
  head: { m: 'statue_head', s: 3.0, r: 12 },
  stump: { m: 'stump_oldTall', s: 2.6, r: 6 },
  stump2: { m: 'stump_round', s: 2.6, r: 5 },
  log: { m: 'log_large', s: 2.4, r: 0 },
  mush: { m: 'mushroom_redGroup', s: 2.4 },
  mush2: { m: 'mushroom_tanGroup', s: 2.4 },
  bush: { m: 'plant_bushDetailed', s: 2.4 },
  bush2: { m: 'plant_bushLarge', s: 2.6 },
  bush3: { m: 'plant_bush', s: 2.4 },
  grass: { m: 'grass_large', s: 2.6, many: true },
  grass2: { m: 'grass', s: 2.6, many: true },
  leafs: { m: 'grass_leafsLarge', s: 2.4, many: true },
  flowerP: { m: 'flower_purpleA', s: 2.6, many: true },
  flowerR: { m: 'flower_redA', s: 2.6, many: true },
  flowerY: { m: 'flower_yellowA', s: 2.6, many: true },
};

// Re-color Nature Kit materials into one coherent night-forest palette.
const PALETTE = {
  leafsDark: new THREE.Color('#2e5a34'), leafs: new THREE.Color('#3a6b3a'), grass: new THREE.Color('#4f7f3e'),
  dirt: new THREE.Color('#6a5442'), stone: new THREE.Color('#8f8e94'), stoneDark: new THREE.Color('#5f6068'),
  woodBark: new THREE.Color('#5b3f2b'), woodBarkDark: new THREE.Color('#4a3324'), woodInner: new THREE.Color('#b08a5a'),
  _defaultMat: new THREE.Color('#d8cfc0'), colorRed: new THREE.Color('#d0453c'), colorTan: new THREE.Color('#c9a77c'),
  colorPurple: new THREE.Color('#9a6ad0'), colorYellow: new THREE.Color('#e8c84a'),
};

const CHUNK = 16; // world units per chunk
const VIEW_CHUNKS = 3; // chunks in each direction kept alive

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

class Props {
  constructor(scene) {
    this.types = {};
    for (const [key, def] of Object.entries(PROP_TYPES)) {
      const src = models[def.m];
      if (!src) continue;
      const parts = [];
      src.updateMatrixWorld(true);
      src.traverse((o) => {
        if (!o.isMesh) return;
        const old = o.material;
        const mat = new THREE.MeshLambertMaterial({ color: PALETTE[old.name] ?? old.color, flatShading: true });
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const max = def.many ? 1400 : 220;
        const im = new THREE.InstancedMesh(geo, mat, max);
        im.count = 0;
        im.castShadow = !def.many;
        im.receiveShadow = true;
        im.frustumCulled = false;
        scene.add(im);
        parts.push(im);
      });
      this.types[key] = { def, parts, list: [] };
    }
    this.colliders = new Map(); // cell -> [{x,y,r}] in game px
    this.center = null;
  }

  // Deterministic contents of one chunk.
  chunkItems(cx, cz) {
    const items = [];
    const near0 = Math.abs(cx) <= 0 && Math.abs(cz) <= 0;
    const forest = hash(Math.floor(cx / 3), Math.floor(cz / 3), 9); // big-scale density
    const r = (i, s) => hash(cx * 97 + i, cz * 131 - i, s);
    const add = (type, i, salt) => {
      const x = (cx + r(i, salt)) * CHUNK, z = (cz + r(i, salt + 1)) * CHUNK;
      if (near0 && Math.hypot(x, z) < 7) return;
      items.push({ type, x, z, rot: r(i, salt + 2) * Math.PI * 2, s: 0.85 + r(i, salt + 3) * 0.35 });
    };
    const trees = ['pineA', 'pineB', 'pineC', 'pineTall', 'pineTall2', 'oak', 'treeD', 'treeFat'];
    const nTrees = forest < 0.3 ? 0 : Math.floor((forest - 0.2) * 12);
    for (let i = 0; i < nTrees; i++) add(trees[Math.floor(r(i, 3) * trees.length)], i, 10);
    const rocks = ['rockA', 'rockB', 'rockC', 'rockTall', 'rockS1', 'rockS2', 'rockS3', 'rockS1'];
    for (let i = 0; i < 1 + Math.floor(r(0, 4) * 3); i++) add(rocks[Math.floor(r(i, 5) * rocks.length)], i + 20, 20);
    // occasional ruins
    if (r(0, 6) < 0.18) {
      const ruins = ['column', 'column2', 'obelisk', 'ring', 'head'];
      const bx = (cx + 0.3 + r(1, 6) * 0.4) * CHUNK, bz = (cz + 0.3 + r(2, 6) * 0.4) * CHUNK;
      for (let i = 0; i < 3; i++) {
        const a = r(i, 7) * 6.28, d = 2 + r(i, 8) * 3;
        items.push({ type: ruins[Math.floor(r(i, 9) * ruins.length)], x: bx + Math.cos(a) * d, z: bz + Math.sin(a) * d, rot: r(i, 10) * 6.28, s: 1 });
      }
    }
    const small = ['stump', 'stump2', 'log', 'mush', 'mush2', 'bush', 'bush2', 'bush3'];
    for (let i = 0; i < 2 + Math.floor(r(0, 11) * 4); i++) add(small[Math.floor(r(i, 12) * small.length)], i + 40, 40);
    const deco = ['grass', 'grass2', 'leafs', 'grass', 'flowerP', 'flowerR', 'flowerY', 'grass2'];
    for (let i = 0; i < 14 + Math.floor(forest * 10); i++) add(deco[Math.floor(r(i, 13) * deco.length)], i + 60, 60);
    return items;
  }

  update(px, pz) {
    const cx = Math.floor(px / CHUNK), cz = Math.floor(pz / CHUNK);
    const key = `${cx},${cz}`;
    if (key === this.center) return;
    this.center = key;
    for (const t of Object.values(this.types)) t.list.length = 0;
    this.colliders.clear();
    for (let dx = -VIEW_CHUNKS; dx <= VIEW_CHUNKS; dx++) {
      for (let dz = -VIEW_CHUNKS; dz <= VIEW_CHUNKS; dz++) {
        for (const it of this.chunkItems(cx + dx, cz + dz)) {
          const t = this.types[it.type];
          if (!t) continue;
          t.list.push(it);
          const rad = t.def.r;
          if (rad) { // collision circle in game pixels
            const gx = it.x * 16, gy = it.z * 16, rr = rad * it.s;
            const ck = `${Math.floor(gx / 64)},${Math.floor(gy / 64)}`;
            if (!this.colliders.has(ck)) this.colliders.set(ck, []);
            this.colliders.get(ck).push({ x: gx, y: gy, r: rr });
          }
        }
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const t of Object.values(this.types)) {
      for (const im of t.parts) {
        const n = Math.min(t.list.length, im.instanceMatrix.count);
        t.list.slice(0, n).forEach((it, i) => {
          const sc = t.def.s * it.s;
          m.compose(p.set(it.x, 0, it.z), q.setFromAxisAngle(up, it.rot), s.set(sc, sc, sc));
          im.setMatrixAt(i, m);
        });
        im.count = n;
        im.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // Push a circle (game px) out of any solid prop. Returns adjusted [x, y].
  collide(x, y, r) {
    const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.colliders.get(`${cx + i},${cy + j}`);
      if (!list) continue;
      for (const c of list) {
        const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy), min = c.r + r;
        if (d < min && d > 0.001) { x = c.x + (dx / d) * min; y = c.y + (dy / d) * min; }
      }
    }
    return [x, y];
  }
}

// ------------------------------------------------------------------ world
export class World {
  constructor(canvas) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.quality = mobile ? 'mid' : 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    const scene = (this.scene = new THREE.Scene());
    const sky = new THREE.Color('#0f1d2b');
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 20, 50);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 120);
    this.camDist = 30;
    this.focus = new THREE.Vector3();
    this.shake = 0;

    // Moonlight + sky fill + the hero's lantern.
    scene.add(new THREE.HemisphereLight('#8aa2c8', '#2a3524', 1.35));
    const moon = (this.moon = new THREE.DirectionalLight('#c8d4ff', 1.6));
    moon.castShadow = true;
    moon.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    const sc = moon.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.02;
    scene.add(moon, moon.target);
    this.lantern = new THREE.PointLight('#ffb35c', 14, 14, 1.3);
    scene.add(this.lantern);

    this.ground = makeGround();
    scene.add(this.ground);
    this.props = new Props(scene);

    // post processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.finish = new ShaderPass(FinishShader);
    this.composer.addPass(this.finish);
    this.composer.addPass(new OutputPass());

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio, this.quality === 'high' ? 2 : 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.setSize(w * dpr / 2, h * dpr / 2);
    this.finish.uniforms.resolution.value.set(w * dpr, h * dpr);
    this.finish.uniforms.blur.value = dpr;
    this.camera.aspect = w / h;
    // Keep roughly the same amount of ground visible on the short side of any screen.
    const portrait = h > w;
    this.camDist = portrait ? Math.min(52, 15.5 / (0.573 * (w / h))) : 26;
    this.scene.fog.near = this.camDist - 6; this.scene.fog.far = this.camDist + 24;
    this.finish.uniforms.blur.value = dpr * (portrait ? 0.6 : 1);
    this.camera.updateProjectionMatrix();
  }

  lowerQuality() {
    if (this.quality === 'low') return;
    this.quality = this.quality === 'high' ? 'mid' : 'low';
    if (this.quality === 'low') { this.bloom.enabled = false; this.moon.shadow.mapSize.set(512, 512); this.moon.shadow.map?.dispose(); this.moon.shadow.map = null; }
    this.resize();
  }

  addShake(a) { this.shake = Math.min(1, this.shake + a); }

  // x, z in world units; snap = follow instantly
  follow(x, z, dt, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 8);
    this.focus.x += (x - this.focus.x) * k;
    this.focus.z += (z - this.focus.z) * k;
    const f = this.focus;
    this.camera.position.set(f.x, f.y + Math.sin(PITCH) * this.camDist, f.z + Math.cos(PITCH) * this.camDist);
    this.camera.lookAt(f.x, 0.6, f.z);
    if (this.shake > 0) {
      const a = this.shake * this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.ground.position.set(Math.round(f.x / 4) * 4, 0, Math.round(f.z / 4) * 4);
    // shadow camera follows, snapped to its texel size to avoid shimmering
    const texel = 52 / this.moon.shadow.mapSize.x;
    const sx = Math.round(f.x / texel) * texel, sz = Math.round(f.z / texel) * texel;
    this.moon.position.set(sx - 14, 30, sz + 10);
    this.moon.target.position.set(sx, 0, sz);
    this.props.update(f.x, f.z);
  }

  render() { this.composer.render(); }
}
