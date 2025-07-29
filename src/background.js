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

// =============================================================================
// AMBIENT SOUND MANAGER
// =============================================================================

class AmbientSoundManager {
  constructor() {
    this.activeSounds = new Map(); // Store active audio objects
    this.offscreenReady = false;
    this.settings = {
      bird: { enabled: false, volume: 50 },
      campfire: { enabled: false, volume: 50 },
      ocean_waves: { enabled: false, volume: 50 },
      rain: { enabled: false, volume: 50 },
      thunder: { enabled: false, volume: 50 },
      wind: { enabled: false, volume: 50 },
    };
    this.loadSettings();
    this.initOffscreen();
  }

  async initOffscreen() {
    try {
      // Check if offscreen document already exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });

      if (existingContexts.length > 0) {
        console.log("Offscreen document already exists");
        this.offscreenReady = true;
        return;
      }

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: "src/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Playing ambient sounds for productivity focus",
      });

      console.log("Offscreen document created successfully");
      this.offscreenReady = true;
    } catch (error) {
      console.error("Error creating offscreen document:", error);
      this.offscreenReady = false;
    }
  }

  async ensureOffscreen() {
    if (!this.offscreenReady) {
      await this.initOffscreen();
    }
    return this.offscreenReady;
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(["ambientSettings"]);
      if (result.ambientSettings) {
        this.settings = { ...this.settings, ...result.ambientSettings };
        console.log("Loaded ambient settings:", this.settings);

        // Start enabled sounds
        Object.entries(this.settings).forEach(([key, setting]) => {
          if (setting.enabled) {
            this.startSound(key, setting.volume);
          }
        });
      }
    } catch (error) {
      console.error("Error loading ambient settings:", error);
    }
  }

  async saveSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await chrome.storage.local.set({ ambientSettings: this.settings });
      console.log("Saved ambient settings:", this.settings);
    } catch (error) {
      console.error("Error saving ambient settings:", error);
    }
  }

  updateSettings(newSettings) {
    console.log("Updating ambient settings:", newSettings);
    console.log("Current settings before update:", this.settings);

    // Stop sounds that are being disabled
    Object.entries(newSettings).forEach(([key, setting]) => {
      const currentSetting = this.settings[key];
      console.log(`Processing ${key}: current=${JSON.stringify(currentSetting)}, new=${JSON.stringify(setting)}`);

      if (currentSetting?.enabled && !setting.enabled) {
        console.log(`Stopping sound ${key} (disabled)`);
        this.stopSound(key);
      } else if (!currentSetting?.enabled && setting.enabled) {
        console.log(`Starting sound ${key} (enabled) with volume ${setting.volume}`);
        this.startSound(key, setting.volume);
      } else if (setting.enabled && currentSetting?.volume !== setting.volume) {
        console.log(`Updating volume for ${key} from ${currentSetting?.volume} to ${setting.volume}`);
        this.updateVolume(key, setting.volume);
      }
    });

    this.saveSettings(newSettings);
  }

  async startSound(soundKey, volume = 50) {
    try {
      // Ensure offscreen document is ready
      const ready = await this.ensureOffscreen();
      if (!ready) {
        console.error("Offscreen document not available");
        return;
      }

      // Stop existing sound if any
      this.stopSound(soundKey);

      // All audio files are now .m4a format
      const audioUrl = chrome.runtime.getURL(`audio/${soundKey}.m4a`);
      console.log(`Starting ambient sound: ${soundKey} at ${audioUrl} with volume ${volume}%`);

      // Send to offscreen document
      try {
        await chrome.runtime.sendMessage({
          type: "START_AMBIENT_SOUND",
          soundKey: soundKey,
          audioUrl: audioUrl,
          volume: volume / 100, // Convert to 0-1 range
        });
        console.log(`Ambient sound ${soundKey} started in offscreen document`);
      } catch (error) {
        console.error(`Failed to start sound in offscreen document:`, error);
      }
    } catch (error) {
      console.error(`Error starting ambient sound ${soundKey}:`, error);
    }
  }

  async stopSound(soundKey) {
    try {
      console.log(`Stopping ambient sound: ${soundKey}`);

      // Send stop message to offscreen document
      const ready = await this.ensureOffscreen();
      if (ready) {
        try {
          await chrome.runtime.sendMessage({
            type: "STOP_AMBIENT_SOUND",
            soundKey: soundKey,
          });
        } catch (error) {
          console.error(`Failed to stop sound in offscreen document:`, error);
        }
      }
    } catch (error) {
      console.error(`Error stopping ambient sound ${soundKey}:`, error);
    }
  }

  async updateVolume(soundKey, volume) {
    try {
      console.log(`Updating volume for ${soundKey}: ${volume}%`);

      // Send volume update to offscreen document
      const ready = await this.ensureOffscreen();
      if (ready) {
        try {
          await chrome.runtime.sendMessage({
            type: "UPDATE_AMBIENT_VOLUME",
            soundKey: soundKey,
            volume: volume / 100, // Convert to 0-1 range
          });
        } catch (error) {
          console.error(`Failed to update volume in offscreen document:`, error);
        }
      }
    } catch (error) {
      console.error(`Error updating volume for ${soundKey}:`, error);
    }
  }

  async stopAllSounds() {
    try {
      console.log("Stopping all ambient sounds");

      // Send stop all message to offscreen document
      const ready = await this.ensureOffscreen();
      if (ready) {
        try {
          await chrome.runtime.sendMessage({
            type: "STOP_ALL_AMBIENT_SOUNDS",
          });
        } catch (error) {
          console.error(`Failed to stop all sounds in offscreen document:`, error);
        }
      }
    } catch (error) {
      console.error("Error stopping all ambient sounds:", error);
    }
  }

  async testSound(soundKey, volume = 50) {
    try {
      console.log(`Testing ambient sound: ${soundKey} with volume ${volume}%`);

      // All audio files are now .m4a format
      const audioUrl = chrome.runtime.getURL(`audio/${soundKey}.m4a`);
      console.log(`Test sound URL: ${audioUrl}`);

      // Send test message to offscreen document
      const ready = await this.ensureOffscreen();
      if (ready) {
        try {
          await chrome.runtime.sendMessage({
            type: "TEST_AMBIENT_SOUND",
            soundKey: soundKey,
            audioUrl: audioUrl,
            volume: volume / 100,
          });
          console.log(`Test sound ${soundKey} sent to offscreen document`);
        } catch (error) {
          console.error(`Failed to test sound in offscreen document:`, error);
        }
      }
    } catch (error) {
      console.error(`Error testing ambient sound ${soundKey}:`, error);
    }
  }
}

// Initialize Ambient Sound Manager
const ambientManager = new AmbientSoundManager();

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

    case "AMBIENT_UPDATE_SETTINGS":
      ambientManager.updateSettings(message.settings);
      sendResponse({ success: true });
      break;

    case "AMBIENT_TEST_SOUND":
      ambientManager.testSound(message.soundKey, message.volume);
      sendResponse({ success: true });
      break;

    case "AMBIENT_STOP_ALL":
      ambientManager.stopAllSounds();
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
