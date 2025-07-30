// Offscreen document for audio playback
/* global chrome */

console.log("=== OFFSCREEN DOCUMENT STARTING ===");
console.log("Document URL:", document.URL);
console.log("Document ready state:", document.readyState);

// Map to store active ambient sounds
const ambientSounds = new Map();
let audioEnabled = false;

// Simple auto-enable function
function enableAudio() {
  console.log("=== ENABLING AUDIO ===");

  // Find the button if it exists
  const button = document.getElementById("enable-audio");
  if (button) {
    console.log("Found enable-audio button");

    button.addEventListener("click", () => {
      console.log("=== BUTTON CLICKED ===");
      audioEnabled = true;
      button.style.display = "none";

      // Try to play silent audio
      const audio = new Audio();
      audio.volume = 0;
      audio.src =
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEeCitX2PDNeSsFInDF8N6SQgqgQaLd7KhVFAhKeOC0vmMeGCtE2PHLeSsFInDF8N6SQgocSKDe7KhVFwpKd+Cwf2EeGCtE2PHLeSsFInDF8N6SQgocSKDe7KhVFwpKd+Cwf2EeGCtE2PHLeSsFInDF8N6SQgocSKDe7KhVFwpKd+Cwf2EeGCtE2PHLeSsFInDF8N6SQggQaLrt4YJSEg1Sn+DjvWcfGyd82PLEeSACJHfM9d2OPwgVYLbp4Z1TFApKfudF3fCOPwgVYLbp4Z1TFApKfudF3fCOPwgVYLbp4Z1TFApKfudF3fCOPwgVYLbp4Z1T";

      audio
        .play()
        .then(() => {
          console.log("=== AUDIO CONTEXT ENABLED VIA OFFSCREEN BUTTON CLICK ===");
        })
        .catch((e) => {
          console.log("Audio play failed:", e);
        });
    });

    // Auto-click after a short delay
    setTimeout(() => {
      console.log("Auto-clicking button...");
      button.click();
    }, 500);
  } else {
    console.error("❌ Could not find enable-audio button!");
  }
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  console.log("DOM loading, waiting for DOMContentLoaded...");
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded fired, enabling audio...");
    enableAudio();
  });
} else {
  console.log("DOM already ready, enabling audio immediately...");
  enableAudio();
}

console.log("=== Setting up message listener ===");

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("=== OFFSCREEN RECEIVED MESSAGE ===");
  console.log("Message type:", message.type);
  console.log("Message target:", message.target);
  console.log("Full message:", message);
  console.log("Sender:", sender);

  // Only process messages for offscreen
  if (message.target && message.target !== "offscreen") {
    console.log("Message not for offscreen, ignoring");
    return false;
  }

  try {
    if (message.type === "PING_OFFSCREEN") {
      console.log("=== PING RECEIVED - OFFSCREEN IS READY ===");
      sendResponse({ success: true, ready: true, audioEnabled: audioEnabled });
    } else if (message.type === "START_AMBIENT_SOUND") {
      console.log("=== PROCESSING START_AMBIENT_SOUND ===");
      startAmbientSound(message.soundKey, message.audioUrl, message.volume);
      sendResponse({ success: true });
    } else if (message.type === "STOP_AMBIENT_SOUND") {
      console.log("=== PROCESSING STOP_AMBIENT_SOUND ===");
      stopAmbientSound(message.soundKey);
      sendResponse({ success: true });
    } else if (message.type === "UPDATE_AMBIENT_VOLUME") {
      console.log("=== PROCESSING UPDATE_AMBIENT_VOLUME ===");
      updateAmbientVolume(message.soundKey, message.volume);
      sendResponse({ success: true });
    } else if (message.type === "STOP_ALL_AMBIENT_SOUNDS") {
      console.log("=== PROCESSING STOP_ALL_AMBIENT_SOUNDS ===");
      stopAllAmbientSounds();
      sendResponse({ success: true });
    } else if (message.type === "TEST_AMBIENT_SOUND") {
      console.log("=== PROCESSING TEST_AMBIENT_SOUND ===");
      testAmbientSound(message.soundKey, message.audioUrl, message.volume);
      sendResponse({ success: true });
    } else {
      console.log("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
    }
  } catch (error) {
    console.error("Error processing message:", error);
    sendResponse({ success: false, error: error.message });
  }

  return true; // Keep message channel open
});

function startAmbientSound(soundKey, audioUrl, volume) {
  try {
    console.log(`=== STARTING AMBIENT SOUND ===`);
    console.log(`Sound: ${soundKey}, URL: ${audioUrl}, Volume: ${volume}`);

    // Stop existing sound if any
    const existingAudio = ambientSounds.get(soundKey);
    if (existingAudio) {
      console.log(`Stopping existing ${soundKey}`);
      existingAudio.pause();
      existingAudio.currentTime = 0;
    }

    // Create new audio
    const audio = new Audio();
    audio.src = audioUrl;
    audio.loop = true;
    audio.volume = volume;
    audio.preload = "auto";

    // Store immediately
    ambientSounds.set(soundKey, audio);
    console.log(`Stored ${soundKey} in map`);

    // Add event listeners
    audio.addEventListener("loadstart", () => console.log(`${soundKey}: Load started`));
    audio.addEventListener("canplay", () => console.log(`${soundKey}: Can play`));
    audio.addEventListener("play", () => console.log(`${soundKey}: Playing`));
    audio.addEventListener("error", (e) => console.error(`${soundKey} error:`, e));

    // Try to play
    audio.load();
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`✅ ${soundKey} started successfully`);
        })
        .catch((error) => {
          console.warn(`⚠️ ${soundKey} autoplay blocked:`, error);

          // Try again with user gesture simulation
          setTimeout(() => {
            const btn = document.createElement("button");
            btn.style.display = "none";
            document.body.appendChild(btn);

            btn.addEventListener("click", () => {
              audio
                .play()
                .then(() => console.log(`✅ ${soundKey} started after interaction`))
                .catch((e) => console.log(`❌ ${soundKey} still failed:`, e));
              document.body.removeChild(btn);
            });

            btn.click();
          }, 100);
        });
    }

    console.log(`${soundKey} setup complete`);
  } catch (error) {
    console.error(`Error starting ${soundKey}:`, error);
  }
}

function stopAmbientSound(soundKey) {
  try {
    console.log(`=== STOPPING AMBIENT SOUND: ${soundKey} ===`);

    const audio = ambientSounds.get(soundKey);
    if (audio) {
      console.log(`Found ${soundKey}, stopping...`);
      audio.pause();
      audio.currentTime = 0;
      ambientSounds.delete(soundKey);
      console.log(`✅ ${soundKey} stopped and removed`);
    } else {
      console.warn(`⚠️ No audio found for ${soundKey}`);
    }
  } catch (error) {
    console.error(`Error stopping ${soundKey}:`, error);
  }
}

function updateAmbientVolume(soundKey, volume) {
  try {
    console.log(`=== UPDATING VOLUME: ${soundKey} to ${volume} ===`);

    const audio = ambientSounds.get(soundKey);
    if (audio) {
      console.log(`Found ${soundKey}, updating volume...`);
      audio.volume = volume;
      console.log(`✅ ${soundKey} volume updated to ${volume}`);
    } else {
      console.warn(`⚠️ No audio found for ${soundKey}`);
    }
  } catch (error) {
    console.error(`Error updating volume for ${soundKey}:`, error);
  }
}

function stopAllAmbientSounds() {
  try {
    console.log("=== STOPPING ALL AMBIENT SOUNDS ===");

    for (const [soundKey, audio] of ambientSounds) {
      audio.pause();
      audio.currentTime = 0;
    }

    ambientSounds.clear();
    console.log("✅ All ambient sounds stopped");
  } catch (error) {
    console.error("Error stopping all sounds:", error);
  }
}

function testAmbientSound(soundKey, audioUrl, volume) {
  try {
    console.log(`=== TESTING SOUND: ${soundKey} ===`);

    const audio = new Audio(audioUrl);
    audio.volume = volume;
    audio.loop = false;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`✅ Test sound ${soundKey} playing`);
        })
        .catch((error) => {
          console.warn(`⚠️ Test sound ${soundKey} blocked:`, error);
        });
    }

    // Stop after 3 seconds
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      console.log(`Test sound ${soundKey} stopped`);
    }, 3000);
  } catch (error) {
    console.error(`Error testing ${soundKey}:`, error);
  }
}

console.log("=== OFFSCREEN SCRIPT LOADED ===");
