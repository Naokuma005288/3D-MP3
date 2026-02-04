const audio = document.getElementById("audio");
const fileInput = document.getElementById("file-input");
const loadBtn = document.getElementById("load-btn");
const playBtn = document.getElementById("play-btn");
const playIcon = document.getElementById("play-icon");
const stopBtn = document.getElementById("stop-btn");
const seek = document.getElementById("seek");
const volume = document.getElementById("volume");
const depth = document.getElementById("depth");
const focus = document.getElementById("focus");
const motionToggle = document.getElementById("motion-toggle");
const earlyMix = document.getElementById("early-mix");
const reverbLength = document.getElementById("reverb-length");
const reverbTone = document.getElementById("reverb-tone");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const trackName = document.getElementById("track-name");
const trackHint = document.getElementById("track-hint");
const presetGrid = document.getElementById("preset-grid");
const canvas = document.getElementById("viz");
const canvasCtx = canvas.getContext("2d");
const app = document.querySelector(".app");
const vizCard = document.querySelector(".viz-card");
const fullBtn = document.getElementById("viz-full-btn");
const abToggle = document.getElementById("ab-toggle");
const hudTitle = document.getElementById("viz-hud-title");
const hudPlay = document.getElementById("hud-play");
const hudStop = document.getElementById("hud-stop");
const vizTheme = document.getElementById("viz-theme");

const EARLY_COUNT = 6;

let audioCtx;
let sourceNode;
let masterGain;
let analyser;
let directGain;
let directPanner;
let earlyGain;
let earlySend;
let earlyDelays = [];
let earlyFilters = [];
let earlyPanners = [];
let reverbSend;
let convolver;
let reverbFilter;
let reverbGain;
let vizData;
let vizWave;
let vizLoopId;
let currentPreset;
let objectUrl;
let bypass3D = false;
let currentThemeId = "neon";

const vizThemes = [
  {
    id: "neon",
    name: "Neon",
    hueBase: 200,
    hueRange: 90,
    bgTop: [210, 60, 12],
    bgBottom: [230, 70, 6],
    gridHue: 200,
    glowHue: 190,
  },
  {
    id: "prism",
    name: "Prism",
    hueBase: 260,
    hueRange: 140,
    bgTop: [260, 55, 10],
    bgBottom: [300, 70, 6],
    gridHue: 280,
    glowHue: 260,
  },
  {
    id: "ember",
    name: "Ember",
    hueBase: 20,
    hueRange: 60,
    bgTop: [18, 65, 10],
    bgBottom: [5, 75, 7],
    gridHue: 24,
    glowHue: 28,
  },
];

const baseState = {
  direct: { gain: 1, pos: { x: 0, y: 0, z: -1.2 } },
  early: {
    gain: 0.25,
    config: {
      radius: 1.2,
      depth: 1.2,
      elevation: 0.2,
      delayBase: 0.01,
      delaySpread: 0.02,
      damp: 8000,
    },
    positions: [],
  },
  reverb: { gain: 0.25, duration: 2, decay: 2 },
  motion: { type: "none", speed: 0.2, radius: 0.6, elevation: 0.2 },
};

const presets = [
  {
    id: "studio",
    name: "スタジオ・フォーカス",
    desc: "近距離でくっきり",
    direct: { gain: 0.98, pos: { x: 0, y: 0, z: -1.1 } },
    early: {
      gain: 0.3,
      config: {
        radius: 0.7,
        depth: 0.7,
        elevation: 0.14,
        delayBase: 0.007,
        delaySpread: 0.018,
        damp: 9000,
      },
    },
    reverb: { gain: 0.2, duration: 1.2, decay: 1.7 },
    motion: { type: "none", speed: 0.1, radius: 0.4, elevation: 0.1 },
  },
  {
    id: "hall",
    name: "ワイド・ホール",
    desc: "広がりとバランス",
    direct: { gain: 0.9, pos: { x: 0, y: 0, z: -1.55 } },
    early: {
      gain: 0.5,
      config: {
        radius: 1.8,
        depth: 1.5,
        elevation: 0.24,
        delayBase: 0.014,
        delaySpread: 0.035,
        damp: 7000,
      },
    },
    reverb: { gain: 0.5, duration: 2.9, decay: 2.7 },
    motion: { type: "float", speed: 0.1, radius: 0.58, elevation: 0.16 },
  },
  {
    id: "club",
    name: "クラブ・パルス",
    desc: "短い残響でパンチ",
    direct: { gain: 1.0, pos: { x: 0.14, y: 0, z: -1.0 } },
    early: {
      gain: 0.44,
      config: {
        radius: 1.0,
        depth: 1.0,
        elevation: 0.18,
        delayBase: 0.01,
        delaySpread: 0.025,
        damp: 6800,
      },
    },
    reverb: { gain: 0.38, duration: 1.7, decay: 2.2 },
    motion: { type: "pulse", speed: 0.24, radius: 0.45, elevation: 0.12 },
  },
  {
    id: "orbit",
    name: "オービット",
    desc: "動くワイドステージ",
    direct: { gain: 0.85, pos: { x: 0, y: 0, z: -1.7 } },
    early: {
      gain: 0.55,
      config: {
        radius: 2.0,
        depth: 1.9,
        elevation: 0.28,
        delayBase: 0.017,
        delaySpread: 0.045,
        damp: 6800,
      },
    },
    reverb: { gain: 0.55, duration: 3.2, decay: 2.6 },
    motion: { type: "orbit", speed: 0.22, radius: 0.88, elevation: 0.28 },
  },
  {
    id: "cathedral",
    name: "カテドラル",
    desc: "高く豊かな残響",
    direct: { gain: 0.78, pos: { x: 0, y: 0, z: -2.0 } },
    early: {
      gain: 0.68,
      config: {
        radius: 2.5,
        depth: 2.3,
        elevation: 0.4,
        delayBase: 0.024,
        delaySpread: 0.065,
        damp: 5600,
      },
    },
    reverb: { gain: 0.75, duration: 4.8, decay: 3.2 },
    motion: { type: "float", speed: 0.08, radius: 0.65, elevation: 0.26 },
  },
  {
    id: "cinema",
    name: "シネマティック",
    desc: "巨大で包み込む",
    direct: { gain: 0.8, pos: { x: -0.14, y: 0.06, z: -1.9 } },
    early: {
      gain: 0.6,
      config: {
        radius: 2.3,
        depth: 2.0,
        elevation: 0.32,
        delayBase: 0.02,
        delaySpread: 0.055,
        damp: 6000,
      },
    },
    reverb: { gain: 0.68, duration: 4.0, decay: 2.9 },
    motion: { type: "orbit", speed: 0.16, radius: 0.75, elevation: 0.22 },
  },
  {
    id: "hyper",
    name: "ハイパースペース",
    desc: "超空間の伸び",
    direct: { gain: 0.72, pos: { x: 0, y: 0.08, z: -2.2 } },
    early: {
      gain: 0.75,
      config: {
        radius: 3.0,
        depth: 2.8,
        elevation: 0.45,
        delayBase: 0.028,
        delaySpread: 0.09,
        damp: 5200,
      },
    },
    reverb: { gain: 0.9, duration: 5.0, decay: 3.6 },
    motion: { type: "orbit", speed: 0.18, radius: 1.2, elevation: 0.4 },
  },
  {
    id: "arena",
    name: "アリーナ・サージ",
    desc: "巨大会場の圧",
    direct: { gain: 0.8, pos: { x: 0.1, y: 0, z: -2.1 } },
    early: {
      gain: 0.72,
      config: {
        radius: 2.6,
        depth: 2.3,
        elevation: 0.36,
        delayBase: 0.024,
        delaySpread: 0.07,
        damp: 5700,
      },
    },
    reverb: { gain: 0.8, duration: 4.4, decay: 3.2 },
    motion: { type: "pulse", speed: 0.2, radius: 0.8, elevation: 0.28 },
  },
  {
    id: "void",
    name: "ディープ・ヴォイド",
    desc: "深い虚空の残響",
    direct: { gain: 0.68, pos: { x: 0, y: 0.05, z: -2.6 } },
    early: {
      gain: 0.85,
      config: {
        radius: 3.2,
        depth: 2.9,
        elevation: 0.45,
        delayBase: 0.03,
        delaySpread: 0.085,
        damp: 4800,
      },
    },
    reverb: { gain: 0.95, duration: 6.2, decay: 3.8 },
    motion: { type: "orbit", speed: 0.14, radius: 1.05, elevation: 0.36 },
  },
];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audio);

  masterGain = audioCtx.createGain();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;
  vizData = new Uint8Array(analyser.frequencyBinCount);
  vizWave = new Uint8Array(analyser.fftSize);

  directGain = audioCtx.createGain();
  directPanner = audioCtx.createPanner();
  directPanner.panningModel = "HRTF";
  directPanner.distanceModel = "inverse";
  directPanner.refDistance = 1;
  directPanner.maxDistance = 100;
  directPanner.rolloffFactor = 1;

  earlyGain = audioCtx.createGain();
  earlySend = audioCtx.createGain();

  reverbSend = audioCtx.createGain();
  convolver = audioCtx.createConvolver();
  reverbFilter = audioCtx.createBiquadFilter();
  reverbFilter.type = "lowpass";
  reverbFilter.frequency.value = 7500;
  reverbFilter.Q.value = 0.7;
  reverbGain = audioCtx.createGain();

  sourceNode.connect(directGain);
  directGain.connect(directPanner);
  directPanner.connect(masterGain);

  sourceNode.connect(earlySend);

  for (let i = 0; i < EARLY_COUNT; i += 1) {
    const delay = audioCtx.createDelay(1);
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    const panner = audioCtx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "linear";
    panner.refDistance = 1;
    panner.maxDistance = 15;
    panner.rolloffFactor = 0.8;

    earlySend.connect(delay);
    delay.connect(filter);
    filter.connect(panner);
    panner.connect(earlyGain);

    earlyDelays.push(delay);
    earlyFilters.push(filter);
    earlyPanners.push(panner);
  }

  earlyGain.connect(masterGain);

  sourceNode.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(reverbFilter);
  reverbFilter.connect(reverbGain);
  reverbGain.connect(masterGain);

  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  masterGain.gain.value = Number(volume.value);
  applyPreset(presets[0]);
  startVisualizer();
}

function createImpulse(context, duration, decay) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = context.createBuffer(2, length, rate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const fade = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * fade;
    }
  }
  return impulse;
}

function setPannerPosition(panner, x, y, z) {
  if (panner.positionX) {
    panner.positionX.setValueAtTime(x, audioCtx.currentTime);
    panner.positionY.setValueAtTime(y, audioCtx.currentTime);
    panner.positionZ.setValueAtTime(z, audioCtx.currentTime);
  } else if (panner.setPosition) {
    panner.setPosition(x, y, z);
  }
}

function buildEarlyPositions(config) {
  baseState.early.positions = [];
  for (let i = 0; i < EARLY_COUNT; i += 1) {
    const angle = (i / EARLY_COUNT) * Math.PI * 2;
    const x = Math.cos(angle) * config.radius;
    const z = Math.sin(angle) * config.radius - config.depth;
    const y = (i % 2 === 0 ? 1 : -1) * config.elevation;
    baseState.early.positions.push({ x, y, z });
  }
}

function applyPreset(preset) {
  currentPreset = preset;
  baseState.direct = JSON.parse(JSON.stringify(preset.direct));
  baseState.early.gain = preset.early.gain;
  baseState.early.config = { ...preset.early.config };
  baseState.reverb = { ...preset.reverb };
  baseState.motion = { ...preset.motion };

  buildEarlyPositions(preset.early.config);
  applyEarlySettings();
  updateMixGains();
  updateReverbSettings();
  updatePannerPositions(0);
  updatePresetButtons();
}

function getDepthFactor() {
  return Number(depth?.value ?? 100) / 100;
}

function getEarlyFactor() {
  return Number(earlyMix?.value ?? 100) / 100;
}

function getReverbLengthFactor() {
  return Number(reverbLength?.value ?? 100) / 100;
}

function getReverbToneHz() {
  const base = baseState.early.config.damp * 0.85;
  const tone = Number(reverbTone?.value ?? 50) / 100;
  const scaled = base * (0.7 + tone * 0.9);
  return Math.min(12000, Math.max(3500, scaled));
}

function updateMixGains() {
  if (!audioCtx) return;
  const depthFactor = getDepthFactor();
  const earlyFactor = getEarlyFactor();
  directGain.gain.setValueAtTime(baseState.direct.gain, audioCtx.currentTime);
  if (bypass3D) {
    earlyGain.gain.setValueAtTime(0, audioCtx.currentTime);
    reverbGain.gain.setValueAtTime(0, audioCtx.currentTime);
    return;
  }
  earlyGain.gain.setValueAtTime(
    baseState.early.gain * depthFactor * earlyFactor,
    audioCtx.currentTime
  );
  reverbGain.gain.setValueAtTime(baseState.reverb.gain * depthFactor, audioCtx.currentTime);
}

function updateReverbSettings() {
  if (!audioCtx) return;
  const lengthFactor = getReverbLengthFactor();
  setReverb(baseState.reverb.duration * lengthFactor, baseState.reverb.decay * lengthFactor);
  if (reverbFilter) {
    reverbFilter.frequency.setValueAtTime(getReverbToneHz(), audioCtx.currentTime);
  }
}

function setReverb(duration, decay) {
  convolver.buffer = createImpulse(audioCtx, duration, decay);
}

function applyEarlySettings() {
  const config = baseState.early.config;
  for (let i = 0; i < EARLY_COUNT; i += 1) {
    const delayTime =
      config.delayBase + (config.delaySpread * i) / (EARLY_COUNT - 1);
    earlyDelays[i].delayTime.setValueAtTime(delayTime, audioCtx.currentTime);
    earlyFilters[i].frequency.setValueAtTime(config.damp, audioCtx.currentTime);
  }
}

function updatePannerPositions(time) {
  if (!audioCtx) return;
  const focusOffset = (Number(focus.value) / 100) * 1.2;
  const motionActive = motionToggle.checked && baseState.motion.type !== "none";
  const motion = baseState.motion;
  const base = baseState.direct.pos;

  let offset = { x: 0, y: 0, z: 0 };
  if (motionActive) {
    const angle = time * motion.speed * Math.PI * 2;
    if (motion.type === "orbit") {
      offset = {
        x: Math.cos(angle) * motion.radius,
        y: Math.sin(angle * 0.7) * motion.elevation,
        z: Math.sin(angle) * motion.radius,
      };
    } else if (motion.type === "float") {
      offset = {
        x: Math.sin(angle) * motion.radius,
        y: Math.cos(angle * 0.8) * motion.elevation,
        z: Math.sin(angle * 0.4) * motion.radius * 0.4,
      };
    } else if (motion.type === "pulse") {
      offset = {
        x: Math.sin(angle * 1.6) * motion.radius * 0.7,
        y: Math.cos(angle * 1.3) * motion.elevation * 0.6,
        z: Math.sin(angle * 0.9) * motion.radius * 0.3,
      };
    }
  }

  setPannerPosition(
    directPanner,
    base.x + offset.x,
    base.y + offset.y,
    base.z + offset.z - focusOffset
  );

  for (let i = 0; i < EARLY_COUNT; i += 1) {
    const pos = baseState.early.positions[i];
    if (!pos) continue;
    let extra = { x: 0, y: 0, z: 0 };
    if (motionActive) {
      const phase = time * motion.speed * Math.PI * 2 + i * 1.2;
      extra = {
        x: Math.cos(phase) * motion.radius * 0.2,
        y: Math.sin(phase * 0.8) * motion.elevation * 0.3,
        z: Math.sin(phase) * motion.radius * 0.15,
      };
    }
    setPannerPosition(
      earlyPanners[i],
      pos.x + extra.x,
      pos.y + extra.y,
      pos.z + extra.z
    );
  }
}

function startVisualizer() {
  if (vizLoopId) return;
  const baseWidth = 1920;
  const baseHeight = 1080;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = baseWidth;
    canvas.height = baseHeight;
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  let edgeGlow = 0;
  let edgeSpin = 0;

  const draw = () => {
    vizLoopId = requestAnimationFrame(draw);
    if (!analyser) return;
    analyser.getByteFrequencyData(vizData);
    analyser.getByteTimeDomainData(vizWave);

    const width = baseWidth;
    const height = baseHeight;
    const now = performance.now() / 1000;
    canvasCtx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const horizon = height * 0.4;
    const floor = height * 0.94;

    const band = (from, to) => {
      const end = Math.min(vizData.length, to);
      let sum = 0;
      for (let i = from; i < end; i += 1) sum += vizData[i];
      return end > from ? sum / (end - from) / 255 : 0;
    };

    const low = band(0, 12);
    const mid = band(12, 64);
    const high = band(64, 180);
    const energy = (low * 1.2 + mid + high * 0.8) / 3;

    const theme = getTheme();
    const hue = theme.hueBase + high * theme.hueRange;
    const hasVideo = !!(vizCard && vizCard.classList.contains("has-video"));
    if (app) {
      const target = Math.min(1, energy * 1.6);
      edgeGlow = edgeGlow * 0.85 + target * 0.15;
      edgeSpin += 0.003 + energy * 0.012;
      app.style.setProperty("--edge-alpha", (0.16 + edgeGlow * 0.45).toFixed(3));
      app.style.setProperty("--edge-alpha-2", (0.1 + edgeGlow * 0.35).toFixed(3));
      app.style.setProperty(
        "--edge-border",
        `rgba(120, 200, 255, ${(0.25 + edgeGlow * 0.55).toFixed(3)})`
      );
      app.style.setProperty("--edge-spin", `${edgeSpin}turn`);
    }
    const bg = canvasCtx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(
      0,
      `hsla(${theme.bgTop[0]}, ${theme.bgTop[1]}%, ${theme.bgTop[2]}%, 0.95)`
    );
    bg.addColorStop(
      0.6,
      `hsla(${theme.bgBottom[0]}, ${theme.bgBottom[1]}%, ${theme.bgBottom[2]}%, 0.98)`
    );
    bg.addColorStop(
      1,
      `hsla(${theme.bgBottom[0] - 10}, ${theme.bgBottom[1]}%, ${theme.bgBottom[2] - 2}%, 1)`
    );
    canvasCtx.fillStyle = bg;
    canvasCtx.globalAlpha = hasVideo ? 0.22 : 1;
    canvasCtx.fillRect(0, 0, width, height);
    canvasCtx.globalAlpha = 1;

    const glow = canvasCtx.createRadialGradient(
      centerX,
      horizon,
      width * 0.05,
      centerX,
      horizon,
      width * 0.7
    );
    glow.addColorStop(0, `hsla(${theme.glowHue}, 90%, 65%, ${0.15 + high * 0.3})`);
    glow.addColorStop(
      0.4,
      `hsla(${theme.glowHue + 40}, 85%, 62%, ${0.08 + mid * 0.2})`
    );
    glow.addColorStop(1, "rgba(8, 10, 18, 0)");
    canvasCtx.fillStyle = glow;
    canvasCtx.fillRect(0, 0, width, height);

    const lerp = (a, b, t) => a + (b - a) * t;
    const lineCount = 14;
    const flow = (now * (0.35 + low * 0.9)) % 1;
    canvasCtx.lineWidth = 1.2;
    for (let i = 0; i < lineCount; i += 1) {
      const z = (i / lineCount + flow) % 1;
      const ease = z * z;
      const y = horizon + ease * (floor - horizon);
      const w = lerp(width * 0.18, width * 1.12, ease);
      const alpha = (1 - z) * (0.12 + low * 0.3);
      canvasCtx.strokeStyle = `hsla(${theme.gridHue}, 80%, 70%, ${alpha})`;
      canvasCtx.beginPath();
      canvasCtx.moveTo(centerX - w / 2, y);
      canvasCtx.lineTo(centerX + w / 2, y);
      canvasCtx.stroke();
    }

    canvasCtx.save();
    canvasCtx.globalCompositeOperation = "lighter";
    canvasCtx.lineCap = "round";

    const ribbonAmp = height * 0.08 * (0.4 + mid);
    const ribbonBase = horizon + (floor - horizon) * 0.25;
    const ribbonGap = height * 0.026;
    const drawRibbon = (y, amp, color, widthLine, glowAmt) => {
      canvasCtx.strokeStyle = color;
      canvasCtx.lineWidth = widthLine;
      canvasCtx.shadowColor = color;
      canvasCtx.shadowBlur = glowAmt;
      canvasCtx.beginPath();
      for (let i = 0; i < vizWave.length; i += 4) {
        const t = i / (vizWave.length - 1);
        const x = t * width;
        const v = (vizWave[i] - 128) / 128;
        const wobble = Math.sin(t * Math.PI * 2 + now * 1.1) * high * 12;
        const yPos = y + v * amp + wobble;
        if (i === 0) {
          canvasCtx.moveTo(x, yPos);
        } else {
          canvasCtx.lineTo(x, yPos);
        }
      }
      canvasCtx.stroke();
      canvasCtx.shadowBlur = 0;
    };

    drawRibbon(
      ribbonBase,
      ribbonAmp,
      `hsla(${hue}, 92%, 70%, 0.7)`,
      2.4,
      14
    );
    drawRibbon(
      ribbonBase + ribbonGap,
      ribbonAmp * 0.7,
      `hsla(${hue - 24}, 90%, 65%, 0.55)`,
      2,
      10
    );
    drawRibbon(
      ribbonBase + ribbonGap * 2,
      ribbonAmp * 0.5,
      `hsla(${hue + 34}, 90%, 72%, 0.45)`,
      1.8,
      8
    );
    canvasCtx.restore();

    const barCount = 48;
    const barWidth = width / barCount;
    const barTop = floor - height * 0.02;
    const barMax = height * 0.18 * (0.7 + low * 0.8);
    for (let i = 0; i < barCount; i += 1) {
      const value = vizData[i * 2] / 255;
      const h = value * barMax;
      const x = i * barWidth + barWidth * 0.5;
      canvasCtx.strokeStyle = `hsla(${hue + value * 120}, 85%, 65%, ${
        0.08 + value * 0.6
      })`;
      canvasCtx.lineWidth = barWidth * 0.55;
      canvasCtx.beginPath();
      canvasCtx.moveTo(x, barTop);
      canvasCtx.lineTo(x, barTop - h);
      canvasCtx.stroke();
    }

    const coreRadius = Math.min(width, height) * (0.08 + low * 0.12);
    const core = canvasCtx.createRadialGradient(
      centerX,
      horizon,
      0,
      centerX,
      horizon,
      coreRadius * 3
    );
    core.addColorStop(0, `rgba(255, 255, 255, ${0.25 + low * 0.45})`);
    core.addColorStop(0.35, `hsla(${theme.glowHue}, 85%, 60%, ${0.2 + mid * 0.2})`);
    core.addColorStop(1, `hsla(${theme.glowHue}, 85%, 60%, 0)`);
    canvasCtx.fillStyle = core;
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, horizon, coreRadius * 2.2, 0, Math.PI * 2);
    canvasCtx.fill();

    updatePannerPositions(performance.now() / 1000);
  };
  draw();
}

function getTheme() {
  return vizThemes.find((theme) => theme.id === currentThemeId) || vizThemes[0];
}

function updateThemeButtons() {
  if (!vizTheme) return;
  vizTheme.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === currentThemeId);
  });
}

function setTheme(id) {
  currentThemeId = id;
  updateThemeButtons();
}

function updatePresetButtons() {
  const buttons = presetGrid.querySelectorAll(".preset-btn");
  const activeId = currentPreset ? currentPreset.id : presets[0].id;
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === activeId);
  });
}

function buildPresetButtons() {
  presetGrid.innerHTML = "";
  presets.forEach((preset) => {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.type = "button";
    btn.dataset.preset = preset.id;
    btn.innerHTML = `<strong>${preset.name}</strong><span>${preset.desc}</span>`;
    btn.addEventListener("click", () => {
      if (!audioCtx) ensureAudio();
      applyPreset(preset);
    });
    presetGrid.appendChild(btn);
  });
  updatePresetButtons();
}

function handlePlay() {
  ensureAudio();
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
  updatePlayState();
}

function updatePlayState() {
  const isPlaying = !audio.paused;
  playIcon.textContent = isPlaying ? "一時停止" : "再生";
  if (hudPlay) hudPlay.textContent = isPlaying ? "一時停止" : "再生";
}

function handleStop() {
  audio.pause();
  audio.currentTime = 0;
  updatePlayState();
}

function handleFile() {
  const file = fileInput.files[0];
  if (!file) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  const name = file.name.toLowerCase();
  const isVideo = file.type.startsWith("video/") || name.endsWith(".mp4");
  if (vizCard) vizCard.classList.toggle("has-video", isVideo);
  const cleanName = file.name.replace(/\.[^/.]+$/, "");
  trackName.textContent = cleanName;
  if (hudTitle) hudTitle.textContent = cleanName;
  trackHint.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  ensureAudio();
  audio.load();
  audio.addEventListener(
    "loadedmetadata",
    () => {
      seek.max = audio.duration.toString();
      durationEl.textContent = formatTime(audio.duration);
    },
    { once: true }
  );
}

function toggleFullscreen() {
  if (!vizCard) return;
  const isFs = document.fullscreenElement === vizCard;
  if (!isFs) {
    if (vizCard.requestFullscreen) {
      vizCard.requestFullscreen().catch(() => {});
    }
  } else if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

function syncFullscreenState() {
  if (!vizCard || !fullBtn) return;
  const isFs = document.fullscreenElement === vizCard;
  vizCard.classList.toggle("is-fullscreen", isFs);
  fullBtn.textContent = isFs ? "閉じる" : "全画面";
}

function toggleBypass() {
  bypass3D = !bypass3D;
  if (abToggle) {
    abToggle.textContent = bypass3D ? "A/B: 3D OFF" : "A/B: 3D ON";
    abToggle.classList.toggle("active", bypass3D);
  }
  updateMixGains();
}

function handleSeek() {
  audio.currentTime = Number(seek.value);
}

function handleTimeUpdate() {
  seek.value = audio.currentTime.toString();
  currentTimeEl.textContent = formatTime(audio.currentTime);
}

function updateDepth() {
  updateMixGains();
}

function updateVolume() {
  if (!audioCtx) return;
  masterGain.gain.setValueAtTime(Number(volume.value), audioCtx.currentTime);
}

loadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFile);
playBtn.addEventListener("click", handlePlay);
stopBtn.addEventListener("click", handleStop);
seek.addEventListener("input", handleSeek);
audio.addEventListener("timeupdate", handleTimeUpdate);
audio.addEventListener("ended", updatePlayState);
volume.addEventListener("input", updateVolume);
depth.addEventListener("input", updateDepth);
focus.addEventListener("input", () => updatePannerPositions(performance.now() / 1000));
motionToggle.addEventListener("change", () => updatePannerPositions(performance.now() / 1000));
if (earlyMix) earlyMix.addEventListener("input", updateMixGains);
if (reverbLength) reverbLength.addEventListener("input", updateReverbSettings);
if (reverbTone) reverbTone.addEventListener("input", updateReverbSettings);
if (fullBtn) fullBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenState);
if (abToggle) abToggle.addEventListener("click", toggleBypass);
if (hudPlay) hudPlay.addEventListener("click", handlePlay);
if (hudStop) hudStop.addEventListener("click", handleStop);
if (vizTheme) {
  vizTheme.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme));
  });
}

buildPresetButtons();
updatePlayState();
syncFullscreenState();
updateThemeButtons();
if (abToggle) abToggle.classList.toggle("active", bypass3D);
