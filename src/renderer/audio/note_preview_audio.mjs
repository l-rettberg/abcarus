function midiToFreq(noteNumber) {
  const note = Number(noteNumber);
  if (!Number.isFinite(note)) return 440;
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class NotePreviewAudio {
  constructor() {
    this.ctx = null;
    this.unlockPromise = null;
    this.master = null;
  }

  async ensure() {
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      this.ctx = null;
      this.master = null;
      return null;
    }
  }

  async unlock() {
    const ctx = await this.ensure();
    if (!ctx) return false;
    if (ctx.state === "running") return true;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = (async () => {
      try { await ctx.resume(); } catch {}
      return ctx.state === "running";
    })();
    const ok = await this.unlockPromise;
    this.unlockPromise = null;
    return ok;
  }

  async playMidiNote(noteNumber, opts = {}) {
    const ctx = await this.ensure();
    if (!ctx) return false;
    if (ctx.state !== "running") {
      const unlocked = await this.unlock();
      if (!unlocked) return false;
    }

    const freq = midiToFreq(noteNumber);
    const durationMs = Number.isFinite(Number(opts.durationMs)) ? Number(opts.durationMs) : 140;
    const volume = Number.isFinite(Number(opts.volume)) ? Number(opts.volume) : 0.2;
    const duration = Math.max(0.04, Math.min(0.4, durationMs / 1000));
    const peak = Math.max(0, Math.min(1, volume));
    const now = ctx.currentTime;
    const attack = Math.min(0.008, duration * 0.18);
    const hold = Math.max(0, duration * 0.4);
    const release = Math.max(0.02, duration - attack - hold);
    const end = now + duration;

    const oscMain = ctx.createOscillator();
    const oscColor = ctx.createOscillator();
    const mix = ctx.createGain();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscMain.type = "triangle";
    oscMain.frequency.setValueAtTime(freq, now);

    oscColor.type = "sine";
    oscColor.frequency.setValueAtTime(freq * 2, now);

    mix.gain.value = 1;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.linearRampToValueAtTime(peak * 0.7, now + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.max(900, freq * 4), now);
    filter.Q.value = 0.6;

    oscMain.connect(gain);
    oscColor.connect(gain);
    gain.connect(filter);
    filter.connect(mix);
    mix.connect(this.master || ctx.destination);

    oscMain.start(now);
    oscColor.start(now);
    oscMain.stop(end);
    oscColor.stop(end);

    const cleanup = () => {
      try { oscMain.disconnect(); } catch {}
      try { oscColor.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { mix.disconnect(); } catch {}
    };
    oscMain.onended = cleanup;
    oscColor.onended = cleanup;
    return true;
  }
}

