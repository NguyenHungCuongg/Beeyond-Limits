import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Timer from "../components/Timer";
import NumberSlider from "../components/NumberSlider";
import SessionStats from "../components/SessionStats";
import AudioControl from "../components/AudioControl";

/* global chrome */

const extensionApi = typeof chrome !== "undefined" ? chrome : null;
function Pomodoro({ onNavigate }) {
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [currentTime, setCurrentTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const initialTimeRef = useRef(25 * 60);

  const applyState = useCallback((state) => {
    setCurrentTime(state.currentTime);
    setIsActive(state.isActive);
    setIsBreak(state.isBreak);
    setSessionCount(state.sessionCount);
    setFocusTime(state.focusTime);
    setBreakTime(state.breakTime);
    setAudioEnabled(state.audioEnabled);
    initialTimeRef.current = state.initialTime;
  }, []);

  const sendCommand = useCallback(
    async (type, payload = {}) => {
      if (!extensionApi?.runtime?.sendMessage) {
        return null;
      }

      const response = await extensionApi.runtime.sendMessage({
        type,
        ...payload,
      });
      if (!response?.success) {
        throw new Error(response?.error || `Unable to process ${type}`);
      }
      if (response.state) {
        applyState(response.state);
      }
      return response;
    },
    [applyState],
  );

  const syncWithBackground = useCallback(async () => {
    try {
      await sendCommand("POMODORO_GET_STATE");
    } catch (error) {
      console.error("Unable to synchronize Pomodoro state:", error);
    }
  }, [sendCommand]);

  useEffect(() => {
    if (!extensionApi?.runtime?.onMessage) {
      return undefined;
    }

    const handleMessage = (message) => {
      if (message.type === "POMODORO_STATE_UPDATE" && message.state) {
        applyState(message.state);
      }
    };

    extensionApi.runtime.onMessage.addListener(handleMessage);
    syncWithBackground();
    const syncInterval = setInterval(syncWithBackground, 1000);

    return () => {
      extensionApi.runtime.onMessage.removeListener(handleMessage);
      clearInterval(syncInterval);
    };
  }, [applyState, syncWithBackground]);

  async function runCommand(type, payload) {
    try {
      await sendCommand(type, payload);
    } catch (error) {
      console.error(`Pomodoro command ${type} failed:`, error);
      toast.error(error.message);
    }
  }

  function updateSetting(settings) {
    runCommand("POMODORO_UPDATE_SETTINGS", { settings });
  }

  function handleFocusTimeChange(value) {
    setFocusTime(value);
    if (!isBreak && !isActive) {
      setCurrentTime(value * 60);
      initialTimeRef.current = value * 60;
    }
    updateSetting({ focusTime: value });
  }

  function handleBreakTimeChange(value) {
    setBreakTime(value);
    if (isBreak && !isActive) {
      setCurrentTime(value * 60);
      initialTimeRef.current = value * 60;
    }
    updateSetting({ breakTime: value });
  }

  function handleAudioToggle() {
    const nextAudioEnabled = !audioEnabled;
    setAudioEnabled(nextAudioEnabled);
    updateSetting({ audioEnabled: nextAudioEnabled });
  }

  async function handleTestAudio() {
    if (!audioEnabled) return;
    await runCommand("POMODORO_TEST_AUDIO", {
      context: isBreak ? "focus" : "break",
    });
  }

  const progress =
    initialTimeRef.current > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((initialTimeRef.current - currentTime) / initialTimeRef.current) *
              100,
          ),
        )
      : 0;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-red-500 via-orange-500 to-red-600 font-primary">
      <div className="p-6">
        <div className="mb-6 flex flex-col items-start">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-label="Back to home"
            className="mr-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ←
          </button>
          <div className="flex-1 self-center text-center">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              Pomodoro Timer
            </h1>
            <p className="text-sm text-red-100">
              Stay focused, bee productive! 🍅
            </p>
          </div>
        </div>

        <div className="mb-8">
          <Timer
            time={currentTime}
            isActive={isActive}
            progress={progress}
            isBreak={isBreak}
          />
        </div>

        <div className="mb-6 text-center" aria-live="polite">
          <div className="inline-flex rounded-full bg-white/20 p-1 backdrop-blur-sm">
            <div
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                !isBreak ? "bg-white text-red-600 shadow-lg" : "text-white"
              }`}
            >
              Focus Time
            </div>
            <div
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                isBreak ? "bg-white text-red-600 shadow-lg" : "text-white"
              }`}
            >
              Break Time
            </div>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <NumberSlider
            label="Focus Duration"
            value={focusTime}
            min={5}
            max={100}
            step={5}
            unit="min"
            onChange={handleFocusTimeChange}
          />
          <NumberSlider
            label="Break Duration"
            value={breakTime}
            min={1}
            max={30}
            step={1}
            unit="min"
            onChange={handleBreakTimeChange}
          />
          <AudioControl
            audioEnabled={audioEnabled}
            onAudioToggle={handleAudioToggle}
            onTestAudio={handleTestAudio}
          />
        </div>

        <SessionStats
          sessionCount={sessionCount}
          isBreak={isBreak}
          currentTime={currentTime}
        />

        <div className="space-y-3">
          {!isActive ? (
            <button
              type="button"
              onClick={() => runCommand("POMODORO_START")}
              className="w-full rounded-xl bg-white py-4 font-bold text-red-600 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {isBreak ? "☕ Start Break" : "🍅 Start Focus Session"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runCommand("POMODORO_PAUSE")}
              className="w-full rounded-xl border-2 border-white/30 bg-white/20 py-4 font-bold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ⏸️ Pause Timer
            </button>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => runCommand("POMODORO_RESET")}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              🔄 Reset
            </button>
            <button
              type="button"
              onClick={() => onNavigate("home")}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
