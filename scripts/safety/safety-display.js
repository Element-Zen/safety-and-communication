import { playXCardSound } from "../audio/notification-audio.js";
import {
  activateSafetySignal,
  clearSafetySource,
  clearSafetyTool,
  reapplyActiveSafetySignals,
  safetyToolIsActive
} from "./safety-state.js";

export function displaySafetySignal(shell, signal) {
  if (!shell || !signal?.toolId) return false;

  const toolId = String(signal.toolId || "");
  const isXCard = toolId === "x-card";
  const xWasActive = isXCard ? safetyToolIsActive("x-card") : false;

  const changed = activateSafetySignal(shell, signal);
  if (!changed) return false;

  if (isXCard) {
    if (!xWasActive && safetyToolIsActive("x-card")) void playXCardSound();
    shell.openNotification?.({ sound: false });
  } else {
    shell.openNotification?.({ sound: "chime" });
  }

  return true;
}

export function clearDisplayedSafetyTool(shell, toolId) {
  return clearSafetyTool(shell, toolId);
}

export function clearDisplayedSafetySource(shell, toolId, sourceKey) {
  return clearSafetySource(shell, toolId, sourceKey);
}

export function reapplySafetyDisplay(shell) {
  reapplyActiveSafetySignals(shell);
}
