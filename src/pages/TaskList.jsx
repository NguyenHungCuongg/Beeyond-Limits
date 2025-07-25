import React, { useState, useEffect, useCallback } from "react";
import Task from "../components/Task";
import TaskStats from "../components/TaskStats";

// eslint-disable-next-line no-undef
const chromeStorage = typeof chrome !== "undefined" ? chrome.storage : null;

function TaskList({ onNavigate }) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskText, setNewTaskText] = useState("");
  const [filter, setFilter] = useState("all"); // all, active, completed

  // Save tasks function
  const saveTasks = useCallback(async (tasksToSave) => {
    try {
      if (chromeStorage && chromeStorage.local) {
        await chromeStorage.local.set({ tasks: tasksToSave });
      } else {
        // Fallback for development
        localStorage.setItem("beeyond-tasks", JSON.stringify(tasksToSave));
      }
    } catch (error) {
      console.error("Error saving tasks:", error);
    }
  }, []);

  // Load tasks from Chrome storage on component mount
  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check if chrome.storage is available (for extension environment)
      if (chromeStorage && chromeStorage.local) {
        const result = await chromeStorage.local.get(["tasks"]);
        if (result.tasks && Array.isArray(result.tasks)) {
          setTasks(result.tasks);
        } else {
          // Initialize with default tasks if no data exists
          const defaultTasks = [
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
          ];
          setTasks(defaultTasks);
          // Save default tasks
          if (chromeStorage && chromeStorage.local) {
            await chromeStorage.local.set({ tasks: defaultTasks });
          } else {
            localStorage.setItem("beeyond-tasks", JSON.stringify(defaultTasks));
          }
        }
      } else {
        // Fallback for development (localhost) - use localStorage
        const storedTasks = localStorage.getItem("beeyond-tasks");
        if (storedTasks) {
          setTasks(JSON.parse(storedTasks));
        } else {
          const defaultTasks = [];
          setTasks(defaultTasks);
          localStorage.setItem("beeyond-tasks", JSON.stringify(defaultTasks));
        }
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
      // Fallback to empty array if loading fails
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = async () => {
    if (newTaskText.trim()) {
      const newTask = {
        id: Date.now(),
        text: newTaskText.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      const updatedTasks = [newTask, ...tasks];
      setTasks(updatedTasks);
      await saveTasks(updatedTasks);
      setNewTaskText("");
    }
  };

  const toggleTask = async (taskId) => {
    const updatedTasks = tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task));
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  const deleteTask = async (taskId) => {
    const updatedTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  const editTask = async (taskId, newText) => {
    const updatedTasks = tasks.map((task) => (task.id === taskId ? { ...task, text: newText } : task));
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  const clearCompleted = async () => {
    const updatedTasks = tasks.filter((task) => !task.completed);
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
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

  return (
    <div className="h-full bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 font-primary overflow-auto">
      <div className="p-6">
        {/* Header với back button */}
        <div className="flex flex-col items-start mb-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors mr-4"
          >
            ←
          </button>
          <div className="flex-1 text-center self-center">
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
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-bounce">⏳</div>
              <h3 className="text-white text-lg font-medium mb-2">Loading your tasks...</h3>
              <p className="text-white/80 text-sm">Just a moment while we fetch your data</p>
            </div>
          ) : filteredTasks.length > 0 ? (
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
        <TaskStats tasks={tasks} />

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
