import { MODULE_ID, SETTINGS } from "../settings.js";
import {
  getAllActiveSafetyToolStates,
  replaceActiveSafetyToolStates,
  reapplyActiveSafetySignals
} from "../safety/safety-state.js";
import {
  getAllActiveHandQueues,
  replaceActiveHandQueues,
  reapplyActiveHandQueues
} from "../hands/hand-state.js";
import {
  getAllActivePresenceLists,
  replaceActivePresenceLists,
  reapplyActivePresence
} from "../presence/presence-state.js";

export const RUNTIME_STATE_VERSION = 1;
export const RUNTIME_STATE_REQUEST = "sac:state-request";
export const RUNTIME_STATE_SNAPSHOT = "sac:state-snapshot";

let activeShell = null;
let commitTimer = null;
let lastAppliedUpdatedAt = 0;
let lastBroadcastSnapshotId = null;

function makePayloadId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch (_) {}
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function senderInfo() {
  const user = game?.user;
  return {
    userId: user?.id ?? null,
    isGM: Boolean(user?.isGM)
  };
}

function clonePlain(value, fallback) {
  try {
    if (globalThis.structuredClone) return globalThis.structuredClone(value ?? fallback);
  } catch (_) {}

  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch (_) {
    return fallback;
  }
}

function defaultSnapshot(updatedAt = 0) {
  return {
    version: RUNTIME_STATE_VERSION,
    updatedAt,
    safety: [],
    hands: [],
    presence: []
  };
}

function normalizeSource(raw) {
  if (!raw || typeof raw !== "object") return null;
  const key = String(raw.key ?? raw.userId ?? "").trim();
  if (!key) return null;
  return {
    key,
    userId: raw.userId ? String(raw.userId) : key,
    name: String(raw.name || "Participant"),
    initials: String(raw.initials || "?").slice(0, 3),
    image: raw.image ? String(raw.image) : null
  };
}

function normalizeSourceList(rawSources) {
  const seen = new Set();
  const sources = [];
  for (const raw of Array.isArray(rawSources) ? rawSources : []) {
    const source = normalizeSource(raw);
    if (!source || seen.has(source.key)) continue;
    seen.add(source.key);
    sources.push(source);
  }
  return sources;
}

function normalizeSafetyState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const toolId = String(raw.toolId || "").trim();
  if (!toolId) return null;
  const sources = normalizeSourceList(raw.sources);
  const anonymousActive = Boolean(raw.anonymousActive);
  if (!anonymousActive && !sources.length) return null;
  return {
    toolId,
    anonymousActive,
    anonymousSignalId: raw.anonymousSignalId ? String(raw.anonymousSignalId) : null,
    sources
  };
}

function normalizeQueuedState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const toolId = String(raw.toolId || "").trim();
  if (!toolId) return null;
  const sources = normalizeSourceList(raw.sources);
  if (!sources.length) return null;
  return { toolId, sources };
}

export function normalizeRuntimeStateSnapshot(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const updatedAt = Number(source.updatedAt) || 0;
  return {
    version: RUNTIME_STATE_VERSION,
    updatedAt,
    safety: (Array.isArray(source.safety) ? source.safety : [])
      .map(normalizeSafetyState)
      .filter(Boolean),
    hands: (Array.isArray(source.hands) ? source.hands : [])
      .map(normalizeQueuedState)
      .filter(Boolean),
    presence: (Array.isArray(source.presence) ? source.presence : [])
      .map(normalizeQueuedState)
      .filter(Boolean)
  };
}

export function runtimeStateHasActiveEntries(snapshot) {
  const state = normalizeRuntimeStateSnapshot(snapshot);
  return Boolean(state.safety.length || state.hands.length || state.presence.length);
}

export function buildRuntimeStateSnapshot({ updatedAt = Date.now() } = {}) {
  return normalizeRuntimeStateSnapshot({
    version: RUNTIME_STATE_VERSION,
    updatedAt,
    safety: getAllActiveSafetyToolStates(),
    hands: getAllActiveHandQueues(),
    presence: getAllActivePresenceLists()
  });
}

function readPersistedRuntimeState() {
  try {
    return normalizeRuntimeStateSnapshot(game.settings.get(MODULE_ID, SETTINGS.runtimeState));
  } catch (_) {
    return defaultSnapshot(0);
  }
}

function reapplyAll(shell) {
  if (!shell) return;
  reapplyActiveSafetySignals(shell);
  reapplyActiveHandQueues(shell);
  reapplyActivePresence(shell);
}

export function applyRuntimeStateSnapshot(shell, snapshot, { openIfActive = false, force = false } = {}) {
  const state = normalizeRuntimeStateSnapshot(snapshot);
  if (!force && state.updatedAt && state.updatedAt < lastAppliedUpdatedAt) return false;

  replaceActiveSafetyToolStates(state.safety);
  replaceActiveHandQueues(state.hands);
  replaceActivePresenceLists(state.presence);
  lastAppliedUpdatedAt = Math.max(lastAppliedUpdatedAt, state.updatedAt || 0);

  reapplyAll(shell);
  if (openIfActive && runtimeStateHasActiveEntries(state)) shell?.openNotification?.({ sound: false });
  return true;
}

async function persistSnapshot(snapshot) {
  if (!game?.user?.isGM) return false;
  const state = normalizeRuntimeStateSnapshot(snapshot);
  try {
    await game.settings.set(MODULE_ID, SETTINGS.runtimeState, clonePlain(state, defaultSnapshot(state.updatedAt)));
    return true;
  } catch (error) {
    console.warn("Safety and Communication | Failed to persist runtime state snapshot", error);
    return false;
  }
}

function broadcastSnapshot(snapshot, { recipientUserId = null } = {}) {
  const payload = {
    type: RUNTIME_STATE_SNAPSHOT,
    id: makePayloadId(),
    version: RUNTIME_STATE_VERSION,
    recipientUserId: recipientUserId ? String(recipientUserId) : null,
    snapshot: normalizeRuntimeStateSnapshot(snapshot),
    sender: senderInfo(),
    createdAt: Date.now()
  };
  lastBroadcastSnapshotId = payload.id;
  try {
    game.socket?.emit?.(`module.${MODULE_ID}`, payload);
  } catch (error) {
    console.warn("Safety and Communication | Failed to broadcast runtime state snapshot", error);
  }
}

async function commitRuntimeState(shell, { broadcast = true } = {}) {
  if (!game?.user?.isGM) return false;
  const snapshot = buildRuntimeStateSnapshot({ updatedAt: Date.now() });
  lastAppliedUpdatedAt = Math.max(lastAppliedUpdatedAt, snapshot.updatedAt || 0);
  const persisted = await persistSnapshot(snapshot);
  if (persisted && broadcast) broadcastSnapshot(snapshot);
  return persisted;
}

export function scheduleRuntimeStateCommit(shell = activeShell, { broadcast = true } = {}) {
  if (!game?.user?.isGM) return;
  activeShell = shell ?? activeShell;
  if (commitTimer) window.clearTimeout(commitTimer);
  commitTimer = window.setTimeout(() => {
    commitTimer = null;
    commitRuntimeState(activeShell, { broadcast });
  }, 30);
}

function receiveRuntimePayload(shell, payload) {
  if (!payload || typeof payload !== "object") return;

  if (payload.type === RUNTIME_STATE_REQUEST) {
    if (!game?.user?.isGM) return;
    const requester = payload?.sender?.userId;
    if (!requester) return;
    const snapshot = buildRuntimeStateSnapshot({ updatedAt: Math.max(Date.now(), lastAppliedUpdatedAt || 0) });
    broadcastSnapshot(snapshot, { recipientUserId: requester });
    return;
  }

  if (payload.type === RUNTIME_STATE_SNAPSHOT) {
    if (payload.id && payload.id === lastBroadcastSnapshotId) return;
    const recipient = payload.recipientUserId ? String(payload.recipientUserId) : null;
    const currentUserId = String(game?.user?.id || "");
    if (recipient && recipient !== currentUserId) return;
    applyRuntimeStateSnapshot(shell, payload.snapshot, { openIfActive: true });
  }
}

function requestRuntimeStateSnapshot() {
  if (game?.user?.isGM) return;
  const payload = {
    type: RUNTIME_STATE_REQUEST,
    id: makePayloadId(),
    version: RUNTIME_STATE_VERSION,
    sender: senderInfo(),
    createdAt: Date.now()
  };
  try {
    game.socket?.emit?.(`module.${MODULE_ID}`, payload);
  } catch (error) {
    console.warn("Safety and Communication | Failed to request runtime state snapshot", error);
  }
}

export function initializeRuntimeStateHydration(shell) {
  activeShell = shell;

  const persisted = readPersistedRuntimeState();
  applyRuntimeStateSnapshot(shell, persisted, { openIfActive: true, force: true });

  try {
    game.socket?.on?.(`module.${MODULE_ID}`, (payload) => {
      receiveRuntimePayload(shell, payload);
    });
  } catch (error) {
    console.warn("Safety and Communication | Failed to register runtime state socket listener", error);
  }

  // A persisted world setting handles reloads. This request catches an already-open GM
  // whose local state is newer than the last written setting.
  window.setTimeout(() => requestRuntimeStateSnapshot(), 100);
}
