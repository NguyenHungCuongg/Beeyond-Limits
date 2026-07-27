const DEFAULT_ERROR =
  "Unable to communicate with the Focus Session background service";

function extensionRuntimeError() {
  return new Error("Extension runtime is unavailable");
}

export function createFocusSessionClient(
  runtimeApi = globalThis.chrome?.runtime,
) {
  async function send(type, payload = {}) {
    if (!runtimeApi || typeof runtimeApi.sendMessage !== "function") {
      throw extensionRuntimeError();
    }

    const response = await runtimeApi.sendMessage({ type, ...payload });
    if (!response?.success) {
      throw new Error(response?.error || DEFAULT_ERROR);
    }
    return response;
  }

  return {
    getState() {
      return send("FOCUS_GET_STATE");
    },
    startSession(config = {}) {
      return send("FOCUS_START_SESSION", { config });
    },
    pauseSession(runtimeId) {
      return send("FOCUS_PAUSE_SESSION", runtimeId ? { runtimeId } : {});
    },
    resumeSession(runtimeId) {
      return send("FOCUS_RESUME_SESSION", runtimeId ? { runtimeId } : {});
    },
    abandonSession(runtimeId, reason = "user_stopped") {
      return send("FOCUS_ABANDON_SESSION", {
        ...(runtimeId ? { runtimeId } : {}),
        reason,
      });
    },
    startBreak(runtimeId, durationMinutes) {
      return send("FOCUS_START_BREAK", {
        ...(runtimeId ? { runtimeId } : {}),
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      });
    },
    skipBreak(runtimeId) {
      return send("FOCUS_SKIP_BREAK", runtimeId ? { runtimeId } : {});
    },
    updatePreferences(preferences) {
      return send("FOCUS_UPDATE_PREFERENCES", { preferences });
    },
    listTemplates() {
      return send("FOCUS_SESSION_TEMPLATE_LIST");
    },
    saveTemplate(template) {
      return send("FOCUS_SESSION_TEMPLATE_SAVE", { template });
    },
    updateTemplate(template) {
      return send("FOCUS_SESSION_TEMPLATE_UPDATE", { template });
    },
    duplicateTemplate(templateId) {
      return send("FOCUS_SESSION_TEMPLATE_DUPLICATE", { templateId });
    },
    deleteTemplate(templateId) {
      return send("FOCUS_SESSION_TEMPLATE_DELETE", { templateId });
    },
  };
}
