export const OPEN_CLASS = "sac-open";
export const CLOSED_CLASS = "sac-closed";
export const DRAG_CLASS = "sac-dock-dragging";
export const GRAB_CLASS = "sac-chev-grab";
export const HIDE_CURSOR_CLASS = "sac-hide-cursor";
export const RESIZE_CLASS = "sac-resizing";
export const COMMIT_CLASS = "sac-dock-committing";

export const MIN_THICKNESS = 72;
export const MAX_THICKNESS = 140;
export const EDGE_MARGIN = 8;
export const DOCK_SNAP_PX = 52;
export const HANDLE_SIZE = 32;
export const BUTTON_INSET = 20;
export const HANDLE_GAP = 6;
export const CONTROL_BUTTON_GAP = 8;
export const HORIZONTAL_HANDLE_GAP = HANDLE_GAP;
export const VERTICAL_HANDLE_GAP = HANDLE_GAP;

export function handleGapForEdge(edge) {
  return isHorizontalEdge(edge) ? HORIZONTAL_HANDLE_GAP : VERTICAL_HANDLE_GAP;
}

export function isHorizontalEdge(edge) {
  return edge === "top" || edge === "bottom";
}

export function viewportSize() {
  return {
    width: window.innerWidth || document.documentElement?.clientWidth || 1280,
    height: window.innerHeight || document.documentElement?.clientHeight || 720
  };
}
