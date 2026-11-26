import Phaser from 'phaser';

// Sprite files live in public/assets. To swap art, replace the PNG with one of the same layout:
// 16x16 frames laid out horizontally for hero/slime/bat/brute.
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const k of ['hero', 'slime', 'bat', 'brute']) {
      this.load.spritesheet(k, `assets/${k}.png`, { frameWidth: 16, frameHeight: 16 });
    }
    for (const k of ['gem', 'bolt', 'blade', 'heart', 'ground']) this.load.image(k, `assets/${k}.png`);
  }

  create() {
    for (const k of ['hero', 'slime', 'bat', 'brute']) {
      this.anims.create({
        key: `${k}-walk`,
        frames: this.anims.generateFrameNumbers(k, { start: 0, end: 1 }),
        frameRate: k === 'bat' ? 8 : 5,
        repeat: -1,
      });
    }
    this.makeIcons();
    this.scene.start('Menu');
  }

  // Small generated icons for upgrades that have no sprite of their own.
  makeIcons() {
    const g = this.add.graphics();
    g.lineStyle(2, 0xffd75e, 1).strokeCircle(8, 8, 6);
    g.fillStyle(0xffd75e, 0.35).fillCircle(8, 8, 6);
    g.generateTexture('ic_aura', 16, 16).clear();

    g.fillStyle(0x9fe0ff, 1);
    g.fillTriangle(2, 3, 8, 8, 2, 13);
    g.fillTriangle(8, 3, 14, 8, 8, 13);
    g.generateTexture('ic_speed', 16, 16).clear();

    g.lineStyle(2, 0x9fe0ff, 1).strokeCircle(8, 8, 6);
    g.lineBetween(8, 8, 8, 4).lineBetween(8, 8, 11, 9);
    g.generateTexture('ic_haste', 16, 16).destroy();
  }
}
