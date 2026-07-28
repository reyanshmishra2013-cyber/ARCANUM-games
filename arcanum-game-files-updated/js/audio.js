const STATE = {
  difficulty: 'apprentice',
  mode: 'classic', // 'veil' | 'classic' | 'timed' | 'hard' | 'oracle'
  cards: [],
  flippedCards: [],
  matchedCount: 0,
  moves: 0,
  streak: 0,
  maxStreak: 0,
  startTime: null,
  elapsedTime: 0,
  timeRemaining: 0,
  lives: MAX_LIVES,
  moveLimit: 15,
  veilNextShuffle: null,
  timerInterval: null,
  locked: true,
  gameStarted: false,
  gameComplete: false,
  gameOver: false,
  wasAtOneLife: false,
  flipTimeout: null,
  aiTurnTimeout: null,
  aiSecondFlipTimeout: null,
  hiddenAt: null,
  currentPlayer: 1,
  p1Pairs: 0,
  p2Pairs: 0,
  aiMemory: [],           // AI Duel: [{idx, symbol}] of cards the bot has seen since they were last hidden
  aiMemoryCapacity: 6,    // how many revealed cards the bot can "remember" at once
  aiThinking: false,
  dailySeed: null,
  mpSeed: null,           // Duel Online: shuffle seed shared by both players so their boards match exactly
  powerupsUsed: new Set(), // which power-ups (Seer's Glimpse / Fate's Pardon) were used this game
};

/* ============================================================
   AUDIO ENGINE — Web Audio API, fully synthesized
   ============================================================ */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicPlaying = false;
    this.musicLayers = [];
    this.arpeggioTimeout = null;
    this.reverbNode = null;
    this.muted = false;
    // Base levels (unscaled) — actual applied gain is base * volume fraction (0..1),
    // so the sliders in Settings work as a percentage of the original mix.
    this.musicVolume = 0.8;
    this.sfxVolume = 0.85;
    this.musicBase = 0.42;
    this.sfxBase = 0.85;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.75;
    this.masterGain.connect(this.ctx.destination);

    // Simple reverb-like effect using delay + feedback
    this.reverbNode = this.ctx.createDelay(1.0);
    this.reverbNode.delayTime.value = 0.18;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.32;
    const reverbWet = this.ctx.createGain();
    reverbWet.gain.value = 0.35;
    this.reverbNode.connect(feedback);
    feedback.connect(this.reverbNode);
    this.reverbNode.connect(reverbWet);
    reverbWet.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicBase * this.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxBase * this.sfxVolume;
    this.sfxGain.connect(this.masterGain);
    this.sfxGain.connect(this.reverbNode);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Called by the Settings panel sliders — 0..100. Applied immediately if the
  // audio graph already exists; otherwise just remembered for init() to use.
  setMusicVolume(pct) {
    this.musicVolume = Math.max(0, Math.min(100, pct)) / 100;
    if (this.musicGain) this.musicGain.gain.value = this.musicBase * this.musicVolume;
  }
  setSfxVolume(pct) {
    this.sfxVolume = Math.max(0, Math.min(100, pct)) / 100;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxBase * this.sfxVolume;
  }

  // Bell-like chime for a successful match
  playChime(baseFreq = 523.25) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const harmonics = [
      { f: baseFreq,       type: 'sine',     g: 0.32, d: 1.8 },
      { f: baseFreq * 1.5, type: 'sine',     g: 0.18, d: 1.4 },
      { f: baseFreq * 2,   type: 'triangle', g: 0.12, d: 1.0 },
      { f: baseFreq * 3,   type: 'sine',     g: 0.06, d: 0.6 },
    ];
    harmonics.forEach(h => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = h.type;
      osc.frequency.value = h.f;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(h.g, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + h.d);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + h.d + 0.05);
    });
  }

  // Descending dissonant tone for a miss
  playMiss() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.55);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(242, now);
    osc2.frequency.exponentialRampToValueAtTime(88, now + 0.55);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.55);
    filter.Q.value = 4;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.sfxGain);
    osc.start(now); osc2.start(now);
    osc.stop(now + 0.7); osc2.stop(now + 0.7);
  }

  // Quick soft click on flip
  playFlip() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Ascending arpeggio + sparkles for streak fanfare
  playStreakFanfare(streakCount) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Pitch climbs with streak (cap at +7 semitones)
    const semitones = Math.min(Math.max(streakCount - 2, 0), 7);
    const baseFreq = 392 * Math.pow(2, semitones / 12); // G4 base
    const scale = [1, 1.25, 1.5, 2, 2.5, 3];
    const notes = scale.map(s => baseFreq * s);

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + i * 0.06;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.75);
    });

    // High sparkles
    setTimeout(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 2200 + Math.random() * 2500;
        const start = t + i * 0.035;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.07, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + 0.2);
      }
    }, 180);
  }

  // Triumphant chord sweep on game completion
  playCompletion() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // I - V - vi - IV in C major, layered
    const progression = [
      { root: 261.63, third: 329.63, fifth: 392.0,  oct: 523.25 }, // C
      { root: 392.0,  third: 493.88, fifth: 587.33, oct: 783.99 }, // G
      { root: 220.0,  third: 261.63, fifth: 329.63, oct: 440.0  }, // Am
      { root: 349.23, third: 440.0,  fifth: 523.25, oct: 698.46 }, // F
      { root: 523.25, third: 659.25, fifth: 783.99, oct: 1046.5 }, // C oct up
    ];
    progression.forEach((chord, idx) => {
      const start = now + idx * 0.32;
      [chord.root, chord.third, chord.fifth, chord.oct].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.value = freq;
        const peak = 0.12 / (i + 1);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2200;
        osc.connect(filter).connect(gain).connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + 1.45);
      });
    });
  }

  // Layered ambient background music
  startMusic() {
    if (!this.ctx || this.musicPlaying || this.muted) return;
    this.musicPlaying = true;
    const ctx = this.ctx;

    // LAYER 1: Deep drone — C2 + G2 sine
    const drone1 = ctx.createOscillator();
    const drone2 = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone1.type = 'sine'; drone1.frequency.value = 65.41;
    drone2.type = 'sine'; drone2.frequency.value = 98.0;
    droneGain.gain.value = 0.11;
    drone1.connect(droneGain); drone2.connect(droneGain);
    droneGain.connect(this.musicGain);
    drone1.start(); drone2.start();

    // LAYER 2: Pad — sawtooth through filter with slow LFO
    const pad = ctx.createOscillator();
    const padGain = ctx.createGain();
    const padFilter = ctx.createBiquadFilter();
    const padLfo = ctx.createOscillator();
    const padLfoGain = ctx.createGain();
    pad.type = 'sawtooth'; pad.frequency.value = 261.63;
    padFilter.type = 'lowpass'; padFilter.frequency.value = 600; padFilter.Q.value = 3;
    padGain.gain.value = 0.05;
    padLfo.frequency.value = 0.13;
    padLfoGain.gain.value = 4;
    padLfo.connect(padLfoGain).connect(pad.frequency);
    pad.connect(padFilter).connect(padGain).connect(this.musicGain);
    pad.start(); padLfo.start();

    // LAYER 3: High shimmer — sine with tremolo
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    const shimmerLfo = ctx.createOscillator();
    const shimmerLfoGain = ctx.createGain();
    shimmer.type = 'sine'; shimmer.frequency.value = 1046.5;
    shimmerGain.gain.value = 0.015;
    shimmerLfo.type = 'sine'; shimmerLfo.frequency.value = 0.27;
    shimmerLfoGain.gain.value = 0.012;
    shimmerLfo.connect(shimmerLfoGain).connect(shimmerGain.gain);
    shimmer.connect(shimmerGain).connect(this.musicGain);
    shimmer.start(); shimmerLfo.start();

    this.musicLayers = [drone1, drone2, pad, padLfo, shimmer, shimmerLfo];

    // LAYER 4: Random arpeggios from C major pentatonic
    this._scheduleArpeggio();
  }

  _scheduleArpeggio() {
    if (!this.musicPlaying || !this.ctx) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const note = notes[Math.floor(Math.random() * notes.length)];
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    osc.connect(gain).connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 2.85);

    this.arpeggioTimeout = setTimeout(() => this._scheduleArpeggio(), 2400 + Math.random() * 2800);
  }

  stopMusic() {
    if (!this.musicPlaying) return;
    this.musicPlaying = false;
    clearTimeout(this.arpeggioTimeout);
    this.musicLayers.forEach(osc => { try { osc.stop(); } catch(e){} });
    this.musicLayers = [];
  }
}
const audio = new AudioEngine();

/* ============================================================
   STARFIELD — twinkling background canvas
   ============================================================ */
