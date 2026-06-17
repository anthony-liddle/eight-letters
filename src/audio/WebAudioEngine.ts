import type { AudioEngine } from './AudioEngine.ts';

/** A note as a frequency in hertz. */
type Hz = number;

// A small pentatonic-ish set keeps cues consonant and lo-fi, never jarring.
const FOUND_NOTES: readonly Hz[] = [
  392.0, // G4  (length 3)
  440.0, // A4  (4)
  523.25, // C5 (5)
  587.33, // D5 (6)
  659.25, // E5 (7)
  783.99, // G5 (8, though the source cue usually takes over here)
];

/** The crown: a gentle rising arpeggio, brighter than any found cue. */
const SOURCE_ARPEGGIO: readonly Hz[] = [523.25, 659.25, 783.99, 1046.5];

const INVALID_NOTES: readonly Hz[] = [196.0, 174.61]; // a soft descending pair

/**
 * Prototype-level synth built on the Web Audio API. Quiet, lo-fi, behind the
 * AudioEngine interface. The context is created lazily on the first cue, since
 * browsers only allow audio to start from a user gesture.
 */
export class WebAudioEngine implements AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.18; // keep it gentle
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  /** Play one enveloped note. Short attack, smooth exponential release. */
  private note(
    freq: Hz,
    startOffset: number,
    duration: number,
    type: OscillatorType = 'sine',
    peak = 1,
  ): void {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master) return;

    const t0 = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  playFound(length: number): void {
    if (!this.ensureContext()) return;
    const i = Math.min(Math.max(length - 3, 0), FOUND_NOTES.length - 1);
    const freq = FOUND_NOTES[i]!;
    this.note(freq, 0, 0.28, 'sine', 0.9);
    this.note(freq * 2, 0, 0.18, 'sine', 0.18); // soft octave shimmer
  }

  playSource(): void {
    if (!this.ensureContext()) return;
    SOURCE_ARPEGGIO.forEach((freq, i) => {
      this.note(freq, i * 0.1, 0.5, 'triangle', 0.8);
    });
  }

  playInvalid(): void {
    if (!this.ensureContext()) return;
    INVALID_NOTES.forEach((freq, i) => {
      this.note(freq, i * 0.08, 0.16, 'sine', 0.5);
    });
  }

  tick(): void {
    if (!this.ensureContext()) return;
    this.note(880, 0, 0.03, 'square', 0.12);
  }
}
