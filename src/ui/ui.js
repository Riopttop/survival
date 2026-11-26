import * as THREE from 'three';
import { t, isTouch } from '../i18n.js';
import { urls } from '../engine/assets.js';

const ICONS = {
  bolt: ['fx', 'magic_05'], blades: ['sprites', 'sword'], aura: ['fx', 'magic_02'], nova: ['fx', 'star_06'],
  speed: ['fx', 'twirl_02'], vigor: ['sprites', 'potion'], magnet: ['misc', 'gem'], might: ['sprites', 'axe'],
  haste: ['sprites', 'dagger'], heal: ['sprites', 'potion'],
};
const icon = (k) => {
  const [group, name] = ICONS[k];
  return `<img class="${group === 'fx' ? 'soft' : ''}" src="${urls[group][name]}" alt="">`;
};
const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const _v = new THREE.Vector3();

export class UI {
  constructor(root, camera) {
    this.root = root;
    this.camera = camera;
    this.modal = null;
    this.joyVec = { x: 0, y: 0 };
    this.keys = new Set();

    root.innerHTML = `
      <div id="hud" class="layer hidden">
        <div class="xpbar"><i></i><b></b></div>
        <div class="hudrow">
          <div><div class="lv panel"></div><div class="loadout"></div></div>
          <div class="timer">00:00</div>
          <div class="right"><div class="kills panel"><img src="${urls.sprites.demon}" alt=""><span>0</span></div>
            <button class="pausebtn panel" aria-label="${t('pause')}">II</button></div>
        </div>
      </div>
      <div class="bossbar hidden"><div class="name">${t('bossName')}</div><div class="bar"><i></i></div></div>
      <div class="hpbar hidden"><i></i></div>
      <div id="fx" class="layer"></div>
      <div id="joy" class="hidden"><i></i></div>
      <div id="menu" class="layer modal">
        <div class="logo">${t('title')}</div>
        <div class="logo-sub">${t('subtitle')}</div>
        <div class="menu-spacer"></div>
        <div class="loading">${t('loading')}…</div>
        <button class="btn hidden" id="startbtn">${t('start')}</button>
        <div class="hint">${isTouch() ? t('howto_touch') : t('howto_pc')}</div>
      </div>`;
    this.el = {
      hud: root.querySelector('#hud'), xp: root.querySelector('.xpbar i'), xpText: root.querySelector('.xpbar b'),
      lv: root.querySelector('.lv'), timer: root.querySelector('.timer'), kills: root.querySelector('.kills span'),
      loadout: root.querySelector('.loadout'), boss: root.querySelector('.bossbar'), bossFill: root.querySelector('.bossbar i'),
      hp: root.querySelector('.hpbar'), hpFill: root.querySelector('.hpbar i'), fx: root.querySelector('#fx'),
      joy: root.querySelector('#joy'), joyKnob: root.querySelector('#joy i'), menu: root.querySelector('#menu'),
      start: root.querySelector('#startbtn'), loading: root.querySelector('.loading'),
    };
    this.el.hud.querySelector('.pausebtn').addEventListener('click', () => this.onPause?.());
    this.bindInput();
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (this.modal?.onKey) this.modal.onKey(e);
      else if ((e.code === 'Escape' || e.code === 'KeyP') && this.playing) this.onPause?.();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); if (this.playing && !this.modal) this.onPause?.(); });

    const view = document.getElementById('view');
    let id = null, bx = 0, by = 0;
    const R = 50;
    view.addEventListener('pointerdown', (e) => {
      if (id !== null || this.modal || !this.playing) return;
      id = e.pointerId; bx = e.clientX; by = e.clientY;
      view.setPointerCapture(id);
      this.el.joy.classList.remove('hidden');
      this.el.joy.style.left = `${bx}px`; this.el.joy.style.top = `${by}px`;
      this.el.joyKnob.style.transform = '';
    });
    view.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - bx, dy = e.clientY - by;
      const d = Math.hypot(dx, dy);
      if (d > R) { bx = e.clientX - (dx / d) * R; by = e.clientY - (dy / d) * R; dx = e.clientX - bx; dy = e.clientY - by; }
      this.el.joy.style.left = `${bx}px`; this.el.joy.style.top = `${by}px`;
      this.el.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.min(d, R) / R;
      this.joyVec = d < 6 ? { x: 0, y: 0 } : { x: (dx / d) * m, y: (dy / d) * m };
    });
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null; this.joyVec = { x: 0, y: 0 };
      this.el.joy.classList.add('hidden');
    };
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    this.releaseJoy = () => { id = null; this.joyVec = { x: 0, y: 0 }; this.el.joy.classList.add('hidden'); };
  }

  moveInput() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (this.joyVec.x || this.joyVec.y) return this.joyVec;
    return { x, y };
  }

  // ---------------------------------------------------------------- menu
  ready(onStart) {
    this.el.loading.classList.add('hidden');
    this.el.start.classList.remove('hidden');
    const go = () => { this.closeModal(); this.el.menu.classList.add('hidden'); onStart(); };
    this.el.start.addEventListener('click', go, { once: true });
    this.modal = { el: null, onKey: (e) => { if (e.code === 'Enter' || e.code === 'Space') go(); } };
  }

  setPlaying(p) {
    this.playing = p;
    this.el.hud.classList.toggle('hidden', !p);
    this.el.hp.classList.toggle('hidden', !p);
    if (!p) this.releaseJoy();
  }

  // ---------------------------------------------------------------- per frame
  project(x, z, y = 0) {
    _v.set(x, y, z).project(this.camera);
    return [(_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight];
  }

  update(game) {
    if (!this.playing) return;
    const s = game.state;
    this.el.xp.style.width = `${(s.xp / s.xpNeed) * 100}%`;
    this.el.xpText.textContent = `${s.xp} / ${s.xpNeed}`;
    this.el.lv.textContent = `${t('lv')} ${s.level}`;
    this.el.timer.textContent = fmt(s.elapsed);
    this.el.kills.textContent = s.kills;
    const sig = JSON.stringify([s.weapons, s.passives]);
    if (sig !== this.loadoutSig) {
      this.loadoutSig = sig;
      this.el.loadout.innerHTML = [...Object.entries(s.weapons), ...Object.entries(s.passives)]
        .map(([k, lv]) => `<div class="slot">${icon(k)}<span>${lv}</span></div>`).join('');
    }
    const [hx, hy] = this.project(game.player.x / 16, game.player.y / 16, -0.15);
    this.el.hp.style.left = `${hx}px`; this.el.hp.style.top = `${hy + 6}px`;
    this.el.hpFill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    if (this.boss) {
      if (!this.boss.alive) this.bossBar(null);
      else this.el.bossFill.style.width = `${Math.max(0, this.boss.hp / this.boss.maxHp) * 100}%`;
    }
  }

  bossBar(e) {
    this.boss = e;
    this.el.boss.classList.toggle('hidden', !e);
  }

  banner(key) {
    const b = h(`<div class="banner">${t(key)}</div>`);
    this.el.fx.appendChild(b);
    setTimeout(() => b.remove(), 2500);
  }

  damage(x, z, y, n) {
    if (this.el.fx.childElementCount > 70) return;
    const [sx, sy] = this.project(x, z, y);
    const d = h(`<div class="dmg${n >= 30 ? ' big' : ''}">${n}</div>`);
    d.style.left = `${sx + (Math.random() - 0.5) * 16}px`; d.style.top = `${sy}px`;
    this.el.fx.appendChild(d);
    setTimeout(() => d.remove(), 620);
  }

  // ---------------------------------------------------------------- modals
  closeModal() {
    if (this.modal?.el) this.modal.el.remove();
    this.modal = null;
  }

  showLevelUp(options, choose) {
    this.closeModal();
    this.releaseJoy();
    const el = h(`<div class="layer modal"><h1>${t('levelUp')}</h1><div class="sub">${t('pick')}</div><div class="cards"></div></div>`);
    const cards = el.querySelector('.cards');
    const done = (opt) => { this.closeModal(); choose(opt); };
    options.forEach((opt, i) => {
      const isNew = opt.kind !== 'heal' && opt.next === 1;
      const tag = opt.kind === 'heal' ? '' : isNew ? `<div class="tag new">${t('new')}</div>` : `<div class="tag">${t('lv')} ${opt.next}</div>`;
      const pips = opt.max ? `<div class="pips">${Array.from({ length: opt.max }, (_, k) => `<i class="${k < opt.next ? 'on' : ''}"></i>`).join('')}</div>` : '';
      const c = h(`<button class="card"><div class="icon">${icon(opt.key)}</div><div class="body"><div class="name">${t(opt.key)}</div>${tag}${pips}<div class="desc">${t(`${opt.key}_d`)}</div></div><div class="key">${i + 1}</div></button>`);
      c.addEventListener('click', () => done(opt));
      cards.appendChild(c);
    });
    this.root.appendChild(el);
    this.modal = { el, onKey: (e) => { const n = Number(e.key) - 1; if (options[n]) done(options[n]); } };
  }

  showPause(onResume) {
    this.closeModal();
    this.releaseJoy();
    const el = h(`<div class="layer modal"><h1>${t('pause')}</h1><button class="btn">${t('resume')}</button></div>`);
    const go = () => { this.closeModal(); onResume(); };
    el.querySelector('button').addEventListener('click', go);
    this.root.appendChild(el);
    this.modal = { el, onKey: (e) => { if (['Escape', 'KeyP', 'Enter', 'Space'].includes(e.code)) go(); } };
  }

  showEnd(won, s, onRetry = this.onRetry) {
    this.closeModal();
    this.releaseJoy();
    this.bossBar(null);
    const el = h(`<div class="layer modal">
      <h1 style="${won ? '' : 'color:#ff8a8a;text-shadow:0 4px 0 #5a1420'}">${won ? t('victory') : t('gameOver')}</h1>
      <div class="stats panel">${t('survived')} <b>${fmt(s.elapsed)}</b><br>${t('kills')} <b>${s.kills}</b><br>${t('level')} <b>${s.level}</b></div>
      <button class="btn">${t('retry')}</button></div>`);
    const go = () => { this.closeModal(); onRetry(); };
    el.querySelector('button').addEventListener('click', go);
    this.root.appendChild(el);
    let armed = false; setTimeout(() => { armed = true; }, 700);
    this.modal = { el, onKey: (e) => { if (armed && (e.code === 'Enter' || e.code === 'Space')) go(); } };
  }
}
