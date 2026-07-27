import React from "react";

function VolumeSlider({ id, value, onChange }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Volume
      </label>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full h-4 bg-canvas brutal-border appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-black"
      />
    </>
  );
}

export default VolumeSlider;
