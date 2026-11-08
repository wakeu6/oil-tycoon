class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.adMuted = false;
    this.tabMuted = false;
    this.initialized = false;
    this.activeNodes = [];

    try {
      const savedMute = localStorage.getItem("oil_tycoon_muted");
      if (savedMute !== null) {
        this.isMuted = JSON.parse(savedMute);
      }
    } catch (e) {
      this.isMuted = false;
    }
  }

  get isEffectivelyMuted() {
    return this.isMuted || this.adMuted || this.tabMuted;
  }

  setAdMuted(state) {
    this.adMuted = Boolean(state);
    if (this.isEffectivelyMuted && this.ctx && this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    } else if (!this.isEffectivelyMuted && this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setTabMuted(state) {
    this.tabMuted = Boolean(state);
    if (this.isEffectivelyMuted && this.ctx && this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    } else if (!this.isEffectivelyMuted && this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
      }
    } catch (e) {}
  }

  unlock() {
    if (!this.ctx) this.init();
    if (this.ctx && !this.isEffectivelyMuted && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem("oil_tycoon_muted", JSON.stringify(this.isMuted));
    } catch (e) {}
    if (this.isMuted && this.ctx && this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    } else if (!this.isEffectivelyMuted && this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.isMuted;
  }

  getVariance(base, spread = 0.12) {
    return base * (1.0 + (Math.random() - 0.5) * spread * 2);
  }

  getOutputNode() {
    return this.masterGain || this.ctx?.destination;
  }

  duckMaster(duration = 2.0, duckFactor = 0.4) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(duckFactor, now + 0.08);
      this.masterGain.gain.setValueAtTime(duckFactor, now + duration - 0.2);
      this.masterGain.gain.linearRampToValueAtTime(1.0, now + duration);
    } catch (e) {}
  }

  playTap() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const dest = this.getOutputNode();

    // Body thud with ±10% pitch variance
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const startFreq = this.getVariance(140, 0.10);

    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.08);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.08);

    // Click transient
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    const clickFreq = this.getVariance(520, 0.12);

    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(clickFreq, now);
    clickOsc.frequency.exponentialRampToValueAtTime(80, now + 0.04);
    clickGain.gain.setValueAtTime(0.14, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    clickOsc.connect(clickGain);
    clickGain.connect(dest);
    clickOsc.start(now);
    clickOsc.stop(now + 0.04);
  }

  playClick() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const dest = this.getOutputNode();

    try {
      // Subtle tactile click ~40ms, gain 0.08, pitch variation ±10%
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const freq = this.getVariance(820, 0.10);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  playError() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    const dest = this.getOutputNode();
    const now = this.ctx.currentTime;

    try {
      // Two rapid low buzz pulses 80ms, 140Hz -> 110Hz, gain 0.12
      const pulseOffsets = [0, 0.10];
      pulseOffsets.forEach((tOffset) => {
        const t = now + tOffset;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const baseFreq = this.getVariance(140, 0.08);

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * (110 / 140), t + 0.08);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.08);
      });
    } catch (e) {}
  }

  playInsufficientFunds() {
    this.playError();
  }

  playCoin() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const dest = this.getOutputNode();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const f1 = this.getVariance(987.77, 0.08);
    const f2 = this.getVariance(1318.51, 0.08);

    osc.type = "sine";
    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.setValueAtTime(f2, now + 0.06);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playPayout() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    const dest = this.getOutputNode();
    // Pentatonic chime arpeggio: C5, E5, G5, A5, C6 (ZeptoLab celebration feel)
    const notes = [523.25, 659.25, 783.99, 880.00, 1046.50];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(this.getVariance(freq, 0.03), now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.22);
    });
  }

  playHorn() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const dest = this.getOutputNode();

    // Dual-tone pneumatic truck horn (F3 ~174Hz & A3 ~220Hz)
    const freqs = [this.getVariance(290, 0.05), this.getVariance(348, 0.05)];
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.setValueAtTime(0.12, now + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  playUpgrade() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    this.duckMaster(0.45, 0.65); // Momentarily duck background by ~35%
    const dest = this.getOutputNode();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(this.getVariance(freq, 0.05), now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.18);
    });
  }

  playBoost() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const dest = this.getOutputNode();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.45);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  vibrate(duration = 15) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  }

  playEmergencySiren(duration = 2.4) {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    this.duckMaster(duration, 0.35); // Duck other audio by -30%
    try {
      const now = this.ctx.currentTime;
      const dest = this.getOutputNode();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      const cycleTime = 0.6;
      const cycles = Math.ceil(duration / cycleTime);
      for (let c = 0; c < cycles; c++) {
        const t0 = now + c * cycleTime;
        const tMid = t0 + cycleTime * 0.5;
        const t1 = t0 + cycleTime;
        osc.frequency.setValueAtTime(520, t0);
        osc.frequency.exponentialRampToValueAtTime(980, Math.min(tMid, now + duration));
        osc.frequency.exponentialRampToValueAtTime(520, Math.min(t1, now + duration));
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
      gain.gain.setValueAtTime(0.18, now + duration - 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + duration);
      this.activeNodes.push(osc);
    } catch (e) {}
  }

  playSteamHiss(duration = 2.0) {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    if (typeof this.ctx.createBuffer !== "function" || typeof this.ctx.createBufferSource !== "function") {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      const dest = this.getOutputNode();
      const sampleRate = this.ctx.sampleRate || 44100;
      const bufferSize = Math.floor(sampleRate * Math.min(duration, 1.5));
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.05);
      gain.gain.setValueAtTime(0.16, now + duration - 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      if (typeof this.ctx.createBiquadFilter === "function") {
        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(3400, now);
        filter.Q.setValueAtTime(2.8, now);
        whiteNoise.connect(filter);
        filter.connect(gain);
      } else {
        whiteNoise.connect(gain);
      }
      gain.connect(dest);
      whiteNoise.start(now);
      whiteNoise.stop(now + duration);
      this.activeNodes.push(whiteNoise);
    } catch (e) {}
  }

  playExchangeBell() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    try {
      const now = this.ctx.currentTime;
      const dest = this.getOutputNode();
      // Ceremonial MOEX/NYSE Exchange Bell strikes
      const strikes = [0, 0.11, 0.23, 0.36, 0.50, 0.68, 0.88];
      strikes.forEach((tOffset, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + tOffset;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(i % 2 === 0 ? 1174.66 : 1480.0, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.24, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.3);
        this.activeNodes.push(osc);
      });
    } catch (e) {}
  }

  stopAccidentSounds() {
    for (let i = 0; i < this.activeNodes.length; i++) {
      try {
        this.activeNodes[i].stop();
      } catch (e) {}
    }
    this.activeNodes.length = 0;
  }

  playBrakeHiss() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    try {
      const now = this.ctx.currentTime;
      const dest = this.getOutputNode();
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.45);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.45);
    } catch (_) {}
  }

  playSnowShovel() {
    if (this.isEffectivelyMuted || !this.ctx) return;
    this.unlock();
    try {
      const now = this.ctx.currentTime;
      const dest = this.getOutputNode();
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      const pitchVar = 1.0 + (Math.random() - 0.5) * 0.25;
      filter.frequency.setValueAtTime(750 * pitchVar, now);
      filter.Q.setValueAtTime(1.8, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.22);
    } catch (_) {}
  }
}

export const audio = new AudioManager();
