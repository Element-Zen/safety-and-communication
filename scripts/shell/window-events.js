export function bindWindowResize(shell) {
  if (shell._windowResizeBound) return;
  shell._windowResizeBound = true;
  let raf = 0;
  window.addEventListener("resize", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      shell.sync({ recenterIfUnset: true, preferPredictedSize: true });
    });
  }, { passive: true });
}
