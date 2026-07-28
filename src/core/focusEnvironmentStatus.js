import { FOCUS_PHASES, FOCUS_STATES } from "./focusSession.js";

const SOUND_LABELS = Object.freeze({
  bird: "Birds",
  campfire: "Campfire",
  ocean_waves: "Ocean Waves",
  rain: "Rain",
  thunder: "Thunder",
  wind: "Wind",
});

function getEnabledSoundLabels(ambientSound) {
  if (!ambientSound?.enabled) return [];

  const enabledIds = Object.entries(ambientSound.sounds ?? {})
    .filter(([, sound]) => sound?.enabled)
    .map(([soundId]) => soundId);

  if (enabledIds.length === 0 && ambientSound.soundId) {
    enabledIds.push(ambientSound.soundId);
  }

  return enabledIds.map((soundId) => SOUND_LABELS[soundId]).filter(Boolean);
}

function describeSounds(labels, isPaused) {
  const state = isPaused ? "paused" : "playing";
  if (labels.length > 2) {
    return `${labels.length} sounds ${state}`;
  }
  return `${labels.join(" + ")} ${state}`;
}

export function getFocusEnvironmentIndicators(session) {
  if (!session || session.phase === FOCUS_PHASES.BREAK) return [];

  const indicators = [];
  const blocker = session.snapshot?.blocker ?? session.blocker;
  const blockedSiteCount = Array.isArray(blocker?.blockedUrls)
    ? blocker.blockedUrls.length
    : 0;

  if (blocker?.enabled && blockedSiteCount > 0) {
    indicators.push({
      type: "blocker",
      text: `Blocking ${blockedSiteCount} ${
        blockedSiteCount === 1 ? "site" : "sites"
      }`,
    });
  }

  const ambientSound = session.snapshot?.ambientSound ?? session.ambientSound;
  const soundLabels = getEnabledSoundLabels(ambientSound);
  if (soundLabels.length > 0) {
    indicators.push({
      type: "sound",
      text: describeSounds(
        soundLabels,
        session.status === FOCUS_STATES.PAUSED_FOCUS,
      ),
    });
  }

  return indicators;
}
