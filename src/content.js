// Content script to manually check and block pages
/* global chrome */

let isPageBlocked = false;

console.log("Beeyond Limits content script loaded");

// Listen for messages from background script for audio playback
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);

  if (message.type === "PLAY_POMODORO_AUDIO") {
    playPomodoroAudio(message.context)
      .then(() => {
        console.log("Audio playback completed successfully");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Audio playback failed:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  return false;
});

// Audio playback function for Pomodoro
async function playPomodoroAudio(context) {
  try {
    console.log(`Playing Pomodoro audio for context: ${context}`);

    // Create audio elements with proper URLs
    const alarmUrl = chrome.runtime.getURL("audio/pomodoro_alarm.m4a");
    const alarmAudio = new Audio(alarmUrl);

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

  const randomFile = files[Math.floor(Math.random() * files.length)];
  const audioUrl = chrome.runtime.getURL(`audio/${randomFile}`);
  console.log(`Selected ${context} audio: ${audioUrl}`);
  return new Audio(audioUrl);
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

// Validate that we have access to chrome.storage
function validateChromeAPI() {
  if (typeof chrome === "undefined") {
    console.error("Chrome API not available");
    return false;
  }
  if (!chrome.storage) {
    console.error("Chrome storage API not available");
    return false;
  }
  return true;
}

// Check if current page should be blocked
async function checkAndBlockPage() {
  if (isPageBlocked) {
    return;
  }

  // Validate Chrome APIs first
  if (!validateChromeAPI()) {
    console.error("Cannot access Chrome APIs - extension may not be loaded properly");
    return;
  }

  try {
    const { blockedUrls = [], isBlocking = false } = await chrome.storage.local.get(["blockedUrls", "isBlocking"]);

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
checkAndBlockPage();

// Strategy 2: Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkAndBlockPage);
} else {
  // DOM already loaded, run again
  setTimeout(checkAndBlockPage, 10);
}

// Strategy 3: Run on window load
window.addEventListener("load", checkAndBlockPage);

// Strategy 4: Monitor DOM changes for SPAs
if (!isPageBlocked) {
  const observer = new MutationObserver(() => {
    if (!isPageBlocked) {
      checkAndBlockPage();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Cleanup observer after blocking
  setTimeout(() => {
    if (isPageBlocked) {
      observer.disconnect();
    }
  }, 1000);
}

// Strategy 5: Regular interval check (backup)
const intervalCheck = setInterval(() => {
  if (isPageBlocked) {
    clearInterval(intervalCheck);
    return;
  }
  checkAndBlockPage();
}, 500);

// Clear interval after 10 seconds to avoid infinite checking
setTimeout(() => {
  clearInterval(intervalCheck);
}, 10000);
