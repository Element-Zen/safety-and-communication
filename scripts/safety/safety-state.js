import { normalizeParticipantSource } from "../identity/source-resolver.js";
import { getToolbarTools } from "../tools/registry.js";

const activeToolStates = new Map();

function safetyToolIds() {
  return getToolbarTools()
    .filter((tool) => tool?.kind === "safety" && tool?.id)
    .map((tool) => tool.id);
}

function stateFor(toolId) {
  const normalized = String(toolId || "");
  if (!normalized) return null;
  let state = activeToolStates.get(normalized);
  if (!state) {
    state = {
      toolId: normalized,
      anonymousActive: false,
      anonymousSignalId: null,
      sources: new Map()
    };
    activeToolStates.set(normalized, state);
  }
  return state;
}

function isStateActive(state) {
  return Boolean(state?.anonymousActive || state?.sources?.size);
}

function sourceKey(source) {
  const normalized = normalizeParticipantSource(source);
  return normalized.key;
}

export function canActivateSafetySignal(signal) {
  if (!signal?.toolId) return false;
  const state = activeToolStates.get(String(signal.toolId));
  if (signal.anonymous !== false) return !state?.anonymousActive;
  const key = sourceKey(signal.source);
  return !state?.sources?.has(key);
}

export function safetyToolIsActive(toolId) {
  const state = activeToolStates.get(String(toolId || ""));
  return isStateActive(state);
}

function applyStateToShell(shell, state, { pulse = false } = {}) {
  if (!shell || !state?.toolId) return false;
  const active = isStateActive(state);
  const applied = shell.setToolActive(state.toolId, active, { pulse: active && pulse });
  shell.setToolSources?.(state.toolId, Array.from(state.sources.values()));
  if (!active) activeToolStates.delete(state.toolId);
  return applied;
}

export function activateSafetySignal(shell, signal) {
  if (!shell || !signal?.toolId) return false;
  if (!canActivateSafetySignal(signal)) return false;

  const state = stateFor(signal.toolId);
  if (!state) return false;

  if (signal.anonymous !== false) {
    state.anonymousActive = true;
    state.anonymousSignalId = signal.id ?? null;
  } else {
    const source = normalizeParticipantSource(signal.source);
    state.sources.set(source.key, source);
  }

  return applyStateToShell(shell, state, { pulse: true });
}

export function clearSafetyTool(shell, toolId) {
  if (!toolId) return false;
  const normalized = String(toolId);
  activeToolStates.delete(normalized);
  shell?.clearToolActive?.(normalized);
  shell?.setToolSources?.(normalized, []);
  return true;
}

export function clearSafetySource(shell, toolId, key) {
  if (!toolId || !key) return false;
  const normalizedTool = String(toolId);
  const normalizedKey = String(key);
  const state = activeToolStates.get(normalizedTool);
  if (!state) return false;

  const removed = state.sources.delete(normalizedKey);
  if (!removed) return false;

  applyStateToShell(shell, state, { pulse: false });
  return true;
}

export function clearAllSafetySignals(shell) {
  for (const toolId of Array.from(activeToolStates.keys())) {
    clearSafetyTool(shell, toolId);
  }
}

export function reapplyActiveSafetySignals(shell) {
  if (!shell) return;
  const ids = new Set([...safetyToolIds(), ...activeToolStates.keys()]);
  for (const toolId of ids) {
    const state = activeToolStates.get(toolId);
    if (state && isStateActive(state)) applyStateToShell(shell, state, { pulse: false });
    else {
      shell.clearToolActive?.(toolId);
      shell.setToolSources?.(toolId, []);
    }
  }
}

export function getActiveSafetyToolState(toolId) {
  const state = activeToolStates.get(String(toolId || ""));
  if (!state) return null;
  return {
    toolId: state.toolId,
    anonymousActive: state.anonymousActive,
    sources: Array.from(state.sources.values())
  };
}

export function getAllActiveSafetyToolStates() {
  return Array.from(activeToolStates.values())
    .filter(isStateActive)
    .map((state) => ({
      toolId: state.toolId,
      anonymousActive: Boolean(state.anonymousActive),
      anonymousSignalId: state.anonymousSignalId ?? null,
      sources: Array.from(state.sources.values()).map((source) => ({ ...source }))
    }));
}

export function replaceActiveSafetyToolStates(states = []) {
  activeToolStates.clear();
  for (const raw of Array.isArray(states) ? states : []) {
    const toolId = String(raw?.toolId || "").trim();
    if (!toolId) continue;

    const next = {
      toolId,
      anonymousActive: Boolean(raw?.anonymousActive),
      anonymousSignalId: raw?.anonymousSignalId ? String(raw.anonymousSignalId) : null,
      sources: new Map()
    };

    for (const rawSource of Array.isArray(raw?.sources) ? raw.sources : []) {
      const source = normalizeParticipantSource(rawSource);
      if (source?.key) next.sources.set(source.key, source);
    }

    if (isStateActive(next)) activeToolStates.set(toolId, next);
  }
}
