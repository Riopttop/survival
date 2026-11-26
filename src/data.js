// All balance numbers live here so they are easy to tweak.

export const PLAYER = {
  maxHp: 100,
  speed: 70, // world px / sec
  magnet: 36, // gem pickup pull radius
  iframes: 0.4, // seconds of invulnerability after a hit
};

export const ENEMIES = {
  slime: { tex: 'slime', hp: 10, speed: 32, dmg: 8, xp: 1, radius: 6 },
  bat: { tex: 'bat', hp: 6, speed: 62, dmg: 6, xp: 1, radius: 5 },
  brute: { tex: 'brute', hp: 40, speed: 26, dmg: 14, xp: 4, radius: 7 },
};

export const RUN_LENGTH = 600; // seconds to survive for a win (10 min)
export const BOSS_EVERY = 180; // a big elite every 3 min
export const MAX_ENEMIES = 350;

// Spawn rules by elapsed time (seconds).
export function spawnPlan(t) {
  const interval = Math.max(0.12, 1.1 - t / 260); // seconds between spawn batches
  const batch = 1 + Math.floor(t / 75);
  const hpMul = 1 + t / 150;
  const pool = ['slime'];
  if (t > 40) pool.push('bat', 'bat');
  if (t > 100) pool.push('brute');
  if (t > 240) pool.push('brute', 'bat');
  return { interval, batch, hpMul, pool };
}

export function xpForLevel(level) {
  return Math.floor(5 + level * level * 1.3);
}

// Weapons: stats(level) returns the numbers for that level (1..max).
export const WEAPONS = {
  bolt: {
    max: 5,
    stats: (lv) => ({ dmg: 9 + lv * 4, cooldown: 1.0 - lv * 0.1, count: 1 + Math.floor(lv / 2), pierce: lv >= 4 ? 2 : 1, speed: 200 }),
  },
  blades: {
    max: 5,
    stats: (lv) => ({ dmg: 7 + lv * 3, count: lv + 1, radius: 34 + lv * 2, spin: 3 + lv * 0.3, hitCd: 0.45 }),
  },
  aura: {
    max: 5,
    stats: (lv) => ({ dmg: 3 + lv * 2, radius: 30 + lv * 7, tick: 0.5 }),
  },
};

export const PASSIVES = {
  speed: { max: 5 }, // +10% move speed each
  vigor: { max: 5 }, // +20 max hp and heal 20
  magnet: { max: 5 }, // +35% pickup radius
  might: { max: 5 }, // +15% damage
  haste: { max: 5 }, // -8% cooldowns
};
