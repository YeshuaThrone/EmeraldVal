type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export class CableSoundFX {
  private static audioCtx: AudioContext | null = null;

  private static getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not available");
      }
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Synthesizes an authentic mechanical channel switch click sound
   */
  public static playChannelClick() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn("Audio FX blocked by browser policy:", e);
    }
  }

  /**
   * Synthesizes white noise static burst during channel transitions
   */
  public static playStaticBurst(durationMs: number = 250) {
    try {
      const ctx = this.getContext();
      const bufferSize = (ctx.sampleRate * durationMs) / 1000;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // Pure white noise
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + durationMs / 1000,
      );

      noise.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {
      console.warn("Audio FX blocked by browser policy:", e);
    }
  }
}
