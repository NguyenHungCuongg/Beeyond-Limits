import React, { useEffect } from "react";
import { ShieldCheck, Headphones } from "./Icons";
import VolumeSlider from "./VolumeSlider";
import { AMBIENT_SOUND_IDS } from "../core/focusSession.js";

const AMBIENT_SOUNDS = AMBIENT_SOUND_IDS.map((id) => ({
  id,
  label: id
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
}));

export default function SessionEnvironment({
  blocker,
  ambientSound,
  onBlockerChange,
  onAmbientChange,
  onEditBlocklist,
}) {
  const domainCount = Array.isArray(blocker.blockedUrls) ? blocker.blockedUrls.length : 0;

  // Initialize soundId if not set when enabled
  useEffect(() => {
    if (ambientSound.enabled && !ambientSound.soundId) {
      onAmbientChange({ ...ambientSound, soundId: "rain" });
    }
  }, [
    ambientSound.enabled,
    ambientSound.soundId,
    onAmbientChange,
    ambientSound,
  ]);

  const handleSoundSelect = (e) => {
    onAmbientChange({ ...ambientSound, soundId: e.target.value });
  };

  return (
    <fieldset className="brutal-border bg-paper mb-5">
      <legend className="sr-only">Focus environment</legend>

      {/* Blocker */}
      <div className="p-3 border-b-[3px] border-ink">
        <label className="flex items-center justify-between gap-3 mb-2 cursor-pointer">
          <span className="flex items-center gap-2 font-mono font-bold uppercase text-xs">
            <ShieldCheck size={18} /> Website blocker
          </span>
          <input
            type="checkbox"
            checked={blocker.enabled}
            onChange={(e) =>
              onBlockerChange({ ...blocker, enabled: e.target.checked })
            }
            className="h-5 w-5 accent-emerald cursor-pointer"
          />
        </label>
        <div className="font-mono text-xs pl-7">
          {domainCount === 0 ? (
            <span className="text-crimson font-bold">
              No sites configured.{" "}
              <button
                type="button"
                onClick={onEditBlocklist}
                className="underline ml-1"
              >
                Add sites
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>{domainCount} distracting sites</span>
              <button
                type="button"
                onClick={onEditBlocklist}
                className="underline text-sapphire font-bold"
              >
                Manage sites
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Ambient Sound */}
      <div className="p-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-2 font-mono font-bold uppercase text-xs">
            <Headphones size={18} /> Ambient sound
          </span>
          <input
            type="checkbox"
            checked={ambientSound.enabled}
            onChange={(e) =>
              onAmbientChange({ ...ambientSound, enabled: e.target.checked })
            }
            className="h-5 w-5 accent-emerald cursor-pointer"
          />
        </label>

        {ambientSound.enabled && (
          <div className="mt-4 pl-7 space-y-3">
            <select
              value={ambientSound.soundId || "rain"}
              onChange={handleSoundSelect}
              className="w-full brutal-border brutal-shadow-sm px-2 py-2 bg-canvas font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ink cursor-pointer"
            >
              {AMBIENT_SOUNDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold uppercase w-12">
                Vol
              </span>
              <div className="flex-1 mt-1">
                <VolumeSlider
                  id="ambient-volume"
                  value={ambientSound.volume}
                  onChange={(volume) =>
                    onAmbientChange({ ...ambientSound, volume })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </fieldset>
  );
}
