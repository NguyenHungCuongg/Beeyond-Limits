import React from "react";

function Timer({ time, isActive, isBreak = false }) {
  // Format time từ seconds thành MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Tính progress cho vòng tròn 1 phút
  const getMinuteProgress = (seconds) => {
    // Lấy số giây trong phút hiện tại (0-59)
    const secondsInCurrentMinute = seconds % 60;
    // Progress từ 1 đến 0 cho mỗi phút (60 giây) để chạy theo chiều kim đồng hồ
    return 1 - secondsInCurrentMinute / 60;
  };

  const minuteProgress = getMinuteProgress(time);

  return (
    <div className="relative w-64 h-64 mx-auto">
      {/* Background Circle */}
      <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30"></div>

      {/* Progress Ring */}
      <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />

        {/* Progress ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 45}`}
          strokeDashoffset={`${2 * Math.PI * 45 * (1 - minuteProgress)}`}
          className={`transition-all duration-1000 ${isActive ? "drop-shadow-lg" : ""}`}
          style={{
            filter: isActive ? "drop-shadow(0 0 8px rgba(255,255,255,0.5))" : "none",
          }}
        />
      </svg>

      {/* Time Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <div className="text-4xl font-bold font-mono tracking-wider drop-shadow-lg">{formatTime(time)}</div>
        <div className="text-sm opacity-80 mt-1">{isActive ? (isBreak ? "Break Time" : "Focus Time") : "Ready"}</div>
      </div>

      {/* Pulse Animation when active */}
      {isActive && <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping"></div>}
    </div>
  );
}

export default Timer;
