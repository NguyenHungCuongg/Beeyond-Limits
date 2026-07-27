import React from "react";

function Timer({ time, isActive, progress = 0, isBreak = false }) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressFraction = progress / 100;

  return (
    <div className="bg-paper brutal-border brutal-shadow w-64 h-64 mx-auto flex flex-col items-center justify-center relative">
      {/* Progress Ring */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          className="stroke-ink opacity-10"
          strokeWidth="6"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          className="stroke-mustard transition-all duration-1000"
          strokeWidth="6"
          strokeLinecap="square"
          strokeDasharray={`${2 * Math.PI * 42}`}
          strokeDashoffset={`${2 * Math.PI * 42 * (1 - progressFraction)}`}
        />
      </svg>

      <div className="flex flex-col items-center justify-center z-10">
        <div
          role="timer"
          aria-label={`${formatTime(time)} remaining`}
          className="font-display text-7xl text-ink tracking-tight"
        >
          {formatTime(time)}
        </div>
        <div className="font-mono font-bold uppercase text-sm text-ink mt-2">
          {isActive ? (isBreak ? "Break Time" : "Focus Time") : "Ready"}
        </div>
      </div>
    </div>
  );
}

export default Timer;
