// Offscreen document for audio playback
console.log("Offscreen audio manager loaded");

// Map to store active ambient sounds
const ambientSounds = new Map();

// Track if audio context has been enabled by user
let audioEnabled = false;

// Create initial user interaction
document.addEventListener("DOMContentLoaded", () => {
  // Automatically trigger a user gesture to enable audio
  setTimeout(() => {
    // Simulate user interaction to enable Web Audio API
    const enableAudio = () => {
      console.log("Attempting to enable audio context");

      // Create a silent audio to enable audio context
      try {
        const silentAudio = new Audio();
        silentAudio.volume = 0;
        silentAudio
          .play()
          .then(() => {
            console.log("Audio context enabled successfully");
            audioEnabled = true;
          })
          .catch(() => {
            console.log("Still need user interaction for audio");
          });
      } catch (error) {
        console.log("Audio context setup failed:", error);
      }
    };

    enableAudio();
  }, 100);
});

// Auto-enable audio on any interaction
document.addEventListener("click", () => {
  if (!audioEnabled) {
    audioEnabled = true;
    console.log("Audio enabled via user interaction");
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Offscreen received message:", message);

  if (message.type === "START_AMBIENT_SOUND") {
    startAmbientSound(message.soundKey, message.audioUrl, message.volume);
    sendResponse({ success: true });
  } else if (message.type === "STOP_AMBIENT_SOUND") {
    stopAmbientSound(message.soundKey);
    sendResponse({ success: true });
  } else if (message.type === "UPDATE_AMBIENT_VOLUME") {
    updateAmbientVolume(message.soundKey, message.volume);
    sendResponse({ success: true });
  } else if (message.type === "STOP_ALL_AMBIENT_SOUNDS") {
    stopAllAmbientSounds();
    sendResponse({ success: true });
  } else if (message.type === "TEST_AMBIENT_SOUND") {
    testAmbientSound(message.soundKey, message.audioUrl, message.volume);
    sendResponse({ success: true });
  }

  return true; // Keep message channel open
});

function startAmbientSound(soundKey, audioUrl, volume) {
  try {
    console.log(`Offscreen starting ambient sound: ${soundKey} at volume ${volume} from ${audioUrl}`);

    // Stop existing sound if any
    stopAmbientSound(soundKey);

    // Create new audio element with better setup
    const audio = new Audio();
    audio.src = audioUrl;
    audio.loop = true; // Loop ambient sounds
    audio.volume = volume;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";

    // Try to set audio to autoplay (this might help)
    audio.autoplay = false; // Don't use autoplay as it's blocked

    // Store in ambient sounds map immediately
    ambientSounds.set(soundKey, audio);

    // Add event listeners for debugging
    audio.addEventListener("loadstart", () => console.log(`Offscreen ${soundKey}: Load started`));
    audio.addEventListener("loadeddata", () => console.log(`Offscreen ${soundKey}: Data loaded`));
    audio.addEventListener("loadedmetadata", () => console.log(`Offscreen ${soundKey}: Metadata loaded`));
    audio.addEventListener("canplay", () => {
      console.log(`Offscreen ${soundKey}: Can play`);
      // Try to play when can play
      if (!audio.paused && audio.currentTime === 0) {
        console.log(`Offscreen ${soundKey}: Auto-attempting play from canplay`);
        tryPlayAudio(audio, soundKey);
      }
    });
    audio.addEventListener("canplaythrough", () => console.log(`Offscreen ${soundKey}: Can play through`));
    audio.addEventListener("play", () => console.log(`Offscreen ${soundKey}: Playing with loop=${audio.loop}`));
    audio.addEventListener("playing", () => console.log(`Offscreen ${soundKey}: Actually playing now`));
    audio.addEventListener("pause", () => console.log(`Offscreen ${soundKey}: Paused`));
    audio.addEventListener("error", (e) => {
      console.error(`Offscreen ${soundKey} error:`, e);
      console.error(`Error details:`, e.target.error);
    });
    audio.addEventListener("ended", () => console.log(`Offscreen ${soundKey}: Ended (should loop)`));

    // Function to try playing audio
    const tryPlayAudio = (audioElement, key) => {
      const playPromise = audioElement.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Offscreen ambient sound ${key} started successfully`);
          })
          .catch((error) => {
            console.warn(`Offscreen ambient sound ${key} autoplay blocked:`, error);

            // Try different approaches
            setTimeout(() => {
              console.log(`Retrying audio ${key} after delay...`);
              audioElement.play().catch((e) => {
                console.log(`Retry failed for ${key}:`, e);

                // Last resort: wait for user to interact with ANY page
                console.log(`${key} waiting for user interaction...`);
                const waitForInteraction = () => {
                  audioElement
                    .play()
                    .then(() => {
                      console.log(`${key} finally started after waiting!`);
                    })
                    .catch((err) => {
                      console.log(`${key} still failed:`, err);
                    });
                };

                // Try again in a few seconds
                setTimeout(waitForInteraction, 3000);
              });
            }, 1000);
          });
      }
    };

    // Load the audio
    audio.load();

    // Try to play immediately
    console.log(`Attempting immediate play for ${soundKey}`);
    tryPlayAudio(audio, soundKey);

    console.log(`Offscreen ambient sound ${soundKey} setup complete`);
  } catch (error) {
    console.error(`Offscreen error starting ambient sound ${soundKey}:`, error);
  }
}

function stopAmbientSound(soundKey) {
  try {
    console.log(`Offscreen stopping ambient sound: ${soundKey}`);

    const audio = ambientSounds.get(soundKey);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      ambientSounds.delete(soundKey);
      console.log(`Offscreen ambient sound ${soundKey} stopped`);
    }
  } catch (error) {
    console.error(`Offscreen error stopping ambient sound ${soundKey}:`, error);
  }
}

function updateAmbientVolume(soundKey, volume) {
  try {
    console.log(`Offscreen updating volume for ${soundKey}: ${volume}`);

    const audio = ambientSounds.get(soundKey);
    if (audio) {
      audio.volume = volume;
      console.log(`Offscreen volume updated for ${soundKey}`);
    }
  } catch (error) {
    console.error(`Offscreen error updating volume for ${soundKey}:`, error);
  }
}

function stopAllAmbientSounds() {
  try {
    console.log("Offscreen stopping all ambient sounds");

    for (const [soundKey, audio] of ambientSounds) {
      audio.pause();
      audio.currentTime = 0;
    }

    ambientSounds.clear();
    console.log("Offscreen all ambient sounds stopped");
  } catch (error) {
    console.error("Offscreen error stopping all ambient sounds:", error);
  }
}

function testAmbientSound(soundKey, audioUrl, volume) {
  try {
    console.log(`Offscreen testing ambient sound: ${soundKey} at volume ${volume} from ${audioUrl}`);

    // Create temporary audio for testing (non-looping)
    const audio = new Audio(audioUrl);
    audio.volume = volume;
    audio.loop = false; // Don't loop for test

    // Add event listeners for debugging
    audio.addEventListener("loadstart", () => console.log(`Offscreen test ${soundKey}: Load started`));
    audio.addEventListener("loadeddata", () => console.log(`Offscreen test ${soundKey}: Data loaded`));
    audio.addEventListener("canplay", () => console.log(`Offscreen test ${soundKey}: Can play`));
    audio.addEventListener("play", () => console.log(`Offscreen test ${soundKey}: Playing`));
    audio.addEventListener("error", (e) => console.error(`Offscreen test ${soundKey} error:`, e));

    // Try to play
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`Offscreen test sound ${soundKey} playing successfully`);
        })
        .catch((error) => {
          console.warn(`Offscreen test sound ${soundKey} autoplay blocked:`, error);
        });
    }

    // Stop after 3 seconds
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      console.log(`Offscreen test sound ${soundKey} stopped`);
    }, 3000);
  } catch (error) {
    console.error(`Offscreen error testing ambient sound ${soundKey}:`, error);
  }
}
