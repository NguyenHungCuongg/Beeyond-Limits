import React from "react";

function BlockerStats({ blockedUrls, isBlocking, blocksToday = 0 }) {
  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
      <div className="text-center text-white mb-3">
        <h3 className="font-medium text-sm opacity-80">Blocking Stats</h3>
      </div>
      <div className="flex justify-between items-center text-white">
        <div className="text-center flex-1">
          <div className="text-lg font-bold">{blockedUrls.length}</div>
          <div className="text-xs opacity-80">Sites Blocked</div>
        </div>
        <div className="w-px h-8 bg-white/30"></div>
        <div className="text-center flex-1">
          <div className="text-lg font-bold">{isBlocking ? "🔒" : "🔓"}</div>
          <div className="text-xs opacity-80">Status</div>
        </div>
        <div className="w-px h-8 bg-white/30"></div>
        <div className="text-center flex-1">
          <div className="text-lg font-bold">{blocksToday}</div>
          <div className="text-xs opacity-80">Blocks Today</div>
        </div>
      </div>
    </div>
  );
}

export default BlockerStats;
