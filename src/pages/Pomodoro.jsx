import React, { useState, useEffect, useRef, useCallback } from "react";
import Timer from "../components/Timer";
import NumberSlider from "../components/NumberSlider";
import SessionStats from "../components/SessionStats";
import AudioControl from "../components/AudioControl";

/* global chrome */

// Popup Audio Manager - plays audio directly in extension popup
class PopupAudioManager {
  constructor() {
    this.currentAudio = null;
    this.isPlaying = false;
  }

  async playAudio(filename) {
    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }

      const audioUrl = chrome.runtime.getURL(`audio/${filename}`);
      console.log(`Playing audio: ${audioUrl}`);

      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = 0.7;

      return new Promise((resolve, reject) => {
        this.currentAudio.onended = () => {
          console.log(`Audio finished: ${filename}`);
          this.isPlaying = false;
          resolve();
        };

        this.currentAudio.onerror = (error) => {
          console.error(`Audio error for ${filename}:`, error);
          this.isPlaying = false;
          reject(error);
        };

        this.currentAudio.oncanplaythrough = () => {
          console.log(`Audio ready to play: ${filename}`);
          this.isPlaying = true;
          this.currentAudio.play().catch(reject);
        };

        this.currentAudio.load();
      });
    } catch (error) {
      console.error(`Error playing ${filename}:`, error);
      this.isPlaying = false;
      throw error;
    }
  }

  getRandomAudio(audioArray) {
    const randomIndex = Math.floor(Math.random() * audioArray.length);
    return audioArray[randomIndex];
  }

  async playPomodoroSequence(context) {
    try {
      console.log(`Playing Pomodoro sequence for: ${context}`);

      await this.playAudio("pomodoro_alarm.m4a");
      await new Promise((resolve) => setTimeout(resolve, 300));

      let contextAudios = [];
      if (context === "break") {
        contextAudios = ["break_time_1.m4a", "break_time_2.m4a", "break_time_3.m4a"];
      } else if (context === "focus") {
        contextAudios = ["focus_time_1.m4a", "focus_time_2.m4a", "focus_time_3.m4a"];
      }

      if (contextAudios.length > 0) {
        const selectedAudio = this.getRandomAudio(contextAudios);
        await this.playAudio(selectedAudio);
      }

      console.log(`Pomodoro sequence completed for: ${context}`);
    } catch (error) {
      console.error(`Error playing Pomodoro sequence for ${context}:`, error);
      this.playBeep(context);
    }
  }

  playBeep(context) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (context === "break") {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      } else {
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      }

      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log(`Fallback beep played for: ${context}`);
    } catch (error) {
      console.error("Fallback beep failed:", error);
    }
  }
}

// Create audio manager instance
const audioManager = new PopupAudioManager();

function Pomodoro({ onNavigate }) {
  const [focusTime, setFocusTime] = useState(25); // minutes
  const [breakTime, setBreakTime] = useState(5); // minutes
  const [currentTime, setCurrentTime] = useState(25 * 60); // seconds
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true); // Audio control state

  const initialTimeRef = useRef(25 * 60);

  // Sync with background timer
  const syncWithBackground = useCallback(async () => {
    // Check if running in Chrome Extension context
    if (!chrome?.runtime?.sendMessage) {
      console.warn("Chrome runtime not available - running in dev mode");
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: "POMODORO_GET_STATE" });
      if (response && response.state) {
        const state = response.state;
        setCurrentTime(state.currentTime);
        setIsActive(state.isActive);
        setIsBreak(state.isBreak);
        setSessionCount(state.sessionCount);
        setFocusTime(state.focusTime);
        setBreakTime(state.breakTime);
        setAudioEnabled(state.audioEnabled);
        initialTimeRef.current = state.initialTime;

        // Calculate progress
        const progressPercent =
          state.initialTime > 0 ? ((state.initialTime - state.currentTime) / state.initialTime) * 100 : 0;
        setProgress(progressPercent);
      } else {
        // If no background state exists, ensure timer shows default focus time
        if (currentTime === 0 && !isActive) {
          setCurrentTime(focusTime * 60);
          initialTimeRef.current = focusTime * 60;
        }
      }
    } catch (error) {
      console.error("Error syncing with background timer:", error);
      // On error, ensure timer shows default focus time if it's at 0
      if (currentTime === 0 && !isActive) {
        setCurrentTime(focusTime * 60);
        initialTimeRef.current = focusTime * 60;
      }
    }
  }, [currentTime, isActive, focusTime]);

  // Listen for state updates from background
  useEffect(() => {
    // Check if running in Chrome Extension context
    if (!chrome?.runtime?.onMessage) {
      console.warn("Chrome runtime not available - running in dev mode");
      return;
    }

    const handleMessage = (message) => {
      if (message.type === "POMODORO_STATE_UPDATE" && message.state) {
        const state = message.state;
        setCurrentTime(state.currentTime);
        setIsActive(state.isActive);
        setIsBreak(state.isBreak);
        setSessionCount(state.sessionCount);
        initialTimeRef.current = state.initialTime;

        // Calculate progress
        const progressPercent =
          state.initialTime > 0 ? ((state.initialTime - state.currentTime) / state.initialTime) * 100 : 0;
        setProgress(progressPercent);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Initial sync
    syncWithBackground();

    // Sync every second while popup is open
    const syncInterval = setInterval(syncWithBackground, 1000);

    return () => {
      if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
      clearInterval(syncInterval);
    };
  }, [syncWithBackground]);

  // Ensure timer shows correct initial value on first load
  useEffect(() => {
    // If we're not syncing with background (no chrome runtime) or timer is at 0
    if (currentTime === 0 && !isActive) {
      const initialTime = isBreak ? breakTime * 60 : focusTime * 60;
      setCurrentTime(initialTime);
      initialTimeRef.current = initialTime;
    }
  }, [currentTime, isActive, isBreak, focusTime, breakTime]);

  // Handler functions for timer controls
  const handleStart = useCallback(async () => {
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Check if running in Chrome Extension context
    if (!chrome?.runtime?.sendMessage) {
      console.warn("Chrome runtime not available - running in dev mode");
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: "POMODORO_START" });
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  }, []);

  const handleTestAudio = useCallback(async () => {
    if (!audioEnabled) return;

    try {
      console.log("Testing audio directly in popup...");

      // Play audio directly in popup
      await audioManager.playPomodoroSequence(isBreak ? "focus" : "break");

      console.log("Popup audio test completed successfully");
    } catch (error) {
      console.error("Popup audio test failed:", error);

      // Fallback: try through background script
      if (chrome?.runtime?.sendMessage) {
        try {
          await chrome.runtime.sendMessage({
            type: "POMODORO_TEST_AUDIO",
            context: isBreak ? "focus" : "break",
          });
          console.log("Background audio test sent");
        } catch (bgError) {
          console.error("Background audio test also failed:", bgError);
        }
      }
    }
  }, [audioEnabled, isBreak]);

  const handlePause = useCallback(async () => {
    // Check if running in Chrome Extension context
    if (!chrome?.runtime?.sendMessage) {
      console.warn("Chrome runtime not available - running in dev mode");
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: "POMODORO_PAUSE" });
    } catch (error) {
      console.error("Error pausing timer:", error);
    }
  }, []);

  const handleReset = useCallback(async () => {
    // Check if running in Chrome Extension context
    if (!chrome?.runtime?.sendMessage) {
      console.warn("Chrome runtime not available - running in dev mode");
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: "POMODORO_RESET" });
    } catch (error) {
      console.error("Error resetting timer:", error);
    }
  }, []);

  // Handle focus time change
  const handleFocusTimeChange = useCallback(
    (newFocusTime) => {
      setFocusTime(newFocusTime);

      // Update current time if we're in focus mode and not active
      if (!isBreak && !isActive) {
        const newTime = newFocusTime * 60;
        setCurrentTime(newTime);
        initialTimeRef.current = newTime;
        setProgress(0);
      }

      // Check if running in Chrome Extension context
      if (!chrome?.runtime?.sendMessage) {
        console.warn("Chrome runtime not available - running in dev mode");
        return;
      }

      chrome.runtime
        .sendMessage({
          type: "POMODORO_UPDATE_SETTINGS",
          settings: { focusTime: newFocusTime },
        })
        .catch((error) => console.error("Error updating focus time:", error));
    },
    [isBreak, isActive]
  );

  // Handle break time change
  const handleBreakTimeChange = useCallback(
    (newBreakTime) => {
      setBreakTime(newBreakTime);

      // Update current time if we're in break mode and not active
      if (isBreak && !isActive) {
        const newTime = newBreakTime * 60;
        setCurrentTime(newTime);
        initialTimeRef.current = newTime;
        setProgress(0);
      }

      // Check if running in Chrome Extension context
      if (!chrome?.runtime?.sendMessage) {
        console.warn("Chrome runtime not available - running in dev mode");
        return;
      }

      chrome.runtime
        .sendMessage({
          type: "POMODORO_UPDATE_SETTINGS",
          settings: { breakTime: newBreakTime },
        })
        .catch((error) => console.error("Error updating break time:", error));
    },
    [isBreak, isActive]
  );

  // Handle audio toggle
  const handleAudioToggle = useCallback(() => {
    const newAudioEnabled = !audioEnabled;
    setAudioEnabled(newAudioEnabled);

    // Check if running in Chrome Extension context
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime
        .sendMessage({
          type: "POMODORO_UPDATE_SETTINGS",
          settings: { audioEnabled: newAudioEnabled },
        })
        .catch((error) => console.error("Error updating audio setting:", error));
    } else {
      console.warn("Chrome runtime not available - running in dev mode");
    }
  }, [audioEnabled]);

  return (
    <div className="h-full bg-gradient-to-br from-red-500 via-orange-500 to-red-600 font-primary overflow-auto">
      <div className="p-6">
        {/* Header với back button */}
        <div className="flex flex-col items-start mb-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors mr-4"
          >
            ←
          </button>
          <div className="flex-1 text-center self-center">
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

          {/* Audio Control */}
          <AudioControl audioEnabled={audioEnabled} onAudioToggle={handleAudioToggle} onTestAudio={handleTestAudio} />
        </div>

        {/* Session Stats */}
        <SessionStats sessionCount={sessionCount} isBreak={isBreak} currentTime={currentTime} />

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
