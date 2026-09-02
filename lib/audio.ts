export class ArcadeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.3;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.3;
  }

  toggle() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private tone(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    peak: number,
    slide?: number,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== undefined) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    }
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(t: number, dur: number, peak: number, hp: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  coin() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone("square", 880, t, 0.07, 0.18);
    this.tone("square", 1175, t + 0.07, 0.07, 0.18);
    this.tone("square", 1568, t + 0.14, 0.14, 0.22);
  }

  shoot() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.07, 0.28, 900);
    this.tone("square", 220, t, 0.09, 0.16, 70);
  }

  dry() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.tone("square", 2100, ctx.currentTime, 0.04, 0.08);
  }

  hit() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone("triangle", 140, t, 0.1, 0.22, 50);
    this.noise(t, 0.05, 0.12, 400);
  }

  hurt() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.tone("sawtooth", 90, ctx.currentTime, 0.16, 0.2, 40);
  }

  death() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone("sawtooth", 420, t, 0.55, 0.24, 40);
    this.tone("square", 210, t + 0.05, 0.5, 0.12, 30);
  }

  wave() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone("square", 392, t, 0.16, 0.16);
    this.tone("square", 523, t + 0.16, 0.16, 0.16);
    this.tone("square", 784, t + 0.32, 0.28, 0.2);
  }

  pickup() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone("sine", 660, t, 0.06, 0.14);
    this.tone("sine", 880, t + 0.06, 0.06, 0.14);
    this.tone("sine", 1320, t + 0.12, 0.1, 0.16);
  }
}
