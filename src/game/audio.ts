import { WeaponId } from './types';

class CyberAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private volume = 0.65;
  private muted = false;
  private musicInterval: number | null = null;
  private stepIndex = 0;
  private isBossMusic = false;
  private musicPlaying = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.gain.value = 0.24;
      this.sfxGain.gain.value = 0.85;
      this.masterGain.gain.value = this.muted ? 0 : this.volume;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  private playNoise(duration: number, filterFreq: number, filterType: BiquadFilterType, gainVal: number, decay = true): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    if (decay) {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    } else {
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
    }

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
    noise.stop(ctx.currentTime + duration);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainVal: number,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  public playWeaponFire(weapon: WeaponId): void {
    switch (weapon) {
      case 'pistol':
        this.playTone(540, 110, 0.11, 'square', 0.24);
        this.playNoise(0.09, 2100, 'bandpass', 0.28);
        break;
      case 'smg':
        this.playTone(460, 140, 0.06, 'sawtooth', 0.16);
        this.playNoise(0.055, 2800, 'highpass', 0.19);
        break;
      case 'shotgun':
        this.playTone(170, 42, 0.28, 'sawtooth', 0.36);
        this.playNoise(0.26, 950, 'lowpass', 0.45);
        this.playNoise(0.14, 2400, 'bandpass', 0.25);
        break;
      case 'rifle':
        this.playTone(780, 180, 0.1, 'triangle', 0.22);
        this.playTone(320, 95, 0.09, 'sawtooth', 0.18);
        this.playNoise(0.08, 1800, 'bandpass', 0.2);
        break;
      case 'railgun':
        this.playTone(1650, 90, 0.38, 'sawtooth', 0.32);
        this.playTone(220, 48, 0.42, 'sine', 0.36);
        this.playNoise(0.24, 3400, 'bandpass', 0.3);
        break;
    }
  }

  public playReload(): void {
    this.playTone(320, 480, 0.06, 'square', 0.12, 0);
    this.playTone(480, 680, 0.08, 'triangle', 0.14, 0.18);
  }

  public playEmptyClick(): void {
    this.playTone(900, 600, 0.035, 'square', 0.1);
  }

  public playHitMarker(crit: boolean): void {
    if (crit) {
      this.playTone(1320, 1760, 0.07, 'sine', 0.2);
      this.playTone(1760, 2200, 0.06, 'triangle', 0.16, 0.04);
    } else {
      this.playTone(980, 640, 0.045, 'triangle', 0.14);
    }
  }

  public playEnemyShoot(heavy = false): void {
    if (heavy) {
      this.playTone(260, 75, 0.18, 'sawtooth', 0.2);
      this.playNoise(0.12, 900, 'lowpass', 0.16);
    } else {
      this.playTone(620, 220, 0.1, 'square', 0.13);
    }
  }

  public playEnemyDeath(isBoss = false): void {
    if (isBoss) {
      this.playTone(180, 28, 0.9, 'sawtooth', 0.42);
      this.playNoise(0.85, 650, 'lowpass', 0.48);
      this.playTone(660, 110, 0.45, 'square', 0.25, 0.15);
    } else {
      this.playTone(240, 55, 0.22, 'sawtooth', 0.22);
      this.playNoise(0.2, 1100, 'lowpass', 0.24);
    }
  }

  public playPlayerHurt(): void {
    this.playTone(190, 65, 0.16, 'sawtooth', 0.28);
    this.playNoise(0.1, 700, 'lowpass', 0.2);
  }

  public playFootstep(): void {
    this.playTone(95, 45, 0.045, 'triangle', 0.06);
  }

  public playPickup(isSpecial = false): void {
    if (isSpecial) {
      this.playTone(523, 784, 0.09, 'triangle', 0.2, 0);
      this.playTone(659, 1046, 0.12, 'triangle', 0.22, 0.08);
      this.playTone(1046, 1568, 0.16, 'sine', 0.2, 0.16);
    } else {
      this.playTone(520, 880, 0.08, 'sine', 0.18, 0);
      this.playTone(880, 1180, 0.09, 'triangle', 0.15, 0.06);
    }
  }

  public playDoor(): void {
    this.playTone(120, 210, 0.22, 'sawtooth', 0.12);
    this.playNoise(0.22, 600, 'bandpass', 0.14);
  }

  public playLevelTransition(victory = false): void {
    const notes = victory ? [440, 554, 659, 880, 1108] : [330, 440, 554, 659];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.02, 0.18, 'triangle', 0.2, idx * 0.09);
    });
  }

  public startMusic(boss = false): void {
    this.isBossMusic = boss;
    if (this.musicPlaying && this.musicInterval !== null) return;
    this.ensureContext();
    this.musicPlaying = true;
    this.stepIndex = 0;

    const tickMs = boss ? 135 : 175;
    this.musicInterval = window.setInterval(() => {
      this.playMusicStep();
    }, tickMs);
  }

  public setBossMusic(boss: boolean): void {
    if (this.isBossMusic === boss) return;
    this.stopMusic();
    this.startMusic(boss);
  }

  public stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicInterval !== null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private playMusicStep(): void {
    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running' || this.muted) return;

    const t = this.ctx.currentTime;
    // Minor cyberpunk bassline (D minor / Phrygian)
    const bassNormal = [73.42, 73.42, 87.31, 73.42, 98.0, 73.42, 65.41, 69.3];
    const bassBoss = [73.42, 77.78, 73.42, 110.0, 73.42, 98.0, 87.31, 69.3];
    const arpNormal = [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 329.63, 293.66];
    const arpBoss = [440.0, 587.33, 466.16, 659.25, 440.0, 554.37, 392.0, 523.25];

    const step = this.stepIndex % 16;
    const bassFreq = (this.isBossMusic ? bassBoss : bassNormal)[Math.floor(step / 2) % 8];

    // Driving synth bass
    const bassOsc = this.ctx.createOscillator();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.isBossMusic ? 520 : 340, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.14);

    const bassGain = this.ctx.createGain();
    bassGain.gain.setValueAtTime(0.28, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    bassOsc.connect(filter);
    filter.connect(bassGain);
    bassGain.connect(this.musicGain);
    bassOsc.start(t);
    bassOsc.stop(t + 0.16);

    // Arpeggio pulse every 2 steps
    if (step % 2 === 0 || this.isBossMusic) {
      const arpFreq = (this.isBossMusic ? arpBoss : arpNormal)[step % 8];
      const arpOsc = this.ctx.createOscillator();
      arpOsc.type = this.isBossMusic ? 'square' : 'triangle';
      arpOsc.frequency.setValueAtTime(arpFreq, t);

      const arpGain = this.ctx.createGain();
      arpGain.gain.setValueAtTime(this.isBossMusic ? 0.08 : 0.055, t);
      arpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      arpOsc.connect(arpGain);
      arpGain.connect(this.musicGain);
      arpOsc.start(t);
      arpOsc.stop(t + 0.13);
    }

    // Industrial kick/hat pulse
    if (step % 4 === 0) {
      const kick = this.ctx.createOscillator();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(115, t);
      kick.frequency.exponentialRampToValueAtTime(36, t + 0.1);
      const kg = this.ctx.createGain();
      kg.gain.setValueAtTime(0.32, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      kick.connect(kg);
      kg.connect(this.musicGain);
      kick.start(t);
      kick.stop(t + 0.12);
    }

    this.stepIndex++;
  }
}

export const audioEngine = new CyberAudioEngine();
