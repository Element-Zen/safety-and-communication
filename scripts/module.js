import { MODULE_ID, MODULE_TITLE, migrateToolSettings, registerSettings } from "./settings.js";
import { initializeSafetyEvents } from "./safety/safety-events.js";
import { initializeHandEvents } from "./hands/hand-events.js";
import { initializePresenceEvents } from "./presence/presence-events.js";
import { SafetyCommunicationShell } from "./shell.js";
import { initializeSafetyReferenceEditor } from "./reference/reference-editor.js";
import { migrateSafetyReferenceBoxes } from "./reference/reference-state.js";
import { initializeRuntimeStateHydration } from "./state/runtime-state.js";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", async () => {
  await migrateToolSettings();
  await migrateSafetyReferenceBoxes();
  const shell = new SafetyCommunicationShell();
  shell.render();
  initializeSafetyEvents(shell);
  initializeHandEvents(shell);
  initializePresenceEvents(shell);
  initializeSafetyReferenceEditor(shell);
  initializeRuntimeStateHydration(shell);

  globalThis.SafetyAndCommunication = {
    id: MODULE_ID,
    title: MODULE_TITLE,
    shell,
    open: () => shell.open(),
    openNotification: (options = {}) => shell.openNotification(options),
    close: () => shell.close(),
    toggle: () => shell.toggle(),
    rerender: () => shell.render()
  };

  try {
    game.safetyCommunication = globalThis.SafetyAndCommunication;
  } catch (_) {}
});
