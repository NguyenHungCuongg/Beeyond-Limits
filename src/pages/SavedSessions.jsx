import { ChevronLeft, Play } from "../components/Icons";

function SavedSessions({ onNavigate, focusSession, onSelectTemplate }) {
  const templates = focusSession.templates || [];

  async function startTemplate(template) {
    onSelectTemplate?.(template);
    onNavigate("focus-setup");
  }

  return (
    <div className="bg-canvas min-h-screen text-ink p-5 overflow-auto">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="font-mono text-sm font-bold uppercase flex items-center gap-2 mb-5"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <p className="font-mono text-xs font-bold uppercase mb-2">Library</p>
        <h1 className="font-display text-5xl uppercase leading-none mb-6">
          Saved Sessions
        </h1>

        {focusSession.isLoading ? (
          <div
            role="status"
            className="bg-paper brutal-border p-5 font-mono uppercase text-xs"
          >
            Loading sessions...
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-paper brutal-border brutal-shadow p-5">
            <p className="font-display text-3xl uppercase">No templates yet</p>
            <p className="font-mono text-xs mt-2">
              Save a setup after the Session Setup flow is enabled.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-paper brutal-border brutal-shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl uppercase">
                      {template.name}
                    </h2>
                    <p className="font-mono text-xs uppercase mt-1">
                      {template.focusDuration}m focus · {template.breakDuration}
                      m break
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTemplate(template)}
                    className="bg-mustard brutal-border brutal-shadow-sm p-2"
                    aria-label={"Use " + template.name}
                  >
                    <Play size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SavedSessions;
