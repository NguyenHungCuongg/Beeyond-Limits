import React from "react";

function NumberSlider({ label, value, min = 1, max = 60, step = 1, unit = "min", onChange }) {
  const handleDecrease = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  // Calculate progress percentage based on range
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white font-medium">{label}</span>
        <span className="text-white font-bold">
          {value} {unit}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={handleDecrease}
          disabled={value <= min}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-white transition-colors ${
            value <= min ? "bg-white/10 opacity-50 cursor-not-allowed" : "bg-white/20 hover:bg-white/30"
          }`}
        >
          −
        </button>

        <div className="flex-1 bg-white/10 rounded-lg h-2 relative overflow-hidden">
          <div
            className="bg-white rounded-lg h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>

          {/* Optional: Add tick marks for visual reference */}
          <div className="absolute inset-0 flex items-center">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-1 w-px bg-white/20" style={{ marginLeft: i === 0 ? "0" : `${100 / 4}%` }} />
            ))}
          </div>
        </div>

        <button
          onClick={handleIncrease}
          disabled={value >= max}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-white transition-colors ${
            value >= max ? "bg-white/10 opacity-50 cursor-not-allowed" : "bg-white/20 hover:bg-white/30"
          }`}
        >
          +
        </button>
      </div>

      {/* Optional: Show range info */}
      <div className="flex justify-between mt-2 text-xs text-white/60">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

export default NumberSlider;
