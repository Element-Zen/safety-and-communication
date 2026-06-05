import { getSafetyReferenceLabel, setSafetyReferenceLabel } from "../settings.js";
import {
  addSafetyReferenceBoxAtEnd,
  deleteSafetyReferenceBox,
  duplicateSafetyReferenceBox,
  getSafetyReferenceBoxes,
  moveSafetyReferenceBox,
  setSafetyReferenceBox
} from "./reference-state.js";

export const SAFETY_REFERENCE_ADD_EVENT = "sac:reference-add-request";
export const SAFETY_REFERENCE_DELETE_EVENT = "sac:reference-delete-request";
export const SAFETY_REFERENCE_DUPLICATE_EVENT = "sac:reference-duplicate-request";
export const SAFETY_REFERENCE_EDIT_EVENT = "sac:reference-edit-request";
export const SAFETY_REFERENCE_LABEL_EDIT_EVENT = "sac:reference-label-edit-request";
export const SAFETY_REFERENCE_LABEL_SAVE_EVENT = "sac:reference-label-save-request";
export const SAFETY_REFERENCE_LABEL_CANCEL_EVENT = "sac:reference-label-cancel-request";
export const SAFETY_REFERENCE_MOVE_EVENT = "sac:reference-move-request";
export const SAFETY_REFERENCE_SAVE_EVENT = "sac:reference-save-request";
export const SAFETY_REFERENCE_CANCEL_EDIT_EVENT = "sac:reference-cancel-edit-request";

let activeEditor = null;
let activeKeydownHandler = null;

function closeActiveEditor() {
  try { activeEditor?.remove?.(); } catch (_) {}
  activeEditor = null;
  if (activeKeydownHandler) {
    try { window.removeEventListener("keydown", activeKeydownHandler, true); } catch (_) {}
    activeKeydownHandler = null;
  }
}

function getBox(boxId) {
  const boxes = getSafetyReferenceBoxes({ includeEmpty: true });
  return boxes.find((box) => box.id === boxId) ?? boxes[0] ?? null;
}

function buildButton(label, className, type = "button") {
  const button = document.createElement("button");
  button.type = type;
  button.className = className;
  button.textContent = label;
  return button;
}

function currentPatch(titleInput, bodyInput) {
  return {
    title: titleInput?.value ?? "",
    body: bodyInput?.value ?? ""
  };
}

function patchHasContent(patch = {}) {
  return Boolean(String(patch.title ?? "").trim() || String(patch.body ?? "").trim());
}

async function saveCurrent(boxId, titleInput, bodyInput, { draft = false } = {}) {
  const patch = currentPatch(titleInput, bodyInput);
  if (draft) {
    if (!patchHasContent(patch)) return null;
    return addSafetyReferenceBoxAtEnd(patch);
  }
  if (!boxId) return null;
  await setSafetyReferenceBox(boxId, patch);
  return getBox(boxId);
}

export function openSafetyReferenceLabelEditor(shell) {
  if (!game?.user?.isGM) return;

  closeActiveEditor();

  const backdrop = document.createElement("div");
  backdrop.className = "sac-reference-editor-backdrop";
  backdrop.setAttribute("role", "presentation");

  const form = document.createElement("form");
  form.className = "sac-reference-editor-panel sac-reference-label-editor-panel";
  form.setAttribute("role", "dialog");
  form.setAttribute("aria-modal", "true");
  form.setAttribute("aria-label", "Rename reference card");

  const header = document.createElement("header");
  header.className = "sac-reference-editor-header";

  const title = document.createElement("h2");
  title.textContent = "Rename Reference Card";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "sac-reference-editor-close";
  closeButton.setAttribute("aria-label", "Close reference name editor");
  closeButton.innerHTML = "&times;";

  header.appendChild(title);
  header.appendChild(closeButton);

  const nameLabel = document.createElement("label");
  nameLabel.className = "sac-reference-editor-field";
  const nameLabelText = document.createElement("span");
  nameLabelText.textContent = "Reference Card Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = getSafetyReferenceLabel();
  nameInput.placeholder = "Safety Reference";
  nameInput.setAttribute("spellcheck", "true");
  nameLabel.appendChild(nameLabelText);
  nameLabel.appendChild(nameInput);

  const actions = document.createElement("footer");
  actions.className = "sac-reference-editor-actions sac-reference-label-editor-actions";

  const commitActions = document.createElement("div");
  commitActions.className = "sac-reference-editor-commit-actions";
  const cancelButton = buildButton("Cancel", "sac-reference-editor-button");
  const saveButton = buildButton("Save", "sac-reference-editor-button sac-reference-editor-button-primary", "submit");
  commitActions.appendChild(cancelButton);
  commitActions.appendChild(saveButton);
  actions.appendChild(commitActions);

  form.appendChild(header);
  form.appendChild(nameLabel);
  form.appendChild(actions);
  backdrop.appendChild(form);
  document.body.appendChild(backdrop);
  activeEditor = backdrop;

  activeKeydownHandler = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeActiveEditor();
  };
  window.addEventListener("keydown", activeKeydownHandler, true);

  backdrop.addEventListener("mousedown", (event) => {
    if (event.target !== backdrop) return;
    event.preventDefault();
    closeActiveEditor();
  });

  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    closeActiveEditor();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await setSafetyReferenceLabel(nameInput.value);
    shell?.refreshReferenceDrawer?.();
    closeActiveEditor();
  });

  window.setTimeout(() => {
    try { nameInput.focus(); nameInput.select(); } catch (_) {}
  }, 0);
}

function makeDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function focusInlineReferenceEditor(shell) {
  window.setTimeout(() => {
    const target = shell?.referenceDrawerEl?.querySelector?.(".sac-reference-box[data-editing='true'] .sac-reference-inline-title-input");
    try { target?.focus?.(); target?.select?.(); } catch (_) {}
  }, 0);
}

function focusInlineReferenceLabelEditor(shell) {
  window.setTimeout(() => {
    const target = shell?.referenceDrawerEl?.querySelector?.(".sac-reference-title-inline-input");
    try { target?.focus?.(); target?.select?.(); } catch (_) {}
  }, 0);
}

function setInlineReferenceEditor(shell, state = null) {
  shell._referenceInlineEditor = state;
  if (state) shell._referenceLabelInlineEditor = null;
  shell?.refreshReferenceDrawer?.();
  if (state) focusInlineReferenceEditor(shell);
}

function startInlineReferenceEdit(shell, boxId) {
  const box = getBox(boxId);
  if (!box) return;
  setInlineReferenceEditor(shell, {
    boxId: box.id,
    draft: false,
    title: box.title ?? "",
    body: box.body ?? ""
  });
}

function startInlineReferenceDraft(shell) {
  setInlineReferenceEditor(shell, {
    boxId: makeDraftId(),
    draft: true,
    title: "",
    body: ""
  });
}

async function saveInlineReferenceEdit(shell, detail = {}) {
  const current = shell?._referenceInlineEditor;
  if (!current || current.boxId !== detail.boxId) return;

  const patch = {
    title: detail.patch?.title ?? "",
    body: detail.patch?.body ?? ""
  };

  if (current.draft) {
    await addSafetyReferenceBoxAtEnd(patch);
  } else {
    await setSafetyReferenceBox(current.boxId, patch);
  }

  setInlineReferenceEditor(shell, null);
}

function cancelInlineReferenceEdit(shell) {
  if (!shell?._referenceInlineEditor) return;
  setInlineReferenceEditor(shell, null);
}

function setInlineReferenceLabelEditor(shell, state = null) {
  shell._referenceLabelInlineEditor = state;
  if (state) shell._referenceInlineEditor = null;
  shell?.refreshReferenceDrawer?.();
  if (state) focusInlineReferenceLabelEditor(shell);
}

function startInlineReferenceLabelEdit(shell) {
  closeActiveEditor();
  setInlineReferenceLabelEditor(shell, {
    value: getSafetyReferenceLabel()
  });
}

async function saveInlineReferenceLabelEdit(shell, detail = {}) {
  if (!shell?._referenceLabelInlineEditor) return;
  await setSafetyReferenceLabel(detail.value);
  setInlineReferenceLabelEditor(shell, null);
}

function cancelInlineReferenceLabelEdit(shell) {
  if (!shell?._referenceLabelInlineEditor) return;
  setInlineReferenceLabelEditor(shell, null);
}

export function initializeSafetyReferenceEditor(shell) {
  if (!shell?.shellEl || shell._sacReferenceEditorBound) return;
  shell._sacReferenceEditorBound = true;
  shell._referenceInlineEditor = null;
  shell._referenceLabelInlineEditor = null;

  shell.shellEl.addEventListener(SAFETY_REFERENCE_EDIT_EVENT, (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    startInlineReferenceEdit(shell, event.detail?.boxId);
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_ADD_EVENT, (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    startInlineReferenceDraft(shell);
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_SAVE_EVENT, async (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    await saveInlineReferenceEdit(shell, event.detail);
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_CANCEL_EDIT_EVENT, (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    cancelInlineReferenceEdit(shell);
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_MOVE_EVENT, async (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    await moveSafetyReferenceBox(event.detail?.boxId, event.detail?.direction);
    shell?.refreshReferenceDrawer?.();
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_DUPLICATE_EVENT, async (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    await duplicateSafetyReferenceBox(event.detail?.boxId);
    shell?.refreshReferenceDrawer?.();
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_DELETE_EVENT, async (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    await deleteSafetyReferenceBox(event.detail?.boxId);
    shell?.refreshReferenceDrawer?.();
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_LABEL_EDIT_EVENT, (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    startInlineReferenceLabelEdit(shell);
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_LABEL_SAVE_EVENT, async (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    await saveInlineReferenceLabelEdit(shell, event.detail);
  });

  shell.shellEl.addEventListener(SAFETY_REFERENCE_LABEL_CANCEL_EVENT, (event) => {
    if (!game?.user?.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    cancelInlineReferenceLabelEdit(shell);
  });

  shell.referenceDrawerEl?.addEventListener("keydown", (event) => {
    if (!game?.user?.isGM || event.key !== "Escape" || (!shell._referenceInlineEditor && !shell._referenceLabelInlineEditor)) return;
    event.preventDefault();
    event.stopPropagation();
    if (shell._referenceLabelInlineEditor) cancelInlineReferenceLabelEdit(shell);
    else cancelInlineReferenceEdit(shell);
  }, true);
}
