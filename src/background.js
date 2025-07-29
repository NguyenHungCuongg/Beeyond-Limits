// Background script for dynamic website blocking and Pomodoro timer
/* global chrome */

// =============================================================================
// POMODORO BACKGROUND TIMER MANAGER
// =============================================================================

class BackgroundPomodoroManager {
  constructor() {
    this.timerId = null;
    this.isActive = false;
    this.isBreak = false;
    this.currentTime = 0;
    this.initialTime = 0;
    this.focusTime = 25;
    this.breakTime = 5;
    this.sessionCount = 0;
    this.audioEnabled = true;

    this.loadState();
  }

  async loadState() {
    try {
      const result = await chrome.storage.local.get(["pomodoroState", "pomodoroSettings"]);

      if (result.pomodoroState) {
        const state = result.pomodoroState;
        this.isActive = state.isActive || false;
        this.isBreak = state.isBreak || false;
        this.currentTime = state.currentTime || this.focusTime * 60;
        this.initialTime = state.initialTime || this.focusTime * 60;
        this.sessionCount = state.sessionCount || 0;

        console.log("Loaded pomodoro state:", state);

        // Only restart timer if it was active
        if (this.isActive && this.currentTime > 0) {
          console.log("Restarting timer from saved state");
          this.startTimer();
        } else if (this.currentTime === 0 && this.isActive) {
          // If timer was at 0 but active, it might have been stuck
          console.log("Timer was stuck at 0, resetting...");
          this.isActive = false;
          this.currentTime = this.isBreak ? this.breakTime * 60 : this.focusTime * 60;
          this.initialTime = this.currentTime;
          this.saveState();
        }
      } else {
        // No saved state, initialize with default focus time
        this.currentTime = this.focusTime * 60;
        this.initialTime = this.focusTime * 60;
        console.log("No saved state, initialized with default values");
      }

      if (result.pomodoroSettings) {
        const settings = result.pomodoroSettings;
        this.focusTime = settings.focusTime || 25;
        this.breakTime = settings.breakTime || 5;
        this.audioEnabled = settings.audioEnabled !== undefined ? settings.audioEnabled : true;
        console.log("Loaded pomodoro settings:", settings);
      }
    } catch (error) {
      console.error("Error loading pomodoro state:", error);
    }
  }

  async saveState() {
    try {
      const state = {
        isActive: this.isActive,
        isBreak: this.isBreak,
        currentTime: this.currentTime,
        initialTime: this.initialTime,
        sessionCount: this.sessionCount,
        lastUpdated: Date.now(),
      };

      await chrome.storage.local.set({ pomodoroState: state });
      this.notifyStateChange();
    } catch (error) {
      console.error("Error saving pomodoro state:", error);
    }
  }

  notifyStateChange() {
    chrome.runtime
      .sendMessage({
        type: "POMODORO_STATE_UPDATE",
        state: this.getState(),
      })
      .catch(() => {});
  }

  startTimer() {
    console.log("Starting timer:", { isBreak: this.isBreak, currentTime: this.currentTime });

    if (this.timerId) {
      clearInterval(this.timerId);
    }

    this.isActive = true;
    this.timerId = setInterval(() => {
      this.tick();
    }, 1000);

    this.saveState();
    console.log("Timer started successfully, isActive:", this.isActive);
  }

  pauseTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.isActive = false;
    this.saveState();
  }

  resetTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.isActive = false;
    this.isBreak = false;
    this.currentTime = this.focusTime * 60;
    this.initialTime = this.focusTime * 60;
    this.sessionCount = 0;

    this.saveState();
  }

  tick() {
    if (this.currentTime > 0) {
      this.currentTime--;
      this.saveState();
    } else {
      console.log("Timer reached 0, handling completion...");
      this.handleTimerComplete();
    }
  }

  async handleTimerComplete() {
    console.log("Timer completed! Current state:", { isBreak: this.isBreak, currentTime: this.currentTime });

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    // Set inactive temporarily
    this.isActive = false;

    if (!this.isBreak) {
      // Focus time completed, switch to break
      console.log("Focus time completed, switching to break");
      this.isBreak = true;
      this.currentTime = this.breakTime * 60;
      this.initialTime = this.breakTime * 60;
      this.sessionCount++;

      await this.playNotification("break");
      this.showNotification("Great job! Time for a break! 🎉", `Take a ${this.breakTime} minute break.`);
    } else {
      // Break time completed, switch to focus
      console.log("Break time completed, switching to focus");
      this.isBreak = false;
      this.currentTime = this.focusTime * 60;
      this.initialTime = this.focusTime * 60;

      await this.playNotification("focus");
      this.showNotification("Break's over! Ready to focus? 💪", `Time for a ${this.focusTime} minute focus session.`);
    }

    // Save state first, then restart timer
    await this.saveState();

    // Auto-start the next timer
    console.log("Auto-starting next timer phase:", { isBreak: this.isBreak, currentTime: this.currentTime });
    this.startTimer();
  }

  async playNotification(context) {
    if (!this.audioEnabled) return;

    try {
      console.log(`Playing notification for context: ${context}`);

      // Get all tabs and try to send audio message
      const tabs = await chrome.tabs.query({});
      let audioSent = false;

      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "PLAY_POMODORO_AUDIO",
            context: context,
          });
          audioSent = true;
          console.log(`Audio message sent to tab ${tab.id}`);
          break; // Stop after first successful send
        } catch (error) {
          // Tab might not have content script injected, continue to next tab
          console.log(`Failed to send to tab ${tab.id}:`, error.message);
        }
      }

      if (!audioSent) {
        console.warn("No tabs available for audio playback - creating notification only");
      }
    } catch (error) {
      console.error("Error playing notification:", error);
    }
  }

  showNotification(title, body) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "images/icon32.png",
      title: title,
      message: body,
    });
  }

  updateSettings(settings) {
    if (settings.focusTime !== undefined) {
      this.focusTime = settings.focusTime;
      if (!this.isBreak && !this.isActive) {
        this.currentTime = this.focusTime * 60;
        this.initialTime = this.focusTime * 60;
      }
    }

    if (settings.breakTime !== undefined) {
      this.breakTime = settings.breakTime;
      if (this.isBreak && !this.isActive) {
        this.currentTime = this.breakTime * 60;
        this.initialTime = this.breakTime * 60;
      }
    }

    if (settings.audioEnabled !== undefined) {
      this.audioEnabled = settings.audioEnabled;
    }

    chrome.storage.local.set({
      pomodoroSettings: {
        focusTime: this.focusTime,
        breakTime: this.breakTime,
        audioEnabled: this.audioEnabled,
      },
    });

    this.saveState();
  }

  getState() {
    return {
      isActive: this.isActive,
      isBreak: this.isBreak,
      currentTime: this.currentTime,
      initialTime: this.initialTime,
      sessionCount: this.sessionCount,
      focusTime: this.focusTime,
      breakTime: this.breakTime,
      audioEnabled: this.audioEnabled,
    };
  }
}

// Initialize Pomodoro Manager
const pomodoroManager = new BackgroundPomodoroManager();

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "POMODORO_START":
      pomodoroManager.startTimer();
      sendResponse({ success: true });
      break;

    case "POMODORO_PAUSE":
      pomodoroManager.pauseTimer();
      sendResponse({ success: true });
      break;

    case "POMODORO_RESET":
      pomodoroManager.resetTimer();
      sendResponse({ success: true });
      break;

    case "POMODORO_UPDATE_SETTINGS":
      pomodoroManager.updateSettings(message.settings);
      sendResponse({ success: true });
      break;

    case "POMODORO_GET_STATE":
      sendResponse({ state: pomodoroManager.getState() });
      break;

    case "POMODORO_TEST_AUDIO":
      console.log("Background received test audio request for:", message.context);
      pomodoroManager.playNotification(message.context);

      // Also try to create a new tab with audio test if no content scripts are available
      setTimeout(async () => {
        try {
          const tabs = await chrome.tabs.query({});
          let hasContentScript = false;

          for (const tab of tabs) {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: "PING" });
              hasContentScript = true;
              break;
            } catch (error) {
              // Tab doesn't have content script
              console.log(`Tab ${tab.id} has no content script:`, error.message);
            }
          }

          if (!hasContentScript) {
            console.log("No content scripts found, creating audio test tab");
            chrome.tabs.create({
              url: chrome.runtime.getURL("simple-audio-test.html"),
              active: false,
            });
          }
        } catch (error) {
          console.error("Error checking content scripts:", error);
        }
      }, 100);

      sendResponse({ success: true });
      break;
  }

  return true; // Keep message channel open for async response
});

// =============================================================================
// WEBSITE BLOCKING FUNCTIONALITY
// =============================================================================

// Function to create proper URL patterns
function createUrlPatterns(domain) {
  // Tạo comprehensive patterns để bắt ALL variations
  return [
    `*://${domain}/*`, // youtube.com/anything
    `*://*.${domain}/*`, // www.youtube.com/anything
    `*://${domain}`, // youtube.com (exact)
    `*://*.${domain}`, // www.youtube.com (exact)
    `*://${domain}?*`, // youtube.com?params
    `*://*.${domain}?*`, // www.youtube.com?params
    `*://${domain}#*`, // youtube.com#hash
    `*://*.${domain}#*`, // www.youtube.com#hash
  ];
}

// Update blocking rules based on stored data
async function updateBlockingRules() {
  try {
    // Get current settings
    const { blockedUrls = [], isBlocking = false } = await chrome.storage.local.get(["blockedUrls", "isBlocking"]);

    // Remove ALL existing dynamic rules first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map((rule) => rule.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    // Add new rules if blocking is enabled AND we have URLs
    if (isBlocking && blockedUrls.length > 0) {
      const newRules = [];
      let ruleId = 1000; // Start with high number to avoid conflicts

      blockedUrls.forEach((blockedUrl) => {
        const patterns = createUrlPatterns(blockedUrl.url);

        patterns.forEach((pattern) => {
          const rule = {
            id: ruleId++,
            priority: 1,
            action: {
              type: "redirect",
              redirect: {
                url: `data:text/html,<html><head><title>Blocked by Beeyond Limits</title><style>body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;color:white;text-align:center}h1{font-size:2.5rem;margin-bottom:1rem}p{font-size:1.2rem;opacity:0.9}.emoji{font-size:4rem;margin-bottom:1rem}.domain{background:rgba(255,255,255,0.2);padding:0.5rem 1rem;border-radius:0.5rem;margin:1rem 0;font-family:monospace;font-size:1.1rem}</style></head><body><div><div class="emoji">🐝</div><h1>Website Blocked!</h1><p>This website has been blocked by Beeyond Limits</p><div class="domain">${blockedUrl.url}</div><p>Stay focused and bee productive! 🚀</p><p><small>You can disable blocking in the extension popup</small></p></div></body></html>`,
              },
            },
            condition: {
              urlFilter: pattern,
              resourceTypes: ["main_frame"],
            },
          };

          newRules.push(rule);
        });

        // Add additional catch-all rule for this domain
        const catchAllRule = {
          id: ruleId++,
          priority: 2, // Higher priority
          action: {
            type: "redirect",
            redirect: {
              url: `data:text/html,<html><head><title>Blocked by Beeyond Limits</title><style>body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;color:white;text-align:center}h1{font-size:2.5rem;margin-bottom:1rem}p{font-size:1.2rem;opacity:0.9}.emoji{font-size:4rem;margin-bottom:1rem}.domain{background:rgba(255,255,255,0.2);padding:0.5rem 1rem;border-radius:0.5rem;margin:1rem 0;font-family:monospace;font-size:1.1rem}</style></head><body><div><div class="emoji">🐝</div><h1>Website Blocked!</h1><p>This website has been blocked by Beeyond Limits</p><div class="domain">${blockedUrl.url}</div><p>Stay focused and bee productive! 🚀</p><p><small>You can disable blocking in the extension popup</small></p></div></body></html>`,
            },
          },
          condition: {
            urlFilter: `*${blockedUrl.url}*`, // Catch-all pattern
            resourceTypes: ["main_frame"],
          },
        };
        newRules.push(catchAllRule);
      }); // Add all rules at once
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
      });

      // Verify rules were added
      await chrome.declarativeNetRequest.getDynamicRules();
    }
  } catch (error) {
    console.error("Error updating blocking rules:", error);
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local" && (changes.blockedUrls || changes.isBlocking)) {
    await updateBlockingRules();
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  await updateBlockingRules();
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  await updateBlockingRules();
});

// Manual debug trigger
chrome.action.onClicked.addListener(async () => {
  // Show current status
  await chrome.storage.local.get(["blockedUrls", "isBlocking"]);
  await chrome.declarativeNetRequest.getDynamicRules();

  await updateBlockingRules();
});
