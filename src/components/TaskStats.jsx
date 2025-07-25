import React from "react";

function TaskStats({ tasks }) {
  // Calculate stats from tasks
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
      <div className="text-center text-white mb-3">
        <h3 className="font-medium text-sm opacity-80">Today's Progress</h3>
      </div>
      <div className="flex justify-between items-center text-white">
        <div className="text-center flex-1">
          <div className="text-lg font-bold">{totalTasks}</div>
          <div className="text-xs opacity-80">Total Tasks</div>
        </div>
        <div className="w-px h-8 bg-white/30"></div>
        <div className="text-center flex-1">
          <div className="text-lg font-bold">{completedTasks}</div>
          <div className="text-xs opacity-80">Completed</div>
        </div>
        <div className="w-px h-8 bg-white/30"></div>
        <div className="text-center flex-1">
          <div className="text-lg font-bold">{completionRate}%</div>
          <div className="text-xs opacity-80">Success Rate</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="bg-white h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionRate}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default TaskStats;
