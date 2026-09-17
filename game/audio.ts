export type SoundName = 'flap' | 'score' | 'hit' | 'fall';

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume: number;
  private muted: boolean;

  constructor(options: { volume: number; muted: boolean }) {
    this.volume = clampVolume(options.volume);
    this.muted = options.muted;
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = getAudioContextConstructor();
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.noise = createNoiseBuffer(this.ctx);
      this.applyGain();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume);
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  play(name: SoundName, delay = 0): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || this.muted || ctx.state === 'closed') return;
    const t = ctx.currentTime + delay;
    switch (name) {
      case 'flap':
        noiseBurst(ctx, master, noise, t, 0.08, 0.5, 'bandpass', 1200);
        tone(ctx, master, 'triangle', 520, 780, t, 0.06, 0.15);
        return;
      case 'score':
        tone(ctx, master, 'square', 880, 880, t, 0.07, 0.15);
        tone(ctx, master, 'square', 1320, 1320, t + 0.07, 0.09, 0.15);
        return;
      case 'hit':
        noiseBurst(ctx, master, noise, t, 0.2, 0.8, 'lowpass', 600);
        tone(ctx, master, 'sine', 180, 50, t, 0.2, 0.7);
        return;
      case 'fall':
        tone(ctx, master, 'sawtooth', 600, 120, t, 0.45, 0.12);
        return;
    }
  }

  dispose(): void {
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  private applyGain(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(ctx: AudioContext, destination: AudioNode, t: number, peak: number, duration: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.005 + duration);
  gain.connect(destination);
  return gain;
}

function tone(
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  fromHz: number,
  toHz: number,
  t: number,
  duration: number,
  peak: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, t);
  if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(toHz, t + duration);
  osc.connect(envelope(ctx, destination, t, peak, duration));
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function noiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  noise: AudioBuffer,
  t: number,
  duration: number,
  peak: number,
  filterType: BiquadFilterType,
  frequency: number,
): void {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  source.connect(filter).connect(envelope(ctx, destination, t, peak, duration));
  source.start(t);
  source.stop(t + duration + 0.05);
}
