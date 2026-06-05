import { normalizeParticipantSource } from "../identity/source-resolver.js";
import { getToolbarTools } from "../tools/registry.js";

const handQueues = new Map();
const sourceToolIndex = new Map();

function handToolIds() {
  return getToolbarTools()
    .filter((tool) => tool?.kind === "hand" && tool?.id)
    .map((tool) => tool.id);
}

function normalizeToolId(toolId) {
  return String(toolId || "").trim();
}

function normalizeSourceKey(sourceKey) {
  return String(sourceKey || "").trim();
}

function queueFor(toolId) {
  const normalized = normalizeToolId(toolId);
  if (!normalized) return null;
  let queue = handQueues.get(normalized);
  if (!queue) {
    queue = [];
    handQueues.set(normalized, queue);
  }
  return queue;
}

function removeSourceFromTool(toolId, sourceKey) {
  const normalizedTool = normalizeToolId(toolId);
  const normalizedKey = normalizeSourceKey(sourceKey);
  if (!normalizedTool || !normalizedKey) return false;

  const queue = handQueues.get(normalizedTool);
  if (!queue?.length) return false;

  const nextQueue = queue.filter((source) => source.key !== normalizedKey);
  if (nextQueue.length === queue.length) return false;

  if (nextQueue.length) handQueues.set(normalizedTool, nextQueue);
  else handQueues.delete(normalizedTool);

  if (sourceToolIndex.get(normalizedKey) === normalizedTool) {
    sourceToolIndex.delete(normalizedKey);
  }

  return true;
}

function removeSourceEverywhere(sourceKey) {
  const normalizedKey = normalizeSourceKey(sourceKey);
  if (!normalizedKey) return false;

  const indexedTool = sourceToolIndex.get(normalizedKey);
  let removed = false;
  if (indexedTool) removed = removeSourceFromTool(indexedTool, normalizedKey) || removed;

  for (const toolId of Array.from(handQueues.keys())) {
    removed = removeSourceFromTool(toolId, normalizedKey) || removed;
  }

  sourceToolIndex.delete(normalizedKey);
  return removed;
}

function applyToolToShell(shell, toolId, { pulse = false } = {}) {
  const normalizedTool = normalizeToolId(toolId);
  if (!shell || !normalizedTool) return false;

  const sources = handQueues.get(normalizedTool) ?? [];
  const active = sources.length > 0;
  const applied = shell.setToolActive?.(normalizedTool, active, { pulse: active && pulse });
  shell.setToolSources?.(normalizedTool, sources);
  return Boolean(applied);
}

function pruneHiddenHandQueues() {
  const visibleIds = new Set(handToolIds());
  let changed = false;

  for (const toolId of Array.from(handQueues.keys())) {
    if (visibleIds.has(toolId)) continue;
    const queue = handQueues.get(toolId) ?? [];
    for (const source of queue) {
      if (source?.key && sourceToolIndex.get(source.key) === toolId) {
        sourceToolIndex.delete(source.key);
      }
    }
    handQueues.delete(toolId);
    changed = true;
  }

  return changed;
}

function applyAllToShell(shell, { pulseToolId = null } = {}) {
  if (!shell) return;

  pruneHiddenHandQueues();
  const ids = new Set([...handToolIds(), ...handQueues.keys()]);
  for (const toolId of ids) {
    applyToolToShell(shell, toolId, { pulse: toolId === pulseToolId });
  }
}

export function toggleHandSignal(shell, signal) {
  if (!shell || !signal?.toolId || !signal?.source) return false;

  const toolId = normalizeToolId(signal.toolId);
  const source = normalizeParticipantSource(signal.source);
  if (!toolId || !source.key) return false;
  if (!handToolIds().includes(toolId)) return false;

  const currentToolId = sourceToolIndex.get(source.key) ?? null;
  const sameTool = currentToolId === toolId;

  if (sameTool) {
    removeSourceFromTool(toolId, source.key);
    applyToolToShell(shell, toolId, { pulse: false });
    return true;
  }

  removeSourceEverywhere(source.key);

  const queue = queueFor(toolId);
  if (!queue) return false;
  queue.push(source);
  sourceToolIndex.set(source.key, toolId);

  applyAllToShell(shell, { pulseToolId: toolId });
  shell.openNotification?.();
  return true;
}

export function clearHandTool(shell, toolId) {
  const normalizedTool = normalizeToolId(toolId);
  if (!normalizedTool) return false;

  const queue = handQueues.get(normalizedTool) ?? [];
  for (const source of queue) {
    if (source?.key && sourceToolIndex.get(source.key) === normalizedTool) {
      sourceToolIndex.delete(source.key);
    }
  }

  handQueues.delete(normalizedTool);
  shell?.clearToolActive?.(normalizedTool);
  shell?.setToolSources?.(normalizedTool, []);
  return true;
}

export function clearHandSource(shell, toolId, sourceKey) {
  const normalizedTool = normalizeToolId(toolId);
  const normalizedKey = normalizeSourceKey(sourceKey);
  if (!normalizedTool || !normalizedKey) return false;

  const removed = removeSourceFromTool(normalizedTool, normalizedKey);
  if (!removed) return false;

  applyToolToShell(shell, normalizedTool, { pulse: false });
  return true;
}

export function clearHandSourceEverywhere(shell, sourceKey) {
  const removed = removeSourceEverywhere(sourceKey);
  if (removed) applyAllToShell(shell, { pulseToolId: null });
  return removed;
}

export function reapplyActiveHandQueues(shell) {
  applyAllToShell(shell, { pulseToolId: null });
}

export function getActiveHandQueue(toolId) {
  const normalizedTool = normalizeToolId(toolId);
  const queue = handQueues.get(normalizedTool) ?? [];
  return queue.map((source) => ({ ...source }));
}

export function getAllActiveHandQueues() {
  return Array.from(handQueues.entries())
    .filter(([, sources]) => Array.isArray(sources) && sources.length > 0)
    .map(([toolId, sources]) => ({
      toolId,
      sources: sources.map((source) => ({ ...source }))
    }));
}

export function replaceActiveHandQueues(queues = []) {
  handQueues.clear();
  sourceToolIndex.clear();

  for (const raw of Array.isArray(queues) ? queues : []) {
    const toolId = normalizeToolId(raw?.toolId);
    if (!toolId) continue;

    const sources = [];
    const seen = new Set();
    for (const rawSource of Array.isArray(raw?.sources) ? raw.sources : []) {
      const source = normalizeParticipantSource(rawSource);
      if (!source?.key || seen.has(source.key)) continue;
      seen.add(source.key);
      sources.push(source);
      sourceToolIndex.set(source.key, toolId);
    }

    if (sources.length) handQueues.set(toolId, sources);
  }
}
