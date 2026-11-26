import Phaser from 'phaser';
import { t, isTouch } from '../i18n.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.bg = this.add.tileSprite(0, 0, 10, 10, 'ground').setOrigin(0).setTileScale(3);
    this.hero = this.add.sprite(0, 0, 'hero').setScale(6).play('hero-walk');
    this.mobs = ['slime', 'bat', 'slime', 'brute'].map((k) => this.add.sprite(0, 0, k).setScale(4).play(`${k}-walk`));
    const font = { fontFamily: 'system-ui, sans-serif', color: '#fff', stroke: '#000', strokeThickness: 6 };
    this.title = this.add.text(0, 0, t('title'), { ...font, fontSize: '56px', fontStyle: 'bold', color: '#ffd75e' }).setOrigin(0.5);
    this.sub = this.add.text(0, 0, t('subtitle'), { ...font, fontSize: '22px' }).setOrigin(0.5);
    this.start = this.add.text(0, 0, t('tapToStart'), { ...font, fontSize: '20px' }).setOrigin(0.5);
    this.howto = this.add.text(0, 0, isTouch() ? t('howto_touch') : t('howto_pc'), { ...font, fontSize: '15px', color: '#cfe' }).setOrigin(0.5);
    this.tweens.add({ targets: this.start, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    const go = () => this.scene.start('Game');
    this.input.once('pointerdown', go);
    this.input.keyboard?.once('keydown', go);
  }

  layout() {
    const { width: w, height: h } = this.scale;
    this.bg.setSize(w, h);
    const s = Math.min(1, w / 520);
    this.title.setPosition(w / 2, h * 0.22).setScale(s);
    this.sub.setPosition(w / 2, h * 0.22 + 50 * s).setScale(s);
    this.hero.setPosition(w / 2, h * 0.5);
    this.mobs.forEach((m, i) => m.setPosition(w / 2 + (i - 1.5) * Math.min(90, w / 5), h * 0.5 + 90).setFlipX(i < 2));
    this.start.setPosition(w / 2, h * 0.74).setScale(s);
    this.howto.setPosition(w / 2, h * 0.74 + 36).setScale(s);
  }

  update(_, dt) { this.bg.tilePositionY -= dt * 0.01; }
}
