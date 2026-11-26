import Phaser from 'phaser';
import { PLAYER, ENEMIES, WEAPONS, PASSIVES, RUN_LENGTH, BOSS_EVERY, MAX_ENEMIES, spawnPlan, xpForLevel } from '../data.js';

const CELL = 24; // spatial grid cell size for collision lookups

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.state = {
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, level: 1, xp: 0, xpNeed: xpForLevel(1),
      kills: 0, elapsed: 0, weapons: { bolt: 1 }, passives: {}, over: false,
    };
    this.pendingLevelUps = 0;
    this.choosing = false;
    this.spawnTimer = 0;
    this.nextBoss = BOSS_EVERY;
    this.iframes = 0;
    this.boltTimer = 0;
    this.auraTimer = 0;
    this.bladeAngle = 0;

    this.enemies = [];
    this.bolts = [];
    this.gems = [];
    this.hearts = [];
    this.blades = [];
    this.grid = new Map();

    this.ground = this.add.tileSprite(0, 0, 10, 10, 'ground').setOrigin(0).setDepth(-1e7);
    this.auraGfx = this.add.graphics().setDepth(-1e6);
    this.player = this.add.sprite(0, 0, 'hero').play('hero-walk');
    this.hpGfx = this.add.graphics().setDepth(2e6);

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 1, 1);
    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));

    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.registry.set('joy', { x: 0, y: 0 });

    this.scene.launch('UI');
    this.ui = this.scene.get('UI');
  }

  onResize() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setSize(w, h);
    // Show about 280 world pixels on the short side of the screen.
    this.cameras.main.setZoom(Math.max(1, Math.min(w, h) / 280));
  }

  // ---------------------------------------------------------------- main loop
  update(_, deltaMs) {
    if (this.state.over) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const s = this.state;
    s.elapsed += dt;
    if (s.elapsed >= RUN_LENGTH) return this.endRun(true);

    this.movePlayer(dt);
    this.spawn(dt);
    this.buildGrid();
    this.moveEnemies(dt);
    this.updateBolt(dt);
    this.updateBlades(dt);
    this.updateAura(dt);
    this.updatePickups(dt);
    this.drawWorldUi();

    if (this.pendingLevelUps > 0 && !this.choosing) this.openLevelUp();
  }

  // ---------------------------------------------------------------- player
  get speedMul() { return 1 + 0.1 * (this.state.passives.speed || 0); }
  get mightMul() { return 1 + 0.15 * (this.state.passives.might || 0); }
  get hasteMul() { return Math.pow(0.92, this.state.passives.haste || 0); }
  get magnet() { return PLAYER.magnet * (1 + 0.35 * (this.state.passives.magnet || 0)); }

  movePlayer(dt) {
    let x = 0, y = 0;
    const k = this.keys;
    if (k) {
      if (k.A.isDown || k.LEFT.isDown) x -= 1;
      if (k.D.isDown || k.RIGHT.isDown) x += 1;
      if (k.W.isDown || k.UP.isDown) y -= 1;
      if (k.S.isDown || k.DOWN.isDown) y += 1;
    }
    const joy = this.registry.get('joy');
    if (joy && (joy.x || joy.y)) { x = joy.x; y = joy.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const sp = PLAYER.speed * this.speedMul;
    this.player.x += x * sp * dt;
    this.player.y += y * sp * dt;
    this.player.setDepth(this.player.y);
    if (x) this.player.setFlipX(x < 0);
    if (len > 0.05) this.player.anims.resume(); else this.player.anims.pause(this.player.anims.currentAnim.frames[0]);
    if (this.iframes > 0) {
      this.iframes -= dt;
      this.player.setAlpha(Math.floor(this.iframes * 20) % 2 ? 0.4 : 1);
    } else this.player.setAlpha(1);

    const v = this.cameras.main.worldView;
    this.ground.setPosition(v.x - 32, v.y - 32).setSize(v.width + 64, v.height + 64);
    this.ground.setTilePosition(v.x - 32, v.y - 32);
  }

  hurtPlayer(dmg) {
    if (this.iframes > 0 || this.state.over) return;
    this.state.hp -= dmg;
    this.iframes = PLAYER.iframes;
    this.cameras.main.shake(80, 0.004);
    this.player.setTint(0xff6666);
    this.time.delayedCall(120, () => this.player.clearTint());
    if (this.state.hp <= 0) { this.state.hp = 0; this.endRun(false); }
  }

  endRun(won) {
    this.state.over = true;
    this.state.won = won;
    this.ui.showEnd(won);
  }

  // ---------------------------------------------------------------- enemies
  spawnPoint() {
    const v = this.cameras.main.worldView;
    const r = Math.hypot(v.width, v.height) / 2 + 16;
    const a = Math.random() * Math.PI * 2;
    return { x: this.player.x + Math.cos(a) * r, y: this.player.y + Math.sin(a) * r };
  }

  spawn(dt) {
    const s = this.state;
    const plan = spawnPlan(s.elapsed);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = plan.interval;
      for (let i = 0; i < plan.batch && this.enemies.length < MAX_ENEMIES; i++) {
        this.addEnemy(Phaser.Utils.Array.GetRandom(plan.pool), plan.hpMul);
      }
    }
    if (s.elapsed >= this.nextBoss) {
      this.nextBoss += BOSS_EVERY;
      this.addEnemy('brute', plan.hpMul, true);
      this.ui.banner('boss');
    }
  }

  addEnemy(kind, hpMul, boss = false) {
    const def = ENEMIES[kind];
    const p = this.spawnPoint();
    const e = this.add.sprite(p.x, p.y, def.tex).play({ key: `${def.tex}-walk`, startFrame: Phaser.Math.Between(0, 1) });
    e.def = def;
    e.boss = boss;
    e.maxHp = e.hp = def.hp * hpMul * (boss ? 12 : 1);
    e.speed = def.speed * (boss ? 1.1 : Phaser.Math.FloatBetween(0.9, 1.1));
    e.radius = def.radius * (boss ? 2.5 : 1);
    e.dmg = def.dmg * (boss ? 2 : 1);
    e.kx = 0; e.ky = 0; e.bladeHit = 0;
    if (boss) e.setScale(2.5).setTint(0xffb0b0);
    this.enemies.push(e);
  }

  buildGrid() {
    this.grid.clear();
    for (const e of this.enemies) {
      const key = ((Math.floor(e.x / CELL) & 0xffff) << 16) | (Math.floor(e.y / CELL) & 0xffff);
      let c = this.grid.get(key);
      if (!c) this.grid.set(key, (c = []));
      c.push(e);
    }
  }

  // Calls fn(enemy) for enemies in cells overlapping the circle (x, y, r).
  queryCircle(x, y, r, fn) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const c = this.grid.get(((cx & 0xffff) << 16) | (cy & 0xffff));
      if (c) for (const e of c) if (e.active && fn(e) === false) return;
    }
  }

  moveEnemies(dt) {
    const px = this.player.x, py = this.player.y;
    const v = this.cameras.main.worldView;
    const far = Math.hypot(v.width, v.height) * 0.9;
    for (const e of this.enemies) {
      let dx = px - e.x, dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > far) { const p = this.spawnPoint(); e.setPosition(p.x, p.y); continue; }
      let vx = (dx / d) * e.speed, vy = (dy / d) * e.speed;
      // separation so the horde spreads out instead of stacking
      this.queryCircle(e.x, e.y, e.radius * 2, (o) => {
        if (o === e) return;
        const ox = e.x - o.x, oy = e.y - o.y;
        const od = Math.hypot(ox, oy);
        const min = e.radius + o.radius;
        if (od > 0 && od < min) { const push = ((min - od) / min) * 60; vx += (ox / od) * push; vy += (oy / od) * push; }
      });
      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      e.kx *= 0.85; e.ky *= 0.85;
      e.setFlipX(dx < 0);
      e.setDepth(e.y);
      if (d < e.radius + 5) this.hurtPlayer(e.dmg);
    }
  }

  damage(e, amount, fromX, fromY) {
    if (!e.active) return;
    const dmg = Math.round(amount * this.mightMul);
    e.hp -= dmg;
    const dx = e.x - fromX, dy = e.y - fromY, d = Math.hypot(dx, dy) || 1;
    const kb = e.boss ? 20 : 90;
    e.kx += (dx / d) * kb; e.ky += (dy / d) * kb;
    e.setTintFill(0xffffff);
    this.time.delayedCall(60, () => { if (e.active) { e.clearTint(); if (e.boss) e.setTint(0xffb0b0); } });
    this.ui.damageNumber(e.x, e.y - 8, dmg);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.active = false;
    this.state.kills++;
    const gems = e.boss ? 12 : 1;
    for (let i = 0; i < gems; i++) {
      this.dropGem(e.x + (e.boss ? Phaser.Math.Between(-20, 20) : 0), e.y + (e.boss ? Phaser.Math.Between(-20, 20) : 0), e.boss ? 5 : e.def.xp);
    }
    if (Math.random() < (e.boss ? 1 : 0.012)) this.hearts.push(this.add.image(e.x, e.y, 'heart').setDepth(-1e5));
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.tweens.add({ targets: e, alpha: 0, scale: e.scale * 1.4, duration: 150, onComplete: () => e.destroy() });
  }

  // ---------------------------------------------------------------- weapons
  nearestEnemies(n, range) {
    const px = this.player.x, py = this.player.y, r2 = range * range;
    const list = [];
    for (const e of this.enemies) {
      const d2 = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d2 < r2) list.push([d2, e]);
    }
    list.sort((a, b) => a[0] - b[0]);
    return list.slice(0, n).map((x) => x[1]);
  }

  updateBolt(dt) {
    const lv = this.state.weapons.bolt;
    if (lv) {
      const st = WEAPONS.bolt.stats(lv);
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        const targets = this.nearestEnemies(st.count, 200);
        if (targets.length) {
          this.boltTimer = st.cooldown * this.hasteMul;
          for (let i = 0; i < st.count; i++) {
            const tgt = targets[i % targets.length];
            const a = Math.atan2(tgt.y - this.player.y, tgt.x - this.player.x) + (i >= targets.length ? (i - targets.length + 1) * 0.25 : 0);
            const b = this.add.image(this.player.x, this.player.y, 'bolt').setDepth(1e6);
            b.vx = Math.cos(a) * st.speed; b.vy = Math.sin(a) * st.speed;
            b.life = 1.4; b.pierce = st.pierce; b.dmg = st.dmg; b.hit = new Set();
            this.bolts.push(b);
          }
        }
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.rotation += dt * 10;
      this.queryCircle(b.x, b.y, 12, (e) => {
        if (b.hit.has(e)) return;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.radius + 3) ** 2) {
          b.hit.add(e);
          this.damage(e, b.dmg, b.x - b.vx, b.y - b.vy);
          if (--b.pierce <= 0) { b.life = 0; return false; }
        }
      });
      if (b.life <= 0) { b.destroy(); this.bolts.splice(i, 1); }
    }
  }

  updateBlades(dt) {
    const lv = this.state.weapons.blades;
    if (!lv) return;
    const st = WEAPONS.blades.stats(lv);
    while (this.blades.length < st.count) this.blades.push(this.add.image(0, 0, 'blade').setDepth(1e6));
    this.bladeAngle += st.spin * dt;
    const now = this.state.elapsed;
    this.blades.forEach((bl, i) => {
      const a = this.bladeAngle + (i / st.count) * Math.PI * 2;
      bl.setPosition(this.player.x + Math.cos(a) * st.radius, this.player.y + Math.sin(a) * st.radius);
      bl.rotation = a + Math.PI * 0.75;
      this.queryCircle(bl.x, bl.y, 14, (e) => {
        if (now < e.bladeHit) return;
        if ((e.x - bl.x) ** 2 + (e.y - bl.y) ** 2 < (e.radius + 6) ** 2) {
          e.bladeHit = now + st.hitCd;
          this.damage(e, st.dmg, this.player.x, this.player.y);
        }
      });
    });
  }

  updateAura(dt) {
    const lv = this.state.weapons.aura;
    this.auraGfx.clear();
    if (!lv) return;
    const st = WEAPONS.aura.stats(lv);
    const pulse = 0.12 + 0.05 * Math.sin(this.state.elapsed * 6);
    this.auraGfx.fillStyle(0xffd75e, pulse).fillCircle(this.player.x, this.player.y, st.radius);
    this.auraGfx.lineStyle(1, 0xffd75e, 0.5).strokeCircle(this.player.x, this.player.y, st.radius);
    this.auraTimer -= dt;
    if (this.auraTimer <= 0) {
      this.auraTimer = st.tick * this.hasteMul;
      const r2 = st.radius * st.radius;
      for (const e of [...this.enemies]) {
        if ((e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2 < r2) this.damage(e, st.dmg, this.player.x, this.player.y);
      }
    }
  }

  // ---------------------------------------------------------------- pickups
  dropGem(x, y, value) {
    const g = this.add.image(x, y, 'gem').setDepth(-1e5);
    g.value = value;
    g.homing = false;
    if (value >= 4) g.setTint(0xff9cf0).setScale(1.3);
    this.gems.push(g);
  }

  updatePickups(dt) {
    const px = this.player.x, py = this.player.y;
    const m2 = this.magnet ** 2;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = px - g.x, dy = py - g.y, d2 = dx * dx + dy * dy;
      if (!g.homing && d2 < m2) { g.homing = true; g.sp = 40; }
      if (g.homing) {
        g.sp += 400 * dt;
        const d = Math.sqrt(d2) || 1;
        g.x += (dx / d) * g.sp * dt; g.y += (dy / d) * g.sp * dt;
        if (d < 6) { this.gainXp(g.value); g.destroy(); this.gems.splice(i, 1); }
      }
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      if ((px - h.x) ** 2 + (py - h.y) ** 2 < 100) {
        this.heal(30); h.destroy(); this.hearts.splice(i, 1);
      }
    }
  }

  heal(n) { this.state.hp = Math.min(this.state.maxHp, this.state.hp + n); }

  gainXp(n) {
    const s = this.state;
    s.xp += n;
    while (s.xp >= s.xpNeed) {
      s.xp -= s.xpNeed;
      s.level++;
      s.xpNeed = xpForLevel(s.level);
      this.pendingLevelUps++;
    }
  }

  // ---------------------------------------------------------------- level up
  buildOptions() {
    const s = this.state;
    const opts = [];
    for (const [k, w] of Object.entries(WEAPONS)) {
      const lv = s.weapons[k] || 0;
      if (lv < w.max) opts.push({ kind: 'weapon', key: k, next: lv + 1 });
    }
    for (const [k, p] of Object.entries(PASSIVES)) {
      const lv = s.passives[k] || 0;
      if (lv < p.max) opts.push({ kind: 'passive', key: k, next: lv + 1 });
    }
    Phaser.Utils.Array.Shuffle(opts);
    const pick = opts.slice(0, 3);
    if (!pick.length) pick.push({ kind: 'heal', key: 'heal', next: 0 });
    return pick;
  }

  openLevelUp() {
    this.choosing = true;
    this.registry.set('joy', { x: 0, y: 0 });
    this.scene.pause();
    this.ui.showLevelUp(this.buildOptions());
  }

  // Called by the UI scene when the player taps a card.
  choose(opt) {
    const s = this.state;
    if (opt.kind === 'weapon') s.weapons[opt.key] = opt.next;
    else if (opt.kind === 'passive') {
      s.passives[opt.key] = opt.next;
      if (opt.key === 'vigor') { s.maxHp += 20; this.heal(20); }
    } else this.heal(30);
    this.pendingLevelUps--;
    this.choosing = false;
    this.scene.resume();
  }

  // ---------------------------------------------------------------- drawing
  drawWorldUi() {
    const g = this.hpGfx.clear();
    const s = this.state;
    const x = this.player.x - 9, y = this.player.y + 10;
    g.fillStyle(0x000000, 0.6).fillRect(x, y, 18, 3);
    g.fillStyle(0xff4a5a, 1).fillRect(x, y, 18 * (s.hp / s.maxHp), 3);
    for (const e of this.enemies) {
      if (!e.boss) continue;
      const w = 40;
      g.fillStyle(0x000000, 0.6).fillRect(e.x - w / 2, e.y - 26, w, 3);
      g.fillStyle(0xffb000, 1).fillRect(e.x - w / 2, e.y - 26, w * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
}
