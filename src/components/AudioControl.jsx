import React from "react";
import { Volume } from "./Icons";

function AudioControl({ onTestAudio }) {
  return (
    <div className="bg-paper brutal-border brutal-shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Volume size={20} className="text-ink" />
          <div>
            <div className="font-mono font-bold uppercase text-ink">
              Audio Notifications
            </div>
            <div className="font-sans text-sm text-ink mt-1">
              Play sounds when switching modes
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onTestAudio}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-canvas text-ink brutal-border brutal-shadow-sm font-mono font-bold uppercase py-2 hover:bg-mustard transition-colors active:translate-y-[2px] active:shadow-none"
      >
        <Volume size={16} /> Test Audio
      </button>
    </div>
  );
}

export default AudioControl;
