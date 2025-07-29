// Content script to manually check and block pages
/* global chrome */

let isPageBlocked = false;
let extensionContextValid = true;
let ambientSounds = new Map(); // Store active ambient audio objects

console.log("Beeyond Limits content script loaded");

// Safe wrapper for Chrome API calls
function safeChromeAPI(apiCall, fallback = null) {
  if (!extensionContextValid) {
    console.warn("Extension context invalid - skipping Chrome API call");
    return fallback;
  }

  try {
    return apiCall();
  } catch (error) {
    if (handleExtensionContextError(error)) {
      return fallback;
    }
    throw error;
  }
}

// Safe wrapper for async Chrome API calls
async function safeChromeAPIAsync(apiCall, fallback = null) {
  if (!extensionContextValid) {
    console.warn("Extension context invalid - skipping async Chrome API call");
    return fallback;
  }

  try {
    return await apiCall();
  } catch (error) {
    if (handleExtensionContextError(error)) {
      return fallback;
    }
    throw error;
  }
}

// Global error handler for extension context invalidation
function handleExtensionContextError(error) {
  if (error.message && error.message.includes("Extension context invalidated")) {
    console.warn("Extension context invalidated - stopping all operations");
    extensionContextValid = false;
    return true;
  }
  return false;
}

// Listen for messages from background script for audio playback
try {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!extensionContextValid) {
      sendResponse({ success: false, error: "Extension context invalidated" });
      return false;
    }

    console.log("Content script received message:", message);

    if (message.type === "PLAY_POMODORO_AUDIO") {
      playPomodoroAudio(message.context)
        .then(() => {
          console.log("Audio playback completed successfully");
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("Audio playback failed:", error);
          if (handleExtensionContextError(error)) {
            sendResponse({ success: false, error: "Extension context invalidated" });
          } else {
            sendResponse({ success: false, error: error.message });
          }
        });
      return true; // Keep message channel open for async response
    }

    // Ambient Sound Handlers
    if (message.type === "START_AMBIENT_SOUND") {
      console.log("Content script received START_AMBIENT_SOUND:", message);
      startAmbientSound(message.soundKey, message.audioUrl, message.volume);
      sendResponse({ success: true });
      return false;
    }

    if (message.type === "STOP_AMBIENT_SOUND") {
      console.log("Content script received STOP_AMBIENT_SOUND:", message);
      stopAmbientSound(message.soundKey);
      sendResponse({ success: true });
      return false;
    }

    if (message.type === "UPDATE_AMBIENT_VOLUME") {
      console.log("Content script received UPDATE_AMBIENT_VOLUME:", message);
      updateAmbientVolume(message.soundKey, message.volume);
      sendResponse({ success: true });
      return false;
    }

    if (message.type === "STOP_ALL_AMBIENT_SOUNDS") {
      console.log("Content script received STOP_ALL_AMBIENT_SOUNDS");
      stopAllAmbientSounds();
      sendResponse({ success: true });
      return false;
    }

    if (message.type === "TEST_AMBIENT_SOUND") {
      console.log("Content script received TEST_AMBIENT_SOUND:", message);
      testAmbientSound(message.soundKey, message.audioUrl, message.volume);
      sendResponse({ success: true });
      return false;
    }

    return false;
  });
} catch (error) {
  console.error("Failed to register message listener:", error);
  handleExtensionContextError(error);
}

// Audio playback function for Pomodoro
async function playPomodoroAudio(context) {
  try {
    console.log(`Playing Pomodoro audio for context: ${context}`);

    // Check if extension context is still valid
    if (!validateChromeAPI()) {
      throw new Error("Extension context invalidated - cannot play audio");
    }

    // Create audio elements with proper URLs - wrap in try-catch
    let alarmUrl, alarmAudio;
    try {
      alarmUrl = safeChromeAPI(() => chrome.runtime.getURL("audio/pomodoro_alarm.m4a"));
      if (!alarmUrl) {
        throw new Error("Cannot get alarm audio URL - extension context invalid");
      }
      alarmAudio = new Audio(alarmUrl);
    } catch (error) {
      if (handleExtensionContextError(error)) {
        throw new Error("Extension context invalidated during audio URL creation");
      }
      throw error;
    }

    console.log(`Alarm audio URL: ${alarmUrl}`);

    // Get random context audio
    const contextAudio = getRandomContextAudio(context);

    if (!contextAudio) {
      console.error("No audio file found for context:", context);
      throw new Error(`No audio file found for context: ${context}`);
    }

    // Play alarm first
    console.log("Playing alarm audio...");
    alarmAudio.volume = 0.7;
    await playAudio(alarmAudio);

    // Wait a bit, then play context audio
    console.log("Playing context audio...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    contextAudio.volume = 0.6;
    await playAudio(contextAudio);

    console.log("Audio sequence completed successfully");
  } catch (error) {
    console.error("Error playing Pomodoro audio:", error);
    throw error;
  }
}

function getRandomContextAudio(context) {
  const audioFiles = {
    break: ["break_time_1.m4a", "break_time_2.m4a", "break_time_3.m4a"],
    focus: ["focus_time_1.m4a", "focus_time_2.m4a", "focus_time_3.m4a"],
  };

  const files = audioFiles[context];
  if (!files || files.length === 0) {
    console.error(`No audio files defined for context: ${context}`);
    return null;
  }

  // Check if extension context is still valid before creating audio
  if (!validateChromeAPI()) {
    console.error("Extension context invalidated - cannot create audio URL");
    return null;
  }

  try {
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const audioUrl = safeChromeAPI(() => chrome.runtime.getURL(`audio/${randomFile}`));
    if (!audioUrl) {
      console.error("Cannot get audio URL - extension context invalid");
      return null;
    }
    console.log(`Selected ${context} audio: ${audioUrl}`);
    return new Audio(audioUrl);
  } catch (error) {
    console.error(`Error creating audio for ${context}:`, error);
    if (handleExtensionContextError(error)) {
      return null;
    }
    return null;
  }
}

function playAudio(audio) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplaythrough", onCanPlay);
    };

    const onEnded = () => {
      console.log("Audio playback ended");
      cleanup();
      resolve();
    };

    const onError = (error) => {
      console.error("Audio playback error:", error);
      cleanup();
      reject(error);
    };

    const onCanPlay = () => {
      console.log("Audio can play, starting playback...");
      audio.play().catch((playError) => {
        console.warn("Audio autoplay blocked or failed:", playError);
        cleanup();
        resolve(); // Continue even if audio is blocked
      });
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplaythrough", onCanPlay);

    // Start loading the audio
    audio.load();
  });
}

// =============================================================================
// AMBIENT SOUND FUNCTIONS
// =============================================================================

function startAmbientSound(soundKey, audioUrl, volume) {
  try {
    console.log(`Starting ambient sound: ${soundKey} at volume ${volume} from ${audioUrl}`);

    // Stop existing sound if any
    stopAmbientSound(soundKey);

    // Create new audio element
    const audio = new Audio(audioUrl);
    audio.loop = true; // Loop ambient sounds
    audio.volume = volume;
    audio.preload = "auto";

    // Store in ambient sounds map
    ambientSounds.set(soundKey, audio);

    // Try to start playing with multiple strategies
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`Ambient sound ${soundKey} started successfully`);
        })
        .catch((error) => {
          console.warn(`Ambient sound ${soundKey} autoplay blocked:`, error);

          // Try to overcome autoplay restrictions
          // Set up event listener for when user interacts with page
          const enableAudio = () => {
            audio
              .play()
              .then(() => {
                console.log(`Ambient sound ${soundKey} started after user interaction`);
                document.removeEventListener("click", enableAudio);
                document.removeEventListener("keydown", enableAudio);
              })
              .catch((err) => console.error("Failed to play after interaction:", err));
          };

          document.addEventListener("click", enableAudio, { once: true });
          document.addEventListener("keydown", enableAudio, { once: true });
        });
    }

    console.log(`Ambient sound ${soundKey} setup complete`);
  } catch (error) {
    console.error(`Error starting ambient sound ${soundKey}:`, error);
  }
}

function stopAmbientSound(soundKey) {
  try {
    console.log(`Stopping ambient sound: ${soundKey}`);

    const audio = ambientSounds.get(soundKey);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      ambientSounds.delete(soundKey);
      console.log(`Ambient sound ${soundKey} stopped`);
    }
  } catch (error) {
    console.error(`Error stopping ambient sound ${soundKey}:`, error);
  }
}

function updateAmbientVolume(soundKey, volume) {
  try {
    console.log(`Updating volume for ${soundKey}: ${volume}`);

    const audio = ambientSounds.get(soundKey);
    if (audio) {
      audio.volume = volume;
      console.log(`Volume updated for ${soundKey}`);
    }
  } catch (error) {
    console.error(`Error updating volume for ${soundKey}:`, error);
  }
}

function stopAllAmbientSounds() {
  try {
    console.log("Stopping all ambient sounds");

    for (const [_soundKey, audio] of ambientSounds) {
      audio.pause();
      audio.currentTime = 0;
    }

    ambientSounds.clear();
    console.log("All ambient sounds stopped");
  } catch (error) {
    console.error("Error stopping all ambient sounds:", error);
  }
}

function testAmbientSound(soundKey, audioUrl, volume) {
  try {
    console.log(`Testing ambient sound: ${soundKey} at volume ${volume} from ${audioUrl}`);

    // Create temporary audio for testing (non-looping)
    const audio = new Audio(audioUrl);
    audio.volume = volume;

    // Add event listeners for debugging
    audio.addEventListener("loadstart", () => console.log(`Test ${soundKey}: Load started`));
    audio.addEventListener("loadeddata", () => console.log(`Test ${soundKey}: Data loaded`));
    audio.addEventListener("canplay", () => console.log(`Test ${soundKey}: Can play`));
    audio.addEventListener("play", () => console.log(`Test ${soundKey}: Playing`));
    audio.addEventListener("error", (e) => console.error(`Test ${soundKey} error:`, e));

    // Try to play
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`Test sound ${soundKey} playing successfully`);
        })
        .catch((error) => {
          console.warn(`Test sound ${soundKey} autoplay blocked:`, error);

          // Try again with user interaction
          const playOnClick = () => {
            audio
              .play()
              .then(() => {
                console.log(`Test sound ${soundKey} started after user interaction`);
              })
              .catch((err) => console.error("Test failed after interaction:", err));
            document.removeEventListener("click", playOnClick);
          };

          document.addEventListener("click", playOnClick, { once: true });
          console.log(`Test sound ${soundKey} waiting for user interaction...`);
        });
    }

    // Stop after 3 seconds
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      console.log(`Test sound ${soundKey} stopped`);
    }, 3000);
  } catch (error) {
    console.error(`Error testing ambient sound ${soundKey}:`, error);
  }
}

// Validate that we have access to chrome.storage
function validateChromeAPI() {
  if (!extensionContextValid) {
    return false;
  }

  try {
    if (typeof chrome === "undefined") {
      console.error("Chrome API not available");
      extensionContextValid = false;
      return false;
    }
    if (!chrome.storage) {
      console.error("Chrome storage API not available");
      extensionContextValid = false;
      return false;
    }
    if (!chrome.runtime || !chrome.runtime.id) {
      console.error("Chrome runtime context invalidated");
      extensionContextValid = false;
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error validating Chrome API:", error);
    if (handleExtensionContextError(error)) {
      extensionContextValid = false;
    }
    return false;
  }
}

// Check if current page should be blocked
async function checkAndBlockPage() {
  if (isPageBlocked || !extensionContextValid) {
    return;
  }

  // Validate Chrome APIs first
  if (!validateChromeAPI()) {
    console.warn("Chrome APIs not available - content script may be invalidated");
    return;
  }

  try {
    // Try to get Chrome Storage data with additional validation
    let blockedUrls = [];
    let isBlocking = false;

    try {
      const result = await safeChromeAPIAsync(() => chrome.storage.local.get(["blockedUrls", "isBlocking"]), {
        blockedUrls: [],
        isBlocking: false,
      });
      if (!result) {
        console.warn("Chrome storage not available - extension context may be invalid");
        return;
      }
      blockedUrls = result.blockedUrls || [];
      isBlocking = result.isBlocking || false;
    } catch (storageError) {
      console.error("Chrome storage access failed:", storageError);
      if (handleExtensionContextError(storageError)) {
        return; // Extension context invalidated
      }
      // If not context error, just continue with empty values
      return;
    }

    if (!isBlocking || blockedUrls.length === 0) {
      return;
    }

    const currentHost = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    // Check if current page matches any blocked URL
    const isBlocked = blockedUrls.some((blockedUrl) => {
      const domain = blockedUrl.url.toLowerCase();
      const matches =
        currentHost.includes(domain) ||
        currentHost === domain ||
        currentHost === `www.${domain}` ||
        currentUrl.includes(domain) ||
        domain.includes(currentHost);

      return matches;
    });

    if (isBlocked) {
      isPageBlocked = true;
      blockPageImmediately(currentHost);
    }
  } catch (error) {
    console.error("Content script error:", error);
    if (handleExtensionContextError(error)) {
      return; // Stop execution if context is invalidated
    }
  }
}

function blockPageImmediately(hostname) {
  // Stop all loading
  try {
    window.stop();
  } catch {
    // Ignore if stop() is not available
  } // Prevent any further navigation
  window.addEventListener("beforeunload", (e) => {
    e.preventDefault();
    e.returnValue = "";
  });

  // Clear page and inject blocked content
  document.documentElement.innerHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Blocked by Beeyond Limits</title>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            color: white;
            text-align: center;
          }
          .container {
            max-width: 500px;
            padding: 2rem;
            animation: slideIn 0.6s ease-out;
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .emoji {
            font-size: 4rem;
            margin-bottom: 1rem;
            display: block;
          }
          h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
            font-weight: 600;
          }
          p {
            font-size: 1.1rem;
            opacity: 0.9;
            margin: 0.5rem 0;
            line-height: 1.5;
          }
          .domain {
            background: rgba(255,255,255,0.2);
            padding: 0.75rem 1rem;
            border-radius: 8px;
            margin: 1.5rem 0;
            font-family: 'Courier New', monospace;
            font-size: 1rem;
            word-break: break-all;
          }
          .btn {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            margin: 0.5rem;
            transition: all 0.3s;
          }
          .btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="emoji">🐝</span>
          <h1>Website Blocked!</h1>
          <p>This website has been blocked to help you stay focused.</p>
          <div class="domain">${hostname}</div>
          <p>Time to bee productive! 🚀</p>
          <br>
          <button class="btn" onclick="window.close()">Close Tab</button>
          <button class="btn" onclick="history.back()">Go Back</button>
          <br><br>
          <p style="font-size: 0.9rem; opacity: 0.7;">
            Blocked at ${new Date().toLocaleTimeString()}<br>
            You can disable blocking in the extension popup
          </p>
        </div>
      </body>
    </html>
  `;
}

// Initialize immediately - multiple execution strategies

// Strategy 1: Run immediately
if (extensionContextValid) {
  checkAndBlockPage().catch((error) => handleExtensionContextError(error));
}

// Strategy 2: Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (extensionContextValid) {
      checkAndBlockPage().catch((error) => handleExtensionContextError(error));
    }
  });
} else {
  // DOM already loaded, run again
  setTimeout(() => {
    if (extensionContextValid) {
      checkAndBlockPage().catch((error) => handleExtensionContextError(error));
    }
  }, 10);
}

// Strategy 3: Run on window load
window.addEventListener("load", () => {
  if (extensionContextValid) {
    checkAndBlockPage().catch((error) => handleExtensionContextError(error));
  }
});

// Strategy 4: Monitor DOM changes for SPAs
if (!isPageBlocked && extensionContextValid) {
  const observer = new MutationObserver(() => {
    if (!isPageBlocked && extensionContextValid) {
      checkAndBlockPage().catch((error) => {
        if (handleExtensionContextError(error)) {
          observer.disconnect();
        }
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Cleanup observer after blocking
  setTimeout(() => {
    if (isPageBlocked || !extensionContextValid) {
      observer.disconnect();
    }
  }, 1000);
}

// Strategy 5: Regular interval check (backup)
const intervalCheck = setInterval(() => {
  if (isPageBlocked || !extensionContextValid) {
    clearInterval(intervalCheck);
    return;
  }

  try {
    // Check if extension context is still valid
    if (!validateChromeAPI()) {
      console.warn("Extension context invalidated, stopping interval check");
      clearInterval(intervalCheck);
      return;
    }

    checkAndBlockPage().catch((error) => {
      console.error("Error during interval check:", error);
      if (handleExtensionContextError(error)) {
        console.warn("Extension context invalidated during check, stopping interval");
        clearInterval(intervalCheck);
      }
    });
  } catch (error) {
    console.error("Error in interval check:", error);
    if (handleExtensionContextError(error)) {
      clearInterval(intervalCheck);
    }
  }
}, 500);

// Clear interval after 10 seconds to avoid infinite checking
setTimeout(() => {
  clearInterval(intervalCheck);
}, 10000);
