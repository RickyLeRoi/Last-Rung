'use strict';
function makeSprite(rows) {
  const pixels = [];
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') pixels.push(x, y); });
  return { w: rows[0].length, h: rows.length, p: pixels };
}
function outlineSprite(sprite) {
  const filled = new Set();
  for (let i = 0; i < sprite.p.length; i += 2) filled.add(sprite.p[i] + ',' + sprite.p[i + 1]);
  const pixels = [];
  for (let i = 0; i < sprite.p.length; i += 2) {
    const x = sprite.p[i], y = sprite.p[i + 1];
    if (!filled.has((x - 1) + ',' + y) || !filled.has((x + 1) + ',' + y) || !filled.has(x + ',' + (y - 1)) || !filled.has(x + ',' + (y + 1))) pixels.push(x, y);
  }
  return { w: sprite.w, h: sprite.h, p: pixels };
}

const SPRITES = {};

// Row 0 (rotor) and rows 12-15 (ladder) are drawn separately because they move.
SPRITES.heli = makeSprite([
  '................................',
  '................##..............',
  '##...........#########..........',
  '##..........#.........##........',
  '##..........#........#..#.......',
  '#############........#...#......',
  '#...........#....#...######.....',
  '#############...###........#....',
  '#...........#....#.........#....',
  '............################....',
  '.............#........#......#..',
  '...........##################...',
]);
SPRITES.heliFill = (() => {
  const columns = [];
  for (let i = 0; i < SPRITES.heli.p.length; i += 2) {
    const x = SPRITES.heli.p[i], y = SPRITES.heli.p[i + 1];
    if (y < 2) continue;
    const extent = columns[x] || (columns[x] = [y, y]);
    extent[0] = Math.min(extent[0], y); extent[1] = Math.max(extent[1], y);
  }
  return columns;
})();

// Hitboxes for a right-facing heli (mirrored when facing left).
const HITBOX = [
  { k: 'rotor', x: 1, y: 0, w: 31, h: 1 },
  { k: 'cabin', x: 12, y: 1, w: 17, h: 9 },
  { k: 'boom', x: 0, y: 2, w: 12, h: 7 },
  { k: 'skid', x: 11, y: 10, w: 19, h: 2 },
  { k: 'ladder', x: 14, y: 12, w: 4, h: 4 },
  { k: 'tail', x: 0, y: 2, w: 2, h: 7 },   // tail rotor: kills anyone passing close
];

SPRITES.up = makeSprite(['#.###.#', '#.#.#.#', '.#####.', '..###..', '...#...', '...#...', '..#.#..', '.#...#.']);
SPRITES.out = makeSprite(['..###..', '..#.#..', '..###..', '...#...', '.#####.', '#..#..#', '..#.#..', '.#...#.']);
SPRITES.hang = makeSprite(['#.###.#', '#.#.#.#', '.#####.', '..###..', '...#...', '...#...', '..#.#..', '..#.#..']);
SPRITES.dead = makeSprite(['###.....', '#.######', '###.#..#']);
SPRITES.kidUp = makeSprite(['#.#.#', '#####', '.###.', '..#..', '.#.#.', '.#.#.']);
SPRITES.kidOut = makeSprite(['..#..', '.###.', '#.#.#', '..#..', '.#.#.', '.#.#.']);
SPRITES.oldUp = makeSprite(['..###.#', '..#.#.#', '..####.', '...#...', '..###..', '..##..#', '..#.#.#', '.#..#.#']);
SPRITES.oldOut = makeSprite(['..###..', '..#.#..', '..###..', '...##..', '..####.', '..##..#', '..#.#.#', '.#..#.#']);
SPRITES.dog1 = makeSprite(['#.....##', '.#...###', '.######.', '.#.#..#.', '.#.#..#.']);
SPRITES.dog2 = makeSprite(['......##', '##...###', '.######.', '.#.#..#.', '..#..#..']);
SPRITES.crew = makeSprite(['.#####.', '..#.#..', '..###..', '...#...', '.#####.', '#..#..#', '..#.#..', '.#...#.']);
SPRITES.inj = makeSprite(['.###...', '.#.#...', '.###...', '..#....', '.###.#.', '#.#.#..', '..##...', '.#..#..']);
SPRITES.inj2 = makeSprite(['.###...', '.#.#...', '.###...', '..#....', '.###.#.', '#.#.#..', '..##...', '..#.#..']);

SPRITES.starOn = makeSprite([
  '....#....',
  '....#....',
  '...###...',
  '#########',
  '.#######.',
  '..#####..',
  '..##.##..',
  '.##...##.',
  '.#.....#.',
]);
SPRITES.starOff = outlineSprite(SPRITES.starOn);
