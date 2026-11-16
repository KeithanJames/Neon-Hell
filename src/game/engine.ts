import { audioEngine } from './audio';
import { LEVELS } from './levels';
import { RaycasterRenderer, RENDER_H, RENDER_W } from './raycaster';
import {
  BeamEffect,
  CollectibleEntity,
  DoorState,
  ENEMY_ARCHETYPES,
  EnemyEntity,
  EnemyType,
  GameHudSnapshot,
  GameScreenState,
  GameSettings,
  LevelDefinition,
  LevelSummaryStats,
  ParticleEntity,
  ProjectileEntity,
  WEAPON_ORDER,
  WeaponId,
  WEAPONS,
  WeaponState,
} from './types';

const STORAGE_HIGHSCORE = 'neon_hell_highscore_v1';
const STORAGE_UNLOCKED = 'neon_hell_unlocked_v1';
const STORAGE_SETTINGS = 'neon_hell_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  volume: 0.65,
  muted: false,
  crtScanlines: true,
  fov: 74,
  showMinimap: true,
};

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_SETTINGS };
}

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export class NeonHellEngine {
  private canvas: HTMLCanvasElement | null = null;
  private renderer = new RaycasterRenderer();
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private onHudUpdate: (snapshot: GameHudSnapshot) => void;
  private hudEmitTimer = 0;

  private screen: GameScreenState = 'TITLE_MENU';
  private settings: GameSettings = loadSettings();
  private highScore = loadNumber(STORAGE_HIGHSCORE, 0);
  private unlockedLevels = Math.max(1, Math.min(10, loadNumber(STORAGE_UNLOCKED, 1)));

  // Active level & simulation state
  private levelIndex = 0; // 0..9
  private level: LevelDefinition = LEVELS[0];
  private simTime = 0;
  private levelTime = 0;
  private totalRunTime = 0;
  private levelsCompleted = 0;
  private diedThisLevel = false;

  // Player state
  private playerX = 2.5;
  private playerY = 2.5;
  private playerAngle = 0;
  private hp = 100;
  private maxHp = 100;
  private armor = 50;
  private maxArmor = 100;
  private damageBoostTimer = 0;
  private toxicTickTimer = 0;
  private footstepTimer = 0;
  private bobPhase = 0;
  private bobX = 0;
  private bobY = 0;

  // Camera & Feel
  private cameraShake = 0;
  private hitstopTimer = 0;
  private muzzleFlash = 0;
  private weaponRecoil = 0;
  private damageFlash = 0;
  private pickupFlash = 0;
  private hitMarkerTimer = 0;
  private hitMarkerCrit = false;
  private statusToast: string | null = null;
  private statusToastTimer = 0;

  // Weapons
  private activeWeapon: WeaponId = 'pistol';
  private weapons: Record<WeaponId, WeaponState> = this.createInitialWeapons();
  private fireCooldown = 0;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadTotal = 1;

  // Scoring
  private score = 0;
  private levelStartScore = 0;
  private kills = 0;
  private totalLevelKills = 0;
  private totalEnemiesInLevel = 0;
  private killStreak = 0;
  private streakTimer = 0;
  private secretsFound = 0;
  private totalSecrets = 0;
  private levelSummary: LevelSummaryStats | null = null;

  // World entities
  private doors = new Map<string, DoorState>();
  private enemies: EnemyEntity[] = [];
  private collectibles: CollectibleEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private particles: ParticleEntity[] = [];
  private beams: BeamEffect[] = [];
  private explored: boolean[][] = [];
  private exitPos: { x: number; y: number } | null = null;
  private nextEntityId = 1;
  private interactPrompt: string | null = null;

  // Input state
  private heldKeys = new Set<string>();
  private mouseDown = false;
  private mouseJustPressed = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastDragX = 0;

  // Title background camera
  private titleTime = 0;

  constructor(onHudUpdate: (snapshot: GameHudSnapshot) => void) {
    this.onHudUpdate = onHudUpdate;
    audioEngine.setVolume(this.settings.volume);
    audioEngine.setMuted(this.settings.muted);
    this.setupWorldForLevel(0, true);
  }

  private createInitialWeapons(): Record<WeaponId, WeaponState> {
    return {
      pistol: { unlocked: true, mag: WEAPONS.pistol.magSize, reserve: -1 },
      smg: { unlocked: false, mag: WEAPONS.smg.magSize, reserve: 108 },
      shotgun: { unlocked: false, mag: WEAPONS.shotgun.magSize, reserve: 18 },
      rifle: { unlocked: false, mag: WEAPONS.rifle.magSize, reserve: 84 },
      railgun: { unlocked: false, mag: WEAPONS.railgun.magSize, reserve: 12 },
    };
  }

  public attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.width = RENDER_W;
    canvas.height = RENDER_H;
    this.bindEvents();
    this.startLoop();
    this.emitHud();
  }

  public detach(): void {
    this.stopLoop();
    this.unbindEvents();
    audioEngine.stopMusic();
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public updateSettings(patch: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...patch };
    audioEngine.setVolume(this.settings.volume);
    audioEngine.setMuted(this.settings.muted);
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    this.emitHud();
  }

  public toggleMute(): void {
    this.updateSettings({ muted: !this.settings.muted });
  }

  public setScreen(screen: GameScreenState): void {
    this.screen = screen;
    if (screen !== 'PLAYING' && document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
    if (screen === 'TITLE_MENU') {
      audioEngine.stopMusic();
      this.setupWorldForLevel(0, true);
    }
    this.emitHud();
  }

  public startNewCampaign(startLevel = 1): void {
    audioEngine.unlock();
    this.score = 0;
    this.kills = 0;
    this.totalRunTime = 0;
    this.levelsCompleted = 0;
    this.weapons = this.createInitialWeapons();
    this.activeWeapon = 'pistol';
    this.hp = 100;
    this.armor = 50;

    // If starting at a higher level from Level Select, grant era-appropriate unlocked weapons
    if (startLevel >= 2) this.weapons.smg.unlocked = true;
    if (startLevel >= 4) this.weapons.shotgun.unlocked = true;
    if (startLevel >= 5) this.weapons.rifle.unlocked = true;
    if (startLevel >= 9) this.weapons.railgun.unlocked = true;

    this.loadLevel(startLevel - 1);
  }

  public loadLevel(idx: number): void {
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, idx));
    this.setupWorldForLevel(this.levelIndex, false);
    this.screen = 'LEVEL_INTRO';
    audioEngine.playLevelTransition(false);
    this.emitHud();
  }

  public beginLevelPlay(): void {
    audioEngine.unlock();
    this.screen = 'PLAYING';
    audioEngine.startMusic(this.level.isBossLevel);
    this.requestLock();
    this.emitHud();
  }

  public resumeGame(): void {
    audioEngine.unlock();
    this.screen = 'PLAYING';
    audioEngine.startMusic(this.level.isBossLevel);
    this.requestLock();
    this.emitHud();
  }

  public pauseGame(): void {
    if (this.screen === 'PLAYING') {
      this.screen = 'PAUSED';
      this.heldKeys.clear();
      this.mouseDown = false;
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock?.();
      }
      this.emitHud();
    }
  }

  public restartCurrentLevel(): void {
    audioEngine.unlock();
    // Restore score to start of level, reset player vitals if dead
    this.score = this.levelStartScore;
    if (this.hp <= 0) {
      this.hp = 100;
      this.armor = 50;
    }
    this.setupWorldForLevel(this.levelIndex, false);
    this.screen = 'PLAYING';
    audioEngine.startMusic(this.level.isBossLevel);
    this.requestLock();
    this.emitHud();
  }

  public proceedToNextLevel(): void {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.screen = 'VICTORY';
      audioEngine.stopMusic();
      audioEngine.playLevelTransition(true);
      this.emitHud();
    } else {
      this.loadLevel(this.levelIndex + 1);
    }
  }

  public requestLock(): void {
    if (this.canvas && this.screen === 'PLAYING') {
      try {
        const res = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch {
        // Ignore if browser/iframe blocks pointer lock; fallback look still works
      }
    }
  }

  private setupWorldForLevel(idx: number, isPreview: boolean): void {
    const def = LEVELS[idx];
    this.level = def;
    this.simTime = 0;
    this.levelTime = 0;
    this.diedThisLevel = false;
    this.levelStartScore = this.score;
    this.totalLevelKills = 0;
    this.killStreak = 0;
    this.streakTimer = 0;
    this.secretsFound = 0;
    this.damageBoostTimer = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.muzzleFlash = 0;
    this.weaponRecoil = 0;
    this.damageFlash = 0;
    this.pickupFlash = 0;
    this.hitMarkerTimer = 0;
    this.cameraShake = 0;
    this.hitstopTimer = 0;
    this.statusToast = null;
    this.statusToastTimer = 0;
    this.levelSummary = null;

    if (!isPreview) {
      // Carry over health/armor (ensure at least 100 HP / 50 Armor at start of each level if low)
      this.hp = Math.max(this.hp, 100);
      this.armor = Math.max(this.armor, 50);
    }

    this.playerX = def.playerStart.x;
    this.playerY = def.playerStart.y;
    this.playerAngle = def.playerStart.angle;

    // Doors & Exit & Explored grid
    this.doors.clear();
    this.exitPos = null;
    const h = def.grid.length;
    const w = def.grid[0].length;
    this.explored = Array.from({ length: h }, () => Array(w).fill(false));

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = def.grid[y][x];
        if (t === 8 || t === 10) {
          this.doors.set(`${x},${y}`, {
            tx: x,
            ty: y,
            openAmount: 0,
            opening: false,
            autoCloseTimer: 0,
            isSecret: t === 10,
          });
        } else if (t === 9) {
          this.exitPos = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }

    // Spawn Enemies
    this.enemies = def.enemies.map((sp) => {
      const arch = ENEMY_ARCHETYPES[sp.type];
      const scaledHp = Math.round(arch.baseHp * def.hpMultiplier);
      return {
        id: this.nextEntityId++,
        type: sp.type,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        hp: scaledHp,
        maxHp: scaledHp,
        speed: arch.baseSpeed * def.speedMultiplier,
        damage: Math.round(arch.baseDamage * def.damageMultiplier),
        state: 'idle',
        stateTimer: 0,
        cooldownTimer: 0.4 + Math.random() * 0.6,
        animTimer: Math.random() * 4,
        hurtFlash: 0,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        alerted: false,
        phase: 1,
        lastSeenX: sp.x,
        lastSeenY: sp.y,
      };
    });
    this.totalEnemiesInLevel = this.enemies.length;

    // Spawn Collectibles
    this.collectibles = def.collectibles.map((c, i) => ({
      id: this.nextEntityId++,
      type: c.type,
      x: c.x,
      y: c.y,
      collected: false,
      bobOffset: i * 0.9,
    }));
    this.totalSecrets = this.collectibles.filter((c) => c.type === 'secret_data').length;

    this.projectiles = [];
    this.particles = [];
    this.beams = [];
    this.revealExplored(this.playerX, this.playerY);
  }

  private revealExplored(px: number, py: number): void {
    const cx = px | 0;
    const cy = py | 0;
    const rad = 4;
    const h = this.explored.length;
    const w = this.explored[0]?.length || 0;
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad + 2) continue;
        const ny = cy + dy;
        const nx = cx + dx;
        if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
          this.explored[ny][nx] = true;
        }
      }
    }
  }

  // Event listeners
  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (code === 'Escape' || code === 'KeyP') {
      if (this.screen === 'PLAYING') {
        e.preventDefault();
        this.pauseGame();
        return;
      } else if (this.screen === 'PAUSED') {
        e.preventDefault();
        this.resumeGame();
        return;
      }
    }

    if (this.screen !== 'PLAYING') return;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }

    this.heldKeys.add(code);

    if (code === 'KeyR') this.startReload();
    if (code === 'KeyE') this.tryInteract();
    if (code === 'Digit1') this.switchWeapon('pistol');
    if (code === 'Digit2') this.switchWeapon('smg');
    if (code === 'Digit3') this.switchWeapon('shotgun');
    if (code === 'Digit4') this.switchWeapon('rifle');
    if (code === 'Digit5') this.switchWeapon('railgun');
    if (code === 'Space') this.mouseJustPressed = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.mouseDown = false;
    this.isDraggingLook = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.screen !== 'PLAYING') return;
    const sens = 0.0024 * this.settings.mouseSensitivity;
    if (document.pointerLockElement === this.canvas) {
      this.playerAngle += e.movementX * sens;
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastDragX;
      this.lastDragX = e.clientX;
      this.playerAngle += dx * sens * 1.6;
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.screen !== 'PLAYING') return;
    if (e.button === 0) {
      audioEngine.unlock();
      if (document.pointerLockElement !== this.canvas) {
        this.requestLock();
        this.isDraggingLook = true;
        this.lastDragX = e.clientX;
      }
      this.mouseDown = true;
      this.mouseJustPressed = true;
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseDown = false;
      this.isDraggingLook = false;
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.screen !== 'PLAYING') return;
    const unlocked = WEAPON_ORDER.filter((id) => this.weapons[id].unlocked);
    if (unlocked.length <= 1) return;
    const curIdx = unlocked.indexOf(this.activeWeapon);
    const dir = e.deltaY > 0 ? 1 : -1;
    const nextIdx = (curIdx + dir + unlocked.length) % unlocked.length;
    this.switchWeapon(unlocked[nextIdx]);
  };

  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    this.emitHud();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvas?.addEventListener('mousedown', this.handleMouseDown);
    this.canvas?.addEventListener('wheel', this.handleWheel, { passive: true });
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvas?.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas?.removeEventListener('wheel', this.handleWheel);
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt);
      this.renderFrame();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private update(dt: number): void {
    // Title / Menu live background patrol
    if (
      this.screen === 'TITLE_MENU' ||
      this.screen === 'LEVEL_SELECT' ||
      this.screen === 'INSTRUCTIONS' ||
      this.screen === 'SETTINGS'
    ) {
      this.titleTime += dt;
      // Gentle corridor patrol preview
      this.playerX = 4.2 + Math.sin(this.titleTime * 0.25) * 1.2;
      this.playerY = 1.6 + Math.cos(this.titleTime * 0.18) * 0.25;
      this.playerAngle = Math.sin(this.titleTime * 0.22) * 0.55;
      return;
    }

    if (this.screen !== 'PLAYING') return;

    this.simTime += dt;

    // Hitstop freeze for heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    this.levelTime += dt;
    this.totalRunTime += dt;

    // Decay timers
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 11);
    if (this.weaponRecoil > 0) this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 4.5);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
    if (this.pickupFlash > 0) this.pickupFlash = Math.max(0, this.pickupFlash - dt * 3.0);
    if (this.hitMarkerTimer > 0) this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 24);
    if (this.damageBoostTimer > 0) this.damageBoostTimer = Math.max(0, this.damageBoostTimer - dt);
    if (this.statusToastTimer > 0) {
      this.statusToastTimer -= dt;
      if (this.statusToastTimer <= 0) this.statusToast = null;
    }
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) this.killStreak = 0;
    }

    // Reload progress
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }

    this.updatePlayerMovement(dt);
    this.updateWeapons(dt);
    this.updateDoors(dt);
    this.updateCollectibles();
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateBeams(dt);
    this.checkInteractPrompt();

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.05) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private updatePlayerMovement(dt: number): void {
    const turnSpeed = 2.4;
    if (this.heldKeys.has('ArrowLeft')) this.playerAngle -= turnSpeed * dt;
    if (this.heldKeys.has('ArrowRight')) this.playerAngle += turnSpeed * dt;

    let moveForward = 0;
    let moveStrafe = 0;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveForward += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveForward -= 1;
    if (this.heldKeys.has('KeyD')) moveStrafe += 1;
    if (this.heldKeys.has('KeyA')) moveStrafe -= 1;

    const isSprinting = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');
    const baseSpeed = isSprinting ? 5.1 : 3.35;

    const cos = Math.cos(this.playerAngle);
    const sin = Math.sin(this.playerAngle);

    let vx = cos * moveForward - sin * moveStrafe;
    let vy = sin * moveForward + cos * moveStrafe;
    const len = Math.hypot(vx, vy);
    if (len > 0.001) {
      vx = (vx / len) * baseSpeed;
      vy = (vy / len) * baseSpeed;

      this.bobPhase += dt * (isSprinting ? 14 : 10);
      this.bobX = Math.cos(this.bobPhase * 0.5) * 0.8;
      this.bobY = Math.abs(Math.sin(this.bobPhase)) * 1.1;

      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        audioEngine.playFootstep();
        this.footstepTimer = isSprinting ? 0.28 : 0.4;
      }
    } else {
      this.bobX *= 0.85;
      this.bobY *= 0.85;
    }

    const r = 0.26;
    const nextX = this.playerX + vx * dt;
    if (!this.collidesWall(nextX, this.playerY, r)) {
      this.playerX = nextX;
    }
    const nextY = this.playerY + vy * dt;
    if (!this.collidesWall(this.playerX, nextY, r)) {
      this.playerY = nextY;
    }

    this.revealExplored(this.playerX, this.playerY);

    // Toxic floor hazard check (Tile 11)
    const tx = this.playerX | 0;
    const ty = this.playerY | 0;
    if (
      ty >= 0 &&
      ty < this.level.grid.length &&
      tx >= 0 &&
      tx < this.level.grid[0].length &&
      this.level.grid[ty][tx] === 11
    ) {
      this.toxicTickTimer -= dt;
      if (this.toxicTickTimer <= 0) {
        this.toxicTickTimer = 0.65;
        this.damagePlayer(8, 'TOXIC HAZARD');
      }
    } else {
      this.toxicTickTimer = 0.15;
    }
  }

  private collidesWall(x: number, y: number, radius: number): boolean {
    const grid = this.level.grid;
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length) return true;
        const tile = grid[gy][gx];
        if (tile === 0 || tile === 11) continue;
        if (tile === 8 || tile === 10) {
          const d = this.doors.get(`${gx},${gy}`);
          if (d && d.openAmount > 0.75) continue;
        }
        return true;
      }
    }
    return false;
  }

  public switchWeapon(id: WeaponId): void {
    if (!this.weapons[id].unlocked || this.activeWeapon === id) return;
    this.activeWeapon = id;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0.18;
    this.emitHud();
  }

  private startReload(): void {
    if (this.isReloading) return;
    const def = WEAPONS[this.activeWeapon];
    const st = this.weapons[this.activeWeapon];
    if (st.mag >= def.magSize) return;
    if (def.maxReserve !== -1 && st.reserve <= 0) return;

    this.isReloading = true;
    this.reloadTotal = def.reloadTime;
    this.reloadTimer = def.reloadTime;
    audioEngine.playReload();
    this.emitHud();
  }

  private finishReload(): void {
    this.isReloading = false;
    const def = WEAPONS[this.activeWeapon];
    const st = this.weapons[this.activeWeapon];
    if (def.maxReserve === -1) {
      st.mag = def.magSize;
    } else {
      const needed = def.magSize - st.mag;
      const take = Math.min(needed, st.reserve);
      st.mag += take;
      st.reserve -= take;
    }
    this.emitHud();
  }

  private updateWeapons(_dt: number): void {
    const def = WEAPONS[this.activeWeapon];
    const st = this.weapons[this.activeWeapon];
    const wantsFire = def.automatic
      ? this.mouseDown || this.heldKeys.has('Space')
      : this.mouseJustPressed;
    this.mouseJustPressed = false;

    if (!wantsFire || this.isReloading || this.fireCooldown > 0) return;

    if (st.mag <= 0) {
      if (def.maxReserve === -1 || st.reserve > 0) {
        this.startReload();
      } else {
        audioEngine.playEmptyClick();
        this.fireCooldown = 0.25;
        // Auto-switch to pistol or available weapon if totally dry
        this.showToast('OUT OF AMMO — PRESS [1] FOR CYBER PISTOL');
      }
      return;
    }

    // Fire weapon!
    st.mag--;
    this.fireCooldown = 1 / def.fireRate;
    this.muzzleFlash = 1.0;
    this.weaponRecoil = Math.min(1.0, this.weaponRecoil + def.recoil * 4.5);
    this.cameraShake = Math.max(this.cameraShake, def.recoil * 16);
    audioEngine.playWeaponFire(this.activeWeapon);

    // Alert nearby enemies on gunshot
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'dying') continue;
      if (Math.hypot(e.x - this.playerX, e.y - this.playerY) < 12) {
        e.alerted = true;
      }
    }

    const boostMult = this.damageBoostTimer > 0 ? 1.75 : 1.0;

    for (let p = 0; p < def.pellets; p++) {
      const spreadOffset = (Math.random() - 0.5) * 2 * def.spread;
      const rayAngle = this.playerAngle + spreadOffset;
      this.fireHitscanRay(
        rayAngle,
        def.damage * boostMult,
        def.range,
        def.piercing,
        def.color
      );
    }

    if (st.mag === 0 && (def.maxReserve === -1 || st.reserve > 0)) {
      this.startReload();
    }
  }

  private fireHitscanRay(
    angle: number,
    damage: number,
    maxRange: number,
    piercing: boolean,
    beamColor: string
  ): void {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    // First find wall distance
    let wallDist = maxRange;
    const stepSize = 0.04;
    for (let d = 0.1; d < maxRange; d += stepSize) {
      const rx = this.playerX + dirX * d;
      const ry = this.playerY + dirY * d;
      if (this.collidesWall(rx, ry, 0.02)) {
        wallDist = d;
        // Spawn wall impact spark
        this.spawnSparks(rx - dirX * 0.05, ry - dirY * 0.05, 0, beamColor, 4);
        break;
      }
    }

    // Check intersections with alive enemies sorted near-to-far
    const candidates = this.enemies
      .filter((e) => e.state !== 'dead' && e.state !== 'dying')
      .map((e) => {
        const dx = e.x - this.playerX;
        const dy = e.y - this.playerY;
        const proj = dx * dirX + dy * dirY;
        const perp = Math.abs(dx * -dirY + dy * dirX);
        return { enemy: e, proj, perp };
      })
      .filter((c) => {
        const arch = ENEMY_ARCHETYPES[c.enemy.type];
        return c.proj > 0.15 && c.proj < wallDist && c.perp <= arch.radius * 1.15;
      })
      .sort((a, b) => a.proj - b.proj);

    let hitAny = false;
    for (const c of candidates) {
      const arch = ENEMY_ARCHETYPES[c.enemy.type];
      const isCrit = c.perp <= arch.radius * 0.36;
      const finalDmg = Math.round(damage * (isCrit ? 1.5 : 1.0));
      this.damageEnemy(c.enemy, finalDmg, isCrit);
      hitAny = true;

      const hitX = this.playerX + dirX * c.proj;
      const hitY = this.playerY + dirY * c.proj;
      this.spawnSparks(hitX, hitY, 0.05, isCrit ? '#facc15' : arch.accentColor, isCrit ? 10 : 6);

      if (!piercing) break;
    }

    if (piercing || (!hitAny && this.activeWeapon === 'rifle')) {
      this.beams.push({
        x1: this.playerX + dirX * 0.35,
        y1: this.playerY + dirY * 0.35,
        x2: this.playerX + dirX * wallDist,
        y2: this.playerY + dirY * wallDist,
        color: beamColor,
        life: piercing ? 0.24 : 0.07,
        maxLife: piercing ? 0.24 : 0.07,
      });
    }
  }

  private damageEnemy(enemy: EnemyEntity, dmg: number, isCrit: boolean): void {
    enemy.hp -= dmg;
    enemy.hurtFlash = 0.1;
    enemy.alerted = true;
    this.hitMarkerTimer = 0.15;
    this.hitMarkerCrit = isCrit;
    audioEngine.playHitMarker(isCrit);

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.state = 'dying';
      enemy.stateTimer = 0.45;
      const arch = ENEMY_ARCHETYPES[enemy.type];
      const isBoss = arch.tier === 'boss';
      audioEngine.playEnemyDeath(isBoss);
      this.spawnSparks(enemy.x, enemy.y, 0.1, arch.accentColor, isBoss ? 36 : 16);

      // Hitstop on heavy / railgun / boss kills
      if (isBoss || this.activeWeapon === 'railgun' || this.activeWeapon === 'shotgun') {
        this.hitstopTimer = isBoss ? 0.075 : 0.035;
      }

      this.kills++;
      this.totalLevelKills++;
      this.killStreak++;
      this.streakTimer = 4.5;

      const mult = this.getStreakMultiplier();
      const critBonus = isCrit ? 50 : 0;
      const pts = Math.round((arch.points + critBonus) * mult);
      this.addScore(pts);

      if (isBoss) {
        this.showToast(`${arch.name} DESTROYED! +${pts} PTS`);
      }
    }
  }

  private getStreakMultiplier(): number {
    if (this.killStreak >= 8) return 4;
    if (this.killStreak >= 5) return 3;
    if (this.killStreak >= 3) return 2;
    if (this.killStreak >= 2) return 1.5;
    return 1;
  }

  private addScore(pts: number): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem(STORAGE_HIGHSCORE, String(this.highScore));
      } catch {
        // ignore
      }
    }
  }

  private updateDoors(dt: number): void {
    for (const door of this.doors.values()) {
      if (door.opening) {
        door.openAmount = Math.min(1, door.openAmount + dt * 2.2);
        if (door.openAmount >= 1 && !door.isSecret) {
          door.autoCloseTimer -= dt;
          if (door.autoCloseTimer <= 0) {
            // Only auto-close if player and enemies are not standing in doorway
            const dx = this.playerX - (door.tx + 0.5);
            const dy = this.playerY - (door.ty + 0.5);
            if (Math.hypot(dx, dy) > 1.3) {
              door.opening = false;
            } else {
              door.autoCloseTimer = 1.5;
            }
          }
        }
      } else if (!door.isSecret) {
        door.openAmount = Math.max(0, door.openAmount - dt * 1.8);
      }
    }
  }

  private tryInteract(): void {
    const dirX = Math.cos(this.playerAngle);
    const dirY = Math.sin(this.playerAngle);

    // Check tiles in front of player (0.6..1.8 units)
    for (let dist = 0.6; dist <= 1.8; dist += 0.25) {
      const tx = (this.playerX + dirX * dist) | 0;
      const ty = (this.playerY + dirY * dist) | 0;
      const tile = this.level.grid[ty]?.[tx];

      if (tile === 8 || tile === 10) {
        const door = this.doors.get(`${tx},${ty}`);
        if (door && !door.opening) {
          door.opening = true;
          door.autoCloseTimer = 4.5;
          audioEngine.playDoor();
          if (door.isSecret) {
            this.showToast('SECRET PASSAGE DISCOVERED!');
            audioEngine.playPickup(true);
          }
          return;
        }
      }

      if (tile === 9) {
        this.attemptExitLevel();
        return;
      }
    }
  }

  private checkInteractPrompt(): void {
    const dirX = Math.cos(this.playerAngle);
    const dirY = Math.sin(this.playerAngle);
    let prompt: string | null = null;

    for (let dist = 0.6; dist <= 1.85; dist += 0.25) {
      const tx = (this.playerX + dirX * dist) | 0;
      const ty = (this.playerY + dirY * dist) | 0;
      const tile = this.level.grid[ty]?.[tx];

      if (tile === 8) {
        const door = this.doors.get(`${tx},${ty}`);
        if (door && door.openAmount < 0.5) {
          prompt = '[E] OPEN SECURITY DOOR';
          break;
        }
      } else if (tile === 10) {
        const door = this.doors.get(`${tx},${ty}`);
        if (door && door.openAmount < 0.5) {
          prompt = '[E] PUSH SUSPICIOUS PANEL';
          break;
        }
      } else if (tile === 9) {
        const rem = this.getRemainingEnemies();
        prompt =
          rem === 0
            ? '[E] ENTER EXIT AIRLOCK'
            : `EXIT LOCKED — ELIMINATE ${rem} HOSTILE${rem > 1 ? 'S' : ''}`;
        break;
      }
    }

    // Also allow auto-trigger if standing right next to exit and all enemies cleared
    if (this.exitPos && this.getRemainingEnemies() === 0) {
      const d = Math.hypot(this.playerX - this.exitPos.x, this.playerY - this.exitPos.y);
      if (d < 1.15) {
        this.attemptExitLevel();
        return;
      }
    }

    this.interactPrompt = prompt;
  }

  private getRemainingEnemies(): number {
    return this.enemies.filter((e) => e.state !== 'dead' && e.state !== 'dying').length;
  }

  private attemptExitLevel(): void {
    const rem = this.getRemainingEnemies();
    if (rem > 0) {
      this.showToast(`ELIMINATE ${rem} REMAINING HOSTILE${rem > 1 ? 'S' : ''} TO UNLOCK EXIT`);
      return;
    }

    // Level completed!
    this.levelsCompleted++;
    const nextUnlock = Math.min(10, this.levelIndex + 2);
    if (nextUnlock > this.unlockedLevels) {
      this.unlockedLevels = nextUnlock;
      try {
        localStorage.setItem(STORAGE_UNLOCKED, String(this.unlockedLevels));
      } catch {
        // ignore
      }
    }

    const parTime = 95 + this.levelIndex * 18;
    const timeBonus = Math.max(100, Math.round(Math.max(0, parTime - this.levelTime) * 15));
    const survivalBonus = this.diedThisLevel ? 0 : 1000;
    this.addScore(timeBonus + survivalBonus);

    this.levelSummary = {
      levelNumber: this.level.levelNumber,
      levelName: this.level.name,
      kills: this.totalLevelKills,
      totalEnemies: this.totalEnemiesInLevel,
      timeSeconds: this.levelTime,
      timeBonus,
      survivalBonus,
      secretsFound: this.secretsFound,
      totalSecrets: this.totalSecrets,
      scoreEarned: this.score - this.levelStartScore,
      totalScore: this.score,
    };

    this.heldKeys.clear();
    this.mouseDown = false;
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }

    if (this.levelIndex + 1 >= LEVELS.length) {
      this.screen = 'VICTORY';
      audioEngine.stopMusic();
      audioEngine.playLevelTransition(true);
    } else {
      this.screen = 'LEVEL_COMPLETE';
      audioEngine.playLevelTransition(false);
    }
    this.emitHud();
  }

  private updateCollectibles(): void {
    for (const c of this.collectibles) {
      if (c.collected) continue;
      if (Math.hypot(c.x - this.playerX, c.y - this.playerY) > 0.72) continue;

      let picked = false;
      let isSpecial = false;

      if (c.type === 'health') {
        if (this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + 25);
          this.showToast('+25 HEALTH');
          picked = true;
        }
      } else if (c.type === 'armor') {
        if (this.armor < this.maxArmor) {
          this.armor = Math.min(this.maxArmor, this.armor + 25);
          this.showToast('+25 ARMOR');
          picked = true;
        }
      } else if (c.type === 'ammo') {
        for (const wId of WEAPON_ORDER) {
          const def = WEAPONS[wId];
          const st = this.weapons[wId];
          if (st.unlocked && def.maxReserve !== -1) {
            st.reserve = Math.min(def.maxReserve, st.reserve + def.magSize * 2);
          }
        }
        this.showToast('AMMUNITION REPLENISHED');
        picked = true;
      } else if (c.type === 'damage_boost') {
        this.damageBoostTimer = 15.0;
        this.showToast('OVERCHARGE CELL: 1.75X DAMAGE (15s)');
        picked = true;
        isSpecial = true;
      } else if (c.type === 'secret_data') {
        this.secretsFound++;
        this.addScore(300);
        this.showToast('SECRET DATA CORE! +300 PTS');
        picked = true;
        isSpecial = true;
      } else if (c.type.startsWith('weapon_')) {
        const wId = c.type.replace('weapon_', '') as WeaponId;
        const def = WEAPONS[wId];
        const st = this.weapons[wId];
        const firstUnlock = !st.unlocked;
        st.unlocked = true;
        st.mag = def.magSize;
        if (def.maxReserve !== -1) {
          st.reserve = Math.min(def.maxReserve, st.reserve + def.magSize * 2);
        }
        if (firstUnlock) {
          this.activeWeapon = wId;
          this.isReloading = false;
        }
        this.showToast(`WEAPON ACQUIRED: ${def.name.toUpperCase()}`);
        picked = true;
        isSpecial = true;
      }

      if (picked) {
        c.collected = true;
        this.pickupFlash = 0.85;
        audioEngine.playPickup(isSpecial);
      }
    }
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) return true;
    const steps = Math.ceil(dist / 0.25);
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 1; i < steps; i++) {
      const px = x1 + sx * i;
      const py = y1 + sy * i;
      if (this.collidesWall(px, py, 0.04)) return false;
    }
    return true;
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      if (e.hurtFlash > 0) e.hurtFlash = Math.max(0, e.hurtFlash - dt);

      if (e.state === 'dying') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.state = 'dead';
        }
        continue;
      }

      e.animTimer += dt;
      if (e.cooldownTimer > 0) e.cooldownTimer -= dt;

      const arch = ENEMY_ARCHETYPES[e.type];
      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const dist = Math.hypot(dx, dy);
      const canSee = dist < 19 && this.hasLineOfSight(e.x, e.y, this.playerX, this.playerY);

      if (canSee) {
        e.alerted = true;
        e.lastSeenX = this.playerX;
        e.lastSeenY = this.playerY;

        // Elite Commander alerts nearby allies
        if (e.type === 'commander') {
          for (const ally of this.enemies) {
            if (!ally.alerted && Math.hypot(ally.x - e.x, ally.y - e.y) < 7) {
              ally.alerted = true;
              ally.lastSeenX = this.playerX;
              ally.lastSeenY = this.playerY;
            }
          }
        }
      }

      // Boss multi-phase triggers
      if (e.type === 'miniboss' && e.phase === 1 && e.hp <= e.maxHp * 0.5) {
        e.phase = 2;
        e.speed *= 1.25;
        this.showToast('WARDEN-05 ENTERED OVERDRIVE PHASE!');
      } else if (e.type === 'finalboss') {
        if (e.phase === 1 && e.hp <= e.maxHp * 0.66) {
          e.phase = 2;
          this.showToast('NEXUS AI CORE PHASE 2 — DRONE SWARM DEPLOYED!');
          this.summonBossDrones(e.x, e.y);
        } else if (e.phase === 2 && e.hp <= e.maxHp * 0.33) {
          e.phase = 3;
          e.speed *= 1.25;
          this.showToast('NEXUS AI CORE CRITICAL — MAXIMUM OVERLOAD!');
        }
      }

      if (!e.alerted) {
        e.state = 'idle';
        continue;
      }

      // Windup -> Attack telegraphing
      if (e.state === 'windup') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          this.executeEnemyAttack(e);
          e.state = 'attack';
          e.stateTimer = 0.18;
          e.cooldownTimer = arch.attackCooldown * (e.phase >= 2 ? 0.78 : 1.0);
        }
        continue;
      }

      if (e.state === 'attack') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.state = 'chase';
        }
        continue;
      }

      // Trigger attack if in range & visible
      if (canSee && dist <= arch.attackRange && e.cooldownTimer <= 0) {
        e.state = 'windup';
        e.stateTimer = arch.windupTime;
        continue;
      }

      // AI Movement: Chase, Strafe, or Sniper Retreat
      let desiredAngle = Math.atan2(e.lastSeenY - e.y, e.lastSeenX - e.x);
      let moveSpeed = e.speed;

      if (canSee && !arch.isMelee) {
        if (e.type === 'sniper' && dist < arch.preferredRange * 0.65) {
          // Sniper backs away when player gets too close
          desiredAngle += Math.PI;
        } else if (dist < arch.preferredRange) {
          // Strafe tactically
          e.state = 'strafe';
          if (Math.random() < dt * 0.8) e.strafeDir *= -1;
          desiredAngle += (Math.PI * 0.5) * e.strafeDir;
          moveSpeed *= 0.85;
        } else {
          e.state = 'chase';
          if (e.type === 'drone' || e.type === 'soldier' || e.type === 'commander') {
            desiredAngle += 0.35 * e.strafeDir;
          }
        }
      } else {
        e.state = 'chase';
      }

      // Steering probe to slide smoothly around walls/doors
      const offsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35];
      for (const off of offsets) {
        const testAngle = desiredAngle + off;
        const nx = e.x + Math.cos(testAngle) * moveSpeed * dt;
        const ny = e.y + Math.sin(testAngle) * moveSpeed * dt;
        if (!this.collidesWall(nx, ny, arch.radius) && Math.hypot(nx - this.playerX, ny - this.playerY) > arch.radius + 0.3) {
          e.x = nx;
          e.y = ny;
          break;
        }
      }
    }
  }

  private summonBossDrones(bx: number, by: number): void {
    const offsets = [
      [-1.5, 0],
      [1.5, 0],
    ];
    for (const [ox, oy] of offsets) {
      const sx = bx + ox;
      const sy = by + oy;
      if (this.collidesWall(sx, sy, 0.25)) continue;
      const arch = ENEMY_ARCHETYPES.drone;
      this.enemies.push({
        id: this.nextEntityId++,
        type: 'drone',
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        hp: arch.baseHp,
        maxHp: arch.baseHp,
        speed: arch.baseSpeed * 1.1,
        damage: arch.baseDamage,
        state: 'chase',
        stateTimer: 0,
        cooldownTimer: 0.6,
        animTimer: 0,
        hurtFlash: 0,
        strafeDir: 1,
        alerted: true,
        phase: 1,
        lastSeenX: this.playerX,
        lastSeenY: this.playerY,
      });
      this.totalEnemiesInLevel++;
      this.spawnSparks(sx, sy, 0.2, '#e879f9', 14);
    }
  }

  private executeEnemyAttack(e: EnemyEntity): void {
    const arch = ENEMY_ARCHETYPES[e.type];
    const dist = Math.hypot(this.playerX - e.x, this.playerY - e.y);

    if (arch.isMelee) {
      if (dist <= arch.attackRange + 0.4) {
        this.damagePlayer(e.damage, arch.name);
        audioEngine.playEnemyShoot(true);
      }
      return;
    }

    const baseAngle = Math.atan2(this.playerY - e.y, this.playerX - e.x);
    audioEngine.playEnemyShoot(arch.tier === 'heavy' || arch.tier === 'boss');

    const spawnBolt = (ang: number, spd: number, dmg: number, color: string) => {
      this.projectiles.push({
        id: this.nextEntityId++,
        x: e.x + Math.cos(ang) * 0.35,
        y: e.y + Math.sin(ang) * 0.35,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        damage: dmg,
        fromPlayer: false,
        color,
        radius: 0.18,
        life: 3.5,
      });
    };

    if (e.type === 'sniper') {
      // Sniper laser trace + high-velocity bolt
      this.beams.push({
        x1: e.x,
        y1: e.y,
        x2: this.playerX,
        y2: this.playerY,
        color: '#38bdf8',
        life: 0.16,
        maxLife: 0.16,
      });
      spawnBolt(baseAngle, arch.projectileSpeed, e.damage, '#38bdf8');
    } else if (e.type === 'commander' || (e.type === 'miniboss' && e.phase >= 2)) {
      for (const spread of [-0.14, 0, 0.14]) {
        spawnBolt(baseAngle + spread, arch.projectileSpeed, e.damage, arch.accentColor);
      }
    } else if (e.type === 'finalboss') {
      const fan = e.phase === 3 ? [-0.36, -0.18, 0, 0.18, 0.36] : [-0.22, 0, 0.22];
      for (const spread of fan) {
        spawnBolt(baseAngle + spread, arch.projectileSpeed + e.phase, e.damage, '#ff007f');
      }
    } else {
      const inaccuracy = (Math.random() - 0.5) * 0.08;
      spawnBolt(baseAngle + inaccuracy, arch.projectileSpeed, e.damage, arch.accentColor);
    }
  }

  private damagePlayer(rawDmg: number, _source: string): void {
    if (this.screen !== 'PLAYING') return;
    let remaining = rawDmg;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, Math.ceil(rawDmg * 0.6));
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    this.hp = Math.max(0, this.hp - remaining);
    this.damageFlash = 1.0;
    this.cameraShake = Math.max(this.cameraShake, 9.5);
    audioEngine.playPlayerHurt();

    if (this.hp <= 0) {
      this.diedThisLevel = true;
      this.screen = 'GAME_OVER';
      this.heldKeys.clear();
      this.mouseDown = false;
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock?.();
      }
      this.emitHud();
    }
  }

  private updateProjectiles(dt: number): void {
    const next: ProjectileEntity[] = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.life <= 0) continue;

      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;

      if (this.collidesWall(nx, ny, 0.06)) {
        this.spawnSparks(p.x, p.y, 0, p.color, 5);
        continue;
      }

      if (!p.fromPlayer && Math.hypot(nx - this.playerX, ny - this.playerY) < 0.34) {
        this.damagePlayer(p.damage, 'ENEMY FIRE');
        this.spawnSparks(nx, ny, 0, p.color, 6);
        continue;
      }

      p.x = nx;
      p.y = ny;
      next.push(p);
    }
    this.projectiles = next;
  }

  private spawnSparks(x: number, y: number, z: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 160) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 2.8;
      this.particles.push({
        x,
        y,
        z: z + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vz: (Math.random() - 0.2) * 2.0,
        color,
        size: 3 + Math.random() * 4,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
      });
    }
  }

  private updateParticles(dt: number): void {
    const next: ParticleEntity[] = [];
    for (const pt of this.particles) {
      pt.life -= dt;
      if (pt.life <= 0) continue;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vz -= 5.5 * dt;
      next.push(pt);
    }
    this.particles = next;
  }

  private updateBeams(dt: number): void {
    const next: BeamEffect[] = [];
    for (const b of this.beams) {
      b.life -= dt;
      if (b.life > 0) next.push(b);
    }
    this.beams = next;
  }

  private showToast(msg: string): void {
    this.statusToast = msg;
    this.statusToastTimer = 2.6;
  }

  private renderFrame(): void {
    if (!this.canvas) return;
    const isPreview =
      this.screen === 'TITLE_MENU' ||
      this.screen === 'LEVEL_SELECT' ||
      this.screen === 'INSTRUCTIONS' ||
      this.screen === 'SETTINGS';

    const shakeY = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake : 0;
    const reloadProgress = this.isReloading
      ? 1 - Math.max(0, this.reloadTimer / this.reloadTotal)
      : 0;

    this.renderer.render(this.canvas, {
      level: this.level,
      playerX: this.playerX,
      playerY: this.playerY,
      playerAngle: this.playerAngle,
      pitchOffset: shakeY + this.bobY * 2.2,
      fovDeg: this.settings.fov,
      time: isPreview ? this.titleTime : this.simTime,
      muzzleFlash: this.muzzleFlash,
      bobX: this.bobX,
      bobY: this.bobY,
      weaponRecoil: this.weaponRecoil,
      reloadProgress,
      activeWeapon: this.activeWeapon,
      damageBoost: this.damageBoostTimer > 0,
      damageFlash: this.damageFlash,
      pickupFlash: this.pickupFlash,
      doors: this.doors,
      enemies: this.enemies,
      collectibles: this.collectibles,
      projectiles: this.projectiles,
      particles: this.particles,
      beams: this.beams,
      showWeapon: !isPreview,
    });
  }

  private emitHud(): void {
    const remaining = this.getRemainingEnemies();
    const activeBoss = this.enemies.find(
      (e) =>
        (e.type === 'miniboss' || e.type === 'finalboss') &&
        e.state !== 'dead' &&
        e.state !== 'dying' &&
        e.alerted
    );

    const reloadProgress = this.isReloading
      ? 1 - Math.max(0, this.reloadTimer / this.reloadTotal)
      : 0;

    this.onHudUpdate({
      screen: this.screen,
      levelNumber: this.level.levelNumber,
      levelName: this.level.name,
      levelSubtitle: this.level.subtitle,
      difficultyLabel: this.level.difficultyLabel,
      objective: this.level.objective,
      themeColor: this.level.themeColor,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      armor: Math.ceil(this.armor),
      maxArmor: this.maxArmor,
      damageBoostTimer: this.damageBoostTimer,
      activeWeapon: this.activeWeapon,
      weapons: {
        pistol: { ...this.weapons.pistol },
        smg: { ...this.weapons.smg },
        shotgun: { ...this.weapons.shotgun },
        rifle: { ...this.weapons.rifle },
        railgun: { ...this.weapons.railgun },
      },
      isReloading: this.isReloading,
      reloadProgress,
      score: this.score,
      highScore: this.highScore,
      kills: this.kills,
      totalLevelKills: this.totalLevelKills,
      totalEnemies: this.totalEnemiesInLevel,
      remainingEnemies: remaining,
      killStreak: this.killStreak,
      streakMultiplier: this.getStreakMultiplier(),
      streakTimer: this.streakTimer,
      levelTime: this.levelTime,
      totalRunTime: this.totalRunTime,
      levelsCompleted: this.levelsCompleted,
      exitUnlocked: remaining === 0,
      interactPrompt: this.interactPrompt,
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerCrit: this.hitMarkerCrit,
      statusToast: this.statusToast,
      boss: activeBoss
        ? {
            name: ENEMY_ARCHETYPES[activeBoss.type].name,
            hp: Math.ceil(activeBoss.hp),
            maxHp: activeBoss.maxHp,
            phase: activeBoss.phase,
          }
        : null,
      pointerLocked: this.pointerLocked,
      levelSummary: this.levelSummary,
      unlockedLevels: this.unlockedLevels,
      minimapData: this.settings.showMinimap
        ? {
            width: this.level.grid[0].length,
            height: this.level.grid.length,
            playerX: this.playerX,
            playerY: this.playerY,
            playerAngle: this.playerAngle,
            grid: this.level.grid,
            explored: this.explored,
            doors: Array.from(this.doors.values()).map((d) => ({
              tx: d.tx,
              ty: d.ty,
              open: d.openAmount > 0.6,
              isSecret: d.isSecret,
            })),
            enemies: this.enemies
              .filter(
                (e) =>
                  e.state !== 'dead' &&
                  e.state !== 'dying' &&
                  (e.alerted || Math.hypot(e.x - this.playerX, e.y - this.playerY) < 6)
              )
              .map((e) => ({
                x: e.x,
                y: e.y,
                tier: ENEMY_ARCHETYPES[e.type].tier,
              })),
            exitPos: this.exitPos,
          }
        : null,
    });
  }
}
