import { useEffect, useRef } from "react";

export default function AlarmPopup({ onNavigate, focusSession }) {
  const muteButtonRef = useRef(null);

  useEffect(() => {
    muteButtonRef.current?.focus();
  }, []);

  async function handleMute() {
    try {
      await focusSession.stopAlarm();
      onNavigate("focus-complete");
    } catch {
      // The shared hook exposes the error state; keep the alarm screen visible.
    }
  }

  if (focusSession.isLoading) {
    return (
      <main className="min-h-screen bg-paper text-ink p-6 flex items-center justify-center">
        <p className="font-mono uppercase text-sm" role="status">Loading alarm?</p>
      </main>
    );
  }

  if (!focusSession.activeSession) {
    return (
      <main className="min-h-screen bg-paper text-ink p-6 flex flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-4xl uppercase">No active session</h1>
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="bg-sapphire text-paper brutal-border brutal-shadow font-display text-xl uppercase px-6 py-3"
        >
          Go Home
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink p-6 flex flex-col justify-between">
      <div className="pt-8">
        <p className="font-mono text-xs uppercase tracking-widest text-sapphire mb-4">
          Focus Session
        </p>
        <h1 className="font-display text-5xl uppercase leading-none">Time&apos;s Up</h1>
        <p className="font-mono text-sm uppercase mt-4">Mute the alarm to continue.</p>
      </div>

      <button
        ref={muteButtonRef}
        type="button"
        onClick={handleMute}
        disabled={focusSession.isBusy}
        className="w-full bg-sapphire text-paper brutal-border brutal-shadow font-display text-3xl uppercase py-5 disabled:opacity-50"
      >
        {focusSession.isBusy ? "Muting?" : "Mute Alarm"}
      </button>
    </main>
  );
}
