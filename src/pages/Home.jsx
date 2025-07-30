import React from "react";
import DailyQuote from "../components/DailyQuote";

function Home({ onNavigate }) {
  return (
    <div className="h-full bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500 font-primary overflow-auto">
      <div className="p-6">
        {/* Header với logo/icon */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-2">🐝</div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg mb-2">Beeyond Limits</h1>
          <p className="text-amber-100 text-sm font-medium">Buzz into productivity mode!</p>
        </div>

        {/* Feature Cards */}
        <div className="space-y-3">
          {/* Pomodoro Timer */}
          <div
            onClick={() => onNavigate("pomodoro")}
            className="group bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border border-white/20"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                🍅
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 group-hover:text-red-600 transition-colors">Pomodoro Timer</h3>
                <p className="text-sm text-gray-600">Set your focus sessions</p>
              </div>
              <div className="text-gray-400 group-hover:text-red-500 transition-colors">→</div>
            </div>
          </div>

          {/* Website Blocker */}
          <div
            onClick={() => onNavigate("websiteblocker")}
            className="group bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border border-white/20"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                🧱
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">Website Blocker</h3>
                <p className="text-sm text-gray-600">Block distracting sites</p>
              </div>
              <div className="text-gray-400 group-hover:text-blue-500 transition-colors">→</div>
            </div>
          </div>

          {/* Task List */}
          <div
            onClick={() => onNavigate("tasklist")}
            className="group bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border border-white/20"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                ✅
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 group-hover:text-green-600 transition-colors">Task List</h3>
                <p className="text-sm text-gray-600">Organize your goals</p>
              </div>
              <div className="text-gray-400 group-hover:text-green-500 transition-colors">→</div>
            </div>
          </div>

          {/* Ambient Sound */}
          <div
            onClick={() => onNavigate("ambientsounds")}
            className="group bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border border-white/20"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                🎵
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">Focus Sounds</h3>
                <p className="text-sm text-gray-600">Nature & white noise</p>
              </div>
              <div className="text-gray-400 group-hover:text-purple-500 transition-colors">→</div>
            </div>
          </div>
        </div>

        {/* Daily Quotes */}
        <div className="mt-8">
          <DailyQuote />
        </div>
      </div>
    </div>
  );
}

export default Home;
