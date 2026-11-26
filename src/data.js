// All balance numbers live here so they are easy to tweak. Distances are in game pixels (16 px = 1 world unit).

export const PLAYER = {
  sprite: 'wizard', // PLACEHOLDER: replace with the SpriteCook hero
  maxHp: 100,
  speed: 72,
  magnet: 40,
  iframes: 0.45,
  radius: 5,
};

// tint: particle color when they die. ghost: walks through trees.
export const ENEMIES = {
  slime: { sprite: 'slime', hp: 10, speed: 30, dmg: 8, xp: 1, radius: 6, tint: [0.4, 1, 0.6], hop: true },
  bat: { sprite: 'bat', hp: 6, speed: 60, dmg: 6, xp: 1, radius: 5, tint: [1, 0.6, 0.3], fly: true, ghost: true },
  spider: { sprite: 'spider', hp: 12, speed: 52, dmg: 8, xp: 2, radius: 6, tint: [1, 0.4, 0.3] },
  ghost: { sprite: 'ghost', hp: 18, speed: 36, dmg: 10, xp: 2, radius: 6, tint: [0.7, 0.8, 1], fly: true, ghost: true },
  orc: { sprite: 'orc', hp: 40, speed: 27, dmg: 14, xp: 4, radius: 7, tint: [0.6, 1, 0.4] },
  cyclops: { sprite: 'cyclops', hp: 70, speed: 25, dmg: 18, xp: 6, radius: 8, tint: [1, 0.8, 0.5] },
  demon: { sprite: 'demon', hp: 60, speed: 34, dmg: 20, xp: 6, radius: 7, tint: [1, 0.3, 0.2] },
};

export const RUN_LENGTH = 600; // seconds to survive for a win (10 min)
export const BOSS_EVERY = 150;
export const BOSSES = ['cyclops', 'demon', 'orc', 'demon'];
export const MAX_ENEMIES = 350;

// Spawn rules by elapsed time (seconds).
export function spawnPlan(t) {
  const interval = Math.max(0.12, 1.0 - t / 250);
  const batch = 1 + Math.floor(t / 70);
  const hpMul = 1 + t / 140;
  const pool = ['slime', 'slime'];
  if (t > 30) pool.push('bat', 'bat');
  if (t > 75) pool.push('spider');
  if (t > 120) pool.push('ghost', 'orc');
  if (t > 220) pool.push('orc', 'spider', 'ghost');
  if (t > 330) pool.push('cyclops', 'demon');
  return { interval, batch, hpMul, pool };
}

export function xpForLevel(level) {
  return Math.floor(5 + level * level * 1.3);
}

// Weapons: stats(level) returns the numbers for that level (1..max).
export const WEAPONS = {
  bolt: {
    max: 5,
    stats: (lv) => ({ dmg: 9 + lv * 4, cooldown: 1.0 - lv * 0.1, count: 1 + Math.floor(lv / 2), pierce: lv >= 4 ? 2 : 1, speed: 210 }),
  },
  blades: {
    max: 5,
    stats: (lv) => ({ dmg: 7 + lv * 3, count: lv + 1, radius: 34 + lv * 3, spin: 3 + lv * 0.3, hitCd: 0.45 }),
  },
  aura: {
    max: 5,
    stats: (lv) => ({ dmg: 3 + lv * 2, radius: 30 + lv * 7, tick: 0.5 }),
  },
  nova: {
    max: 5,
    stats: (lv) => ({ dmg: 14 + lv * 6, cooldown: 3.2 - lv * 0.3, radius: 70 + lv * 10 }),
  },
};

export const PASSIVES = {
  speed: { max: 5 }, // +10% move speed each
  vigor: { max: 5 }, // +20 max hp and heal 20
  magnet: { max: 5 }, // +35% pickup radius
  might: { max: 5 }, // +15% damage
  haste: { max: 5 }, // -8% cooldowns
};
