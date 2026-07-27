import React from "react";
import { Volume } from "./Icons";

function AudioControl({ audioEnabled, onAudioToggle, onTestAudio }) {
  return (
    <div className="bg-cream/5 border border-cream/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <Volume size={18} className="text-honey" />
          <div>
            <div className="text-cream text-sm font-medium">Audio Notifications</div>
            <div className="text-xs text-warm">
              Play sounds when switching modes
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={audioEnabled}
          aria-label="Audio notifications"
          onClick={onAudioToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-honey focus:ring-offset-2 focus:ring-offset-hive-deep ${
            audioEnabled ? "bg-honey" : "bg-cream/[0.12]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-4 w-4 transform rounded-full transition ${
              audioEnabled ? "translate-x-6 bg-hive-deep" : "translate-x-1 bg-warm"
            }`}
          />
        </button>
      </div>
      {audioEnabled && (
        <button
          type="button"
          onClick={onTestAudio}
          className="w-full flex items-center justify-center gap-2 bg-cream/5 text-cream text-sm py-2 rounded-lg border border-cream/10 hover:bg-cream/10 active:scale-[0.98] transition-all"
        >
          <Volume size={14} /> Test Audio
        </button>
      )}
    </div>
  );
}

export default AudioControl;
