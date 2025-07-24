import React from "react";

function Timer({ time, isActive, progress = 0, isBreak = false }) {
  // Format time từ seconds thành MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative w-64 h-64 mx-auto">
      {/* Background Circle */}
      <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30"></div>

      {/* Progress Ring */}
      <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />

        {/* Progress ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 45}`}
          strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress)}`}
          className={`transition-all duration-1000 ${isActive ? "drop-shadow-lg" : ""}`}
          style={{
            filter: isActive ? "drop-shadow(0 0 8px rgba(255,255,255,0.5))" : "none",
          }}
        />
      </svg>

      {/* Time Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <div className="text-4xl font-bold font-mono tracking-wider drop-shadow-lg">{formatTime(time)}</div>
        <div className="text-sm opacity-80 mt-1">{isActive ? (isBreak ? "Break Time" : "Focus Time") : "Ready"}</div>
      </div>

      {/* Pulse Animation when active */}
      {isActive && <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping"></div>}
    </div>
  );
}

export default Timer;
