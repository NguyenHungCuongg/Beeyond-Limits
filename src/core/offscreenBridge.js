const OFFSCREEN_URL = "src/offscreen.html";

export function createOffscreenBridge(
  chromeApi,
  {
    delay = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) {
  let creating = null;

  async function ping() {
    let lastError;

    for (const waitTime of [0, 50, 100, 200]) {
      if (waitTime > 0) {
        await delay(waitTime);
      }

      try {
        const response = await chromeApi.runtime.sendMessage({
          type: "PING_OFFSCREEN",
          target: "offscreen",
        });
        if (response?.success && response.ready) {
          return true;
        }
        lastError = new Error(
          response?.error || "Offscreen document is not ready",
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Offscreen document is not ready");
  }

  async function createOrReuseDocument() {
    const contexts = await chromeApi.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chromeApi.runtime.getURL?.(OFFSCREEN_URL)].filter(Boolean),
    });

    if (contexts.length === 0) {
      await chromeApi.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play Pomodoro notifications and ambient focus sounds",
      });
    }

    await ping();
    return true;
  }

  async function ensure() {
    if (!creating) {
      creating = createOrReuseDocument().finally(() => {
        creating = null;
      });
    }

    return creating;
  }

  async function send(message) {
    await ensure();
    const response = await chromeApi.runtime.sendMessage({
      ...message,
      target: "offscreen",
    });

    if (!response?.success) {
      throw new Error(response?.error || "Offscreen operation failed");
    }

    return response;
  }

  return { ensure, send };
}
