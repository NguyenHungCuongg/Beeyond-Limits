import React, { useState } from "react";
import Timer from "../components/Timer";

function Pomodoro({ onNavigate }) {
  const [focusTime, setFocusTime] = useState(25); // minutes
  const [breakTime, setBreakTime] = useState(5); // minutes
  const [currentTime, setCurrentTime] = useState(25 * 60); // seconds
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStart = () => {
    setIsActive(true);
  };

  const handlePause = () => {
    setIsActive(false);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsBreak(false);
    setCurrentTime(focusTime * 60);
    setProgress(0);
  };

  const handleFocusTimeChange = (value) => {
    setFocusTime(value);
    if (!isBreak) {
      setCurrentTime(value * 60);
    }
  };

  const handleBreakTimeChange = (value) => {
    setBreakTime(value);
    if (isBreak) {
      setCurrentTime(value * 60);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-red-500 via-orange-500 to-red-600 font-primary overflow-auto">
      <div className="p-6">
        {/* Header với back button */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors mr-4"
          >
            ←
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">Pomodoro Timer</h1>
            <p className="text-red-100 text-sm">Stay focused, bee productive! 🍅</p>
          </div>
        </div>

        {/* Timer Display */}
        <div className="mb-8">
          <Timer time={currentTime} isActive={isActive} progress={progress} />
        </div>

        {/* Session Type Indicator */}
        <div className="text-center mb-6">
          <div className="inline-flex bg-white/20 backdrop-blur-sm rounded-full p-1">
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !isBreak ? "bg-white text-red-600 shadow-lg" : "text-white"
              }`}
            >
              Focus Time
            </div>
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isBreak ? "bg-white text-red-600 shadow-lg" : "text-white"
              }`}
            >
              Break Time
            </div>
          </div>
        </div>

        {/* Time Settings */}
        <div className="space-y-4 mb-8">
          {/* Focus Time Setting */}
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">Focus Duration</span>
              <span className="text-white font-bold">{focusTime} min</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleFocusTimeChange(Math.max(1, focusTime - 5))}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                −
              </button>
              <div className="flex-1 bg-white/10 rounded-lg h-2 relative">
                <div
                  className="bg-white rounded-lg h-full transition-all duration-300"
                  style={{ width: `${(focusTime / 60) * 100}%` }}
                ></div>
              </div>
              <button
                onClick={() => handleFocusTimeChange(Math.min(60, focusTime + 5))}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Break Time Setting */}
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">Break Duration</span>
              <span className="text-white font-bold">{breakTime} min</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleBreakTimeChange(Math.max(1, breakTime - 1))}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                −
              </button>
              <div className="flex-1 bg-white/10 rounded-lg h-2 relative">
                <div
                  className="bg-white rounded-lg h-full transition-all duration-300"
                  style={{ width: `${(breakTime / 30) * 100}%` }}
                ></div>
              </div>
              <button
                onClick={() => handleBreakTimeChange(Math.min(30, breakTime + 1))}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="space-y-3">
          {!isActive ? (
            <button
              onClick={handleStart}
              className="w-full bg-white text-red-600 font-bold py-4 rounded-xl shadow-lg hover:bg-red-50 transition-all duration-300 transform hover:scale-[1.02]"
            >
              🍅 Start Focus Session
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="w-full bg-white/20 backdrop-blur-sm text-white font-bold py-4 rounded-xl border-2 border-white/30 hover:bg-white/30 transition-all duration-300"
            >
              ⏸️ Pause Timer
            </button>
          )}

          <div className="flex space-x-3">
            <button
              onClick={handleReset}
              className="flex-1 bg-white/10 backdrop-blur-sm text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
            >
              🔄 Reset
            </button>
            <button
              onClick={() => onNavigate("home")}
              className="flex-1 bg-white/10 backdrop-blur-sm text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
            >
              🏠 Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Pomodoro;
