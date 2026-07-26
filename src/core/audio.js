const POMODORO_AUDIO = Object.freeze({
  break: ["break_time_1.m4a", "break_time_2.m4a", "break_time_3.m4a"],
  focus: ["focus_time_1.m4a", "focus_time_2.m4a", "focus_time_3.m4a"],
});

function clampVolume(volume, fallback = 0.5) {
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : fallback;
}

export function getPomodoroAudioFiles(context, random = Math.random) {
  const candidates = POMODORO_AUDIO[context] ?? [];
  if (candidates.length === 0) {
    return ["pomodoro_alarm.m4a"];
  }

  const index = Math.min(
    candidates.length - 1,
    Math.floor(random() * candidates.length),
  );
  return ["pomodoro_alarm.m4a", candidates[index]];
}

export function createOffscreenAudioController({
  AudioCtor = globalThis.Audio,
  setTimeoutFn = globalThis.setTimeout,
} = {}) {
  if (typeof AudioCtor !== "function") {
    throw new Error("Audio API is unavailable");
  }

  const ambientSounds = new Map();
  let pomodoroQueue = Promise.resolve();

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function playUntilEnded(audioUrl, volume = 0.7) {
    return new Promise((resolve, reject) => {
      const audio = new AudioCtor(audioUrl);
      let settled = false;

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        callback(value);
      };

      audio.volume = clampVolume(volume, 0.7);
      audio.loop = false;
      audio.onended = () => finish(resolve);
      audio.onerror = () =>
        finish(reject, new Error(`Unable to play ${audioUrl}`));

      Promise.resolve(audio.play()).catch((error) => finish(reject, error));
    });
  }

  async function startAmbientSound(soundKey, audioUrl, volume) {
    if (!soundKey || !audioUrl) {
      throw new Error("Sound key and audio URL are required");
    }

    const existing = ambientSounds.get(soundKey);
    if (existing) {
      stopAudio(existing);
    }

    const audio = new AudioCtor(audioUrl);
    audio.loop = true;
    audio.volume = clampVolume(volume);
    ambientSounds.set(soundKey, audio);

    try {
      await audio.play();
    } catch (error) {
      ambientSounds.delete(soundKey);
      stopAudio(audio);
      throw error;
    }
  }

  function stopAmbientSound(soundKey) {
    const audio = ambientSounds.get(soundKey);
    if (audio) {
      stopAudio(audio);
      ambientSounds.delete(soundKey);
    }
  }

  function updateAmbientVolume(soundKey, volume) {
    const audio = ambientSounds.get(soundKey);
    if (!audio) {
      throw new Error(`Ambient sound is not active: ${soundKey}`);
    }
    audio.volume = clampVolume(volume);
  }

  function stopAllAmbientSounds() {
    for (const audio of ambientSounds.values()) {
      stopAudio(audio);
    }
    ambientSounds.clear();
  }

  async function testAmbientSound(audioUrl, volume) {
    const audio = new AudioCtor(audioUrl);
    audio.loop = false;
    audio.volume = clampVolume(volume);
    await audio.play();
    setTimeoutFn(() => stopAudio(audio), 3000);
  }

  function playPomodoroAudio(audioUrls) {
    if (!Array.isArray(audioUrls) || audioUrls.length === 0) {
      return Promise.reject(new Error("Pomodoro audio sequence is empty"));
    }

    const sequence = async () => {
      for (const audioUrl of audioUrls) {
        await playUntilEnded(audioUrl);
      }
    };

    const next = pomodoroQueue.then(sequence, sequence);
    pomodoroQueue = next.catch(() => {});
    return next;
  }

  return {
    playPomodoroAudio,
    startAmbientSound,
    stopAmbientSound,
    stopAllAmbientSounds,
    testAmbientSound,
    updateAmbientVolume,
  };
}

export function createOffscreenMessageHandler(controller) {
  return async function handleOffscreenMessage(message) {
    try {
      switch (message.type) {
        case "PING_OFFSCREEN":
          return { success: true, ready: true };
        case "PLAY_POMODORO_AUDIO":
          await controller.playPomodoroAudio(message.audioUrls);
          return { success: true };
        case "START_AMBIENT_SOUND":
          await controller.startAmbientSound(
            message.soundKey,
            message.audioUrl,
            message.volume,
          );
          return { success: true };
        case "STOP_AMBIENT_SOUND":
          controller.stopAmbientSound(message.soundKey);
          return { success: true };
        case "UPDATE_AMBIENT_VOLUME":
          controller.updateAmbientVolume(message.soundKey, message.volume);
          return { success: true };
        case "STOP_ALL_AMBIENT_SOUNDS":
          controller.stopAllAmbientSounds();
          return { success: true };
        case "TEST_AMBIENT_SOUND":
          await controller.testAmbientSound(message.audioUrl, message.volume);
          return { success: true };
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
