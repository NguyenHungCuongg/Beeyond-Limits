import React, { useState, useEffect, useRef, useCallback } from "react";
import Timer from "../components/Timer";
import NumberSlider from "../components/NumberSlider";

function Pomodoro({ onNavigate }) {
  const [focusTime, setFocusTime] = useState(25); // minutes
  const [breakTime, setBreakTime] = useState(5); // minutes
  const [currentTime, setCurrentTime] = useState(25 * 60); // seconds
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);

  const intervalRef = useRef(null);
  const initialTimeRef = useRef(25 * 60);

  const showNotification = useCallback((title, body) => {
    // Browser notification (if permission granted)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "/images/icon32.png",
      });
    }

    // Console log for development
    console.log(`🔔 ${title}: ${body}`);
  }, []);

  const handleTimerComplete = useCallback(() => {
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Switch between focus and break
    if (!isBreak) {
      // Finished focus session, start break
      setIsBreak(true);
      setCurrentTime(breakTime * 60);
      initialTimeRef.current = breakTime * 60;
      setSessionCount((prev) => prev + 1);
      setProgress(0);

      // Show notification
      showNotification("Great job! Time for a break! 🎉", "Take a " + breakTime + " minute break.");
    } else {
      // Finished break, start new focus session
      setIsBreak(false);
      setCurrentTime(focusTime * 60);
      initialTimeRef.current = focusTime * 60;
      setProgress(0);

      // Show notification
      showNotification("Break's over! Ready to focus? 💪", "Time for a " + focusTime + " minute focus session.");
    }

    // Timer continues automatically
    setIsActive(true);
  }, [isBreak, breakTime, focusTime, showNotification]);

  // Cập nhật progress khi currentTime thay đổi
  useEffect(() => {
    if (initialTimeRef.current > 0) {
      const newProgress = 1 - currentTime / initialTimeRef.current;
      setProgress(Math.max(0, Math.min(1, newProgress)));
    }
  }, [currentTime]);

  // Timer countdown logic
  useEffect(() => {
    if (isActive && currentTime > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev <= 1) {
            // Timer finished
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, currentTime, handleTimerComplete]);

  const handleStart = () => {
    setIsActive(true);

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const handlePause = () => {
    setIsActive(false);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsBreak(false);
    setCurrentTime(focusTime * 60);
    initialTimeRef.current = focusTime * 60;
    setProgress(0);
    setSessionCount(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleFocusTimeChange = (value) => {
    setFocusTime(value);
    if (!isBreak && !isActive) {
      setCurrentTime(value * 60);
      initialTimeRef.current = value * 60;
      setProgress(0);
    }
  };

  const handleBreakTimeChange = (value) => {
    setBreakTime(value);
    if (isBreak && !isActive) {
      setCurrentTime(value * 60);
      initialTimeRef.current = value * 60;
      setProgress(0);
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
          <Timer time={currentTime} isActive={isActive} progress={progress} isBreak={isBreak} />
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
          <NumberSlider
            label="Focus Duration"
            value={focusTime}
            min={5}
            max={100}
            step={5}
            unit="min"
            onChange={handleFocusTimeChange}
          />

          {/* Break Time Setting */}
          <NumberSlider
            label="Break Duration"
            value={breakTime}
            min={1}
            max={30}
            step={1}
            unit="min"
            onChange={handleBreakTimeChange}
          />
        </div>

        {/* Session Stats */}
        <div className="mb-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <div className="text-center text-white">
            <div className="text-sm opacity-80 mb-1">Current Session</div>
            <div className="flex justify-center space-x-6">
              <div>
                <div className="font-bold text-lg">{sessionCount}</div>
                <div className="text-xs opacity-70">Completed</div>
              </div>
              <div>
                <div className="font-bold text-lg">{isBreak ? "Break" : "Focus"}</div>
                <div className="text-xs opacity-70">Mode</div>
              </div>
              <div>
                <div className="font-bold text-lg">{Math.ceil(currentTime / 60)}</div>
                <div className="text-xs opacity-70">Min Left</div>
              </div>
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
