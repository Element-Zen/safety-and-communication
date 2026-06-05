import { MAX_THICKNESS, MIN_THICKNESS } from "./shell/constants.js";
export const MODULE_ID = "safety-and-communication";
export const MODULE_TITLE = "Safety and Communication";

export const DEFAULT_NOTIFICATION_CHIME_SOUND = `modules/${MODULE_ID}/assets/sounds/notification-chime.ogg`;
export const DEFAULT_NOTIFICATION_X_CARD_SOUND = `modules/${MODULE_ID}/assets/sounds/x-card-alert.ogg`;

export const SETTINGS = Object.freeze({
  initialDrawerState: "initialDrawerState",
  participantImagePreference: "participantImagePreference",
  personalDock: "personalDock",
  personalPlacementInitialized: "personalPlacementInitialized",
  personalEdgeThickness: "personalEdgeThickness",
  xCardOption: "xCardOption",
  nCardOption: "nCardOption",
  oCardOption: "oCardOption",
  handCutInLineOption: "handCutInLineOption",
  handNextInLineOption: "handNextInLineOption",
  handBackOfLineOption: "handBackOfLineOption",
  presenceAfkOption: "presenceAfkOption",
  presenceOpenDoorOption: "presenceOpenDoorOption",
  safetyReferenceActiveTools: "safetyReferenceActiveTools",
  safetyReferenceLines: "safetyReferenceLines",
  safetyReferenceVeils: "safetyReferenceVeils",
  safetyReferenceBoxes: "safetyReferenceBoxes",
  safetyReferenceLabel: "safetyReferenceLabel",
  safetyReferenceMigrationVersion: "safetyReferenceMigrationVersion",
  notificationTimerMode: "notificationTimerMode",
  notificationSoundsEnabled: "notificationSoundsEnabled",
  notificationChimeSound: "notificationChimeSound",
  notificationXCardSound: "notificationXCardSound",
  notificationSoundVolume: "notificationSoundVolume",
  runtimeState: "runtimeState",
  toolSettingsMigrationVersion: "toolSettingsMigrationVersion"
});

const LEGACY_SETTINGS = Object.freeze({
  showXTool: "showXTool",
  showNTool: "showNTool",
  showOTool: "showOTool",
  xVariation: "xVariation",
  nVariation: "nVariation",
  oVariation: "oVariation",
  xAnonymous: "xAnonymous",
  nAnonymous: "nAnonymous",
  oAnonymous: "oAnonymous"
});

export const EDGE_DEFAULTS = Object.freeze({
  edge: "top",
  offset: null
});

export const THICKNESS_DEFAULTS = Object.freeze({
  top: 86,
  bottom: 86,
  left: 86,
  right: 86,
  canonical: 86
});

export const SAFETY_TOOL_FAMILIES = Object.freeze({
  x: "x",
  n: "n",
  o: "o"
});

export const TOOL_SETTING_KEYS = Object.freeze({
  x: Object.freeze({
    option: SETTINGS.xCardOption,
    legacyVariation: LEGACY_SETTINGS.xVariation,
    legacyShow: LEGACY_SETTINGS.showXTool,
    legacyAnonymous: LEGACY_SETTINGS.xAnonymous,
    defaultOption: "anonymous-x-card"
  }),
  n: Object.freeze({
    option: SETTINGS.nCardOption,
    legacyVariation: LEGACY_SETTINGS.nVariation,
    legacyShow: LEGACY_SETTINGS.showNTool,
    legacyAnonymous: LEGACY_SETTINGS.nAnonymous,
    defaultOption: "anonymous-n-card"
  }),
  o: Object.freeze({
    option: SETTINGS.oCardOption,
    legacyVariation: LEGACY_SETTINGS.oVariation,
    legacyShow: LEGACY_SETTINGS.showOTool,
    legacyAnonymous: LEGACY_SETTINGS.oAnonymous,
    defaultOption: "anonymous-check"
  })
});

const TOOL_OPTIONS = Object.freeze({
  x: Object.freeze(["none", "x-card", "anonymous-x-card"]),
  n: Object.freeze(["none", "n-card", "anonymous-n-card", "caution", "anonymous-caution"]),
  o: Object.freeze(["none", "o-card", "anonymous-o-card", "check", "anonymous-check"])
});

export const NOTIFICATION_TIMER_MODES = Object.freeze(["short", "medium", "long", "none"]);

export const NOTIFICATION_TIMER_DEFAULT_SECONDS = Object.freeze({
  short: 3,
  medium: 5,
  long: 10
});

export const HAND_TOOL_FAMILIES = Object.freeze({
  cut: "cut",
  next: "next",
  back: "back"
});

export const HAND_TOOL_SETTING_KEYS = Object.freeze({
  cut: Object.freeze({
    option: SETTINGS.handCutInLineOption,
    enabledOption: "cut-in-line",
    label: "Cut in Line"
  }),
  next: Object.freeze({
    option: SETTINGS.handNextInLineOption,
    enabledOption: "next-in-line",
    label: "Next In Line"
  }),
  back: Object.freeze({
    option: SETTINGS.handBackOfLineOption,
    enabledOption: "back-of-line",
    label: "Back of the Line"
  })
});

const HAND_TOOL_OPTIONS = Object.freeze({
  cut: Object.freeze(["none", HAND_TOOL_SETTING_KEYS.cut.enabledOption]),
  next: Object.freeze(["none", HAND_TOOL_SETTING_KEYS.next.enabledOption]),
  back: Object.freeze(["none", HAND_TOOL_SETTING_KEYS.back.enabledOption])
});

export const PRESENCE_TOOL_FAMILIES = Object.freeze({
  afk: "afk",
  door: "door"
});

export const PRESENCE_TOOL_SETTING_KEYS = Object.freeze({
  afk: Object.freeze({
    option: SETTINGS.presenceAfkOption,
    enabledOption: "afk",
    label: "AFK"
  }),
  door: Object.freeze({
    option: SETTINGS.presenceOpenDoorOption,
    enabledOption: "open-door",
    label: "Open Door"
  })
});

const PRESENCE_TOOL_OPTIONS = Object.freeze({
  afk: Object.freeze(["none", PRESENCE_TOOL_SETTING_KEYS.afk.enabledOption]),
  door: Object.freeze(["none", PRESENCE_TOOL_SETTING_KEYS.door.enabledOption])
});

export function clampNumber(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeEdge(edge) {
  return ["top", "bottom", "left", "right"].includes(edge) ? edge : "top";
}

export function normalizeDock(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const edge = normalizeEdge(source.edge ?? EDGE_DEFAULTS.edge);
  const offset = Number.isFinite(Number(source.offset)) ? Number(source.offset) : null;
  return { edge, offset };
}

export function normalizeThicknessMap(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const legacyValues = [source.top, source.bottom, source.left, source.right]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const legacyCustomized = legacyValues.find((value) => value !== THICKNESS_DEFAULTS.canonical);
  const legacyFallback = legacyCustomized ?? legacyValues[0] ?? THICKNESS_DEFAULTS.canonical;
  const canonical = clampNumber(
    source.canonical,
    MIN_THICKNESS,
    MAX_THICKNESS,
    legacyFallback
  );
  return {
    top: clampNumber(source.top, MIN_THICKNESS, MAX_THICKNESS, canonical),
    bottom: clampNumber(source.bottom, MIN_THICKNESS, MAX_THICKNESS, canonical),
    left: clampNumber(source.left, MIN_THICKNESS, MAX_THICKNESS, canonical),
    right: clampNumber(source.right, MIN_THICKNESS, MAX_THICKNESS, canonical),
    canonical
  };
}

function refreshToolbar() {
  try {
    globalThis.SafetyAndCommunication?.shell?.refreshTools?.();
  } catch (_) {}
}

function refreshSafetyReferenceDrawer() {
  try {
    globalThis.SafetyAndCommunication?.shell?.refreshReferenceDrawer?.();
  } catch (_) {}
}

function refreshNotificationTimerControls() {
  try {
    globalThis.SafetyAndCommunication?.shell?.refreshNotificationTimerPreferences?.();
  } catch (_) {}
}

function refreshNotificationSoundControls() {
  try {
    globalThis.SafetyAndCommunication?.shell?.refreshNotificationSoundPreferences?.();
  } catch (_) {}
}

function getWorldSettingsStorage() {
  try {
    return game.settings.storage?.get?.("world");
  } catch (_) {
    return undefined;
  }
}

function storageEntryValue(entry) {
  if (entry === undefined || entry === null) return undefined;
  if (Object.prototype.hasOwnProperty.call(entry, "value")) return entry.value;
  return entry;
}

function settingStorageValue(key) {
  try {
    const storageKey = `${MODULE_ID}.${key}`;
    const worldStorage = getWorldSettingsStorage();
    if (!worldStorage) return undefined;

    if (typeof worldStorage.get === "function") {
      const namespaced = worldStorage.get(storageKey);
      if (namespaced !== undefined) return storageEntryValue(namespaced);

      const bare = worldStorage.get(key);
      if (bare !== undefined) return storageEntryValue(bare);
    }

    if (Object.prototype.hasOwnProperty.call(worldStorage, storageKey)) return storageEntryValue(worldStorage[storageKey]);
    if (Object.prototype.hasOwnProperty.call(worldStorage, key)) return storageEntryValue(worldStorage[key]);
  } catch (_) {}
  return undefined;
}

function hasStoredSetting(key) {
  return settingStorageValue(key) !== undefined;
}

function getClientSettingsStorage() {
  try {
    return game.settings.storage?.get?.("client");
  } catch (_) {
    return undefined;
  }
}

function clientSettingStorageValue(key) {
  try {
    const storageKey = `${MODULE_ID}.${key}`;
    const clientStorage = getClientSettingsStorage();
    if (!clientStorage) return undefined;

    if (typeof clientStorage.get === "function") {
      const namespaced = clientStorage.get(storageKey);
      if (namespaced !== undefined) return storageEntryValue(namespaced);

      const bare = clientStorage.get(key);
      if (bare !== undefined) return storageEntryValue(bare);
    }

    if (Object.prototype.hasOwnProperty.call(clientStorage, storageKey)) return storageEntryValue(clientStorage[storageKey]);
    if (Object.prototype.hasOwnProperty.call(clientStorage, key)) return storageEntryValue(clientStorage[key]);
  } catch (_) {}
  return undefined;
}

function hasStoredClientSetting(key) {
  return clientSettingStorageValue(key) !== undefined;
}

function defaultNotificationTimerModeForUser() {
  try {
    return game?.user?.isGM ? "none" : "short";
  } catch (_) {
    return "short";
  }
}

function safeGetSetting(key, fallback = undefined) {
  try {
    const value = game.settings.get(MODULE_ID, key);
    return value === undefined ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function boolFromStored(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (String(value).toLowerCase() === "false") return false;
  if (String(value).toLowerCase() === "true") return true;
  return fallback;
}

function normalizeLegacyToolOption(family, rawOption, { show = true, anonymous = true } = {}) {
  const normalized = normalizeToolFamily(family);
  if (show === false) return "none";
  const raw = String(rawOption || TOOL_SETTING_KEYS[normalized].defaultOption);

  if (raw === "none" || raw.startsWith("anonymous-")) return TOOL_OPTIONS[normalized].includes(raw) ? raw : TOOL_SETTING_KEYS[normalized].defaultOption;

  if (normalized === "x") return anonymous ? "anonymous-x-card" : "x-card";

  if (normalized === "n") {
    if (["caution", "slow-down"].includes(raw)) return anonymous ? "anonymous-caution" : "caution";
    return anonymous ? "anonymous-n-card" : "n-card";
  }

  if (normalized === "o") {
    if (["check", "positive-support"].includes(raw)) return anonymous ? "anonymous-check" : "check";
    return anonymous ? "anonymous-o-card" : "o-card";
  }

  return TOOL_SETTING_KEYS[normalized].defaultOption;
}

function htmlElementFromRenderArg(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  if (html?.querySelector) return html;
  return null;
}

function escapeAttributeValue(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function insertSettingsDivider(root, settingKey, label, section) {
  if (!root || !settingKey || !label || !section) return;
  if (root.querySelector?.(`.sac-settings-divider[data-sac-section="${section}"]`)) return;

  const settingName = `${MODULE_ID}.${settingKey}`;
  const input = root.querySelector?.(`[name="${escapeAttributeValue(settingName)}"]`);
  const row = input?.closest?.(".form-group") ?? input?.parentElement?.closest?.(".form-group");
  if (!row?.parentElement) return;

  const divider = document.createElement("div");
  divider.className = "sac-settings-divider";
  divider.dataset.sacSection = section;
  divider.setAttribute("aria-hidden", "true");
  divider.innerHTML = `<span></span><strong>${label}</strong><span></span>`;
  row.parentElement.insertBefore(divider, row);
}

function replaceInputWithTextarea(root, settingKey, rows = 4) {
  if (!root || !settingKey) return;
  const settingName = `${MODULE_ID}.${settingKey}`;
  const input = root.querySelector?.(`input[name="${escapeAttributeValue(settingName)}"]`);
  if (!input || input.dataset.sacTextarea === "true") return;

  const row = input.closest?.(".form-group") ?? input.parentElement?.closest?.(".form-group");
  row?.classList?.add?.("sac-settings-textarea-row");

  const textarea = document.createElement("textarea");
  textarea.name = input.name;
  textarea.className = `${input.className || ""} sac-settings-textarea`.trim();
  textarea.value = getSettingString(settingKey).replace(/\r\n?/g, "\n");
  textarea.rows = rows;
  textarea.dataset.sacTextarea = "true";
  textarea.placeholder = input.placeholder || "";
  textarea.setAttribute("data-dtype", input.getAttribute("data-dtype") || "String");
  textarea.setAttribute("spellcheck", "true");
  input.replaceWith(textarea);
}

function installSettingsConfigDivider() {
  if (installSettingsConfigDivider.installed) return;
  installSettingsConfigDivider.installed = true;

  Hooks.on("renderSettingsConfig", (_app, html) => {
    const root = htmlElementFromRenderArg(html);
    if (!root) return;

    insertSettingsDivider(root, SETTINGS.xCardOption, "Safety Tools", "safety");
    insertSettingsDivider(root, SETTINGS.handCutInLineOption, "Hand Raising Tools", "hands");
    insertSettingsDivider(root, SETTINGS.presenceAfkOption, "Presence Tools", "presence");
    insertSettingsDivider(root, SETTINGS.notificationChimeSound, "Toolbar Notification Sounds", "notification-sounds");
  });
}

function registerHandToolSettings() {
  game.settings.register(MODULE_ID, SETTINGS.handCutInLineOption, {
    name: "Cut in Line",
    hint: "Choose whether the Cut in Line hand-raise tool appears.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      "cut-in-line": "Cut in Line"
    },
    default: HAND_TOOL_SETTING_KEYS.cut.enabledOption,
    onChange: refreshToolbar
  });

  game.settings.register(MODULE_ID, SETTINGS.handNextInLineOption, {
    name: "Next In Line",
    hint: "Choose whether the Next In Line hand-raise tool appears.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      "next-in-line": "Next In Line"
    },
    default: HAND_TOOL_SETTING_KEYS.next.enabledOption,
    onChange: refreshToolbar
  });

  game.settings.register(MODULE_ID, SETTINGS.handBackOfLineOption, {
    name: "Back of the Line",
    hint: "Choose whether the Back of the Line hand-raise tool appears.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      "back-of-line": "Back of the Line"
    },
    default: HAND_TOOL_SETTING_KEYS.back.enabledOption,
    onChange: refreshToolbar
  });
}

function registerPresenceToolSettings() {
  game.settings.register(MODULE_ID, SETTINGS.presenceAfkOption, {
    name: "AFK",
    hint: "Choose whether the AFK tool appears.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      afk: "AFK"
    },
    default: PRESENCE_TOOL_SETTING_KEYS.afk.enabledOption,
    onChange: refreshToolbar
  });

  game.settings.register(MODULE_ID, SETTINGS.presenceOpenDoorOption, {
    name: "Open Door",
    hint: "Choose whether the Open Door tool appears for participants who need to step away and will not return this session.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      "open-door": "Open Door"
    },
    default: PRESENCE_TOOL_SETTING_KEYS.door.enabledOption,
    onChange: refreshToolbar
  });
}


function configInterfaceSound(key, fallback = "") {
  try {
    return String(CONFIG?.sounds?.[key] ?? fallback ?? "");
  } catch (_) {
    return String(fallback ?? "");
  }
}

function defaultNotificationChimeSound() {
  return DEFAULT_NOTIFICATION_CHIME_SOUND;
}

function defaultNotificationXCardSound() {
  return DEFAULT_NOTIFICATION_X_CARD_SOUND;
}

function isLegacyCoreNotificationSound(src) {
  const normalized = String(src || "").trim();
  if (!normalized) return false;
  return normalized === configInterfaceSound("notification", "")
    || normalized === configInterfaceSound("lock", "")
    || normalized === "sounds/notify.wav"
    || normalized === "sounds/notification.wav"
    || normalized === "sounds/lock.wav";
}


function registerNotificationTimerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.notificationTimerMode, {
    name: "Notification Timer Mode",
    hint: "Client-side timer preference selected from the Safety Resources header.",
    scope: "client",
    config: false,
    type: String,
    choices: {
      none: "No Timer",
      short: "Short",
      medium: "Medium",
      long: "Long"
    },
    default: "short",
    onChange: refreshNotificationTimerControls
  });

  game.settings.register(MODULE_ID, SETTINGS.notificationSoundsEnabled, {
    name: "Notification Sounds Enabled",
    hint: "Client-side speaker preference selected from the Safety Resources header.",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
    onChange: refreshNotificationSoundControls
  });

}

function registerNotificationSoundSettings() {
  game.settings.register(MODULE_ID, SETTINGS.notificationChimeSound, {
    name: "Notification Chime Sound",
    hint: "Interface sound path for toolbar notifications. Leave blank to use the packaged notification chime.",
    scope: "world",
    config: true,
    type: String,
    filePicker: "audio",
    default: defaultNotificationChimeSound(),
    onChange: refreshNotificationSoundControls
  });

  game.settings.register(MODULE_ID, SETTINGS.notificationXCardSound, {
    name: "X Card Sound",
    hint: "Interface sound path for the first X Card activation in an active X Card cycle. Leave blank to use the packaged X Card alert.",
    scope: "world",
    config: true,
    type: String,
    filePicker: "audio",
    default: defaultNotificationXCardSound(),
    onChange: refreshNotificationSoundControls
  });

  game.settings.register(MODULE_ID, SETTINGS.notificationSoundVolume, {
    name: "Notification Sound Volume",
    hint: "Volume for toolbar notification sounds.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.5,
    onChange: refreshNotificationSoundControls
  });
}
function registerSafetyReferenceSettings() {
  game.settings.register(MODULE_ID, SETTINGS.safetyReferenceLabel, {
    name: "Reference Card Name",
    hint: "Internal reference drawer title edited from the Safety Reference drawer by the GM.",
    scope: "world",
    config: false,
    type: String,
    default: "Safety Reference",
    onChange: refreshSafetyReferenceDrawer
  });

  // Legacy fields retained only so pre-release worlds can migrate their old
  // Table Safety Tools / Lines / Veils text into structured reference boxes.
  game.settings.register(MODULE_ID, SETTINGS.safetyReferenceActiveTools, {
    name: "Legacy Table Safety Tools",
    hint: "Internal legacy Safety Reference field migrated into editable reference boxes.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    onChange: refreshSafetyReferenceDrawer
  });

  game.settings.register(MODULE_ID, SETTINGS.safetyReferenceLines, {
    name: "Legacy Lines",
    hint: "Internal legacy Safety Reference field migrated into editable reference boxes.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    onChange: refreshSafetyReferenceDrawer
  });

  game.settings.register(MODULE_ID, SETTINGS.safetyReferenceVeils, {
    name: "Legacy Veils",
    hint: "Internal legacy Safety Reference field migrated into editable reference boxes.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    onChange: refreshSafetyReferenceDrawer
  });

  game.settings.register(MODULE_ID, SETTINGS.safetyReferenceBoxes, {
    name: "Safety Reference Boxes",
    hint: "Internal structured Safety Reference card data edited from the drawer by the GM.",
    scope: "world",
    config: false,
    type: Object,
    default: { version: 1, boxes: [] },
    onChange: refreshSafetyReferenceDrawer
  });

  game.settings.register(MODULE_ID, SETTINGS.safetyReferenceMigrationVersion, {
    name: "Safety Reference Migration Version",
    hint: "Internal migration marker for structured Safety Reference boxes.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
}

function registerToolSettings() {
  game.settings.register(MODULE_ID, SETTINGS.xCardOption, {
    name: "X Card",
    hint: "Choose whether the X Card appears and whether it is anonymous.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      "x-card": "X Card",
      "anonymous-x-card": "Anonymous X Card"
    },
    default: TOOL_SETTING_KEYS.x.defaultOption,
    onChange: refreshToolbar
  });

  game.settings.register(MODULE_ID, SETTINGS.nCardOption, {
    name: "N Card",
    hint: "Choose whether the N Card appears and whether it is anonymous.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      "n-card": "N Card",
      "anonymous-n-card": "Anonymous N Card",
      caution: "Caution",
      "anonymous-caution": "Anonymous Caution"
    },
    default: TOOL_SETTING_KEYS.n.defaultOption,
    onChange: refreshToolbar
  });

  game.settings.register(MODULE_ID, SETTINGS.oCardOption, {
    name: "O Card",
    hint: "Choose whether the O Card or Checkmark appears and whether it is anonymous.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None",
      "o-card": "O Card",
      "anonymous-o-card": "Anonymous O Card",
      check: "Checkmark",
      "anonymous-check": "Anonymous Checkmark"
    },
    default: TOOL_SETTING_KEYS.o.defaultOption,
    onChange: refreshToolbar
  });
}

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.initialDrawerState, {
    name: "Initial Drawer State",
    hint: "Choose whether the Safety and Communication toolbar starts open or closed when Foundry loads.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      open: "Open",
      closed: "Closed"
    },
    default: "open",
    onChange: (value) => {
      try {
        globalThis.SafetyAndCommunication?.shell?.applyInitialState(value);
      } catch (_) {}
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.participantImagePreference, {
    name: "Image Preference",
    hint: "Choose which image source non-anonymous safety signals use. Anonymous signals never show portraits.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      player: "Player Avatar",
      actor: "Linked Actor Portrait",
      token: "Controlled or Linked Token"
    },
    default: "player"
  });

  registerToolSettings();
  registerNotificationTimerSettings();
  registerHandToolSettings();
  registerPresenceToolSettings();
  registerSafetyReferenceSettings();
  registerNotificationSoundSettings();
  installSettingsConfigDivider();

  game.settings.register(MODULE_ID, SETTINGS.runtimeState, {
    name: "Runtime State Snapshot",
    hint: "Internal active safety, hand, and presence state used to hydrate late-joining or refreshed clients.",
    scope: "world",
    config: false,
    type: Object,
    default: { version: 1, updatedAt: 0, safety: [], hands: [], presence: [] }
  });

  game.settings.register(MODULE_ID, SETTINGS.toolSettingsMigrationVersion, {
    name: "Tool Settings Migration Version",
    hint: "Internal migration marker for consolidated X/N/O tool settings.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  game.settings.register(MODULE_ID, SETTINGS.personalDock, {
    name: "Personal Drawer Dock",
    hint: "Client-side placement for the Safety and Communication shell.",
    scope: "client",
    config: false,
    type: Object,
    default: { ...EDGE_DEFAULTS }
  });

  game.settings.register(MODULE_ID, SETTINGS.personalPlacementInitialized, {
    name: "Personal Placement Initialized",
    hint: "Client-side marker that the first-load toolbar placement has been seeded.",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.personalEdgeThickness, {
    name: "Personal Edge Thickness",
    hint: "Client-side shell thickness for each screen edge.",
    scope: "client",
    config: false,
    type: Object,
    default: { ...THICKNESS_DEFAULTS }
  });
}

const TOOL_SETTINGS_MIGRATION_VERSION = 1;

export async function migrateToolSettings() {
  const completedVersion = Number(safeGetSetting(SETTINGS.toolSettingsMigrationVersion, 0)) || 0;
  if (completedVersion >= TOOL_SETTINGS_MIGRATION_VERSION) return;

  const families = Object.values(SAFETY_TOOL_FAMILIES);
  for (const family of families) {
    const keys = TOOL_SETTING_KEYS[family];
    try {
      const current = safeGetSetting(keys.option, keys.defaultOption);
      const currentIsValid = TOOL_OPTIONS[family].includes(current);
      const newSettingIsStored = hasStoredSetting(keys.option);
      const legacyVariation = settingStorageValue(keys.legacyVariation);
      const legacyShow = settingStorageValue(keys.legacyShow);
      const legacyAnonymous = settingStorageValue(keys.legacyAnonymous);
      const legacySettingExists = [legacyVariation, legacyShow, legacyAnonymous].some((value) => value !== undefined);

      if (currentIsValid && newSettingIsStored) continue;
      if (currentIsValid && current !== keys.defaultOption) continue;
      if (!legacySettingExists) continue;

      const show = boolFromStored(legacyShow, true);
      const anonymous = boolFromStored(legacyAnonymous, true);
      const normalized = normalizeLegacyToolOption(family, legacyVariation, { show, anonymous });
      if (TOOL_OPTIONS[family].includes(normalized)) {
        await game.settings.set(MODULE_ID, keys.option, normalized);
      }
    } catch (error) {
      console.warn(`${MODULE_TITLE} | Failed to migrate ${family.toUpperCase()} Card setting`, error);
    }
  }

  try {
    await game.settings.set(MODULE_ID, SETTINGS.toolSettingsMigrationVersion, TOOL_SETTINGS_MIGRATION_VERSION);
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Failed to mark tool settings migration complete`, error);
  }
}

export function normalizeNotificationTimerMode(mode) {
  const value = String(mode || "none");
  return NOTIFICATION_TIMER_MODES.includes(value) ? value : "none";
}

export function normalizeNotificationTimerSeconds(value, fallback = NOTIFICATION_TIMER_DEFAULT_SECONDS.medium) {
  return Math.round(clampNumber(value, 1, 300, fallback));
}

export function getNotificationTimerMode() {
  const fallback = defaultNotificationTimerModeForUser();
  try {
    if (!hasStoredClientSetting(SETTINGS.notificationTimerMode)) return fallback;
    return normalizeNotificationTimerMode(game.settings.get(MODULE_ID, SETTINGS.notificationTimerMode));
  } catch (_) {
    return fallback;
  }
}

export async function setNotificationTimerMode(mode) {
  const normalized = normalizeNotificationTimerMode(mode);
  try {
    await game.settings.set(MODULE_ID, SETTINGS.notificationTimerMode, normalized);
  } catch (_) {}
  return normalized;
}

export function getNotificationTimerSeconds(mode) {
  const normalized = normalizeNotificationTimerMode(mode);
  if (normalized === "none") return 0;
  return NOTIFICATION_TIMER_DEFAULT_SECONDS[normalized] ?? NOTIFICATION_TIMER_DEFAULT_SECONDS.short;
}

function notificationTimerLabel(seconds) {
  const safeSeconds = normalizeNotificationTimerSeconds(seconds, NOTIFICATION_TIMER_DEFAULT_SECONDS.medium);
  return `${safeSeconds} ${safeSeconds === 1 ? "Second" : "Seconds"}`;
}

export function getNotificationTimerOptions() {
  const shortSeconds = getNotificationTimerSeconds("short");
  const mediumSeconds = getNotificationTimerSeconds("medium");
  const longSeconds = getNotificationTimerSeconds("long");
  return [
    { mode: "short", label: notificationTimerLabel(shortSeconds), seconds: shortSeconds },
    { mode: "medium", label: notificationTimerLabel(mediumSeconds), seconds: mediumSeconds },
    { mode: "long", label: notificationTimerLabel(longSeconds), seconds: longSeconds },
    { mode: "none", label: "None", seconds: 0 }
  ];
}

export function notificationTimerKeepOpenForXCard() {
  return true;
}

export function notificationSoundsEnabled() {
  try {
    return game.settings.get(MODULE_ID, SETTINGS.notificationSoundsEnabled) !== false;
  } catch (_) {
    return true;
  }
}

export async function setNotificationSoundsEnabled(enabled = true) {
  const next = Boolean(enabled);
  try {
    await game.settings.set(MODULE_ID, SETTINGS.notificationSoundsEnabled, next);
  } catch (_) {}
  return next;
}

export function getNotificationChimeSound() {
  const configured = getSettingString(SETTINGS.notificationChimeSound).trim();
  if (!configured || isLegacyCoreNotificationSound(configured)) return defaultNotificationChimeSound();
  return configured;
}

export function getNotificationXCardSound() {
  const configured = getSettingString(SETTINGS.notificationXCardSound).trim();
  if (!configured || isLegacyCoreNotificationSound(configured)) return defaultNotificationXCardSound();
  return configured;
}

export function getDefaultNotificationChimeSound() {
  return defaultNotificationChimeSound();
}

export function getDefaultNotificationXCardSound() {
  return defaultNotificationXCardSound();
}

export function getNotificationSoundVolume() {
  try {
    return clampNumber(game.settings.get(MODULE_ID, SETTINGS.notificationSoundVolume), 0, 1, 0.5);
  } catch (_) {
    return 0.5;
  }
}

export function getInitialDrawerState() {
  try {
    const value = game.settings.get(MODULE_ID, SETTINGS.initialDrawerState);
    return value === "closed" ? "closed" : "open";
  } catch (_) {
    return "open";
  }
}

export function getPersonalDock() {
  try {
    return normalizeDock(game.settings.get(MODULE_ID, SETTINGS.personalDock));
  } catch (_) {
    return normalizeDock(EDGE_DEFAULTS);
  }
}

export async function setPersonalDock(dock) {
  try {
    await game.settings.set(MODULE_ID, SETTINGS.personalDock, normalizeDock(dock));
  } catch (_) {}
}

export function getPersonalPlacementInitialized() {
  try {
    return game.settings.get(MODULE_ID, SETTINGS.personalPlacementInitialized) === true;
  } catch (_) {
    return false;
  }
}

export async function setPersonalPlacementInitialized(initialized = true) {
  try {
    await game.settings.set(MODULE_ID, SETTINGS.personalPlacementInitialized, Boolean(initialized));
  } catch (_) {}
}

export function getPersonalThicknessMap() {
  try {
    return normalizeThicknessMap(game.settings.get(MODULE_ID, SETTINGS.personalEdgeThickness));
  } catch (_) {
    return normalizeThicknessMap(THICKNESS_DEFAULTS);
  }
}

export function getPersonalEdgeThickness(edge) {
  const normalized = normalizeEdge(edge);
  const map = getPersonalThicknessMap();
  return map.canonical ?? map[normalized] ?? THICKNESS_DEFAULTS[normalized] ?? 86;
}

export async function setPersonalEdgeThickness(edge, value) {
  try {
    const normalized = normalizeEdge(edge);
    const current = getPersonalThicknessMap();
    const canonical = clampNumber(value, MIN_THICKNESS, MAX_THICKNESS, current.canonical ?? THICKNESS_DEFAULTS[normalized] ?? 86);
    const next = {
      top: canonical,
      bottom: canonical,
      left: canonical,
      right: canonical,
      canonical
    };
    await game.settings.set(MODULE_ID, SETTINGS.personalEdgeThickness, next);
  } catch (_) {}
}

export function normalizeToolFamily(family) {
  return Object.values(SAFETY_TOOL_FAMILIES).includes(family) ? family : SAFETY_TOOL_FAMILIES.x;
}

export function getSafetyToolOption(family) {
  const normalized = normalizeToolFamily(family);
  const keys = TOOL_SETTING_KEYS[normalized];
  try {
    const current = game.settings.get(MODULE_ID, keys.option);
    return TOOL_OPTIONS[normalized].includes(current) ? current : keys.defaultOption;
  } catch (_) {
    return keys.defaultOption;
  }
}

export function normalizeHandToolFamily(family) {
  return Object.values(HAND_TOOL_FAMILIES).includes(family) ? family : HAND_TOOL_FAMILIES.back;
}

export function getHandToolOption(family) {
  const normalized = normalizeHandToolFamily(family);
  const keys = HAND_TOOL_SETTING_KEYS[normalized];
  try {
    const current = game.settings.get(MODULE_ID, keys.option);
    return HAND_TOOL_OPTIONS[normalized].includes(current) ? current : keys.enabledOption;
  } catch (_) {
    return keys.enabledOption;
  }
}

export function handToolIsEnabled(family) {
  const normalized = normalizeHandToolFamily(family);
  return getHandToolOption(normalized) !== "none";
}

export function normalizePresenceToolFamily(family) {
  return Object.values(PRESENCE_TOOL_FAMILIES).includes(family) ? family : PRESENCE_TOOL_FAMILIES.afk;
}

export function getPresenceToolOption(family) {
  const normalized = normalizePresenceToolFamily(family);
  const keys = PRESENCE_TOOL_SETTING_KEYS[normalized];
  try {
    const current = game.settings.get(MODULE_ID, keys.option);
    return PRESENCE_TOOL_OPTIONS[normalized].includes(current) ? current : keys.enabledOption;
  } catch (_) {
    return keys.enabledOption;
  }
}

export function presenceToolIsEnabled(family) {
  const normalized = normalizePresenceToolFamily(family);
  return getPresenceToolOption(normalized) !== "none";
}

export function safetyToolOptionIsAnonymous(option) {
  return String(option || "").startsWith("anonymous-");
}

export function getSafetyReferenceLabel() {
  const label = getSettingString(SETTINGS.safetyReferenceLabel).trim();
  return label || "Safety Reference";
}

export async function setSafetyReferenceLabel(label) {
  const cleanLabel = String(label ?? "").trim() || "Safety Reference";
  await game.settings.set(MODULE_ID, SETTINGS.safetyReferenceLabel, cleanLabel);
  return cleanLabel;
}

function getSettingString(key) {
  try {
    return String(game.settings.get(MODULE_ID, key) ?? "");
  } catch (_) {
    return "";
  }
}

export function getParticipantImagePreference() {
  try {
    const value = game.settings.get(MODULE_ID, SETTINGS.participantImagePreference);
    return ["player", "actor", "token"].includes(value) ? value : "player";
  } catch (_) {
    return "player";
  }
}
