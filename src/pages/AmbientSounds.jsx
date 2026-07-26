import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

/* global chrome */

const extensionApi = typeof chrome !== "undefined" ? chrome : null;
const SOUND_METADATA = Object.freeze({
  bird: { name: "Birds", icon: "🐦" },
  campfire: { name: "Campfire", icon: "🔥" },
  ocean_waves: { name: "Ocean Waves", icon: "🌊" },
  rain: { name: "Rain", icon: "🌧️" },
  thunder: { name: "Thunder", icon: "⛈️" },
  wind: { name: "Wind", icon: "🌬️" },
});

function mergeSettings(settings = {}) {
  return Object.fromEntries(
    Object.entries(SOUND_METADATA).map(([soundKey, metadata]) => [
      soundKey,
      {
        ...metadata,
        enabled: Boolean(settings[soundKey]?.enabled),
        volume: Number.isFinite(settings[soundKey]?.volume)
          ? settings[soundKey].volume
          : 50,
      },
    ]),
  );
}

function AmbientSounds({ onNavigate }) {
  const [sounds, setSounds] = useState(() => mergeSettings());
  const [isSaving, setIsSaving] = useState(false);
  const volumeTimerRef = useRef(null);

  const soundsRef = useRef(sounds);
  const sendSettings = useCallback(async (nextSounds, previousSounds) => {
    if (!extensionApi?.runtime?.sendMessage) {
      setSounds(nextSounds);
      return true;
    }

    try {
      const response = await extensionApi.runtime.sendMessage({
        type: "AMBIENT_UPDATE_SETTINGS",
        settings: nextSounds,
      });
      if (!response?.success) {
        throw new Error(response?.error || "Unable to update ambient sounds");
      }
      setSounds(mergeSettings(response.settings));
      return true;
    } catch (error) {
      setSounds(previousSounds);
      console.error("Unable to update ambient sounds:", error);
      toast.error(error.message);
      return false;
    }
  }, []);

  useEffect(() => {
    async function loadSettings() {
      if (!extensionApi?.storage?.local) return;
      try {
        const result = await extensionApi.storage.local.get([
          "ambientSettings",
        ]);
        setSounds(mergeSettings(result.ambientSettings));
      } catch (error) {
        console.error("Unable to load ambient settings:", error);
        toast.error("Could not load ambient sound settings");
      }
    }

    loadSettings();
    return () => clearTimeout(volumeTimerRef.current);
  }, []);

  useEffect(() => {
    soundsRef.current = sounds;
  }, [sounds]);

  async function toggleSound(soundKey) {
    const previousSounds = sounds;
    const nextSounds = {
      ...sounds,
      [soundKey]: {
        ...sounds[soundKey],
        enabled: !sounds[soundKey].enabled,
      },
    };
    setSounds(nextSounds);
    soundsRef.current = nextSounds;
    setIsSaving(true);
    await sendSettings(nextSounds, previousSounds);
    setIsSaving(false);
  }

  function changeVolume(soundKey, volume) {
    const nextSounds = {
      ...sounds,
      [soundKey]: { ...sounds[soundKey], volume },
    };
    setSounds(nextSounds);

    soundsRef.current = nextSounds;
    clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => {
      sendSettings(soundsRef.current, soundsRef.current);
    }, 150);
  }

  async function testSound(soundKey) {
    try {
      const response = await extensionApi.runtime.sendMessage({
        type: "AMBIENT_TEST_SOUND",
        soundKey,
        volume: sounds[soundKey].volume,
      });
      if (!response?.success) {
        throw new Error(response?.error || "Unable to test sound");
      }
    } catch (error) {
      console.error("Unable to test ambient sound:", error);
      toast.error(error.message);
    }
  }

  async function stopAllSounds() {
    setIsSaving(true);
    try {
      const response = await extensionApi.runtime.sendMessage({
        type: "AMBIENT_STOP_ALL",
      });
      if (!response?.success) {
        throw new Error(response?.error || "Unable to stop sounds");
      }
      setSounds(mergeSettings(response.settings));
    } catch (error) {
      console.error("Unable to stop ambient sounds:", error);
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-purple-500 via-violet-500 to-purple-600 font-primary">
      <div className="p-6">
        <div className="mb-6 flex flex-col items-start">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-label="Back to home"
            className="mr-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ←
          </button>
          <div className="flex-1 self-center text-center">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              Ambient Sounds
            </h1>
            <p className="text-sm text-purple-100">
              Nature sounds to enhance your focus 🎵
            </p>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          {Object.entries(sounds).map(([soundKey, sound]) => (
            <section
              key={soundKey}
              aria-labelledby={`${soundKey}-name`}
              className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div aria-hidden="true" className="text-2xl text-white">
                    {sound.icon}
                  </div>
                  <div>
                    <h2
                      id={`${soundKey}-name`}
                      className="font-medium text-white"
                    >
                      {sound.name}
                    </h2>
                    <div className="text-xs text-white/70">
                      Volume: {sound.volume}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => testSound(soundKey)}
                    aria-label={`Test ${sound.name} sound`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    ▶️
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sound.enabled}
                    aria-label={`${sound.name} ambient sound`}
                    disabled={isSaving}
                    onClick={() => toggleSound(soundKey)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
                      sound.enabled ? "bg-white" : "bg-white/30"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-4 w-4 transform rounded-full bg-purple-500 transition ${
                        sound.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <label
                htmlFor={`${soundKey}-volume`}
                className="mb-2 flex items-center justify-between text-xs text-white/70"
              >
                <span>Volume</span>
                <span>{sound.volume}%</span>
              </label>
              <input
                id={`${soundKey}-volume`}
                type="range"
                min="0"
                max="100"
                value={sound.volume}
                onChange={(event) =>
                  changeVolume(soundKey, Number(event.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{
                  background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${sound.volume}%, rgba(255,255,255,0.2) ${sound.volume}%, rgba(255,255,255,0.2) 100%)`,
                }}
              />
            </section>
          ))}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={stopAllSounds}
            className="w-full rounded-xl border-2 border-white/30 bg-white/20 py-4 font-bold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-60"
          >
            🔇 Stop All Sounds
          </button>
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="w-full rounded-xl border border-white/20 bg-white/10 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default AmbientSounds;
