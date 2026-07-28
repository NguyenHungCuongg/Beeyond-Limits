import React, { useState, useEffect } from "react";

// eslint-disable-next-line no-undef
const chromeStorage = typeof chrome !== "undefined" ? chrome.storage : null;

export default function SessionGoalField({ value, onChange }) {
  const [activeTasks, setActiveTasks] = useState([]);
  const [mode, setMode] = useState(value?.type === "task" ? "task" : "text");

  useEffect(() => {
    async function fetchTasks() {
      if (chromeStorage && chromeStorage.local) {
        const result = await chromeStorage.local.get(["tasks"]);
        if (result.tasks && Array.isArray(result.tasks)) {
          setActiveTasks(result.tasks.filter((t) => !t.completed));
        }
      } else {
        const stored = localStorage.getItem("beeyond-tasks");
        if (stored) {
          const parsed = JSON.parse(stored);
          setActiveTasks(parsed.filter((t) => !t.completed));
        }
      }
    }
    fetchTasks();
  }, []);

  const handleTextChange = (e) => {
    onChange({ type: "text", text: e.target.value, taskId: null });
  };

  const handleTaskSelect = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      onChange({ type: "text", text: "", taskId: null });
      setMode("text");
      return;
    }
    const task = activeTasks.find((t) => String(t.id) === selectedId);
    if (task) {
      onChange({ type: "task", text: task.text, taskId: task.id });
    }
  };

  return (
    <div className="mb-5">
      <div className="flex justify-between items-end mb-2">
        <label
          htmlFor="focus-goal"
          className="font-mono font-bold uppercase text-xs"
        >
          What will you focus on?
        </label>
        {activeTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setMode(mode === "text" ? "task" : "text")}
            className="font-mono text-xs font-bold uppercase text-sapphire hover:underline focus:outline-none"
          >
            {mode === "text" ? "Choose task ▼" : "Write goal"}
          </button>
        )}
      </div>

      {mode === "text" ? (
        <input
          id="focus-goal"
          type="text"
          value={value?.type === "text" ? value.text : ""}
          maxLength={120}
          onChange={handleTextChange}
          placeholder="Write a short goal..."
          className="w-full brutal-border brutal-shadow-sm px-3 py-3 bg-paper font-mono focus:outline-none focus:bg-canvas"
        />
      ) : (
        <select
          id="focus-goal"
          value={
            value?.type === "task" && value.taskId != null
              ? String(value.taskId)
              : ""
          }
          onChange={handleTaskSelect}
          className="w-full brutal-border brutal-shadow-sm px-3 py-3 bg-paper font-mono focus:outline-none focus:bg-canvas appearance-none cursor-pointer"
        >
          <option value="">Select an active task...</option>
          {activeTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.text}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
