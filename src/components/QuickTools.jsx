import React from "react";
import { Clock, ShieldCheck, ClipboardCheck, Headphones, Lock } from "./Icons";

function QuickTools({ onNavigate, activeSession = null }) {
  const isPomodoroLocked = Boolean(activeSession);
  const tools = [
    {
      id: "pomodoro",
      label: "Timer",
      Icon: Clock,
      locked: isPomodoroLocked,
    },
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
            type="button"
            disabled={t.locked}
            onClick={() => onNavigate(t.id)}
            aria-label={
              t.locked
                ? `${t.label} locked while Focus Session is running`
                : t.label
            }
            title={
              t.locked
                ? "Timer is controlled by the active Focus Session"
                : t.label
            }
            className={`relative bg-paper brutal-border brutal-shadow-sm flex flex-col items-center justify-center p-3 transition-colors ${
              t.locked
                ? "cursor-not-allowed bg-canvas opacity-60 shadow-none"
                : "hover:bg-mustard hover:text-ink active:translate-y-1 active:shadow-none"
            }`}
          >
            {t.locked && (
              <Lock
                size={12}
                aria-hidden="true"
                className="absolute right-1 top-1"
              />
            )}
            <t.Icon size={24} className="mb-2" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-tight">
              {t.label}
            </span>
          </button>
        ))}
      </div>
      {isPomodoroLocked && (
        <p
          role="status"
          className="mt-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase text-ink/70"
        >
          <Lock size={12} aria-hidden="true" />
          Timer locked during Focus Session
        </p>
      )}
    </div>
  );
}

export default QuickTools;
