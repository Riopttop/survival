// Generates placeholder pixel-art PNGs into public/assets.
// Every file here can be replaced by a Kenney (CC0) or SpriteCook sprite of the same size/layout.
// Run: npm run sprites
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/assets');
fs.mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

// frames: array of string[] (rows). All frames share width/height; laid out horizontally.
function sheet(name, palette, frames) {
  const h = frames[0].length;
  const w = Math.max(...frames.flat().map((r) => r.length));
  const png = new PNG({ width: w * frames.length, height: h });
  frames.forEach((rows, fi) => {
    if (rows.length !== h) throw new Error(`${name} frame ${fi}: ${rows.length} rows, expected ${h}`);
    rows.forEach((row, y) => {
      if (row.length > w) throw new Error(`${name} f${fi} row ${y} too long`);
      for (let x = 0; x < w; x++) {
        const ch = row[x] ?? '.';
        const i = ((png.width * y) + fi * w + x) << 2;
        const c = ch === '.' ? [0, 0, 0, 0] : hex(palette[ch] ?? (() => { throw new Error(`${name}: no color for '${ch}'`); })());
        png.data.set(c, i);
      }
    });
  });
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(png));
  console.log(`${name}.png  ${png.width}x${png.height} (${frames.length} frames of ${w}x${h})`);
}

const E = '................';

// ---- Hero (PLACEHOLDER: to be replaced with SpriteCook art, 16x16, 2 walk frames) ----
const heroTop = [
  E,
  '......kkkk......',
  '.....kcccck.....',
  '....kcccccck....',
  '....kcssssck....',
  '....kcesseck....',
  '....kcssssck....',
  '...kcccccccck...',
  '..kccdccccdcck..',
  '..kscdccccdcskl.',
  '...kcdccccdckll.',
  '...kddddddddk.l.',
  '....kddddddk....',
];
sheet('hero', { k: '#1b1b2a', c: '#3d6ee0', d: '#2a4aa0', s: '#f2c79b', e: '#1b1b2a', l: '#ffd75e', b: '#5a3a22' }, [
  [...heroTop, '....kbk..kbk....', '....kbk..kbk....', '....kkk..kkk....'],
  [...heroTop, '...kbk....kbk...', '...kbk....kbk...', '...kkk....kkk...'],
]);

// ---- Slime ----
const slime0 = [
  E, E, E, E, E, E, E,
  '......kkkk......',
  '....kkgggggkk...',
  '...kghhgggggdk..',
  '..kghgggggggddk.',
  '..kggekggekgddk.',
  '..kggggggggddk..',
  '..kdgggggggdddk.',
  '...kdddddddddk..',
  '....kkkkkkkkk...',
];
const slime1 = [E, ...slime0.slice(0, 7), ...slime0.slice(8)];
sheet('slime', { k: '#1a2a1a', g: '#5fd35f', h: '#b6f5a0', d: '#3a9a3a', e: '#ffffff' }, [slime0, slime1]);

// ---- Bat ----
sheet('bat', { k: '#1a1020', p: '#7a4aa8', q: '#a77ad6', r: '#ff4a4a' }, [
  [E, E, E,
    'k..............k',
    'kk............kk',
    'kpk....kk....kpk',
    'kppk..kppk..kppk',
    'kpqppkprrpkppqpk',
    '.kpqppppppppqpk.',
    '..kpppkppkpppk..',
    '...kkk.kk.kkk...',
    E, E, E, E, E],
  [E, E, E, E, E,
    '.......kk.......',
    '......kppk......',
    '..kkkkprrpkkkk..',
    '.kpqppppppppqpk.',
    '.kpqpkppppkpqpk.',
    'kpk..kppppk..kpk',
    'kk....kkkk....kk',
    'k..............k',
    E, E, E],
]);

// ---- Brute (skeleton warrior) ----
const bruteTop = [
  E,
  '.....kkkkkk.....',
  '....kwwwwwwk....',
  '...kwwwwwwwwk...',
  '...kwkrwwrkwk...',
  '...kwwwkkwwwk...',
  '....kwxwxwxk....',
  '..kkkaaaaaakkk..',
  '.kaaaaxaaxaaaak.',
  '.kwkaaaxxaaakwk.',
  '.kwkaaaaaaaakwk.',
  '..k.kaaaaaak.k..',
  '....kaakkaak....',
];
sheet('brute', { k: '#1a1414', w: '#e8e2cf', x: '#b0a88f', a: '#8a3a3a', r: '#ff3a3a' }, [
  [...bruteTop, '....kwwk.kwwk...', '....kwwk.kwwk...', '....kkkk.kkkk...'],
  [...bruteTop, '...kwwk..kwwk...', '...kwwk..kwwk...', '...kkkk..kkkk...'],
]);

// ---- Small things ----
sheet('gem', { k: '#0b3a4a', b: '#4ad9ff', h: '#d6f8ff', d: '#2a8ab8' }, [[
  '...kk...', '..khbk..', '.khbbdk.', 'khbbbbdk', 'kbbbbddk', '.kbbddk.', '..kddk..', '...kk...',
]]);
sheet('bolt', { k: '#ff9a1f', y: '#ffe066', w: '#ffffff' }, [[
  '..kkkk..', '.kyyyyk.', 'kyywwyyk', 'kywwwwyk', 'kywwwwyk', 'kyywwyyk', '.kyyyyk.', '..kkkk..',
]]);
sheet('blade', { k: '#2a2a3a', s: '#cfd6e6', h: '#ffffff', b: '#8a5a2a' }, [[
  '..........kk',
  '.........khk',
  '........khsk',
  '.......khsk.',
  '......khsk..',
  '.....khsk...',
  '..k.khsk....',
  '..kkhsk.....',
  '...kbk......',
  '..kbkk......',
  '.kbk.k......',
  'kk..........',
]]);
sheet('heart', { k: '#5a1020', r: '#ff4a5a', h: '#ffb0b8' }, [[
  '.kk..kk.', 'khrkkrrk', 'krrrrrrk', 'krrrrrrk', '.krrrrk.', '..krrk..', '...kk...', '........',
]]);

// ---- Ground tile 32x32 (seeded noise grass) ----
{
  const S = 32;
  const png = new PNG({ width: S, height: S });
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const base = hex('#34502f'), light = hex('#3f5f38'), dark = hex('#2c4428');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = rnd();
    png.data.set(r < 0.12 ? light : r < 0.2 ? dark : base, (y * S + x) << 2);
  }
  // a few grass tufts and flowers
  const put = (x, y, c) => png.data.set(hex(c), (((y + S) % S) * S + ((x + S) % S)) << 2);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
    put(x, y, '#5a8a4a'); put(x - 1, y + 1, '#5a8a4a'); put(x + 1, y + 1, '#5a8a4a');
  }
  put(7, 22, '#e8d36a'); put(24, 6, '#d98ad9');
  fs.writeFileSync(path.join(OUT, 'ground.png'), PNG.sync.write(png));
  console.log('ground.png  32x32');
}
