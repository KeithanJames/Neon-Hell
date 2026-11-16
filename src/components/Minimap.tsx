import { useEffect, useRef } from 'react';
import { GameHudSnapshot } from '../game/types';

interface MinimapProps {
  data: NonNullable<GameHudSnapshot['minimapData']>;
  themeColor: string;
}

export function Minimap({ data, themeColor }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(6, 8, 16, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const cellSize = 6;
    const cx = w / 2;
    const cy = h / 2;

    const doorLookup = new Map<string, { open: boolean; isSecret?: boolean }>();
    for (const d of data.doors) {
      doorLookup.set(`${d.tx},${d.ty}`, { open: d.open, isSecret: d.isSecret });
    }

    for (let gy = 0; gy < data.height; gy++) {
      for (let gx = 0; gx < data.width; gx++) {
        if (!data.explored[gy]?.[gx]) continue;
        const sx = cx + (gx - data.playerX) * cellSize;
        const sy = cy + (gy - data.playerY) * cellSize;
        if (sx < -cellSize || sx > w || sy < -cellSize || sy > h) continue;

        const tile = data.grid[gy][gx];
        if (tile === 0) {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
          ctx.fillRect(sx, sy, cellSize, cellSize);
        } else if (tile === 11) {
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(sx, sy, cellSize, cellSize);
        } else if (tile === 9) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(sx, sy, cellSize, cellSize);
        } else if (tile === 8 || tile === 10) {
          const d = doorLookup.get(`${gx},${gy}`);
          if (tile === 10 && !d?.open) {
            // Secret wall looks like normal wall until opened
            ctx.fillStyle = themeColor;
            ctx.fillRect(sx, sy, cellSize, cellSize);
          } else {
            ctx.fillStyle = d?.open ? 'rgba(56, 189, 248, 0.25)' : '#facc15';
            ctx.fillRect(sx, sy, cellSize, cellSize);
          }
        } else {
          ctx.fillStyle = themeColor;
          ctx.globalAlpha = 0.72;
          ctx.fillRect(sx, sy, cellSize, cellSize);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Exit pulsing marker if explored
    if (data.exitPos) {
      const ex = data.exitPos.x | 0;
      const ey = data.exitPos.y | 0;
      if (data.explored[ey]?.[ex]) {
        const sx = cx + (data.exitPos.x - data.playerX) * cellSize;
        const sy = cy + (data.exitPos.y - data.playerY) * cellSize;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - 4, sy - 4, 8, 8);
      }
    }

    // Nearby / alerted enemies
    for (const e of data.enemies) {
      const sx = cx + (e.x - data.playerX) * cellSize;
      const sy = cy + (e.y - data.playerY) * cellSize;
      if (sx < 2 || sx > w - 2 || sy < 2 || sy > h - 2) continue;
      ctx.fillStyle = e.tier === 'boss' ? '#ff007f' : '#f43f5e';
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    // Player cone & arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(data.playerAngle);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, -10);
    ctx.lineTo(18, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-3, -3);
    ctx.lineTo(-3, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [data, themeColor]);

  return (
    <div className="border border-slate-700/80 bg-[#060810]/90 p-1">
      <canvas
        ref={canvasRef}
        width={138}
        height={110}
        className="block pixelated"
      />
    </div>
  );
}
