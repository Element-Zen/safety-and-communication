import {
  getNotificationTimerMode,
  getNotificationTimerOptions,
  getSafetyReferenceLabel,
  notificationSoundsEnabled,
  MODULE_ID,
  MODULE_TITLE,
  normalizeEdge,
  setNotificationSoundsEnabled,
  setNotificationTimerMode
} from "../settings.js";
import {
  SAFETY_REFERENCE_ADD_EVENT,
  SAFETY_REFERENCE_DELETE_EVENT,
  SAFETY_REFERENCE_DUPLICATE_EVENT,
  SAFETY_REFERENCE_EDIT_EVENT,
  SAFETY_REFERENCE_LABEL_EDIT_EVENT,
  SAFETY_REFERENCE_LABEL_SAVE_EVENT,
  SAFETY_REFERENCE_MOVE_EVENT,
  SAFETY_REFERENCE_SAVE_EVENT
} from "../reference/reference-editor.js";
import { getSafetyReferenceBoxes, safetyReferenceBoxHasDisplayContent } from "../reference/reference-state.js";
import {
  SAFETY_SOURCE_CONTEXT_EVENT,
  SAFETY_TOOL_CLICK_EVENT,
  SAFETY_TOOL_CONTEXT_EVENT,
  SAFETY_TOOLS_RENDERED_EVENT
} from "../safety/safety-events.js";
import { getToolbarToolById, getToolbarTools } from "../tools/registry.js";
import { CLOSED_CLASS, OPEN_CLASS } from "./constants.js";

export function buildShellDom({ edge, isOpen }) {
  const shell = document.createElement("section");
  shell.className = `sac-shell sac-initializing ${isOpen ? OPEN_CLASS : CLOSED_CLASS}`;
  shell.dataset.moduleId = MODULE_ID;
  shell.dataset.edge = normalizeEdge(edge);
  shell.dataset.open = isOpen ? "true" : "false";
  shell.dataset.motion = "idle";
  shell.setAttribute("aria-label", MODULE_TITLE);

  const capsule = document.createElement("div");
  capsule.className = "sac-capsule";

  const resize = document.createElement("div");
  resize.className = "sac-resize-edge";

  const tools = document.createElement("div");
  tools.className = "sac-tools";
  tools.setAttribute("role", "toolbar");
  tools.setAttribute("aria-label", "Safety and Communication tools");

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "sac-handle";
  handle.title = "Toggle";
  handle.setAttribute("aria-label", "Toggle");

  const referenceToggle = document.createElement("button");
  referenceToggle.type = "button";
  referenceToggle.className = "sac-reference-toggle";
  referenceToggle.title = "Open Reference";
  referenceToggle.setAttribute("aria-label", "Open Reference");
  referenceToggle.setAttribute("aria-expanded", "false");
  const referenceIcon = document.createElement("i");
  referenceIcon.className = "fa-solid fa-bars";
  referenceIcon.setAttribute("aria-hidden", "true");
  referenceToggle.appendChild(referenceIcon);

  const referenceDrawer = document.createElement("aside");
  referenceDrawer.className = "sac-reference-drawer";
  referenceDrawer.setAttribute("role", "region");
  referenceDrawer.setAttribute("aria-label", "Safety reference");

  capsule.appendChild(resize);
  capsule.appendChild(tools);
  shell.appendChild(capsule);
  shell.appendChild(handle);
  shell.appendChild(referenceToggle);
  shell.appendChild(referenceDrawer);

  return { shell, capsule, resize, tools, handle, referenceToggle, referenceDrawer };
}

function buildToolButton(shell, tool) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sac-tool";
  button.dataset.toolId = tool.id;
  button.dataset.toolFamily = tool.family;
  button.dataset.tone = tool.tone;
  button.dataset.variation = tool.variation;
  button.dataset.anonymous = tool.anonymous ? "true" : "false";
  button.dataset.active = "false";
  button.title = tool.title || tool.label;
  button.setAttribute("aria-label", tool.label);
  button.setAttribute("aria-pressed", "false");

  const glyph = document.createElement("span");
  glyph.className = "sac-tool-glyph";
  glyph.textContent = tool.glyph;
  button.appendChild(glyph);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shell.shellEl?.dispatchEvent?.(new CustomEvent(SAFETY_TOOL_CLICK_EVENT, {
      detail: { tool },
      bubbles: true
    }));
  });

  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shell.shellEl?.dispatchEvent?.(new CustomEvent(SAFETY_TOOL_CONTEXT_EVENT, {
      detail: { tool, toolId: tool.id },
      bubbles: true
    }));
  });

  return button;
}

function buildToolGroup(shell, tool) {
  const group = document.createElement("span");
  group.className = "sac-tool-group";
  group.dataset.toolId = tool.id;
  group.dataset.toolFamily = tool.family;
  group.dataset.toolKind = tool.kind || "safety";
  group.dataset.segment = tool.segment || tool.kind || "safety";
  group.dataset.active = "false";
  group.dataset.hasSources = "false";
  group.appendChild(buildToolButton(shell, tool));
  return group;
}

function sourceLabel(source) {
  return String(source?.name || "Participant").trim() || "Participant";
}

function sourceTitle(tool, source) {
  const label = sourceLabel(source);
  if (tool?.kind === "hand") return `${label}: Click to lower your own hand; GM can click or right-click to clear`;
  if (tool?.kind === "presence") return `${label}: Click to clear your own presence status; GM can click or right-click to clear`;
  return `${label}: Click to clear your own request; GM can click or right-click to clear`;
}

function buildSourceTile(shell, toolId, source, tool = null) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "sac-tool-source";
  tile.dataset.toolId = toolId;
  tile.dataset.toolKind = tool?.kind || "safety";
  tile.dataset.sourceKey = source.key;
  tile.title = sourceTitle(tool, source);
  tile.setAttribute("aria-label", sourceLabel(source));

  if (source.image) {
    tile.classList.add("sac-tool-source-image");
    tile.style.backgroundImage = `url("${String(source.image).replace(/"/g, "%22")}")`;
  } else {
    tile.textContent = source.initials || "?";
  }

  tile.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shell.shellEl?.dispatchEvent?.(new CustomEvent(SAFETY_SOURCE_CONTEXT_EVENT, {
      detail: { toolId, sourceKey: source.key },
      bubbles: true
    }));
  });

  tile.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shell.shellEl?.dispatchEvent?.(new CustomEvent(SAFETY_SOURCE_CONTEXT_EVENT, {
      detail: { toolId, sourceKey: source.key },
      bubbles: true
    }));
  });

  return tile;
}

function toolGroup(shell, toolId) {
  const button = shell.getToolButton?.(toolId);
  return button?.closest?.(".sac-tool-group") ?? null;
}

function updateToolGroupState(shell, toolId) {
  const group = toolGroup(shell, toolId);
  if (!group) return;
  const button = shell.getToolButton?.(toolId);
  const sources = group.querySelectorAll?.(".sac-tool-source")?.length ?? 0;
  const active = button?.dataset.active === "true";
  group.dataset.active = active ? "true" : "false";
  group.dataset.hasSources = sources > 0 ? "true" : "false";
}

export function renderToolSources(shell, toolId, sources = []) {
  const group = toolGroup(shell, toolId);
  if (!group) return false;

  const existing = group.querySelector(":scope > .sac-tool-sources");
  existing?.remove?.();

  const tool = getToolbarToolById(toolId);
  const list = Array.isArray(sources) ? sources.filter((source) => source?.key) : [];
  if (list.length) {
    const container = document.createElement("span");
    container.className = "sac-tool-sources";
    container.setAttribute("aria-hidden", "false");
    for (const source of list) {
      container.appendChild(buildSourceTile(shell, toolId, source, tool));
    }
    group.appendChild(container);
  }

  updateToolGroupState(shell, toolId);
  shell.updateLayoutUnitCount?.();
  shell.sync?.({ preferPredictedSize: true });
  return true;
}

export function renderTools(shell) {
  if (!shell.toolsEl) return;
  shell.toolsEl.innerHTML = "";
  const tools = getToolbarTools();

  let previousSegment = null;
  for (const tool of tools) {
    const segment = tool.segment || tool.kind || "safety";
    if (previousSegment && segment !== previousSegment) {
      const divider = document.createElement("span");
      divider.className = "sac-tool-divider";
      divider.setAttribute("aria-hidden", "true");
      shell.toolsEl.appendChild(divider);
    }
    shell.toolsEl.appendChild(buildToolGroup(shell, tool));
    previousSegment = segment;
  }

  shell.updateLayoutUnitCount?.();

  shell.shellEl?.dispatchEvent?.(new CustomEvent(SAFETY_TOOLS_RENDERED_EVENT, {
    detail: { tools },
    bubbles: false
  }));
}

export function syncHandleIcon(shell) {
  if (!shell.handleEl) return;
  const edge = shell.edge;
  const open = shell.isOpen;
  let icon = "fa-chevron-down";
  if (edge === "top") icon = open ? "fa-chevron-up" : "fa-chevron-down";
  if (edge === "bottom") icon = open ? "fa-chevron-down" : "fa-chevron-up";
  if (edge === "left") icon = open ? "fa-chevron-left" : "fa-chevron-right";
  if (edge === "right") icon = open ? "fa-chevron-right" : "fa-chevron-left";

  shell.handleEl.innerHTML = "";
  const marker = document.createElement("i");
  marker.className = `fa-solid ${icon}`;
  marker.setAttribute("aria-hidden", "true");
  shell.handleEl.appendChild(marker);
}

export function syncToolSizing(shell) {
  // Button sizing is CSS-derived from --sac-thickness so the capsule and tools update in one pass.
  try { shell.capsuleEl?.style?.removeProperty("--sac-button-size"); } catch (_) {}
}

function buildNotificationTimerControls(shell) {
  const activeMode = getNotificationTimerMode();
  const options = getNotificationTimerOptions();

  const group = document.createElement("div");
  group.className = "sac-reference-timer-controls";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Toolbar notification auto-close timer");

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sac-reference-timer-button";
    button.dataset.timerMode = option.mode;
    button.dataset.active = option.mode === activeMode ? "true" : "false";
    button.dataset.none = option.mode === "none" ? "true" : "false";
    button.title = "Notification timer for collapsed Safety Toolbar.";
    button.setAttribute("aria-pressed", option.mode === activeMode ? "true" : "false");
    button.setAttribute("aria-label", option.mode === "none"
      ? "No notification timer"
      : `${option.seconds} second notification timer`
    );

    const iconStack = document.createElement("span");
    iconStack.className = "sac-reference-timer-icon-stack";

    const hourglass = document.createElement("i");
    hourglass.className = "fa-regular fa-hourglass-half sac-reference-timer-icon";
    hourglass.setAttribute("aria-hidden", "true");
    iconStack.appendChild(hourglass);

    button.appendChild(iconStack);

    const value = document.createElement("span");
    value.className = "sac-reference-timer-value";
    value.textContent = option.mode === "none" ? "None" : String(option.seconds);
    button.appendChild(value);

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await setNotificationTimerMode(option.mode);
      shell.refreshNotificationTimerPreferences?.();
    });

    group.appendChild(button);
  }

  return group;
}

function buildNotificationAudioToggle(shell) {
  const enabled = notificationSoundsEnabled();

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sac-reference-audio-button";
  button.dataset.active = enabled ? "true" : "false";
  button.title = "Notification sounds for collapsed Safety Toolbar.";
  button.setAttribute("aria-pressed", enabled ? "true" : "false");
  button.setAttribute("aria-label", enabled ? "Disable notification sounds" : "Enable notification sounds");

  const icon = document.createElement("i");
  icon.className = `fa-solid ${enabled ? "fa-volume-high" : "fa-volume-xmark"}`;
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await setNotificationSoundsEnabled(!notificationSoundsEnabled());
    shell.refreshNotificationSoundPreferences?.();
  });

  return button;
}

function buildReferenceBoxControlButton({ className = "", icon, title, ariaLabel, disabled = false, eventName, detail = {} } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `sac-reference-box-control-button ${className}`.trim();
  button.title = title || ariaLabel || "";
  button.setAttribute("aria-label", ariaLabel || title || "");
  if (disabled) {
    button.disabled = true;
    button.dataset.disabled = "true";
  }

  const marker = document.createElement("i");
  marker.className = icon;
  marker.setAttribute("aria-hidden", "true");
  button.appendChild(marker);

  if (eventName && !disabled) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.dispatchEvent(new CustomEvent(eventName, {
        detail,
        bubbles: true
      }));
    });
  }

  return button;
}

function buildReferenceBoxControls(box, { titleText = "", index = 0, count = 1 } = {}) {
  const boxId = box?.id;
  const label = titleText || "reference box";

  const controls = document.createElement("div");
  controls.className = "sac-reference-box-controls";

  controls.appendChild(buildReferenceBoxControlButton({
    className: "sac-reference-edit-button",
    icon: "fa-solid fa-pencil",
    title: "Edit Box Content",
    ariaLabel: `Edit ${label}`,
    eventName: SAFETY_REFERENCE_EDIT_EVENT,
    detail: { boxId }
  }));

  controls.appendChild(buildReferenceBoxControlButton({
    className: "sac-reference-move-left-button",
    icon: "fa-solid fa-caret-left",
    title: "Move Box left",
    ariaLabel: `Move ${label} left`,
    disabled: index <= 0,
    eventName: SAFETY_REFERENCE_MOVE_EVENT,
    detail: { boxId, direction: "left" }
  }));

  controls.appendChild(buildReferenceBoxControlButton({
    className: "sac-reference-move-right-button",
    icon: "fa-solid fa-caret-right",
    title: "Move Box right",
    ariaLabel: `Move ${label} right`,
    disabled: index >= count - 1,
    eventName: SAFETY_REFERENCE_MOVE_EVENT,
    detail: { boxId, direction: "right" }
  }));

  controls.appendChild(buildReferenceBoxControlButton({
    className: "sac-reference-duplicate-button",
    icon: "fa-regular fa-copy",
    title: "Duplicate Box",
    ariaLabel: `Duplicate ${label}`,
    eventName: SAFETY_REFERENCE_DUPLICATE_EVENT,
    detail: { boxId }
  }));

  controls.appendChild(buildReferenceBoxControlButton({
    className: "sac-reference-delete-button",
    icon: "fa-solid fa-trash",
    title: "Delete Box",
    ariaLabel: `Delete ${label}`,
    eventName: SAFETY_REFERENCE_DELETE_EVENT,
    detail: { boxId }
  }));

  return controls;
}

function buildReferenceBoxEditControls(box) {
  const boxId = box?.id;

  const controls = document.createElement("div");
  controls.className = "sac-reference-box-controls sac-reference-box-edit-controls";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "sac-reference-box-control-button sac-reference-save-button";
  saveButton.title = "Save Box";
  saveButton.setAttribute("aria-label", "Save Box");

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-floppy-disk";
  icon.setAttribute("aria-hidden", "true");
  saveButton.appendChild(icon);

  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const card = saveButton.closest(".sac-reference-box");
    const title = card?.querySelector(".sac-reference-inline-title-input")?.value ?? "";
    const body = card?.querySelector(".sac-reference-inline-body-input")?.value ?? "";

    saveButton.dispatchEvent(new CustomEvent(SAFETY_REFERENCE_SAVE_EVENT, {
      detail: {
        boxId,
        patch: { title, body }
      },
      bubbles: true
    }));
  });

  controls.appendChild(saveButton);
  return controls;
}

function buildReferenceInlineTitleInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "sac-reference-inline-title-input";
  input.value = value;
  input.placeholder = "Enter Box Title";
  input.setAttribute("spellcheck", "true");
  return input;
}

function buildReferenceInlineBodyInput(value = "") {
  const textarea = document.createElement("textarea");
  textarea.className = "sac-reference-inline-body-input";
  textarea.value = value;
  textarea.placeholder = "Enter Text";
  textarea.setAttribute("spellcheck", "true");
  textarea.rows = 4;
  return textarea;
}

function buildReferenceLabelInlineInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "sac-reference-title-inline-input";
  input.value = value;
  input.placeholder = "Enter New Header";
  input.setAttribute("spellcheck", "true");
  return input;
}

function buildReferenceLabelSaveButton(referenceLabel) {
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "sac-reference-title-save-button";
  saveButton.title = `Save ${referenceLabel}`;
  saveButton.setAttribute("aria-label", `Save ${referenceLabel}`);

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-floppy-disk";
  icon.setAttribute("aria-hidden", "true");
  saveButton.appendChild(icon);

  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const input = saveButton.closest(".sac-reference-title-row")?.querySelector(".sac-reference-title-inline-input");
    saveButton.dispatchEvent(new CustomEvent(SAFETY_REFERENCE_LABEL_SAVE_EVENT, {
      detail: { value: input?.value ?? "" },
      bubbles: true
    }));
  });

  return saveButton;
}

function getBalancedReferenceGroupSizes(count, maxGroupSize = 4) {
  const total = Math.max(0, Number(count) || 0);
  const cap = Math.max(1, Number(maxGroupSize) || 4);
  if (total <= cap) return total ? [total] : [];

  const groupCount = Math.ceil(total / cap);
  const baseSize = Math.floor(total / groupCount);
  const largerGroups = total % groupCount;
  const sizes = [];

  for (let index = 0; index < groupCount; index += 1) {
    sizes.push(baseSize + (index < largerGroups ? 1 : 0));
  }

  return sizes;
}


export function renderSafetyReferenceDrawer(shell) {
  if (!shell.shellEl || !shell.referenceDrawerEl || !shell.referenceToggleEl) return false;

  const isGM = Boolean(game?.user?.isGM);
  const referenceLabel = getSafetyReferenceLabel();
  const allBoxes = getSafetyReferenceBoxes({ includeEmpty: isGM });
  const inlineEditor = isGM ? shell._referenceInlineEditor : null;
  const labelEditor = isGM ? shell._referenceLabelInlineEditor : null;
  const stateBoxes = isGM ? allBoxes : allBoxes.filter(safetyReferenceBoxHasDisplayContent);
  const visibleBoxes = inlineEditor?.draft
    ? [
      ...stateBoxes,
      {
        id: inlineEditor.boxId,
        title: inlineEditor.title ?? "",
        body: inlineEditor.body ?? "",
        order: stateBoxes.length,
        draft: true
      }
    ]
    : stateBoxes;
  const hasContent = visibleBoxes.length > 0;

  shell.shellEl.dataset.referenceHasContent = hasContent ? "true" : "false";
  shell.shellEl.dataset.referenceGmEditable = isGM ? "true" : "false";
  if (!hasContent && !isGM) shell.referenceOpen = false;
  shell.shellEl.dataset.referenceOpen = shell.referenceOpen && shell.isOpen && (hasContent || isGM) ? "true" : "false";
  shell.referenceToggleEl.setAttribute("aria-expanded", shell.shellEl.dataset.referenceOpen === "true" ? "true" : "false");
  shell.referenceToggleEl.title = "Open Reference";
  shell.referenceToggleEl.setAttribute("aria-label", "Open Reference");
  shell.referenceDrawerEl.setAttribute("aria-label", referenceLabel);
  shell.referenceDrawerEl.dataset.empty = hasContent ? "false" : "true";

  const verticalStack = ["left", "right"].includes(normalizeEdge(shell.edge));
  const groupSizes = getBalancedReferenceGroupSizes(visibleBoxes.length, 4);
  const largestGroupSize = Math.max(...groupSizes, 1);
  const groupCount = verticalStack
    ? Math.max(1, groupSizes.length)
    : Math.max(1, largestGroupSize);
  const groupMinHeight = (largestGroupSize * 142) + (Math.max(0, largestGroupSize - 1) * 12);
  shell.referenceDrawerEl.style.setProperty("--sac-reference-column-count", String(groupCount));
  shell.referenceDrawerEl.style.setProperty("--sac-reference-group-min-height", `${groupMinHeight}px`);
  shell.referenceDrawerEl.dataset.stack = verticalStack ? "vertical" : "horizontal";
  shell.referenceDrawerEl.dataset.boxCount = String(visibleBoxes.length);
  shell.referenceDrawerEl.dataset.groupCount = String(groupSizes.length);
  shell.referenceDrawerEl.dataset.gmEditable = isGM ? "true" : "false";

  const signature = JSON.stringify({
    isGM,
    referenceLabel,
    stack: shell.referenceDrawerEl.dataset.stack,
    notificationTimerMode: getNotificationTimerMode(),
    notificationTimerOptions: getNotificationTimerOptions().map((option) => [option.mode, option.label, option.seconds]),
    notificationSoundsEnabled: notificationSoundsEnabled(),
    empty: !hasContent,
    inlineEditor: inlineEditor ? [inlineEditor.boxId, inlineEditor.draft === true] : null,
    labelEditor: labelEditor ? [labelEditor.value ?? ""] : null,
    groupSizes,
    largestGroupSize,
    groupCount: groupSizes.length,
    boxes: visibleBoxes.map((box) => [
      box.id,
      box.title,
      box.body,
      box.order
    ])
  });
  if (shell._referenceContentSignature === signature && shell.referenceDrawerEl.childElementCount > 0) return true;
  shell._referenceContentSignature = signature;

  shell.referenceDrawerEl.innerHTML = "";

  const titleControls = document.createElement("div");
  titleControls.className = "sac-reference-title-controls";
  titleControls.appendChild(buildNotificationTimerControls(shell));
  titleControls.appendChild(buildNotificationAudioToggle(shell));
  shell.referenceDrawerEl.appendChild(titleControls);

  const titleRow = document.createElement("header");
  titleRow.className = "sac-reference-title-row";
  titleRow.dataset.labelEditing = labelEditor ? "true" : "false";

  if (labelEditor) {
    const titleInput = buildReferenceLabelInlineInput(labelEditor.value ?? referenceLabel);
    titleInput.addEventListener("input", () => {
      if (shell._referenceLabelInlineEditor) shell._referenceLabelInlineEditor.value = titleInput.value;
    });
    titleInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      titleInput.dispatchEvent(new CustomEvent(SAFETY_REFERENCE_LABEL_SAVE_EVENT, {
        detail: { value: titleInput.value },
        bubbles: true
      }));
    });
    titleRow.appendChild(titleInput);
  } else {
    const title = document.createElement("h2");
    title.className = "sac-reference-title";
    title.textContent = referenceLabel;
    titleRow.appendChild(title);
  }

  if (isGM) {
    if (labelEditor) {
      titleRow.appendChild(buildReferenceLabelSaveButton(referenceLabel));
    } else {
      const addBoxButton = document.createElement("button");
      addBoxButton.type = "button";
      addBoxButton.className = "sac-reference-title-add-button";
      addBoxButton.title = "Add a new Box";
      addBoxButton.setAttribute("aria-label", "Add a new Box");
      const addBoxIcon = document.createElement("i");
      addBoxIcon.className = "fa-solid fa-plus";
      addBoxIcon.setAttribute("aria-hidden", "true");
      addBoxButton.appendChild(addBoxIcon);
      addBoxButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        shell.shellEl?.dispatchEvent?.(new CustomEvent(SAFETY_REFERENCE_ADD_EVENT, {
          bubbles: true
        }));
      });
      titleRow.appendChild(addBoxButton);

      const labelEditButton = document.createElement("button");
      labelEditButton.type = "button";
      labelEditButton.className = "sac-reference-title-edit-button";
      labelEditButton.title = `Rename ${referenceLabel}`;
      labelEditButton.setAttribute("aria-label", `Rename ${referenceLabel}`);
      const labelEditIcon = document.createElement("i");
      labelEditIcon.className = "fa-solid fa-pencil";
      labelEditIcon.setAttribute("aria-hidden", "true");
      labelEditButton.appendChild(labelEditIcon);
      labelEditButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        shell.shellEl?.dispatchEvent?.(new CustomEvent(SAFETY_REFERENCE_LABEL_EDIT_EVENT, {
          bubbles: true
        }));
      });
      titleRow.appendChild(labelEditButton);
    }
  }

  shell.referenceDrawerEl.appendChild(titleRow);

  const boxGrid = document.createElement("div");
  boxGrid.className = "sac-reference-box-grid";
  boxGrid.dataset.layout = verticalStack ? "vertical" : "horizontal";

  const buildReferenceCard = (box, index) => {
    const titleText = String(box.title ?? "").trim();
    const bodyText = String(box.body ?? "");
    const authored = safetyReferenceBoxHasDisplayContent(box);
    const editing = isGM && inlineEditor?.boxId === box.id;

    const card = document.createElement("section");
    card.className = "sac-reference-box";
    card.dataset.boxId = box.id;
    card.dataset.empty = authored ? "false" : "true";
    card.dataset.editing = editing ? "true" : "false";
    if (box.draft) card.dataset.draft = "true";

    const cardHeader = document.createElement("header");
    cardHeader.className = "sac-reference-box-header";

    if (editing) {
      const titleInput = buildReferenceInlineTitleInput(box.title ?? "");
      titleInput.addEventListener("input", () => {
        if (shell._referenceInlineEditor?.boxId === box.id) shell._referenceInlineEditor.title = titleInput.value;
      });
      titleInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        const bodyInput = titleInput.closest(".sac-reference-box")?.querySelector(".sac-reference-inline-body-input");
        try { bodyInput?.focus?.(); } catch (_) {}
      });
      cardHeader.appendChild(titleInput);
    } else {
      const heading = document.createElement("h3");
      heading.textContent = titleText || (isGM ? "Reference Box" : "Reference");
      cardHeader.appendChild(heading);
    }

    card.appendChild(cardHeader);

    if (isGM) {
      card.appendChild(editing
        ? buildReferenceBoxEditControls(box)
        : buildReferenceBoxControls(box, {
          titleText,
          index,
          count: visibleBoxes.length
        })
      );
    }

    const content = document.createElement("div");
    content.className = "sac-reference-content";

    if (editing) {
      const bodyInput = buildReferenceInlineBodyInput(box.body ?? "");
      bodyInput.addEventListener("input", () => {
        if (shell._referenceInlineEditor?.boxId === box.id) shell._referenceInlineEditor.body = bodyInput.value;
      });
      content.appendChild(bodyInput);
    } else {
      content.textContent = bodyText || (isGM ? "Click the pencil to edit this reference box." : "");
    }

    card.appendChild(content);
    return card;
  };

  let groupStart = 0;
  for (const size of groupSizes) {
    const group = document.createElement("div");
    group.className = "sac-reference-box-group";
    group.dataset.groupSize = String(size);

    visibleBoxes.slice(groupStart, groupStart + size).forEach((box, localIndex) => {
      group.appendChild(buildReferenceCard(box, groupStart + localIndex));
    });

    groupStart += size;
    boxGrid.appendChild(group);
  }

  if (hasContent) shell.referenceDrawerEl.appendChild(boxGrid);
  return true;
}
