import { getNCardTool } from "./n-card.js";
import { getOCardTool } from "./o-card.js";
import { getXCardTool } from "./x-card.js";
import { getHandRaiseTools } from "./hand-raise.js";
import { getPresenceTools } from "./presence.js";

const TOOL_BUILDERS = Object.freeze([
  getXCardTool,
  getNCardTool,
  getOCardTool
]);

export function getToolbarTools() {
  const safetyTools = TOOL_BUILDERS
    .map((builder) => builder())
    .filter((tool) => tool && tool.enabled !== false);

  return [
    ...safetyTools,
    ...getHandRaiseTools().filter((tool) => tool && tool.enabled !== false),
    ...getPresenceTools().filter((tool) => tool && tool.enabled !== false)
  ];
}

export function getToolbarToolById(toolId) {
  return getToolbarTools().find((tool) => tool.id === toolId) ?? null;
}
