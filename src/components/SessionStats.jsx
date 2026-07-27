import React from "react";

function SessionStats({ sessionCount, isBreak, currentTime }) {
  return (
    <div className="bg-paper brutal-border brutal-shadow-sm p-4 grid grid-cols-3 divide-x-[3px] divide-ink text-center mb-6">
      <div className="flex flex-col items-center justify-center">
        <div className="font-display text-4xl text-ink leading-none">{sessionCount}</div>
        <div className="font-mono text-[10px] font-bold uppercase text-ink mt-2">Completed</div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <div className="font-display text-4xl text-ink leading-none">{isBreak ? "Break" : "Focus"}</div>
        <div className="font-mono text-[10px] font-bold uppercase text-ink mt-2">Mode</div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <div className="font-display text-4xl text-ink leading-none">{Math.ceil(currentTime / 60)}</div>
        <div className="font-mono text-[10px] font-bold uppercase text-ink mt-2">Min Left</div>
      </div>
    </div>
  );
}

export default SessionStats;
