import React from "react";
import { ShieldCheck, Headphones } from "./Icons";
import SessionAmbientMix from "./SessionAmbientMix";

export default function SessionEnvironment({
  blocker,
  ambientSound,
  onBlockerChange,
  onAmbientChange,
  onTestAmbientSound,
  onEditBlocklist,
}) {
  const domainCount = Array.isArray(blocker.blockedUrls)
    ? blocker.blockedUrls.length
    : 0;

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
          <SessionAmbientMix
            ambientSound={ambientSound}
            onChange={onAmbientChange}
            onTestSound={onTestAmbientSound}
          />
        )}
      </div>
    </fieldset>
  );
}
