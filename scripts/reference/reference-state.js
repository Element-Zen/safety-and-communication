import { MODULE_ID, MODULE_TITLE, SETTINGS } from "../settings.js";

export const SAFETY_REFERENCE_SCHEMA_VERSION = 1;
export const SAFETY_REFERENCE_MIGRATION_VERSION = 1;

const LEGACY_REFERENCE_FIELDS = Object.freeze([
  Object.freeze({ key: SETTINGS.safetyReferenceActiveTools, title: "Table Safety Tools" }),
  Object.freeze({ key: SETTINGS.safetyReferenceLines, title: "Lines" }),
  Object.freeze({ key: SETTINGS.safetyReferenceVeils, title: "Veils" })
]);

function makeReferenceBoxId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch (_) {}
  return `reference-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function getSettingValue(key, fallback = undefined) {
  try {
    const value = game.settings.get(MODULE_ID, key);
    return value === undefined ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function boxHasAuthoredContent(box) {
  return Boolean(String(box?.title ?? "").trim() || String(box?.body ?? "").trim());
}

function applyBoxPatch(box, patch = {}) {
  return {
    ...box,
    title: Object.prototype.hasOwnProperty.call(patch, "title") ? normalizeText(patch.title) : box.title,
    body: Object.prototype.hasOwnProperty.call(patch, "body") ? normalizeText(patch.body) : box.body
  };
}

export function defaultSafetyReferenceBox() {
  return {
    id: makeReferenceBoxId(),
    title: "",
    body: "",
    order: 0
  };
}

export function normalizeSafetyReferenceBox(raw, index = 0, seenIds = new Set()) {
  const source = raw && typeof raw === "object" ? raw : {};
  let id = String(source.id || "").trim();
  if (!id || seenIds.has(id)) id = makeReferenceBoxId();
  seenIds.add(id);

  return {
    id,
    title: normalizeText(source.title),
    body: normalizeText(source.body ?? source.content),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : index
  };
}

export function normalizeSafetyReferenceState(raw, { ensureOne = true } = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const seenIds = new Set();
  const boxes = (Array.isArray(source.boxes) ? source.boxes : [])
    .map((box, index) => normalizeSafetyReferenceBox(box, index, seenIds));

  const normalized = boxes.map((box, index) => ({ ...box, order: index }));
  if (!normalized.length && ensureOne) normalized.push(defaultSafetyReferenceBox());

  return {
    version: SAFETY_REFERENCE_SCHEMA_VERSION,
    boxes: normalized
  };
}

export function safetyReferenceBoxHasDisplayContent(box) {
  return boxHasAuthoredContent(box);
}

export function getSafetyReferenceState({ ensureOne = true } = {}) {
  return normalizeSafetyReferenceState(getSettingValue(SETTINGS.safetyReferenceBoxes, null), { ensureOne });
}

export function getSafetyReferenceBoxes({ includeEmpty = false } = {}) {
  const boxes = getSafetyReferenceState({ ensureOne: false }).boxes;
  return includeEmpty ? boxes : boxes.filter(safetyReferenceBoxHasDisplayContent);
}

async function persistSafetyReferenceBoxes(boxes) {
  if (!game?.user?.isGM) return getSafetyReferenceState({ ensureOne: false });
  const state = normalizeSafetyReferenceState({ version: SAFETY_REFERENCE_SCHEMA_VERSION, boxes }, { ensureOne: false });
  try {
    await game.settings.set(MODULE_ID, SETTINGS.safetyReferenceBoxes, state);
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Failed to save Safety Reference boxes`, error);
  }
  return state;
}

export async function setSafetyReferenceBox(boxId, patch = {}) {
  if (!game?.user?.isGM || !boxId) return getSafetyReferenceState({ ensureOne: false });
  const state = getSafetyReferenceState({ ensureOne: false });
  const boxes = state.boxes.map((box) => box.id === boxId ? applyBoxPatch(box, patch) : box);
  return persistSafetyReferenceBoxes(boxes);
}

export async function addSafetyReferenceBoxAtEnd(patch = {}) {
  if (!game?.user?.isGM) return null;
  const draft = applyBoxPatch(defaultSafetyReferenceBox(), patch);
  if (!boxHasAuthoredContent(draft)) return null;

  const state = getSafetyReferenceState({ ensureOne: false });
  const boxes = [...state.boxes];
  const nextBox = {
    ...draft,
    order: boxes.length
  };
  boxes.push(nextBox);
  await persistSafetyReferenceBoxes(boxes);
  return nextBox;
}

export async function duplicateSafetyReferenceBox(boxId) {
  if (!game?.user?.isGM || !boxId) return null;
  const state = getSafetyReferenceState({ ensureOne: false });
  const boxes = [...state.boxes];
  const index = boxes.findIndex((box) => box.id === boxId);
  if (index < 0) return null;
  const source = boxes[index];
  const duplicate = {
    id: makeReferenceBoxId(),
    title: source.title,
    body: source.body,
    order: index + 1
  };
  boxes.splice(index + 1, 0, duplicate);
  await persistSafetyReferenceBoxes(boxes);
  return duplicate;
}

export async function moveSafetyReferenceBox(boxId, direction) {
  if (!game?.user?.isGM || !boxId) return getSafetyReferenceState({ ensureOne: false });
  const state = getSafetyReferenceState({ ensureOne: false });
  const boxes = [...state.boxes];
  const index = boxes.findIndex((box) => box.id === boxId);
  if (index < 0) return state;

  const step = direction === "left" || direction === "up" || direction === -1 ? -1 : 1;
  const target = index + step;
  if (target < 0 || target >= boxes.length) return state;

  const [box] = boxes.splice(index, 1);
  boxes.splice(target, 0, box);
  return persistSafetyReferenceBoxes(boxes);
}

export async function deleteSafetyReferenceBox(boxId) {
  if (!game?.user?.isGM || !boxId) return getSafetyReferenceState({ ensureOne: false });
  const state = getSafetyReferenceState({ ensureOne: false });
  const boxes = state.boxes.filter((box) => box.id !== boxId);
  return persistSafetyReferenceBoxes(boxes);
}

function legacyReferenceBoxes() {
  const boxes = [];
  for (const field of LEGACY_REFERENCE_FIELDS) {
    const body = normalizeText(getSettingValue(field.key, ""));
    if (!body.trim()) continue;
    boxes.push({
      id: makeReferenceBoxId(),
      title: field.title,
      body,
      order: boxes.length
    });
  }
  return boxes;
}

export async function migrateSafetyReferenceBoxes() {
  const completedVersion = Number(getSettingValue(SETTINGS.safetyReferenceMigrationVersion, 0)) || 0;
  if (completedVersion >= SAFETY_REFERENCE_MIGRATION_VERSION) return;

  const current = getSafetyReferenceState({ ensureOne: false });
  const currentHasContent = current.boxes.some(boxHasAuthoredContent);
  const legacyBoxes = legacyReferenceBoxes();

  try {
    if (!currentHasContent) {
      await persistSafetyReferenceBoxes(legacyBoxes.length ? legacyBoxes : [defaultSafetyReferenceBox()]);
    }
    await game.settings.set(MODULE_ID, SETTINGS.safetyReferenceMigrationVersion, SAFETY_REFERENCE_MIGRATION_VERSION);
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Failed to migrate Safety Reference boxes`, error);
  }
}
