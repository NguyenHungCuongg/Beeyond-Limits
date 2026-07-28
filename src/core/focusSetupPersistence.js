export function createFocusSetupPersistence(persistConfig) {
  if (typeof persistConfig !== "function") {
    throw new TypeError("persistConfig must be a function");
  }

  let activePromise = null;
  let lastError = null;
  let queuedConfig;
  let hasQueuedConfig = false;

  async function drain() {
    try {
      while (hasQueuedConfig) {
        const nextConfig = queuedConfig;
        queuedConfig = undefined;
        hasQueuedConfig = false;
        await persistConfig(nextConfig);
        lastError = null;
      }
    } catch (error) {
      lastError = error;
      throw error;
    } finally {
      activePromise = null;
    }
  }

  return {
    save(config) {
      queuedConfig = config;
      hasQueuedConfig = true;
      lastError = null;
      if (!activePromise) {
        activePromise = drain();
      }
      return activePromise;
    },
    flush() {
      if (activePromise) {
        return activePromise;
      }
      return lastError ? Promise.reject(lastError) : Promise.resolve();
    },
  };
}
