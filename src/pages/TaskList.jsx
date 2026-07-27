import React, { useState, useEffect, useCallback } from "react";
import Task from "../components/Task";
import TaskStats from "../components/TaskStats";
import { ChevronLeft, Loader, ClipboardCheck, Trash, Home } from "../components/Icons";

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
          const defaultTasks = [];
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
    const updatedTasks = tasks.map((task) => {
      if (task.id === taskId) {
        const isCompleted = !task.completed;
        return {
          ...task,
          completed: isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : null
        };
      }
      return task;
    });
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
    <div className="bg-canvas min-h-screen text-ink p-5">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col items-start">
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-1.5 font-mono font-bold uppercase hover:opacity-70 transition-opacity mb-4"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <div className="flex-1">
            <h1 className="font-display text-6xl uppercase">Task Manager</h1>
          </div>
        </div>

        {/* Form */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="What needs to be done?"
            className="flex-1 brutal-border brutal-shadow-sm px-4 py-3 bg-paper font-mono focus:outline-none focus:bg-canvas placeholder:text-ink/50 uppercase"
          />
          <button
            onClick={addTask}
            disabled={!newTaskText.trim()}
            className="bg-sapphire text-paper brutal-border brutal-shadow-sm px-5 font-display text-2xl uppercase hover:bg-ink transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex">
          <div className="flex">
            {["all", "active", "completed"].map((filterType, index, arr) => {
              const isActive = filter === filterType;
              const isLast = index === arr.length - 1;
              return (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`brutal-border font-mono font-bold uppercase text-xs py-2 px-3 ${
                    !isLast ? "border-r-0" : ""
                  } ${isActive ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-canvas"}`}
                >
                  {filterType}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tasks List */}
        <div className="mb-6">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader size={32} className="mx-auto mb-4 animate-spin text-ink" />
              <h3 className="font-display text-3xl uppercase">Loading</h3>
            </div>
          ) : filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <Task key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />
            ))
          ) : (
            <div className="text-center py-12 bg-paper brutal-border brutal-shadow-sm p-6">
              <ClipboardCheck size={64} className="mx-auto mb-4 text-ink" />
              <h3 className="font-display text-3xl uppercase">
                {filter === "completed" && completedTasks === 0 && "No completed tasks yet"}
                {filter === "active" && activeTasks === 0 && "All tasks completed!"}
                {filter === "all" && totalTasks === 0 && "No tasks yet"}
              </h3>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {completedTasks > 0 && (
          <div className="mb-6">
            <button
              onClick={clearCompleted}
              className="w-full flex items-center justify-center gap-2 bg-paper text-ink font-mono font-bold uppercase py-3 brutal-border brutal-shadow-sm hover:bg-canvas transition-colors"
            >
              <Trash size={16} /> Clear {completedTasks} Completed
            </button>
          </div>
        )}

        {/* Stats */}
        <TaskStats tasks={tasks} />

        {/* Home Button */}
        <button
          onClick={() => onNavigate("home")}
          className="w-full flex items-center justify-center gap-2 bg-paper text-ink font-mono font-bold uppercase py-3 brutal-border brutal-shadow-sm hover:bg-canvas transition-colors mt-6"
        >
          <Home size={16} /> Back to Home
        </button>
      </div>
    </div>
  );
}

export default TaskList;
