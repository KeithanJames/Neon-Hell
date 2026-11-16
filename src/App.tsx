import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { MenuScreens } from './components/MenuScreens';
import { NeonHellEngine } from './game/engine';
import { GameHudSnapshot, GameScreenState, GameSettings } from './game/types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<NeonHellEngine | null>(null);

  const [hud, setHud] = useState<GameHudSnapshot | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() => ({
    mouseSensitivity: 1.0,
    volume: 0.65,
    muted: false,
    crtScanlines: true,
    fov: 74,
    showMinimap: true,
  }));
  const [prevScreen, setPrevScreen] = useState<GameScreenState>('TITLE_MENU');

  useEffect(() => {
    const engine = new NeonHellEngine((snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    setSettings(engine.getSettings());

    if (canvasRef.current) {
      engine.attachCanvas(canvasRef.current);
    }

    return () => {
      engine.detach();
      engineRef.current = null;
    };
  }, []);

  const handleNavigate = useCallback(
    (target: GameScreenState) => {
      if (target === 'SETTINGS' && hud) {
        setPrevScreen(hud.screen === 'SETTINGS' ? 'TITLE_MENU' : hud.screen);
      }
      engineRef.current?.setScreen(target);
    },
    [hud]
  );

  const handleStartGame = useCallback(() => {
    engineRef.current?.startNewCampaign(1);
  }, []);

  const handleSelectLevel = useCallback((levelNum: number) => {
    engineRef.current?.startNewCampaign(levelNum);
  }, []);

  const handleDeployLevel = useCallback(() => {
    engineRef.current?.beginLevelPlay();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleRestartLevel = useCallback(() => {
    engineRef.current?.restartCurrentLevel();
  }, []);

  const handleNextLevel = useCallback(() => {
    engineRef.current?.proceedToNextLevel();
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.updateSettings(patch);
    setSettings(eng.getSettings());
  }, []);

  const handleToggleMute = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.toggleMute();
    setSettings(eng.getSettings());
  }, []);

  const handleRequestLock = useCallback(() => {
    engineRef.current?.requestLock();
  }, []);

  return (
    <main className="relative w-screen h-screen bg-[#06060b] overflow-hidden">
      {/* Isolated 2.5D Raycasting Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full object-cover pixelated cursor-crosshair"
      />

      {/* Optional Retro CRT Scanline + Subtle Vignette Overlay */}
      {settings.crtScanlines && (
        <div className="pointer-events-none fixed inset-0 z-10 crt-scanlines crt-vignette" />
      )}

      {/* In-Game HUD */}
      {hud && hud.screen === 'PLAYING' && (
        <GameHud
          hud={hud}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRequestLock={handleRequestLock}
        />
      )}

      {/* Title, Level Select, Briefing, Pause, Game Over & Victory Screens */}
      {hud && (
        <MenuScreens
          hud={hud}
          settings={settings}
          onStartGame={handleStartGame}
          onSelectLevel={handleSelectLevel}
          onNavigate={handleNavigate}
          onDeployLevel={handleDeployLevel}
          onResume={handleResume}
          onRestartLevel={handleRestartLevel}
          onNextLevel={handleNextLevel}
          onUpdateSettings={handleUpdateSettings}
          previousScreenForSettings={prevScreen}
        />
      )}
    </main>
  );
}
