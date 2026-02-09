// Audio graph and spatial motion engine.
const POSITION_SMOOTH_TIME = 0.035;
const LISTENER_SMOOTH_TIME = 0.05;
const PRESET_TRANSITION_MS = 320;

let presetTransitionFrame = null;
let analysisData;

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
  analysisData = new Uint8Array(analyser.frequencyBinCount);
  eqLowShelf = audioCtx.createBiquadFilter();
  eqLowShelf.type = "lowshelf";
  eqLowShelf.frequency.value = 120;
  eqLowShelf.Q.value = 0.8;
  eqMidPeaking = audioCtx.createBiquadFilter();
  eqMidPeaking.type = "peaking";
  eqMidPeaking.frequency.value = 1050;
  eqMidPeaking.Q.value = 0.9;
  eqHighShelf = audioCtx.createBiquadFilter();
  eqHighShelf.type = "highshelf";
  eqHighShelf.frequency.value = 6200;
  eqHighShelf.Q.value = 0.7;
  outputMakeupGain = audioCtx.createGain();
  outputCompressor = audioCtx.createDynamicsCompressor();
  outputLimiter = audioCtx.createDynamicsCompressor();

  outputCompressor.threshold.value = OUTPUT_STAGE_PROFILE.compressor.threshold;
  outputCompressor.knee.value = OUTPUT_STAGE_PROFILE.compressor.knee;
  outputCompressor.ratio.value = OUTPUT_STAGE_PROFILE.compressor.ratio;
  outputCompressor.attack.value = OUTPUT_STAGE_PROFILE.compressor.attack;
  outputCompressor.release.value = OUTPUT_STAGE_PROFILE.compressor.release;

  outputLimiter.threshold.value = OUTPUT_STAGE_PROFILE.limiter.threshold;
  outputLimiter.knee.value = OUTPUT_STAGE_PROFILE.limiter.knee;
  outputLimiter.ratio.value = OUTPUT_STAGE_PROFILE.limiter.ratio;
  outputLimiter.attack.value = OUTPUT_STAGE_PROFILE.limiter.attack;
  outputLimiter.release.value = OUTPUT_STAGE_PROFILE.limiter.release;
  outputMakeupGain.gain.value = OUTPUT_STAGE_PROFILE.makeupGain;

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

  masterGain.connect(eqLowShelf);
  eqLowShelf.connect(eqMidPeaking);
  eqMidPeaking.connect(eqHighShelf);
  eqHighShelf.connect(outputMakeupGain);
  outputMakeupGain.connect(outputCompressor);
  outputCompressor.connect(outputLimiter);
  outputLimiter.connect(analyser);
  analyser.connect(audioCtx.destination);

  masterGain.gain.value = Number(volume.value);
  updateEqSettings();
  const initialPreset = presets.find((preset) => preset.id === pendingPresetId) || presets[0];
  applyPreset(initialPreset, { instant: true });
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

function updateEqSettings() {
  if (!audioCtx || !eqLowShelf || !eqMidPeaking || !eqHighShelf) return;
  const bassDb = clamp(Number(eqBass?.value ?? DEFAULT_SETTINGS.eqBass), -12, 12, Number(DEFAULT_SETTINGS.eqBass));
  const midDb = clamp(Number(eqMid?.value ?? DEFAULT_SETTINGS.eqMid), -12, 12, Number(DEFAULT_SETTINGS.eqMid));
  const trebleDb = clamp(
    Number(eqTreble?.value ?? DEFAULT_SETTINGS.eqTreble),
    -12,
    12,
    Number(DEFAULT_SETTINGS.eqTreble)
  );
  eqLowShelf.gain.setValueAtTime(bassDb, audioCtx.currentTime);
  eqMidPeaking.gain.setValueAtTime(midDb, audioCtx.currentTime);
  eqHighShelf.gain.setValueAtTime(trebleDb, audioCtx.currentTime);
}

function updateOutputStageGain(distanceNorm, vocalPresence, depthFactor) {
  if (!audioCtx || !outputMakeupGain) return;
  if (bypass3D) {
    outputMakeupGain.gain.setTargetAtTime(OUTPUT_STAGE_PROFILE.makeupGain, audioCtx.currentTime, 0.06);
    return;
  }
  const distanceComp = 1 + distanceNorm * 0.085;
  const vocalComp = 1 - vocalPresence * 0.04;
  const depthComp = 1 + depthFactor * 0.03;
  const target = clamp(
    OUTPUT_STAGE_PROFILE.makeupGain * distanceComp * vocalComp * depthComp,
    0.98,
    1.22,
    OUTPUT_STAGE_PROFILE.makeupGain
  );
  outputMakeupGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.05);
}

function setPannerPosition(panner, x, y, z) {
  if (panner.positionX) {
    panner.positionX.setTargetAtTime(x, audioCtx.currentTime, POSITION_SMOOTH_TIME);
    panner.positionY.setTargetAtTime(y, audioCtx.currentTime, POSITION_SMOOTH_TIME);
    panner.positionZ.setTargetAtTime(z, audioCtx.currentTime, POSITION_SMOOTH_TIME);
  } else if (panner.setPosition) {
    panner.setPosition(x, y, z);
  }
}

function setListenerPosition(x, y, z) {
  if (!audioCtx) return;
  const listener = audioCtx.listener;
  if (listener.positionX) {
    listener.positionX.setTargetAtTime(x, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
    listener.positionY.setTargetAtTime(y, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
    listener.positionZ.setTargetAtTime(z, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
  } else if (listener.setPosition) {
    listener.setPosition(x, y, z);
  }
}

function setListenerOrientation(forward, up) {
  if (!audioCtx) return;
  const listener = audioCtx.listener;
  if (listener.forwardX) {
    listener.forwardX.setTargetAtTime(forward.x, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
    listener.forwardY.setTargetAtTime(forward.y, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
    listener.forwardZ.setTargetAtTime(forward.z, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
    listener.upX.setTargetAtTime(up.x, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
    listener.upY.setTargetAtTime(up.y, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
    listener.upZ.setTargetAtTime(up.z, audioCtx.currentTime, LISTENER_SMOOTH_TIME);
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
  const motionScale = getMotionIntensityFactor();
  const motionActive = motionToggle.checked && baseState.motion.type !== "none";
  const motion = baseState.motion;
  const depthFactor = getDepthFactor();
  const speed = motionActive
    ? motion.speed * (0.7 + depthFactor * 0.6) * (0.45 + motionScale * 0.55)
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

function copyStateSnapshot(state) {
  return {
    direct: { gain: state.direct.gain, pos: { ...state.direct.pos } },
    early: { gain: state.early.gain, config: { ...state.early.config } },
    reverb: { ...state.reverb },
    motion: { ...state.motion },
  };
}

function snapshotFromPreset(preset) {
  return {
    direct: { gain: preset.direct.gain, pos: { ...preset.direct.pos } },
    early: { gain: preset.early.gain, config: { ...preset.early.config } },
    reverb: { ...preset.reverb },
    motion: { ...preset.motion },
  };
}

function assignBaseState(snapshot) {
  baseState.direct.gain = snapshot.direct.gain;
  baseState.direct.pos = { ...snapshot.direct.pos };
  baseState.early.gain = snapshot.early.gain;
  baseState.early.config = { ...snapshot.early.config };
  baseState.reverb = { ...snapshot.reverb };
  baseState.motion = { ...snapshot.motion };
  buildEarlyPositions(baseState.early.config);
}

function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

function lerpStateSnapshot(from, to, t) {
  return {
    direct: {
      gain: lerpNumber(from.direct.gain, to.direct.gain, t),
      pos: {
        x: lerpNumber(from.direct.pos.x, to.direct.pos.x, t),
        y: lerpNumber(from.direct.pos.y, to.direct.pos.y, t),
        z: lerpNumber(from.direct.pos.z, to.direct.pos.z, t),
      },
    },
    early: {
      gain: lerpNumber(from.early.gain, to.early.gain, t),
      config: {
        radius: lerpNumber(from.early.config.radius, to.early.config.radius, t),
        depth: lerpNumber(from.early.config.depth, to.early.config.depth, t),
        elevation: lerpNumber(from.early.config.elevation, to.early.config.elevation, t),
        delayBase: lerpNumber(from.early.config.delayBase, to.early.config.delayBase, t),
        delaySpread: lerpNumber(from.early.config.delaySpread, to.early.config.delaySpread, t),
        damp: lerpNumber(from.early.config.damp, to.early.config.damp, t),
      },
    },
    reverb: {
      gain: lerpNumber(from.reverb.gain, to.reverb.gain, t),
      duration: lerpNumber(from.reverb.duration, to.reverb.duration, t),
      decay: lerpNumber(from.reverb.decay, to.reverb.decay, t),
    },
    motion: {
      type: t < 0.5 ? from.motion.type : to.motion.type,
      speed: lerpNumber(from.motion.speed, to.motion.speed, t),
      radius: lerpNumber(from.motion.radius, to.motion.radius, t),
      elevation: lerpNumber(from.motion.elevation, to.motion.elevation, t),
    },
  };
}

function stopPresetTransition() {
  if (!presetTransitionFrame) return;
  cancelAnimationFrame(presetTransitionFrame);
  presetTransitionFrame = null;
}

function commitPresetState(snapshot, timeSec = 0) {
  assignBaseState(snapshot);
  applyEarlySettings();
  updateMixGains();
  updateReverbSettings();
  updatePannerPositions(timeSec);
}

function applyPreset(preset, options = {}) {
  currentPreset = preset;
  pendingPresetId = preset.id;
  updatePresetButtons();
  updateLoopState();

  const transitionMs = clamp(
    Number(options.durationMs ?? PRESET_TRANSITION_MS),
    0,
    1400,
    PRESET_TRANSITION_MS
  );
  const nowSec = performance.now() / 1000;
  if (options.instant || transitionMs <= 0) {
    stopPresetTransition();
    commitPresetState(snapshotFromPreset(preset), nowSec);
    saveSettings();
    return;
  }

  const fromState = copyStateSnapshot(baseState);
  const toState = snapshotFromPreset(preset);
  stopPresetTransition();
  const startedAt = performance.now();
  const step = () => {
    const elapsed = performance.now() - startedAt;
    const t = clamp(elapsed / transitionMs, 0, 1, 1);
    const eased = t * t * (3 - 2 * t);
    commitPresetState(lerpStateSnapshot(fromState, toState, eased), performance.now() / 1000);
    if (t >= 1) {
      presetTransitionFrame = null;
      commitPresetState(toState, performance.now() / 1000);
      saveSettings();
      return;
    }
    presetTransitionFrame = requestAnimationFrame(step);
  };
  presetTransitionFrame = requestAnimationFrame(step);
}

function sampleBandLevel(data, from, to) {
  const start = clamp(Math.floor(from), 0, data.length - 1, 0);
  const end = clamp(Math.floor(to), start + 1, data.length, start + 1);
  let sum = 0;
  for (let i = start; i < end; i += 1) {
    sum += data[i];
  }
  return (sum / (end - start)) / 255;
}

function updateAdaptiveMixProfile(timeSec) {
  if (!AUTO_MIX_PROFILE.enabled || !analyser || !analysisData || !audioCtx) return;
  if (audio.paused) return;
  if (timeSec - adaptiveMixState.lastUpdateTime < AUTO_MIX_PROFILE.updateInterval) return;
  adaptiveMixState.lastUpdateTime = timeSec;
  analyser.getByteFrequencyData(analysisData);

  const low = sampleBandLevel(analysisData, 2, 24);
  const mid = sampleBandLevel(analysisData, 24, 120);
  const high = sampleBandLevel(analysisData, 120, 260);
  const vocalBand = sampleBandLevel(analysisData, 28, 156);

  const bassLead = clamp((low - mid) * 1.25, 0, 1, 0);
  const vocalLead = clamp((mid - low * 0.85) * 1.15, 0, 1, 0);
  const trebleLead = clamp((high - mid * 0.9) * 1.25, 0, 1, 0);
  const vocalPresence = clamp((vocalBand - (low + high) * 0.45) * 1.8, 0, 1, 0);

  const targetBass = 1 + bassLead * AUTO_MIX_PROFILE.bassBoostMax;
  const targetVocal = 1 + vocalLead * AUTO_MIX_PROFILE.vocalBoostMax;
  const targetTreble = 1 + trebleLead * AUTO_MIX_PROFILE.trebleBoostMax;
  const smoothing = 0.22;

  adaptiveMixState.bass = lerpNumber(adaptiveMixState.bass, targetBass, smoothing);
  adaptiveMixState.vocal = lerpNumber(adaptiveMixState.vocal, targetVocal, smoothing);
  adaptiveMixState.treble = lerpNumber(adaptiveMixState.treble, targetTreble, smoothing);
  adaptiveMixState.vocalPresence = lerpNumber(
    adaptiveMixState.vocalPresence,
    vocalPresence,
    smoothing
  );
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
    distanceNorm * (0.25 + depthFactor * 0.32) * cfg.factor,
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
  const earlyTilt = bypass3D ? 1 : 1 - distanceNorm * (0.03 + depthFactor * 0.07);
  const earlyCutoff = clamp(earlyDampBase * earlyTilt, 5600, 16000, earlyDampBase);

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
  const base = baseState.early.config.damp * 0.92;
  const tone = Number(reverbTone?.value ?? 50) / 100;
  const depthFactor = getDepthFactor();
  const airTilt = 1 - distanceNorm * (0.03 + depthFactor * 0.07);
  const scaled = base * (0.82 + tone * 0.88) * airTilt;
  return Math.min(14500, Math.max(4200, scaled));
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
  const toneFactor = Number(reverbTone?.value ?? 50) / 100;
  const profile = getDistanceMixProfile(safeDistance, depthFactor);
  const resonance = getResonanceComp(profile.distanceNorm, depthFactor);
  const autoBass = adaptiveMixState?.bass ?? 1;
  const autoVocal = adaptiveMixState?.vocal ?? 1;
  const autoTreble = adaptiveMixState?.treble ?? 1;
  const vocalPresence = adaptiveMixState?.vocalPresence ?? 0;
  const directGainValue = bypass3D
    ? baseState.direct.gain
    : baseState.direct.gain * profile.direct;
  updateOutputStageGain(profile.distanceNorm, vocalPresence, depthFactor);
  directGain.gain.setValueAtTime(directGainValue, audioCtx.currentTime);
  if (accompanimentLeftGain && accompanimentRightGain) {
    const sideBase = bypass3D ? 0.62 : 0.48 + (1 - depthFactor) * 0.24;
    const sideDistanceTilt = bypass3D ? 1 : 1 - profile.distanceNorm * 0.08;
    const vocalFocusTilt = bypass3D ? 1 : 1 - vocalPresence * 0.22;
    const sideGain =
      sideBase *
      sideDistanceTilt *
      vocalFocusTilt *
      STEREO_TUNE.sideGainBoost *
      (bypass3D ? 1 : VOCAL_CLARITY.sideAttenuation);
    accompanimentLeftGain.gain.setValueAtTime(
      sideGain * STEREO_TUNE.leftGainBias,
      audioCtx.currentTime
    );
    accompanimentRightGain.gain.setValueAtTime(
      sideGain * STEREO_TUNE.rightGainBias,
      audioCtx.currentTime
    );
  }
  directBands.forEach((band) => {
    let gainValue = band.config.gain;
    if (band.config.id === "low") {
      gainValue *= bypass3D ? 1 : resonance.low * autoBass;
    } else if (band.config.id === "mid") {
      gainValue *= bypass3D ? 1 : resonance.vocal * VOCAL_CLARITY.midBoost * autoVocal;
    }
    if (band.config.id === "high") {
      gainValue *= 0.92 + depthFactor * 0.42;
      gainValue *= autoTreble;
      if (!bypass3D) {
        gainValue *= 1 - profile.distanceNorm * 0.02;
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
    const presenceGainDb = 0.8 + (resonance.vocal - 1) * 7 + VOCAL_CLARITY.presenceBoostDb;
    reverbPresence.gain.setValueAtTime(presenceGainDb, audioCtx.currentTime);
  }
  earlyGain.gain.setValueAtTime(
    baseState.early.gain *
      depthFactor *
      earlyFactor *
      profile.early *
      resonance.reverb *
      (1 - vocalPresence * 0.08) *
      VOCAL_CLARITY.earlyAttenuation,
    audioCtx.currentTime
  );
  reverbGain.gain.setValueAtTime(
    baseState.reverb.gain *
      depthFactor *
      profile.reverb *
      resonance.reverb *
      (0.82 + toneFactor * 0.22) *
      (1 - vocalPresence * 0.16) *
      VOCAL_CLARITY.reverbAttenuation,
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

function getPartMotionOffset(
  role,
  time,
  depthFactor,
  motionActive,
  spatialStrength,
  motionBoostXY,
  motionBoostZ
) {
  if (!motionActive || spatialStrength <= 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const cfg = PART_MOTION[role];
  if (!cfg) {
    return { x: 0, y: 0, z: 0 };
  }
  const speedScale = 0.74 + depthFactor * 0.95 + motionBoostXY * 0.05;
  const ampScaleXY = spatialStrength * motionBoostXY * 1.28;
  const ampScaleZ = spatialStrength * motionBoostZ;
  const roleSpeedFactor = role === "vocal" ? 0.42 : 0.68;
  const angle = time * Math.PI * 2 * cfg.speed * speedScale * roleSpeedFactor + cfg.phase;
  return {
    x: Math.sin(angle * 1.15) * cfg.x * ampScaleXY,
    y: Math.sin(angle * 0.78) * cfg.y * ampScaleXY,
    z: Math.cos(angle * 0.62) * cfg.z * ampScaleZ,
  };
}

function updatePannerPositions(time) {
  if (!audioCtx) return;
  updateAdaptiveMixProfile(time);
  updateListenerPose(time);
  const focusOffset = (Number(focus.value) / 100) * 1.2;
  const motionScale = getMotionIntensityFactor();
  const motionActive = motionToggle.checked && baseState.motion.type !== "none";
  const motion = baseState.motion;
  const base = baseState.direct.pos;
  const depthFactor = getDepthFactor();
  const radiusScale = 0.45 + motionScale * 0.55;
  const motionSpeed = motionActive
    ? motion.speed *
      (0.7 + depthFactor * 0.6) *
      (0.45 + motionScale * 0.55)
    : 0;

  let offset = { x: 0, y: 0, z: 0 };
  if (motionActive) {
    const angle = time * motionSpeed * Math.PI * 2;
    const radius = motion.radius * radiusScale;
    const elevation = motion.elevation * (0.75 + motionScale * 0.5);
    if (motion.type === "orbit") {
      const wobble = Math.sin(angle * 0.5) * radius * 0.35;
      const radiusX = radius * (0.95 + Math.sin(angle * 0.4) * 0.18);
      const radiusZ = radius * (1.05 + Math.cos(angle * 0.45) * 0.22);
      offset = {
        x: Math.cos(angle) * radiusX,
        y: Math.sin(angle * 0.55) * elevation,
        z: Math.sin(angle) * radiusZ + wobble,
      };
    } else if (motion.type === "float") {
      offset = {
        x: Math.sin(angle) * radius,
        y: Math.cos(angle * 0.8) * elevation,
        z: Math.sin(angle * 0.4) * radius * 0.4,
      };
    } else if (motion.type === "pulse") {
      offset = {
        x: Math.sin(angle * 1.6) * radius * 0.7,
        y: Math.cos(angle * 1.3) * elevation * 0.72,
        z: Math.sin(angle * 0.9) * radius * 0.3,
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
    const laneBaseX = baseX;
    const laneBaseY = baseY;
    const laneBaseZ = baseZ;
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
        x: Math.cos(phase) * motion.radius * orbitBoost * radiusScale,
        y: Math.sin(phase * 0.8) * motion.elevation * 0.35 * radiusScale,
        z: Math.sin(phase) * motion.radius * orbitBoost * 0.6 * radiusScale,
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

