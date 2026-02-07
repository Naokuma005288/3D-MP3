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
const vizToggle = document.getElementById("viz-toggle");
const videoBlend = document.getElementById("video-blend");

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
  low: { factor: 0.08, minHz: 12000 },
  mid: { factor: 0.22, minHz: 5500 },
  high: { factor: 0.58, minHz: 3200 },
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
    gain: 1.18,
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
  bass: { speed: 0.56, x: 0.18, y: 0.04, z: 0.36, phase: 0 },
  vocal: { speed: 0.78, x: 0.26, y: 0.12, z: 0.2, phase: Math.PI * 0.5 },
  drum: { speed: 1.35, x: 0.62, y: 0.18, z: 0.28, phase: Math.PI },
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
  const smooth = bpmEstimate > 0 ? 0.22 : 1;
  bpmEstimate = lerpWasm(bpmEstimate || average, average, smooth);
  bpmConfidence = lerpWasm(bpmConfidence, confidence, 0.35);
  if (confidence > 0.45) {
    beatAnchorTime = lastBeatOnsetTime;
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
  if (phase < 0.11) {
    return 1 - phase / 0.11;
  }
  return Math.exp(-(phase - 0.11) * 6.4) * (0.65 + bpmConfidence * 0.55);
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
    updateDepth();
    applyPreset(presets.find((preset) => preset.id === pendingPresetId) || presets[0]);
  } else {
    updatePresetButtons();
  }
  setTrackHint("設定を初期化しました");
  saveSettings();
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

  earlyGain = audioCtx.createGain();
  earlySend = audioCtx.createGain();
  earlyHighpass = audioCtx.createBiquadFilter();
  earlyHighpass.type = "highpass";
  earlyHighpass.frequency.value = 140;
  earlyHighpass.Q.value = 0.7;

  reverbSend = audioCtx.createGain();
  reverbHighpass = audioCtx.createBiquadFilter();
  reverbHighpass.type = "highpass";
  reverbHighpass.frequency.value = 180;
  reverbHighpass.Q.value = 0.7;
  reverbPreDelay = audioCtx.createDelay(1);
  convolver = audioCtx.createConvolver();
  reverbFilter = audioCtx.createBiquadFilter();
  reverbFilter.type = "lowpass";
  reverbFilter.frequency.value = 7500;
  reverbFilter.Q.value = 0.7;
  reverbLowShelf = audioCtx.createBiquadFilter();
  reverbLowShelf.type = "lowshelf";
  reverbLowShelf.frequency.value = 150;
  reverbLowShelf.gain.value = 1.8;
  reverbPresence = audioCtx.createBiquadFilter();
  reverbPresence.type = "peaking";
  reverbPresence.frequency.value = 1850;
  reverbPresence.Q.value = 0.85;
  reverbPresence.gain.value = 1.2;
  reverbGain = audioCtx.createGain();
  setListenerPosition(0, 0, 0);
  setListenerOrientation({ x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });

  stereoSplitter = audioCtx.createChannelSplitter(2);
  midBus = audioCtx.createGain();
  sourceNode.connect(stereoSplitter);

  const midFromLeft = audioCtx.createGain();
  midFromLeft.gain.value = 0.5;
  const midFromRight = audioCtx.createGain();
  midFromRight.gain.value = 0.5;
  stereoSplitter.connect(midFromLeft, 0);
  stereoSplitter.connect(midFromRight, 1);
  midFromLeft.connect(midBus);
  midFromRight.connect(midBus);

  const sideLeftFromLeft = audioCtx.createGain();
  sideLeftFromLeft.gain.value = 0.5;
  const sideLeftFromRight = audioCtx.createGain();
  sideLeftFromRight.gain.value = -0.5;
  const sideRightFromLeft = audioCtx.createGain();
  sideRightFromLeft.gain.value = -0.5;
  const sideRightFromRight = audioCtx.createGain();
  sideRightFromRight.gain.value = 0.5;

  const accompanimentLeftHighpass = audioCtx.createBiquadFilter();
  accompanimentLeftHighpass.type = "highpass";
  accompanimentLeftHighpass.frequency.value = 180;
  accompanimentLeftHighpass.Q.value = 0.7;
  const accompanimentLeftLowpass = audioCtx.createBiquadFilter();
  accompanimentLeftLowpass.type = "lowpass";
  accompanimentLeftLowpass.frequency.value = 7800;
  accompanimentLeftLowpass.Q.value = 0.7;
  const accompanimentRightHighpass = audioCtx.createBiquadFilter();
  accompanimentRightHighpass.type = "highpass";
  accompanimentRightHighpass.frequency.value = 180;
  accompanimentRightHighpass.Q.value = 0.7;
  const accompanimentRightLowpass = audioCtx.createBiquadFilter();
  accompanimentRightLowpass.type = "lowpass";
  accompanimentRightLowpass.frequency.value = 7800;
  accompanimentRightLowpass.Q.value = 0.7;
  accompanimentLeftGain = audioCtx.createGain();
  accompanimentRightGain = audioCtx.createGain();
  accompanimentLeftGain.gain.value = 0.52;
  accompanimentRightGain.gain.value = 0.52;
  accompanimentLeftPanner = audioCtx.createPanner();
  accompanimentLeftPanner.panningModel = "HRTF";
  accompanimentLeftPanner.distanceModel = "inverse";
  accompanimentLeftPanner.refDistance = 1;
  accompanimentLeftPanner.maxDistance = 80;
  accompanimentLeftPanner.rolloffFactor = 0.35;
  accompanimentLeftPanner.coneInnerAngle = 150;
  accompanimentLeftPanner.coneOuterAngle = 250;
  accompanimentLeftPanner.coneOuterGain = 0.6;
  accompanimentRightPanner = audioCtx.createPanner();
  accompanimentRightPanner.panningModel = "HRTF";
  accompanimentRightPanner.distanceModel = "inverse";
  accompanimentRightPanner.refDistance = 1;
  accompanimentRightPanner.maxDistance = 80;
  accompanimentRightPanner.rolloffFactor = 0.35;
  accompanimentRightPanner.coneInnerAngle = 150;
  accompanimentRightPanner.coneOuterAngle = 250;
  accompanimentRightPanner.coneOuterGain = 0.6;

  stereoSplitter.connect(sideLeftFromLeft, 0);
  stereoSplitter.connect(sideLeftFromRight, 1);
  stereoSplitter.connect(sideRightFromLeft, 0);
  stereoSplitter.connect(sideRightFromRight, 1);
  sideLeftFromLeft.connect(accompanimentLeftHighpass);
  sideLeftFromRight.connect(accompanimentLeftHighpass);
  sideRightFromLeft.connect(accompanimentRightHighpass);
  sideRightFromRight.connect(accompanimentRightHighpass);
  accompanimentLeftHighpass.connect(accompanimentLeftLowpass);
  accompanimentRightHighpass.connect(accompanimentRightLowpass);
  accompanimentLeftLowpass.connect(accompanimentLeftGain);
  accompanimentRightLowpass.connect(accompanimentRightGain);
  accompanimentLeftGain.connect(accompanimentLeftPanner);
  accompanimentRightGain.connect(accompanimentRightPanner);
  accompanimentLeftPanner.connect(masterGain);
  accompanimentRightPanner.connect(masterGain);

  midBus.connect(directGain);
  directBands = DIRECT_BANDS.map((band) => {
    const filtersConfig = band.filters ?? (band.filter ? [band.filter] : []);
    const filters = filtersConfig.map((cfg) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = cfg.type;
      filter.frequency.value = cfg.frequency;
      if (typeof cfg.Q === "number") {
        filter.Q.value = cfg.Q;
      }
      return filter;
    });

    const bandGain = audioCtx.createGain();
    bandGain.gain.value = band.gain;

    let lastNode = directGain;
    if (filters.length) {
      filters.forEach((filter) => {
        lastNode.connect(filter);
        lastNode = filter;
      });
    }
    lastNode.connect(bandGain);

    const lanes = [];
    const laneCount = band.lanes || 1;
    const laneGainValue = laneCount > 1 ? 0.55 : 1;
    for (let i = 0; i < laneCount; i += 1) {
      const laneGain = audioCtx.createGain();
      laneGain.gain.value = laneGainValue;
      const airFilter = audioCtx.createBiquadFilter();
      airFilter.type = "lowpass";
      airFilter.frequency.value = 20000;
      airFilter.Q.value = 0.65;

      const panner = audioCtx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 1;
      panner.maxDistance = 100;
      panner.rolloffFactor = band.rolloff ?? 1;
      panner.coneInnerAngle = band.cone?.inner ?? 90;
      panner.coneOuterAngle = band.cone?.outer ?? 210;
      panner.coneOuterGain = band.cone?.outerGain ?? 0.35;

      const baseDelay = band.laneDelay ? band.laneDelay[i] ?? 0 : 0;
      let delayNode = null;
      if (baseDelay > 0) {
        delayNode = audioCtx.createDelay(0.1);
        delayNode.delayTime.value = baseDelay;
      }

      bandGain.connect(laneGain);
      if (delayNode) {
        laneGain.connect(delayNode);
        delayNode.connect(airFilter);
      } else {
        laneGain.connect(airFilter);
      }
      airFilter.connect(panner);
      panner.connect(masterGain);
      lanes.push({ gain: laneGain, panner, delay: delayNode, baseDelay, airFilter });
    }

    return { config: band, filters, gain: bandGain, lanes };
  });

  midBus.connect(earlySend);
  earlySend.connect(earlyHighpass);

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

    earlyHighpass.connect(delay);
    delay.connect(filter);
    filter.connect(panner);
    panner.connect(earlyGain);

    earlyDelays.push(delay);
    earlyFilters.push(filter);
    earlyPanners.push(panner);
  }

  if (!earlyJitter.length) {
    earlyJitter = Array.from({ length: EARLY_COUNT }, () => {
      return (Math.random() * 2 - 1) * 0.003;
    });
  }

  earlyGain.connect(masterGain);

  midBus.connect(reverbSend);
  reverbSend.connect(reverbHighpass);
  reverbHighpass.connect(reverbPreDelay);
  reverbPreDelay.connect(convolver);
  convolver.connect(reverbFilter);
  reverbFilter.connect(reverbLowShelf);
  reverbLowShelf.connect(reverbPresence);
  reverbPresence.connect(reverbGain);
  reverbGain.connect(masterGain);

  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  masterGain.gain.value = Number(volume.value);
  const initialPreset = presets.find((preset) => preset.id === pendingPresetId) || presets[0];
  applyPreset(initialPreset);
  updateLoopState();
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

function setListenerPosition(x, y, z) {
  if (!audioCtx) return;
  const listener = audioCtx.listener;
  if (listener.positionX) {
    listener.positionX.setValueAtTime(x, audioCtx.currentTime);
    listener.positionY.setValueAtTime(y, audioCtx.currentTime);
    listener.positionZ.setValueAtTime(z, audioCtx.currentTime);
  } else if (listener.setPosition) {
    listener.setPosition(x, y, z);
  }
}

function setListenerOrientation(forward, up) {
  if (!audioCtx) return;
  const listener = audioCtx.listener;
  if (listener.forwardX) {
    listener.forwardX.setValueAtTime(forward.x, audioCtx.currentTime);
    listener.forwardY.setValueAtTime(forward.y, audioCtx.currentTime);
    listener.forwardZ.setValueAtTime(forward.z, audioCtx.currentTime);
    listener.upX.setValueAtTime(up.x, audioCtx.currentTime);
    listener.upY.setValueAtTime(up.y, audioCtx.currentTime);
    listener.upZ.setValueAtTime(up.z, audioCtx.currentTime);
  } else if (listener.setOrientation) {
    listener.setOrientation(
      forward.x,
      forward.y,
      forward.z,
      up.x,
      up.y,
      up.z
    );
  }
}

function updateListenerPose(time) {
  if (!audioCtx) return;
  const focusOffset = (Number(focus.value) / 100) * 0.35;
  const motionActive = motionToggle.checked && baseState.motion.type !== "none";
  const motion = baseState.motion;
  const depthFactor = getDepthFactor();
  const speed = motionActive
    ? motion.speed * (0.7 + depthFactor * 0.6)
    : 0;
  const poseBoost = 0.6 + depthFactor * 0.7;
  const yaw =
    focusOffset +
    (motion.type === "orbit"
      ? Math.sin(time * speed * Math.PI * 2) * 0.08 * poseBoost
      : 0);
  const pitch = motionActive ? Math.sin(time * speed * Math.PI) * 0.04 * poseBoost : 0;
  const cosPitch = Math.cos(pitch);
  const forward = {
    x: Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
  const up = { x: 0, y: 1, z: 0 };
  setListenerOrientation(forward, up);

  const bob = motionActive ? Math.sin(time * speed * Math.PI * 2) * 0.015 : 0;
  setListenerPosition(0, bob, 0);
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
  pendingPresetId = preset.id;
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
  updateLoopState();
  saveSettings();
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

function getEarlyHighpassHz() {
  const depthFactor = getDepthFactor();
  return 90 + depthFactor * 170;
}

function getReverbHighpassHz() {
  const depthFactor = getDepthFactor();
  return 140 + depthFactor * 220;
}

function getReverbPreDelay() {
  const depthFactor = getDepthFactor();
  const lengthFactor = getReverbLengthFactor();
  const base = 0.012 + depthFactor * 0.03;
  const scaled = base * (0.7 + lengthFactor * 0.5);
  return Math.min(0.085, Math.max(0.006, scaled));
}

function getDistanceNorm(distance) {
  const span = Math.max(0.001, DISTANCE_MODEL.far - DISTANCE_MODEL.near);
  return clamp((distance - DISTANCE_MODEL.near) / span, 0, 1, 0);
}

function getDistanceMixProfile(distance, depthFactor) {
  const distanceNorm = getDistanceNorm(distance);
  const blend = clamp(distanceNorm * (0.55 + depthFactor * 0.65), 0, 1, 0);
  const direct =
    DISTANCE_MODEL.directNear +
    (DISTANCE_MODEL.directFar - DISTANCE_MODEL.directNear) * blend;
  const early =
    DISTANCE_MODEL.earlyNear +
    (DISTANCE_MODEL.earlyFar - DISTANCE_MODEL.earlyNear) * blend;
  const reverb =
    DISTANCE_MODEL.reverbNear +
    (DISTANCE_MODEL.reverbFar - DISTANCE_MODEL.reverbNear) * blend;
  return { distanceNorm, direct, early, reverb };
}

function getAirCutoffHz(distanceNorm, depthFactor, bandId, bandConfig = null) {
  const cfg = AIR_ABSORPTION[bandId] || AIR_ABSORPTION.mid;
  const absorb = clamp(
    distanceNorm * (0.34 + depthFactor * 0.42) * cfg.factor,
    0,
    1,
    0
  );
  const cutoff = 20000 * Math.pow(0.22, absorb);
  const highpassFloor =
    bandConfig?.filters?.find((filter) => filter.type === "highpass")?.frequency ?? 0;
  const minCutoff = Math.max(cfg.minHz, highpassFloor + 350);
  return clamp(cutoff, minCutoff, 20000, 20000);
}

function applyAirAbsorption(distance, depthFactor, distanceNorm = getDistanceNorm(distance)) {
  const earlyDampBase = baseState.early.config.damp;
  const earlyTilt = bypass3D ? 1 : 1 - distanceNorm * (0.05 + depthFactor * 0.11);
  const earlyCutoff = clamp(earlyDampBase * earlyTilt, 4200, 14000, earlyDampBase);

  directBands.forEach((band) => {
    const cutoff = bypass3D
      ? 20000
      : getAirCutoffHz(distanceNorm, depthFactor, band.config.id, band.config);
    band.lanes.forEach((lane) => {
      if (!lane.airFilter) return;
      lane.airFilter.frequency.setValueAtTime(cutoff, audioCtx.currentTime);
    });
  });

  earlyFilters.forEach((filter) => {
    filter.frequency.setValueAtTime(earlyCutoff, audioCtx.currentTime);
  });

  if (reverbFilter) {
    reverbFilter.frequency.setValueAtTime(
      getReverbToneHz(distanceNorm),
      audioCtx.currentTime
    );
  }
}

function getReverbToneHz(distanceNorm = getDistanceNorm(lastDirectDistance)) {
  const base = baseState.early.config.damp * 0.85;
  const tone = Number(reverbTone?.value ?? 50) / 100;
  const depthFactor = getDepthFactor();
  const airTilt = 1 - distanceNorm * (0.04 + depthFactor * 0.1);
  const scaled = base * (0.7 + tone * 0.9) * airTilt;
  return Math.min(13000, Math.max(3400, scaled));
}

function updateMixGains(distance = lastDirectDistance) {
  if (!audioCtx) return;
  const safeDistance = clamp(
    distance,
    DISTANCE_MODEL.near * 0.45,
    DISTANCE_MODEL.far * 1.8,
    1.2
  );
  lastDirectDistance = safeDistance;
  const depthFactor = getDepthFactor();
  const earlyFactor = getEarlyFactor();
  const profile = getDistanceMixProfile(safeDistance, depthFactor);
  const resonance = getResonanceComp(profile.distanceNorm, depthFactor);
  const directGainValue = bypass3D
    ? baseState.direct.gain
    : baseState.direct.gain * profile.direct;
  directGain.gain.setValueAtTime(directGainValue, audioCtx.currentTime);
  if (accompanimentLeftGain && accompanimentRightGain) {
    const sideBase = bypass3D ? 0.62 : 0.48 + (1 - depthFactor) * 0.24;
    const sideDistanceTilt = bypass3D ? 1 : 1 - profile.distanceNorm * 0.08;
    const sideGain = sideBase * sideDistanceTilt;
    accompanimentLeftGain.gain.setValueAtTime(sideGain, audioCtx.currentTime);
    accompanimentRightGain.gain.setValueAtTime(sideGain, audioCtx.currentTime);
  }
  directBands.forEach((band) => {
    let gainValue = band.config.gain;
    if (band.config.id === "low") {
      gainValue *= bypass3D ? 1 : resonance.low;
    } else if (band.config.id === "mid") {
      gainValue *= bypass3D ? 1 : resonance.vocal;
    }
    if (band.config.id === "high") {
      gainValue *= 0.84 + depthFactor * 0.4;
      if (!bypass3D) {
        gainValue *= 1 - profile.distanceNorm * 0.04;
      }
    }
    band.gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);
    band.lanes.forEach((lane) => {
      if (!lane.delay) return;
      const delayValue = bypass3D ? 0 : lane.baseDelay;
      lane.delay.delayTime.setValueAtTime(delayValue, audioCtx.currentTime);
    });
  });
  applyAirAbsorption(safeDistance, depthFactor, profile.distanceNorm);
  if (bypass3D) {
    earlyGain.gain.setValueAtTime(0, audioCtx.currentTime);
    reverbGain.gain.setValueAtTime(0, audioCtx.currentTime);
    if (reverbLowShelf) reverbLowShelf.gain.setValueAtTime(0, audioCtx.currentTime);
    if (reverbPresence) reverbPresence.gain.setValueAtTime(0, audioCtx.currentTime);
    return;
  }
  if (reverbLowShelf) {
    const lowShelfGainDb = 1.4 + (resonance.low - 1) * 8;
    reverbLowShelf.gain.setValueAtTime(lowShelfGainDb, audioCtx.currentTime);
  }
  if (reverbPresence) {
    const presenceGainDb = 0.8 + (resonance.vocal - 1) * 7;
    reverbPresence.gain.setValueAtTime(presenceGainDb, audioCtx.currentTime);
  }
  earlyGain.gain.setValueAtTime(
    baseState.early.gain * depthFactor * earlyFactor * profile.early * resonance.reverb,
    audioCtx.currentTime
  );
  reverbGain.gain.setValueAtTime(
    baseState.reverb.gain * depthFactor * profile.reverb * resonance.reverb,
    audioCtx.currentTime
  );
}

function updateReverbSettings() {
  if (!audioCtx) return;
  const lengthFactor = getReverbLengthFactor();
  setReverb(baseState.reverb.duration * lengthFactor, baseState.reverb.decay * lengthFactor);
  if (reverbPreDelay) {
    reverbPreDelay.delayTime.setValueAtTime(getReverbPreDelay(), audioCtx.currentTime);
  }
  if (earlyHighpass) {
    earlyHighpass.frequency.setValueAtTime(getEarlyHighpassHz(), audioCtx.currentTime);
  }
  if (reverbHighpass) {
    reverbHighpass.frequency.setValueAtTime(getReverbHighpassHz(), audioCtx.currentTime);
  }
  if (reverbFilter) {
    reverbFilter.frequency.setValueAtTime(getReverbToneHz(), audioCtx.currentTime);
  }
}

function setReverb(duration, decay) {
  convolver.buffer = createImpulse(audioCtx, duration, decay);
}

function applyEarlySettings() {
  const config = baseState.early.config;
  const depthScale = 0.75 + getDepthFactor() * 0.5;
  for (let i = 0; i < EARLY_COUNT; i += 1) {
    const baseTime =
      (config.delayBase + (config.delaySpread * i) / (EARLY_COUNT - 1)) *
      depthScale;
    const jitter = (earlyJitter[i] ?? 0) * (0.6 + depthScale * 0.4);
    const delayTime = Math.max(0.001, baseTime + jitter);
    earlyDelays[i].delayTime.setValueAtTime(delayTime, audioCtx.currentTime);
    earlyFilters[i].frequency.setValueAtTime(config.damp, audioCtx.currentTime);
  }
}

function getPartMotionOffset(role, time, depthFactor, motionActive, spatialStrength) {
  if (!motionActive || spatialStrength <= 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const cfg = PART_MOTION[role];
  if (!cfg) {
    return { x: 0, y: 0, z: 0 };
  }
  const speedScale = 0.7 + depthFactor * 0.85;
  const angle = time * Math.PI * 2 * cfg.speed * speedScale + cfg.phase;
  return {
    x: Math.sin(angle * 1.15) * cfg.x * spatialStrength,
    y: Math.sin(angle * 0.78) * cfg.y * spatialStrength,
    z: Math.cos(angle * 0.62) * cfg.z * spatialStrength,
  };
}

function updatePannerPositions(time) {
  if (!audioCtx) return;
  updateListenerPose(time);
  const focusOffset = (Number(focus.value) / 100) * 1.2;
  const motionActive = motionToggle.checked && baseState.motion.type !== "none";
  const motion = baseState.motion;
  const base = baseState.direct.pos;
  const depthFactor = getDepthFactor();
  const motionSpeed = motionActive
    ? motion.speed * (0.7 + depthFactor * 0.6)
    : 0;

  let offset = { x: 0, y: 0, z: 0 };
  if (motionActive) {
    const angle = time * motionSpeed * Math.PI * 2;
    if (motion.type === "orbit") {
      const wobble = Math.sin(angle * 0.5) * motion.radius * 0.35;
      const radiusX = motion.radius * (0.95 + Math.sin(angle * 0.4) * 0.18);
      const radiusZ = motion.radius * (1.05 + Math.cos(angle * 0.45) * 0.22);
      offset = {
        x: Math.cos(angle) * radiusX,
        y: Math.sin(angle * 0.55) * motion.elevation,
        z: Math.sin(angle) * radiusZ + wobble,
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

  const spatialStrength = bypass3D ? 0 : 1;
  const baseX = base.x + offset.x;
  const baseY = base.y + offset.y;
  const baseZ = base.z + offset.z - focusOffset;
  const directDistance = Math.hypot(baseX, baseY, baseZ);
  updateMixGains(directDistance);
  const separation = (0.18 + depthFactor * 0.55) * spatialStrength;
  if (accompanimentLeftPanner && accompanimentRightPanner) {
    const spread = (0.95 + depthFactor * 0.35) * (bypass3D ? 0.88 : 1);
    const zShift = bypass3D ? 0 : depthFactor * 0.2;
    setPannerPosition(
      accompanimentLeftPanner,
      ACCOMPANIMENT_LAYOUT.left.x * spread,
      ACCOMPANIMENT_LAYOUT.left.y,
      ACCOMPANIMENT_LAYOUT.left.z - zShift
    );
    setPannerPosition(
      accompanimentRightPanner,
      ACCOMPANIMENT_LAYOUT.right.x * spread,
      ACCOMPANIMENT_LAYOUT.right.y,
      ACCOMPANIMENT_LAYOUT.right.z - zShift
    );
  }

  directBands.forEach((band) => {
    const config = band.config;
    const partOffset = getPartMotionOffset(
      config.role,
      time,
      depthFactor,
      motionActive,
      spatialStrength
    );
    const laneBaseX = baseX + partOffset.x;
    const laneBaseY = baseY + partOffset.y;
    const laneBaseZ = baseZ + partOffset.z;
    const elevation = config.elevation * (0.6 + depthFactor * 0.6) * spatialStrength;
    const depthPush = config.depth * (0.6 + depthFactor * 0.6) * spatialStrength;
    const spread = config.spread * separation;
    if (band.lanes.length === 1) {
      setPannerPosition(
        band.lanes[0].panner,
        laneBaseX,
        laneBaseY + elevation,
        laneBaseZ + depthPush
      );
    } else if (band.lanes.length >= 2) {
      setPannerPosition(
        band.lanes[0].panner,
        laneBaseX - spread,
        laneBaseY + elevation,
        laneBaseZ + depthPush
      );
      setPannerPosition(
        band.lanes[1].panner,
        laneBaseX + spread,
        laneBaseY + elevation,
        laneBaseZ + depthPush
      );
    }
  });

  for (let i = 0; i < EARLY_COUNT; i += 1) {
    const pos = baseState.early.positions[i];
    if (!pos) continue;
    let extra = { x: 0, y: 0, z: 0 };
    if (motionActive) {
      const phase = time * motionSpeed * Math.PI * 2 + i * 1.2;
      const orbitBoost = motion.type === "orbit" ? 0.35 : 0.2;
      extra = {
        x: Math.cos(phase) * motion.radius * orbitBoost,
        y: Math.sin(phase * 0.8) * motion.elevation * 0.35,
        z: Math.sin(phase) * motion.radius * orbitBoost * 0.6,
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

function resizeCanvas() {
  if (!canvas || !canvasCtx) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = renderScale;
  const width = Math.max(1, Math.round(rect.width * dpr * scale));
  const height = Math.max(1, Math.round(rect.height * dpr * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvasCtx.setTransform(width / rect.width, 0, 0, height / rect.height, 0, 0);
  vizSize = { width: rect.width, height: rect.height };
}

function updateRenderScale(now) {
  if (!visualizerEnabled) return;
  if (!lastFrameStamp) {
    lastFrameStamp = now;
    return;
  }
  const delta = now - lastFrameStamp;
  lastFrameStamp = now;
  frameAvg = frameAvg * 0.9 + delta * 0.1;
  if (now - lastScaleAdjust < 1200) return;
  if (frameAvg > 22 && renderScale > 0.6) {
    renderScale = Math.max(0.6, renderScale - 0.1);
    lastScaleAdjust = now;
    resizeCanvas();
  } else if (frameAvg < 14 && renderScale < 1) {
    renderScale = Math.min(1, renderScale + 0.05);
    lastScaleAdjust = now;
    resizeCanvas();
  }
}

function shouldRunLoop() {
  if (!audioCtx) return false;
  const motionActive = motionToggle.checked && baseState.motion.type !== "none";
  return visualizerEnabled || motionActive;
}

function updateLoopState() {
  if (shouldRunLoop()) {
    startVisualizer();
  } else if (vizLoopId) {
    cancelAnimationFrame(vizLoopId);
    vizLoopId = null;
    lastFrameStamp = 0;
    frameAvg = 16.7;
  }
}

function setVisualizerEnabled(enabled) {
  visualizerEnabled = enabled;
  if (vizCard) vizCard.classList.toggle("viz-off", !enabled);
  updateLoopState();
  saveSettings();
}

function updateVideoBlend() {
  videoBlendValue = Number(videoBlend?.value ?? 85) / 100;
  const opacity = hasVideo ? videoBlendValue : 0;
  if (vizCard) {
    vizCard.style.setProperty("--video-opacity", opacity.toFixed(3));
    vizCard.classList.toggle("has-video", hasVideo);
  }
  saveSettings();
}

function startVisualizer() {
  if (vizLoopId) return;
  if (!resizeHandlerAttached) {
    window.addEventListener("resize", resizeCanvas);
    resizeHandlerAttached = true;
  }
  resizeCanvas();

  let edgeGlow = 0;
  let edgeSpin = 0;

  const draw = (now) => {
    if (!shouldRunLoop()) {
      vizLoopId = null;
      return;
    }
    vizLoopId = requestAnimationFrame(draw);
    updatePannerPositions(now / 1000);
    if (!visualizerEnabled) return;
    if (!analyser) return;
    updateRenderScale(now);
    analyser.getByteFrequencyData(vizData);
    analyser.getByteTimeDomainData(vizWave);

    const width = vizSize.width;
    const height = vizSize.height;
    const nowSec = now / 1000;
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
    if (!audio.paused) {
      updateBpmEstimator(nowSec, low, mid, high);
    }
    updateBpmHint(nowSec);
    const beatRate = bpmEstimate > 0 ? bpmEstimate / 60 : 1.05;
    const beatPulse = getBeatPulse(nowSec);

    const theme = getTheme();
    const hue = theme.hueBase + high * theme.hueRange;
    const overlayAlpha = hasVideo
      ? 0.1 + (1 - videoBlendValue) * 0.9
      : 1;
    if (app) {
      const target = Math.min(1, energy * 1.4 + beatPulse * 0.75);
      edgeGlow = edgeGlow * 0.85 + target * 0.15;
      edgeSpin += 0.0028 + energy * 0.01 + beatPulse * 0.012;
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
    canvasCtx.globalAlpha = overlayAlpha;
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
    const flow = (nowSec * (0.14 + beatRate * 0.46 + low * 0.32)) % 1;
    canvasCtx.lineWidth = 1.2;
    for (let i = 0; i < lineCount; i += 1) {
      const z = (i / lineCount + flow) % 1;
      const ease = z * z;
      const y = horizon + ease * (floor - horizon);
      const w = lerp(width * 0.18, width * 1.12, ease);
      const alpha = (1 - z) * (0.12 + low * 0.28 + beatPulse * 0.15);
      canvasCtx.strokeStyle = `hsla(${theme.gridHue}, 80%, 70%, ${alpha})`;
      canvasCtx.beginPath();
      canvasCtx.moveTo(centerX - w / 2, y);
      canvasCtx.lineTo(centerX + w / 2, y);
      canvasCtx.stroke();
    }

    canvasCtx.save();
    canvasCtx.globalCompositeOperation = "lighter";
    canvasCtx.lineCap = "round";

    const ribbonAmp = height * 0.08 * (0.4 + mid) * (1 + beatPulse * 0.34);
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
        const wobble =
          Math.sin(t * Math.PI * 2 + nowSec * (0.64 + beatRate * 0.55)) *
          high *
          (10 + beatPulse * 8);
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
      3.2,
      14
    );
    drawRibbon(
      ribbonBase + ribbonGap,
      ribbonAmp * 0.7,
      `hsla(${hue - 24}, 90%, 65%, 0.55)`,
      2.6,
      10
    );
    drawRibbon(
      ribbonBase + ribbonGap * 2,
      ribbonAmp * 0.5,
      `hsla(${hue + 34}, 90%, 72%, 0.45)`,
      2.2,
      8
    );
    canvasCtx.restore();

    const barCount = 48;
    const barWidth = width / barCount;
    const barTop = floor - height * 0.02;
    const barMax = height * 0.18 * (0.7 + low * 0.8 + beatPulse * 0.24);
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

    const coreRadius = Math.min(width, height) * (0.08 + low * 0.12 + beatPulse * 0.035);
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

  };
  vizLoopId = requestAnimationFrame(draw);
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
  if (!vizThemes.some((theme) => theme.id === id)) return;
  currentThemeId = id;
  updateThemeButtons();
  saveSettings();
}

function updatePresetButtons() {
  const buttons = presetGrid.querySelectorAll(".preset-btn");
  const activeId = currentPreset ? currentPreset.id : pendingPresetId || presets[0].id;
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

async function handlePlay() {
  ensureAudio();
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      // Ignore resume failures and continue.
    }
  }
  if (audio.paused) {
    try {
      await audio.play();
    } catch {
      setTrackHint("再生を開始できませんでした", true);
    }
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

function isPlayableFile(file) {
  if (!file) return false;
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
  return SUPPORTED_FILE_RE.test(file.name.toLowerCase());
}

function loadFile(file) {
  if (!file) return;
  if (!isPlayableFile(file)) {
    setTrackHint("未対応の形式です。MP3/M4A/WEBM/MP4等を選択してください", true);
    return;
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  const name = file.name.toLowerCase();
  const isVideo = file.type.startsWith("video/") || /\.(mp4|webm)$/i.test(name);
  hasVideo = isVideo;
  updateVideoBlend();
  const cleanName = file.name.replace(/\.[^/.]+$/, "");
  trackName.textContent = cleanName;
  if (hudTitle) hudTitle.textContent = cleanName;
  currentFileHint = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  setTrackHint(currentFileHint);
  resetBpmEstimator();
  seek.value = "0";
  seek.max = "100";
  currentTimeEl.textContent = "0:00";
  durationEl.textContent = "0:00";
  ensureAudio();
  audio.load();
}

function handleFile() {
  const file = fileInput.files[0];
  loadFile(file);
  fileInput.value = "";
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

function updateBypassButton() {
  if (!abToggle) return;
  abToggle.textContent = bypass3D ? "A/B: 3D OFF" : "A/B: 3D ON";
  abToggle.classList.toggle("active", bypass3D);
}

function toggleBypass() {
  bypass3D = !bypass3D;
  updateBypassButton();
  if (audioCtx) {
    updatePannerPositions(performance.now() / 1000);
  } else {
    updateMixGains();
  }
  saveSettings();
}

function stepSeek(seconds) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = clamp(audio.currentTime + seconds, 0, audio.duration);
  handleTimeUpdate();
}

function stepVolume(delta) {
  const next = clamp(Number(volume.value) + delta, 0, 1);
  volume.value = next.toFixed(2);
  updateVolume();
  saveSettings();
}

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function handleGlobalKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (isEditableTarget(event.target)) return;

  switch (event.code) {
    case "Space":
    case "KeyK":
      event.preventDefault();
      void handlePlay();
      break;
    case "KeyS":
      event.preventDefault();
      handleStop();
      break;
    case "KeyF":
      event.preventDefault();
      toggleFullscreen();
      break;
    case "KeyB":
      event.preventDefault();
      toggleBypass();
      break;
    case "ArrowRight":
      event.preventDefault();
      stepSeek(SEEK_STEP_SECONDS);
      break;
    case "ArrowLeft":
      event.preventDefault();
      stepSeek(-SEEK_STEP_SECONDS);
      break;
    case "ArrowUp":
      event.preventDefault();
      stepVolume(VOLUME_STEP);
      break;
    case "ArrowDown":
      event.preventDefault();
      stepVolume(-VOLUME_STEP);
      break;
    default:
      break;
  }
}

function setDropState(isActive) {
  if (!app) return;
  app.classList.toggle("drop-active", isActive);
}

function isFileDrag(event) {
  return Boolean(event.dataTransfer?.types && Array.from(event.dataTransfer.types).includes("Files"));
}

function handleDragEnter(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth += 1;
  setDropState(true);
}

function handleDragOver(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

function handleDragLeave(event) {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDropState(false);
}

function handleDrop(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  setDropState(false);
  const file = event.dataTransfer?.files?.[0];
  if (file) loadFile(file);
}

function handleSeek() {
  audio.currentTime = Number(seek.value);
}

function handleTimeUpdate() {
  seek.value = audio.currentTime.toString();
  currentTimeEl.textContent = formatTime(audio.currentTime);
}

function updateDepth() {
  if (!audioCtx) return;
  applyEarlySettings();
  updateReverbSettings();
  updatePannerPositions(performance.now() / 1000);
}

function updateVolume() {
  if (!audioCtx) return;
  masterGain.gain.setValueAtTime(Number(volume.value), audioCtx.currentTime);
}

loadBtn.addEventListener("click", () => fileInput.click());
if (resetBtn) resetBtn.addEventListener("click", resetSettings);
fileInput.addEventListener("change", handleFile);
playBtn.addEventListener("click", () => {
  void handlePlay();
});
stopBtn.addEventListener("click", handleStop);
seek.addEventListener("input", handleSeek);
audio.addEventListener("timeupdate", handleTimeUpdate);
audio.addEventListener("ended", updatePlayState);
audio.addEventListener("play", updatePlayState);
audio.addEventListener("pause", updatePlayState);
audio.addEventListener("loadedmetadata", () => {
  seek.max = Number.isFinite(audio.duration) ? audio.duration.toString() : "100";
  durationEl.textContent = formatTime(audio.duration);
});
audio.addEventListener("error", () => {
  resetBpmEstimator();
  setTrackHint("このファイルは再生できませんでした", true);
});
volume.addEventListener("input", () => {
  updateVolume();
  saveSettings();
});
depth.addEventListener("input", () => {
  updateDepth();
  saveSettings();
});
focus.addEventListener("input", () => {
  updatePannerPositions(performance.now() / 1000);
  saveSettings();
});
motionToggle.addEventListener("change", () => {
  updatePannerPositions(performance.now() / 1000);
  updateLoopState();
  saveSettings();
});
if (earlyMix) {
  earlyMix.addEventListener("input", () => {
    updateMixGains();
    saveSettings();
  });
}
if (reverbLength) {
  reverbLength.addEventListener("input", () => {
    updateReverbSettings();
    saveSettings();
  });
}
if (reverbTone) {
  reverbTone.addEventListener("input", () => {
    updateReverbSettings();
    saveSettings();
  });
}
if (fullBtn) fullBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenState);
if (abToggle) abToggle.addEventListener("click", toggleBypass);
if (hudPlay) {
  hudPlay.addEventListener("click", () => {
    void handlePlay();
  });
}
if (hudStop) hudStop.addEventListener("click", handleStop);
if (vizToggle) {
  vizToggle.addEventListener("change", () => setVisualizerEnabled(vizToggle.checked));
}
if (videoBlend) {
  videoBlend.addEventListener("input", updateVideoBlend);
}
if (vizTheme) {
  vizTheme.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme));
  });
}
document.addEventListener("keydown", handleGlobalKeydown);
document.addEventListener("dragover", (event) => {
  if (isFileDrag(event)) event.preventDefault();
});
document.addEventListener("drop", (event) => {
  if (isFileDrag(event)) event.preventDefault();
});
if (app) {
  app.addEventListener("dragenter", handleDragEnter);
  app.addEventListener("dragover", handleDragOver);
  app.addEventListener("dragleave", handleDragLeave);
  app.addEventListener("drop", handleDrop);
}

void initWasmMath();
restoreSettings();
buildPresetButtons();
updatePlayState();
syncFullscreenState();
updateThemeButtons();
updateBypassButton();
setVisualizerEnabled(vizToggle ? vizToggle.checked : true);
updateVideoBlend();
