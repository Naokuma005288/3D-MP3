// Visualizer rendering, UI interaction handlers, and app bootstrap.
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
  const fixedScale =
    currentQualityMode === "high"
      ? 1
      : currentQualityMode === "balanced"
        ? 0.85
        : currentQualityMode === "eco"
          ? 0.7
          : null;
  if (fixedScale !== null) {
    if (Math.abs(renderScale - fixedScale) > 0.01) {
      renderScale = fixedScale;
      resizeCanvas();
    }
    lastFrameStamp = now;
    return;
  }
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
  const motionActive =
    motionToggle.checked &&
    baseState.motion.type !== "none" &&
    getMotionIntensityFactor() > 0.01;
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

const VIZ_PRESET_PROFILES = {
  studio: { hueShift: -8, motionRate: 0.9, ribbonBoost: 0.85, barBoost: 1.08, wingBoost: 0.8, glowBoost: 0.82 },
  hall: { hueShift: 10, motionRate: 1.02, ribbonBoost: 1.08, barBoost: 0.98, wingBoost: 1.15, glowBoost: 1.08 },
  club: { hueShift: 28, motionRate: 1.2, ribbonBoost: 0.95, barBoost: 1.24, wingBoost: 0.88, glowBoost: 1.2 },
  orbit: { hueShift: 20, motionRate: 1.28, ribbonBoost: 1.12, barBoost: 1.04, wingBoost: 1.22, glowBoost: 1.18 },
  cathedral: { hueShift: -16, motionRate: 0.82, ribbonBoost: 1.2, barBoost: 0.82, wingBoost: 1.24, glowBoost: 1.14 },
  cinema: { hueShift: 14, motionRate: 1.0, ribbonBoost: 1.05, barBoost: 1.02, wingBoost: 1.1, glowBoost: 1.1 },
  hyper: { hueShift: 34, motionRate: 1.34, ribbonBoost: 1.16, barBoost: 1.12, wingBoost: 1.28, glowBoost: 1.26 },
  arena: { hueShift: 24, motionRate: 1.18, ribbonBoost: 0.98, barBoost: 1.28, wingBoost: 0.9, glowBoost: 1.16 },
  void: { hueShift: -26, motionRate: 0.74, ribbonBoost: 1.22, barBoost: 0.76, wingBoost: 1.3, glowBoost: 1.04 },
  default: { hueShift: 0, motionRate: 1, ribbonBoost: 1, barBoost: 1, wingBoost: 1, glowBoost: 1 },
};

function getVizPresetProfile() {
  const id = currentPreset?.id ?? pendingPresetId ?? "default";
  return VIZ_PRESET_PROFILES[id] || VIZ_PRESET_PROFILES.default;
}

function getVizQualityProfile(width, height) {
  if (currentQualityMode === "high") {
    return {
      name: "high",
      barCount: 56,
      waveStep: 3,
      wingCount: 40,
      drawSecondaryRibbon: true,
      drawSecondaryWing: true,
    };
  }
  if (currentQualityMode === "balanced") {
    return {
      name: "mid",
      barCount: 40,
      waveStep: 5,
      wingCount: 26,
      drawSecondaryRibbon: true,
      drawSecondaryWing: false,
    };
  }
  if (currentQualityMode === "eco") {
    return {
      name: "low",
      barCount: 24,
      waveStep: 8,
      wingCount: 14,
      drawSecondaryRibbon: false,
      drawSecondaryWing: false,
    };
  }
  const area = width * height;
  if (frameAvg > 24 || renderScale <= 0.7 || area > 2200000) {
    return {
      name: "low",
      barCount: 24,
      waveStep: 8,
      wingCount: 14,
      drawSecondaryRibbon: false,
      drawSecondaryWing: false,
    };
  }
  if (frameAvg > 18 || renderScale <= 0.85 || area > 1600000) {
    return {
      name: "mid",
      barCount: 36,
      waveStep: 6,
      wingCount: 24,
      drawSecondaryRibbon: true,
      drawSecondaryWing: false,
    };
  }
  return {
    name: "high",
    barCount: 48,
    waveStep: 4,
    wingCount: 34,
    drawSecondaryRibbon: true,
    drawSecondaryWing: true,
  };
}

function getBandAverage(data, from, to) {
  const end = Math.min(data.length, to);
  let sum = 0;
  for (let i = from; i < end; i += 1) sum += data[i];
  return end > from ? sum / (end - from) / 255 : 0;
}

function drawWaveRibbon(ctx, wave, width, nowSec, params) {
  const { y, amp, color, widthLine, glowAmt, high, beatRate, step } = params;
  ctx.strokeStyle = color;
  ctx.lineWidth = widthLine;
  ctx.shadowColor = color;
  ctx.shadowBlur = glowAmt;
  ctx.beginPath();
  for (let i = 0; i < wave.length; i += step) {
    const t = i / (wave.length - 1);
    const x = t * width;
    const v = (wave[i] - 128) / 128;
    const wobble =
      Math.sin(t * Math.PI * 2 + nowSec * (0.64 + beatRate * 0.55)) *
      high *
      10;
    const yPos = y + v * amp + wobble;
    if (i === 0) {
      ctx.moveTo(x, yPos);
    } else {
      ctx.lineTo(x, yPos);
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
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
  const barPeaks = new Float32Array(64);

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

    const quality = getVizQualityProfile(width, height);
    const profile = getVizPresetProfile();
    const low = getBandAverage(vizData, 0, 12);
    const mid = getBandAverage(vizData, 12, 64);
    const high = getBandAverage(vizData, 64, 180);
    const energy = (low * 1.2 + mid + high * 0.8) / 3;
    if (!audio.paused) {
      updateBpmEstimator(nowSec, low, mid, high);
    }
    updateBpmHint(nowSec);
    const beatRate = 1.05 * profile.motionRate;

    const theme = getTheme();
    const hue = theme.hueBase + high * theme.hueRange + profile.hueShift;
    const overlayAlpha = hasVideo
      ? 0.1 + (1 - videoBlendValue) * 0.9
      : 1;
    if (app) {
      const target = Math.min(1, energy * 1.4);
      edgeGlow = edgeGlow * 0.85 + target * 0.15;
      edgeSpin += 0.0028 + energy * 0.01;
      app.style.setProperty("--edge-alpha", (0.3 + edgeGlow * 0.58).toFixed(3));
      app.style.setProperty("--edge-alpha-2", (0.2 + edgeGlow * 0.46).toFixed(3));
      app.style.setProperty(
        "--edge-border",
        `rgba(120, 220, 255, ${(0.32 + edgeGlow * 0.62).toFixed(3)})`
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
    glow.addColorStop(
      0,
      `hsla(${theme.glowHue}, 90%, 65%, ${(0.15 + high * 0.3) * profile.glowBoost})`
    );
    glow.addColorStop(
      0.4,
      `hsla(${theme.glowHue + 40}, 85%, 62%, ${(0.08 + mid * 0.2) * profile.glowBoost})`
    );
    glow.addColorStop(1, "rgba(8, 10, 18, 0)");
    canvasCtx.fillStyle = glow;
    canvasCtx.fillRect(0, 0, width, height);

    canvasCtx.save();
    canvasCtx.globalCompositeOperation = "lighter";
    canvasCtx.lineCap = "round";

    const ribbonAmp = height * 0.08 * (0.4 + mid) * profile.ribbonBoost;
    const ribbonBase = horizon + (floor - horizon) * 0.25;
    const ribbonGap = height * 0.026;
    drawWaveRibbon(canvasCtx, vizWave, width, nowSec, {
      y: ribbonBase,
      amp: ribbonAmp,
      color: `hsla(${hue}, 92%, 70%, 0.7)`,
      widthLine: quality.name === "low" ? 2.6 : 3.2,
      glowAmt: quality.name === "low" ? 10 : 14,
      high,
      beatRate,
      step: quality.waveStep,
    });
    if (quality.drawSecondaryRibbon) {
      drawWaveRibbon(canvasCtx, vizWave, width, nowSec, {
        y: ribbonBase + ribbonGap,
        amp: ribbonAmp * 0.7,
        color: `hsla(${hue - 24}, 90%, 65%, 0.55)`,
        widthLine: quality.name === "high" ? 2.6 : 2.3,
        glowAmt: quality.name === "high" ? 10 : 8,
        high,
        beatRate,
        step: quality.waveStep + 1,
      });
      if (quality.name === "high") {
        drawWaveRibbon(canvasCtx, vizWave, width, nowSec, {
          y: ribbonBase + ribbonGap * 2,
          amp: ribbonAmp * 0.5,
          color: `hsla(${hue + 34}, 90%, 72%, 0.45)`,
          widthLine: 2.2,
          glowAmt: 8,
          high,
          beatRate,
          step: quality.waveStep + 1,
        });
      }
    }
    canvasCtx.restore();

    const barCount = quality.barCount;
    const barWidth = width / barCount;
    const barTop = floor - height * 0.02;
    const barMax = height * 0.18 * (0.7 + low * 0.8) * profile.barBoost;
    for (let i = 0; i < barCount; i += 1) {
      const idx = Math.min(vizData.length - 1, Math.floor((i / Math.max(1, barCount - 1)) * 220));
      const value = vizData[idx] / 255;
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

      const peakSlot = Math.floor((i / Math.max(1, barCount - 1)) * (barPeaks.length - 1));
      const peakDecay = 0.012 + (1 - low) * 0.01 + (quality.name === "low" ? 0.008 : 0);
      barPeaks[peakSlot] = Math.max(value, barPeaks[peakSlot] - peakDecay);
      const peakY = barTop - barPeaks[peakSlot] * barMax;
      canvasCtx.strokeStyle = `hsla(${hue + value * 100}, 90%, 76%, ${0.2 + value * 0.62})`;
      canvasCtx.lineWidth = Math.max(1, barWidth * 0.34);
      canvasCtx.beginPath();
      canvasCtx.moveTo(x - barWidth * 0.16, peakY);
      canvasCtx.lineTo(x + barWidth * 0.16, peakY);
      canvasCtx.stroke();
    }

    canvasCtx.save();
    canvasCtx.globalCompositeOperation = "lighter";
    const wingCount = quality.wingCount;
    const wingAmp = height * (0.09 + mid * 0.13) * profile.wingBoost;
    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeStyle = `hsla(${hue + 22}, 88%, 72%, ${0.16 + high * 0.35})`;
    canvasCtx.beginPath();
    for (let i = 0; i < wingCount; i += 1) {
      const t = i / (wingCount - 1);
      const idx = Math.min(vizData.length - 1, Math.floor(t * 180));
      const value = vizData[idx] / 255;
      const x = t * width;
      const wave =
        Math.sin(t * Math.PI * 5 + nowSec * (0.55 + high * 0.9)) *
        (5 + high * 10);
      const y = horizon - value * wingAmp - wave;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();
    if (quality.drawSecondaryWing) {
      canvasCtx.strokeStyle = `hsla(${hue - 18}, 86%, 70%, ${0.12 + mid * 0.24})`;
      canvasCtx.beginPath();
      for (let i = 0; i < wingCount; i += 1) {
        const t = i / (wingCount - 1);
        const idx = Math.min(vizData.length - 1, Math.floor(t * 180));
        const value = vizData[idx] / 255;
        const x = t * width;
        const wave =
          Math.sin(t * Math.PI * 4.2 + nowSec * (0.48 + low * 0.8) + 1.2) *
          (3 + mid * 8);
        const y = horizon + value * wingAmp * 0.45 + wave;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
      }
      canvasCtx.stroke();
    }

    canvasCtx.restore();

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
    btn.innerHTML = `<strong>${getPresetName(preset)}</strong><span>${getPresetDescription(preset)}</span>`;
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
      setTrackHint(t("hint.playFailed", {}, "再生を開始できませんでした"), true);
    }
  } else {
    audio.pause();
  }
  updatePlayState();
}

function updatePlayState() {
  const isPlaying = !audio.paused;
  const label = isPlaying
    ? t("buttons.pause", {}, "一時停止")
    : t("buttons.play", {}, "再生");
  playIcon.textContent = label;
  if (hudPlay) hudPlay.textContent = label;
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
    setTrackHint(t("hint.unsupported", {}, "未対応の形式です。MP3/M4A/WEBM/MP4等を選択してください"), true);
    return;
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  hasLoadedTrack = true;
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
  if (typeof resetAdaptiveMixState === "function") {
    resetAdaptiveMixState();
  }
  if (typeof resetOutputProtectionState === "function") {
    resetOutputProtectionState();
  }
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
  fullBtn.textContent = isFs
    ? t("buttons.fullscreenClose", {}, "閉じる")
    : t("buttons.fullscreen", {}, "全画面");
}

function updateBypassButton() {
  if (!abToggle) return;
  abToggle.textContent = bypass3D
    ? t("ab.off", {}, "A/B: 3D OFF")
    : t("ab.on", {}, "A/B: 3D ON");
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

function getQualityLabel(mode) {
  if (mode === "high") return t("settings.qualityHigh", {}, "High");
  if (mode === "balanced") return t("settings.qualityBalanced", {}, "Balanced");
  if (mode === "eco") return t("settings.qualityEco", {}, "Eco");
  return t("settings.qualityAuto", {}, "Auto");
}

function cyclePreset(step) {
  if (!Array.isArray(presets) || presets.length === 0) return;
  const activeId = currentPreset ? currentPreset.id : pendingPresetId || presets[0].id;
  const index = Math.max(0, presets.findIndex((preset) => preset.id === activeId));
  const nextIndex = (index + step + presets.length) % presets.length;
  const preset = presets[nextIndex];
  applyPreset(preset);
  if (typeof showTransientHint === "function") {
    const presetName = getPresetName(preset);
    showTransientHint(t("hint.shortcutPreset", { value: presetName }, `Preset: ${presetName}`));
  }
}

function toggleMotionShortcut() {
  motionToggle.checked = !motionToggle.checked;
  updatePannerPositions(performance.now() / 1000);
  updateLoopState();
  saveSettings();
  if (typeof showTransientHint === "function") {
    showTransientHint(
      motionToggle.checked
        ? t("hint.shortcutMotionOn", {}, "Motion: ON")
        : t("hint.shortcutMotionOff", {}, "Motion: OFF")
    );
  }
}

function toggleVisualizerShortcut() {
  if (!vizToggle) return;
  vizToggle.checked = !vizToggle.checked;
  setVisualizerEnabled(vizToggle.checked);
  if (typeof showTransientHint === "function") {
    showTransientHint(
      vizToggle.checked
        ? t("hint.shortcutVizOn", {}, "Visualizer: ON")
        : t("hint.shortcutVizOff", {}, "Visualizer: OFF")
    );
  }
}

function cycleQualityModeShortcut() {
  const modes = SUPPORTED_QUALITY_MODES;
  const index = Math.max(0, modes.indexOf(currentQualityMode));
  const next = modes[(index + 1) % modes.length];
  setQualityMode(next);
  if (typeof showTransientHint === "function") {
    const label = getQualityLabel(next);
    showTransientHint(t("hint.shortcutQuality", { value: label }, `Quality: ${label}`));
  }
}

function cycleLanguageShortcut() {
  const langs = SUPPORTED_LANGUAGES;
  const index = Math.max(0, langs.indexOf(currentLanguage));
  const next = langs[(index + 1) % langs.length];
  setLanguage(next);
  if (typeof showTransientHint === "function") {
    const label = t(`settings.lang.${next}`, {}, next);
    showTransientHint(t("hint.shortcutLanguage", { value: label }, `Language: ${label}`));
  }
}

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function handleGlobalKeydown(event) {
  if (event.code === "Escape") {
    if (helpPanel && !helpPanel.hidden) {
      event.preventDefault();
      closeHelpPanel();
      return;
    }
    if (settingsPanel && !settingsPanel.hidden) {
      event.preventDefault();
      closeSettingsPanel();
      return;
    }
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (isEditableTarget(event.target)) return;
  if (helpPanel && !helpPanel.hidden) {
    if (event.code === "KeyH" || (event.code === "Slash" && event.shiftKey)) {
      event.preventDefault();
      closeHelpPanel();
    }
    return;
  }
  if (settingsPanel && !settingsPanel.hidden && event.target instanceof HTMLElement) {
    if (event.target.closest("#settings-panel")) return;
  }

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
    case "BracketLeft":
      event.preventDefault();
      cyclePreset(-1);
      break;
    case "BracketRight":
      event.preventDefault();
      cyclePreset(1);
      break;
    case "KeyM":
      event.preventDefault();
      toggleMotionShortcut();
      break;
    case "KeyV":
      event.preventDefault();
      toggleVisualizerShortcut();
      break;
    case "KeyQ":
      event.preventDefault();
      cycleQualityModeShortcut();
      break;
    case "KeyL":
      event.preventDefault();
      cycleLanguageShortcut();
      break;
    case "KeyH":
      event.preventDefault();
      toggleHelpPanel();
      break;
    case "Slash":
      if (event.shiftKey) {
        event.preventDefault();
        toggleHelpPanel();
      }
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

function openSettingsPanel() {
  if (!settingsPanel || !settingsBtn) return;
  closeHelpPanel();
  settingsPanel.hidden = false;
  settingsBtn.setAttribute("aria-expanded", "true");
}

function closeSettingsPanel() {
  if (!settingsPanel || !settingsBtn) return;
  settingsPanel.hidden = true;
  settingsBtn.setAttribute("aria-expanded", "false");
}

function toggleSettingsPanel() {
  if (!settingsPanel) return;
  if (settingsPanel.hidden) {
    openSettingsPanel();
  } else {
    closeSettingsPanel();
  }
}

function openHelpPanel() {
  if (!helpPanel || !helpBtn) return;
  closeSettingsPanel();
  helpPanel.hidden = false;
  helpBtn.setAttribute("aria-expanded", "true");
}

function closeHelpPanel() {
  if (!helpPanel || !helpBtn) return;
  helpPanel.hidden = true;
  helpBtn.setAttribute("aria-expanded", "false");
}

function toggleHelpPanel() {
  if (!helpPanel) return;
  if (helpPanel.hidden) {
    openHelpPanel();
  } else {
    closeHelpPanel();
  }
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
  setTrackHint(t("hint.fileError", {}, "このファイルは再生できませんでした"), true);
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
if (motionIntensity) {
  motionIntensity.addEventListener("input", () => {
    updatePannerPositions(performance.now() / 1000);
    updateLoopState();
    saveSettings();
  });
}
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
if (eqBass) {
  eqBass.addEventListener("input", () => {
    updateEqSettings();
    saveSettings();
  });
}
if (eqMid) {
  eqMid.addEventListener("input", () => {
    updateEqSettings();
    saveSettings();
  });
}
if (eqTreble) {
  eqTreble.addEventListener("input", () => {
    updateEqSettings();
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
if (settingsBtn) {
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsPanel();
  });
}
if (settingsClose) {
  settingsClose.addEventListener("click", closeSettingsPanel);
}
if (helpBtn) {
  helpBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHelpPanel();
  });
}
if (helpClose) {
  helpClose.addEventListener("click", closeHelpPanel);
}
if (langSegment) {
  langSegment.querySelectorAll("button[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.lang);
    });
  });
}
if (layoutSegment) {
  layoutSegment.querySelectorAll("button[data-layout]").forEach((button) => {
    button.addEventListener("click", () => {
      setLayout(button.dataset.layout);
    });
  });
}
if (qualitySegment) {
  qualitySegment.querySelectorAll("button[data-quality]").forEach((button) => {
    button.addEventListener("click", () => {
      setQualityMode(button.dataset.quality);
    });
  });
}
if (protectMeterToggle) {
  protectMeterToggle.addEventListener("change", () => {
    setProtectMeterEnabled(protectMeterToggle.checked);
  });
}
document.addEventListener("keydown", handleGlobalKeydown);
document.addEventListener("click", (event) => {
  const target = event.target;
  const settingsOpen = Boolean(settingsPanel && !settingsPanel.hidden);
  const helpOpen = Boolean(helpPanel && !helpPanel.hidden);
  if (!settingsOpen && !helpOpen) return;
  if (settingsPanel && settingsPanel.contains(target)) return;
  if (helpPanel && helpPanel.contains(target)) return;
  if (settingsBtn && settingsBtn.contains(target)) return;
  if (helpBtn && helpBtn.contains(target)) return;
  closeSettingsPanel();
  closeHelpPanel();
});
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

if (versionBadge) versionBadge.textContent = APP_VERSION;
void initWasmMath();
restoreSettings();
setLayout(currentLayout, false);
setLanguage(currentLanguage, false);
setQualityMode(currentQualityMode, false);
setProtectMeterEnabled(protectMeterEnabled, false);
updatePlayState();
syncFullscreenState();
updateThemeButtons();
updateBypassButton();
setVisualizerEnabled(vizToggle ? vizToggle.checked : true);
updateVideoBlend();
