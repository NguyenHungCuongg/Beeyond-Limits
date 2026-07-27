import React from "react";
import { Lock, Unlock } from "./Icons";

function BlockerStats({ blockedUrls, isBlocking, blocksToday = 0 }) {
  return (
    <div className="bg-paper brutal-border brutal-shadow-sm divide-x-[3px] divide-ink grid grid-cols-3 text-center mb-6">
      <div className="flex flex-col items-center justify-center p-4">
        <div className="font-display text-4xl text-ink">{blockedUrls.length}</div>
        <div className="font-mono text-xs text-ink font-bold uppercase mt-1">Sites</div>
      </div>
      <div className="flex flex-col items-center justify-center p-4 bg-emerald">
        <div className="font-display text-4xl text-ink h-10 flex items-center justify-center">
          {isBlocking ? (
            <Lock size={24} className="text-ink" />
          ) : (
            <Unlock size={24} className="text-ink" />
          )}
        </div>
        <div className="font-mono text-xs text-ink font-bold uppercase mt-1">Status</div>
      </div>
      <div className="flex flex-col items-center justify-center p-4">
        <div className="font-display text-4xl text-ink">{blocksToday}</div>
        <div className="font-mono text-xs text-ink font-bold uppercase mt-1">Blocks</div>
      </div>
    </div>
  );
}

export default BlockerStats;
