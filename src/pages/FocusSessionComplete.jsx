import { Coffee, Home, Check } from "../components/Icons";
import { FOCUS_STATES } from "../core/focusSession.js";

function FocusSessionComplete({ onNavigate, focusSession }) {
  const session = focusSession.activeSession;

  if (!session || session.status === FOCUS_STATES.ABANDONED) {
    return (
      <div className="bg-canvas min-h-screen text-ink p-5 flex flex-col justify-center">
        <h1 className="font-display text-5xl uppercase">Session closed</h1>
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="mt-5 bg-mustard brutal-border brutal-shadow font-display text-xl uppercase py-3"
        >
          Back Home
        </button>
      </div>
    );
  }

  const isBreakComplete = session.status === FOCUS_STATES.BREAK_COMPLETED;
  const goal = session.goal?.text || "Focused work";
  const minutes = session.snapshot?.focusDuration || 25;

  async function startBreak() {
    try {
      await focusSession.startBreak(
        session.id,
        session.snapshot?.breakDuration,
      );
      onNavigate("focus-active");
    } catch {
      // Error is rendered below.
    }
  }

  async function finish() {
    try {
      await focusSession.skipBreak(session.id);
      onNavigate("home");
    } catch {
      // Error is rendered below.
    }
  }

  return (
    <div className="bg-canvas min-h-screen text-ink p-5 flex flex-col justify-center">
      <div className="max-w-md mx-auto w-full">
        <p className="font-mono text-xs font-bold uppercase mb-2">
          {isBreakComplete ? "Break complete" : "Focus complete"}
        </p>
        <h1 className="font-display text-6xl uppercase leading-none mb-3">
          {isBreakComplete ? "Ready again?" : "Nice work."}
        </h1>
        <p className="font-mono font-bold uppercase text-sm mb-6 break-words">
          {goal}
        </p>

        {!isBreakComplete && (
          <div className="bg-paper brutal-border brutal-shadow p-5 mb-6 text-center">
            <span className="font-display text-6xl">{minutes}</span>
            <span className="font-mono text-xs font-bold uppercase block">
              Minutes focused
            </span>
          </div>
        )}

        {focusSession.error && (
          <div
            role="alert"
            className="brutal-border bg-crimson text-paper p-3 font-mono text-xs mb-4"
          >
            {focusSession.error}
          </div>
        )}

        {!isBreakComplete && (
          <button
            type="button"
            onClick={startBreak}
            disabled={focusSession.isBusy}
            className="w-full bg-mustard brutal-border brutal-shadow font-display text-2xl uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Coffee size={22} /> Start {session.snapshot?.breakDuration || 5}{" "}
            Min Break
          </button>
        )}
        <button
          type="button"
          onClick={finish}
          disabled={focusSession.isBusy}
          className="w-full mt-3 bg-paper brutal-border brutal-shadow-sm font-mono font-bold uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isBreakComplete ? <Check size={16} /> : <Home size={16} />}
          {isBreakComplete ? "Finish Break" : "Finish for Now"}
        </button>
      </div>
    </div>
  );
}

export default FocusSessionComplete;
