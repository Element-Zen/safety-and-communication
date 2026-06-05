import { currentParticipantSource } from "../identity/source-resolver.js";
import { getToolbarToolById } from "../tools/registry.js";
import {
  SAFETY_SOCKET_CHANNEL,
  SAFETY_SOURCE_CONTEXT_EVENT,
  SAFETY_TOOL_CLICK_EVENT,
  SAFETY_TOOL_CONTEXT_EVENT,
  SAFETY_TOOLS_RENDERED_EVENT
} from "../safety/safety-events.js";
import {
  clearHandSource,
  clearHandTool,
  reapplyActiveHandQueues,
  toggleHandSignal
} from "./hand-state.js";
import { clearPresenceSourceEverywhere } from "../presence/presence-state.js";
import { scheduleRuntimeStateCommit } from "../state/runtime-state.js";

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

function buildHandSignal(tool) {
  return {
    type: "hand-toggle",
    version: 1,
    id: makePayloadId(),
    toolId: tool.id,
    queue: tool.queue ?? tool.variation ?? null,
    source: currentParticipantSource(),
    sender: senderInfo(),
    createdAt: Date.now()
  };
}

function buildClearToolPayload(toolId) {
  return {
    type: "hand-clear-tool",
    version: 1,
    id: makePayloadId(),
    toolId: String(toolId || ""),
    sender: senderInfo(),
    createdAt: Date.now()
  };
}

function buildClearSourcePayload(toolId, sourceKey) {
  return {
    type: "hand-clear-source",
    version: 1,
    id: makePayloadId(),
    toolId: String(toolId || ""),
    sourceKey: String(sourceKey || ""),
    sender: senderInfo(),
    createdAt: Date.now()
  };
}

function isHandTool(tool) {
  return tool?.kind === "hand" && typeof tool.id === "string";
}

function isHandToggle(payload) {
  return payload?.type === "hand-toggle" && typeof payload.toolId === "string" && typeof payload.id === "string";
}

function isClearTool(payload) {
  return payload?.type === "hand-clear-tool" && typeof payload.toolId === "string" && typeof payload.id === "string";
}

function isClearSource(payload) {
  return payload?.type === "hand-clear-source" && typeof payload.toolId === "string" && typeof payload.sourceKey === "string" && typeof payload.id === "string";
}

function receiveHandPayload(shell, payload) {
  if (!payload?.id || !rememberPayload(payload.id)) return;

  let changed = false;

  if (isHandToggle(payload)) {
    const sourceKey = payload?.source?.key ?? payload?.source?.userId ?? null;
    if (sourceKey) changed = clearPresenceSourceEverywhere(shell, sourceKey) || changed;
    changed = toggleHandSignal(shell, payload) || changed;
  } else if (isClearTool(payload)) {
    if (!senderIsGM(payload)) return;
    changed = clearHandTool(shell, payload.toolId);
  } else if (isClearSource(payload)) {
    if (!senderCanClearSource(payload)) return;
    changed = clearHandSource(shell, payload.toolId, payload.sourceKey);
  }

  if (changed) scheduleRuntimeStateCommit(shell);
}

async function broadcastPayload(payload) {
  try {
    game.socket?.emit?.(SAFETY_SOCKET_CHANNEL, payload);
  } catch (error) {
    console.warn("Safety and Communication | Failed to broadcast hand-raise payload", error);
  }
}

async function emitHandSignal(shell, tool) {
  const resolvedTool = getToolbarToolById(tool?.id) ?? tool;
  if (!isHandTool(resolvedTool)) return;

  const signal = buildHandSignal(resolvedTool);
  receiveHandPayload(shell, signal);
  await broadcastPayload(signal);
}

async function emitClearHandTool(shell, toolId) {
  if (!game?.user?.isGM) {
    ui.notifications?.warn?.("Only the GM can clear a hand-raise queue.");
    return;
  }
  const payload = buildClearToolPayload(toolId);
  if (!payload.toolId) return;
  receiveHandPayload(shell, payload);
  await broadcastPayload(payload);
}

async function emitClearHandSource(shell, toolId, sourceKey) {
  const normalizedKey = String(sourceKey || "");
  const userId = String(game?.user?.id || "");
  if (!game?.user?.isGM && (!userId || userId !== normalizedKey)) {
    ui.notifications?.warn?.("Only the GM can clear another participant's raised hand.");
    return;
  }
  const payload = buildClearSourcePayload(toolId, sourceKey);
  if (!payload.toolId || !payload.sourceKey) return;
  receiveHandPayload(shell, payload);
  await broadcastPayload(payload);
}

export function initializeHandEvents(shell) {
  if (!shell?.shellEl) return;

  shell.shellEl.addEventListener(SAFETY_TOOL_CLICK_EVENT, (event) => {
    const tool = event?.detail?.tool;
    if (!isHandTool(tool)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    emitHandSignal(shell, tool);
  });

  shell.shellEl.addEventListener(SAFETY_TOOL_CONTEXT_EVENT, (event) => {
    const toolId = event?.detail?.toolId;
    const tool = getToolbarToolById(toolId);
    if (!isHandTool(tool)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    emitClearHandTool(shell, toolId);
  });

  shell.shellEl.addEventListener(SAFETY_SOURCE_CONTEXT_EVENT, (event) => {
    const toolId = event?.detail?.toolId;
    const sourceKey = event?.detail?.sourceKey;
    const tool = getToolbarToolById(toolId);
    if (!isHandTool(tool) || !sourceKey) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    emitClearHandSource(shell, toolId, sourceKey);
  });

  shell.shellEl.addEventListener(SAFETY_TOOLS_RENDERED_EVENT, () => {
    reapplyActiveHandQueues(shell);
  });

  try {
    game.socket?.on?.(SAFETY_SOCKET_CHANNEL, (payload) => {
      receiveHandPayload(shell, payload);
    });
  } catch (error) {
    console.warn("Safety and Communication | Failed to register hand-raise socket listener", error);
  }
}
