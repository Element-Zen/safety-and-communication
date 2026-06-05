import {
  getSafetyToolOption,
  safetyToolOptionIsAnonymous
} from "../settings.js";

const O_PRESENTATIONS = Object.freeze({
  "o-card": Object.freeze({
    label: "O Card",
    glyph: "O",
    tone: "o",
    title: "O Card: Okay to continue."
  }),
  "anonymous-o-card": Object.freeze({
    label: "O Card",
    glyph: "O",
    tone: "o",
    title: "O Card: Okay to continue."
  }),
  check: Object.freeze({
    label: "Checkmark",
    glyph: "✓",
    tone: "check",
    title: "Checkmark: Vote yes! Positive Reinforcement!."
  }),
  "anonymous-check": Object.freeze({
    label: "Checkmark",
    glyph: "✓",
    tone: "check",
    title: "Checkmark: Vote yes! Positive Reinforcement!"
  })
});

export function getOCardTool() {
  const option = getSafetyToolOption("o");
  if (option === "none") return null;
  const presentation = O_PRESENTATIONS[option] ?? O_PRESENTATIONS["anonymous-check"];
  return {
    id: "o-card",
    family: "o",
    kind: "safety",
    variation: option,
    enabled: true,
    anonymous: safetyToolOptionIsAnonymous(option),
    ...presentation
  };
}
