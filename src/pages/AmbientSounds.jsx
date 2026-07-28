import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Feather, Flame, Waves, CloudRain, Zap, Wind, ChevronLeft, Home, Play, VolumeX } from "../components/Icons";
import VolumeSlider from "../components/VolumeSlider";

/* global chrome */

const extensionApi = typeof chrome !== "undefined" ? chrome : null;
const SOUND_METADATA = Object.freeze({
  bird: { name: "Birds", Icon: Feather },
  campfire: { name: "Campfire", Icon: Flame },
  ocean_waves: { name: "Ocean Waves", Icon: Waves },
  rain: { name: "Rain", Icon: CloudRain },
  thunder: { name: "Thunder", Icon: Zap },
  wind: { name: "Wind", Icon: Wind },
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
    <div className="min-h-screen bg-canvas text-ink p-5 overflow-auto">
      <div className="mb-6 flex flex-col items-start">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          aria-label="Back to home"
          className="flex items-center gap-1.5 text-ink font-mono uppercase font-bold hover:bg-ink hover:text-canvas px-2 py-1 border-[3px] border-transparent hover:border-ink transition-colors mb-4"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="font-display text-6xl uppercase tracking-tight leading-none mb-2 text-ink">
          Ambient Sounds
        </h1>
      </div>

      <div className="space-y-4">
        {Object.entries(sounds).map(([soundKey, sound]) => (
          <section
            key={soundKey}
            aria-labelledby={`${soundKey}-name`}
            className="bg-paper brutal-border brutal-shadow-sm p-4 mb-3 flex flex-col"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 brutal-border bg-emerald flex items-center justify-center shrink-0">
                  <sound.Icon size={20} className="text-ink" />
                </div>
                <h2
                  id={`${soundKey}-name`}
                  className="font-display text-3xl uppercase text-ink"
                >
                  {sound.name}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => testSound(soundKey)}
                  aria-label={`Test ${sound.name} sound`}
                  className="w-8 h-8 brutal-border bg-canvas flex items-center justify-center text-ink hover:bg-emerald transition-colors"
                >
                  <Play size={16} className="fill-ink" />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sound.enabled}
                  aria-label={`${sound.name} ambient sound`}
                  disabled={isSaving}
                  onClick={() => toggleSound(soundKey)}
                  className={`relative inline-flex h-8 w-14 items-center brutal-border transition-colors cursor-pointer disabled:opacity-60 ${
                    sound.enabled ? "bg-emerald" : "bg-canvas"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 brutal-border transform transition-transform ${
                      sound.enabled ? "translate-x-[24px] bg-paper" : "translate-x-1 bg-ink"
                    }`}
                  />
                </button>
              </div>
            </div>

            <VolumeSlider
              id={`${soundKey}-volume`}
              value={sound.volume}
              onChange={(value) => changeVolume(soundKey, value)}
            />
          </section>
        ))}
      </div>

      <div className="space-y-4 mt-8">
        <button
          type="button"
          disabled={isSaving}
          onClick={stopAllSounds}
          className="bg-ink text-paper brutal-border font-display text-2xl uppercase py-3 w-full hover:bg-crimson hover:text-ink hover:brutal-shadow-sm transition-all"
        >
          Stop All Sounds
        </button>
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="bg-paper text-ink brutal-border font-display text-2xl uppercase py-3 w-full flex items-center justify-center gap-2 hover:bg-emerald hover:brutal-shadow-sm transition-all"
        >
          <Home size={20} /> Home
        </button>
      </div>
    </div>
  );
}

export default AmbientSounds;
