(() => {
  const splash = document.getElementById("app-splash");
  if (!splash) return;

  const start = performance.now();
  const minVisibleMs = 520;
  let hidden = false;

  const hide = () => {
    if (hidden) return;
    hidden = true;
    const elapsed = performance.now() - start;
    const wait = Math.max(0, minVisibleMs - elapsed);
    window.setTimeout(() => {
      splash.classList.add("is-hidden");
      window.setTimeout(() => {
        splash.remove();
      }, 650);
    }, wait);
  };

  if (document.readyState === "complete") {
    hide();
  } else {
    window.addEventListener("load", hide, { once: true });
  }

  window.setTimeout(hide, 2600);
})();
