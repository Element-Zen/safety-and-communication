import { MODULE_ID } from "../settings.js";
import { currentParticipantSource } from "../identity/source-resolver.js";
import { getToolbarToolById } from "../tools/registry.js";
import {
  clearDisplayedSafetySource,
  clearDisplayedSafetyTool,
  displaySafetySignal,
  reapplySafetyDisplay
} from "./safety-display.js";
import { canActivateSafetySignal } from "./safety-state.js";
import { scheduleRuntimeStateCommit } from "../state/runtime-state.js";

export const SAFETY_SOCKET_CHANNEL = `module.${MODULE_ID}`;
export const SAFETY_TOOL_CLICK_EVENT = "sac:tool-click";
export const SAFETY_TOOL_CONTEXT_EVENT = "sac:tool-context";
export const SAFETY_SOURCE_CONTEXT_EVENT = "sac:source-context";
export const SAFETY_TOOLS_RENDERED_EVENT = "sac:tools-rendered";

const seenPayloadIds = new Set();
const seenPayloadQueue = [];
const MAX_SEEN_PAYLOADS = 160;

function makePayloadId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch (_) {}
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function rememberPayload(id) {
  if (!id || seenPayloadIds.has(id)) return false;
  seenPayloadIds.add(id);
  seenPayloadQueue.push(id);
  while (seenPayloadQueue.length > MAX_SEEN_PAYLOADS) {
    const old = seenPayloadQueue.shift();
    seenPayloadIds.delete(old);
  }
  return true;
}

function senderInfo() {
  const user = game?.user;
  return {
    userId: user?.id ?? null,
    isGM: Boolean(user?.isGM)
  };
}

function senderIsGM(payload) {
  const senderId = payload?.sender?.userId;
  if (!senderId) return false;
  try {
    return Boolean(game.users?.get?.(senderId)?.isGM);
  } catch (_) {
    return false;
  }
}

function senderCanClearSource(payload) {
  if (senderIsGM(payload)) return true;
  const senderId = String(payload?.sender?.userId || "");
  const sourceKey = String(payload?.sourceKey || "");
  return Boolean(senderId && sourceKey && senderId === sourceKey);
}

function sourceForTool(tool) {
  if (tool?.anonymous !== false) return null;
  return currentParticipantSource();
}

function buildSafetySignal(tool) {
  return {
    type: "safety-signal",
    version: 2,
    id: makePayloadId(),
    toolId: tool.id,
    family: tool.family,
    variation: tool.variation,
    anonymous: tool.anonymous !== false,
    source: sourceForTool(tool),
    sender: senderInfo(),
    createdAt: Date.now()
  };
}

function buildClearToolPayload(toolId) {
  return {
    type: "safety-clear-tool",
    version: 1,
    id: makePayloadId(),
    toolId: String(toolId || ""),
    sender: senderInfo(),
    createdAt: Date.now()
  };
}

function buildClearSourcePayload(toolId, sourceKey) {
  return {
    type: "safety-clear-source",
    version: 1,
    id: makePayloadId(),
    toolId: String(toolId || ""),
    sourceKey: String(sourceKey || ""),
    sender: senderInfo(),
    createdAt: Date.now()
  };
}

function isSafetySignal(payload) {
  return payload?.type === "safety-signal" && typeof payload.toolId === "string" && typeof payload.id === "string";
}

function isClearTool(payload) {
  return payload?.type === "safety-clear-tool" && typeof payload.toolId === "string" && typeof payload.id === "string";
}

function isClearSource(payload) {
  return payload?.type === "safety-clear-source" && typeof payload.toolId === "string" && typeof payload.sourceKey === "string" && typeof payload.id === "string";
}

function isSafetyTool(tool) {
  return tool?.kind === "safety" && typeof tool.id === "string";
}

function receiveSafetyPayload(shell, payload) {
  if (!payload?.id || !rememberPayload(payload.id)) return;

  let changed = false;

  if (isSafetySignal(payload)) {
    changed = displaySafetySignal(shell, payload);
  } else if (isClearTool(payload)) {
    if (!senderIsGM(payload)) return;
    changed = clearDisplayedSafetyTool(shell, payload.toolId);
  } else if (isClearSource(payload)) {
    if (!senderCanClearSource(payload)) return;
    changed = clearDisplayedSafetySource(shell, payload.toolId, payload.sourceKey);
  }

  if (changed) scheduleRuntimeStateCommit(shell);
}

async function broadcastPayload(payload) {
  try {
    game.socket?.emit?.(SAFETY_SOCKET_CHANNEL, payload);
  } catch (error) {
    console.warn("Safety and Communication | Failed to broadcast safety payload", error);
  }
}

async function emitSafetySignal(shell, tool) {
  const resolvedTool = getToolbarToolById(tool?.id) ?? tool;
  if (!isSafetyTool(resolvedTool)) return;

  const signal = buildSafetySignal(resolvedTool);
  if (!canActivateSafetySignal(signal)) {
    return;
  }

  receiveSafetyPayload(shell, signal);
  await broadcastPayload(signal);
}

async function emitClearTool(shell, toolId) {
  if (!game?.user?.isGM) {
    ui.notifications?.warn?.("Only the GM can clear active safety signals.");
    return;
  }
  const payload = buildClearToolPayload(toolId);
  if (!payload.toolId) return;
  receiveSafetyPayload(shell, payload);
  await broadcastPayload(payload);
}

async function emitClearSource(shell, toolId, sourceKey) {
  const normalizedKey = String(sourceKey || "");
  const userId = String(game?.user?.id || "");
  if (!game?.user?.isGM && (!userId || userId !== normalizedKey)) {
    ui.notifications?.warn?.("Only the GM can clear another participant's safety request.");
    return;
  }
  const payload = buildClearSourcePayload(toolId, sourceKey);
  if (!payload.toolId || !payload.sourceKey) return;
  receiveSafetyPayload(shell, payload);
  await broadcastPayload(payload);
}

export function initializeSafetyEvents(shell) {
  if (!shell?.shellEl) return;

  shell.shellEl.addEventListener(SAFETY_TOOL_CLICK_EVENT, (event) => {
    const tool = event?.detail?.tool;
    if (!isSafetyTool(tool)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    emitSafetySignal(shell, tool);
  });

  shell.shellEl.addEventListener(SAFETY_TOOL_CONTEXT_EVENT, (event) => {
    const toolId = event?.detail?.toolId;
    const tool = getToolbarToolById(toolId);
    if (!isSafetyTool(tool)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    emitClearTool(shell, toolId);
  });

  shell.shellEl.addEventListener(SAFETY_SOURCE_CONTEXT_EVENT, (event) => {
    const toolId = event?.detail?.toolId;
    const sourceKey = event?.detail?.sourceKey;
    const tool = getToolbarToolById(toolId);
    if (!isSafetyTool(tool) || !sourceKey) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    emitClearSource(shell, toolId, sourceKey);
  });

  shell.shellEl.addEventListener(SAFETY_TOOLS_RENDERED_EVENT, () => {
    reapplySafetyDisplay(shell);
  });

  try {
    game.socket?.on?.(SAFETY_SOCKET_CHANNEL, (payload) => {
      receiveSafetyPayload(shell, payload);
    });
  } catch (error) {
    console.warn("Safety and Communication | Failed to register safety socket listener", error);
  }
}
