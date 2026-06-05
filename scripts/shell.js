import { playNotificationChime } from "./audio/notification-audio.js";
import {
  getInitialDrawerState,
  getNotificationTimerMode,
  getNotificationTimerSeconds,
  getPersonalDock,
  getPersonalEdgeThickness,
  getPersonalPlacementInitialized,
  MODULE_ID,
  MODULE_TITLE,
  normalizeEdge,
  notificationTimerKeepOpenForXCard,
  setPersonalDock,
  setPersonalPlacementInitialized
} from "./settings.js";
import {
  buildShellDom,
  renderSafetyReferenceDrawer,
  renderToolSources,
  renderTools,
  syncHandleIcon,
  syncToolSizing
} from "./shell/dom.js";
import { bindHandleDrag } from "./shell/drag.js";
import { bindEdgeResize } from "./shell/resize.js";
import { bindWindowResize } from "./shell/window-events.js";
import {
  beginDockCommit,
  clearInitialPaintLock,
  clearMotionTimer,
  endDockCommit,
  scheduleMotionIdle,
  waitFrames
} from "./shell/motion.js";
import {
  capsuleOffsetForCenteredHandle,
  capsuleOffsetFromHandleOffset,
  capsulePrimarySize,
  clampedHandleOffset,
  handlePosition,
  handleVisualSize,
  layoutMetrics,
  renderedThickness,
  buttonSizeForThickness
} from "./shell/placement.js";
import { CLOSED_CLASS, OPEN_CLASS } from "./shell/constants.js";

export class SafetyCommunicationShell {
  constructor() {
    const dock = getPersonalDock();
    this.edge = dock.edge;
    // User-authored desired capsule anchor. Temporary viewport push-off must not overwrite this.
    this.offset = dock.offset;
    this._resolvedOffset = null;
    this.isOpen = getInitialDrawerState() !== "closed";
    this.openIntent = this.isOpen ? "manual" : "closed";
    this._notificationAutoCloseTimer = null;
    this.shellEl = null;
    this.capsuleEl = null;
    this.toolsEl = null;
    this.handleEl = null;
    this.resizeEl = null;
    this.referenceToggleEl = null;
    this.referenceDrawerEl = null;
    this.referenceOpen = false;
    this._referencePlacement = null;
    this._referencePlacementClearTimer = null;
    this._referenceContentSignature = "";
    this._lastToolCount = 0;
    this._canonicalThickness = getPersonalEdgeThickness(this.edge);
    this._liveThickness = null;
    // Initial render must be static. Open/close animations are only for explicit user actions.
    this._motion = "idle";
    this._motionTimer = null;
    this._windowResizeBound = false;
  }

  render() {
    if (this.shellEl && document.body.contains(this.shellEl)) {
      this.sync();
      return this.shellEl;
    }

    const dom = buildShellDom({ edge: this.edge, isOpen: this.isOpen });
    this.shellEl = dom.shell;
    this.capsuleEl = dom.capsule;
    this.toolsEl = dom.tools;
    this.handleEl = dom.handle;
    this.resizeEl = dom.resize;
    this.referenceToggleEl = dom.referenceToggle;
    this.referenceDrawerEl = dom.referenceDrawer;

    this._renderTools();
    this._seedInitialPlacement();
    this.sync({ recenterIfUnset: true, preferPredictedSize: true });
    document.body.appendChild(this.shellEl);
    this._bindHandle();
    this._bindManualPromotion();
    this._bindReferenceToggle();
    this._bindResize();
    this._bindWindowResize();
    this._clearInitialPaintLock();

    return this.shellEl;
  }

  destroy() {
    this._clearMotionTimer();
    this._clearNotificationAutoCloseTimer();
    this._cancelReferencePlacementClear();
    try {
      this.shellEl?.remove();
    } catch (_) {}
    this.shellEl = null;
    this.capsuleEl = null;
    this.toolsEl = null;
    this.handleEl = null;
    this.resizeEl = null;
    this.referenceToggleEl = null;
    this.referenceDrawerEl = null;
    this.referenceOpen = false;
    this.openIntent = "closed";
    this._resolvedOffset = null;
    this._clearReferencePlacement();
    this._referenceContentSignature = "";
  }

  refreshTools() {
    if (!this.toolsEl) return;
    this._renderTools();
    this.sync({ preferPredictedSize: true });
  }

  refreshReferenceDrawer() {
    this.sync({ preferPredictedSize: true });
  }

  refreshNotificationTimerPreferences() {
    this._referenceContentSignature = "";
    this._renderReferenceDrawer();
    this._updateReferencePlacement();
    this._refreshNotificationAutoCloseTimer();
  }

  refreshNotificationSoundPreferences() {
    this._referenceContentSignature = "";
    this._renderReferenceDrawer();
    this._updateReferencePlacement();
  }

  toggleReferenceDrawer() {
    if (!this.isOpen) return;
    if (this.referenceOpen) {
      this.closeReferenceDrawer();
      return;
    }
    this._cancelReferencePlacementClear();
    this.referenceOpen = true;
    this._captureReferencePlacement();
    this.sync({ preferPredictedSize: true });
  }

  closeReferenceDrawer() {
    this.referenceOpen = false;
    this._renderReferenceDrawer();
    this._scheduleReferencePlacementClear();
  }

  _viewportSize() {
    return {
      width: Math.max(1, Number(window?.innerWidth) || document.documentElement?.clientWidth || 1),
      height: Math.max(1, Number(window?.innerHeight) || document.documentElement?.clientHeight || 1)
    };
  }

  _captureReferencePlacement() {
    if (!this.capsuleEl) {
      this._referencePlacement = null;
      return null;
    }

    const rect = this.capsuleEl.getBoundingClientRect();
    const valid = rect && rect.width > 0 && rect.height > 0;
    if (!valid) {
      this._referencePlacement = null;
      return null;
    }

    this._referencePlacement = {
      edge: normalizeEdge(this.edge),
      centerX: rect.left + (rect.width / 2),
      centerY: rect.top + (rect.height / 2),
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom
    };
    return this._referencePlacement;
  }

  _cancelReferencePlacementClear() {
    if (!this._referencePlacementClearTimer) return;
    window.clearTimeout(this._referencePlacementClearTimer);
    this._referencePlacementClearTimer = null;
  }

  _scheduleReferencePlacementClear(delayMs = 220) {
    this._cancelReferencePlacementClear();
    this._referencePlacementClearTimer = window.setTimeout(() => {
      this._referencePlacementClearTimer = null;
      this._clearReferencePlacement({ cancelTimer: false });
    }, Math.max(1, Number(delayMs) || 220));
  }

  _clearReferencePlacement({ cancelTimer = true } = {}) {
    if (cancelTimer) this._cancelReferencePlacementClear();
    this._referencePlacement = null;
    if (!this.referenceDrawerEl) return;
    for (const name of [
      "--sac-reference-left",
      "--sac-reference-top",
      "--sac-reference-drawer-max-height"
    ]) {
      try { this.referenceDrawerEl.style.removeProperty(name); } catch (_) {}
    }
    try { this.referenceDrawerEl.dataset.positioned = "false"; } catch (_) {}
  }

  _updateReferencePlacement() {
    if (!this.referenceDrawerEl) return;
    if (!this.referenceOpen || !this.isOpen) return;

    const placement = this._referencePlacement || this._captureReferencePlacement();
    if (!placement) return;

    const edge = normalizeEdge(placement.edge || this.edge);
    const drawer = this.referenceDrawerEl;
    const viewport = this._viewportSize();
    const margin = 12;
    const gap = 10;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

    const verticalEdge = edge === "left" || edge === "right";
    let availableHeight = Math.max(120, viewport.height - (margin * 2));
    if (!verticalEdge && edge === "top") {
      availableHeight = Math.max(120, viewport.height - placement.bottom - gap - margin);
    } else if (!verticalEdge && edge === "bottom") {
      availableHeight = Math.max(120, placement.top - gap - margin);
    }

    const maxHeight = Math.max(120, availableHeight);
    drawer.style.setProperty("--sac-reference-drawer-max-height", `${Math.round(maxHeight)}px`);

    const rect = drawer.getBoundingClientRect();
    const drawerWidth = Math.max(1, rect.width || drawer.offsetWidth || 1);
    const drawerHeight = Math.max(1, Math.min(rect.height || drawer.offsetHeight || maxHeight, maxHeight));

    let left;
    let top;

    if (edge === "top") {
      left = placement.centerX - (drawerWidth / 2);
      top = placement.bottom + gap;
    } else if (edge === "bottom") {
      left = placement.centerX - (drawerWidth / 2);
      top = placement.top - drawerHeight - gap;
    } else if (edge === "left") {
      left = placement.right + gap;
      top = placement.centerY - (drawerHeight / 2);
    } else {
      left = placement.left - drawerWidth - gap;
      top = placement.centerY - (drawerHeight / 2);
    }

    left = clamp(left, margin, viewport.width - drawerWidth - margin);
    top = clamp(top, margin, viewport.height - drawerHeight - margin);

    drawer.style.setProperty("--sac-reference-left", `${Math.round(left)}px`);
    drawer.style.setProperty("--sac-reference-top", `${Math.round(top)}px`);
    try { drawer.dataset.positioned = "true"; } catch (_) {}
  }

  updateLayoutUnitCount() {
    if (!this.toolsEl) {
      this._lastToolCount = 0;
      return 0;
    }

    const toolButtons = this.toolsEl.querySelectorAll?.(".sac-tool")?.length ?? 0;
    const sourceTiles = this.toolsEl.querySelectorAll?.(".sac-tool-source")?.length ?? 0;
    const dividers = this.toolsEl.querySelectorAll?.(".sac-tool-divider")?.length ?? 0;
    const nextCount = Math.max(1, toolButtons + sourceTiles + (dividers * 0.5));
    this._lastToolCount = nextCount;
    return nextCount;
  }

  getToolButton(toolId) {
    if (!this.toolsEl || !toolId) return null;
    try {
      return this.toolsEl.querySelector(`.sac-tool[data-tool-id="${CSS.escape(toolId)}"]`);
    } catch (_) {
      return Array.from(this.toolsEl.querySelectorAll(".sac-tool"))
        .find((button) => button.dataset.toolId === toolId) ?? null;
    }
  }

  isToolActive(toolId) {
    const button = this.getToolButton(toolId);
    return button?.dataset.active === "true";
  }

  setToolActive(toolId, active = true, { pulse = false } = {}) {
    const button = this.getToolButton(toolId);
    if (!button) return false;
    const next = Boolean(active);
    button.dataset.active = next ? "true" : "false";
    button.classList.toggle("sac-tool-active", next);
    button.setAttribute("aria-pressed", next ? "true" : "false");

    if (toolId === "x-card" && this.openIntent === "notification") {
      if (next && this._notificationTimerShouldRespectActiveXCard()) this._clearNotificationAutoCloseTimer();
      else if (!next) this._refreshNotificationAutoCloseTimer();
    }

    const group = button.closest?.(".sac-tool-group");
    if (group) group.dataset.active = next ? "true" : "false";

    if (pulse) {
      button.classList.remove("sac-tool-pulse");
      group?.classList?.remove?.("sac-tool-group-pulse");
      try { void button.offsetWidth; } catch (_) {}
      button.classList.add("sac-tool-pulse");
      group?.classList?.add?.("sac-tool-group-pulse");
      window.setTimeout(() => {
        try { button.classList.remove("sac-tool-pulse"); } catch (_) {}
        try { group?.classList?.remove?.("sac-tool-group-pulse"); } catch (_) {}
      }, 520);
    }

    return true;
  }

  clearToolActive(toolId) {
    return this.setToolActive(toolId, false);
  }

  setToolSources(toolId, sources = []) {
    return renderToolSources(this, toolId, sources);
  }

  applyInitialState(value) {
    this._setOpen(value !== "closed", {
      animate: true,
      intent: value !== "closed" ? "manual" : "closed"
    });
  }

  open() {
    this._setOpen(true, { animate: true, intent: "manual" });
  }

  openNotification(options = {}) {
    const sound = options?.sound ?? "chime";
    const shouldPlayChime = sound === "chime" && !this.isOpen && this._motion !== "closing";

    if (this.isOpen) {
      this._refreshNotificationAutoCloseTimer();
      return;
    }

    this._setOpen(true, { animate: true, intent: "notification" });
    this._refreshNotificationAutoCloseTimer();

    if (shouldPlayChime) void playNotificationChime();
  }

  close() {
    this._setOpen(false, { animate: true, intent: "closed" });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  _setOpen(nextOpen, { animate = true, intent = null } = {}) {
    const open = Boolean(nextOpen);
    const changed = this.isOpen !== open;
    this.isOpen = open;
    this.openIntent = open ? (intent || this.openIntent || "manual") : "closed";

    if (!this.isOpen) {
      const hadReferenceOpen = this.referenceOpen;
      this.referenceOpen = false;
      if (hadReferenceOpen) this._scheduleReferencePlacementClear();
      else this._clearReferencePlacement();
      this._clearNotificationAutoCloseTimer();
    } else if (this.openIntent !== "notification") {
      this._clearNotificationAutoCloseTimer();
    }

    if (animate && (changed || this._motion !== "idle")) {
      this._motion = this.isOpen ? "opening" : "closing";
    } else {
      this._motion = "idle";
    }
    this.sync({ preferPredictedSize: true });
    this._scheduleMotionIdle();
  }

  sync({ recenterIfUnset = false, preferPredictedSize = false } = {}) {
    if (!this.shellEl || !this.capsuleEl) return;

    this.edge = normalizeEdge(this.edge);
    const canonicalThickness = this._liveThickness ?? this._canonicalThickness ?? getPersonalEdgeThickness(this.edge);
    this._canonicalThickness = canonicalThickness;
    const metrics = this._layoutMetrics(this.edge, canonicalThickness);

    this.shellEl.dataset.edge = this.edge;
    this.shellEl.dataset.open = this.isOpen ? "true" : "false";
    this.shellEl.dataset.openIntent = this.openIntent || (this.isOpen ? "manual" : "closed");
    this.shellEl.dataset.motion = this._motion || "idle";

    const handle = this._handleVisualSize();
    const desiredOffset = this.offset;
    const capsuleOffset = this._capsuleOffsetFromHandleOffset(this.edge, desiredOffset, {
      handle,
      metrics,
      preferPredictedSize: true
    });
    const handlePos = this._handlePosition(this.edge, capsuleOffset, metrics.thickness, handle);

    // Preserve the user-authored desired offset. The resolved offset may push back
    // temporarily when expanded content would overflow, but it is not the source of truth.
    this._resolvedOffset = capsuleOffset;
    const desiredCssOffset = Number.isFinite(Number(desiredOffset)) ? Number(desiredOffset) : capsuleOffset;

    this.shellEl.classList.toggle(OPEN_CLASS, this.isOpen);
    this.shellEl.classList.toggle(CLOSED_CLASS, !this.isOpen);
    this.shellEl.style.setProperty("--sac-thickness", `${Math.round(metrics.thickness)}px`);
    this.shellEl.style.setProperty("--sac-button-size", `${Math.round(metrics.buttonSize)}px`);
    this.shellEl.style.setProperty("--sac-gap", `${Math.round(metrics.gap)}px`);
    this.shellEl.style.setProperty("--sac-padding", `${Math.round(metrics.padding / 2)}px`);
    this.shellEl.style.setProperty("--sac-fit-scale", String(metrics.scale));
    this.shellEl.style.setProperty("--sac-offset", `${Math.round(desiredCssOffset)}px`);
    this.shellEl.style.setProperty("--sac-capsule-offset", `${Math.round(capsuleOffset)}px`);
    this.shellEl.style.setProperty("--sac-capsule-primary-size", `${Math.round(metrics.primarySize)}px`);
    this.shellEl.style.setProperty("--sac-handle-offset", `${Math.round(capsuleOffset)}px`);
    this.shellEl.style.setProperty("--sac-handle-x", `${Math.round(handlePos.x)}px`);
    this.shellEl.style.setProperty("--sac-handle-y", `${Math.round(handlePos.y)}px`);

    this._syncHandleIcon();
    this._syncToolSizing();
    this._renderReferenceDrawer();
    this._updateReferencePlacement();
  }

  async setDock(edge, offset, { persist = true } = {}) {
    if (this.referenceOpen) this.closeReferenceDrawer();
    const nextEdge = normalizeEdge(edge);
    const handle = this._handleVisualSize();
    const metrics = this._layoutMetrics(nextEdge, this._canonicalThickness ?? getPersonalEdgeThickness(nextEdge));
    const nextOffset = this._clampedHandleOffset(offset, {
      edge: nextEdge,
      recenterIfUnset: true,
      handle,
      metrics
    });

    this._beginDockCommit();
    this.edge = nextEdge;
    this.offset = nextOffset;
    this._liveThickness = null;
    this.sync({ preferPredictedSize: true });
    await this._waitFrames(2);
    this._endDockCommit();

    if (persist) await setPersonalDock({ edge: this.edge, offset: this.offset });
  }

  _seedInitialPlacement() {
    if (getPersonalPlacementInitialized()) return;

    const hasSavedOffset = Number.isFinite(Number(this.offset));
    if (hasSavedOffset) {
      void setPersonalPlacementInitialized(true);
      return;
    }

    const edge = "top";
    const canonicalThickness = getPersonalEdgeThickness(edge);
    const handle = this._handleVisualSize();
    const metrics = this._layoutMetrics(edge, canonicalThickness);

    this.edge = edge;
    this._canonicalThickness = canonicalThickness;
    this._liveThickness = null;
    this.offset = this._capsuleOffsetForCenteredHandle(edge, { handle, metrics });

    void setPersonalDock({ edge: this.edge, offset: this.offset });
    void setPersonalPlacementInitialized(true);
  }

  _notificationTimerShouldRespectActiveXCard() {
    return notificationTimerKeepOpenForXCard() && this.isToolActive("x-card");
  }

  _refreshNotificationAutoCloseTimer() {
    if (!this.isOpen || this.openIntent !== "notification") return;
    this._scheduleNotificationAutoClose();
  }

  _clearNotificationAutoCloseTimer() {
    if (!this._notificationAutoCloseTimer) return;
    try { window.clearTimeout(this._notificationAutoCloseTimer); } catch (_) {}
    this._notificationAutoCloseTimer = null;
  }

  _scheduleNotificationAutoClose() {
    this._clearNotificationAutoCloseTimer();
    if (!this.isOpen || this.openIntent !== "notification") return;

    const mode = getNotificationTimerMode();
    if (mode === "none") return;
    if (this._notificationTimerShouldRespectActiveXCard()) return;

    const seconds = getNotificationTimerSeconds(mode);
    if (!Number.isFinite(seconds) || seconds <= 0) return;

    this._notificationAutoCloseTimer = window.setTimeout(() => {
      this._notificationAutoCloseTimer = null;
      if (this.openIntent !== "notification") return;
      if (this._notificationTimerShouldRespectActiveXCard()) return;
      this._setOpen(false, { animate: true, intent: "closed" });
    }, Math.max(1, seconds) * 1000);
  }

  _promoteNotificationOpenToManual() {
    if (!this.isOpen || this.openIntent !== "notification") return;
    this.openIntent = "manual";
    this._clearNotificationAutoCloseTimer();
    if (this.shellEl) this.shellEl.dataset.openIntent = "manual";
  }

  _bindManualPromotion() {
    if (!this.shellEl) return;
    const promote = (event) => {
      if (!this.isOpen || this.openIntent !== "notification") return;
      const target = event?.target;
      if (!(target instanceof Element)) return;
      if (!target.closest?.(".sac-capsule, .sac-reference-toggle, .sac-reference-drawer, .sac-handle")) return;
      this._promoteNotificationOpenToManual();
    };
    this.shellEl.addEventListener("pointerdown", promote, { capture: true });
    this.shellEl.addEventListener("keydown", promote, { capture: true });
  }

  _renderTools() { return renderTools(this); }
  _bindHandle() { return bindHandleDrag(this); }
  _bindReferenceToggle() {
    if (!this.referenceToggleEl) return;
    this.referenceToggleEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleReferenceDrawer();
    });
  }
  _bindResize() { return bindEdgeResize(this); }
  _bindWindowResize() { return bindWindowResize(this); }
  _syncHandleIcon() { return syncHandleIcon(this); }
  _syncToolSizing() { return syncToolSizing(this); }
  _renderReferenceDrawer() { return renderSafetyReferenceDrawer(this); }

  _clearMotionTimer() { return clearMotionTimer(this); }
  _scheduleMotionIdle() { return scheduleMotionIdle(this); }
  _beginDockCommit() { return beginDockCommit(this); }
  _endDockCommit() { return endDockCommit(this); }
  _clearInitialPaintLock() { return clearInitialPaintLock(this); }
  _waitFrames(count = 1) { return waitFrames(count); }

  _renderedThickness() { return renderedThickness(this); }
  _buttonSizeForThickness(thickness) { return buttonSizeForThickness(thickness); }
  _handleVisualSize() { return handleVisualSize(this); }
  _clampedHandleOffset(value, options = {}) { return clampedHandleOffset(this, value, options); }
  _capsuleOffsetForCenteredHandle(edge = "top", options = {}) {
    return capsuleOffsetForCenteredHandle(this, edge, options);
  }
  _capsuleOffsetFromHandleOffset(edge = this.edge, handleOffset = this.offset, options = {}) {
    return capsuleOffsetFromHandleOffset(this, edge, handleOffset, options);
  }
  _layoutMetrics(edge = this.edge, canonicalThickness = this._canonicalThickness ?? getPersonalEdgeThickness(this.edge)) {
    return layoutMetrics(this, edge, canonicalThickness);
  }
  _capsulePrimarySize(edge = this.edge, options = {}) { return capsulePrimarySize(this, edge, options); }
  _handlePosition(edge = this.edge, offset = this.offset, thickness = getPersonalEdgeThickness(edge), handle = this._handleVisualSize()) {
    return handlePosition(this, edge, offset, thickness, handle);
  }
}
