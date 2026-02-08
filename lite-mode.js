(() => {
  function hideControlByInputId(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const label = input.closest("label");
    if (label) label.style.display = "none";
  }

  function applyLiteMode() {
    const layoutSegment = document.getElementById("layout-segment");
    if (layoutSegment) {
      const label = layoutSegment.closest("label");
      if (label) label.style.display = "none";
      layoutSegment.style.display = "none";
    }
    if (typeof setLayout === "function") {
      setLayout("vertical");
    }

    hideControlByInputId("viz-toggle");
    hideControlByInputId("video-blend");
    const theme = document.getElementById("viz-theme");
    if (theme) {
      const label = theme.closest("label");
      if (label) label.style.display = "none";
    }
    const fullBtn = document.getElementById("viz-full-btn");
    if (fullBtn) fullBtn.style.display = "none";

    const vizToggle = document.getElementById("viz-toggle");
    if (vizToggle) {
      vizToggle.checked = false;
      if (typeof setVisualizerEnabled === "function") {
        setVisualizerEnabled(false);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLiteMode, { once: true });
  } else {
    applyLiteMode();
  }
})();
