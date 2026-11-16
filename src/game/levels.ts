import { CollectibleType, EnemyType, LevelDefinition, WeaponId } from './types';

interface RawLevelSpec {
  levelNumber: number;
  name: string;
  subtitle: string;
  difficultyLabel: string;
  objective: string;
  themeColor: string;
  ceilingColor: [number, number, number];
  floorColor: [number, number, number];
  fogColor: [number, number, number];
  fogDensity: number;
  ambientLight: number;
  hasFlicker: boolean;
  isBossLevel: boolean;
  weaponUnlock?: WeaponId;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  playerAngle: number;
  ascii: string[];
}

function parseAsciiLevel(spec: RawLevelSpec): LevelDefinition {
  const height = spec.ascii.length;
  const width = Math.max(...spec.ascii.map((r) => r.length));
  const grid: number[][] = [];
  const enemies: Array<{ type: EnemyType; x: number; y: number }> = [];
  const collectibles: Array<{ type: CollectibleType; x: number; y: number }> = [];
  let playerStart = { x: 2.5, y: 2.5, angle: spec.playerAngle };

  const enemyMap: Record<string, EnemyType> = {
    g: 'grunt',
    s: 'soldier',
    d: 'drone',
    m: 'mech',
    n: 'sniper',
    x: 'mutant',
    c: 'commander',
    B: 'miniboss',
    O: 'finalboss',
  };

  const itemMap: Record<string, CollectibleType> = {
    h: 'health',
    a: 'armor',
    b: 'ammo',
    u: 'damage_boost',
    k: 'secret_data',
    W: 'weapon_smg',
    Q: 'weapon_shotgun',
    R: 'weapon_rifle',
    L: 'weapon_railgun',
  };

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    const line = spec.ascii[y].padEnd(width, '1');
    for (let x = 0; x < width; x++) {
      const ch = line[x];
      const cx = x + 0.5;
      const cy = y + 0.5;

      if (ch === '1' || ch === '#') row.push(1);
      else if (ch === '2') row.push(2);
      else if (ch === '3') row.push(3);
      else if (ch === '4') row.push(4);
      else if (ch === '5') row.push(5);
      else if (ch === '6') row.push(6);
      else if (ch === '7') row.push(7);
      else if (ch === 'D') row.push(8);
      else if (ch === 'E') row.push(9);
      else if (ch === 'S') row.push(10);
      else if (ch === '~') row.push(11);
      else {
        row.push(0);
        if (ch === 'P') {
          playerStart = { x: cx, y: cy, angle: spec.playerAngle };
        } else if (enemyMap[ch]) {
          enemies.push({ type: enemyMap[ch], x: cx, y: cy });
        } else if (itemMap[ch]) {
          collectibles.push({ type: itemMap[ch], x: cx, y: cy });
        }
      }
    }
    grid.push(row);
  }

  return {
    levelNumber: spec.levelNumber,
    name: spec.name,
    subtitle: spec.subtitle,
    difficultyLabel: spec.difficultyLabel,
    objective: spec.objective,
    themeColor: spec.themeColor,
    ceilingColor: spec.ceilingColor,
    floorColor: spec.floorColor,
    fogColor: spec.fogColor,
    fogDensity: spec.fogDensity,
    ambientLight: spec.ambientLight,
    hasFlicker: spec.hasFlicker,
    isBossLevel: spec.isBossLevel,
    weaponUnlock: spec.weaponUnlock,
    hpMultiplier: spec.hpMultiplier,
    damageMultiplier: spec.damageMultiplier,
    speedMultiplier: spec.speedMultiplier,
    grid,
    playerStart,
    enemies,
    collectibles,
  };
}

const RAW_LEVELS: RawLevelSpec[] = [
  // LEVEL 1: Abandoned Neon District (Easy)
  {
    levelNumber: 1,
    name: 'Abandoned Neon District',
    subtitle: 'SECTOR 01 // OUTER VYRE SLUMS',
    difficultyLabel: 'EASY',
    objective: 'Clear NEXUS patrol grunts, acquire the Neon SMG, and reach the Exit Airlock.',
    themeColor: '#22d3ee',
    ceilingColor: [8, 12, 24],
    floorColor: [14, 18, 28],
    fogColor: [8, 14, 28],
    fogDensity: 0.085,
    ambientLight: 0.92,
    hasFlicker: false,
    isBossLevel: false,
    weaponUnlock: 'smg',
    hpMultiplier: 0.85,
    damageMultiplier: 0.8,
    speedMultiplier: 0.9,
    playerAngle: 0,
    ascii: [
      '11411111111141111111',
      '1P...1......g.....b1',
      '1..b.D..44........11',
      '1....1..44..g..a...1',
      '111D11......1111D111',
      '1....1..g...1......1',
      '1.k..S......1..W...1',
      '1.h..1..b...D..g...1',
      '1111114111111......1',
      '1...g....h..1..g..h1',
      '1...........D......1',
      '1..44...g...11111D11',
      '1..44.......1..a...1',
      '1.....b..g..1..g..E1',
      '11114111111111111111',
    ],
  },

  // LEVEL 2: Underground Metro (Easy)
  {
    levelNumber: 2,
    name: 'Underground Metro',
    subtitle: 'SECTOR 02 // SUB-LEVEL TRANSIT LINE',
    difficultyLabel: 'EASY',
    objective: 'Fight through narrow subway tunnels and eliminate station defenders.',
    themeColor: '#38bdf8',
    ceilingColor: [10, 12, 20],
    floorColor: [18, 20, 26],
    fogColor: [12, 16, 28],
    fogDensity: 0.095,
    ambientLight: 0.88,
    hasFlicker: true,
    isBossLevel: false,
    hpMultiplier: 1.0,
    damageMultiplier: 0.9,
    speedMultiplier: 0.95,
    playerAngle: 0,
    ascii: [
      '2222422222224222222222',
      '2P..b..2....g...b....2',
      '2......D.............2',
      '2..h...2..22D22..s...2',
      '222D2222..2...2......2',
      '2......2..2.a.2..22D22',
      '2.g....D..2...2..2...2',
      '2......2222...2222.g.2',
      '2..s..........g......2',
      '2222.22222.22222.22D22',
      '2.k..S...2.2h..2.2...2',
      '2.a..2.g.D.D...D.D.s.2',
      '222222...2.2.b.2.2...2',
      '2....g...2.22222.2.g.2',
      '2..h.....2.......2..E2',
      '2222422222222222222222',
    ],
  },

  // LEVEL 3: Cybernetic Factory (Medium)
  {
    levelNumber: 3,
    name: 'Cybernetic Factory',
    subtitle: 'SECTOR 03 // AUTOMATED FOUNDRY',
    difficultyLabel: 'MEDIUM',
    objective: 'Secure the Plasma Shotgun, destroy Assassin Drones and Heavy Mechs.',
    themeColor: '#f59e0b',
    ceilingColor: [16, 12, 10],
    floorColor: [22, 18, 16],
    fogColor: [24, 14, 10],
    fogDensity: 0.09,
    ambientLight: 0.86,
    hasFlicker: true,
    isBossLevel: false,
    weaponUnlock: 'shotgun',
    hpMultiplier: 1.05,
    damageMultiplier: 1.0,
    speedMultiplier: 1.0,
    playerAngle: 0,
    ascii: [
      '222222422222242222222222',
      '2P..b..2.......g..b....2',
      '2......D..22.......22..2',
      '2..a...2..22...d...22..2',
      '222D2222.......g.......2',
      '2......22D22222D2222D222',
      '2..Q...D.......2.......2',
      '2..h...2..g....D...d...2',
      '22222222.......2.......2',
      '2...g......22..2..m....2',
      '2......d...22..2.....h.2',
      '2.2222.........2222D2222',
      '2.2k.S...s..b..D.......2',
      '2.2a.2.........2..s..d.2',
      '2.2222..222D2222.......2',
      '2.......2......2..m...E2',
      '222222222222222222222222',
    ],
  },

  // LEVEL 4: Industrial Wasteland (Medium)
  {
    levelNumber: 4,
    name: 'Industrial Wasteland',
    subtitle: 'SECTOR 04 // REACTOR YARDS',
    difficultyLabel: 'MEDIUM',
    objective: 'Recover the Pulse Rifle and break through NEXUS bunker defenses.',
    themeColor: '#fb923c',
    ceilingColor: [14, 10, 18],
    floorColor: [20, 16, 22],
    fogColor: [20, 12, 24],
    fogDensity: 0.085,
    ambientLight: 0.85,
    hasFlicker: false,
    isBossLevel: false,
    weaponUnlock: 'rifle',
    hpMultiplier: 1.15,
    damageMultiplier: 1.05,
    speedMultiplier: 1.05,
    playerAngle: 0,
    ascii: [
      '222422222222224222222222',
      '2P...b..2...g......a...2',
      '2.......D......22......2',
      '2..h....2..s...22..d...2',
      '222D22222......g.......2',
      '2...g.......2222D2222D22',
      '2......d....2....R...2.2',
      '2..22..22...D..s.....D.2',
      '2..22..22...2....b...2.2',
      '2...........22222D2222.2',
      '2..s....m...2..........2',
      '222D22222...2..d...m...2',
      '2.k...S.....D......h...2',
      '2.u...2..h..2..s.......2',
      '2222222.....2.....b...E2',
      '222222222222222222222222',
    ],
  },

  // LEVEL 5: NEXUS Research Facility (Hard - Mini-Boss)
  {
    levelNumber: 5,
    name: 'NEXUS Research Facility',
    subtitle: 'SECTOR 05 // BIO-CYBERNETIC LABS',
    difficultyLabel: 'HARD · MINI-BOSS',
    objective: 'Infiltrate the NEXUS lab and destroy WARDEN-05 Siege Exo-Suit.',
    themeColor: '#e879f9',
    ceilingColor: [14, 8, 22],
    floorColor: [16, 12, 26],
    fogColor: [22, 8, 34],
    fogDensity: 0.09,
    ambientLight: 0.85,
    hasFlicker: true,
    isBossLevel: true,
    hpMultiplier: 1.2,
    damageMultiplier: 1.15,
    speedMultiplier: 1.08,
    playerAngle: 0,
    ascii: [
      '333433333333333334333333',
      '3P..b..3...s....3..h...3',
      '3......D........D......3',
      '3..a...3...d....3..s...3',
      '333D333333D33333333D3333',
      '3......3........3......3',
      '3..n...D...66...D..d...3',
      '3......3...66...3......3',
      '3.k.S..3........3..b.a.3',
      '3333333333D33D3333333333',
      '3..h................b..3',
      '3......33......33......3',
      '3..d...33..B...33..d...3',
      '3......................3',
      '3..a.......h.......b..E3',
      '333333333333333333333333',
    ],
  },

  // LEVEL 6: Toxic Underground Labs (Hard)
  {
    levelNumber: 6,
    name: 'Toxic Underground Labs',
    subtitle: 'SECTOR 06 // MUTAGEN CONTAINMENT',
    difficultyLabel: 'HARD',
    objective: 'Survive bio-mutant swarms and avoid lethal toxic sludge channels.',
    themeColor: '#4ade80',
    ceilingColor: [6, 16, 12],
    floorColor: [10, 22, 14],
    fogColor: [8, 26, 14],
    fogDensity: 0.105,
    ambientLight: 0.82,
    hasFlicker: true,
    isBossLevel: false,
    hpMultiplier: 1.3,
    damageMultiplier: 1.2,
    speedMultiplier: 1.1,
    playerAngle: 0,
    ascii: [
      '555555555555555555555555',
      '5P..b..5..~~~..5..h....5',
      '5......D..~~~..D....x..5',
      '5..h...5.......5.......5',
      '555D55555..x...555D55555',
      '5.....~~~......~~~.....5',
      '5..x..~~~..55..~~~..n..5',
      '5..........55..........5',
      '5..a..5555D55D5555..b..5',
      '5.....5..........5.....5',
      '555D555..x....d..555D555',
      '5.k.S.5..........5.....5',
      '5.u.h.5..~~..~~..5..m..5',
      '5555555..~~..~~..D.....5',
      '5..b.....x.......5..a.E5',
      '555555555555555555555555',
    ],
  },

  // LEVEL 7: Cyber Security Complex (Very Hard)
  {
    levelNumber: 7,
    name: 'Cyber Security Complex',
    subtitle: 'SECTOR 07 // NEXUS DEFENSE GRID',
    difficultyLabel: 'VERY HARD',
    objective: 'Navigate sniper kill-zones and crush armored security squads.',
    themeColor: '#38bdf8',
    ceilingColor: [8, 12, 20],
    floorColor: [12, 16, 24],
    fogColor: [10, 16, 30],
    fogDensity: 0.08,
    ambientLight: 0.84,
    hasFlicker: false,
    isBossLevel: false,
    hpMultiplier: 1.4,
    damageMultiplier: 1.25,
    speedMultiplier: 1.15,
    playerAngle: 0,
    ascii: [
      '666466666666666666466666',
      '6P..b..6..........6..n.6',
      '6......D....66....D....6',
      '6..a...6....66....6..s.6',
      '666D6666..........666D66',
      '6..........s...........6',
      '6..n...66........66....6',
      '6......66...m....66..d.6',
      '666D6666666D66D666666D66',
      '6.k.S..6..........6....6',
      '6.h.a..6..s....n..6..m.6',
      '66666..D..........D....6',
      '6...b..6....66....6..h.6',
      '6..c........66......d..6',
      '6......h..........b...E6',
      '666666666666666666666666',
    ],
  },

  // LEVEL 8: Neon Warzone (Very Hard)
  {
    levelNumber: 8,
    name: 'Neon Warzone',
    subtitle: 'SECTOR 08 // INNER CITY COLLAPSE',
    difficultyLabel: 'VERY HARD',
    objective: 'Unlock the experimental Railgun and survive the NEXUS crossfire.',
    themeColor: '#f43f5e',
    ceilingColor: [18, 6, 16],
    floorColor: [18, 12, 22],
    fogColor: [28, 8, 24],
    fogDensity: 0.085,
    ambientLight: 0.82,
    hasFlicker: true,
    isBossLevel: false,
    weaponUnlock: 'railgun',
    hpMultiplier: 1.5,
    damageMultiplier: 1.3,
    speedMultiplier: 1.18,
    playerAngle: 0,
    ascii: [
      '441144114411441144114411',
      '4P..b..1........1..n...4',
      '1......D...s....D......1',
      '1..h...1........1..d...1',
      '111D1111..3333..111D1111',
      '1.........3L.3.........1',
      '4..d...m..3..3..s...m..4',
      '1.........3DD3.........1',
      '1..s.............d.....1',
      '111D1111..3333..111D1111',
      '1.k..S.1........1..c...1',
      '1.u..a.D...c....D......1',
      '11111111........1..x...1',
      '1..h......m..n..1..b..h1',
      '1.....b.........D.....E1',
      '441144114411441144114411',
    ],
  },

  // LEVEL 9: NEXUS Headquarters (Extreme)
  {
    levelNumber: 9,
    name: 'NEXUS Headquarters',
    subtitle: 'SECTOR 09 // EXECUTIVE CITADEL',
    difficultyLabel: 'EXTREME',
    objective: 'Breach the elite command spire and eliminate the Citadel Guard.',
    themeColor: '#facc15',
    ceilingColor: [14, 10, 22],
    floorColor: [16, 12, 22],
    fogColor: [20, 10, 32],
    fogDensity: 0.08,
    ambientLight: 0.84,
    hasFlicker: false,
    isBossLevel: false,
    hpMultiplier: 1.65,
    damageMultiplier: 1.4,
    speedMultiplier: 1.22,
    playerAngle: 0,
    ascii: [
      '333633333333333333363333',
      '3P..b..3........3..c...3',
      '3..a...D...n....D......3',
      '3......3........3..m...3',
      '333D333333D33D33333D3333',
      '3..h................b..3',
      '3......66......66......3',
      '6..c...66..d...66..c...6',
      '3......66......66......3',
      '3..m.......h.......n...3',
      '333D333333D33D33333D3333',
      '3.k.S..3........3......3',
      '3.u.h..D...x....D..m...3',
      '33333..3........3......3',
      '3..a.......c.......b..E3',
      '333333333333333333333333',
    ],
  },

  // LEVEL 10: The Core (Final Boss)
  {
    levelNumber: 10,
    name: 'The Core',
    subtitle: 'SECTOR 10 // NEXUS CENTRAL AI NEXUS',
    difficultyLabel: 'FINAL BOSS',
    objective: 'Destroy NEXUS AI CORE OMEGA and liberate the underground city of VYRE.',
    themeColor: '#ff007f',
    ceilingColor: [20, 4, 10],
    floorColor: [16, 6, 14],
    fogColor: [30, 4, 16],
    fogDensity: 0.065,
    ambientLight: 0.88,
    hasFlicker: true,
    isBossLevel: true,
    hpMultiplier: 1.5,
    damageMultiplier: 1.35,
    speedMultiplier: 1.15,
    playerAngle: 0,
    ascii: [
      '777777777777777777777777',
      '7P..b..7........7..a...7',
      '7..h...D........D..b...7',
      '7..a...7........7..h...7',
      '777D777777D77D77777D7777',
      '7..u................u..7',
      '7....77..........77....7',
      '7..h.77....O.....77.b..7',
      '7....77..........77....7',
      '7..d................d..7',
      '7....77..........77....7',
      '7..b.77..........77.h..7',
      '7....77..........77....7',
      '7..a................a..7',
      '7..........h..........E7',
      '777777777777777777777777',
    ],
  },
];

export const LEVELS: LevelDefinition[] = RAW_LEVELS.map(parseAsciiLevel);
