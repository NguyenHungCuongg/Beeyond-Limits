import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Timer from "../components/Timer";
import NumberSlider from "../components/NumberSlider";
import SessionStats from "../components/SessionStats";
import AudioControl from "../components/AudioControl";
import { ChevronLeft, Play, Pause, Coffee, RotateCcw, Home } from "../components/Icons";

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
    <div className="bg-canvas min-h-screen text-ink p-5 overflow-auto">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          aria-label="Back to home"
          className="font-mono text-sm font-bold uppercase flex gap-2 items-center mb-4 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft size={16} /> BACK
        </button>
        
        <h1 className="font-display text-6xl uppercase text-center mb-6">
          Pomodoro
        </h1>

        <div className="flex brutal-border bg-paper w-full max-w-xs mx-auto mb-6">
          <div
            className={`font-mono font-bold uppercase py-2 flex-1 text-center transition-colors ${
              !isBreak ? "bg-ink text-paper" : "bg-paper text-ink"
            }`}
          >
            Focus
          </div>
          <div
            className={`font-mono font-bold uppercase py-2 flex-1 text-center transition-colors ${
              isBreak ? "bg-ink text-paper" : "bg-paper text-ink"
            }`}
          >
            Break
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

        <SessionStats
          sessionCount={sessionCount}
          isBreak={isBreak}
          currentTime={currentTime}
        />

        <div className="mb-8 space-y-4">
          <NumberSlider
            label="Focus"
            value={focusTime}
            min={5}
            max={100}
            step={5}
            unit="min"
            onChange={handleFocusTimeChange}
          />
          <NumberSlider
            label="Break"
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

        <div className="space-y-3 pb-8">
          {!isActive ? (
            <button
              type="button"
              onClick={() => runCommand("POMODORO_START")}
              className="w-full flex items-center justify-center gap-2 bg-mustard text-ink brutal-border brutal-shadow font-display text-2xl uppercase py-3 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-none"
            >
              {isBreak ? (
                <><Coffee size={24} /> Start Break</>
              ) : (
                <><Play size={24} /> Start Focus</>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runCommand("POMODORO_PAUSE")}
              className="w-full flex items-center justify-center gap-2 bg-crimson text-paper brutal-border brutal-shadow font-display text-2xl uppercase py-3 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-none"
            >
              <Pause size={24} /> Pause
            </button>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => runCommand("POMODORO_RESET")}
              className="flex-1 flex items-center justify-center gap-2 bg-paper text-ink brutal-border brutal-shadow font-mono font-bold uppercase py-3 hover:bg-canvas transition-colors"
            >
              <RotateCcw size={16} /> Reset
            </button>
            <button
              type="button"
              onClick={() => onNavigate("home")}
              className="flex-1 flex items-center justify-center gap-2 bg-paper text-ink brutal-border brutal-shadow font-mono font-bold uppercase py-3 hover:bg-canvas transition-colors"
            >
              <Home size={16} /> Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Pomodoro;
