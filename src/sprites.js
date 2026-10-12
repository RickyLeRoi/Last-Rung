'use strict';
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
