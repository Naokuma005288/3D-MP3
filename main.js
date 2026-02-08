const audio = document.getElementById("audio");
const fileInput = document.getElementById("file-input");
const loadBtn = document.getElementById("load-btn");
const resetBtn = document.getElementById("reset-btn");
const playBtn = document.getElementById("play-btn");
const playIcon = document.getElementById("play-icon");
const stopBtn = document.getElementById("stop-btn");
const seek = document.getElementById("seek");
const volume = document.getElementById("volume");
const depth = document.getElementById("depth");
const focus = document.getElementById("focus");
const motionToggle = document.getElementById("motion-toggle");
const motionIntensity = document.getElementById("motion-intensity");
const earlyMix = document.getElementById("early-mix");
const reverbLength = document.getElementById("reverb-length");
const reverbTone = document.getElementById("reverb-tone");
const eqBass = document.getElementById("eq-bass");
const eqMid = document.getElementById("eq-mid");
const eqTreble = document.getElementById("eq-treble");
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
const vizToggle = document.getElementById("viz-toggle");
const videoBlend = document.getElementById("video-blend");
const versionBadge = document.getElementById("app-version");

const APP_VERSION = "v2.3"; // Update this value on each release.
const EARLY_COUNT = 6;
const SETTINGS_KEY = "spatial-mp3-player-settings-v1";
const SUPPORTED_FILE_RE = /\.(mp3|m4a|mp4|webm|opus|ogg|wav)$/i;
const SEEK_STEP_SECONDS = 5;
const VOLUME_STEP = 0.05;
const DEFAULT_SETTINGS = {
  volume: "0.85",
  depth: "70",
  focus: "10",
  motionToggle: true,
  motionIntensity: "90",
  eqBass: "3",
  eqMid: "0",
  eqTreble: "1",
  earlyMix: "85",
  reverbLength: "110",
  reverbTone: "45",
  vizToggle: true,
  videoBlend: "85",
  theme: "neon",
  bypass3D: false,
  presetId: "studio",
};
const DISTANCE_MODEL = {
  near: 0.8,
  far: 4.1,
  directNear: 1.05,
  directFar: 0.62,
  earlyNear: 0.52,
  earlyFar: 1.38,
  reverbNear: 0.4,
  reverbFar: 1.62,
};
const AIR_ABSORPTION = {
  low: { factor: 0.05, minHz: 14500 },
  mid: { factor: 0.14, minHz: 8200 },
  high: { factor: 0.36, minHz: 5200 },
};
const RESONANCE_COMP = {
  lowNear: 1.0,
  lowFar: 1.28,
  vocalNear: 1.0,
  vocalFar: 1.18,
  reverbNear: 1.0,
  reverbFar: 1.2,
};
const WASM_MATH_SCALE = 1000;
const DIRECT_BANDS = [
  {
    id: "low",
    role: "bass",
    filters: [{ type: "lowpass", frequency: 260, Q: 0.7 }],
    gain: 1.34,
    spread: -0.34,
    elevation: -0.06,
    depth: 0.12,
    rolloff: 0.6,
    cone: { inner: 120, outer: 230, outerGain: 0.45 },
    lanes: 2,
    laneDelay: [0.006, 0.002],
  },
  {
    id: "mid",
    role: "vocal",
    filters: [
      { type: "highpass", frequency: 260, Q: 0.7 },
      { type: "lowpass", frequency: 2400, Q: 0.7 },
    ],
    gain: 1.0,
    spread: 0.08,
    elevation: 0,
    depth: 0,
    rolloff: 0.9,
    cone: { inner: 95, outer: 215, outerGain: 0.35 },
    lanes: 1,
  },
  {
    id: "high",
    role: "drum",
    filters: [{ type: "highpass", frequency: 2400, Q: 0.7 }],
    gain: 0.82,
    spread: 0.5,
    elevation: 0.08,
    depth: -0.06,
    rolloff: 1.1,
    cone: { inner: 80, outer: 210, outerGain: 0.3 },
    lanes: 2,
    laneDelay: [0.002, 0.006],
  },
];
const PART_MOTION = {
  bass: { speed: 0.66, x: 0.24, y: 0.07, z: 0.44, phase: 0 },
  vocal: { speed: 0.94, x: 0.34, y: 0.16, z: 0.28, phase: Math.PI * 0.5 },
  drum: { speed: 1.58, x: 0.74, y: 0.24, z: 0.36, phase: Math.PI },
};
const ACCOMPANIMENT_LAYOUT = {
  left: { x: -1.16, y: 0.02, z: -1.34 },
  right: { x: 1.16, y: 0.02, z: -1.34 },
};
const BPM_RANGE = { min: 70, max: 190 };
const BPM_INTERVAL_WINDOW = 32;
const BPM_DETECTION_COOLDOWN = 0.21;

let audioCtx;
let sourceNode;
let stereoSplitter;
let midBus;
let masterGain;
let analyser;
let directGain;
let directBands = [];
let accompanimentLeftGain;
let accompanimentRightGain;
let accompanimentLeftPanner;
let accompanimentRightPanner;
let earlyGain;
let earlySend;
let earlyHighpass;
let earlyDelays = [];
let earlyFilters = [];
let earlyPanners = [];
let reverbSend;
let reverbHighpass;
let reverbPreDelay;
let convolver;
let reverbFilter;
let reverbLowShelf;
let reverbPresence;
let reverbGain;
let eqLowShelf;
let eqMidPeaking;
let eqHighShelf;
let vizData;
let vizWave;
let vizLoopId;
let currentPreset;
let objectUrl;
let bypass3D = false;
let currentThemeId = "neon";
let visualizerEnabled = true;
let hasVideo = false;
let videoBlendValue = 0.85;
let renderScale = 1;
let frameAvg = 16.7;
let lastFrameStamp = 0;
let lastScaleAdjust = 0;
let vizSize = { width: 1920, height: 1080 };
let resizeHandlerAttached = false;
let earlyJitter = [];
let pendingPresetId = DEFAULT_SETTINGS.presetId;
let isRestoringSettings = false;
let dragDepth = 0;
let lastDirectDistance = 1.2;
let wasmMath;
let bpmEstimate = 0;
let bpmConfidence = 0;
let bpmIntervals = [];
let beatAnchorTime = 0;
let beatPrevEnergy = 0;
let beatFluxEnv = 0;
let beatFluxFloor = 0;
let beatWasAboveThreshold = false;
let lastBeatOnsetTime = -10;
let lastBpmUiUpdate = 0;
let lastBpmUiValue = 0;
let beatPulseSmooth = 0;
let beatPulseBlend = 0;
let beatPulseLastTime = 0;
let currentFileHint = "";

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

function clamp(value, min, max, fallback = min) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function createWasmI32OpModule(exportName, opcode) {
  const nameBytes = Array.from(new TextEncoder().encode(exportName));
  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00,
    0x07, 0x04 + nameBytes.length, 0x01, nameBytes.length, ...nameBytes, 0x00, 0x00,
    0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, opcode, 0x0b,
  ]);
}

async function initWasmMath() {
  if (wasmMath) return wasmMath;
  try {
    const [addModule, subModule, mulModule] = await Promise.all([
      WebAssembly.instantiate(createWasmI32OpModule("add", 0x6a)),
      WebAssembly.instantiate(createWasmI32OpModule("sub", 0x6b)),
      WebAssembly.instantiate(createWasmI32OpModule("mul", 0x6c)),
    ]);
    wasmMath = {
      add: addModule.instance.exports.add,
      sub: subModule.instance.exports.sub,
      mul: mulModule.instance.exports.mul,
    };
  } catch {
    wasmMath = null;
  }
  return wasmMath;
}

function lerpWasm(a, b, t) {
  const clampedT = clamp(t, 0, 1, 0);
  if (!wasmMath) {
    return a + (b - a) * clampedT;
  }
  const aQ = Math.round(a * WASM_MATH_SCALE);
  const bQ = Math.round(b * WASM_MATH_SCALE);
  const tQ = Math.round(clampedT * WASM_MATH_SCALE);
  const diffQ = wasmMath.sub(bQ, aQ);
  const stepQ = Math.trunc(wasmMath.mul(diffQ, tQ) / WASM_MATH_SCALE);
  const outQ = wasmMath.add(aQ, stepQ);
  return outQ / WASM_MATH_SCALE;
}

function getResonanceComp(distanceNorm, depthFactor) {
  const t = clamp(distanceNorm * (0.48 + depthFactor * 0.56), 0, 1, 0);
  return {
    low: lerpWasm(RESONANCE_COMP.lowNear, RESONANCE_COMP.lowFar, t),
    vocal: lerpWasm(RESONANCE_COMP.vocalNear, RESONANCE_COMP.vocalFar, t),
    reverb: lerpWasm(RESONANCE_COMP.reverbNear, RESONANCE_COMP.reverbFar, t),
  };
}

function setTrackHint(message, isError = false) {
  if (!trackHint) return;
  trackHint.textContent = message;
  trackHint.classList.toggle("is-error", isError);
}

function resetBpmEstimator() {
  bpmEstimate = 0;
  bpmConfidence = 0;
  bpmIntervals = [];
  beatAnchorTime = 0;
  beatPrevEnergy = 0;
  beatFluxEnv = 0;
  beatFluxFloor = 0;
  beatWasAboveThreshold = false;
  lastBeatOnsetTime = -10;
  lastBpmUiUpdate = 0;
  lastBpmUiValue = 0;
  beatPulseSmooth = 0;
  beatPulseBlend = 0;
  beatPulseLastTime = 0;
}

function normalizeBpmCandidate(bpm) {
  let normalized = bpm;
  while (normalized < BPM_RANGE.min) normalized *= 2;
  while (normalized > BPM_RANGE.max) normalized /= 2;
  return normalized;
}

function recomputeBpmEstimate() {
  if (bpmIntervals.length < 6) return;
  const candidates = bpmIntervals
    .map((interval) => normalizeBpmCandidate(60 / interval))
    .filter((value) => Number.isFinite(value) && value >= BPM_RANGE.min && value <= BPM_RANGE.max);
  if (candidates.length < 6) return;

  const sorted = [...candidates].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const clustered = sorted.filter((value) => Math.abs(value - median) <= 14);
  if (clustered.length < 4) return;

  const average = clustered.reduce((sum, value) => sum + value, 0) / clustered.length;
  const spread =
    clustered.reduce((sum, value) => sum + Math.abs(value - average), 0) / clustered.length;
  const clusterScore = clamp(clustered.length / sorted.length, 0, 1, 0);
  const spreadScore = clamp(1 - spread / 10, 0, 1, 0);
  const confidence = clusterScore * 0.6 + spreadScore * 0.4;
  const smooth = bpmEstimate > 0 ? 0.14 : 1;
  bpmEstimate = lerpWasm(bpmEstimate || average, average, smooth);
  bpmConfidence = lerpWasm(bpmConfidence, confidence, 0.35);
  if (confidence > 0.45) {
    if (beatAnchorTime <= 0) {
      beatAnchorTime = lastBeatOnsetTime;
    } else {
      beatAnchorTime += (lastBeatOnsetTime - beatAnchorTime) * 0.18;
    }
  }
}

function updateBpmEstimator(nowSec, low, mid, high) {
  const beatEnergy = low * 1.55 + mid * 0.9 + high * 0.25;
  const flux = Math.max(0, beatEnergy - beatPrevEnergy);
  beatPrevEnergy = beatEnergy;
  beatFluxEnv = beatFluxEnv * 0.82 + flux * 0.18;
  beatFluxFloor = beatFluxFloor * 0.992 + beatFluxEnv * 0.008;
  const threshold = beatFluxFloor + 0.012 + low * 0.02;
  const above = beatFluxEnv > threshold;
  const sinceOnset = nowSec - lastBeatOnsetTime;
  if (above && !beatWasAboveThreshold && sinceOnset > BPM_DETECTION_COOLDOWN) {
    if (lastBeatOnsetTime > 0) {
      const interval = sinceOnset;
      if (interval >= 0.24 && interval <= 1.1) {
        bpmIntervals.push(interval);
        if (bpmIntervals.length > BPM_INTERVAL_WINDOW) {
          bpmIntervals.shift();
        }
      }
    }
    lastBeatOnsetTime = nowSec;
    recomputeBpmEstimate();
  }
  beatWasAboveThreshold = above;
}

function getBeatPulse(nowSec) {
  if (bpmEstimate <= 0 || bpmConfidence < 0.28) return 0;
  const beatLength = 60 / bpmEstimate;
  const elapsed = nowSec - beatAnchorTime;
  const phase = ((elapsed % beatLength) + beatLength) % beatLength / beatLength;
  const attack = phase < 0.11
    ? (1 - phase / 0.11) * 0.78
    : Math.exp(-(phase - 0.11) * 6.4);
  const strength = 0.42 + bpmConfidence * 0.33;
  return attack * strength;
}

function getSmoothedBeatPulse(nowSec) {
  const raw = getBeatPulse(nowSec);
  const dt = beatPulseLastTime > 0 ? clamp(nowSec - beatPulseLastTime, 0.001, 0.1, 0.016) : 0.016;
  beatPulseLastTime = nowSec;

  const confidenceGate = clamp((bpmConfidence - 0.34) / 0.36, 0, 1, 0);
  const blendTarget = confidenceGate;
  const blendRate = blendTarget > beatPulseBlend ? 1 - Math.exp(-dt * 7.5) : 1 - Math.exp(-dt * 4.2);
  beatPulseBlend += (blendTarget - beatPulseBlend) * blendRate;

  const target = raw * beatPulseBlend;
  const smoothRate = 1 - Math.exp(-dt * (10 + beatPulseBlend * 6));
  beatPulseSmooth += (target - beatPulseSmooth) * smoothRate;
  return beatPulseSmooth;
}

function getMotionIntensityFactor() {
  const value = Number(motionIntensity?.value ?? DEFAULT_SETTINGS.motionIntensity);
  return clamp(value, 0, 160, Number(DEFAULT_SETTINGS.motionIntensity)) / 100;
}

function updateBpmHint(nowSec) {
  if (!currentFileHint || !trackHint) return;
  if (trackHint.classList.contains("is-error")) return;
  if (nowSec - lastBpmUiUpdate < 0.75) return;
  lastBpmUiUpdate = nowSec;
  if (bpmEstimate <= 0 || bpmConfidence < 0.4) {
    if (lastBpmUiValue !== 0) {
      setTrackHint(currentFileHint);
      lastBpmUiValue = 0;
    }
    return;
  }
  const rounded = Math.round(bpmEstimate);
  if (rounded === lastBpmUiValue) return;
  const suffix = bpmConfidence >= 0.72 ? `BPM ${rounded}` : `BPM~${rounded}`;
  setTrackHint(`${currentFileHint} | ${suffix}`);
  lastBpmUiValue = rounded;
}

function isPresetIdValid(id) {
  return presets.some((preset) => preset.id === id);
}

function getSettingsSnapshot() {
  return {
    volume: volume.value,
    depth: depth.value,
    focus: focus.value,
    motionToggle: motionToggle.checked,
    motionIntensity: motionIntensity?.value ?? DEFAULT_SETTINGS.motionIntensity,
    eqBass: eqBass?.value ?? DEFAULT_SETTINGS.eqBass,
    eqMid: eqMid?.value ?? DEFAULT_SETTINGS.eqMid,
    eqTreble: eqTreble?.value ?? DEFAULT_SETTINGS.eqTreble,
    earlyMix: earlyMix?.value ?? DEFAULT_SETTINGS.earlyMix,
    reverbLength: reverbLength?.value ?? DEFAULT_SETTINGS.reverbLength,
    reverbTone: reverbTone?.value ?? DEFAULT_SETTINGS.reverbTone,
    vizToggle: vizToggle ? vizToggle.checked : true,
    videoBlend: videoBlend?.value ?? DEFAULT_SETTINGS.videoBlend,
    theme: currentThemeId,
    bypass3D,
    presetId: currentPreset?.id ?? pendingPresetId ?? DEFAULT_SETTINGS.presetId,
  };
}

function saveSettings() {
  if (isRestoringSettings) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(getSettingsSnapshot()));
  } catch {
    // Ignore storage failures (private mode, quota).
  }
}

function restoreSettings() {
  let parsed;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== "object") return;

  isRestoringSettings = true;
  volume.value = clamp(
    Number(parsed.volume ?? DEFAULT_SETTINGS.volume),
    0,
    1,
    Number(DEFAULT_SETTINGS.volume)
  ).toString();
  depth.value = clamp(
    Number(parsed.depth ?? DEFAULT_SETTINGS.depth),
    0,
    100,
    Number(DEFAULT_SETTINGS.depth)
  ).toString();
  focus.value = clamp(
    Number(parsed.focus ?? DEFAULT_SETTINGS.focus),
    -100,
    100,
    Number(DEFAULT_SETTINGS.focus)
  ).toString();
  motionToggle.checked = Boolean(parsed.motionToggle ?? DEFAULT_SETTINGS.motionToggle);
  if (motionIntensity) {
    motionIntensity.value = clamp(
      Number(parsed.motionIntensity ?? DEFAULT_SETTINGS.motionIntensity),
      0,
      160,
      Number(DEFAULT_SETTINGS.motionIntensity)
    ).toString();
  }
  if (eqBass) {
    eqBass.value = clamp(
      Number(parsed.eqBass ?? DEFAULT_SETTINGS.eqBass),
      -12,
      12,
      Number(DEFAULT_SETTINGS.eqBass)
    ).toString();
  }
  if (eqMid) {
    eqMid.value = clamp(
      Number(parsed.eqMid ?? DEFAULT_SETTINGS.eqMid),
      -12,
      12,
      Number(DEFAULT_SETTINGS.eqMid)
    ).toString();
  }
  if (eqTreble) {
    eqTreble.value = clamp(
      Number(parsed.eqTreble ?? DEFAULT_SETTINGS.eqTreble),
      -12,
      12,
      Number(DEFAULT_SETTINGS.eqTreble)
    ).toString();
  }
  if (earlyMix) {
    earlyMix.value = clamp(
      Number(parsed.earlyMix ?? DEFAULT_SETTINGS.earlyMix),
      0,
      140,
      Number(DEFAULT_SETTINGS.earlyMix)
    ).toString();
  }
  if (reverbLength) {
    reverbLength.value = clamp(
      Number(parsed.reverbLength ?? DEFAULT_SETTINGS.reverbLength),
      60,
      160,
      Number(DEFAULT_SETTINGS.reverbLength)
    ).toString();
  }
  if (reverbTone) {
    reverbTone.value = clamp(
      Number(parsed.reverbTone ?? DEFAULT_SETTINGS.reverbTone),
      0,
      100,
      Number(DEFAULT_SETTINGS.reverbTone)
    ).toString();
  }
  if (vizToggle) vizToggle.checked = Boolean(parsed.vizToggle ?? DEFAULT_SETTINGS.vizToggle);
  if (videoBlend) {
    videoBlend.value = clamp(
      Number(parsed.videoBlend ?? DEFAULT_SETTINGS.videoBlend),
      0,
      100,
      Number(DEFAULT_SETTINGS.videoBlend)
    ).toString();
  }
  if (typeof parsed.theme === "string" && vizThemes.some((theme) => theme.id === parsed.theme)) {
    currentThemeId = parsed.theme;
  }
  if (typeof parsed.bypass3D === "boolean") {
    bypass3D = parsed.bypass3D;
  }
  if (typeof parsed.presetId === "string" && isPresetIdValid(parsed.presetId)) {
    pendingPresetId = parsed.presetId;
  }
  isRestoringSettings = false;
}

function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Ignore storage failures.
  }
  isRestoringSettings = true;
  volume.value = DEFAULT_SETTINGS.volume;
  depth.value = DEFAULT_SETTINGS.depth;
  focus.value = DEFAULT_SETTINGS.focus;
  motionToggle.checked = DEFAULT_SETTINGS.motionToggle;
  if (motionIntensity) motionIntensity.value = DEFAULT_SETTINGS.motionIntensity;
  if (eqBass) eqBass.value = DEFAULT_SETTINGS.eqBass;
  if (eqMid) eqMid.value = DEFAULT_SETTINGS.eqMid;
  if (eqTreble) eqTreble.value = DEFAULT_SETTINGS.eqTreble;
  if (earlyMix) earlyMix.value = DEFAULT_SETTINGS.earlyMix;
  if (reverbLength) reverbLength.value = DEFAULT_SETTINGS.reverbLength;
  if (reverbTone) reverbTone.value = DEFAULT_SETTINGS.reverbTone;
  if (vizToggle) vizToggle.checked = DEFAULT_SETTINGS.vizToggle;
  if (videoBlend) videoBlend.value = DEFAULT_SETTINGS.videoBlend;
  currentThemeId = DEFAULT_SETTINGS.theme;
  bypass3D = DEFAULT_SETTINGS.bypass3D;
  pendingPresetId = DEFAULT_SETTINGS.presetId;
  isRestoringSettings = false;

  updateThemeButtons();
  updateBypassButton();
  setVisualizerEnabled(vizToggle ? vizToggle.checked : true);
  updateVideoBlend();
  if (audioCtx) {
    updateVolume();
    updateEqSettings();
    updateDepth();
    applyPreset(presets.find((preset) => preset.id === pendingPresetId) || presets[0]);
  } else {
    updatePresetButtons();
  }
  setTrackHint("設定を初期化しました");
  saveSettings();
}

