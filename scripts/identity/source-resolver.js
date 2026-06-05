import { getParticipantImagePreference } from "../settings.js";

function initialsForName(name) {
  const raw = String(name || "?").trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase() || "?";
}

function safeImage(value) {
  const src = String(value || "").trim();
  return src ? src : null;
}

function playerImage(user) {
  return safeImage(user?.avatar) || safeImage(user?.img) || null;
}

function actorImage(user) {
  return safeImage(user?.character?.img) || null;
}

function tokenImage(user) {
  const characterId = user?.character?.id;
  const controlled = Array.from(canvas?.tokens?.controlled ?? []);
  const controlledMatch = controlled.find((token) => token?.actor?.id && token.actor.id === characterId) ?? controlled[0] ?? null;
  const sceneMatch = characterId
    ? Array.from(canvas?.tokens?.placeables ?? []).find((token) => token?.actor?.id === characterId)
    : null;
  const token = controlledMatch ?? sceneMatch;
  return safeImage(token?.document?.texture?.src)
    || safeImage(token?.document?.img)
    || safeImage(token?.actor?.prototypeToken?.texture?.src)
    || null;
}

function preferredImage(user) {
  const preference = getParticipantImagePreference();
  const fallbacks = {
    player: [playerImage, actorImage, tokenImage],
    actor: [actorImage, tokenImage, playerImage],
    token: [tokenImage, actorImage, playerImage]
  }[preference] ?? [playerImage, actorImage, tokenImage];

  for (const resolver of fallbacks) {
    const image = resolver(user);
    if (image) return image;
  }
  return null;
}

export function currentParticipantSource() {
  const user = game?.user;
  const name = String(user?.name || "Player").trim() || "Player";
  return {
    key: user?.id || name,
    userId: user?.id ?? null,
    name,
    initials: initialsForName(name),
    image: preferredImage(user)
  };
}

export function normalizeParticipantSource(source) {
  const raw = source && typeof source === "object" ? source : {};
  const name = String(raw.name || "Player").trim() || "Player";
  const key = String(raw.key || raw.userId || name).trim() || name;
  return {
    key,
    userId: raw.userId ?? null,
    name,
    initials: String(raw.initials || initialsForName(name)).slice(0, 3).toUpperCase(),
    image: safeImage(raw.image)
  };
}
