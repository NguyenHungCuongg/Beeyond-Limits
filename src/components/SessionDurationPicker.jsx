import React, { useState } from "react";
import NumberSlider from "./NumberSlider";

const QUICK_DURATIONS = [15, 25, 50];

export default function SessionDurationPicker({ focusDuration, breakDuration, onFocusChange, onBreakChange }) {
  const [isCustom, setIsCustom] = useState(!QUICK_DURATIONS.includes(focusDuration));

  const handleQuickSelect = (minutes) => {
    setIsCustom(false);
    onFocusChange(minutes);
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
  };

  return (
    <fieldset className="mb-5">
      <legend className="font-mono font-bold uppercase text-xs mb-2">Duration</legend>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {QUICK_DURATIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => handleQuickSelect(minutes)}
            className={`brutal-border brutal-shadow-sm py-3 font-display text-xl transition-colors ${
              !isCustom && focusDuration === minutes ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-canvas"
            }`}
            aria-pressed={!isCustom && focusDuration === minutes}
          >
            {minutes}m
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustomToggle}
          className={`brutal-border brutal-shadow-sm py-3 font-display text-xl transition-colors ${
            isCustom ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-canvas"
          }`}
          aria-pressed={isCustom}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <NumberSlider
          label="Custom Focus"
          value={focusDuration}
          min={5}
          max={120}
          step={5}
          unit="min"
          onChange={onFocusChange}
        />
      )}

      <NumberSlider
        label="Break Duration"
        value={breakDuration}
        min={1}
        max={30}
        step={1}
        unit="min"
        onChange={onBreakChange}
      />
    </fieldset>
  );
}
