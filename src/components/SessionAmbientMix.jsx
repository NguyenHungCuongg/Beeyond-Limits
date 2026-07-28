import toast from "react-hot-toast";
import { Play } from "./Icons";
import VolumeSlider from "./VolumeSlider";
import { AMBIENT_SOUND_IDS } from "../core/focusSession.js";

const SOUND_LABELS = Object.freeze({
  bird: "Birds",
  campfire: "Campfire",
  ocean_waves: "Ocean waves",
  rain: "Rain",
  thunder: "Thunder",
  wind: "Wind",
});

function buildSounds(currentSounds = {}) {
  return Object.fromEntries(
    AMBIENT_SOUND_IDS.map((id) => [
      id,
      {
        enabled: Boolean(currentSounds[id]?.enabled),
        volume: currentSounds[id]?.volume ?? 50,
      },
    ]),
  );
}

export default function SessionAmbientMix({
  ambientSound,
  onChange,
  onTestSound,
}) {
  const sounds = buildSounds(ambientSound.sounds);

  function updateSound(soundId, patch) {
    const nextSounds = {
      ...sounds,
      [soundId]: { ...sounds[soundId], ...patch },
    };
    onChange({
      ...ambientSound,
      enabled: Object.values(nextSounds).some((sound) => sound.enabled),
      sounds: nextSounds,
    });
  }

  async function testSound(soundId) {
    try {
      await onTestSound(soundId, sounds[soundId].volume);
    } catch (error) {
      console.error("Unable to test Focus Session ambient sound:", error);
      toast.error(error.message || "Unable to test sound");
    }
  }

  return (
    <div className="mt-4 pl-7 space-y-3">
      <p className="font-mono text-[10px] font-bold uppercase text-ink/70">
        Build your mix — enable as many sounds as you need.
      </p>

      <div className="space-y-2">
        {AMBIENT_SOUND_IDS.map((soundId) => {
          const sound = sounds[soundId];
          const inputId = `session-${soundId}-volume`;
          return (
            <div key={soundId} className="border-2 border-ink bg-canvas p-2">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={`session-${soundId}-enabled`}
                  className="flex items-center gap-2 font-mono text-xs font-bold uppercase cursor-pointer"
                >
                  <input
                    id={`session-${soundId}-enabled`}
                    type="checkbox"
                    checked={sound.enabled}
                    onChange={(event) =>
                      updateSound(soundId, { enabled: event.target.checked })
                    }
                    className="h-4 w-4 accent-emerald"
                  />
                  {SOUND_LABELS[soundId]}
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold">
                    {sound.volume}%
                  </span>
                  <button
                    type="button"
                    onClick={() => testSound(soundId)}
                    aria-label={`Test ${SOUND_LABELS[soundId]} sound at ${sound.volume}% volume`}
                    className="flex h-8 w-8 items-center justify-center brutal-border bg-canvas text-ink transition-colors hover:bg-emerald"
                  >
                    <Play size={16} className="fill-ink" />
                  </button>
                </div>
              </div>
              {sound.enabled && (
                <div className="mt-2">
                  <VolumeSlider
                    id={inputId}
                    value={sound.volume}
                    onChange={(volume) => updateSound(soundId, { volume })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
