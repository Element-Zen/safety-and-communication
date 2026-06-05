import {
  getDefaultNotificationChimeSound,
  getDefaultNotificationXCardSound,
  getNotificationChimeSound,
  getNotificationSoundVolume,
  getNotificationXCardSound,
  notificationSoundsEnabled
} from "../settings.js";

function normalizeSource(src) {
  return String(src || "").trim();
}

function normalizeVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function uniqueSources(...sources) {
  const seen = new Set();
  const out = [];
  for (const source of sources.map(normalizeSource)) {
    if (!source || seen.has(source)) continue;
    seen.add(source);
    out.push(source);
  }
  return out;
}

function audioHelper() {
  return globalThis.foundry?.audio?.AudioHelper
    ?? globalThis.AudioHelper
    ?? game?.audio
    ?? null;
}

async function playWithAudioHelper(src, volume) {
  const helper = audioHelper();
  if (!helper?.play) return false;

  try {
    await helper.play.call(helper, {
      src,
      volume,
      autoplay: true,
      loop: false
    }, false);
    return true;
  } catch (error) {
    console.debug?.("Safety and Communication | Notification sound source failed", src, error);
    return false;
  }
}

async function playFirstAvailableInterfaceSound(...sources) {
  if (!notificationSoundsEnabled()) return false;

  const volume = normalizeVolume(getNotificationSoundVolume());
  const candidates = uniqueSources(...sources);
  if (!candidates.length) return false;

  for (const src of candidates) {
    if (await playWithAudioHelper(src, volume)) return true;
  }

  console.warn("Safety and Communication | Failed to play notification sound from configured or fallback sources", candidates);
  return false;
}

export function playNotificationChime() {
  return playFirstAvailableInterfaceSound(
    getNotificationChimeSound(),
    getDefaultNotificationChimeSound()
  );
}

export function playXCardSound() {
  return playFirstAvailableInterfaceSound(
    getNotificationXCardSound(),
    getDefaultNotificationXCardSound(),
    getDefaultNotificationChimeSound()
  );
}
