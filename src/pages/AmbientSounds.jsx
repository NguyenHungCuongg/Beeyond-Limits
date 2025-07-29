import React, { useState, useEffect, useCallback } from "react";

/* global chrome */

function AmbientSounds({ onNavigate }) {
  const [sounds, setSounds] = useState({
    bird: { enabled: false, volume: 50, name: "Birds", icon: "🐦" },
    campfire: { enabled: false, volume: 50, name: "Campfire", icon: "🔥" },
    ocean_waves: { enabled: false, volume: 50, name: "Ocean Waves", icon: "🌊" },
    rain: { enabled: false, volume: 50, name: "Rain", icon: "🌧️" },
    thunder: { enabled: false, volume: 50, name: "Thunder", icon: "⛈️" },
    wind: { enabled: false, volume: 50, name: "Wind", icon: "🌬️" },
  });

  // Load saved settings
  const loadSettings = useCallback(async () => {
    if (!chrome?.storage?.local) {
      console.warn("Chrome storage not available - running in dev mode");
      return;
    }

    try {
      const result = await chrome.storage.local.get(["ambientSettings"]);
      if (result.ambientSettings) {
        setSounds((prev) => ({ ...prev, ...result.ambientSettings }));
      }
    } catch (error) {
      console.error("Error loading ambient settings:", error);
    }
  }, []);

  // Save settings
  const saveSettings = useCallback(async (newSounds) => {
    if (!chrome?.storage?.local) {
      console.warn("Chrome storage not available - running in dev mode");
      return;
    }

    try {
      await chrome.storage.local.set({ ambientSettings: newSounds });

      // Send update to background script
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime
          .sendMessage({
            type: "AMBIENT_UPDATE_SETTINGS",
            settings: newSounds,
          })
          .catch((error) => console.error("Error sending ambient settings:", error));
      }
    } catch (error) {
      console.error("Error saving ambient settings:", error);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Toggle sound on/off
  const toggleSound = useCallback(
    (soundKey) => {
      setSounds((prev) => {
        const newSounds = {
          ...prev,
          [soundKey]: {
            ...prev[soundKey],
            enabled: !prev[soundKey].enabled,
          },
        };
        saveSettings(newSounds);
        return newSounds;
      });
    },
    [saveSettings]
  );

  // Change volume
  const changeVolume = useCallback(
    (soundKey, volume) => {
      setSounds((prev) => {
        const newSounds = {
          ...prev,
          [soundKey]: {
            ...prev[soundKey],
            volume: volume,
          },
        };
        saveSettings(newSounds);
        return newSounds;
      });
    },
    [saveSettings]
  );

  // Test sound
  const testSound = useCallback(
    async (soundKey) => {
      if (!chrome?.runtime?.sendMessage) {
        console.warn("Chrome runtime not available - running in dev mode");
        return;
      }

      try {
        await chrome.runtime.sendMessage({
          type: "AMBIENT_TEST_SOUND",
          soundKey: soundKey,
          volume: sounds[soundKey].volume,
        });
      } catch (error) {
        console.error("Error testing sound:", error);
      }
    },
    [sounds]
  );

  // Stop all sounds
  const stopAllSounds = useCallback(async () => {
    if (!chrome?.runtime?.sendMessage) {
      console.warn("Chrome runtime not available - running in dev mode");
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: "AMBIENT_STOP_ALL",
      });

      // Turn off all sounds in UI
      setSounds((prev) => {
        const newSounds = {};
        Object.keys(prev).forEach((key) => {
          newSounds[key] = { ...prev[key], enabled: false };
        });
        saveSettings(newSounds);
        return newSounds;
      });
    } catch (error) {
      console.error("Error stopping sounds:", error);
    }
  }, [saveSettings]);

  return (
    <div className="h-full bg-gradient-to-br from-purple-500 via-violet-500 to-purple-600 font-primary overflow-auto">
      <div className="p-6">
        {/* Header với back button */}
        <div className="flex flex-col items-start mb-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors mr-4"
          >
            ←
          </button>
          <div className="flex-1 text-center self-center">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">Focus Sounds</h1>
            <p className="text-purple-100 text-sm">Nature sounds to enhance your focus 🎵</p>
          </div>
        </div>

        {/* Sound Controls */}
        <div className="space-y-4 mb-6">
          {Object.entries(sounds).map(([soundKey, sound]) => (
            <div key={soundKey} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="text-white text-2xl">{sound.icon}</div>
                  <div>
                    <div className="font-medium text-white">{sound.name}</div>
                    <div className="text-xs text-white/70">Volume: {sound.volume}%</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Test Button */}
                  <button
                    onClick={() => testSound(soundKey)}
                    className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors text-sm"
                    title="Test Sound"
                  >
                    ▶️
                  </button>
                  {/* Toggle Button */}
                  <button
                    onClick={() => toggleSound(soundKey)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 ${
                      sound.enabled ? "bg-white" : "bg-white/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-purple-500 transition ${
                        sound.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Volume Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Volume</span>
                  <span>{sound.volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sound.volume}
                  onChange={(e) => changeVolume(soundKey, parseInt(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${sound.volume}%, rgba(255,255,255,0.2) ${sound.volume}%, rgba(255,255,255,0.2) 100%)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Control Buttons */}
        <div className="space-y-3">
          {/* Debug Test Button */}
          <button
            onClick={() => {
              console.log("Debug: Testing direct audio...");
              const audio = new Audio(chrome.runtime.getURL("audio/rain.m4a"));
              audio.volume = 0.3;
              audio.loop = true;
              audio
                .play()
                .then(() => console.log("Debug: Direct audio playing"))
                .catch((e) => console.error("Debug: Direct audio failed", e));
            }}
            className="w-full bg-yellow-500/20 backdrop-blur-sm text-white font-bold py-3 rounded-xl border-2 border-yellow-400/50 hover:bg-yellow-500/30 transition-all duration-300"
          >
            🔧 Debug: Test Direct Audio
          </button>

          <button
            onClick={stopAllSounds}
            className="w-full bg-white/20 backdrop-blur-sm text-white font-bold py-4 rounded-xl border-2 border-white/30 hover:bg-white/30 transition-all duration-300"
          >
            🔇 Stop All Sounds
          </button>

          <div className="flex space-x-3">
            <button
              onClick={() => onNavigate("home")}
              className="flex-1 bg-white/10 backdrop-blur-sm text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
            >
              🏠 Home
            </button>
          </div>
        </div>
      </div>

      {/* Custom Slider Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}

export default AmbientSounds;
