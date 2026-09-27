/* ============================================================
   AudioManager - lightweight synthesized SFX + ambient pad
   using the WebAudio API only (no external audio files needed,
   keeps the game fully self-contained & offline-capable).
   ============================================================ */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxOn = true;
    this.musicOn = true;
    this._musicNodes = null;
    this._unlocked = false;
  }

  _ensureCtx() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
  }

  unlock() {
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this._unlocked) {
      this._unlocked = true;
      if (this.musicOn) this.startAmbient();
    }
  }

  setSfx(on) { this.sfxOn = on; }
  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.startAmbient(); else this.stopAmbient();
  }

  _tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.2, freqEnd = null, delay = 0, attack = 0.005 }) {
    if (!this.sfxOn) return;
    this._ensureCtx();
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noiseBurst({ dur = 0.15, gain = 0.18, delay = 0, filterFreq = 1200 }) {
    if (!this.sfxOn) return;
    this._ensureCtx();
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
  }

  coin() {
    this._tone({ freq: 880, type: 'triangle', dur: 0.09, gain: 0.18 });
    this._tone({ freq: 1320, type: 'triangle', dur: 0.12, gain: 0.14, delay: 0.05 });
  }

  deflect() {
    this._tone({ freq: 220, freqEnd: 660, type: 'square', dur: 0.12, gain: 0.12 });
    this._noiseBurst({ dur: 0.08, gain: 0.1, filterFreq: 2200 });
  }

  powerup() {
    this._tone({ freq: 440, freqEnd: 1100, type: 'sawtooth', dur: 0.28, gain: 0.15 });
  }

  comboMilestone() {
    [0, 0.07, 0.14].forEach((d, i) => {
      this._tone({ freq: 660 + i * 220, type: 'sine', dur: 0.15, gain: 0.16, delay: d });
    });
  }

  hit() {
    this._tone({ freq: 180, freqEnd: 40, type: 'sawtooth', dur: 0.35, gain: 0.25 });
    this._noiseBurst({ dur: 0.3, gain: 0.22, filterFreq: 500 });
  }

  click() {
    this._tone({ freq: 520, type: 'sine', dur: 0.05, gain: 0.1 });
  }

  unlockJingle() {
    [0, 0.1, 0.2, 0.32].forEach((d, i) => {
      this._tone({ freq: [523, 659, 784, 1046][i], type: 'triangle', dur: 0.18, gain: 0.14, delay: d });
    });
  }

  startAmbient() {
    if (!this.musicOn) return;
    this._ensureCtx();
    if (this._musicNodes) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.master);

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 164.81;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(g.gain);

    o1.connect(g);
    o2.connect(g);
    o1.start(); o2.start(); lfo.start();
    this._musicNodes = { g, o1, o2, lfo };
  }

  stopAmbient() {
    if (!this._musicNodes) return;
    const { g, o1, o2, lfo } = this._musicNodes;
    const t = this.ctx.currentTime;
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) {} }, 500);
    this._musicNodes = null;
  }
}

window.audioManager = new AudioManager();
