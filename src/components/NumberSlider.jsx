import React from "react";

function NumberSlider({
  label,
  value,
  min = 1,
  max = 60,
  step = 1,
  unit = "min",
  onChange,
}) {
  const handleDecrease = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className="bg-paper brutal-border brutal-shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono font-bold uppercase text-ink">{label}</span>
        <span className="font-display text-2xl text-mustard leading-none">
          {value} {unit}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={handleDecrease}
          disabled={value <= min}
          className={`w-8 h-8 flex items-center justify-center brutal-border brutal-shadow-sm bg-canvas font-bold transition-colors ${
            value <= min
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-mustard cursor-pointer active:translate-y-[2px] active:shadow-none"
          }`}
        >
          −
        </button>

        <div className="flex-1 border-[3px] border-ink bg-canvas h-4 relative overflow-hidden">
          <div
            className="bg-mustard h-full transition-all duration-300 ease-out border-r-[3px] border-ink"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={handleIncrease}
          disabled={value >= max}
          className={`w-8 h-8 flex items-center justify-center brutal-border brutal-shadow-sm bg-canvas font-bold transition-colors ${
            value >= max
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-mustard cursor-pointer active:translate-y-[2px] active:shadow-none"
          }`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default NumberSlider;
