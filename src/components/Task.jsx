import React, { useState } from "react";
import { Check, Pencil, Trash } from "./Icons";

function Task({ task, onToggle, onDelete, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);

  const handleEdit = () => {
    if (isEditing) {
      if (editText.trim()) {
        onEdit(task.id, editText.trim());
      }
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleEdit();
    }
    if (e.key === "Escape") {
      setEditText(task.text);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`brutal-border brutal-shadow-sm p-3 flex items-center gap-3 mb-3 group hover:-translate-y-1 hover:brutal-shadow transition-all ${
        task.completed ? "bg-canvas opacity-70" : "bg-paper"
      }`}
    >
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={`${task.completed ? "Mark as active" : "Mark as completed"}: ${task.text}`}
        onClick={() => onToggle(task.id)}
        className={`w-6 h-6 brutal-border shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
          task.completed ? "bg-sapphire text-paper" : "bg-paper hover:bg-canvas"
        }`}
      >
        {task.completed && <Check size={14} />}
      </button>

      {/* Task Text */}
      <div className="flex-1">
        {isEditing ? (
          <input
            aria-label={`Edit task: ${task.text}`}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleEdit}
            className="w-full brutal-border bg-paper px-2 py-1 font-mono uppercase focus:outline-none"
            autoFocus
          />
        ) : (
          <span
            className={`font-sans font-bold text-lg text-ink uppercase ${
              task.completed ? "line-through" : ""
            }`}
          >
            {task.text}
          </span>
        )}

        {/* Task metadata */}
        <div className="flex items-center space-x-2 mt-1">
          <span className="font-mono text-[10px] font-bold uppercase border border-ink px-1">
            {new Date(task.createdAt).toLocaleDateString()}
          </span>
          {task.completed && (
            <span className="font-mono text-[10px] font-bold uppercase border border-ink px-1 flex items-center gap-1">
              DONE
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label={isEditing ? `Save task: ${task.text}` : `Edit task: ${task.text}`}
          onClick={handleEdit}
          className="w-8 h-8 brutal-border bg-paper hover:bg-canvas flex items-center justify-center text-ink"
          title={isEditing ? "Save" : "Edit"}
        >
          {isEditing ? <Check size={14} /> : <Pencil size={14} />}
        </button>

        <button
          type="button"
          aria-label={`Delete task: ${task.text}`}
          onClick={() => onDelete(task.id)}
          className="w-8 h-8 brutal-border bg-paper hover:bg-canvas flex items-center justify-center text-ink"
          title="Delete"
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
}

export default Task;
