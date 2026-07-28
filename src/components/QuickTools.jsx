import React from "react";
import { Clock, ShieldCheck, ClipboardCheck, Headphones } from "./Icons";

function QuickTools({ onNavigate }) {
  const tools = [
    { id: "pomodoro", label: "Timer", Icon: Clock },
    { id: "tasklist", label: "Tasks", Icon: ClipboardCheck },
    { id: "websiteblocker", label: "Block", Icon: ShieldCheck },
    { id: "ambientsounds", label: "Sounds", Icon: Headphones },
  ];

  return (
    <div className="mb-8">
      <div className="font-mono text-xs font-bold uppercase mb-3">
        Quick Tools
      </div>
      <div className="grid grid-cols-4 gap-2">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => onNavigate(t.id)}
            className="bg-paper brutal-border brutal-shadow-sm flex flex-col items-center justify-center p-3 hover:bg-mustard hover:text-ink transition-colors active:translate-y-1 active:shadow-none"
          >
            <t.Icon size={24} className="mb-2" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-tight">
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickTools;
