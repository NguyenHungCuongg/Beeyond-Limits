import React from "react";
import { Play } from "./Icons";

function SavedSessionCard({ template, onStart }) {
  return (
    <button
      onClick={() => onStart(template)}
      className="w-full text-left bg-paper brutal-border brutal-shadow mb-3 flex items-center justify-between p-4 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-none"
    >
      <div className="flex-1">
        <h3 className="font-display text-2xl uppercase leading-none truncate">
          {template.name}
        </h3>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs font-bold uppercase">
          {template.focusDuration}m
        </span>
        <span className="font-mono text-xs font-bold uppercase text-ink/60 max-w-[60px] truncate">
          {template.ambientSound?.enabled && template.ambientSound?.soundId
            ? template.ambientSound.soundId
            : "Quiet"}
        </span>
        <Play size={16} className="text-ink" />
      </div>
    </button>
  );
}

export default SavedSessionCard;
