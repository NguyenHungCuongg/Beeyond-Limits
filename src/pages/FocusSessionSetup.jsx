import { useMemo, useState } from "react";
import {
  ChevronLeft,
  Play,
  ShieldCheck,
  Headphones,
} from "../components/Icons";

const DURATION_OPTIONS = [15, 25, 50];

function getInitialConfig(preferences, template) {
  const source = template || preferences || {};
  return {
    focusDuration: source.focusDuration || 25,
    breakDuration: source.breakDuration || 5,
    goal: source.goal?.text || "",
    blocker: {
      enabled: source.blocker?.enabled ?? source.blockerEnabled ?? true,
    },
    ambientSound: {
      enabled: Boolean(source.ambientSound?.enabled),
      soundId: source.ambientSound?.soundId || null,
      volume: source.ambientSound?.volume ?? 50,
    },
  };
}

function FocusSessionSetup({ onNavigate, focusSession, template = null }) {
  const initialConfig = useMemo(
    () => getInitialConfig(focusSession.preferences, template),
    [focusSession.preferences, template],
  );
  const [config, setConfig] = useState(initialConfig);

  function updateConfig(patch) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  async function handleStart(event) {
    event.preventDefault();
    try {
      await focusSession.startSession(config);
      onNavigate("focus-active");
    } catch {
      // The hook exposes the actionable error below the form.
    }
  }

  return (
    <div className="bg-canvas min-h-screen text-ink p-5 overflow-auto">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="font-mono text-sm font-bold uppercase flex items-center gap-2 mb-5"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <p className="font-mono text-xs font-bold uppercase mb-2">
          Focus Session
        </p>
        <h1 className="font-display text-5xl uppercase leading-none mb-6">
          Set the space.
        </h1>

        <form onSubmit={handleStart} className="space-y-5">
          <div>
            <label
              htmlFor="focus-goal"
              className="font-mono font-bold uppercase text-xs"
            >
              What will you focus on?
            </label>
            <input
              id="focus-goal"
              value={config.goal}
              maxLength={120}
              onChange={(event) => updateConfig({ goal: event.target.value })}
              placeholder="Write a short goal..."
              className="mt-2 w-full brutal-border brutal-shadow-sm px-3 py-3 bg-paper font-mono focus:outline-none focus:bg-canvas"
            />
          </div>

          <fieldset>
            <legend className="font-mono font-bold uppercase text-xs">
              Duration
            </legend>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {DURATION_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => updateConfig({ focusDuration: minutes })}
                  className={
                    "brutal-border brutal-shadow-sm py-3 font-display text-xl " +
                    (config.focusDuration === minutes
                      ? "bg-ink text-paper"
                      : "bg-paper text-ink")
                  }
                  aria-pressed={config.focusDuration === minutes}
                >
                  {minutes}m
                </button>
              ))}
            </div>
            <label
              htmlFor="break-duration"
              className="font-mono text-xs font-bold uppercase block mt-4"
            >
              Break: {config.breakDuration} min
            </label>
            <input
              id="break-duration"
              type="range"
              min="1"
              max="30"
              value={config.breakDuration}
              onChange={(event) =>
                updateConfig({ breakDuration: Number(event.target.value) })
              }
              className="w-full mt-2"
            />
          </fieldset>

          <fieldset className="brutal-border bg-paper">
            <legend className="sr-only">Focus environment</legend>
            <label className="flex items-center justify-between gap-3 p-3 border-b-2 border-ink">
              <span className="flex items-center gap-2 font-mono font-bold uppercase text-xs">
                <ShieldCheck size={18} /> Website blocker
              </span>
              <input
                type="checkbox"
                checked={config.blocker.enabled}
                onChange={(event) =>
                  updateConfig({
                    blocker: { enabled: event.target.checked },
                  })
                }
                className="h-5 w-5 accent-emerald"
              />
            </label>
            <label className="flex items-center justify-between gap-3 p-3">
              <span className="flex items-center gap-2 font-mono font-bold uppercase text-xs">
                <Headphones size={18} /> Ambient sound
              </span>
              <input
                type="checkbox"
                checked={config.ambientSound.enabled}
                onChange={(event) =>
                  updateConfig({
                    ambientSound: {
                      ...config.ambientSound,
                      enabled: event.target.checked,
                    },
                  })
                }
                className="h-5 w-5 accent-emerald"
              />
            </label>
          </fieldset>

          {focusSession.error && (
            <div
              role="alert"
              className="brutal-border bg-crimson text-paper p-3 font-mono text-xs"
            >
              {focusSession.error}
            </div>
          )}

          <button
            type="submit"
            disabled={focusSession.isBusy}
            className="w-full flex items-center justify-center gap-2 bg-mustard text-ink brutal-border brutal-shadow font-display text-2xl uppercase py-3 disabled:opacity-50"
          >
            <Play size={22} /> Start {config.focusDuration} Min Focus
          </button>
        </form>
      </div>
    </div>
  );
}

export default FocusSessionSetup;
