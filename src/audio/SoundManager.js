// Web Audio API Procedural Sound Synthesizer for UFC Ragdoll Fighting
// Generates realistic punch thuds, glove snaps, cage rattles, canvas slams, bell, and crowd reactions

class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.crowdGain = null;
    this.crowdSource = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
      this.initCrowdAmbience();
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Heavy punch impact (leather glove connecting to face/body)
  playPunch(power = 1.0, isCounter = false) {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    
    // Sub-bass thud (thump)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isCounter ? 180 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12 * power);

    oscGain.gain.setValueAtTime(0.7 * power, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14 * power);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15 * power);

    // Leather crack (snappy noise)
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isCounter ? 1600 : 900, t);
    filter.Q.setValueAtTime(2.5, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6 * power, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08 * power);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.09 * power);

    // If counter, boost crowd gasp
    if (isCounter) {
      this.triggerCrowdCheer(0.5);
    }
  }

  // Snappy Jab / Quick strike
  playJab() {
    this.playPunch(0.6, false);
  }

  // Big Hook / Overhand / Headkick
  playHeavyImpact(isCounter = false) {
    this.playPunch(1.3, isCounter);
  }

  // Aerodynamic swoosh (fast head slip, dodge, or strike swing through air)
  playSwoosh(volume = 0.5) {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.16);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(250, t + 0.16);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4 * volume, t + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.16);
  }

  // Heavy landing thud when fighter's 85kg mass lands on the canvas
  playJumpLand() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    
    // Deep 55Hz sub-bass canvas boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(95, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.18);

    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.22);

    // Canvas mat friction rustle
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.75, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.13);
  }

  // Takedown slam to the Octagon canvas
  playMatSlam() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    
    // Deep 45Hz sub-bass canvas boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(85, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.35);

    subGain.gain.setValueAtTime(0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.4);

    // Heavy canvas mat slap noise
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.16);

    this.triggerCrowdCheer(0.6);
  }

  // Metallic cage fence rattle
  playCageRattle() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const freqs = [380, 520, 840, 1150];
    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq + (Math.random() * 30 - 15), t);
      
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  // UFC Round Bell
  playBell() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const freqs = [784, 1568, 2352]; // G5 harmonic bell
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const amp = 0.25 / (idx + 1);
      gain.gain.setValueAtTime(amp, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 1.25);
    });
  }

  // Knockout dramatic sound
  playKnockout() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;

    // Heavy low crash
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + 0.6);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.7);

    // Roaring crowd
    this.triggerCrowdCheer(1.0);
  }

  // Background Arena Ambience & Dynamic Crowd Cheer
  initCrowdAmbience() {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 4;
      const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
      const dataL = buffer.getChannelData(0);
      const dataR = buffer.getChannelData(1);
      
      // Dual-channel warm brown noise simulating arena stadium acoustics
      let lastOutL = 0.0;
      let lastOutR = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const whiteL = Math.random() * 2 - 1;
        const whiteR = Math.random() * 2 - 1;
        lastOutL = (lastOutL + 0.04 * whiteL) / 1.04;
        lastOutR = (lastOutR + 0.04 * whiteR) / 1.04;
        dataL[i] = lastOutL * 2.5;
        dataR[i] = lastOutR * 2.5;
      }

      this.crowdSource = this.ctx.createBufferSource();
      this.crowdSource.buffer = buffer;
      this.crowdSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.setValueAtTime(0.10, this.ctx.currentTime); // Realistic lively arena murmur

      this.crowdSource.connect(filter);
      filter.connect(this.crowdGain);
      this.crowdGain.connect(this.ctx.destination);

      this.crowdSource.start();
    } catch (e) {
      console.warn("Crowd audio init skipped", e);
    }
  }

  triggerCrowdCheer(amount = 0.5) {
    if (!this.crowdGain || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const target = 0.12 + 0.35 * Math.min(1.0, amount);
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(target, t + 0.08);
    this.crowdGain.gain.exponentialRampToValueAtTime(0.10, t + 3.0);

    // Formant sweep vocal burst ("OHHHH / CHEER")
    try {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const formantFilter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140 + Math.random() * 40, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.45);

      formantFilter.type = 'bandpass';
      formantFilter.frequency.setValueAtTime(450, t);
      formantFilter.Q.setValueAtTime(3.0, t);

      const peakVol = 0.08 * amount;
      oscGain.gain.setValueAtTime(0.001, t);
      oscGain.gain.linearRampToValueAtTime(peakVol, t + 0.06);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(formantFilter);
      formantFilter.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.65);
    } catch (err) {}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const sounds = new SoundManager();
