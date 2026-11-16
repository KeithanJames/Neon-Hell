import { CollectibleType, EnemyType, WeaponId } from './types';

export const TEX_SIZE = 64;

// Helper: pack RGBA into little-endian Uint32 (ABGR in memory for ImageData)
export function packRGBA(r: number, g: number, b: number, a = 255): number {
  return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function createCanvasTex(drawFn: (ctx: CanvasRenderingContext2D) => void): Uint32Array {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx);
  const img = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  return new Uint32Array(img.data.buffer);
}

function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function hash2d(x: number, y: number, seed = 1): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export interface TextureAtlas {
  walls: Record<number, Uint32Array>;
  wallAlt4: Uint32Array;
  floorTex: Uint32Array;
  ceilingTex: Uint32Array;
  toxicTex: Uint32Array;
  enemies: Record<EnemyType, {
    idle: Uint32Array;
    walk: Uint32Array;
    attack: Uint32Array;
    death: Uint32Array;
  }>;
  collectibles: Record<CollectibleType, Uint32Array>;
}

let cachedAtlas: TextureAtlas | null = null;

function buildWallTextures(): { walls: Record<number, Uint32Array>; wallAlt4: Uint32Array } {
  // 1: Cyber Metro Concrete + Cyan Neon Conduit
  const w1 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#181c28');
    for (let y = 0; y < 64; y += 2) {
      for (let x = 0; x < 64; x += 2) {
        const n = hash2d(x, y, 1);
        if (n > 0.72) fillRect(ctx, x, y, 2, 2, '#222838');
        else if (n < 0.2) fillRect(ctx, x, y, 2, 2, '#121520');
      }
    }
    // Panel seams & rivets
    fillRect(ctx, 0, 0, 64, 2, '#0c0f18');
    fillRect(ctx, 0, 31, 64, 2, '#0c0f18');
    fillRect(ctx, 31, 0, 2, 64, '#0c0f18');
    fillRect(ctx, 4, 4, 2, 2, '#475569');
    fillRect(ctx, 58, 4, 2, 2, '#475569');
    fillRect(ctx, 4, 58, 2, 2, '#475569');
    fillRect(ctx, 58, 58, 2, 2, '#475569');
    // Glowing cyan conduit stripe
    fillRect(ctx, 0, 14, 64, 4, '#0e7490');
    fillRect(ctx, 0, 15, 64, 2, '#22d3ee');
    fillRect(ctx, 26, 12, 12, 8, '#164e63');
    fillRect(ctx, 28, 14, 8, 4, '#67e8f9');
  });

  // 2: Industrial Steel + Hazard Stripes
  const w2 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#1f242d');
    for (let y = 0; y < 64; y++) {
      const shade = y % 16 === 0 ? '#11141a' : y % 16 === 1 ? '#2d3442' : null;
      if (shade) fillRect(ctx, 0, y, 64, 1, shade);
    }
    // Vertical steel ribs
    fillRect(ctx, 8, 0, 4, 64, '#2a303c');
    fillRect(ctx, 52, 0, 4, 64, '#2a303c');
    // Hazard diagonal stripes at bottom
    for (let y = 48; y < 60; y++) {
      for (let x = 0; x < 64; x++) {
        const stripe = ((x + y) >> 3) % 2 === 0;
        fillRect(ctx, x, y, 1, 1, stripe ? '#eab308' : '#111317');
      }
    }
    fillRect(ctx, 0, 46, 64, 2, '#090a0d');
    fillRect(ctx, 0, 60, 64, 2, '#090a0d');
    // Amber indicator vent
    fillRect(ctx, 20, 18, 24, 14, '#0f1218');
    for (let i = 20; i < 32; i += 3) {
      fillRect(ctx, 22, i, 20, 1, '#f59e0b');
    }
  });

  // 3: NEXUS Obsidian Grid (Magenta / Purple)
  const w3 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#120a1e');
    for (let i = 0; i < 64; i += 16) {
      fillRect(ctx, i, 0, 1, 64, '#3b0764');
      fillRect(ctx, 0, i, 64, 1, '#3b0764');
    }
    // Circuit trace
    fillRect(ctx, 16, 16, 32, 2, '#c026d3');
    fillRect(ctx, 46, 16, 2, 32, '#c026d3');
    fillRect(ctx, 16, 46, 32, 2, '#c026d3');
    fillRect(ctx, 16, 16, 2, 32, '#e879f9');
    fillRect(ctx, 26, 26, 12, 12, '#1e1035');
    fillRect(ctx, 29, 29, 6, 6, '#f0abfc');
  });

  // 4: Neon Billboard Sign (Frame A & Frame B)
  const drawBillboard = (ctx: CanvasRenderingContext2D, alt: boolean) => {
    fillRect(ctx, 0, 0, 64, 64, '#0b0c16');
    fillRect(ctx, 2, 4, 60, 56, '#131626');
    fillRect(ctx, 4, 6, 56, 52, '#080a12');
    // Neon border
    const borderCol = alt ? '#22d3ee' : '#f43f5e';
    const textCol = alt ? '#f43f5e' : '#22d3ee';
    fillRect(ctx, 4, 6, 56, 2, borderCol);
    fillRect(ctx, 4, 56, 56, 2, borderCol);
    fillRect(ctx, 4, 6, 2, 52, borderCol);
    fillRect(ctx, 58, 6, 2, 52, borderCol);
    // Pixel-art VYRE / NEXUS glyph block
    fillRect(ctx, 10, 14, 10, 4, textCol);
    fillRect(ctx, 10, 14, 4, 14, textCol);
    fillRect(ctx, 24, 14, 14, 4, '#e879f9');
    fillRect(ctx, 24, 21, 10, 3, '#e879f9');
    fillRect(ctx, 24, 26, 14, 4, '#e879f9');
    fillRect(ctx, 42, 14, 12, 16, textCol);
    fillRect(ctx, 45, 17, 6, 10, '#080a12');
    // Sub bars
    fillRect(ctx, 10, 36, 44, 4, alt ? '#facc15' : '#38bdf8');
    fillRect(ctx, 10, 44, 30, 3, '#94a3b8');
    fillRect(ctx, 44, 44, 10, 3, borderCol);
  };
  const w4 = createCanvasTex((ctx) => drawBillboard(ctx, false));
  const wallAlt4 = createCanvasTex((ctx) => drawBillboard(ctx, true));

  // 5: Bio-Lab Containment Wall
  const w5 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#0d1b1a');
    fillRect(ctx, 0, 0, 64, 8, '#1e293b');
    fillRect(ctx, 0, 56, 64, 8, '#1e293b');
    // Dual glowing toxic green tubes
    for (const tx of [10, 38]) {
      fillRect(ctx, tx, 8, 16, 48, '#052e16');
      fillRect(ctx, tx + 2, 10, 12, 44, '#15803d');
      fillRect(ctx, tx + 4, 12, 8, 40, '#4ade80');
      fillRect(ctx, tx + 5, 16, 2, 32, '#bbf7d0');
      // Bubbles
      fillRect(ctx, tx + 8, 20, 3, 3, '#dcfce7');
      fillRect(ctx, tx + 6, 36, 2, 2, '#dcfce7');
      fillRect(ctx, tx + 9, 44, 3, 3, '#dcfce7');
    }
  });

  // 6: Server Rack Matrix
  const w6 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#090d16');
    for (let y = 4; y < 60; y += 8) {
      fillRect(ctx, 4, y, 56, 6, '#161f30');
      for (let x = 8; x < 54; x += 6) {
        const r = hash2d(x, y, 6);
        const col = r > 0.7 ? '#22d3ee' : r > 0.45 ? '#3b82f6' : r > 0.3 ? '#f43f5e' : '#1e293b';
        fillRect(ctx, x, y + 2, 3, 2, col);
      }
    }
  });

  // 7: Corrupted AI Core Wall (Crimson / Obsidian)
  const w7 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#11070c');
    for (let i = 0; i < 64; i += 2) {
      for (let j = 0; j < 64; j += 2) {
        if (hash2d(i, j, 7) > 0.85) fillRect(ctx, i, j, 2, 2, '#2a0914');
      }
    }
    // Glowing crimson neural core
    fillRect(ctx, 0, 30, 64, 4, '#881337');
    fillRect(ctx, 30, 0, 4, 64, '#881337');
    fillRect(ctx, 20, 20, 24, 24, '#4c0519');
    fillRect(ctx, 24, 24, 16, 16, '#e11d48');
    fillRect(ctx, 28, 28, 8, 8, '#fda4af');
  });

  // 8: Sliding Security Blast Door
  const w8 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#1e293b');
    fillRect(ctx, 2, 2, 60, 60, '#334155');
    fillRect(ctx, 6, 6, 52, 52, '#1e293b');
    // Center seam
    fillRect(ctx, 31, 0, 2, 64, '#090d16');
    // Glowing cyan lock chevron
    fillRect(ctx, 18, 26, 28, 12, '#0f172a');
    fillRect(ctx, 20, 28, 24, 8, '#0284c7');
    fillRect(ctx, 24, 30, 16, 4, '#38bdf8');
    // Caution bars
    fillRect(ctx, 6, 8, 52, 4, '#eab308');
    fillRect(ctx, 6, 52, 52, 4, '#eab308');
  });

  // 9: Exit Airlock Portal
  const w9 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#062019');
    fillRect(ctx, 4, 4, 56, 56, '#064e3b');
    fillRect(ctx, 8, 8, 48, 48, '#022c22');
    // Portal glow rings
    fillRect(ctx, 12, 12, 40, 40, '#10b981');
    fillRect(ctx, 16, 16, 32, 32, '#064e3b');
    fillRect(ctx, 20, 20, 24, 24, '#34d399');
    fillRect(ctx, 24, 24, 16, 16, '#a7f3d0');
    // EXIT marker
    fillRect(ctx, 16, 4, 32, 6, '#ecfdf5');
  });

  // 10: Secret Push Wall (subtle cracked neon seam)
  const w10 = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#181c28');
    for (let y = 0; y < 64; y += 2) {
      for (let x = 0; x < 64; x += 2) {
        const n = hash2d(x, y, 10);
        if (n > 0.72) fillRect(ctx, x, y, 2, 2, '#222838');
      }
    }
    fillRect(ctx, 0, 14, 64, 4, '#0e7490');
    fillRect(ctx, 0, 15, 64, 2, '#22d3ee');
    // Subtle fracture line indicating secret push panel
    fillRect(ctx, 28, 22, 2, 14, '#38bdf8');
    fillRect(ctx, 30, 34, 6, 2, '#38bdf8');
    fillRect(ctx, 34, 36, 2, 12, '#0ea5e9');
  });

  return {
    walls: { 1: w1, 2: w2, 3: w3, 4: w4, 5: w5, 6: w6, 7: w7, 8: w8, 9: w9, 10: w10 },
    wallAlt4,
  };
}

function buildFloorAndCeiling() {
  const floorTex = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#0f131d');
    fillRect(ctx, 0, 0, 64, 2, '#1b2234');
    fillRect(ctx, 0, 0, 2, 64, '#1b2234');
    fillRect(ctx, 31, 0, 2, 64, '#090b12');
    fillRect(ctx, 0, 31, 64, 2, '#090b12');
    // Subtle grating dots
    for (let y = 6; y < 60; y += 8) {
      for (let x = 6; x < 60; x += 8) {
        fillRect(ctx, x, y, 2, 2, '#1a2132');
      }
    }
  });

  const ceilingTex = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#090a12');
    fillRect(ctx, 0, 14, 64, 4, '#141726');
    fillRect(ctx, 0, 46, 64, 4, '#141726');
    fillRect(ctx, 28, 28, 8, 8, '#1e293b');
    fillRect(ctx, 30, 30, 4, 4, '#0284c7');
  });

  const toxicTex = createCanvasTex((ctx) => {
    fillRect(ctx, 0, 0, 64, 64, '#064e1b');
    for (let y = 0; y < 64; y += 4) {
      for (let x = 0; x < 64; x += 4) {
        const n = hash2d(x, y, 99);
        if (n > 0.65) fillRect(ctx, x, y, 4, 4, '#16a34a');
        else if (n > 0.4) fillRect(ctx, x, y, 4, 4, '#22c55e');
        if (n > 0.9) fillRect(ctx, x + 1, y + 1, 2, 2, '#bef264');
      }
    }
  });

  return { floorTex, ceilingTex, toxicTex };
}

function drawHumanoidBase(
  ctx: CanvasRenderingContext2D,
  bodyCol: string,
  darkCol: string,
  visorCol: string,
  gunCol: string,
  pose: 'idle' | 'walk' | 'attack' | 'death',
  bulk = 0
) {
  if (pose === 'death') {
    // Collapsed sparking body
    fillRect(ctx, 14, 44, 36, 12, darkCol);
    fillRect(ctx, 18, 42, 26, 10, bodyCol);
    fillRect(ctx, 20, 46, 8, 4, visorCol);
    fillRect(ctx, 42, 46, 10, 4, gunCol);
    fillRect(ctx, 26, 38, 3, 3, '#facc15');
    fillRect(ctx, 36, 40, 2, 2, '#22d3ee');
    return;
  }

  const bob = pose === 'walk' ? -2 : 0;
  const legShift = pose === 'walk' ? 3 : 0;

  // Head / Helmet
  fillRect(ctx, 24 - bulk, 8 + bob, 16 + bulk * 2, 13, darkCol);
  fillRect(ctx, 25 - bulk, 10 + bob, 14 + bulk * 2, 10, bodyCol);
  // Glowing visor
  fillRect(ctx, 26 - bulk, 13 + bob, 12 + bulk * 2, 4, visorCol);
  fillRect(ctx, 28, 14 + bob, 8, 2, '#ffffff');

  // Torso & Armor
  fillRect(ctx, 18 - bulk, 21 + bob, 28 + bulk * 2, 20, darkCol);
  fillRect(ctx, 20 - bulk, 22 + bob, 24 + bulk * 2, 16, bodyCol);
  // Chest core
  fillRect(ctx, 28, 26 + bob, 8, 6, visorCol);

  // Arms & Weapon
  if (pose === 'attack') {
    fillRect(ctx, 12 - bulk, 23 + bob, 8, 12, bodyCol);
    fillRect(ctx, 44 + bulk, 22 + bob, 10, 10, bodyCol);
    // Extended gun + muzzle flash
    fillRect(ctx, 28, 24 + bob, 22, 6, gunCol);
    fillRect(ctx, 48, 21 + bob, 10, 12, '#fef08a');
    fillRect(ctx, 50, 23 + bob, 8, 8, visorCol);
  } else {
    fillRect(ctx, 13 - bulk, 22 + bob, 6, 15, bodyCol);
    fillRect(ctx, 45 + bulk, 22 + bob, 6, 15, bodyCol);
    fillRect(ctx, 38 + bulk, 29 + bob, 14, 5, gunCol);
  }

  // Legs
  fillRect(ctx, 20 - bulk, 41 + bob, 9, 17 - legShift, darkCol);
  fillRect(ctx, 35 + bulk - 2, 41 + bob + legShift, 9, 17 - legShift, darkCol);
  fillRect(ctx, 21 - bulk, 42 + bob, 7, 12 - legShift, bodyCol);
  fillRect(ctx, 36 + bulk - 2, 42 + bob + legShift, 7, 12 - legShift, bodyCol);
}

function buildEnemySprites(): TextureAtlas['enemies'] {
  const makeHumanoid = (body: string, dark: string, visor: string, gun: string, bulk = 0) => ({
    idle: createCanvasTex((c) => drawHumanoidBase(c, body, dark, visor, gun, 'idle', bulk)),
    walk: createCanvasTex((c) => drawHumanoidBase(c, body, dark, visor, gun, 'walk', bulk)),
    attack: createCanvasTex((c) => drawHumanoidBase(c, body, dark, visor, gun, 'attack', bulk)),
    death: createCanvasTex((c) => drawHumanoidBase(c, body, dark, visor, gun, 'death', bulk)),
  });

  // Assassin Drone (hovering sleek triangular chassis)
  const makeDrone = (pose: 'idle' | 'walk' | 'attack' | 'death') =>
    createCanvasTex((ctx) => {
      if (pose === 'death') {
        fillRect(ctx, 18, 46, 28, 10, '#312e81');
        fillRect(ctx, 24, 42, 12, 8, '#e879f9');
        fillRect(ctx, 20, 38, 4, 4, '#facc15');
        return;
      }
      const hover = pose === 'walk' ? -3 : 0;
      // Wings
      fillRect(ctx, 8, 22 + hover, 48, 8, '#1e1b4b');
      fillRect(ctx, 12, 24 + hover, 40, 4, '#6d28d9');
      // Center pod
      fillRect(ctx, 22, 14 + hover, 20, 20, '#312e81');
      fillRect(ctx, 26, 18 + hover, 12, 10, '#e879f9');
      fillRect(ctx, 29, 21 + hover, 6, 4, pose === 'attack' ? '#ffffff' : '#f43f5e');
      // Thruster glow
      fillRect(ctx, 26, 35 + hover, 12, 6, pose === 'attack' ? '#fef08a' : '#22d3ee');
    });

  // Heavy Mech (bulky armored walker)
  const makeMech = (pose: 'idle' | 'walk' | 'attack' | 'death') =>
    createCanvasTex((ctx) => {
      if (pose === 'death') {
        fillRect(ctx, 10, 38, 44, 20, '#18181b');
        fillRect(ctx, 16, 40, 32, 14, '#3f3f46');
        fillRect(ctx, 26, 42, 10, 8, '#f59e0b');
        fillRect(ctx, 20, 32, 5, 5, '#ef4444');
        return;
      }
      const bob = pose === 'walk' ? -2 : 0;
      // Huge shoulder chassis
      fillRect(ctx, 10, 10 + bob, 44, 28, '#27272a');
      fillRect(ctx, 14, 14 + bob, 36, 20, '#3f3f46');
      // Cockpit slit
      fillRect(ctx, 22, 14 + bob, 20, 6, '#09090b');
      fillRect(ctx, 24, 16 + bob, 16, 3, '#f59e0b');
      // Chest reactor
      fillRect(ctx, 27, 24 + bob, 10, 8, '#ea580c');
      fillRect(ctx, 29, 26 + bob, 6, 4, '#fef08a');
      // Dual rotary cannons
      fillRect(ctx, 4, 18 + bob, 8, 18, '#52525b');
      fillRect(ctx, 52, 18 + bob, 8, 18, '#52525b');
      if (pose === 'attack') {
        fillRect(ctx, 2, 34 + bob, 12, 10, '#fef08a');
        fillRect(ctx, 50, 34 + bob, 12, 10, '#fef08a');
      }
      // Heavy legs
      const ls = pose === 'walk' ? 3 : 0;
      fillRect(ctx, 14, 38 + bob, 12, 22 - ls, '#18181b');
      fillRect(ctx, 38, 38 + bob + ls, 12, 22 - ls, '#18181b');
    });

  // Mutant Experiment (hunched bio-horror with claws)
  const makeMutant = (pose: 'idle' | 'walk' | 'attack' | 'death') =>
    createCanvasTex((ctx) => {
      if (pose === 'death') {
        fillRect(ctx, 14, 44, 36, 14, '#14532d');
        fillRect(ctx, 20, 46, 22, 8, '#84cc16');
        return;
      }
      const bob = pose === 'walk' ? -3 : 0;
      // Hunched organic torso
      fillRect(ctx, 18, 14 + bob, 28, 24, '#14532d');
      fillRect(ctx, 22, 18 + bob, 20, 16, '#166534');
      // Glowing toxic veins & eyes
      fillRect(ctx, 24, 10 + bob, 16, 10, '#15803d');
      fillRect(ctx, 26, 13 + bob, 4, 3, '#bef264');
      fillRect(ctx, 34, 13 + bob, 4, 3, '#bef264');
      fillRect(ctx, 28, 22 + bob, 8, 8, '#a3e635');
      // Long claws
      const reach = pose === 'attack' ? -6 : 0;
      fillRect(ctx, 8, 18 + bob + reach, 10, 22, '#166534');
      fillRect(ctx, 46, 18 + bob + reach, 10, 22, '#166534');
      fillRect(ctx, 8, 38 + bob + reach, 8, 6, '#d9f99d');
      fillRect(ctx, 48, 38 + bob + reach, 8, 6, '#d9f99d');
      // Legs
      fillRect(ctx, 20, 38 + bob, 8, 20, '#052e16');
      fillRect(ctx, 36, 38 + bob, 8, 20, '#052e16');
    });

  // Final Boss: NEXUS AI CORE OMEGA
  const makeFinalBoss = (pose: 'idle' | 'walk' | 'attack' | 'death') =>
    createCanvasTex((ctx) => {
      if (pose === 'death') {
        fillRect(ctx, 12, 36, 40, 22, '#270515');
        fillRect(ctx, 18, 40, 28, 14, '#f43f5e');
        fillRect(ctx, 26, 30, 12, 12, '#fef08a');
        return;
      }
      const pulse = pose === 'walk' ? 2 : 0;
      // Floating monolith wings
      fillRect(ctx, 4, 8 + pulse, 12, 44, '#18181b');
      fillRect(ctx, 48, 8 + pulse, 12, 44, '#18181b');
      fillRect(ctx, 8, 12 + pulse, 4, 36, '#e11d48');
      fillRect(ctx, 52, 12 + pulse, 4, 36, '#e11d48');
      // Central AI Sphere/Core
      fillRect(ctx, 18, 10, 28, 38, '#09090b');
      fillRect(ctx, 20, 12, 24, 34, '#4c0519');
      fillRect(ctx, 24, 18, 16, 18, pose === 'attack' ? '#fda4af' : '#f43f5e');
      fillRect(ctx, 28, 22, 8, 10, '#ffffff');
      // Crown emitters
      fillRect(ctx, 20, 4, 6, 6, '#22d3ee');
      fillRect(ctx, 38, 4, 6, 6, '#22d3ee');
      if (pose === 'attack') {
        fillRect(ctx, 14, 24, 36, 6, '#fef08a');
      }
    });

  return {
    grunt: makeHumanoid('#334155', '#0f172a', '#22d3ee', '#94a3b8', 0),
    soldier: makeHumanoid('#7f1d1d', '#1e1b2e', '#f43f5e', '#cbd5e1', 1),
    drone: {
      idle: makeDrone('idle'),
      walk: makeDrone('walk'),
      attack: makeDrone('attack'),
      death: makeDrone('death'),
    },
    mech: {
      idle: makeMech('idle'),
      walk: makeMech('walk'),
      attack: makeMech('attack'),
      death: makeMech('death'),
    },
    sniper: makeHumanoid('#0f172a', '#020617', '#38bdf8', '#22d3ee', -1),
    mutant: {
      idle: makeMutant('idle'),
      walk: makeMutant('walk'),
      attack: makeMutant('attack'),
      death: makeMutant('death'),
    },
    commander: makeHumanoid('#581c87', '#1e1b4b', '#facc15', '#e879f9', 2),
    miniboss: makeHumanoid('#991b1b', '#18181b', '#fb7185', '#f59e0b', 4),
    finalboss: {
      idle: makeFinalBoss('idle'),
      walk: makeFinalBoss('walk'),
      attack: makeFinalBoss('attack'),
      death: makeFinalBoss('death'),
    },
  };
}

function buildCollectibles(): TextureAtlas['collectibles'] {
  const health = createCanvasTex((ctx) => {
    fillRect(ctx, 18, 26, 28, 24, '#e2e8f0');
    fillRect(ctx, 20, 28, 24, 20, '#f8fafc');
    fillRect(ctx, 29, 31, 6, 14, '#ef4444');
    fillRect(ctx, 25, 35, 14, 6, '#ef4444');
    fillRect(ctx, 26, 22, 12, 4, '#94a3b8');
  });

  const armor = createCanvasTex((ctx) => {
    fillRect(ctx, 18, 20, 28, 30, '#0f172a');
    fillRect(ctx, 20, 22, 24, 26, '#0284c7');
    fillRect(ctx, 24, 26, 16, 16, '#38bdf8');
    fillRect(ctx, 28, 30, 8, 8, '#bae6fd');
  });

  const ammo = createCanvasTex((ctx) => {
    fillRect(ctx, 18, 28, 28, 22, '#3f3f46');
    fillRect(ctx, 20, 30, 24, 18, '#52525b');
    fillRect(ctx, 20, 34, 24, 4, '#facc15');
    fillRect(ctx, 24, 24, 4, 6, '#eab308');
    fillRect(ctx, 30, 24, 4, 6, '#eab308');
    fillRect(ctx, 36, 24, 4, 6, '#eab308');
  });

  const damage_boost = createCanvasTex((ctx) => {
    fillRect(ctx, 24, 14, 16, 38, '#3b0764');
    fillRect(ctx, 26, 18, 12, 30, '#d946ef');
    fillRect(ctx, 28, 22, 8, 22, '#fdf4ff');
    fillRect(ctx, 22, 14, 20, 4, '#94a3b8');
    fillRect(ctx, 22, 50, 20, 4, '#94a3b8');
  });

  const secret_data = createCanvasTex((ctx) => {
    fillRect(ctx, 20, 18, 24, 32, '#042f2e');
    fillRect(ctx, 22, 20, 20, 28, '#14b8a6');
    fillRect(ctx, 26, 24, 12, 20, '#facc15');
    fillRect(ctx, 28, 28, 8, 12, '#fef08a');
  });

  const makeWeaponPickup = (accent: string, long = false) =>
    createCanvasTex((ctx) => {
      const w = long ? 44 : 32;
      const x = (64 - w) >> 1;
      fillRect(ctx, x, 30, w, 10, '#1e293b');
      fillRect(ctx, x + 2, 32, w - 4, 6, '#475569');
      fillRect(ctx, x + 6, 33, w - 12, 3, accent);
      fillRect(ctx, x + 6, 40, 8, 10, '#334155');
    });

  return {
    health,
    armor,
    ammo,
    damage_boost,
    secret_data,
    weapon_smg: makeWeaponPickup('#e879f9', false),
    weapon_shotgun: makeWeaponPickup('#fb923c', true),
    weapon_rifle: makeWeaponPickup('#38bdf8', true),
    weapon_railgun: makeWeaponPickup('#f43f5e', true),
  };
}

export function getTextureAtlas(): TextureAtlas {
  if (cachedAtlas) return cachedAtlas;
  const { walls, wallAlt4 } = buildWallTextures();
  const { floorTex, ceilingTex, toxicTex } = buildFloorAndCeiling();
  cachedAtlas = {
    walls,
    wallAlt4,
    floorTex,
    ceilingTex,
    toxicTex,
    enemies: buildEnemySprites(),
    collectibles: buildCollectibles(),
  };
  return cachedAtlas;
}

export function tintColor(packed: number, shade: number): number {
  const r = Math.min(255, ((packed & 0xff) * shade) | 0);
  const g = Math.min(255, (((packed >> 8) & 0xff) * shade) | 0);
  const b = Math.min(255, (((packed >> 16) & 0xff) * shade) | 0);
  return (0xff << 24) | (b << 16) | (g << 8) | r;
}

export function blendFog(packed: number, shade: number, fogR: number, fogG: number, fogB: number, fogFactor: number): number {
  const r0 = (packed & 0xff) * shade;
  const g0 = ((packed >> 8) & 0xff) * shade;
  const b0 = ((packed >> 16) & 0xff) * shade;
  const inv = 1 - fogFactor;
  const r = Math.min(255, (r0 * inv + fogR * fogFactor) | 0);
  const g = Math.min(255, (g0 * inv + fogG * fogFactor) | 0);
  const b = Math.min(255, (b0 * inv + fogB * fogFactor) | 0);
  return (0xff << 24) | (b << 16) | (g << 8) | r;
}

export function hexToPacked(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return packRGBA(r, g, b);
}

// Draw crisp pixel-art first-person weapon viewmodel onto the display canvas
export function drawWeaponViewmodel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  weapon: WeaponId,
  bobX: number,
  bobY: number,
  recoil: number,
  muzzleFlash: number,
  reloadProgress: number,
  damageBoost: boolean
): void {
  const scale = Math.max(2, Math.floor(w / 160));
  const reloadDrop = reloadProgress > 0 ? Math.sin(reloadProgress * Math.PI) * h * 0.28 : 0;
  const recoilPush = recoil * scale * 22;

  const cx = Math.floor(w * 0.56 + bobX * scale * 4);
  const cy = Math.floor(h - scale * 2 + bobY * scale * 4 + recoilPush + reloadDrop);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const px = (gx: number, gy: number, gw: number, gh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(cx + gx * scale, cy + gy * scale, gw * scale, gh * scale);
  };

  // Muzzle flash behind barrel
  if (muzzleFlash > 0) {
    const fSize = Math.floor(14 * muzzleFlash);
    const fCol =
      weapon === 'railgun'
        ? '#f43f5e'
        : weapon === 'shotgun'
          ? '#fb923c'
          : weapon === 'smg'
            ? '#e879f9'
            : '#22d3ee';
    px(-fSize, -44 - fSize, fSize * 2, fSize * 2, fCol);
    px(-Math.floor(fSize * 0.6), -44 - Math.floor(fSize * 0.6), Math.floor(fSize * 1.2), Math.floor(fSize * 1.2), '#fef08a');
  }

  const boostGlow = damageBoost ? '#e879f9' : null;

  if (weapon === 'pistol') {
    // Grip & hand
    px(-5, -18, 12, 20, '#1e293b');
    px(-4, -14, 10, 16, '#334155');
    // Slide
    px(-8, -36, 16, 20, '#0f172a');
    px(-6, -34, 12, 16, '#475569');
    px(-4, -38, 8, 6, '#94a3b8');
    // Cyan neon iron sight & rail
    px(-2, -37, 4, 2, boostGlow || '#22d3ee');
    px(-7, -30, 2, 10, boostGlow || '#22d3ee');
    px(5, -30, 2, 10, boostGlow || '#22d3ee');
  } else if (weapon === 'smg') {
    // Compact receiver
    px(-10, -24, 20, 26, '#1e1b4b');
    px(-8, -34, 16, 16, '#312e81');
    // Twin vents & magazine
    px(-14, -22, 4, 14, '#0f172a');
    px(-4, -40, 8, 8, '#475569');
    px(-6, -32, 12, 3, boostGlow || '#e879f9');
    px(-2, -39, 4, 3, boostGlow || '#f0abfc');
  } else if (weapon === 'shotgun') {
    // Heavy twin-barrel plasma shotgun
    px(-14, -20, 28, 24, '#1c1917');
    px(-12, -38, 24, 22, '#292524');
    // Twin barrels
    px(-10, -44, 8, 14, '#57534e');
    px(2, -44, 8, 14, '#57534e');
    // Plasma coils
    px(-8, -34, 16, 3, boostGlow || '#fb923c');
    px(-8, -28, 16, 3, boostGlow || '#fdba74');
    // Heat shield
    px(-6, -42, 12, 4, '#0c0a09');
  } else if (weapon === 'rifle') {
    // Futuristic Pulse Rifle
    px(-11, -22, 22, 26, '#0f172a');
    px(-9, -40, 18, 24, '#1e293b');
    // Optic housing
    px(-6, -44, 12, 8, '#020617');
    px(-4, -42, 8, 4, boostGlow || '#38bdf8');
    // Energy ribs along barrel
    px(-7, -34, 14, 2, boostGlow || '#38bdf8');
    px(-7, -29, 14, 2, boostGlow || '#38bdf8');
    px(-7, -24, 14, 2, boostGlow || '#38bdf8');
  } else if (weapon === 'railgun') {
    // Electromagnetic Railgun
    px(-14, -20, 28, 24, '#18181b');
    // Split magnetic rails
    px(-12, -46, 6, 30, '#3f3f46');
    px(6, -46, 6, 30, '#3f3f46');
    // Glowing core channel
    px(-4, -44, 8, 26, '#4c0519');
    px(-2, -44, 4, 26, boostGlow || '#f43f5e');
    // Capacitor coils
    for (let ry = -40; ry <= -22; ry += 6) {
      px(-10, ry, 20, 2, boostGlow || '#fda4af');
    }
  }

  ctx.restore();
}
