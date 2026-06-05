import { getPersonalEdgeThickness, normalizeEdge } from "../settings.js";
import {
  DOCK_SNAP_PX,
  CONTROL_BUTTON_GAP,
  DRAG_CLASS,
  EDGE_MARGIN,
  GRAB_CLASS,
  HIDE_CURSOR_CLASS,
  handleGapForEdge,
  isHorizontalEdge,
  viewportSize
} from "./constants.js";

function freeHandlePositionForPointer(shell, edge, clientX, clientY, metrics, handle) {
  const normalizedEdge = normalizeEdge(edge);
  const { width, height } = viewportSize();

  const hasReferenceControl = Boolean(shell.referenceToggleEl);
  const horizontalCluster = hasReferenceControl
    ? (handle.width * 2) + CONTROL_BUTTON_GAP
    : handle.width;
  const verticalCluster = hasReferenceControl
    ? (handle.height * 2) + CONTROL_BUTTON_GAP
    : handle.height;
  const horizontalInset = Math.max(EDGE_MARGIN, Math.round((metrics.thickness - horizontalCluster) / 2));
  const verticalInset = Math.max(EDGE_MARGIN, Math.round((metrics.thickness - verticalCluster) / 2));

  if (normalizedEdge === "top") {
    return {
      x: clientX - (handle.width / 2),
      y: verticalInset
    };
  }

  if (normalizedEdge === "bottom") {
    const railTop = height - metrics.thickness + verticalInset;
    return {
      x: clientX - (handle.width / 2),
      y: Math.max(0, railTop + (hasReferenceControl ? handle.height + CONTROL_BUTTON_GAP : 0))
    };
  }

  if (normalizedEdge === "left") {
    return {
      x: horizontalInset,
      y: clientY - (handle.height / 2)
    };
  }

  const railLeft = width - metrics.thickness + horizontalInset;
  return {
    x: Math.max(0, railLeft + (hasReferenceControl ? handle.width + CONTROL_BUTTON_GAP : 0)),
    y: clientY - (handle.height / 2)
  };
}

function dockSnapForPointer(shell, clientX, clientY) {
  const { width, height } = viewportSize();
  const handle = shell._handleVisualSize();
  const candidates = [
    { edge: "top", distance: clientY, line: 0, kind: "wall" },
    { edge: "bottom", distance: height - clientY, line: height, kind: "wall" },
    { edge: "left", distance: clientX, line: 0, kind: "wall" },
    { edge: "right", distance: width - clientX, line: width, kind: "wall" }
  ];

  // Intentionally use only viewport-wall snapping. Earlier versions also snapped to the
  // exposed edge of the open capsule, but that recreated the old Macro Blade barrier
  // gap where the ghost could not be brought cleanly back to the wall while open.

  candidates.sort((a, b) => a.distance - b.distance);
  const best = candidates[0];
  if (!best || best.distance > DOCK_SNAP_PX) {
    return {
      edge: null,
      offset: 0,
      gx: clientX - (handle.width / 2),
      gy: clientY - (handle.height / 2)
    };
  }

  const edge = normalizeEdge(best.edge);
  const thickness = shell._liveThickness ?? shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge);
  const metrics = shell._layoutMetrics(edge, thickness);
  const handleGap = handleGapForEdge(edge);
  const rawOffset = isHorizontalEdge(edge)
    ? clientX + (handle.width / 2) + handleGap
    : clientY + (handle.height / 2) + handleGap;
  const pos = freeHandlePositionForPointer(shell, edge, clientX, clientY, metrics, handle);

  return { edge, offset: rawOffset, gx: pos.x, gy: pos.y };
}

export function bindHandleDrag(shell) {
  if (!shell.handleEl) return;

  const DRAG_THRESHOLD_PX = 6;
  const GRAB_THRESHOLD_PX = 1;

  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let dragging = false;
  let grabbing = false;
  let accX = 0;
  let accY = 0;
  let ghost = null;
  let snapEdge = null;
  let snapOffset = 0;

  const ensureGhost = () => {
    if (ghost && document.body.contains(ghost)) return ghost;
    ghost = document.createElement("div");
    ghost.className = "sac-dock-ghost";
    const ghostButton = document.createElement("button");
    ghostButton.type = "button";
    ghostButton.className = "sac-handle";
    ghostButton.innerHTML = shell.handleEl?.innerHTML || "";
    ghost.appendChild(ghostButton);
    document.body.appendChild(ghost);
    return ghost;
  };

  const updateGhost = (snap) => {
    const el = ensureGhost();
    if (!el) return;
    el.style.left = `${Math.round(snap.gx)}px`;
    el.style.top = `${Math.round(snap.gy)}px`;
    el.dataset.snap = snap.edge || "none";
  };

  const cleanup = ({ removeGhost = true } = {}) => {
    try { if (pointerId != null) shell.handleEl.releasePointerCapture(pointerId); } catch (_) {}
    if (removeGhost) {
      try { ghost?.remove?.(); } catch (_) {}
      ghost = null;
    }
    snapEdge = null;
    snapOffset = 0;
    pointerId = null;
    dragging = false;
    grabbing = false;
    accX = 0;
    accY = 0;
    document.documentElement.classList.remove(DRAG_CLASS);
    document.documentElement.classList.remove(GRAB_CLASS);
    document.documentElement.classList.remove(HIDE_CURSOR_CLASS);
  };

  shell.handleEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    grabbing = false;
    accX = 0;
    accY = 0;
    snapEdge = null;
    snapOffset = 0;
    try { shell.handleEl.setPointerCapture(pointerId); } catch (_) {}
  }, { capture: true });

  shell.handleEl.addEventListener("pointermove", (event) => {
    if (pointerId == null || event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const x = event.clientX;
    const y = event.clientY;
    const dx = x - startX;
    const dy = y - startY;

    try {
      accX += Number(event.movementX || 0);
      accY += Number(event.movementY || 0);
    } catch (_) {}

    if (!grabbing) {
      const moved = Math.hypot(dx, dy) >= GRAB_THRESHOLD_PX || Math.hypot(accX, accY) >= GRAB_THRESHOLD_PX;
      if (!moved) return;
      grabbing = true;
      document.documentElement.classList.add(GRAB_CLASS);
    }

    const snap = dockSnapForPointer(shell, x, y);
    snapEdge = snap.edge;
    snapOffset = snap.offset;
    updateGhost(snap);

    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!dragging) {
      shell.closeReferenceDrawer?.();
      dragging = true;
      document.documentElement.classList.add(DRAG_CLASS);
      document.documentElement.classList.add(HIDE_CURSOR_CLASS);
    }
  }, { capture: true });

  shell.handleEl.addEventListener("pointerup", async (event) => {
    if (pointerId == null || event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    try { shell.handleEl.releasePointerCapture(pointerId); } catch (_) {}
    const wasDragging = dragging;
    const edge = snapEdge;
    const offset = snapOffset;

    if (!wasDragging) {
      cleanup();
      shell.toggle();
      return;
    }

    if (edge) {
      try {
        await shell.setDock(edge, offset, { persist: true });
        await shell._waitFrames(1);
      } finally {
        cleanup();
      }
      return;
    }

    cleanup();
  }, { capture: true });

  shell.handleEl.addEventListener("pointercancel", (event) => {
    if (pointerId != null && event.pointerId !== pointerId) return;
    cleanup();
  }, { capture: true });
}
