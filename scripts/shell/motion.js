import { COMMIT_CLASS } from "./constants.js";

export function clearMotionTimer(shell) {
  if (!shell._motionTimer) return;
  window.clearTimeout(shell._motionTimer);
  shell._motionTimer = null;
}

export function scheduleMotionIdle(shell) {
  clearMotionTimer(shell);
  if (shell._motion === "idle") return;
  shell._motionTimer = window.setTimeout(() => {
    shell._motionTimer = null;
    shell._motion = "idle";
    if (shell.shellEl) shell.shellEl.dataset.motion = "idle";
  }, 360);
}

export function beginDockCommit(shell) {
  clearMotionTimer(shell);
  shell._motion = "idle";
  try {
    shell.shellEl?.classList?.add?.(COMMIT_CLASS);
    if (shell.shellEl) shell.shellEl.dataset.motion = "idle";
  } catch (_) {}
}

export function endDockCommit(shell) {
  try { shell.shellEl?.classList?.remove?.(COMMIT_CLASS); } catch (_) {}
}

export function clearInitialPaintLock(shell) {
  const root = shell.shellEl;
  if (!root) return;
  const clear = () => {
    try { root.classList.remove("sac-initializing"); } catch (_) {}
  };
  try {
    requestAnimationFrame(() => requestAnimationFrame(clear));
  } catch (_) {
    window.setTimeout(clear, 32);
  }
}

export function waitFrames(count = 1) {
  const frames = Math.max(1, Number(count) || 1);
  return new Promise((resolve) => {
    const step = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      try {
        requestAnimationFrame(() => step(remaining - 1));
      } catch (_) {
        window.setTimeout(() => step(remaining - 1), 16);
      }
    };
    step(frames);
  });
}
