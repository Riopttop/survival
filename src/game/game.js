import * as THREE from 'three';
import { PLAYER, ENEMIES, WEAPONS, PASSIVES, RUN_LENGTH, BOSS_EVERY, BOSSES, MAX_ENEMIES, spawnPlan, xpForLevel } from '../data.js';
import { SpriteBatch, U } from '../engine/sprites.js';
import { Particles } from '../engine/particles.js';
import { PITCH } from '../engine/world.js';
import { tex, fx } from '../engine/assets.js';

const CELL = 24; // spatial grid cell (game px)
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Game {
  constructor(world, ui) {
    this.world = world;
    this.ui = ui;
    const scene = world.scene;

    // --- render batches
    this.shadows = new SpriteBatch(scene, blobTexture(), { soft: true, anchor: 'center', tilt: Math.PI / 2, size: [16, 16], max: 700, opacity: 0.5 });
    this.heroBatch = new SpriteBatch(scene, tex[PLAYER.sprite], { max: 1, scale: 1.5 });
    this.enemyBatches = {};
    for (const def of Object.values(ENEMIES)) {
      if (!this.enemyBatches[def.sprite]) this.enemyBatches[def.sprite] = new SpriteBatch(scene, tex[def.sprite], { max: MAX_ENEMIES, scale: 1.4 });
    }
    this.gemBatch = new SpriteBatch(scene, tex.gem, { lit: false, anchor: 'center', max: 900, shadow: false, scale: 1.3 });
    this.potionBatch = new SpriteBatch(scene, tex.potion, { lit: false, max: 30, scale: 1.2 });
    this.bladeBatch = new SpriteBatch(scene, tex.sword, { lit: false, anchor: 'center', tilt: PITCH, max: 8 });
    this.boltBatch = new SpriteBatch(scene, fx.magic_05, { additive: true, anchor: 'center', tilt: PITCH, size: [22, 22], max: 120 });

    // --- particles
    this.fxSpark = new Particles(scene, fx.star_04, { tilt: PITCH });
    this.fxGlow = new Particles(scene, fx.light_01, { tilt: PITCH, max: 300 });
    this.fxSmoke = new Particles(scene, fx.smoke_04, { tilt: PITCH, max: 200 });
    this.fxStar = new Particles(scene, fx.star_06, { tilt: PITCH, max: 200 });
    this.fxSlash = new Particles(scene, fx.slash_02, { tilt: PITCH, max: 60 });
    this.fireflies = [];

    // --- ground effects (aura disc + nova ring + level-up circle)
    const flat = (t, color) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false; m.renderOrder = 4;
      scene.add(m); return m;
    };
    this.auraDisc = flat(fx.circle_05, new THREE.Color(1.0, 0.65, 0.25));
    this.auraRunes = flat(fx.magic_02, new THREE.Color(1.0, 0.8, 0.4));
    this.novaRing = flat(fx.light_01, new THREE.Color(0.5, 0.8, 1.4));
    this.levelRing = flat(fx.magic_02, new THREE.Color(1.2, 1.0, 0.5));

    this.reset();
  }

  reset() {
    this.state = {
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, level: 1, xp: 0, xpNeed: xpForLevel(1),
      kills: 0, elapsed: 0, weapons: { bolt: 1 }, passives: {}, over: false, won: false,
    };
    this.player = { x: 0, y: 0, face: 1, moving: false, hurt: 0 };
    this.enemies = [];
    this.bolts = [];
    this.gems = [];
    this.potions = [];
    this.grid = new Map();
    this.pendingLevelUps = 0;
    this.choosing = false;
    this.spawnTimer = 0;
    this.nextBoss = BOSS_EVERY;
    this.iframes = 0;
    this.timers = { bolt: 0.3, aura: 0, nova: 1.5 };
    this.bladeAngle = 0;
    this.novaAnim = -1;
    this.levelAnim = -1;
    this.time = 0;
    this.input = { x: 0, y: 0 };
    for (const p of [this.fxSpark, this.fxGlow, this.fxSmoke, this.fxStar, this.fxSlash]) p.clear();
    this.world.follow(0, 0, 0, true);
  }

  // ------------------------------------------------------------ stats
  get speedMul() { return 1 + 0.1 * (this.state.passives.speed || 0); }
  get mightMul() { return 1 + 0.15 * (this.state.passives.might || 0); }
  get hasteMul() { return 0.92 ** (this.state.passives.haste || 0); }
  get magnet() { return PLAYER.magnet * (1 + 0.35 * (this.state.passives.magnet || 0)); }

  // ------------------------------------------------------------ frame
  update(dt, playing) {
    this.time += dt;
    const s = this.state;
    if (playing && !s.over && !this.choosing) {
      s.elapsed += dt;
      if (s.elapsed >= RUN_LENGTH) this.endRun(true);
      this.movePlayer(dt);
      this.spawn(dt);
      this.buildGrid();
      this.moveEnemies(dt);
      this.weaponBolt(dt);
      this.weaponBlades(dt);
      this.weaponAura(dt);
      this.weaponNova(dt);
      this.updatePickups(dt);
      if (this.pendingLevelUps > 0) this.openLevelUp();
    }
    this.ambient(dt);
    this.draw(dt);
  }

  movePlayer(dt) {
    let { x, y } = this.input;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const sp = PLAYER.speed * this.speedMul;
    const p = this.player;
    p.x += x * sp * dt; p.y += y * sp * dt;
    [p.x, p.y] = this.world.props.collide(p.x, p.y, PLAYER.radius);
    p.moving = len > 0.1;
    if (Math.abs(x) > 0.05) p.face = x < 0 ? -1 : 1;
    if (this.iframes > 0) this.iframes -= dt;
    if (p.hurt > 0) p.hurt -= dt;
    // footstep dust
    if (p.moving && Math.random() < dt * 8) {
      this.fxSmoke.emit({ x: p.x * U + rand(-0.2, 0.2), z: p.y * U + 0.1, y: 0.1, vy: 0.4, size: 0.35, sizeEnd: 0.8, life: 0.5, color: [0.35, 0.32, 0.28] });
    }
  }

  hurtPlayer(dmg) {
    if (this.iframes > 0 || this.state.over) return;
    this.state.hp -= dmg;
    this.iframes = PLAYER.iframes;
    this.player.hurt = 0.15;
    this.world.addShake(0.25);
    this.fxSpark.burst(this.player.x * U, this.player.y * U, 6, { size: 0.5, color: [1, 0.3, 0.2], speed: 3, life: 0.3, y: 0.6 });
    if (this.state.hp <= 0) { this.state.hp = 0; this.endRun(false); }
  }

  endRun(won) {
    this.state.over = true;
    this.state.won = won;
    this.ui.showEnd(won, this.state);
  }

  // ------------------------------------------------------------ enemies
  spawnPoint() {
    const cam = this.world.camera;
    // just outside what the camera can see
    const r = (Math.max(cam.aspect, 1) * 15 + 6) / U * 0.6;
    const a = Math.random() * Math.PI * 2;
    return { x: this.player.x + Math.cos(a) * r, y: this.player.y + Math.sin(a) * r * 0.85 };
  }

  spawn(dt) {
    const s = this.state;
    const plan = spawnPlan(s.elapsed);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = plan.interval;
      for (let i = 0; i < plan.batch && this.enemies.length < MAX_ENEMIES; i++) this.addEnemy(pick(plan.pool), plan.hpMul);
    }
    if (s.elapsed >= this.nextBoss) {
      const idx = Math.round(this.nextBoss / BOSS_EVERY) - 1;
      this.nextBoss += BOSS_EVERY;
      this.addEnemy(BOSSES[idx % BOSSES.length], plan.hpMul, true);
      this.ui.banner('boss');
    }
  }

  addEnemy(kind, hpMul, boss = false) {
    const def = ENEMIES[kind];
    const p = this.spawnPoint();
    this.enemies.push({
      def, boss, x: p.x, y: p.y,
      hp: def.hp * hpMul * (boss ? 14 : 1), maxHp: def.hp * hpMul * (boss ? 14 : 1),
      speed: def.speed * (boss ? 1.1 : rand(0.9, 1.1)),
      radius: def.radius * (boss ? 2.6 : 1), dmg: def.dmg * (boss ? 2 : 1),
      kx: 0, ky: 0, bladeHit: 0, flash: 0, phase: Math.random() * 10, face: 1, alive: true,
    });
    if (boss) this.ui.bossBar(this.enemies[this.enemies.length - 1]);
  }

  key(cx, cy) { return ((cx & 0xffff) << 16) | (cy & 0xffff); }

  buildGrid() {
    this.grid.clear();
    for (const e of this.enemies) {
      const k = this.key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let c = this.grid.get(k);
      if (!c) this.grid.set(k, (c = []));
      c.push(e);
    }
  }

  queryCircle(x, y, r, fn) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const c = this.grid.get(this.key(cx, cy));
      if (c) for (const e of c) if (e.alive && fn(e) === false) return;
    }
  }

  moveEnemies(dt) {
    const px = this.player.x, py = this.player.y;
    const far = 900;
    for (const e of this.enemies) {
      const dx = px - e.x, dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > far && !e.boss) { const p = this.spawnPoint(); e.x = p.x; e.y = p.y; continue; }
      let vx = (dx / d) * e.speed, vy = (dy / d) * e.speed;
      this.queryCircle(e.x, e.y, e.radius * 2, (o) => {
        if (o === e) return;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = e.radius + o.radius;
        if (od > 0 && od < min) { const push = ((min - od) / min) * 60; vx += (ox / od) * push; vy += (oy / od) * push; }
      });
      e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
      if (!e.def.ghost) [e.x, e.y] = this.world.props.collide(e.x, e.y, e.radius * 0.8);
      e.kx *= 0.85; e.ky *= 0.85;
      if (Math.abs(dx) > 2) e.face = dx < 0 ? -1 : 1;
      if (e.flash > 0) e.flash -= dt;
      if (d < e.radius + PLAYER.radius) this.hurtPlayer(e.dmg);
    }
  }

  damage(e, amount, fromX, fromY) {
    if (!e.alive) return;
    const dmg = Math.round(amount * this.mightMul * rand(0.9, 1.1));
    e.hp -= dmg;
    const dx = e.x - fromX, dy = e.y - fromY, d = Math.hypot(dx, dy) || 1;
    const kb = e.boss ? 15 : 90;
    e.kx += (dx / d) * kb; e.ky += (dy / d) * kb;
    e.flash = 0.08;
    this.ui.damage(e.x * U, e.y * U, 1.2 * (e.boss ? 2.4 : 1), dmg);
    this.fxSpark.burst(e.x * U, e.y * U, 3, { y: 0.5, size: 0.45, color: [1, 0.9, 0.6], speed: 3, up: 1, life: 0.25 });
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.alive = false;
    this.state.kills++;
    const n = e.boss ? 16 : 1;
    for (let i = 0; i < n; i++) this.gems.push({ x: e.x + (e.boss ? rand(-30, 30) : 0), y: e.y + (e.boss ? rand(-30, 30) : 0), v: e.boss ? 5 : e.def.xp, homing: false, sp: 0, ph: Math.random() * 6 });
    if (Math.random() < (e.boss ? 1 : 0.01)) this.potions.push({ x: e.x, y: e.y });
    const [r, g, b] = e.def.tint;
    const wx = e.x * U, wz = e.y * U, sc = e.boss ? 2.5 : 1;
    this.fxSmoke.burst(wx, wz, 5 * sc, { y: 0.4, size: 0.6 * sc, sizeEnd: 1.4 * sc, color: [r * 0.5, g * 0.5, b * 0.5], speed: 1.5, up: 0.6, life: 0.6, drag: 3 });
    this.fxGlow.burst(wx, wz, 4 * sc, { y: 0.5, size: 0.5, color: [r, g, b], speed: 4, up: 3, gravity: 9, life: 0.6, drag: 1 });
    if (e.boss) { this.world.addShake(0.6); this.ui.bossBar(null); }
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  // ------------------------------------------------------------ weapons
  nearestEnemies(n, range) {
    const px = this.player.x, py = this.player.y, r2 = range * range;
    const list = [];
    for (const e of this.enemies) { const d2 = (e.x - px) ** 2 + (e.y - py) ** 2; if (d2 < r2) list.push([d2, e]); }
    list.sort((a, b) => a[0] - b[0]);
    return list.slice(0, n).map((x) => x[1]);
  }

  weaponBolt(dt) {
    const lv = this.state.weapons.bolt;
    if (lv) {
      const st = WEAPONS.bolt.stats(lv);
      this.timers.bolt -= dt;
      if (this.timers.bolt <= 0) {
        const targets = this.nearestEnemies(st.count, 220);
        if (targets.length) {
          this.timers.bolt = st.cooldown * this.hasteMul;
          for (let i = 0; i < st.count; i++) {
            const t = targets[i % targets.length];
            const a = Math.atan2(t.y - this.player.y, t.x - this.player.x) + (i >= targets.length ? (i - targets.length + 1) * 0.25 : 0);
            this.bolts.push({ x: this.player.x, y: this.player.y - 2, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: 1.3, pierce: st.pierce, dmg: st.dmg, hit: new Set() });
          }
          this.fxGlow.emit({ x: this.player.x * U, z: this.player.y * U, y: 0.9, size: 1.2, life: 0.2, color: [1, 0.6, 1.4] });
        }
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.random() < 0.6) this.fxGlow.emit({ x: b.x * U, z: b.y * U, y: 0.7, size: 0.5, sizeEnd: 0, life: 0.3, color: [0.7, 0.4, 1.2] });
      this.queryCircle(b.x, b.y, 14, (e) => {
        if (b.hit.has(e)) return;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.radius + 4) ** 2) {
          b.hit.add(e);
          this.damage(e, b.dmg, b.x - b.vx, b.y - b.vy);
          if (--b.pierce <= 0) { b.life = 0; return false; }
        }
      });
      if (b.life <= 0) {
        this.fxGlow.burst(b.x * U, b.y * U, 4, { y: 0.7, size: 0.4, color: [0.8, 0.5, 1.3], speed: 2, up: 1, life: 0.3 });
        this.bolts.splice(i, 1);
      }
    }
  }

  weaponBlades(dt) {
    const lv = this.state.weapons.blades;
    if (!lv) return;
    const st = WEAPONS.blades.stats(lv);
    this.bladeAngle += st.spin * dt;
    const now = this.state.elapsed;
    this.bladePos = [];
    for (let i = 0; i < st.count; i++) {
      const a = this.bladeAngle + (i / st.count) * Math.PI * 2;
      const bx = this.player.x + Math.cos(a) * st.radius, by = this.player.y + Math.sin(a) * st.radius * 0.8;
      this.bladePos.push([bx, by, a]);
      if (Math.random() < 0.5) this.fxSpark.emit({ x: bx * U, z: by * U, y: 0.6, size: 0.25, life: 0.25, color: [0.6, 0.8, 1] });
      this.queryCircle(bx, by, 16, (e) => {
        if (now < e.bladeHit) return;
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 < (e.radius + 7) ** 2) {
          e.bladeHit = now + st.hitCd;
          this.damage(e, st.dmg, this.player.x, this.player.y);
        }
      });
    }
  }

  weaponAura(dt) {
    const lv = this.state.weapons.aura;
    if (!lv) return;
    const st = WEAPONS.aura.stats(lv);
    this.timers.aura -= dt;
    if (this.timers.aura <= 0) {
      this.timers.aura = st.tick * this.hasteMul;
      const r2 = st.radius ** 2;
      for (const e of [...this.enemies]) if ((e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2 < r2) this.damage(e, st.dmg, this.player.x, this.player.y);
    }
  }

  weaponNova(dt) {
    const lv = this.state.weapons.nova;
    if (!lv) return;
    const st = WEAPONS.nova.stats(lv);
    this.timers.nova -= dt;
    if (this.timers.nova <= 0) {
      this.timers.nova = st.cooldown * this.hasteMul;
      this.novaAnim = 0;
      this.novaRadius = st.radius;
      const r2 = st.radius ** 2;
      for (const e of [...this.enemies]) if ((e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2 < r2) this.damage(e, st.dmg, this.player.x, this.player.y);
      this.fxStar.burst(this.player.x * U, this.player.y * U, 14, { y: 0.4, size: 0.7, color: [0.6, 0.85, 1.4], speed: st.radius * U * 2.2, up: 0.2, life: 0.4, drag: 2 });
      this.world.addShake(0.12);
    }
  }

  // ------------------------------------------------------------ pickups
  updatePickups(dt) {
    const px = this.player.x, py = this.player.y, m2 = this.magnet ** 2;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = px - g.x, dy = py - g.y, d2 = dx * dx + dy * dy;
      if (!g.homing && d2 < m2) { g.homing = true; g.sp = -60; }
      if (g.homing) {
        g.sp += 600 * dt;
        const d = Math.sqrt(d2) || 1;
        g.x += (dx / d) * g.sp * dt; g.y += (dy / d) * g.sp * dt;
        if (d < 7) {
          this.gainXp(g.v);
          this.fxGlow.emit({ x: px * U, z: py * U, y: 0.6, size: 0.6, life: 0.2, color: [0.3, 0.9, 1.2] });
          this.gems.splice(i, 1);
        }
      }
    }
    for (let i = this.potions.length - 1; i >= 0; i--) {
      const h = this.potions[i];
      if ((px - h.x) ** 2 + (py - h.y) ** 2 < 120) {
        this.heal(30); this.potions.splice(i, 1);
        this.fxStar.burst(px * U, py * U, 10, { y: 0.6, size: 0.5, color: [1, 0.4, 0.5], speed: 2, up: 2, life: 0.5 });
      }
    }
  }

  heal(n) { this.state.hp = Math.min(this.state.maxHp, this.state.hp + n); }

  gainXp(n) {
    const s = this.state;
    s.xp += n;
    while (s.xp >= s.xpNeed) { s.xp -= s.xpNeed; s.level++; s.xpNeed = xpForLevel(s.level); this.pendingLevelUps++; }
  }

  // ------------------------------------------------------------ level up
  buildOptions() {
    const s = this.state, opts = [];
    for (const [k, w] of Object.entries(WEAPONS)) { const lv = s.weapons[k] || 0; if (lv < w.max) opts.push({ kind: 'weapon', key: k, next: lv + 1, max: w.max }); }
    for (const [k, p] of Object.entries(PASSIVES)) { const lv = s.passives[k] || 0; if (lv < p.max) opts.push({ kind: 'passive', key: k, next: lv + 1, max: p.max }); }
    const pickN = shuffle(opts).slice(0, 3);
    if (!pickN.length) pickN.push({ kind: 'heal', key: 'heal', next: 0 });
    return pickN;
  }

  openLevelUp() {
    this.choosing = true;
    this.levelAnim = 0;
    this.fxStar.burst(this.player.x * U, this.player.y * U, 24, { y: 0.3, size: 0.6, color: [1.3, 1.1, 0.5], speed: 4, up: 4, gravity: 4, life: 0.9, drag: 1.5 });
    this.ui.showLevelUp(this.buildOptions(), (opt) => this.choose(opt));
  }

  choose(opt) {
    const s = this.state;
    if (opt.kind === 'weapon') s.weapons[opt.key] = opt.next;
    else if (opt.kind === 'passive') { s.passives[opt.key] = opt.next; if (opt.key === 'vigor') { s.maxHp += 20; this.heal(20); } }
    else this.heal(30);
    this.pendingLevelUps--;
    this.choosing = false;
  }

  // ------------------------------------------------------------ ambience
  ambient(dt) {
    const f = this.world.focus;
    // fireflies drifting around the camera focus
    while (this.fireflies.length < 26) {
      this.fireflies.push({ x: f.x + rand(-16, 16), z: f.z + rand(-12, 12), y: rand(0.4, 2.4), ph: Math.random() * 6, sp: rand(0.3, 0.8) });
    }
    for (const fl of this.fireflies) {
      fl.ph += dt * fl.sp;
      fl.x += Math.cos(fl.ph * 1.3) * dt * 0.6; fl.z += Math.sin(fl.ph) * dt * 0.6;
      if (Math.abs(fl.x - f.x) > 18) fl.x = f.x - Math.sign(fl.x - f.x) * 17;
      if (Math.abs(fl.z - f.z) > 14) fl.z = f.z - Math.sign(fl.z - f.z) * 13;
      const a = 0.5 + 0.5 * Math.sin(fl.ph * 4);
      this.fxGlow.emit({ x: fl.x, z: fl.z, y: fl.y + Math.sin(fl.ph * 2) * 0.2, size: 0.45, life: dt * 1.01, color: [0.8 * a, 1.0 * a, 0.35 * a] });
    }
    for (const p of [this.fxSpark, this.fxGlow, this.fxSmoke, this.fxStar, this.fxSlash]) p.update(dt);
  }

  // ------------------------------------------------------------ drawing
  draw(dt) {
    const t = this.time;
    const p = this.player;
    const px = p.x * U, pz = p.y * U;
    this.world.follow(px, pz, dt);
    this.world.lantern.position.set(px + 0.3 * p.face, 2.4, pz + 0.6);
    this.world.lantern.intensity = 14 + Math.sin(t * 9) * 1.5 + Math.sin(t * 23) * 1;

    // hero
    const step = p.moving ? Math.abs(Math.sin(t * 12)) : 0;
    const breathe = 1 + Math.sin(t * 3) * 0.03;
    const blink = this.iframes > 0 && Math.floor(this.iframes * 20) % 2;
    const hb = this.heroBatch;
    hb.begin();
    const hc = p.hurt > 0 ? [3, 0.6, 0.6] : [1, 1, 1];
    if (!blink) hb.push(px, pz, p.face * (1 - step * 0.06), breathe + step * 0.08, ...hc, p.moving ? Math.sin(t * 12) * 0.06 : 0, step * 0.12);
    hb.end();

    const sh = this.shadows;
    sh.begin();
    sh.push(px, pz, 0.9, 0.55);

    // enemies
    for (const b of Object.values(this.enemyBatches)) b.begin();
    for (const e of this.enemies) {
      const b = this.enemyBatches[e.def.sprite];
      const sc = e.boss ? 2.6 : 1;
      let y = 0, sx = sc, sy = sc;
      const w = t * 9 + e.phase;
      if (e.def.hop) { const h = Math.abs(Math.sin(w * 0.8)); y = h * 0.35; sy *= 0.9 + h * 0.2; sx *= 1.08 - h * 0.12; }
      else if (e.def.fly) { y = 0.5 + Math.sin(w * 0.6) * 0.15; sy *= 1 + Math.sin(w * 1.6) * 0.06; }
      else { y = Math.abs(Math.sin(w)) * 0.08; sy *= 1 + Math.sin(w * 2) * 0.04; }
      const fl = e.flash > 0 ? 4 : 1;
      const [r, g, bb] = e.boss ? [1.25 * fl, 0.85 * fl, 0.85 * fl] : [fl, fl, fl];
      b.push(e.x * U, e.y * U, sx * e.face, sy, r, g, bb, e.def.hop ? 0 : Math.sin(w) * 0.05, y);
      sh.push(e.x * U, e.y * U, 0.8 * sc, 0.5 * sc);
    }
    for (const b of Object.values(this.enemyBatches)) b.end();

    // gems and potions
    const gb = this.gemBatch;
    gb.begin();
    for (const g of this.gems) {
      const big = g.v >= 4;
      const c = big ? [1.6, 0.8, 1.8] : [1.2, 1.5, 1.7];
      gb.push(g.x * U, g.y * U, big ? 1.4 : 1, big ? 1.4 : 1, ...c, 0, 0.35 + Math.sin(t * 4 + g.ph) * 0.08);
    }
    gb.end();
    this.potionBatch.begin();
    for (const h of this.potions) { this.potionBatch.push(h.x * U, h.y * U, 1, 1, 1.3, 1.3, 1.3, 0, 0.1 + Math.abs(Math.sin(t * 3)) * 0.15); sh.push(h.x * U, h.y * U, 0.5, 0.3); }
    this.potionBatch.end();
    sh.end();

    // projectiles
    const bb = this.boltBatch;
    bb.begin();
    for (const b of this.bolts) bb.push(b.x * U, b.y * U, 1, 1, 1.0, 0.6, 1.6, t * 8, 0.7);
    bb.end();
    const bl = this.bladeBatch;
    bl.begin();
    if (this.state.weapons.blades && this.bladePos) for (const [x, y, a] of this.bladePos) bl.push(x * U, y * U, 1.3, 1.3, 1.4, 1.4, 1.6, a + Math.PI / 4 + t * 10, 0.6);
    bl.end();

    // aura
    const auraLv = this.state.weapons.aura;
    this.auraDisc.visible = this.auraRunes.visible = !!auraLv;
    if (auraLv) {
      const r = WEAPONS.aura.stats(auraLv).radius * U * 2;
      const pulse = 1 + Math.sin(t * 5) * 0.03;
      this.auraDisc.position.set(px, 0.03, pz); this.auraDisc.scale.setScalar(r * 1.25 * pulse);
      this.auraDisc.material.opacity = 0.35;
      this.auraRunes.position.set(px, 0.04, pz); this.auraRunes.scale.setScalar(r * 1.05); this.auraRunes.rotation.z = t * 0.6;
      this.auraRunes.material.opacity = 0.8;
    }
    // nova ring
    if (this.novaAnim >= 0) {
      this.novaAnim += dt * 2.5;
      const k = Math.min(1, this.novaAnim);
      this.novaRing.visible = true;
      this.novaRing.position.set(px, 0.05, pz);
      this.novaRing.scale.setScalar(this.novaRadius * U * 2.6 * (0.3 + k * 0.7));
      this.novaRing.material.opacity = 1 - k;
      if (this.novaAnim >= 1) { this.novaAnim = -1; this.novaRing.visible = false; }
    }
    // level up circle
    if (this.levelAnim >= 0) {
      this.levelAnim += dt * 1.2;
      const k = Math.min(1, this.levelAnim);
      this.levelRing.visible = true;
      this.levelRing.position.set(px, 0.05, pz);
      this.levelRing.scale.setScalar(2 + k * 4);
      this.levelRing.rotation.z = t * 2;
      this.levelRing.material.opacity = 1 - k;
      if (this.levelAnim >= 1) { this.levelAnim = -1; this.levelRing.visible = false; }
    }
  }
}
