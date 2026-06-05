import { normalizeParticipantSource } from "../identity/source-resolver.js";
import { getToolbarTools } from "../tools/registry.js";

const presenceLists = new Map();
const sourcePresenceIndex = new Map();

function presenceToolIds() {
  return getToolbarTools()
    .filter((tool) => tool?.kind === "presence" && tool?.id)
    .map((tool) => tool.id);
}

function normalizeToolId(toolId) {
  return String(toolId || "").trim();
}

function normalizeSourceKey(sourceKey) {
  return String(sourceKey || "").trim();
}

function listFor(toolId) {
  const normalized = normalizeToolId(toolId);
  if (!normalized) return null;
  let list = presenceLists.get(normalized);
  if (!list) {
    list = [];
    presenceLists.set(normalized, list);
  }
  return list;
}

function removeSourceFromTool(toolId, sourceKey) {
  const normalizedTool = normalizeToolId(toolId);
  const normalizedKey = normalizeSourceKey(sourceKey);
  if (!normalizedTool || !normalizedKey) return false;

  const list = presenceLists.get(normalizedTool);
  if (!list?.length) return false;

  const nextList = list.filter((source) => source.key !== normalizedKey);
  if (nextList.length === list.length) return false;

  if (nextList.length) presenceLists.set(normalizedTool, nextList);
  else presenceLists.delete(normalizedTool);

  if (sourcePresenceIndex.get(normalizedKey) === normalizedTool) {
    sourcePresenceIndex.delete(normalizedKey);
  }

  return true;
}

function removeSourceEverywhere(sourceKey) {
  const normalizedKey = normalizeSourceKey(sourceKey);
  if (!normalizedKey) return false;

  const indexedTool = sourcePresenceIndex.get(normalizedKey);
  let removed = false;
  if (indexedTool) removed = removeSourceFromTool(indexedTool, normalizedKey) || removed;

  for (const toolId of Array.from(presenceLists.keys())) {
    removed = removeSourceFromTool(toolId, normalizedKey) || removed;
  }

  sourcePresenceIndex.delete(normalizedKey);
  return removed;
}

function applyToolToShell(shell, toolId, { pulse = false } = {}) {
  const normalizedTool = normalizeToolId(toolId);
  if (!shell || !normalizedTool) return false;

  const sources = presenceLists.get(normalizedTool) ?? [];
  const active = sources.length > 0;
  const applied = shell.setToolActive?.(normalizedTool, active, { pulse: active && pulse });
  shell.setToolSources?.(normalizedTool, sources);
  return Boolean(applied);
}

function pruneHiddenPresenceLists() {
  const visibleIds = new Set(presenceToolIds());
  let changed = false;

  for (const toolId of Array.from(presenceLists.keys())) {
    if (visibleIds.has(toolId)) continue;
    const list = presenceLists.get(toolId) ?? [];
    for (const source of list) {
      if (source?.key && sourcePresenceIndex.get(source.key) === toolId) {
        sourcePresenceIndex.delete(source.key);
      }
    }
    presenceLists.delete(toolId);
    changed = true;
  }

  return changed;
}

function applyAllToShell(shell, { pulseToolId = null } = {}) {
  if (!shell) return;

  pruneHiddenPresenceLists();
  const ids = new Set([...presenceToolIds(), ...presenceLists.keys()]);
  for (const toolId of ids) {
    applyToolToShell(shell, toolId, { pulse: toolId === pulseToolId });
  }
}

export function togglePresenceSignal(shell, signal) {
  if (!shell || !signal?.toolId || !signal?.source) return false;

  const toolId = normalizeToolId(signal.toolId);
  const source = normalizeParticipantSource(signal.source);
  if (!toolId || !source.key) return false;
  if (!presenceToolIds().includes(toolId)) return false;

  const currentToolId = sourcePresenceIndex.get(source.key) ?? null;
  const sameTool = currentToolId === toolId;

  if (sameTool) {
    removeSourceFromTool(toolId, source.key);
    applyToolToShell(shell, toolId, { pulse: false });
    return true;
  }

  removeSourceEverywhere(source.key);

  const list = listFor(toolId);
  if (!list) return false;
  list.push(source);
  sourcePresenceIndex.set(source.key, toolId);

  applyAllToShell(shell, { pulseToolId: toolId });
  shell.openNotification?.();
  return true;
}

export function clearPresenceTool(shell, toolId) {
  const normalizedTool = normalizeToolId(toolId);
  if (!normalizedTool) return false;

  const list = presenceLists.get(normalizedTool) ?? [];
  for (const source of list) {
    if (source?.key && sourcePresenceIndex.get(source.key) === normalizedTool) {
      sourcePresenceIndex.delete(source.key);
    }
  }

  presenceLists.delete(normalizedTool);
  shell?.clearToolActive?.(normalizedTool);
  shell?.setToolSources?.(normalizedTool, []);
  return true;
}

export function clearPresenceSource(shell, toolId, sourceKey) {
  const normalizedTool = normalizeToolId(toolId);
  const normalizedKey = normalizeSourceKey(sourceKey);
  if (!normalizedTool || !normalizedKey) return false;

  const removed = removeSourceFromTool(normalizedTool, normalizedKey);
  if (!removed) return false;

  applyToolToShell(shell, normalizedTool, { pulse: false });
  return true;
}

export function clearPresenceSourceEverywhere(shell, sourceKey) {
  const removed = removeSourceEverywhere(sourceKey);
  if (removed) applyAllToShell(shell, { pulseToolId: null });
  return removed;
}

export function reapplyActivePresence(shell) {
  applyAllToShell(shell, { pulseToolId: null });
}

export function getActivePresenceList(toolId) {
  const normalizedTool = normalizeToolId(toolId);
  const list = presenceLists.get(normalizedTool) ?? [];
  return list.map((source) => ({ ...source }));
}

export function getAllActivePresenceLists() {
  return Array.from(presenceLists.entries())
    .filter(([, sources]) => Array.isArray(sources) && sources.length > 0)
    .map(([toolId, sources]) => ({
      toolId,
      sources: sources.map((source) => ({ ...source }))
    }));
}

export function replaceActivePresenceLists(lists = []) {
  presenceLists.clear();
  sourcePresenceIndex.clear();

  for (const raw of Array.isArray(lists) ? lists : []) {
    const toolId = normalizeToolId(raw?.toolId);
    if (!toolId) continue;

    const sources = [];
    const seen = new Set();
    for (const rawSource of Array.isArray(raw?.sources) ? raw.sources : []) {
      const source = normalizeParticipantSource(rawSource);
      if (!source?.key || seen.has(source.key)) continue;
      seen.add(source.key);
      sources.push(source);
      sourcePresenceIndex.set(source.key, toolId);
    }

    if (sources.length) presenceLists.set(toolId, sources);
  }
}
