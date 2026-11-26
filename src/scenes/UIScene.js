import Phaser from 'phaser';
import { t } from '../i18n.js';
import { WEAPONS, PASSIVES } from '../data.js';

const FONT = { fontFamily: 'system-ui, sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 4 };
const ICONS = {
  bolt: ['bolt'], blades: ['blade'], aura: ['ic_aura'], speed: ['ic_speed'], vigor: ['heart'],
  magnet: ['gem'], might: ['blade', 0xff7070], haste: ['ic_haste'], heal: ['heart'],
};
const JOY_R = 56;

export default class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    this.gs = this.scene.get('Game');
    this.modal = null;
    this.hud = this.add.graphics();
    this.lvText = this.add.text(8, 14, '', { ...FONT, fontSize: '16px' });
    this.timeText = this.add.text(0, 14, '', { ...FONT, fontSize: '22px', fontStyle: 'bold' }).setOrigin(0.5, 0);
    this.killText = this.add.text(0, 14, '', { ...FONT, fontSize: '16px' }).setOrigin(1, 0);
    this.joyGfx = this.add.graphics();
    this.dmgPool = [];

    this.joy = null; // { id, bx, by, x, y }
    this.input.on('pointerdown', (p) => {
      if (this.modal || this.joy) return;
      this.joy = { id: p.id, bx: p.x, by: p.y, x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p) => {
      if (!this.joy || p.id !== this.joy.id) return;
      this.joy.x = p.x; this.joy.y = p.y;
      const dx = p.x - this.joy.bx, dy = p.y - this.joy.by, d = Math.hypot(dx, dy);
      // let the base follow the finger when dragged past the edge
      if (d > JOY_R) { this.joy.bx = p.x - (dx / d) * JOY_R; this.joy.by = p.y - (dy / d) * JOY_R; }
      const m = Math.min(d, JOY_R) / JOY_R;
      this.registry.set('joy', d < 6 ? { x: 0, y: 0 } : { x: (dx / d) * m, y: (dy / d) * m });
    });
    const release = (p) => {
      if (!this.joy || p.id !== this.joy.id) return;
      this.joy = null;
      this.registry.set('joy', { x: 0, y: 0 });
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  update() {
    const s = this.gs.state;
    const { width: w } = this.scale;
    const g = this.hud.clear();
    g.fillStyle(0x000000, 0.6).fillRect(0, 0, w, 10);
    g.fillStyle(0x4ad9ff, 1).fillRect(0, 0, w * (s.xp / s.xpNeed), 10);
    this.lvText.setText(`${t('lv')} ${s.level}`);
    const sec = Math.floor(s.elapsed);
    this.timeText.setText(`${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`).setX(w / 2);
    this.killText.setText(`☠ ${s.kills}`).setX(w - 8);

    const j = this.joyGfx.clear();
    if (this.joy) {
      j.fillStyle(0xffffff, 0.12).fillCircle(this.joy.bx, this.joy.by, JOY_R);
      j.lineStyle(2, 0xffffff, 0.35).strokeCircle(this.joy.bx, this.joy.by, JOY_R);
      const dx = this.joy.x - this.joy.bx, dy = this.joy.y - this.joy.by, d = Math.hypot(dx, dy);
      const m = Math.min(d, JOY_R) / (d || 1);
      j.fillStyle(0xffffff, 0.5).fillCircle(this.joy.bx + dx * m, this.joy.by + dy * m, 22);
    }
  }

  worldToScreen(x, y) {
    const cam = this.gs.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  damageNumber(wx, wy, n) {
    if (this.dmgPool.length > 60) return;
    const p = this.worldToScreen(wx, wy);
    const txt = this.add.text(p.x, p.y, String(n), { ...FONT, fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5);
    this.dmgPool.push(txt);
    this.tweens.add({
      targets: txt, y: p.y - 24, alpha: 0, duration: 500, ease: 'Cubic.Out',
      onComplete: () => { txt.destroy(); this.dmgPool.splice(this.dmgPool.indexOf(txt), 1); },
    });
  }

  banner(key) {
    const { width: w, height: h } = this.scale;
    const txt = this.add.text(w / 2, h * 0.3, t(key), { ...FONT, fontSize: '26px', color: '#ffb0b0', strokeThickness: 6 }).setOrigin(0.5);
    this.tweens.add({ targets: txt, alpha: 0, delay: 1600, duration: 600, onComplete: () => txt.destroy() });
  }

  icon(key, x, y, size) {
    const [tex, tint] = ICONS[key];
    const img = this.add.image(x, y, tex);
    img.setScale(size / Math.max(img.width, img.height));
    if (tint) img.setTint(tint);
    return img;
  }

  // ---------------------------------------------------------------- level up cards
  showLevelUp(options) {
    this.closeModal();
    this.joy = null;
    const { width: w, height: h } = this.scale;
    const c = this.add.container(0, 0);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, w, h, 0x000000, 0.65).setOrigin(0).setInteractive());
    const portrait = h > w;
    const cw = portrait ? Math.min(w - 32, 420) : Math.min(260, (w - 64) / 3);
    const ch = portrait ? 96 : 220;
    const gap = 14;
    const totalW = portrait ? cw : options.length * cw + (options.length - 1) * gap;
    const totalH = portrait ? options.length * ch + (options.length - 1) * gap : ch;
    const top = Math.max(90, (h - totalH) / 2 + 30);
    c.add(this.add.text(w / 2, top - 70, t('levelUp'), { ...FONT, fontSize: '32px', fontStyle: 'bold', color: '#ffd75e', strokeThickness: 6 }).setOrigin(0.5));
    c.add(this.add.text(w / 2, top - 32, t('pick'), { ...FONT, fontSize: '16px' }).setOrigin(0.5));

    options.forEach((opt, i) => {
      const x = portrait ? (w - cw) / 2 : (w - totalW) / 2 + i * (cw + gap);
      const y = portrait ? top + i * (ch + gap) : top;
      const card = this.add.rectangle(x, y, cw, ch, 0x22304a, 1).setOrigin(0).setStrokeStyle(3, 0x6a8ad0).setInteractive({ useHandCursor: true });
      c.add(card);
      const isNew = opt.kind !== 'heal' && opt.next === 1;
      const max = opt.kind === 'weapon' ? WEAPONS[opt.key].max : opt.kind === 'passive' ? PASSIVES[opt.key].max : 0;
      const lvLabel = opt.kind === 'heal' ? '' : isNew ? t('new') : `${t('lv')} ${opt.next}/${max}`;
      if (portrait) {
        c.add(this.icon(opt.key, x + 44, y + ch / 2, 48));
        c.add(this.add.text(x + 84, y + 14, t(opt.key), { ...FONT, fontSize: '20px', fontStyle: 'bold' }));
        c.add(this.add.text(x + cw - 12, y + 16, lvLabel, { ...FONT, fontSize: '14px', color: isNew ? '#ffd75e' : '#9fe0ff' }).setOrigin(1, 0));
        c.add(this.add.text(x + 84, y + 46, t(`${opt.key}_d`), { ...FONT, fontSize: '14px', strokeThickness: 3, wordWrap: { width: cw - 96 } }));
      } else {
        c.add(this.icon(opt.key, x + cw / 2, y + 56, 56));
        c.add(this.add.text(x + cw / 2, y + 104, t(opt.key), { ...FONT, fontSize: '20px', fontStyle: 'bold' }).setOrigin(0.5, 0));
        c.add(this.add.text(x + cw / 2, y + 132, lvLabel, { ...FONT, fontSize: '14px', color: isNew ? '#ffd75e' : '#9fe0ff' }).setOrigin(0.5, 0));
        c.add(this.add.text(x + cw / 2, y + 156, t(`${opt.key}_d`), { ...FONT, fontSize: '14px', strokeThickness: 3, align: 'center', wordWrap: { width: cw - 20 } }).setOrigin(0.5, 0));
      }
      card.on('pointerover', () => card.setFillStyle(0x30446a));
      card.on('pointerout', () => card.setFillStyle(0x22304a));
      card.on('pointerup', () => { this.closeModal(); this.gs.choose(opt); });
    });
    // keyboard shortcut: 1/2/3
    this.input.keyboard?.once('keydown', (ev) => {
      const n = Number(ev.key) - 1;
      if (this.modal === c && options[n]) { this.closeModal(); this.gs.choose(options[n]); }
    });
  }

  closeModal() {
    if (this.modal) { this.modal.destroy(); this.modal = null; }
  }

  // ---------------------------------------------------------------- end screen
  showEnd(won) {
    this.closeModal();
    this.joy = null;
    this.registry.set('joy', { x: 0, y: 0 });
    const s = this.gs.state;
    const { width: w, height: h } = this.scale;
    const c = this.add.container(0, 0);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, w, h, 0x000000, 0.75).setOrigin(0).setInteractive());
    c.add(this.add.text(w / 2, h * 0.28, won ? t('victory') : t('gameOver'), { ...FONT, fontSize: '36px', fontStyle: 'bold', color: won ? '#ffd75e' : '#ff8080', strokeThickness: 6 }).setOrigin(0.5));
    const sec = Math.floor(s.elapsed);
    const lines = [
      `${t('survived')}: ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`,
      `${t('kills')}: ${s.kills}`,
      `${t('level')}: ${s.level}`,
    ];
    c.add(this.add.text(w / 2, h * 0.42, lines.join('\n'), { ...FONT, fontSize: '20px', align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0));
    const bw = 200, bh = 54, bx = w / 2 - bw / 2, by = h * 0.68;
    const btn = this.add.rectangle(bx, by, bw, bh, 0x3d6ee0).setOrigin(0).setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true });
    c.add(btn);
    c.add(this.add.text(w / 2, by + bh / 2, t('retry'), { ...FONT, fontSize: '20px', fontStyle: 'bold' }).setOrigin(0.5));
    const restart = () => { this.scene.stop('UI'); this.scene.start('Game'); };
    btn.on('pointerup', restart);
    this.time.delayedCall(600, () => this.input.keyboard?.once('keydown-ENTER', restart));
  }
}
