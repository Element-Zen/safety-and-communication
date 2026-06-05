import { handToolIsEnabled } from "../settings.js";

const HAND_TOOLS = Object.freeze([
  Object.freeze({
    id: "hand-cut-in-line",
    family: "hand-cut",
    handFamily: "cut",
    queue: "cut",
    label: "Cut in Line",
    glyph: "🚨",
    tone: "siren",
    title: "Cut in Line: Urgent priority in the conversation."
  }),
  Object.freeze({
    id: "hand-next-in-line",
    family: "hand-next",
    handFamily: "next",
    queue: "next",
    label: "Next In Line",
    glyph: "⚡",
    tone: "bolt",
    title: "Next In Line: You need to speak soon."
  }),
  Object.freeze({
    id: "hand-back-of-line",
    family: "hand-back",
    handFamily: "back",
    queue: "back",
    label: "Back of the Line",
    glyph: "👋",
    tone: "hand",
    title: "Back of the Line: You would like a turn when the queue reaches you."
  })
]);

export function getHandRaiseTools() {
  return HAND_TOOLS.map((tool) => ({
    ...tool,
    kind: "hand",
    segment: "hand",
    variation: tool.queue,
    enabled: handToolIsEnabled(tool.handFamily),
    anonymous: false
  }));
}
