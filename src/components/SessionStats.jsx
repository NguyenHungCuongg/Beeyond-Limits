import React from "react";

function SessionStats({ sessionCount, isBreak, currentTime }) {
  return (
    <div className="mb-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
      <div className="text-center text-white">
        <div className="text-sm opacity-80 mb-1">Current Session</div>
        <div className="flex justify-center space-x-6">
          <div>
            <div className="font-bold text-lg">{sessionCount}</div>
            <div className="text-xs opacity-70">Completed</div>
          </div>
          <div>
            <div className="font-bold text-lg">{isBreak ? "Break" : "Focus"}</div>
            <div className="text-xs opacity-70">Mode</div>
          </div>
          <div>
            <div className="font-bold text-lg">{Math.ceil(currentTime / 60)}</div>
            <div className="text-xs opacity-70">Min Left</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SessionStats;
