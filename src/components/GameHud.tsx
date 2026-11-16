import { Pause, Volume2, VolumeX } from 'lucide-react';
import { GameHudSnapshot, WEAPON_ORDER, WEAPONS } from '../game/types';
import { Minimap } from './Minimap';

interface GameHudProps {
  hud: GameHudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRequestLock: () => void;
}

export function GameHud({
  hud,
  muted,
  onToggleMute,
  onPause,
  onRequestLock,
}: GameHudProps) {
  const activeDef = WEAPONS[hud.activeWeapon];
  const activeState = hud.weapons[hud.activeWeapon];
  const ammoReserveText = activeDef.maxReserve === -1 ? '∞' : String(activeState.reserve);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-5">
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Sector & Hostiles */}
        <div className="bg-[#070912]/85 border border-slate-700/70 px-3.5 py-2.5 min-w-[210px]">
          <div className="flex items-center gap-2 text-[11px] font-hud tracking-wider text-slate-400">
            <span>SECTOR {String(hud.levelNumber).padStart(2, '0')} / 10</span>
            <span aria-hidden="true">·</span>
            <span style={{ color: hud.themeColor }}>{hud.difficultyLabel}</span>
          </div>
          <div className="text-sm font-bold text-slate-100 tracking-wide mt-0.5">
            {hud.levelName}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs font-hud">
            {hud.exitUnlocked ? (
              <span className="text-emerald-400 font-bold">EXIT AIRLOCK OPEN</span>
            ) : (
              <span className="text-rose-400">
                HOSTILES LEFT: <strong className="text-slate-100">{hud.remainingEnemies}</strong>
              </span>
            )}
            {hud.killStreak >= 2 && (
              <span className="text-amber-400 font-bold">
                {hud.streakMultiplier}x STREAK ({hud.killStreak})
              </span>
            )}
          </div>
        </div>

        {/* Top-Center: Boss Bar & Toast */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-lg">
          {hud.boss && (
            <div className="w-full bg-[#09060e]/90 border border-rose-500/70 px-4 py-2">
              <div className="flex items-center justify-between text-xs font-hud mb-1">
                <span className="text-rose-400 font-bold tracking-wider">{hud.boss.name}</span>
                <span className="text-slate-300">
                  PHASE {hud.boss.phase} · {hud.boss.hp} / {hud.boss.maxHp}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-900 border border-rose-950 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 via-pink-500 to-amber-400 transition-transform duration-75 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(0, hud.boss.hp / hud.boss.maxHp)})`,
                  }}
                />
              </div>
            </div>
          )}

          {hud.statusToast && (
            <div className="bg-[#090d18]/90 border border-cyan-400/70 px-3.5 py-1.5 text-xs font-hud font-bold tracking-wider text-cyan-300">
              {hud.statusToast}
            </div>
          )}
        </div>

        {/* Top-Right: Score, Minimap, Quick Controls */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-[#070912]/85 border border-slate-700/70 px-3.5 py-2 text-right font-hud">
              <div className="flex items-center justify-end gap-4 text-xs">
                <div>
                  <span className="text-slate-400 mr-1.5">SCORE</span>
                  <span className="text-cyan-300 font-bold text-sm">
                    {hud.score.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 mr-1.5">KILLS</span>
                  <span className="text-slate-100 font-bold text-sm">{hud.kills}</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                HIGH {hud.highScore.toLocaleString()}
              </div>
            </div>

            <div className="pointer-events-auto flex flex-col gap-1">
              <button
                type="button"
                onClick={onToggleMute}
                title={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="h-7 w-7 flex items-center justify-center bg-[#070912]/90 border border-slate-700/80 text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={onPause}
                title="Pause (Esc)"
                className="h-7 w-7 flex items-center justify-center bg-[#070912]/90 border border-slate-700/80 text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {hud.minimapData && (
            <Minimap data={hud.minimapData} themeColor={hud.themeColor} />
          )}
        </div>
      </div>

      {/* CENTER CROSSHAIR & INTERACT PROMPTS */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Dynamic Crosshair */}
          <div className="relative w-6 h-6 flex items-center justify-center">
            <span className="absolute top-0 w-0.5 h-1.5 bg-cyan-300/90" />
            <span className="absolute bottom-0 w-0.5 h-1.5 bg-cyan-300/90" />
            <span className="absolute left-0 h-0.5 w-1.5 bg-cyan-300/90" />
            <span className="absolute right-0 h-0.5 w-1.5 bg-cyan-300/90" />
            <span className="w-1 h-1 bg-white rounded-full" />
          </div>

          {/* Hitmarker */}
          {hud.hitMarkerTimer > 0 && (
            <svg
              viewBox="0 0 24 24"
              className={`absolute w-7 h-7 ${
                hud.hitMarkerCrit ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              <path
                d="M4 4L9 9M20 4L15 9M4 20L9 15M20 20L15 15"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
              />
            </svg>
          )}

          {/* Reload Bar */}
          {hud.isReloading && (
            <div className="absolute top-8 w-24">
              <div className="text-[10px] font-hud text-center text-amber-300 mb-0.5">
                RELOADING
              </div>
              <div className="h-1.5 bg-slate-900 border border-slate-700">
                <div
                  className="h-full bg-amber-400 origin-left"
                  style={{ transform: `scaleX(${hud.reloadProgress})` }}
                />
              </div>
            </div>
          )}

          {/* Interact Prompt */}
          {hud.interactPrompt && (
            <div className="absolute top-12 whitespace-nowrap bg-[#060913]/90 border border-cyan-400/80 px-3 py-1 text-xs font-hud font-bold text-cyan-200 tracking-wider">
              {hud.interactPrompt}
            </div>
          )}

          {/* Pointer Lock Click Hint */}
          {!hud.pointerLocked && (
            <button
              type="button"
              onClick={onRequestLock}
              className="pointer-events-auto absolute -top-14 whitespace-nowrap bg-[#060913]/80 border border-slate-600/80 px-2.5 py-1 text-[11px] font-hud text-slate-300 hover:border-cyan-400 hover:text-cyan-200 cursor-pointer"
            >
              CLICK VIEWPORT TO LOCK MOUSE AIM (OR USE ARROWS)
            </button>
          )}
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Health & Armor */}
        <div className="bg-[#070912]/85 border border-slate-700/70 px-4 py-3 min-w-[240px] space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs font-hud mb-1">
              <span className="text-rose-400 font-bold">HEALTH</span>
              <span className="text-slate-100 font-extrabold text-sm">
                {hud.hp} <span className="text-slate-500 font-normal">/ {hud.maxHp}</span>
              </span>
            </div>
            <div className="h-2.5 bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className={`h-full transition-transform duration-100 origin-left ${
                  hud.hp <= 25 ? 'bg-rose-500' : 'bg-emerald-400'
                }`}
                style={{ transform: `scaleX(${Math.max(0, hud.hp / hud.maxHp)})` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-hud mb-1">
              <span className="text-sky-400 font-bold">ARMOR</span>
              <span className="text-slate-100 font-extrabold text-sm">
                {hud.armor} <span className="text-slate-500 font-normal">/ {hud.maxArmor}</span>
              </span>
            </div>
            <div className="h-2 bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-transform duration-100 origin-left"
                style={{ transform: `scaleX(${Math.max(0, hud.armor / hud.maxArmor)})` }}
              />
            </div>
          </div>

          {hud.damageBoostTimer > 0 && (
            <div className="text-[11px] font-hud font-bold text-fuchsia-400">
              OVERCHARGE 1.75X · {hud.damageBoostTimer.toFixed(1)}s
            </div>
          )}
        </div>

        {/* Bottom-Right: Weapon & Ammo */}
        <div className="bg-[#070912]/85 border border-slate-700/70 px-4 py-3 min-w-[250px] text-right">
          <div className="flex items-baseline justify-between gap-4">
            <span
              className="text-xs font-hud font-bold tracking-wider"
              style={{ color: activeDef.color }}
            >
              {activeDef.name.toUpperCase()}
            </span>
            <div className="font-hud text-2xl font-extrabold text-slate-100 leading-none">
              <span className={activeState.mag === 0 ? 'text-rose-400' : 'text-slate-100'}>
                {activeState.mag}
              </span>
              <span className="text-slate-500 text-base mx-1">/</span>
              <span className="text-slate-400 text-base">{ammoReserveText}</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-end gap-1.5 font-hud text-[11px]">
            {WEAPON_ORDER.map((wId) => {
              const def = WEAPONS[wId];
              const st = hud.weapons[wId];
              const isActive = hud.activeWeapon === wId;
              return (
                <div
                  key={wId}
                  className={`px-2 py-0.5 border ${
                    !st.unlocked
                      ? 'border-slate-800 text-slate-600 bg-slate-950/50'
                      : isActive
                        ? 'border-cyan-400 text-cyan-200 bg-cyan-950/60 font-bold'
                        : 'border-slate-700 text-slate-400 bg-slate-900/60'
                  }`}
                >
                  {def.slot}·{def.shortName.split(' ')[0]}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
