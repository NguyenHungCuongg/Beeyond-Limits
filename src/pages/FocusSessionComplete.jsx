import React, { useState } from "react";
import { Coffee, Check, Save } from "../components/Icons";

export default function FocusSessionComplete({
  onNavigate,
  onStartFocus,
  focusSession,
}) {
  const session = focusSession.activeSession;

  const [taskMarked, setTaskMarked] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  if (!session) {
    return (
      <div className="bg-canvas min-h-screen text-ink p-5 flex items-center justify-center">
        <button
          onClick={() => onNavigate("home")}
          className="bg-mustard p-4 brutal-border font-bold uppercase"
        >
          Return Home
        </button>
      </div>
    );
  }

  const isBreakCompleted = session.status === "break_completed";
  const focusMinutes = session.snapshot?.focusDuration || 25;
  const breakMinutes = session.snapshot?.breakDuration || 5;

  const todayProgress = focusSession.progress || {
    completedSessions: 0,
    focusMinutes: 0,
  };
  const goal = session.goal || { type: "text", text: "Focused work" };
  const hasLinkedTask = goal.type === "task" && goal.taskId;

  // Only show save setup if this session was not started from a template
  const canSaveTemplate = !session.templateId;

  async function handleMarkTask() {
    if (hasLinkedTask && !taskMarked) {
      try {
        await focusSession.completeTask(goal.taskId);
        setTaskMarked(true);
      } catch {
        // Error is handled by hook
      }
    }
  }

  async function handleStartBreak() {
    try {
      await focusSession.startBreak(session.id, breakMinutes);
      onNavigate("focus-active");
    } catch {
      // Error is handled by hook
    }
  }

  async function handleFinish() {
    try {
      await focusSession.finishSession(session.id);
      onNavigate("home");
    } catch {
      // Error is handled by hook
    }
  }

  async function handleStopAlarm() {
    try {
      await focusSession.stopAlarm();
    } catch {
      // ignore
    }
  }

  async function handleSaveTemplate(e) {
    e.preventDefault();
    if (!templateName.trim()) return;
    try {
      await focusSession.saveTemplate({
        name: templateName.trim(),
        focusDuration: session.snapshot.focusDuration,
        breakDuration: session.snapshot.breakDuration,
        goal: session.snapshot.goal,
        blocker: session.snapshot.blocker,
        ambientSound: session.snapshot.ambientSound,
      });
      setShowSaveTemplate(false);
    } catch {
      // Error is handled by hook
    }
  }

  return (
    <div className="bg-canvas min-h-screen text-ink p-5 flex flex-col pb-20">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <p className="font-mono text-xs font-bold uppercase text-emerald mb-2 tracking-widest">
            {isBreakCompleted ? "Break Complete" : "Focus Complete"}
          </p>
          <h1 className="font-display text-6xl uppercase leading-none mb-4 text-emerald">
            {isBreakCompleted ? `${breakMinutes} Min` : `${focusMinutes} Min`}
          </h1>
          <p className="font-mono font-bold text-xl break-words line-clamp-3">
            {isBreakCompleted ? "Time to focus again?" : goal.text}
          </p>
        </div>

        <div className="bg-paper brutal-border brutal-shadow-sm py-3 px-4 flex items-center justify-center gap-3 mb-8 font-mono text-sm font-bold uppercase">
          <span>Today:</span>
          <span className="text-emerald">
            {todayProgress.completedSessions} Sessions
          </span>
          <span>·</span>
          <span className="text-sapphire">
            {todayProgress.focusMinutes} Min
          </span>
        </div>

        {hasLinkedTask && !isBreakCompleted && (
          <div className="mb-6">
            <button
              type="button"
              disabled={taskMarked || focusSession.isBusy}
              onClick={handleMarkTask}
              className={`w-full brutal-border p-4 flex items-center gap-3 font-mono text-sm font-bold uppercase transition-colors text-left ${
                taskMarked
                  ? "bg-emerald text-paper"
                  : "bg-paper text-ink hover:bg-canvas"
              }`}
            >
              <div
                className={`w-6 h-6 border-2 flex items-center justify-center ${taskMarked ? "border-paper" : "border-ink"}`}
              >
                {taskMarked && <Check size={16} />}
              </div>
              <span className="flex-1">
                {taskMarked ? "Task Completed!" : "Mark Linked Task Complete"}
              </span>
            </button>
          </div>
        )}

        {focusSession.error && (
          <div
            role="alert"
            className="brutal-border bg-crimson text-paper p-3 font-mono text-xs mb-6"
          >
            {focusSession.error}
          </div>
        )}

        <div className="space-y-3 mb-8">
          <button
            type="button"
            onClick={handleStopAlarm}
            disabled={focusSession.isBusy}
            className="w-full bg-canvas text-emerald brutal-border-light font-mono font-bold uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-paper transition-colors"
          >
            Mute Alarm
          </button>

          {!isBreakCompleted ? (
            <button
              type="button"
              disabled={focusSession.isBusy}
              onClick={handleStartBreak}
              className="w-full bg-sapphire text-paper brutal-border brutal-shadow font-display text-2xl uppercase py-4 flex items-center justify-center gap-2 hover:bg-ink transition-colors disabled:opacity-50"
            >
              <Coffee size={22} /> Start {breakMinutes} Min Break
            </button>
          ) : (
            <button
              type="button"
              disabled={focusSession.isBusy}
              onClick={async () => {
                try {
                  await focusSession.finishSession(session.id);
                  onStartFocus();
                } catch {
                  // Error is handled by the shared hook.
                }
              }}
              className="w-full bg-mustard text-ink brutal-border brutal-shadow font-display text-2xl uppercase py-4 flex items-center justify-center gap-2 hover:bg-ink hover:text-mustard transition-colors disabled:opacity-50"
            >
              Start New Focus
            </button>
          )}

          <button
            type="button"
            disabled={focusSession.isBusy}
            onClick={handleFinish}
            className="w-full bg-paper text-ink brutal-border font-mono font-bold uppercase py-3 hover:bg-canvas transition-colors disabled:opacity-50"
          >
            Finish for now
          </button>
        </div>

        {canSaveTemplate && !showSaveTemplate && !isBreakCompleted && (
          <button
            type="button"
            onClick={() => setShowSaveTemplate(true)}
            className="w-full text-center font-mono text-xs font-bold uppercase underline text-ink/70 hover:text-ink transition-colors"
          >
            Save this setup for next time
          </button>
        )}

        {showSaveTemplate && (
          <form
            onSubmit={handleSaveTemplate}
            className="bg-paper brutal-border brutal-shadow-sm p-4 mt-2"
          >
            <label
              htmlFor="template-name"
              className="font-mono font-bold uppercase text-xs block mb-2"
            >
              Template Name
            </label>
            <input
              id="template-name"
              type="text"
              value={templateName}
              maxLength={40}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Deep Work, Study 50..."
              className="w-full brutal-border px-3 py-2 bg-canvas font-mono focus:outline-none focus:ring-2 focus:ring-ink mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSaveTemplate(false)}
                className="flex-1 brutal-border py-2 font-mono font-bold uppercase text-xs bg-canvas hover:bg-paper transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!templateName.trim() || focusSession.isBusy}
                className="flex-1 brutal-border py-2 font-mono font-bold uppercase text-xs bg-sapphire text-paper hover:bg-ink transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
