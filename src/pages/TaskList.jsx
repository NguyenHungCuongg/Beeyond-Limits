import React, { useState } from "react";
import Task from "../components/Task";

function TaskList({ onNavigate }) {
  const [tasks, setTasks] = useState([
    {
      id: 1,
      text: "Complete Chrome extension project",
      completed: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      text: "Review React documentation",
      completed: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    },
    {
      id: 3,
      text: "Plan tomorrow's workflow",
      completed: false,
      createdAt: new Date().toISOString(),
    },
  ]);

  const [newTaskText, setNewTaskText] = useState("");
  const [filter, setFilter] = useState("all"); // all, active, completed

  const addTask = () => {
    if (newTaskText.trim()) {
      const newTask = {
        id: Date.now(),
        text: newTaskText.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setTasks([newTask, ...tasks]);
      setNewTaskText("");
    }
  };

  const toggleTask = (taskId) => {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)));
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter((task) => task.id !== taskId));
  };

  const editTask = (taskId, newText) => {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, text: newText } : task)));
  };

  const clearCompleted = () => {
    setTasks(tasks.filter((task) => !task.completed));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addTask();
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true; // all
  });

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const activeTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="h-full bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 font-primary overflow-auto">
      <div className="p-6">
        {/* Header với back button */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors mr-4"
          >
            ←
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">Task Manager</h1>
            <p className="text-green-100 text-sm">Organize your goals, bee productive!</p>
          </div>
        </div>

        {/* Add New Task */}
        <div className="mb-6 bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
          <div className="flex space-x-3">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="What needs to be done?"
              className="flex-1 bg-white/90 backdrop-blur-sm border-0 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              onClick={addTask}
              disabled={!newTaskText.trim()}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                newTaskText.trim()
                  ? "bg-white text-green-600 hover:bg-green-50 shadow-lg hover:scale-105"
                  : "bg-white/50 text-gray-400 cursor-not-allowed"
              }`}
            >
              Add
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="inline-flex bg-white/20 backdrop-blur-sm rounded-full p-1">
            {["all", "active", "completed"].map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${
                  filter === filterType ? "bg-white text-green-600 shadow-lg" : "text-white hover:text-green-100"
                }`}
              >
                {filterType}
                {filterType === "all" && ` (${totalTasks})`}
                {filterType === "active" && ` (${activeTasks})`}
                {filterType === "completed" && ` (${completedTasks})`}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-3 mb-6">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <Task key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />
            ))
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-white text-lg font-medium mb-2">
                {filter === "completed" && completedTasks === 0 && "No completed tasks yet"}
                {filter === "active" && activeTasks === 0 && "All tasks completed! 🎉"}
                {filter === "all" && totalTasks === 0 && "No tasks yet"}
              </h3>
              <p className="text-white/80 text-sm">
                {filter === "all" && "Add your first task to get started!"}
                {filter === "active" && "Time to celebrate your productivity!"}
                {filter === "completed" && "Complete some tasks to see them here."}
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {completedTasks > 0 && (
          <div className="mb-6">
            <button
              onClick={clearCompleted}
              className="w-full bg-white/10 backdrop-blur-sm text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
            >
              🧹 Clear {completedTasks} Completed Task{completedTasks !== 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* Stats */}
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

        {/* Home Button */}
        <div className="mt-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-full bg-white/10 backdrop-blur-sm text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskList;
