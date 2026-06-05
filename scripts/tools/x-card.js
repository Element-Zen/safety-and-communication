import {
  getSafetyToolOption,
  safetyToolOptionIsAnonymous
} from "../settings.js";

const X_PRESENTATIONS = Object.freeze({
  "x-card": Object.freeze({
    label: "X Card",
    glyph: "X",
    tone: "x",
    title: "X Card: Stop, remove, or change the current content."
  }),
  "anonymous-x-card": Object.freeze({
    label: "X Card",
    glyph: "X",
    tone: "x",
    title: "X Card: Stop, remove, or change the current content."
  })
});

export function getXCardTool() {
  const option = getSafetyToolOption("x");
  if (option === "none") return null;
  const presentation = X_PRESENTATIONS[option] ?? X_PRESENTATIONS["anonymous-x-card"];
  return {
    id: "x-card",
    family: "x",
    kind: "safety",
    variation: option,
    enabled: true,
    anonymous: safetyToolOptionIsAnonymous(option),
    ...presentation
  };
}
