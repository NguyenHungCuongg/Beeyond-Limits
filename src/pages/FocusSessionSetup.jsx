import { useMemo, useRef, useState } from "react";
import { ChevronLeft, Play, Save } from "../components/Icons";
import SessionGoalField from "../components/SessionGoalField";
import SessionDurationPicker from "../components/SessionDurationPicker";
import SessionEnvironment from "../components/SessionEnvironment";
import SessionBlockerEditor from "../components/SessionBlockerEditor";
import { normalizeFocusConfig } from "../core/focusSession.js";
import { createFocusSetupPersistence } from "../core/focusSetupPersistence.js";
import toast from "react-hot-toast";

function getInitialConfig(preferences, template) {
  const source = template || preferences || {};
  const ambientSound = normalizeFocusConfig({
    ambientSound: source.ambientSound,
  }).ambientSound;
  return {
    templateId: template ? template.id : null,
    focusDuration: source.focusDuration || 25,
    breakDuration: source.breakDuration || 5,
    goal: source.goal || { type: "text", text: "", taskId: null },
    blocker: {
      enabled: source.blocker?.enabled ?? source.blockerEnabled ?? true,
      presetId: source.blocker?.presetId || "default",
      blockedUrls: source.blocker?.blockedUrls || [],
    },
    ambientSound,
  };
}

function FocusSessionSetup({ onNavigate, focusSession, template = null }) {
  const initialConfig = useMemo(
    () => getInitialConfig(focusSession.preferences, template),
    [focusSession.preferences, template],
  );

  const [config, setConfig] = useState(initialConfig);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showBlockerEditor, setShowBlockerEditor] = useState(false);
  const [templateName, setTemplateName] = useState(
    template ? template.name : "",
  );
  const configRef = useRef(initialConfig);
  const persistConfigRef = useRef(null);
  const persistenceRef = useRef(null);
  const reportedSavePromiseRef = useRef(null);

  async function persistConfig(nextConfig) {
    if (template) {
      await focusSession.updateTemplate({
        ...template,
        focusDuration: nextConfig.focusDuration,
        breakDuration: nextConfig.breakDuration,
        goal: nextConfig.goal,
        blocker: nextConfig.blocker,
        ambientSound: nextConfig.ambientSound,
      });
      return;
    }

    await focusSession.updatePreferences(nextConfig);
  }

  persistConfigRef.current = persistConfig;
  if (!persistenceRef.current) {
    persistenceRef.current = createFocusSetupPersistence((nextConfig) =>
      persistConfigRef.current(nextConfig),
    );
  }

  function updateConfig(patch) {
    const nextConfig = { ...configRef.current, ...patch };
    configRef.current = nextConfig;
    setConfig(nextConfig);
    const savePromise = persistenceRef.current.save(nextConfig);
    if (reportedSavePromiseRef.current !== savePromise) {
      reportedSavePromiseRef.current = savePromise;
      void savePromise.catch(() => {
        toast.error("Could not save Focus Session settings");
      });
    }
  }

  async function handleStart(event) {
    if (event) event.preventDefault();
    try {
      await persistenceRef.current.flush();
      await focusSession.startSession(configRef.current);
      onNavigate("focus-active");
    } catch (error) {
      toast.error(error.message || "Failed to start session");
    }
  }

  async function handleSaveTemplate(event) {
    event.preventDefault();
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    try {
      await persistenceRef.current.flush();
      const latestConfig = configRef.current;
      const templateData = {
        name: templateName.trim(),
        focusDuration: latestConfig.focusDuration,
        breakDuration: latestConfig.breakDuration,
        goal: latestConfig.goal,
        blocker: latestConfig.blocker,
        ambientSound: latestConfig.ambientSound,
      };

      if (template && template.id) {
        templateData.id = template.id;
        await focusSession.updateTemplate(templateData);
        toast.success("Template updated");
      } else {
        await focusSession.saveTemplate(templateData);
        toast.success("Template saved");
      }
      setShowSaveTemplate(false);
    } catch (error) {
      toast.error(error.message || "Failed to save template");
    }
  }

  return (
    <div className="bg-canvas min-h-screen text-ink p-5 overflow-auto pb-20">
      <div className="max-w-md mx-auto h-full">
        {showBlockerEditor ? (
          <SessionBlockerEditor
            blockedUrls={config.blocker.blockedUrls || []}
            onUpdate={(urls) => {
              const isAdding = urls.length > (config.blocker.blockedUrls?.length || 0);
              updateConfig({
                blocker: {
                  ...config.blocker,
                  blockedUrls: urls,
                  ...(isAdding && { enabled: true }),
                },
              });
            }}
            onClose={() => setShowBlockerEditor(false)}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => onNavigate("home")}
              className="font-mono text-sm font-bold uppercase flex items-center gap-2 mb-5 hover:opacity-70 transition-opacity"
            >
              <ChevronLeft size={16} /> Back
            </button>

            <p className="font-mono text-xs font-bold uppercase mb-2">
              {template ? "Edit Session" : "New Focus Session"}
            </p>
            <h1 className="font-display text-5xl uppercase leading-none mb-6">
              Set the space.
            </h1>

            <form onSubmit={handleStart} className="space-y-0">
              <SessionGoalField
                value={config.goal}
                onChange={(goal) => updateConfig({ goal })}
              />

              <SessionDurationPicker
                focusDuration={config.focusDuration}
                breakDuration={config.breakDuration}
                onFocusChange={(focusDuration) =>
                  updateConfig({ focusDuration })
                }
                onBreakChange={(breakDuration) =>
                  updateConfig({ breakDuration })
                }
              />

              <SessionEnvironment
                blocker={config.blocker}
                ambientSound={config.ambientSound}
                onBlockerChange={(blocker) => updateConfig({ blocker })}
                onAmbientChange={(ambientSound) =>
                  updateConfig({ ambientSound })
                }
                onTestAmbientSound={focusSession.testAmbientSound}
                onEditBlocklist={() => setShowBlockerEditor(true)}
              />

              {focusSession.error && (
                <div
                  role="alert"
                  className="brutal-border bg-crimson text-paper p-3 font-mono text-xs mb-5"
                >
                  {focusSession.error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={focusSession.isBusy}
                  className="w-full flex items-center justify-center gap-2 bg-mustard text-ink brutal-border brutal-shadow font-display text-2xl uppercase py-3 disabled:opacity-50 hover:bg-ink hover:text-mustard transition-colors"
                >
                  <Play size={22} /> Start {config.focusDuration} Min Focus
                </button>

                {!showSaveTemplate ? (
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplate(true)}
                    className="w-full flex items-center justify-center gap-2 bg-paper text-ink brutal-border brutal-shadow-sm font-mono text-sm font-bold uppercase py-3 hover:bg-canvas transition-colors"
                  >
                    <Save size={16} />{" "}
                    {template ? "Edit Template Name" : "Save as Template"}
                  </button>
                ) : (
                  <div className="brutal-border brutal-shadow-sm bg-paper p-4">
                    <label
                      htmlFor="template-name"
                      className="font-mono font-bold uppercase text-xs block mb-2"
                    >
                      Template Name
                    </label>
                    <input
                      id="template-name"
                      type="text"
                      value={templateName}
                      maxLength={40}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Deep Work, Study 50..."
                      className="w-full brutal-border px-3 py-2 bg-canvas font-mono focus:outline-none focus:ring-2 focus:ring-ink mb-3"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSaveTemplate(false)}
                        className="flex-1 brutal-border py-2 font-mono font-bold uppercase text-xs bg-canvas hover:bg-paper transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim() || focusSession.isBusy}
                        className="flex-1 brutal-border py-2 font-mono font-bold uppercase text-xs bg-sapphire text-paper hover:bg-ink transition-colors disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default FocusSessionSetup;
