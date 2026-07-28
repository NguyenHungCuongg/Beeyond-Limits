import React, { useMemo } from "react";
import { aggregateDailyProgress } from "../core/focusSession.js";

function TodayFocusStats({ history = [] }) {
  const stats = useMemo(() => aggregateDailyProgress(history), [history]);

  return (
    <div className="flex flex-col items-end justify-center">
      <div className="font-mono text-xs font-bold uppercase text-ink">
        {stats.completedSessions} Today
      </div>
      <div className="font-display text-2xl uppercase text-ink leading-none">
        {stats.focusMinutes} Min
      </div>
    </div>
  );
}

export default TodayFocusStats;
