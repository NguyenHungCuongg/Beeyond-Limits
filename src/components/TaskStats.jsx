import React from "react";

function TaskStats({ tasks }) {
  // Check if a date string is today
  const isToday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Calculate stats for today
  // Include:
  // 1. Tasks created today
  // 2. Tasks completed today
  // 3. Active tasks (carry over from previous days)
  const todayTasks = tasks.filter(
    (task) => !task.completed || isToday(task.completedAt) || isToday(task.createdAt)
  );

  const totalTasks = todayTasks.length;
  const completedTasks = todayTasks.filter((task) => task.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="bg-paper brutal-border brutal-shadow-sm p-4 grid grid-cols-3 divide-x-[3px] divide-ink text-center mb-6">
      <div>
        <div className="font-display text-4xl text-ink">{totalTasks}</div>
        <div className="font-mono text-[10px] font-bold uppercase mt-1">Total Tasks</div>
      </div>
      <div>
        <div className="font-display text-4xl text-ink">{completedTasks}</div>
        <div className="font-mono text-[10px] font-bold uppercase mt-1">Completed</div>
      </div>
      <div>
        <div className="font-display text-4xl text-ink">{completionRate}%</div>
        <div className="font-mono text-[10px] font-bold uppercase mt-1">Success Rate</div>
      </div>
    </div>
  );
}

export default TaskStats;
