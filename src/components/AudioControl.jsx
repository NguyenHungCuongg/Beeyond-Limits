import React from "react";

function AudioControl({ audioEnabled, onAudioToggle, onTestAudio }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="text-white text-xl">🔊</div>
          <div>
            <div className="font-medium text-white">Audio Notifications</div>
            <div className="text-xs text-white/70">Play sounds when switching modes</div>
          </div>
        </div>
        <button
          onClick={onAudioToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 ${
            audioEnabled ? "bg-white" : "bg-white/30"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-red-500 transition ${
              audioEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {audioEnabled && (
        <button
          onClick={onTestAudio}
          className="w-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium py-2 rounded-lg border border-white/30 hover:bg-white/30 transition-colors"
        >
          🎵 Test Audio
        </button>
      )}
    </div>
  );
}

export default AudioControl;
