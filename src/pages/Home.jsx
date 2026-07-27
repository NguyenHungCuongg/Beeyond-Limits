import React from "react";
import DailyQuote from "../components/DailyQuote";
import FeatureCard from "../components/FeatureCard";
import {
  Clock,
  ShieldCheck,
  ClipboardCheck,
  Headphones,
} from "../components/Icons";

function Home({ onNavigate, onStartFocus }) {
  return (
    <div className="min-h-screen bg-canvas overflow-auto p-5">
      {/* Header */}
      <div className="mb-6 flex flex-col items-center">
        <h1 className="font-display text-6xl uppercase tracking-wide text-ink text-center leading-none">
          Beeyond
          <br />
          Limits
        </h1>
        <p className="font-mono text-sm font-bold mt-2 text-ink uppercase">
          Your focus companion
        </p>
      </div>

      {onStartFocus && (
        <button
          type="button"
          onClick={onStartFocus}
          className="w-full mb-7 bg-mustard text-ink brutal-border brutal-shadow font-display text-2xl uppercase py-3"
        >
          Start Focus Session
        </button>
      )}

      {/* Feature Cards */}
      <div className="space-y-6">
        <FeatureCard
          onClick={() => onNavigate("pomodoro")}
          number="01."
          title="POMODORO TIMER"
          tags="FOCUS · BREAKS · STATS"
          description="Set your focus sessions. Work in sprints, take breaks."
          Icon={Clock}
          iconLabel="TIMER"
          bgColor="bg-mustard"
          textColor="text-ink"
          dividerColor="border-ink"
          halftoneClass="halftone-dark"
        />
        <FeatureCard
          onClick={() => onNavigate("websiteblocker")}
          number="02."
          title="WEBSITE BLOCKER"
          tags="FOCUS · SITES · PROTECT"
          description="Block distracting sites while you work."
          Icon={ShieldCheck}
          iconLabel="BLOCK"
          bgColor="bg-crimson"
          textColor="text-paper"
          dividerColor="border-paper"
          halftoneClass="halftone-light"
        />
        <FeatureCard
          onClick={() => onNavigate("tasklist")}
          number="03."
          title="TASK LIST"
          tags="TASKS · TODOS · ORGANIZE"
          description="Organize your goals and track progress."
          Icon={ClipboardCheck}
          iconLabel="TASKS"
          bgColor="bg-sapphire"
          textColor="text-paper"
          dividerColor="border-paper"
          halftoneClass="halftone-light"
        />
        <FeatureCard
          onClick={() => onNavigate("ambientsounds")}
          number="04."
          title="AMBIENT SOUNDS"
          tags="SOUNDS · NATURE · NOISE"
          description="Nature & white noise for deep focus."
          Icon={Headphones}
          iconLabel="AUDIO"
          bgColor="bg-emerald"
          textColor="text-paper"
          dividerColor="border-paper"
          halftoneClass="halftone-light"
        />
      </div>

      {/* Daily Quotes */}
      <div className="mt-8">
        <DailyQuote />
      </div>
    </div>
  );
}

export default Home;
