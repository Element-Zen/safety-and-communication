import { presenceToolIsEnabled } from "../settings.js";

const PRESENCE_TOOLS = Object.freeze([
  Object.freeze({
    id: "presence-afk",
    family: "presence-afk",
    presenceFamily: "afk",
    status: "afk",
    label: "AFK",
    glyph: "💤",
    tone: "afk",
    title: "AFK: Temporarily stepping away from the table."
  }),
  Object.freeze({
    id: "presence-open-door",
    family: "presence-door",
    presenceFamily: "door",
    status: "door",
    label: "Open Door",
    glyph: "🚪",
    tone: "door",
    title: "Open Door: Stepping away and not returning this session."
  })
]);

export function getPresenceTools() {
  return PRESENCE_TOOLS.map((tool) => ({
    ...tool,
    kind: "presence",
    segment: "presence",
    variation: tool.status,
    enabled: presenceToolIsEnabled(tool.presenceFamily),
    anonymous: false
  }));
}
