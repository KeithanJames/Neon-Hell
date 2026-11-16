import { useEffect } from 'react';
import { LEVELS } from '../game/levels';
import {
  ENEMY_ARCHETYPES,
  GameHudSnapshot,
  GameScreenState,
  GameSettings,
  WEAPON_ORDER,
  WEAPONS,
} from '../game/types';

interface MenuScreensProps {
  hud: GameHudSnapshot;
  settings: GameSettings;
  onStartGame: () => void;
  onSelectLevel: (levelNum: number) => void;
  onNavigate: (screen: GameScreenState) => void;
  onDeployLevel: () => void;
  onResume: () => void;
  onRestartLevel: () => void;
  onNextLevel: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  previousScreenForSettings: GameScreenState;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MenuScreens({
  hud,
  settings,
  onStartGame,
  onSelectLevel,
  onNavigate,
  onDeployLevel,
  onResume,
  onRestartLevel,
  onNextLevel,
  onUpdateSettings,
  previousScreenForSettings,
}: MenuScreensProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (hud.screen === 'TITLE_MENU') {
          e.preventDefault();
          onStartGame();
        } else if (hud.screen === 'LEVEL_INTRO') {
          e.preventDefault();
          onDeployLevel();
        } else if (hud.screen === 'LEVEL_COMPLETE') {
          e.preventDefault();
          onNextLevel();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.screen, onStartGame, onDeployLevel, onNextLevel]);

  if (hud.screen === 'PLAYING') return null;

  // TITLE SCREEN
  if (hud.screen === 'TITLE_MENU') {
    return (
      <div className="fixed inset-0 z-30 flex flex-col justify-between p-6 sm:p-12 bg-gradient-to-r from-[#05060c]/92 via-[#070914]/75 to-transparent">
        <div className="flex items-center justify-between text-xs font-hud text-slate-400">
          <span>VYRE UNDERGROUND · 2099</span>
          <span>HIGH SCORE · {hud.highScore.toLocaleString()}</span>
        </div>

        <div className="max-w-xl my-auto">
          {/* Bespoke SVG Lockup */}
          <svg
            viewBox="0 0 540 120"
            className="w-full max-w-[460px] h-auto mb-4"
            aria-label="NEON HELL"
          >
            <defs>
              <linearGradient id="nh-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#e879f9" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>
            <path
              d="M6 16 L520 16 L534 30 L534 104 L18 104 L6 92 Z"
              fill="#070913"
              fillOpacity="0.82"
              stroke="url(#nh-grad)"
              strokeWidth="2.5"
            />
            <text
              x="30"
              y="78"
              fill="url(#nh-grad)"
              fontFamily="'Silkscreen', monospace"
              fontWeight="700"
              fontSize="56"
              letterSpacing="4"
            >
              NEON HELL
            </text>
          </svg>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-lg mb-8">
            NEXUS Corporation&apos;s central AI has seized the underground city of VYRE.
            Breach 10 hostile sectors, eliminate rogue combat units, and shatter the central core.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartGame}
              className="px-7 py-3 bg-cyan-400 text-slate-950 font-bold text-sm tracking-wider hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Game
            </button>
            <button
              type="button"
              onClick={() => onNavigate('LEVEL_SELECT')}
              className="px-5 py-3 bg-[#0c101d]/90 border border-slate-600 text-slate-100 font-semibold text-sm hover:border-cyan-400 hover:text-cyan-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Level Select
            </button>
            <button
              type="button"
              onClick={() => onNavigate('INSTRUCTIONS')}
              className="px-5 py-3 bg-[#0c101d]/90 border border-slate-600 text-slate-100 font-semibold text-sm hover:border-fuchsia-400 hover:text-fuchsia-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Instructions
            </button>
            <button
              type="button"
              onClick={() => onNavigate('SETTINGS')}
              className="px-5 py-3 bg-[#0c101d]/90 border border-slate-600 text-slate-100 font-semibold text-sm hover:border-amber-400 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Settings
            </button>
          </div>
        </div>

        <div className="text-xs font-hud text-slate-400 tracking-wide">
          WASD Move · Mouse Look · Click Shoot · R Reload · E Interact · Shift Sprint · Esc Pause
        </div>
      </div>
    );
  }

  // LEVEL SELECT
  if (hud.screen === 'LEVEL_SELECT') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#05060c]/88">
        <div className="w-full max-w-4xl bg-[#090c17] border border-slate-700 p-6 sm:p-8 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div>
              <h2 className="font-pixel text-2xl text-cyan-300">Sector Select</h2>
              <p className="text-xs font-hud text-slate-400 mt-1">
                All 10 sectors unlocked for tactical deployment · Cleared up to Sector {hud.unlockedLevels}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('TITLE_MENU')}
              className="px-4 py-2 border border-slate-600 text-slate-200 text-xs font-semibold hover:border-cyan-400 cursor-pointer whitespace-nowrap shrink-0"
            >
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
            {LEVELS.map((lvl) => {
              const reached = lvl.levelNumber <= hud.unlockedLevels;
              return (
                <button
                  key={lvl.levelNumber}
                  type="button"
                  onClick={() => onSelectLevel(lvl.levelNumber)}
                  className="text-left p-4 bg-[#0d1120] border border-slate-700/80 hover:border-cyan-400 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[11px] font-hud mb-1">
                    <span className="text-slate-400">
                      SECTOR {String(lvl.levelNumber).padStart(2, '0')} · {lvl.difficultyLabel}
                    </span>
                    <span
                      className={reached ? 'text-emerald-400' : 'text-slate-500'}
                    >
                      {reached ? 'REACHED' : 'DIRECT ACCESS'}
                    </span>
                  </div>
                  <div className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                    {lvl.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                    {lvl.objective}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // INSTRUCTIONS
  if (hud.screen === 'INSTRUCTIONS') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#05060c]/88">
        <div className="w-full max-w-4xl bg-[#090c17] border border-slate-700 p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <h2 className="font-pixel text-2xl text-fuchsia-300">Combat Manual</h2>
            <button
              type="button"
              onClick={() => onNavigate('TITLE_MENU')}
              className="px-4 py-2 border border-slate-600 text-slate-200 text-xs font-semibold hover:border-cyan-400 cursor-pointer whitespace-nowrap shrink-0"
            >
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-hud font-bold text-cyan-300 mb-3">CONTROLS</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['W / A / S / D', 'Move & Strafe'],
                  ['Mouse / Left-Right Arrows', 'Aim & Turn Camera'],
                  ['Left Click / Space', 'Fire Active Weapon'],
                  ['R', 'Reload Magazine'],
                  ['Shift', 'Sprint'],
                  ['E', 'Open Doors, Push Secret Panels & Enter Exit'],
                  ['1 – 5 / Scroll Wheel', 'Switch Unlocked Weapons'],
                  ['Esc / P', 'Pause Mission'],
                ].map(([key, desc]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between border-b border-slate-800/80 pb-1.5"
                  >
                    <span className="font-hud text-xs text-slate-100">{key}</span>
                    <span className="text-xs text-slate-400">{desc}</span>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-hud font-bold text-amber-300 mt-6 mb-2">
                SCORING & SURVIVAL
              </h3>
              <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                <li>· Aim dead-center on hostiles for Critical Headshots (1.5x damage + 50 pts).</li>
                <li>· Chain rapid kills within 4.5s to build up to a 4x Streak Multiplier.</li>
                <li>· Look for cracked neon wall panels — press E to uncover hidden supply rooms.</li>
                <li>· Eliminate all required hostiles in each sector to unlock the Exit Airlock.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-hud font-bold text-fuchsia-300 mb-3">ARSENAL</h3>
              <div className="space-y-2.5">
                {WEAPON_ORDER.map((id) => {
                  const w = WEAPONS[id];
                  return (
                    <div key={id} className="p-2.5 bg-[#0d1120] border border-slate-800">
                      <div className="flex items-center justify-between text-xs font-hud">
                        <span className="font-bold" style={{ color: w.color }}>
                          [{w.slot}] {w.name}
                        </span>
                        <span className="text-slate-400">
                          DMG {w.damage}{w.pellets > 1 ? `×${w.pellets}` : ''} · MAG {w.magSize}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{w.description}</p>
                    </div>
                  );
                })}
              </div>

              <h3 className="text-sm font-hud font-bold text-rose-300 mt-5 mb-2">
                HOSTILE THREATS
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {Object.values(ENEMY_ARCHETYPES)
                  .map((e) => e.name)
                  .join(' · ')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SETTINGS
  if (hud.screen === 'SETTINGS') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#05060c]/88">
        <div className="w-full max-w-lg bg-[#090c17] border border-slate-700 p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <h2 className="font-pixel text-2xl text-amber-300">Settings</h2>
            <button
              type="button"
              onClick={() => onNavigate(previousScreenForSettings)}
              className="px-4 py-2 border border-slate-600 text-slate-200 text-xs font-semibold hover:border-cyan-400 cursor-pointer whitespace-nowrap shrink-0"
            >
              Back
            </button>
          </div>

          <div className="space-y-5 text-sm">
            <div>
              <div className="flex justify-between font-hud text-xs mb-2">
                <span className="text-slate-300">MOUSE SENSITIVITY</span>
                <span className="text-cyan-300">{settings.mouseSensitivity.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.05"
                value={settings.mouseSensitivity}
                onChange={(e) =>
                  onUpdateSettings({ mouseSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-hud text-xs mb-2">
                <span className="text-slate-300">MASTER VOLUME</span>
                <span className="text-cyan-300">{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-hud text-xs mb-2">
                <span className="text-slate-300">FIELD OF VIEW</span>
                <span className="text-cyan-300">{settings.fov}°</span>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="2"
                value={settings.fov}
                onChange={(e) => onUpdateSettings({ fov: parseInt(e.target.value, 10) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-slate-300 text-xs font-hud">MUTE AUDIO</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ muted: !settings.muted })}
                className={`px-4 py-1.5 text-xs font-hud border cursor-pointer ${
                  settings.muted
                    ? 'border-rose-500 text-rose-300 bg-rose-950/50'
                    : 'border-emerald-500 text-emerald-300 bg-emerald-950/40'
                }`}
              >
                {settings.muted ? 'MUTED' : 'ACTIVE'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs font-hud">CRT SCANLINES</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ crtScanlines: !settings.crtScanlines })}
                className={`px-4 py-1.5 text-xs font-hud border cursor-pointer ${
                  settings.crtScanlines
                    ? 'border-cyan-400 text-cyan-200 bg-cyan-950/40'
                    : 'border-slate-700 text-slate-400 bg-slate-900'
                }`}
              >
                {settings.crtScanlines ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs font-hud">TACTICAL MINIMAP</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ showMinimap: !settings.showMinimap })}
                className={`px-4 py-1.5 text-xs font-hud border cursor-pointer ${
                  settings.showMinimap
                    ? 'border-cyan-400 text-cyan-200 bg-cyan-950/40'
                    : 'border-slate-700 text-slate-400 bg-slate-900'
                }`}
              >
                {settings.showMinimap ? 'SHOWN' : 'HIDDEN'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LEVEL INTRO
  if (hud.screen === 'LEVEL_INTRO') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#05060c]/92">
        <div className="w-full max-w-xl bg-[#090c17] border border-slate-700 p-8 text-center">
          <div className="text-xs font-hud tracking-widest text-slate-400 mb-2">
            {hud.levelSubtitle} · {hud.difficultyLabel}
          </div>
          <h2
            className="font-pixel text-2xl sm:text-3xl mb-4"
            style={{ color: hud.themeColor }}
          >
            SECTOR {String(hud.levelNumber).padStart(2, '0')}: {hud.levelName}
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">{hud.objective}</p>
          <div className="flex items-center justify-center gap-6 text-xs font-hud text-slate-400 mb-8">
            <span>HOSTILES: {hud.totalEnemies}</span>
            <span aria-hidden="true">·</span>
            <span>SCORE: {hud.score.toLocaleString()}</span>
          </div>
          <button
            type="button"
            onClick={onDeployLevel}
            className="px-8 py-3 bg-cyan-400 text-slate-950 font-bold text-sm tracking-wider hover:bg-cyan-300 transition-colors cursor-pointer"
          >
            Enter Sector
          </button>
        </div>
      </div>
    );
  }

  // PAUSE MENU
  if (hud.screen === 'PAUSED') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#05060c]/82">
        <div className="w-full max-w-sm bg-[#090c17] border border-slate-700 p-7 text-center">
          <div className="text-xs font-hud text-slate-400 mb-1">
            SECTOR {String(hud.levelNumber).padStart(2, '0')} · {hud.levelName}
          </div>
          <h2 className="font-pixel text-2xl text-cyan-300 mb-6">Paused</h2>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2.5 bg-cyan-400 text-slate-950 font-bold text-sm hover:bg-cyan-300 transition-colors cursor-pointer"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={onRestartLevel}
              className="w-full py-2.5 bg-[#0e1324] border border-slate-600 text-slate-100 text-sm font-semibold hover:border-amber-400 cursor-pointer"
            >
              Restart Level
            </button>
            <button
              type="button"
              onClick={() => onNavigate('SETTINGS')}
              className="w-full py-2.5 bg-[#0e1324] border border-slate-600 text-slate-100 text-sm font-semibold hover:border-cyan-400 cursor-pointer"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => onNavigate('TITLE_MENU')}
              className="w-full py-2.5 bg-[#0e1324] border border-slate-700 text-slate-300 text-sm font-semibold hover:border-rose-400 hover:text-rose-200 cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LEVEL COMPLETE
  if (hud.screen === 'LEVEL_COMPLETE' && hud.levelSummary) {
    const sum = hud.levelSummary;
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#05060c]/90">
        <div className="w-full max-w-lg bg-[#090c17] border border-emerald-500/70 p-7">
          <div className="text-xs font-hud text-emerald-400 tracking-wider mb-1">
            SECTOR {String(sum.levelNumber).padStart(2, '0')} CLEARED
          </div>
          <h2 className="font-pixel text-2xl text-slate-100 mb-5">{sum.levelName}</h2>

          <div className="space-y-2.5 text-sm font-hud border-y border-slate-800 py-4 mb-6">
            <div className="flex justify-between">
              <span className="text-slate-400">HOSTILES ELIMINATED</span>
              <span className="text-slate-100">
                {sum.kills} / {sum.totalEnemies}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CLEAR TIME</span>
              <span className="text-slate-100">{formatTime(sum.timeSeconds)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SPEED BONUS</span>
              <span className="text-cyan-300">+{sum.timeBonus.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SURVIVAL BONUS</span>
              <span className="text-emerald-300">+{sum.survivalBonus.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SECRETS FOUND</span>
              <span className="text-amber-300">
                {sum.secretsFound} / {sum.totalSecrets}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
              <span className="text-slate-200">TOTAL SCORE</span>
              <span className="text-cyan-300">{sum.totalScore.toLocaleString()}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onNextLevel}
            className="w-full py-3 bg-emerald-400 text-slate-950 font-bold text-sm tracking-wider hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            Proceed to Sector {String(sum.levelNumber + 1).padStart(2, '0')}
          </button>
        </div>
      </div>
    );
  }

  // GAME OVER
  if (hud.screen === 'GAME_OVER') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#100408]/90">
        <div className="w-full max-w-md bg-[#090c17] border border-rose-500/80 p-7 text-center">
          <div className="text-xs font-hud text-rose-400 tracking-widest mb-1">
            OPERATIVE FLATLINED
          </div>
          <h2 className="font-pixel text-3xl text-rose-400 mb-6">Game Over</h2>

          <div className="space-y-2 text-sm font-hud border-y border-slate-800 py-4 mb-6">
            <div className="flex justify-between">
              <span className="text-slate-400">FINAL SCORE</span>
              <span className="text-cyan-300 font-bold">{hud.score.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ENEMIES ELIMINATED</span>
              <span className="text-slate-100">{hud.kills}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LEVELS COMPLETED</span>
              <span className="text-slate-100">{hud.levelsCompleted} / 10</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRestartLevel}
              className="flex-1 py-2.5 bg-rose-500 text-white font-bold text-sm hover:bg-rose-400 transition-colors cursor-pointer"
            >
              Restart Level
            </button>
            <button
              type="button"
              onClick={() => onNavigate('TITLE_MENU')}
              className="flex-1 py-2.5 bg-[#0e1324] border border-slate-600 text-slate-200 font-semibold text-sm hover:border-cyan-400 cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VICTORY
  if (hud.screen === 'VICTORY') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#050711]/92">
        <div className="w-full max-w-lg bg-[#090c17] border border-cyan-400 p-8 text-center">
          <div className="text-xs font-hud text-cyan-300 tracking-widest mb-2">
            NEXUS AI CORE DESTROYED
          </div>
          <h2 className="font-pixel text-3xl text-emerald-300 mb-3">VYRE Liberated</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            With the Omega Core shattered, NEXUS combat networks across the underground metropolis
            have gone dark. Humanity reclaims VYRE.
          </p>

          <div className="space-y-2.5 text-sm font-hud border-y border-slate-800 py-4 mb-6">
            <div className="flex justify-between">
              <span className="text-slate-400">FINAL SCORE</span>
              <span className="text-cyan-300 font-bold">{hud.score.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">HIGH SCORE</span>
              <span className="text-amber-300 font-bold">{hud.highScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TOTAL ENEMIES KILLED</span>
              <span className="text-slate-100">{hud.kills}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">TOTAL TIME TAKEN</span>
              <span className="text-slate-100">{formatTime(hud.totalRunTime)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onStartGame}
              className="flex-1 py-3 bg-cyan-400 text-slate-950 font-bold text-sm hover:bg-cyan-300 transition-colors cursor-pointer"
            >
              Play Again
            </button>
            <button
              type="button"
              onClick={() => onNavigate('TITLE_MENU')}
              className="flex-1 py-3 bg-[#0e1324] border border-slate-600 text-slate-200 font-semibold text-sm hover:border-cyan-400 cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
