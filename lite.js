const audio = document.getElementById("audio");
const fileInput = document.getElementById("file-input");
const loadBtn = document.getElementById("load-btn");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");
const seek = document.getElementById("seek");
const volume = document.getElementById("volume");
const depth = document.getElementById("depth");
const motionToggle = document.getElementById("motion-toggle");
const motionIntensity = document.getElementById("motion-intensity");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const statusEl = document.getElementById("status");

const SUPPORTED_FILE_RE = /\.(mp3|m4a|mp4|webm|opus|ogg|wav)$/i;
const SETTINGS_KEY = "spatial-mp3-lite-settings-v1";

let objectUrl = "";
let audioCtx;
let sourceNode;
let masterGain;
let dryGain;
let reverbBus;
let reverbFilter;
let convolver;
let reverbGain;
let bandChains = [];
let earlyReflections = [];
let motionLoopId = null;

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

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff9aa8" : "";
}

function isPlayableFile(file) {
  if (!file) return false;
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
  return SUPPORTED_FILE_RE.test(file.name.toLowerCase());
}

function updatePlayButton() {
  playBtn.textContent = audio.paused ? "再生" : "一時停止";
}

function getMotionIntensityFactor() {
  return clamp(Number(motionIntensity?.value ?? 90), 0, 160, 90) / 100;
}

function createImpulseResponse(context, duration = 2.4, decay = 2.7) {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const impulse = context.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      const envelope = Math.pow(1 - t, decay);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
  }
  return impulse;
}

function createPanner(context, x, y, z, rolloff = 0.9) {
  const panner = context.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 24;
  panner.rolloffFactor = rolloff;
  panner.coneInnerAngle = 150;
  panner.coneOuterAngle = 240;
  panner.coneOuterGain = 0.35;
  panner.positionX.value = x;
  panner.positionY.value = y;
  panner.positionZ.value = z;
  return panner;
}

function setPannerPosition(panner, x, y, z) {
  if (!panner) return;
  panner.positionX.value = x;
  panner.positionY.value = y;
  panner.positionZ.value = z;
}

function createBandChain(context, config) {
  const input = context.createBiquadFilter();
  input.type = config.filter.type;
  input.frequency.value = config.filter.frequency;
  input.Q.value = config.filter.Q ?? 0.7;

  const gain = context.createGain();
  gain.gain.value = config.gain;

  const panner = createPanner(context, config.pos.x, config.pos.y, config.pos.z, config.rolloff ?? 0.9);
  const send = context.createGain();
  send.gain.value = config.send ?? 0.1;

  input.connect(gain);
  gain.connect(panner);
  panner.connect(dryGain);
  gain.connect(send);
  send.connect(reverbBus);

  return { input, gain, panner, send, basePos: { ...config.pos } };
}

function createEarlyReflection(context, delayTime, x, y, z, gainValue) {
  const delay = context.createDelay(0.3);
  delay.delayTime.value = delayTime;
  const gain = context.createGain();
  gain.gain.value = gainValue;
  const panner = createPanner(context, x, y, z, 1.15);
  delay.connect(gain);
  gain.connect(panner);
  panner.connect(masterGain);
  return { delay, gain, panner, basePos: { x, y, z } };
}

function ensureAudioGraph() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    setStatus("このブラウザはWeb Audioに対応していません。", true);
    return;
  }
  audioCtx = new Ctx();
  sourceNode = audioCtx.createMediaElementSource(audio);

  masterGain = audioCtx.createGain();
  masterGain.gain.value = Number(volume.value);
  dryGain = audioCtx.createGain();
  dryGain.gain.value = 1;
  reverbBus = audioCtx.createGain();
  reverbBus.gain.value = 0.22;
  reverbFilter = audioCtx.createBiquadFilter();
  reverbFilter.type = "lowpass";
  reverbFilter.frequency.value = 6200;
  convolver = audioCtx.createConvolver();
  convolver.buffer = createImpulseResponse(audioCtx);
  reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.18;

  dryGain.connect(masterGain);
  reverbBus.connect(reverbFilter);
  reverbFilter.connect(convolver);
  convolver.connect(reverbGain);
  reverbGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  bandChains = [
    createBandChain(audioCtx, {
      filter: { type: "lowpass", frequency: 250, Q: 0.7 },
      gain: 1.2,
      send: 0.08,
      pos: { x: -0.42, y: -0.05, z: -1.1 },
      rolloff: 0.75,
    }),
    createBandChain(audioCtx, {
      filter: { type: "bandpass", frequency: 1200, Q: 0.9 },
      gain: 1.05,
      send: 0.13,
      pos: { x: 0.0, y: 0.02, z: -1.0 },
      rolloff: 0.95,
    }),
    createBandChain(audioCtx, {
      filter: { type: "highpass", frequency: 2800, Q: 0.7 },
      gain: 0.9,
      send: 0.2,
      pos: { x: 0.46, y: 0.08, z: -1.24 },
      rolloff: 1.05,
    }),
  ];

  sourceNode.connect(bandChains[0].input);
  sourceNode.connect(bandChains[1].input);
  sourceNode.connect(bandChains[2].input);

  earlyReflections = [
    createEarlyReflection(audioCtx, 0.018, -1.2, 0.03, -0.85, 0.035),
    createEarlyReflection(audioCtx, 0.029, 1.16, -0.02, -0.96, 0.03),
  ];
  sourceNode.connect(earlyReflections[0].delay);
  sourceNode.connect(earlyReflections[1].delay);

  audio.muted = false;
  audio.volume = 1;
  applySpatialSettings();
}

function applyMotionToPanners(timeSec) {
  if (!audioCtx) return;
  const motionAmount = motionToggle?.checked ? getMotionIntensityFactor() : 0;
  const t = Number.isFinite(timeSec) ? timeSec : audio.currentTime || 0;

  if (!motionAmount) {
    bandChains.forEach((chain) => {
      if (!chain?.basePos) return;
      setPannerPosition(chain.panner, chain.basePos.x, chain.basePos.y, chain.basePos.z);
    });
    earlyReflections.forEach((reflection) => {
      if (!reflection?.basePos) return;
      setPannerPosition(
        reflection.panner,
        reflection.basePos.x,
        reflection.basePos.y,
        reflection.basePos.z
      );
    });
    return;
  }

  const phase = t * (0.72 + motionAmount * 0.48);
  const deep = 0.05 + motionAmount * 0.08;
  const wide = 0.08 + motionAmount * 0.18;
  const tall = 0.015 + motionAmount * 0.05;

  if (bandChains[0]?.basePos) {
    const b = bandChains[0].basePos;
    setPannerPosition(
      bandChains[0].panner,
      b.x + Math.sin(phase * 0.82) * wide * 0.55,
      b.y + Math.cos(phase * 0.66 + 0.4) * tall * 0.55,
      b.z + Math.sin(phase * 0.58 + 1.1) * deep * 0.6
    );
  }
  if (bandChains[1]?.basePos) {
    const b = bandChains[1].basePos;
    setPannerPosition(
      bandChains[1].panner,
      b.x + Math.sin(phase * 1.1 + 0.7) * wide * 0.95,
      b.y + Math.sin(phase * 0.72 + 1.8) * tall,
      b.z + Math.cos(phase * 0.76) * deep
    );
  }
  if (bandChains[2]?.basePos) {
    const b = bandChains[2].basePos;
    setPannerPosition(
      bandChains[2].panner,
      b.x + Math.sin(phase * 1.3 + 1.9) * wide,
      b.y + Math.cos(phase * 0.86 + 0.3) * tall * 1.2,
      b.z + Math.sin(phase * 0.92 + 0.8) * deep * 1.1
    );
  }

  if (earlyReflections[0]?.basePos) {
    const b = earlyReflections[0].basePos;
    setPannerPosition(
      earlyReflections[0].panner,
      b.x + Math.sin(phase * 0.52) * wide * 0.35,
      b.y + Math.cos(phase * 0.6) * tall * 0.45,
      b.z + Math.sin(phase * 0.42 + 0.8) * deep * 0.45
    );
  }
  if (earlyReflections[1]?.basePos) {
    const b = earlyReflections[1].basePos;
    setPannerPosition(
      earlyReflections[1].panner,
      b.x + Math.sin(phase * 0.55 + 1.5) * wide * 0.35,
      b.y + Math.cos(phase * 0.62 + 0.9) * tall * 0.45,
      b.z + Math.sin(phase * 0.46 + 1.2) * deep * 0.45
    );
  }
}

function stopMotionLoop() {
  if (!motionLoopId) return;
  cancelAnimationFrame(motionLoopId);
  motionLoopId = null;
}

function startMotionLoop() {
  if (motionLoopId) return;
  const draw = () => {
    if (audio.paused || !motionToggle?.checked) {
      motionLoopId = null;
      applyMotionToPanners(audio.currentTime || 0);
      return;
    }
    applyMotionToPanners(audio.currentTime || 0);
    motionLoopId = requestAnimationFrame(draw);
  };
  motionLoopId = requestAnimationFrame(draw);
}

function syncMotionLoop() {
  if (audio.paused || !motionToggle?.checked) {
    stopMotionLoop();
    applyMotionToPanners(audio.currentTime || 0);
    return;
  }
  startMotionLoop();
}

function applySpatialSettings() {
  if (!audioCtx) return;
  const depthValue = Math.max(0, Math.min(100, Number(depth?.value ?? 70)));
  const t = depthValue / 100;

  const zBase = -0.8 - t * 1.7;
  const spread = 0.65 + t * 0.95;
  const height = t * 0.12;

  if (bandChains[0]) {
    bandChains[0].basePos = {
      x: -0.42 * spread,
      y: -0.06 + height * 0.4,
      z: zBase + 0.15,
    };
    setPannerPosition(
      bandChains[0].panner,
      bandChains[0].basePos.x,
      bandChains[0].basePos.y,
      bandChains[0].basePos.z
    );
  }
  if (bandChains[1]) {
    bandChains[1].basePos = {
      x: 0,
      y: 0.02 + height * 0.2,
      z: zBase + 0.28,
    };
    setPannerPosition(
      bandChains[1].panner,
      bandChains[1].basePos.x,
      bandChains[1].basePos.y,
      bandChains[1].basePos.z
    );
  }
  if (bandChains[2]) {
    bandChains[2].basePos = {
      x: 0.46 * spread,
      y: 0.07 + height,
      z: zBase,
    };
    setPannerPosition(
      bandChains[2].panner,
      bandChains[2].basePos.x,
      bandChains[2].basePos.y,
      bandChains[2].basePos.z
    );
  }

  if (earlyReflections[0]) {
    earlyReflections[0].delay.delayTime.value = 0.014 + t * 0.015;
    earlyReflections[0].gain.gain.value = 0.018 + t * 0.034;
    earlyReflections[0].basePos = { x: -0.95 * spread, y: 0.01, z: zBase + 0.7 };
    setPannerPosition(
      earlyReflections[0].panner,
      earlyReflections[0].basePos.x,
      earlyReflections[0].basePos.y,
      earlyReflections[0].basePos.z
    );
  }
  if (earlyReflections[1]) {
    earlyReflections[1].delay.delayTime.value = 0.022 + t * 0.02;
    earlyReflections[1].gain.gain.value = 0.015 + t * 0.03;
    earlyReflections[1].basePos = { x: 0.92 * spread, y: -0.01, z: zBase + 0.6 };
    setPannerPosition(
      earlyReflections[1].panner,
      earlyReflections[1].basePos.x,
      earlyReflections[1].basePos.y,
      earlyReflections[1].basePos.z
    );
  }

  reverbBus.gain.value = 0.12 + t * 0.2;
  reverbGain.gain.value = 0.1 + t * 0.22;
  reverbFilter.frequency.value = 7600 - t * 2500;

  const listener = audioCtx.listener;
  if (listener.positionX) {
    listener.positionX.value = 0;
    listener.positionY.value = 0;
    listener.positionZ.value = 0;
    listener.forwardX.value = 0;
    listener.forwardY.value = 0;
    listener.forwardZ.value = -1;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  } else if (listener.setPosition) {
    listener.setPosition(0, 0, 0);
    if (listener.setOrientation) listener.setOrientation(0, 0, -1, 0, 1, 0);
  }

  applyMotionToPanners(audio.currentTime || 0);
  syncMotionLoop();
}

function updateVolume() {
  if (!audioCtx || !masterGain) return;
  masterGain.gain.value = Number(volume.value);
}

function handleStop() {
  audio.pause();
  audio.currentTime = 0;
  syncMotionLoop();
  updatePlayButton();
}

async function handlePlay() {
  if (!audio.src) {
    setStatus("先に音声ファイルを読み込んでください。", true);
    return;
  }
  ensureAudioGraph();
  if (!audioCtx) return;
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
      setStatus("再生を開始できませんでした。", true);
    }
  } else {
    audio.pause();
  }
  syncMotionLoop();
  updatePlayButton();
}

function handleTimeUpdate() {
  seek.value = audio.currentTime.toString();
  currentTimeEl.textContent = formatTime(audio.currentTime);
}

function restoreVolume() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    const value = Number(parsed.volume);
    if (Number.isFinite(value)) {
      volume.value = Math.min(1, Math.max(0, value)).toFixed(2);
    }
    const depthValue = Number(parsed.depth);
    if (Number.isFinite(depthValue) && depth) {
      depth.value = Math.max(0, Math.min(100, depthValue)).toString();
    }
    if (motionToggle) {
      motionToggle.checked = Boolean(parsed.motionToggle ?? true);
    }
    if (motionIntensity) {
      motionIntensity.value = clamp(Number(parsed.motionIntensity), 0, 160, 90).toString();
    }
  } catch {
    // Ignore storage failures.
  }
}

function saveVolume() {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        volume: Number(volume.value),
        depth: Number(depth?.value ?? 70),
        motionToggle: Boolean(motionToggle?.checked),
        motionIntensity: Number(motionIntensity?.value ?? 90),
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

function loadFile(file) {
  if (!file) return;
  if (!isPlayableFile(file)) {
    setStatus("未対応の形式です。MP3/M4A/WEBM/MP4等を選択してください。", true);
    return;
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  ensureAudioGraph();
  audio.load();
  const cleanName = file.name.replace(/\.[^/.]+$/, "");
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  setStatus(`${cleanName} (${sizeMb} MB) | 3D処理オン`);
  seek.value = "0";
  currentTimeEl.textContent = "0:00";
  durationEl.textContent = "0:00";
  applySpatialSettings();
  updateVolume();
  syncMotionLoop();
  updatePlayButton();
}

loadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  loadFile(fileInput.files[0]);
  fileInput.value = "";
});
playBtn.addEventListener("click", () => {
  void handlePlay();
});
stopBtn.addEventListener("click", handleStop);
seek.addEventListener("input", () => {
  audio.currentTime = Number(seek.value);
});
volume.addEventListener("input", () => {
  updateVolume();
  saveVolume();
});
if (depth) {
  depth.addEventListener("input", () => {
    applySpatialSettings();
    saveVolume();
  });
}
if (motionToggle) {
  motionToggle.addEventListener("change", () => {
    applySpatialSettings();
    saveVolume();
  });
}
if (motionIntensity) {
  motionIntensity.addEventListener("input", () => {
    applyMotionToPanners(audio.currentTime || 0);
    syncMotionLoop();
    saveVolume();
  });
}
audio.addEventListener("timeupdate", handleTimeUpdate);
audio.addEventListener("play", () => {
  syncMotionLoop();
  updatePlayButton();
});
audio.addEventListener("pause", () => {
  syncMotionLoop();
  updatePlayButton();
});
audio.addEventListener("ended", () => {
  syncMotionLoop();
  updatePlayButton();
});
audio.addEventListener("loadedmetadata", () => {
  seek.max = Number.isFinite(audio.duration) ? audio.duration.toString() : "100";
  durationEl.textContent = formatTime(audio.duration);
});
audio.addEventListener("error", () => {
  setStatus("このファイルは再生できませんでした。", true);
});

restoreVolume();
updatePlayButton();
setStatus("ファイルを読み込んでください（3D処理は有効）。");
