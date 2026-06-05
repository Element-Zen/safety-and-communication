import {
  clampNumber,
  getPersonalEdgeThickness,
  normalizeEdge
} from "../settings.js";
import {
  BUTTON_INSET,
  CONTROL_BUTTON_GAP,
  EDGE_MARGIN,
  HANDLE_SIZE,
  handleGapForEdge,
  MAX_THICKNESS,
  MIN_THICKNESS,
  isHorizontalEdge,
  viewportSize
} from "./constants.js";

export function handleVisualSize(shell) {
  try {
    const rect = shell.handleEl?.getBoundingClientRect?.();
    if (Number.isFinite(rect?.width) && Number.isFinite(rect?.height) && rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
  } catch (_) {}
  return { width: HANDLE_SIZE, height: HANDLE_SIZE };
}

export function buttonSizeForThickness(thickness) {
  const maxButton = Math.max(34, MAX_THICKNESS - BUTTON_INSET);
  return Math.round(clampNumber(Number(thickness) - BUTTON_INSET, 34, maxButton, 64));
}

export function renderedThickness(shell) {
  try {
    const rect = shell.capsuleEl?.getBoundingClientRect?.();
    const measured = isHorizontalEdge(shell.edge) ? rect?.height : rect?.width;
    if (Number.isFinite(measured) && measured > 0) return clampNumber(measured, MIN_THICKNESS, MAX_THICKNESS, getPersonalEdgeThickness(shell.edge));
  } catch (_) {}
  return getPersonalEdgeThickness(shell.edge);
}

export function layoutMetrics(shell, edge = shell.edge, canonicalThickness = shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge)) {
  const normalizedEdge = normalizeEdge(edge);
  const horizontal = isHorizontalEdge(normalizedEdge);
  const axisSize = horizontal ? viewportSize().width : viewportSize().height;
  const reservedHandle = HANDLE_SIZE + handleGapForEdge(normalizedEdge);
  const available = Math.max(64, axisSize - (EDGE_MARGIN * 2) - reservedHandle);
  const count = Math.max(1, shell._lastToolCount || 1);
  const baseThickness = clampNumber(canonicalThickness, MIN_THICKNESS, MAX_THICKNESS, getPersonalEdgeThickness(shell.edge));
  const baseButton = buttonSizeForThickness(baseThickness);
  const baseGap = 8;
  const basePadding = 20;
  const naturalLength = (baseButton * count) + (baseGap * Math.max(0, count - 1)) + basePadding;
  const scale = Math.min(1, available / Math.max(1, naturalLength));
  const buttonSize = Math.max(24, Math.round(baseButton * scale));
  const gap = Math.max(2, Math.round(baseGap * scale));
  const padding = Math.max(8, Math.round(basePadding * scale));
  const thickness = Math.max(MIN_THICKNESS, Math.round(baseThickness * scale));
  const primarySize = (buttonSize * count) + (gap * Math.max(0, count - 1)) + padding;

  return {
    buttonSize,
    gap,
    padding,
    thickness,
    primarySize,
    scale
  };
}

function capsuleOffsetBounds(shell, edge = shell.edge, { handle = handleVisualSize(shell), metrics = null } = {}) {
  const normalizedEdge = normalizeEdge(edge);
  const horizontal = isHorizontalEdge(normalizedEdge);
  const viewport = horizontal ? viewportSize().width : viewportSize().height;
  const capsuleSize = metrics?.primarySize ?? capsulePrimarySize(shell, normalizedEdge);
  const handleSize = horizontal ? handle.width : handle.height;
  const handleGap = handleGapForEdge(normalizedEdge);

  if (horizontal) {
    const min = EDGE_MARGIN + handleSize + handleGap;
    const max = Math.max(min, viewport - capsuleSize - EDGE_MARGIN);
    return { min, max };
  }

  const min = EDGE_MARGIN + handleSize + handleGap;
  const max = Math.max(min, viewport - capsuleSize - EDGE_MARGIN);
  return { min, max };
}

// Kept under the previous name because the shell stores one persisted offset value.
// In v0.3.2 that offset is the capsule anchor, and the handle is derived from it.
export function clampedHandleOffset(shell, value, { edge = shell.edge, recenterIfUnset = false, handle = handleVisualSize(shell), metrics = null } = {}) {
  const normalizedEdge = normalizeEdge(edge);
  const bounds = capsuleOffsetBounds(shell, normalizedEdge, { handle, metrics });

  let raw = Number(value);
  if (!Number.isFinite(raw)) {
    raw = recenterIfUnset ? (bounds.min + bounds.max) / 2 : bounds.min;
  }

  return clampNumber(raw, bounds.min, bounds.max, bounds.min);
}


export function capsuleOffsetForCenteredHandle(shell, edge = "top", { handle = handleVisualSize(shell), metrics = null } = {}) {
  const normalizedEdge = normalizeEdge(edge);
  const horizontal = isHorizontalEdge(normalizedEdge);
  const viewport = horizontal ? viewportSize().width : viewportSize().height;
  const handleSize = horizontal ? handle.width : handle.height;
  const handleGap = handleGapForEdge(normalizedEdge);
  const desiredHandleCenter = viewport / 2;
  const rawOffset = desiredHandleCenter + (handleSize / 2) + handleGap;
  const nextMetrics = metrics ?? layoutMetrics(shell, normalizedEdge, shell._liveThickness ?? shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge));

  return clampedHandleOffset(shell, rawOffset, {
    edge: normalizedEdge,
    handle,
    metrics: nextMetrics,
    recenterIfUnset: true
  });
}

export function capsulePrimarySize(shell, edge = shell.edge, { preferPredictedSize = false } = {}) {
  const metrics = layoutMetrics(shell, edge, shell._liveThickness ?? shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge));
  return metrics.primarySize;
}

export function capsuleOffsetFromHandleOffset(shell, edge = shell.edge, handleOffset = shell.offset, { handle = handleVisualSize(shell), metrics = null, preferPredictedSize = false } = {}) {
  const normalizedEdge = normalizeEdge(edge);
  const nextMetrics = metrics ?? layoutMetrics(shell, normalizedEdge, shell._liveThickness ?? shell._canonicalThickness ?? getPersonalEdgeThickness(shell.edge));
  return clampedHandleOffset(shell, handleOffset, {
    edge: normalizedEdge,
    handle,
    metrics: nextMetrics,
    recenterIfUnset: true
  });
}

export function handlePosition(shell, edge = shell.edge, offset = shell.offset, thickness = getPersonalEdgeThickness(edge), handle = handleVisualSize(shell)) {
  const normalizedEdge = normalizeEdge(edge);
  const { width, height } = viewportSize();
  const metrics = layoutMetrics(shell, normalizedEdge, thickness);
  const capsuleOffset = clampedHandleOffset(shell, offset, {
    edge: normalizedEdge,
    handle,
    metrics,
    recenterIfUnset: true
  });
  const handleGap = handleGapForEdge(normalizedEdge);

  const hasReferenceControl = Boolean(shell.referenceToggleEl);
  const horizontalCluster = hasReferenceControl
    ? (handle.width * 2) + CONTROL_BUTTON_GAP
    : handle.width;
  const verticalCluster = hasReferenceControl
    ? (handle.height * 2) + CONTROL_BUTTON_GAP
    : handle.height;
  const horizontalInset = Math.max(EDGE_MARGIN, Math.round((metrics.thickness - horizontalCluster) / 2));
  const verticalInset = Math.max(EDGE_MARGIN, Math.round((metrics.thickness - verticalCluster) / 2));

  // The control rail uses the collapsed wall-rest coordinate as its permanent
  // home. The chevron and reference button are treated as one rail even when
  // the reference button is hidden, so adding/removing reference text does not
  // shift the handle position. Open/closed state only flips the chevron and
  // moves the capsule.
  if (normalizedEdge === "top") {
    return {
      x: capsuleOffset - handle.width - handleGap,
      y: verticalInset
    };
  }

  if (normalizedEdge === "bottom") {
    const railTop = height - metrics.thickness + verticalInset;
    return {
      x: capsuleOffset - handle.width - handleGap,
      y: Math.max(0, railTop + (hasReferenceControl ? handle.height + CONTROL_BUTTON_GAP : 0))
    };
  }

  if (normalizedEdge === "left") {
    return {
      x: horizontalInset,
      y: capsuleOffset - handle.height - handleGap
    };
  }

  const railLeft = width - metrics.thickness + horizontalInset;
  return {
    x: Math.max(0, railLeft + (hasReferenceControl ? handle.width + CONTROL_BUTTON_GAP : 0)),
    y: capsuleOffset - handle.height - handleGap
  };
}
