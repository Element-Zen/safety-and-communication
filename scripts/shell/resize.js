import {
  clampNumber,
  getPersonalEdgeThickness,
  setPersonalEdgeThickness
} from "../settings.js";
import { MAX_THICKNESS, MIN_THICKNESS, RESIZE_CLASS, isHorizontalEdge } from "./constants.js";

export function bindEdgeResize(shell) {
  if (!shell.resizeEl) return;

  let pointerId = null;
  let resizing = false;
  let baseX = 0;
  let baseY = 0;
  let baseThickness = 0;

  const cleanup = () => {
    try { shell.resizeEl.releasePointerCapture(pointerId); } catch (_) {}
    document.documentElement.classList.remove(RESIZE_CLASS);
    pointerId = null;
    resizing = false;
    baseX = 0;
    baseY = 0;
    baseThickness = 0;
  };

  const applyLiveThickness = (thickness) => {
    const next = clampNumber(thickness, MIN_THICKNESS, MAX_THICKNESS, shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge));
    shell._liveThickness = next;
    shell._canonicalThickness = next;
    shell.sync({ preferPredictedSize: true });
    return next;
  };

  shell.resizeEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    resizing = true;
    baseX = event.clientX;
    baseY = event.clientY;
    baseThickness = shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge);
    shell._motion = "idle";
    if (shell.shellEl) shell.shellEl.dataset.motion = "idle";
    applyLiveThickness(baseThickness);
    document.documentElement.classList.add(RESIZE_CLASS);
    try { shell.resizeEl.setPointerCapture(pointerId); } catch (_) {}
  }, { capture: true });

  shell.resizeEl.addEventListener("pointermove", (event) => {
    if (!resizing || event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const horizontal = isHorizontalEdge(shell.edge);
    const delta = horizontal ? (event.clientY - baseY) : (event.clientX - baseX);
    const sign = (shell.edge === "bottom" || shell.edge === "right") ? -1 : 1;
    const intended = baseThickness + (delta * sign);
    const thickness = applyLiveThickness(intended);

    if (thickness !== intended) {
      baseX = event.clientX;
      baseY = event.clientY;
      baseThickness = thickness;
    }
  }, { capture: true });

  shell.resizeEl.addEventListener("pointerup", async (event) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const thickness = shell._liveThickness ?? shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge);
    shell._canonicalThickness = thickness;
    await setPersonalEdgeThickness(shell.edge, thickness);
    shell._liveThickness = null;
    shell.sync({ preferPredictedSize: true });
    cleanup();
  }, { capture: true });

  shell.resizeEl.addEventListener("pointercancel", (event) => {
    if (pointerId != null && event.pointerId !== pointerId) return;
    shell._liveThickness = null;
    shell.sync({ preferPredictedSize: true });
    cleanup();
  }, { capture: true });
}
