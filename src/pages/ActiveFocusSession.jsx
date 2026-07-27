import { useEffect, useState } from "react";
import { Ban, Home, Pause, Play } from "../components/Icons";
import { FOCUS_PHASES, FOCUS_STATES } from "../core/focusSession.js";

function getRemainingSeconds(session, now = Date.now()) {
  if (!session) return 0;
  if (
    session.status === FOCUS_STATES.PAUSED_FOCUS ||
    session.status === FOCUS_STATES.PAUSED_BREAK
  ) {
    return Math.max(0, Math.ceil(session.remainingSeconds || 0));
  }
  if (session.phaseEndsAt) {
    return Math.max(0, Math.ceil((session.phaseEndsAt - now) / 1000));
  }
  return 0;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0")
  );
}

function ActiveFocusSession({ onNavigate, focusSession }) {
  const session = focusSession.activeSession;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  if (!session) {
    return (
      <div className="bg-canvas min-h-screen text-ink p-5 flex flex-col justify-center">
        <h1 className="font-display text-5xl uppercase">No active session</h1>
        <button
          type="button"
          onClick={() => onNavigate("focus-setup")}
          className="mt-5 bg-mustard brutal-border brutal-shadow font-display text-xl uppercase py-3"
        >
          Start a session
        </button>
      </div>
    );
  }

  const remaining = getRemainingSeconds(session, now);
  const isPaused =
    session.status === FOCUS_STATES.PAUSED_FOCUS ||
    session.status === FOCUS_STATES.PAUSED_BREAK;
  const isBreak = session.phase === FOCUS_PHASES.BREAK;
  const isComplete =
    session.status === FOCUS_STATES.FOCUS_COMPLETED ||
    session.status === FOCUS_STATES.BREAK_COMPLETED;
  const goal = session.goal?.text || "Focused work";

  async function togglePause() {
    try {
      if (isPaused) {
        await focusSession.resumeSession(session.id);
      } else {
        await focusSession.pauseSession(session.id);
      }
    } catch {
      // Error is rendered by the shared hook.
    }
  }

  async function stopEarly() {
    if (
      !window.confirm(
        "Stop this focus session? It will not count as completed.",
      )
    ) {
      return;
    }
    try {
      await focusSession.abandonSession(session.id);
      onNavigate("home");
    } catch {
      // Error is rendered by the shared hook.
    }
  }

  if (isComplete) {
    return (
      <div className="bg-canvas min-h-screen text-ink p-5 flex flex-col justify-center">
        <p className="font-mono text-xs font-bold uppercase mb-2">
          Focus complete
        </p>
        <h1 className="font-display text-5xl uppercase leading-none">{goal}</h1>
        <button
          type="button"
          onClick={() => onNavigate("focus-complete")}
          className="mt-6 bg-mustard brutal-border brutal-shadow font-display text-xl uppercase py-3"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="bg-canvas min-h-screen text-ink p-5">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-5">
          <p className="font-mono text-xs font-bold uppercase">
            {isBreak ? "Break" : "Focus Session"}
          </p>
          <span className="font-mono text-xs font-bold uppercase" role="status">
            {isPaused ? "Paused" : "Active"}
          </span>
        </div>

        <h1 className="font-display text-4xl uppercase leading-none mb-6 break-words">
          {goal}
        </h1>

        <div className="bg-paper brutal-border brutal-shadow w-full aspect-square max-w-xs mx-auto flex flex-col items-center justify-center">
          <div
            role="timer"
            aria-label={formatTime(remaining) + " remaining"}
            className="font-display text-7xl tabular-nums"
          >
            {formatTime(remaining)}
          </div>
          <p className="font-mono text-xs font-bold uppercase mt-2">
            {isBreak ? "Break Time" : isPaused ? "Paused" : "Focus Time"}
          </p>
        </div>

        <div className="flex gap-2 mt-6 mb-5">
          {session.blocker?.enabled && (
            <span className="flex-1 bg-emerald text-paper brutal-border-light p-2 font-mono text-[11px] font-bold uppercase text-center">
              Blocker {isPaused ? "still blocking" : "on"}
            </span>
          )}
          {session.ambientSound?.enabled && (
            <span className="flex-1 bg-sapphire text-paper brutal-border-light p-2 font-mono text-[11px] font-bold uppercase text-center">
              Sound {isPaused ? "paused" : "on"}
            </span>
          )}
        </div>

        {focusSession.error && (
          <div
            role="alert"
            className="brutal-border bg-crimson text-paper p-3 font-mono text-xs mb-4"
          >
            {focusSession.error}
          </div>
        )}

        <button
          type="button"
          disabled={focusSession.isBusy}
          onClick={togglePause}
          className="w-full bg-mustard brutal-border brutal-shadow font-display text-2xl uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isPaused ? <Play size={22} /> : <Pause size={22} />}
          {isPaused ? "Resume Focus" : "Pause"}
        </button>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            onClick={stopEarly}
            disabled={focusSession.isBusy}
            className="bg-crimson text-paper brutal-border-light font-mono font-bold uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Ban size={15} /> Stop Early
          </button>
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="bg-paper brutal-border brutal-shadow-sm font-mono font-bold uppercase py-3 flex items-center justify-center gap-2"
          >
            <Home size={15} /> Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActiveFocusSession;
