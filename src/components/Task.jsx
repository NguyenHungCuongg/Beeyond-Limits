import React, { useState } from "react";

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
      className={`group bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-white/20 transition-all duration-300 ${
        task.completed ? "opacity-75" : "hover:shadow-lg hover:scale-[1.01]"
      }`}
    >
      <div className="flex items-center space-x-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task.id)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            task.completed
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-green-400 hover:bg-green-50"
          }`}
        >
          {task.completed && "✓"}
        </button>

        {/* Task Text */}
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleEdit}
              className="w-full bg-transparent border-none outline-none text-gray-800 font-medium focus:ring-2 focus:ring-green-400 rounded px-2 py-1"
              autoFocus
            />
          ) : (
            <span
              className={`font-medium transition-all duration-300 ${
                task.completed ? "text-gray-500 line-through" : "text-gray-800 group-hover:text-green-600"
              }`}
            >
              {task.text}
            </span>
          )}

          {/* Task metadata */}
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-gray-500">{new Date(task.createdAt).toLocaleDateString()}</span>
            {task.completed && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">✓ Completed</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={`flex items-center space-x-2 transition-opacity duration-300 ${
            isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {/* Edit Button */}
          <button
            onClick={handleEdit}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isEditing
                ? "bg-green-100 text-green-600 hover:bg-green-200"
                : "bg-blue-100 text-blue-600 hover:bg-blue-200"
            }`}
            title={isEditing ? "Save" : "Edit"}
          >
            {isEditing ? "✓" : "✏️"}
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(task.id)}
            className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-200 transition-colors"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

export default Task;
