import {
  getSafetyToolOption,
  safetyToolOptionIsAnonymous
} from "../settings.js";

const N_PRESENTATIONS = Object.freeze({
  "n-card": Object.freeze({
    label: "N Card",
    glyph: "N",
    tone: "n",
    title: "N Card: Slow down; this is nearing a boundary."
  }),
  "anonymous-n-card": Object.freeze({
    label: "N Card",
    glyph: "N",
    tone: "n",
    title: "N Card: Slow down; this is nearing a boundary."
  }),
  caution: Object.freeze({
    label: "Caution",
    glyph: "!",
    tone: "n",
    title: "Caution: Slow down."
  }),
  "anonymous-caution": Object.freeze({
    label: "Caution",
    glyph: "!",
    tone: "n",
    title: "Caution: Slow down."
  })
});

export function getNCardTool() {
  const option = getSafetyToolOption("n");
  if (option === "none") return null;
  const presentation = N_PRESENTATIONS[option] ?? N_PRESENTATIONS["anonymous-n-card"];
  return {
    id: "n-card",
    family: "n",
    kind: "safety",
    variation: option,
    enabled: true,
    anonymous: safetyToolOptionIsAnonymous(option),
    ...presentation
  };
}
