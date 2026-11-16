import {
  blendFog,
  drawWeaponViewmodel,
  getTextureAtlas,
  hexToPacked,
  packRGBA,
  TEX_SIZE,
  tintColor,
} from './textures';
import {
  BeamEffect,
  CollectibleEntity,
  DoorState,
  ENEMY_ARCHETYPES,
  EnemyEntity,
  LevelDefinition,
  ParticleEntity,
  ProjectileEntity,
  WeaponId,
} from './types';

export const RENDER_W = 480;
export const RENDER_H = 270;

export interface RenderState {
  level: LevelDefinition;
  playerX: number;
  playerY: number;
  playerAngle: number;
  pitchOffset: number; // camera shake / bob vertical shift
  fovDeg: number;
  time: number;
  muzzleFlash: number;
  bobX: number;
  bobY: number;
  weaponRecoil: number;
  reloadProgress: number;
  activeWeapon: WeaponId;
  damageBoost: boolean;
  damageFlash: number;
  pickupFlash: number;
  doors: Map<string, DoorState>;
  enemies: EnemyEntity[];
  collectibles: CollectibleEntity[];
  projectiles: ProjectileEntity[];
  particles: ParticleEntity[];
  beams: BeamEffect[];
  showWeapon?: boolean;
}

export class RaycasterRenderer {
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private buf32: Uint32Array;
  private zBuffer: Float32Array;

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = RENDER_W;
    this.offscreenCanvas.height = RENDER_H;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false })!;
    this.offscreenCtx.imageSmoothingEnabled = false;
    this.imageData = this.offscreenCtx.createImageData(RENDER_W, RENDER_H);
    this.buf32 = new Uint32Array(this.imageData.data.buffer);
    this.zBuffer = new Float32Array(RENDER_W);
  }

  public render(targetCanvas: HTMLCanvasElement, state: RenderState): void {
    const atlas = getTextureAtlas();
    const {
      level,
      playerX,
      playerY,
      playerAngle,
      pitchOffset,
      fovDeg,
      time,
      muzzleFlash,
      doors,
      enemies,
      collectibles,
      projectiles,
      particles,
      beams,
    } = state;

    const grid = level.grid;
    const mapH = grid.length;
    const mapW = grid[0].length;

    const dirX = Math.cos(playerAngle);
    const dirY = Math.sin(playerAngle);
    const fovScale = Math.tan(((fovDeg * Math.PI) / 180) * 0.5);
    const planeX = -dirY * fovScale;
    const planeY = dirX * fovScale;

    const horizon = Math.floor(RENDER_H * 0.5 + pitchOffset);
    const [fogR, fogG, fogB] = level.fogColor;
    const fogDensity = level.fogDensity;

    // Flickering light modulation
    let flicker = 1.0;
    if (level.hasFlicker) {
      const fWave = Math.sin(time * 13.7) * Math.sin(time * 31.3);
      if (fWave > 0.78) flicker = 0.62;
    }
    const baseLight = level.ambientLight * flicker;
    const muzzleLight = muzzleFlash * 0.48;

    // 1. FLOOR & CEILING CASTING
    const rayDirX0 = dirX - planeX;
    const rayDirY0 = dirY - planeY;
    const rayDirX1 = dirX + planeX;
    const rayDirY1 = dirY + planeY;
    const posZ = 0.5 * RENDER_H;

    const floorTex = atlas.floorTex;
    const ceilTex = atlas.ceilingTex;
    const toxicTex = atlas.toxicTex;

    for (let y = 0; y < RENDER_H; y++) {
      const isFloor = y >= horizon;
      const p = isFloor ? y - horizon : horizon - y;
      const rowDist = p === 0 ? 100 : posZ / p;

      const fogFactor = Math.min(0.95, 1 - Math.exp(-rowDist * fogDensity));
      const shade = Math.min(1.3, (baseLight + muzzleLight / (1 + rowDist * 0.35)) * Math.max(0.22, 1 - rowDist * 0.055));

      const floorStepX = (rowDist * (rayDirX1 - rayDirX0)) / RENDER_W;
      const floorStepY = (rowDist * (rayDirY1 - rayDirY0)) / RENDER_W;

      let floorX = playerX + rowDist * rayDirX0;
      let floorY = playerY + rowDist * rayDirY0;

      const rowOffset = y * RENDER_W;

      for (let x = 0; x < RENDER_W; x++) {
        const cellX = floorX | 0;
        const cellY = floorY | 0;
        const tx = ((floorX * TEX_SIZE) | 0) & 63;
        const ty = ((floorY * TEX_SIZE) | 0) & 63;
        const texIdx = (ty << 6) + tx;

        let packed: number;
        if (
          isFloor &&
          cellY >= 0 &&
          cellY < mapH &&
          cellX >= 0 &&
          cellX < mapW &&
          grid[cellY][cellX] === 11
        ) {
          // Animated glowing toxic floor
          const shiftIdx = (((ty + ((time * 12) | 0)) & 63) << 6) + tx;
          packed = toxicTex[shiftIdx];
          this.buf32[rowOffset + x] = blendFog(packed, Math.min(1.25, shade + 0.35), fogR, fogG, fogB, fogFactor * 0.65);
        } else {
          packed = isFloor ? floorTex[texIdx] : ceilTex[texIdx];
          this.buf32[rowOffset + x] = blendFog(packed, shade, fogR, fogG, fogB, fogFactor);
        }

        floorX += floorStepX;
        floorY += floorStepY;
      }
    }

    // 2. WALL & DOOR RAYCASTING (DDA)
    const billboardFrameAlt = Math.floor(time * 2.2) % 2 === 1;

    for (let x = 0; x < RENDER_W; x++) {
      const cameraX = (2 * x) / RENDER_W - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;

      let mapX = playerX | 0;
      let mapY = playerY | 0;

      const deltaDistX = rayDirX === 0 ? 1e10 : Math.abs(1 / rayDirX);
      const deltaDistY = rayDirY === 0 ? 1e10 : Math.abs(1 / rayDirY);

      let stepX = 0;
      let stepY = 0;
      let sideDistX = 0;
      let sideDistY = 0;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (playerX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - playerX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (playerY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - playerY) * deltaDistY;
      }

      let hit = false;
      let side = 0;
      let hitTile = 1;
      let perpWallDist = 1;
      let wallX = 0;
      let texShift = 0;

      for (let iter = 0; iter < 64; iter++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }

        if (mapY < 0 || mapY >= mapH || mapX < 0 || mapX >= mapW) {
          hit = true;
          hitTile = 1;
          break;
        }

        const tile = grid[mapY][mapX];
        if (tile === 0 || tile === 11) continue;

        const dist =
          side === 0
            ? (mapX - playerX + (1 - stepX) * 0.5) / (rayDirX || 1e-6)
            : (mapY - playerY + (1 - stepY) * 0.5) / (rayDirY || 1e-6);

        let hitU =
          side === 0 ? playerY + dist * rayDirY : playerX + dist * rayDirX;
        hitU -= Math.floor(hitU);

        // Sliding door or secret wall check
        if (tile === 8 || tile === 10) {
          const d = doors.get(`${mapX},${mapY}`);
          const openAmt = d ? d.openAmount : 0;
          if (hitU < openAmt) {
            // Ray passes through open portion of door
            continue;
          }
          texShift = openAmt;
        } else {
          texShift = 0;
        }

        hit = true;
        hitTile = tile;
        perpWallDist = Math.max(0.05, dist);
        wallX = hitU;
        break;
      }

      this.zBuffer[x] = perpWallDist;
      if (!hit) continue;

      const lineHeight = (RENDER_H / perpWallDist) | 0;
      let drawStart = ((-lineHeight) >> 1) + horizon;
      let drawEnd = (lineHeight >> 1) + horizon;
      if (drawStart < 0) drawStart = 0;
      if (drawEnd >= RENDER_H) drawEnd = RENDER_H - 1;

      let tex =
        hitTile === 4 && billboardFrameAlt
          ? atlas.wallAlt4
          : atlas.walls[hitTile] || atlas.walls[1];

      let texX = (((wallX - texShift) * TEX_SIZE) | 0) & 63;
      if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) {
        texX = (TEX_SIZE - texX - 1) & 63;
      }

      const sideShade = side === 1 ? 0.78 : 1.0;
      const isEmissiveWall = hitTile === 4 || hitTile === 9;
      const wallShade = Math.min(
        1.35,
        (baseLight * sideShade + muzzleLight / (1 + perpWallDist * 0.28)) *
          (isEmissiveWall ? 1.15 : 1.0)
      );
      const fogFactor = Math.min(0.95, 1 - Math.exp(-perpWallDist * fogDensity));

      const step = TEX_SIZE / lineHeight;
      let texPos = (drawStart - horizon + lineHeight * 0.5) * step;

      for (let y = drawStart; y <= drawEnd; y++) {
        const texY = (texPos | 0) & 63;
        texPos += step;
        const color = tex[(texY << 6) + texX];
        this.buf32[y * RENDER_W + x] = blendFog(
          color,
          wallShade,
          fogR,
          fogG,
          fogB,
          fogFactor * (isEmissiveWall ? 0.5 : 1.0)
        );
      }
    }

    // 3. COLLECT AND SORT SPRITES (Enemies + Collectibles + Projectiles)
    interface SpriteDrawItem {
      x: number;
      y: number;
      distSq: number;
      scale: number;
      vShift: number;
      tex?: Uint32Array;
      solidColor?: number;
      hurtFlash?: number;
      isDead?: boolean;
      radiusPx?: number;
    }

    const spriteItems: SpriteDrawItem[] = [];

    for (const c of collectibles) {
      if (c.collected) continue;
      const dx = c.x - playerX;
      const dy = c.y - playerY;
      spriteItems.push({
        x: c.x,
        y: c.y,
        distSq: dx * dx + dy * dy,
        scale: 0.55,
        vShift: 0.25 + Math.sin(time * 4 + c.bobOffset) * 0.06,
        tex: atlas.collectibles[c.type],
      });
    }

    for (const e of enemies) {
      const dx = e.x - playerX;
      const dy = e.y - playerY;
      const arch = ENEMY_ARCHETYPES[e.type];
      const frames = atlas.enemies[e.type];

      let tex = frames.idle;
      if (e.state === 'dying' || e.state === 'dead') {
        tex = frames.death;
      } else if (e.state === 'attack' || e.state === 'windup') {
        tex = frames.attack;
      } else if (e.state === 'chase' || e.state === 'strafe') {
        tex = Math.floor(e.animTimer * 5) % 2 === 0 ? frames.walk : frames.idle;
      }

      const hoverOffset = arch.isFlying && e.state !== 'dead' && e.state !== 'dying'
        ? -0.14 + Math.sin(time * 5 + e.id) * 0.06
        : 0;

      spriteItems.push({
        x: e.x,
        y: e.y,
        distSq: dx * dx + dy * dy,
        scale: arch.scale,
        vShift: hoverOffset,
        tex,
        hurtFlash: e.hurtFlash,
        isDead: e.state === 'dead',
      });
    }

    for (const p of projectiles) {
      const dx = p.x - playerX;
      const dy = p.y - playerY;
      spriteItems.push({
        x: p.x,
        y: p.y,
        distSq: dx * dx + dy * dy,
        scale: 0.25,
        vShift: 0,
        solidColor: hexToPacked(p.color),
        radiusPx: p.radius,
      });
    }

    // Back-to-front painter's sort
    spriteItems.sort((a, b) => b.distSq - a.distSq);

    const invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (const sp of spriteItems) {
      const spriteX = sp.x - playerX;
      const spriteY = sp.y - playerY;

      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

      if (transformY <= 0.12) continue;

      const spriteScreenX = ((RENDER_W * 0.5) * (1 + transformX / transformY)) | 0;
      const vMoveScreen = ((sp.vShift * RENDER_H) / transformY) | 0;

      const spriteHeight = Math.abs(((RENDER_H / transformY) * sp.scale) | 0);
      const spriteWidth = spriteHeight;

      let drawStartY = ((-spriteHeight) >> 1) + horizon + vMoveScreen;
      let drawEndY = (spriteHeight >> 1) + horizon + vMoveScreen;
      let drawStartX = ((-spriteWidth) >> 1) + spriteScreenX;
      let drawEndX = (spriteWidth >> 1) + spriteScreenX;

      if (drawStartY < 0) drawStartY = 0;
      if (drawEndY >= RENDER_H) drawEndY = RENDER_H - 1;
      if (drawStartX < 0) drawStartX = 0;
      if (drawEndX >= RENDER_W) drawEndX = RENDER_W - 1;

      if (drawStartX >= RENDER_W || drawEndX < 0) continue;

      const fogFactor = Math.min(0.92, 1 - Math.exp(-transformY * fogDensity * 0.85));
      const shade = Math.min(1.25, baseLight + muzzleLight / (1 + transformY * 0.3));

      if (sp.solidColor !== undefined) {
        // Glowing energy projectile orb
        const cx = spriteScreenX;
        const cy = horizon + vMoveScreen;
        const rad = Math.max(2, Math.min(14, (spriteHeight * 0.45) | 0));
        const x0 = Math.max(0, cx - rad);
        const x1 = Math.min(RENDER_W - 1, cx + rad);
        const y0 = Math.max(0, cy - rad);
        const y1 = Math.min(RENDER_H - 1, cy + rad);
        const whiteCore = packRGBA(255, 255, 255);

        for (let sx = x0; sx <= x1; sx++) {
          if (transformY >= this.zBuffer[sx]) continue;
          const dx = sx - cx;
          for (let sy = y0; sy <= y1; sy++) {
            const dy = sy - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 <= rad * rad) {
              this.buf32[sy * RENDER_W + sx] = d2 <= rad * rad * 0.25 ? whiteCore : sp.solidColor;
            }
          }
        }
        continue;
      }

      if (!sp.tex) continue;
      const tex = sp.tex;
      const origStartX = ((-spriteWidth) >> 1) + spriteScreenX;
      const origStartY = ((-spriteHeight) >> 1) + horizon + vMoveScreen;

      for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
        if (transformY >= this.zBuffer[stripe]) continue;
        const texX = (((stripe - origStartX) * TEX_SIZE) / spriteWidth) | 0;
        if (texX < 0 || texX >= TEX_SIZE) continue;

        for (let y = drawStartY; y <= drawEndY; y++) {
          const texY = (((y - origStartY) * TEX_SIZE) / spriteHeight) | 0;
          if (texY < 0 || texY >= TEX_SIZE) continue;

          const pixel = tex[(texY << 6) + texX];
          const alpha = (pixel >>> 24) & 0xff;
          if (alpha < 128) continue;

          if (sp.hurtFlash && sp.hurtFlash > 0) {
            this.buf32[y * RENDER_W + stripe] = packRGBA(255, 210, 235);
          } else {
            this.buf32[y * RENDER_W + stripe] = blendFog(
              pixel,
              sp.isDead ? shade * 0.65 : shade,
              fogR,
              fogG,
              fogB,
              fogFactor * 0.8
            );
          }
        }
      }
    }

    // 4. PARTICLES (3D sparks & explosions)
    for (const pt of particles) {
      const dx = pt.x - playerX;
      const dy = pt.y - playerY;
      const transformX = invDet * (dirY * dx - dirX * dy);
      const transformY = invDet * (-planeY * dx + planeX * dy);
      if (transformY <= 0.15) continue;

      const sx = ((RENDER_W * 0.5) * (1 + transformX / transformY)) | 0;
      if (sx < 0 || sx >= RENDER_W || transformY >= this.zBuffer[sx]) continue;

      const sy = (horizon - (pt.z * RENDER_H) / transformY) | 0;
      const size = Math.max(1, Math.min(5, ((pt.size * RENDER_H) / (transformY * 140)) | 0));
      const packed = hexToPacked(pt.color);

      for (let px = sx - size; px <= sx + size; px++) {
        if (px < 0 || px >= RENDER_W) continue;
        for (let py = sy - size; py <= sy + size; py++) {
          if (py < 0 || py >= RENDER_H) continue;
          this.buf32[py * RENDER_W + px] = packed;
        }
      }
    }

    // 5. RAILGUN / SNIPER LASER BEAMS (3D projected line segments)
    for (const beam of beams) {
      const steps = 28;
      const packed = hexToPacked(beam.color);
      const white = packRGBA(255, 255, 255);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const bx = beam.x1 + (beam.x2 - beam.x1) * t;
        const by = beam.y1 + (beam.y2 - beam.y1) * t;
        const dx = bx - playerX;
        const dy = by - playerY;
        const tx = invDet * (dirY * dx - dirX * dy);
        const ty = invDet * (-planeY * dx + planeX * dy);
        if (ty <= 0.2) continue;
        const sx = ((RENDER_W * 0.5) * (1 + tx / ty)) | 0;
        if (sx < 1 || sx >= RENDER_W - 1 || ty >= this.zBuffer[sx] + 0.15) continue;
        const sy = horizon;
        this.buf32[sy * RENDER_W + sx] = white;
        this.buf32[(sy - 1) * RENDER_W + sx] = packed;
        this.buf32[(sy + 1) * RENDER_W + sx] = packed;
      }
    }

    // Blit pixel buffer to offscreen canvas, then draw crisp scaled onto targetCanvas
    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    const tCtx = targetCanvas.getContext('2d', { alpha: false });
    if (!tCtx) return;

    const tw = targetCanvas.width;
    const th = targetCanvas.height;
    tCtx.imageSmoothingEnabled = false;
    tCtx.drawImage(this.offscreenCanvas, 0, 0, tw, th);

    // 6. FIRST-PERSON WEAPON VIEWMODEL
    if (state.showWeapon !== false) {
      drawWeaponViewmodel(
        tCtx,
        tw,
        th,
        state.activeWeapon,
        state.bobX,
        state.bobY,
        state.weaponRecoil,
        state.muzzleFlash,
        state.reloadProgress,
        state.damageBoost
      );
    }

    // 7. SCREEN DAMAGE / PICKUP FLASH OVERLAYS
    if (state.damageFlash > 0) {
      tCtx.fillStyle = `rgba(244, 63, 94, ${Math.min(0.45, state.damageFlash * 0.45)})`;
      tCtx.fillRect(0, 0, tw, th);
    }
    if (state.pickupFlash > 0) {
      tCtx.fillStyle = `rgba(34, 211, 238, ${Math.min(0.22, state.pickupFlash * 0.22)})`;
      tCtx.fillRect(0, 0, tw, th);
    }
    if (state.damageBoost) {
      tCtx.strokeStyle = 'rgba(232, 121, 249, 0.35)';
      tCtx.lineWidth = 8;
      tCtx.strokeRect(0, 0, tw, th);
    }
  }
}

export function tintHexCheck(hex: string, s: number) {
  return tintColor(hexToPacked(hex), s);
}
