// Procedural ambient sound engine for the Focus suite (chunk 4A).
// Zero external audio files, zero npm packages: every sound is synthesised
// live with the Web Audio API, so it works fully offline. All methods are
// try/catch-safe because audio may be unsupported or blocked by the browser.

export type SoundKind = 'brown' | 'rain' | 'pulse';

/** Narrowed capability check — no `any`; webkit prefix handled via a cast. */
export function isSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
  return typeof AudioContext !== 'undefined' || typeof w.webkitAudioContext !== 'undefined';
}

/** Classic brown-noise integration, rendered into a looped AudioBuffer. */
function makeNoiseBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (last + 0.02 * white) / 1.02;
    last = data[i];
    data[i] *= 3.5;
  }
  return buf;
}

export class FocusSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Every started source lives here so stop() can halt them all. */
  private sources: AudioScheduledSourceNode[] = [];
  private volume = 0.25;

  /** Lazily create the single AudioContext (webkit-prefixed fallback honoured). */
  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      if (typeof window === 'undefined') return null;
      const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
      const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : w.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.master = null;
    }
    return this.ctx;
  }

  private track(node: AudioScheduledSourceNode): void {
    this.sources.push(node);
    node.onended = () => {
      this.sources = this.sources.filter((s) => s !== node);
    };
  }

  private stopSources(): void {
    for (const s of this.sources) {
      try {
        s.stop();
        s.disconnect();
      } catch {
        // Already stopped — nothing to do.
      }
    }
    this.sources = [];
  }

  /** Start (or replace) the ambient sound. Safe to call repeatedly. */
  async start(kind: SoundKind): Promise<void> {
    try {
      if (!isSupported()) return;
      const ctx = this.ensureCtx();
      const master = this.master;
      if (!ctx || !master) return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // Resume can be rejected without a fresh gesture; the UI calls
          // start() from a click handler, so this normally succeeds.
        }
      }
      this.stopSources();

      if (kind === 'brown') {
        const src = ctx.createBufferSource();
        src.buffer = makeNoiseBuffer(ctx, 5);
        src.loop = true;
        src.connect(master);
        src.start();
        this.track(src);
        return;
      }

      if (kind === 'rain') {
        const src = ctx.createBufferSource();
        src.buffer = makeNoiseBuffer(ctx, 5);
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 0.6;
        // Breathing gain: 0.15 Hz LFO +/- 0.25 around a 0.75 base (0.5..1.0).
        const breath = ctx.createGain();
        breath.gain.value = 0.75;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.15;
        const depth = ctx.createGain();
        depth.gain.value = 0.25;
        lfo.connect(depth);
        depth.connect(breath.gain);
        src.connect(filter);
        filter.connect(breath);
        breath.connect(master);
        src.start();
        lfo.start();
        this.track(src);
        this.track(lfo);
        return;
      }

      // 'pulse': binaural-style beat — 200 Hz left, 204 Hz right, with a
      // gentle 0.1 Hz amplitude pulse on a shared gain.
      const pulseGain = ctx.createGain();
      pulseGain.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1;
      const depth = ctx.createGain();
      depth.gain.value = 0.25;
      lfo.connect(depth);
      depth.connect(pulseGain.gain);
      pulseGain.connect(master);

      const mk = (freq: number, pan: number): OscillatorNode => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        osc.connect(panner);
        panner.connect(pulseGain);
        osc.start();
        this.track(osc);
        return osc;
      };
      mk(200, -1);
      mk(204, 1);
      lfo.start();
      this.track(lfo);
    } catch {
      // Audio may be unavailable or blocked — stay silent rather than crash.
    }
  }

  /** Stop all playing sources; the context stays alive for reuse. */
  stop(): void {
    try {
      this.stopSources();
    } catch {
      // Nothing playing or already torn down.
    }
  }

  /** Set the master volume, clamped to 0..1 (default 0.25). */
  setVolume(v: number): void {
    try {
      const clamped = Math.min(1, Math.max(0, v));
      this.volume = clamped;
      if (this.master) this.master.gain.value = clamped;
    } catch {
      // Volume changes cannot realistically fail; guarded anyway.
    }
  }

  /** Stop everything and close the context for good. */
  dispose(): void {
    try {
      this.stopSources();
    } catch {
      // Already stopped.
    }
    try {
      if (this.master) {
        this.master.disconnect();
        this.master = null;
      }
    } catch {
      // Ignore.
    }
    try {
      if (this.ctx) {
        void this.ctx.close();
        this.ctx = null;
      }
    } catch {
      // Ignore.
    }
  }
}
