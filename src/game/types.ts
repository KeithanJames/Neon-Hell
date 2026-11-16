export type GameScreenState =
  | 'TITLE_MENU'
  | 'LEVEL_SELECT'
  | 'INSTRUCTIONS'
  | 'SETTINGS'
  | 'LEVEL_INTRO'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER'
  | 'VICTORY';

export type WeaponId = 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'railgun';

export interface WeaponDef {
  id: WeaponId;
  slot: number;
  name: string;
  shortName: string;
  description: string;
  damage: number;
  pellets: number;
  spread: number;
  fireRate: number; // shots per second
  magSize: number;
  maxReserve: number; // -1 for unlimited
  reloadTime: number; // seconds
  automatic: boolean;
  range: number;
  piercing: boolean;
  color: string;
  muzzleColor: number; // RGB hex
  recoil: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol',
    slot: 1,
    name: 'Cyber Pistol',
    shortName: 'PISTOL',
    description: 'Standard-issue sidearm with unlimited reserve cells.',
    damage: 24,
    pellets: 1,
    spread: 0.012,
    fireRate: 3.8,
    magSize: 12,
    maxReserve: -1,
    reloadTime: 1.05,
    automatic: false,
    range: 18,
    piercing: false,
    color: '#22d3ee',
    muzzleColor: 0x22d3ee,
    recoil: 0.08,
  },
  smg: {
    id: 'smg',
    slot: 2,
    name: 'Neon SMG',
    shortName: 'NEON SMG',
    description: 'High-RPM submachine gun for shredding light squads.',
    damage: 14,
    pellets: 1,
    spread: 0.048,
    fireRate: 11.5,
    magSize: 36,
    maxReserve: 216,
    reloadTime: 1.35,
    automatic: true,
    range: 14,
    piercing: false,
    color: '#e879f9',
    muzzleColor: 0xe879f9,
    recoil: 0.045,
  },
  shotgun: {
    id: 'shotgun',
    slot: 3,
    name: 'Plasma Shotgun',
    shortName: 'SHOTGUN',
    description: 'Superheated multi-pellet scatter cannon. Devastating up close.',
    damage: 17,
    pellets: 7,
    spread: 0.125,
    fireRate: 1.35,
    magSize: 6,
    maxReserve: 42,
    reloadTime: 1.65,
    automatic: false,
    range: 9.5,
    piercing: false,
    color: '#fb923c',
    muzzleColor: 0xfb923c,
    recoil: 0.18,
  },
  rifle: {
    id: 'rifle',
    slot: 4,
    name: 'Pulse Rifle',
    shortName: 'PULSE RIFLE',
    description: 'Precision corporate assault carbine effective at all ranges.',
    damage: 32,
    pellets: 1,
    spread: 0.018,
    fireRate: 6.2,
    magSize: 28,
    maxReserve: 168,
    reloadTime: 1.5,
    automatic: true,
    range: 24,
    piercing: false,
    color: '#38bdf8',
    muzzleColor: 0x38bdf8,
    recoil: 0.065,
  },
  railgun: {
    id: 'railgun',
    slot: 5,
    name: 'Railgun',
    shortName: 'RAILGUN',
    description: 'Electromagnetic hyper-velocity lance. Pierces targets instantly.',
    damage: 145,
    pellets: 1,
    spread: 0.002,
    fireRate: 0.85,
    magSize: 4,
    maxReserve: 24,
    reloadTime: 2.0,
    automatic: false,
    range: 32,
    piercing: true,
    color: '#f43f5e',
    muzzleColor: 0xf43f5e,
    recoil: 0.25,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'railgun'];

export interface WeaponState {
  unlocked: boolean;
  mag: number;
  reserve: number;
}

export type EnemyType =
  | 'grunt'
  | 'soldier'
  | 'drone'
  | 'mech'
  | 'sniper'
  | 'mutant'
  | 'commander'
  | 'miniboss'
  | 'finalboss';

export type EnemyTier = 'basic' | 'advanced' | 'heavy' | 'elite' | 'boss';

export interface EnemyArchetype {
  type: EnemyType;
  name: string;
  tier: EnemyTier;
  baseHp: number;
  baseSpeed: number;
  baseDamage: number;
  points: number;
  attackRange: number;
  preferredRange: number;
  attackCooldown: number;
  windupTime: number;
  projectileSpeed: number; // 0 = melee or hitscan laser
  isMelee: boolean;
  isFlying: boolean;
  radius: number;
  scale: number;
  primaryColor: string;
  accentColor: string;
}

export const ENEMY_ARCHETYPES: Record<EnemyType, EnemyArchetype> = {
  grunt: {
    type: 'grunt',
    name: 'Cyber Grunt',
    tier: 'basic',
    baseHp: 45,
    baseSpeed: 1.75,
    baseDamage: 8,
    points: 100,
    attackRange: 10,
    preferredRange: 4.5,
    attackCooldown: 1.5,
    windupTime: 0.35,
    projectileSpeed: 7.5,
    isMelee: false,
    isFlying: false,
    radius: 0.3,
    scale: 0.92,
    primaryColor: '#334155',
    accentColor: '#22d3ee',
  },
  soldier: {
    type: 'soldier',
    name: 'Cyber Soldier',
    tier: 'advanced',
    baseHp: 85,
    baseSpeed: 2.2,
    baseDamage: 11,
    points: 250,
    attackRange: 12,
    preferredRange: 5.5,
    attackCooldown: 1.05,
    windupTime: 0.28,
    projectileSpeed: 9.0,
    isMelee: false,
    isFlying: false,
    radius: 0.32,
    scale: 1.0,
    primaryColor: '#475569',
    accentColor: '#f43f5e',
  },
  drone: {
    type: 'drone',
    name: 'Assassin Drone',
    tier: 'advanced',
    baseHp: 50,
    baseSpeed: 3.4,
    baseDamage: 9,
    points: 250,
    attackRange: 11,
    preferredRange: 4.0,
    attackCooldown: 0.95,
    windupTime: 0.22,
    projectileSpeed: 10.5,
    isMelee: false,
    isFlying: true,
    radius: 0.26,
    scale: 0.72,
    primaryColor: '#1e1b4b',
    accentColor: '#e879f9',
  },
  mech: {
    type: 'mech',
    name: 'Heavy Mech',
    tier: 'heavy',
    baseHp: 210,
    baseSpeed: 1.25,
    baseDamage: 18,
    points: 400,
    attackRange: 13,
    preferredRange: 5.0,
    attackCooldown: 1.65,
    windupTime: 0.45,
    projectileSpeed: 8.2,
    isMelee: false,
    isFlying: false,
    radius: 0.42,
    scale: 1.22,
    primaryColor: '#27272a',
    accentColor: '#f59e0b',
  },
  sniper: {
    type: 'sniper',
    name: 'Cyber Sniper',
    tier: 'advanced',
    baseHp: 70,
    baseSpeed: 2.0,
    baseDamage: 24,
    points: 250,
    attackRange: 18,
    preferredRange: 10.5,
    attackCooldown: 2.2,
    windupTime: 0.75,
    projectileSpeed: 17.5,
    isMelee: false,
    isFlying: false,
    radius: 0.3,
    scale: 0.98,
    primaryColor: '#0f172a',
    accentColor: '#38bdf8',
  },
  mutant: {
    type: 'mutant',
    name: 'Mutant Experiment',
    tier: 'heavy',
    baseHp: 145,
    baseSpeed: 3.65,
    baseDamage: 20,
    points: 400,
    attackRange: 1.35,
    preferredRange: 0.8,
    attackCooldown: 0.85,
    windupTime: 0.22,
    projectileSpeed: 0,
    isMelee: true,
    isFlying: false,
    radius: 0.34,
    scale: 1.05,
    primaryColor: '#14532d',
    accentColor: '#84cc16',
  },
  commander: {
    type: 'commander',
    name: 'Elite Commander',
    tier: 'elite',
    baseHp: 240,
    baseSpeed: 2.45,
    baseDamage: 16,
    points: 600,
    attackRange: 15,
    preferredRange: 6.5,
    attackCooldown: 1.2,
    windupTime: 0.32,
    projectileSpeed: 10.5,
    isMelee: false,
    isFlying: false,
    radius: 0.36,
    scale: 1.12,
    primaryColor: '#4c1d95',
    accentColor: '#facc15',
  },
  miniboss: {
    type: 'miniboss',
    name: 'WARDEN-05 // Siege Exo',
    tier: 'boss',
    baseHp: 750,
    baseSpeed: 1.75,
    baseDamage: 20,
    points: 2000,
    attackRange: 16,
    preferredRange: 6.0,
    attackCooldown: 1.35,
    windupTime: 0.45,
    projectileSpeed: 9.5,
    isMelee: false,
    isFlying: false,
    radius: 0.46,
    scale: 1.35,
    primaryColor: '#450a0a',
    accentColor: '#fb7185',
  },
  finalboss: {
    type: 'finalboss',
    name: 'NEXUS AI CORE // OMEGA',
    tier: 'boss',
    baseHp: 1850,
    baseSpeed: 2.1,
    baseDamage: 22,
    points: 2000,
    attackRange: 20,
    preferredRange: 7.5,
    attackCooldown: 1.1,
    windupTime: 0.4,
    projectileSpeed: 10.5,
    isMelee: false,
    isFlying: true,
    radius: 0.48,
    scale: 1.48,
    primaryColor: '#09090b',
    accentColor: '#ff007f',
  },
};

export type EnemyAIState =
  | 'idle'
  | 'chase'
  | 'strafe'
  | 'windup'
  | 'attack'
  | 'hurt'
  | 'dying'
  | 'dead';

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  state: EnemyAIState;
  stateTimer: number;
  cooldownTimer: number;
  animTimer: number;
  hurtFlash: number;
  strafeDir: number;
  alerted: boolean;
  phase: number; // for bosses
  lastSeenX: number;
  lastSeenY: number;
}

export type CollectibleType =
  | 'health'
  | 'armor'
  | 'ammo'
  | 'damage_boost'
  | 'secret_data'
  | 'weapon_smg'
  | 'weapon_shotgun'
  | 'weapon_rifle'
  | 'weapon_railgun';

export interface CollectibleEntity {
  id: number;
  type: CollectibleType;
  x: number;
  y: number;
  collected: boolean;
  bobOffset: number;
}

export interface ProjectileEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  fromPlayer: boolean;
  color: string;
  radius: number;
  life: number;
}

export interface ParticleEntity {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface BeamEffect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

export type TileType =
  | 0 // Empty floor
  | 1 // Concrete cyber wall (cyan conduit)
  | 2 // Industrial steel / hazard wall
  | 3 // NEXUS obsidian magenta grid
  | 4 // Animated neon billboard wall
  | 5 // Bio-lab containment wall
  | 6 // Server rack blinking wall
  | 7 // Corrupted AI core crimson wall
  | 8 // Sliding Security Door
  | 9 // Exit Airlock Portal
  | 10 // Secret push wall
  | 11; // Toxic floor hazard (walkable, deals periodic damage)

export interface DoorState {
  tx: number;
  ty: number;
  openAmount: number; // 0 = closed, 1 = open
  opening: boolean;
  autoCloseTimer: number;
  isSecret?: boolean;
}

export interface LevelDefinition {
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
  grid: number[][];
  playerStart: { x: number; y: number; angle: number };
  enemies: Array<{ type: EnemyType; x: number; y: number }>;
  collectibles: Array<{ type: CollectibleType; x: number; y: number }>;
}

export interface GameSettings {
  mouseSensitivity: number; // 0.3 to 2.5
  volume: number; // 0 to 1
  muted: boolean;
  crtScanlines: boolean;
  fov: number; // 60 to 90 degrees
  showMinimap: boolean;
}

export interface LevelSummaryStats {
  levelNumber: number;
  levelName: string;
  kills: number;
  totalEnemies: number;
  timeSeconds: number;
  timeBonus: number;
  survivalBonus: number;
  secretsFound: number;
  totalSecrets: number;
  scoreEarned: number;
  totalScore: number;
}

export interface GameHudSnapshot {
  screen: GameScreenState;
  levelNumber: number;
  levelName: string;
  levelSubtitle: string;
  difficultyLabel: string;
  objective: string;
  themeColor: string;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  damageBoostTimer: number;
  activeWeapon: WeaponId;
  weapons: Record<WeaponId, WeaponState>;
  isReloading: boolean;
  reloadProgress: number;
  score: number;
  highScore: number;
  kills: number;
  totalLevelKills: number;
  totalEnemies: number;
  remainingEnemies: number;
  killStreak: number;
  streakMultiplier: number;
  streakTimer: number;
  levelTime: number;
  totalRunTime: number;
  levelsCompleted: number;
  exitUnlocked: boolean;
  interactPrompt: string | null;
  hitMarkerTimer: number;
  hitMarkerCrit: boolean;
  statusToast: string | null;
  boss: {
    name: string;
    hp: number;
    maxHp: number;
    phase: number;
  } | null;
  pointerLocked: boolean;
  levelSummary: LevelSummaryStats | null;
  unlockedLevels: number;
  minimapData: {
    width: number;
    height: number;
    playerX: number;
    playerY: number;
    playerAngle: number;
    grid: number[][];
    explored: boolean[][];
    doors: Array<{ tx: number; ty: number; open: boolean; isSecret?: boolean }>;
    enemies: Array<{ x: number; y: number; tier: EnemyTier }>;
    exitPos: { x: number; y: number } | null;
  } | null;
}
