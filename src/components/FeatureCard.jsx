import React from "react";

function FeatureCard({
  onClick,
  number,
  title,
  tags,
  description,
  // eslint-disable-next-line no-unused-vars
  Icon,
  iconLabel,
  bgColor,
  textColor,
  dividerColor,
  halftoneClass,
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left ${bgColor} brutal-border brutal-shadow mb-6 flex items-stretch hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-none`}
    >
      {/* Left: Halftone pattern */}
      <div
        className={`w-20 sm:w-28 border-r-[3px] ${dividerColor} ${halftoneClass} shrink-0`}
      ></div>
      {/* Middle: Content */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
        <div
          className={`${textColor} font-bold text-lg leading-none font-sans`}
        >
          {number}
        </div>
        <h3
          className={`font-display text-4xl sm:text-5xl uppercase ${textColor} leading-none mt-1`}
        >
          {title}
        </h3>
        <div
          className={`font-mono text-[10px] sm:text-xs ${textColor} uppercase tracking-widest mt-2`}
        >
          {tags}
        </div>
        <p className={`font-sans text-sm ${textColor} mt-3 font-medium`}>
          {description}
        </p>
      </div>
      {/* Right: Icon Box */}
      <div className="hidden sm:flex flex-col items-center justify-center p-4 border-l-[3px] border-ink bg-paper w-24 shrink-0">
        <Icon size={24} className="text-ink mb-2" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
          {iconLabel}
        </span>
      </div>
    </button>
  );
}

export default FeatureCard;
