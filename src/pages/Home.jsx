import React from "react";
import DailyQuote from "../components/DailyQuote";
import { Clock, ShieldCheck, ClipboardCheck, Headphones } from "../components/Icons";

function Home({ onNavigate }) {
  return (
    <div className="min-h-screen bg-canvas overflow-auto p-5">
      {/* Header */}
      <div className="mb-6 flex flex-col items-center">
        <h1 className="font-display text-6xl uppercase tracking-wide text-ink text-center leading-none">Beeyond<br/>Limits</h1>
        <p className="font-mono text-sm font-bold mt-2 text-ink uppercase">Your focus companion</p>
      </div>

      {/* Feature Cards */}
      <div className="space-y-6">
        {/* Pomodoro Timer */}
        <button onClick={() => onNavigate("pomodoro")} className="w-full text-left bg-mustard brutal-border brutal-shadow mb-6 flex items-stretch">
          {/* Left: Halftone pattern */}
          <div className="w-20 sm:w-28 border-r-[3px] border-ink halftone-dark shrink-0"></div>
          {/* Middle: Content */}
          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
            <div className="text-ink font-bold text-lg leading-none font-sans">01.</div>
            <h3 className="font-display text-4xl sm:text-5xl uppercase text-ink leading-none mt-1">POMODORO TIMER</h3>
            <div className="font-mono text-[10px] sm:text-xs text-ink uppercase tracking-widest mt-2">FOCUS · BREAKS · STATS</div>
            <p className="font-sans text-sm text-ink mt-3 font-medium">Set your focus sessions. Work in sprints, take breaks.</p>
          </div>
          {/* Right: Icon Box */}
          <div className="hidden sm:flex flex-col items-center justify-center p-4 border-l-[3px] border-ink bg-paper w-24 shrink-0">
            <Clock size={24} className="text-ink mb-2" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">TIMER</span>
          </div>
        </button>

        {/* Website Blocker */}
        <button onClick={() => onNavigate("websiteblocker")} className="w-full text-left bg-crimson brutal-border brutal-shadow mb-6 flex items-stretch">
          <div className="w-20 sm:w-28 border-r-[3px] border-paper halftone-light shrink-0"></div>
          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
            <div className="text-paper font-bold text-lg leading-none font-sans">02.</div>
            <h3 className="font-display text-4xl sm:text-5xl uppercase text-paper leading-none mt-1">WEBSITE BLOCKER</h3>
            <div className="font-mono text-[10px] sm:text-xs text-paper uppercase tracking-widest mt-2">FOCUS · SITES · PROTECT</div>
            <p className="font-sans text-sm text-paper mt-3 font-medium">Block distracting sites while you work.</p>
          </div>
          <div className="hidden sm:flex flex-col items-center justify-center p-4 border-l-[3px] border-ink bg-paper w-24 shrink-0">
            <ShieldCheck size={24} className="text-ink mb-2" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">BLOCK</span>
          </div>
        </button>

        {/* Task List */}
        <button onClick={() => onNavigate("tasklist")} className="w-full text-left bg-sapphire brutal-border brutal-shadow mb-6 flex items-stretch">
          <div className="w-20 sm:w-28 border-r-[3px] border-paper halftone-light shrink-0"></div>
          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
            <div className="text-paper font-bold text-lg leading-none font-sans">03.</div>
            <h3 className="font-display text-4xl sm:text-5xl uppercase text-paper leading-none mt-1">TASK LIST</h3>
            <div className="font-mono text-[10px] sm:text-xs text-paper uppercase tracking-widest mt-2">TASKS · TODOS · ORGANIZE</div>
            <p className="font-sans text-sm text-paper mt-3 font-medium">Organize your goals and track progress.</p>
          </div>
          <div className="hidden sm:flex flex-col items-center justify-center p-4 border-l-[3px] border-ink bg-paper w-24 shrink-0">
            <ClipboardCheck size={24} className="text-ink mb-2" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">TASKS</span>
          </div>
        </button>

        {/* Ambient Sounds */}
        <button onClick={() => onNavigate("ambientsounds")} className="w-full text-left bg-emerald brutal-border brutal-shadow mb-6 flex items-stretch">
          <div className="w-20 sm:w-28 border-r-[3px] border-paper halftone-light shrink-0"></div>
          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
            <div className="text-paper font-bold text-lg leading-none font-sans">04.</div>
            <h3 className="font-display text-4xl sm:text-5xl uppercase text-paper leading-none mt-1">AMBIENT SOUNDS</h3>
            <div className="font-mono text-[10px] sm:text-xs text-paper uppercase tracking-widest mt-2">SOUNDS · NATURE · NOISE</div>
            <p className="font-sans text-sm text-paper mt-3 font-medium">Nature & white noise for deep focus.</p>
          </div>
          <div className="hidden sm:flex flex-col items-center justify-center p-4 border-l-[3px] border-ink bg-paper w-24 shrink-0">
            <Headphones size={24} className="text-ink mb-2" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">AUDIO</span>
          </div>
        </button>
      </div>

      {/* Daily Quotes */}
      <div className="mt-8">
        <DailyQuote />
      </div>
    </div>
  );
}

export default Home;
