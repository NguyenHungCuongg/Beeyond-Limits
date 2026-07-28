import React, { useState } from "react";
import { ChevronLeft, Play, Pencil, Copy, Trash } from "../components/Icons";
import ConfirmDialog from "../components/ConfirmDialog";
import toast from "react-hot-toast";

function SavedSessions({ onNavigate, focusSession, onSelectTemplate }) {
  const templates = focusSession.templates || [];
  const [templateToDelete, setTemplateToDelete] = useState(null);

  async function startTemplate(template) {
    onSelectTemplate?.(template);
    onNavigate("focus-setup");
  }

  async function handleDuplicate(template) {
    try {
      await focusSession.duplicateTemplate(template.id);
      toast.success("Template duplicated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to duplicate template");
    }
  }

  async function handleDeleteConfirm() {
    if (!templateToDelete) return;
    try {
      await focusSession.deleteTemplate(templateToDelete.id);
      toast.success("Template deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template");
    } finally {
      setTemplateToDelete(null);
    }
  }

  return (
    <div className="bg-canvas min-h-screen text-ink p-5 overflow-auto pb-20">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="font-mono text-sm font-bold uppercase flex items-center gap-2 mb-5 hover:opacity-70 transition-opacity"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <p className="font-mono text-xs font-bold uppercase mb-2">Library</p>
        <h1 className="font-display text-5xl uppercase leading-none mb-6">
          Saved Sessions
        </h1>

        {focusSession.error && (
          <div className="bg-paper brutal-border brutal-shadow p-5 mb-5 text-center">
            <h2 className="font-display text-2xl uppercase text-crimson mb-2">
              Error Loading
            </h2>
            <p className="font-mono text-xs mb-4 text-ink/80">
              {focusSession.error}
            </p>
            <button
              onClick={() => focusSession.refresh()}
              className="w-full bg-mustard brutal-border font-mono text-xs font-bold uppercase py-2 hover:bg-ink hover:text-mustard transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {focusSession.isLoading && !focusSession.error ? (
          <div
            role="status"
            className="bg-paper brutal-border p-5 font-mono uppercase text-xs animate-pulse"
          >
            Loading sessions...
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-paper border-2 border-ink border-dashed p-5 text-center">
            <p className="font-display text-3xl uppercase">No templates yet</p>
            <p className="font-mono text-xs mt-2 text-ink/60">
              Save a setup after the Session Setup flow is enabled.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-paper brutal-border brutal-shadow p-4 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <h2 className="font-display text-2xl uppercase leading-tight truncate">
                      {template.name}
                    </h2>
                    <p className="font-mono text-xs uppercase mt-1 text-ink/60">
                      {template.focusDuration}m focus · {template.breakDuration}
                      m break
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTemplate(template)}
                    className="bg-mustard brutal-border brutal-shadow-sm p-3 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all"
                    aria-label={"Use " + template.name}
                  >
                    <Play size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-2 border-t-2 border-ink pt-3">
                  <button
                    type="button"
                    onClick={() => startTemplate(template)}
                    className="flex-1 font-mono text-[10px] font-bold uppercase py-2 bg-canvas brutal-border hover:bg-mustard transition-colors flex items-center justify-center gap-2"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(template)}
                    className="flex-1 font-mono text-[10px] font-bold uppercase py-2 bg-canvas brutal-border hover:bg-sapphire hover:text-paper transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateToDelete(template)}
                    className="flex-1 font-mono text-[10px] font-bold uppercase py-2 bg-canvas brutal-border hover:bg-crimson hover:text-paper transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash size={14} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {templateToDelete && (
        <ConfirmDialog
          title="Delete Template?"
          message={`Are you sure you want to delete "${templateToDelete.name}"?`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setTemplateToDelete(null)}
          isDestructive
        />
      )}
    </div>
  );
}

export default SavedSessions;
