// Background script for dynamic website blocking and Pomodoro timer
/* global chrome */

// =============================================================================
// POMODORO BACKGROUND TIMER MANAGER
// =============================================================================

class BackgroundPomodoroManager {
  constructor() {
    this.isActive = false;
    this.isBreak = false;
    this.currentTime = 0;
    this.initialTime = 0;
    this.phaseEndsAt = null;
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
        this.initialTime = state.initialTime || this.focusTime * 60;
        this.sessionCount = state.sessionCount || 0;
        this.phaseEndsAt = state.phaseEndsAt || null;

        let loadedCurrentTime = state.currentTime;
        if (loadedCurrentTime === undefined || loadedCurrentTime === null || loadedCurrentTime === 0) {
          loadedCurrentTime = this.isBreak ? this.breakTime * 60 : this.focusTime * 60;
        }
        this.currentTime = loadedCurrentTime;

        if (this.isActive && this.phaseEndsAt) {
          const remaining = this.phaseEndsAt - Date.now();
          if (remaining > 0) {
            chrome.alarms.create("pomodoroTimer", { when: this.phaseEndsAt });
          } else {
            this.handleTimerComplete();
          }
        } else if (this.isActive && !this.phaseEndsAt) {
          this.isActive = false;
          this.saveState();
        }
      } else {
        this.currentTime = this.focusTime * 60;
        this.initialTime = this.focusTime * 60;
      }

      if (result.pomodoroSettings) {
        const settings = result.pomodoroSettings;
        this.focusTime = settings.focusTime || 25;
        this.breakTime = settings.breakTime || 5;
        this.audioEnabled = settings.audioEnabled !== undefined ? settings.audioEnabled : true;
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
        phaseEndsAt: this.phaseEndsAt,
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
    this.isActive = true;
    let current = this.currentTime;
    if (current <= 0) current = this.isBreak ? this.breakTime * 60 : this.focusTime * 60;
    
    this.phaseEndsAt = Date.now() + current * 1000;
    chrome.alarms.create("pomodoroTimer", { when: this.phaseEndsAt });
    
    this.saveState();
  }

  pauseTimer() {
    this.isActive = false;
    if (this.phaseEndsAt) {
      this.currentTime = Math.max(0, Math.floor((this.phaseEndsAt - Date.now()) / 1000));
      this.phaseEndsAt = null;
    }
    chrome.alarms.clear("pomodoroTimer");
    this.saveState();
  }

  resetTimer() {
    this.isActive = false;
    this.isBreak = false;
    this.currentTime = this.focusTime * 60;
    this.initialTime = this.focusTime * 60;
    this.phaseEndsAt = null;
    this.sessionCount = 0;
    
    chrome.alarms.clear("pomodoroTimer");
    this.saveState();
  }

  async handleTimerComplete() {
    this.isActive = false;
    this.phaseEndsAt = null;
    chrome.alarms.clear("pomodoroTimer");

    if (!this.isBreak) {
      this.isBreak = true;
      this.currentTime = this.breakTime * 60;
      this.initialTime = this.breakTime * 60;
      this.sessionCount++;

      await this.playNotification("break");
      this.showNotification("Great job! Time for a break! 🎉", `Take a ${this.breakTime} minute break.`);
    } else {
      this.isBreak = false;
      this.currentTime = this.focusTime * 60;
      this.initialTime = this.focusTime * 60;

      await this.playNotification("focus");
      this.showNotification("Break's over! Ready to focus? 💪", `Time for a ${this.focusTime} minute focus session.`);
    }

    await this.saveState();
    this.startTimer();
  }

  async playNotification(context) {
    if (!this.audioEnabled) return;
    try {
      const ready = await ambientManager.ensureOffscreen();
      if (ready) {
        let audioFiles = [];
        if (context === "break") {
           audioFiles = ["break_time_1.m4a", "break_time_2.m4a", "break_time_3.m4a"];
        } else if (context === "focus") {
           audioFiles = ["focus_time_1.m4a", "focus_time_2.m4a", "focus_time_3.m4a"];
        }
        
        await chrome.runtime.sendMessage({
          type: "PLAY_POMODORO_AUDIO",
          audioUrl: chrome.runtime.getURL("audio/pomodoro_alarm.m4a"),
          target: "offscreen"
        });
        
        if (audioFiles.length > 0) {
           const selected = audioFiles[Math.floor(Math.random() * audioFiles.length)];
           setTimeout(async () => {
             await chrome.runtime.sendMessage({
                type: "PLAY_POMODORO_AUDIO",
                audioUrl: chrome.runtime.getURL("audio/" + selected),
                target: "offscreen"
             });
           }, 2000);
        }
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
    let current = this.currentTime;
    if (this.isActive && this.phaseEndsAt) {
      current = Math.max(0, Math.floor((this.phaseEndsAt - Date.now()) / 1000));
    }
    return {
      isActive: this.isActive,
      isBreak: this.isBreak,
      currentTime: current,
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
      console.log("=== INITIALIZING OFFSCREEN DOCUMENT ===");

      // Check if offscreen document already exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });

      if (existingContexts.length > 0) {
        console.log("Offscreen document already exists, count:", existingContexts.length);
        this.offscreenReady = true;
        return;
      }

      console.log("Creating new offscreen document...");

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: "src/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Playing ambient sounds for productivity focus",
      });

      console.log("Offscreen document created successfully");
      this.offscreenReady = true;

      // Wait longer for offscreen document to fully load
      await this.verifyOffscreenReady();
    } catch (error) {
      console.error("Error creating offscreen document:", error);
      this.offscreenReady = false;
    }
  }

  async verifyOffscreenReady() {
    console.log("=== VERIFYING OFFSCREEN DOCUMENT ===");

    // Try multiple times with increasing delays
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      const delay = 1000 + i * 1000; // 1s, 2s, 3s, 4s, 5s

      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        console.log(`Ping attempt ${i + 1}/${maxRetries} after ${delay}ms delay...`);

        const response = await chrome.runtime.sendMessage({
          type: "PING_OFFSCREEN",
          target: "offscreen",
        });

        console.log("✅ Offscreen document ping successful:", response);
        this.offscreenReady = true;
        return;
      } catch (error) {
        console.warn(`❌ Ping attempt ${i + 1} failed:`, error.message);

        // Check if document exists in contexts
        try {
          const contexts = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
          });
          console.log(`Available offscreen contexts: ${contexts.length}`);

          if (contexts.length === 0) {
            console.error("No offscreen document found in contexts!");
            this.offscreenReady = false;
            return;
          }
        } catch (contextError) {
          console.error("Error checking contexts:", contextError);
        }
      }
    }

    console.error("❌ Failed to verify offscreen document after all retries");
    this.offscreenReady = false;
  }
  async ensureOffscreen() {
    console.log("=== ENSURING OFFSCREEN IS READY ===");
    console.log("Current offscreenReady status:", this.offscreenReady);

    if (!this.offscreenReady) {
      console.log("Offscreen not ready, reinitializing...");
      await this.initOffscreen();
    }

    // Double-check with a quick ping
    if (this.offscreenReady) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "PING_OFFSCREEN",
          target: "offscreen",
        });
        console.log("Quick ping successful:", response);
        return true;
      } catch (error) {
        console.warn("Quick ping failed, marking as not ready:", error.message);
        this.offscreenReady = false;

        // Try one more time
        console.log("Attempting to reinitialize offscreen...");
        await this.initOffscreen();
      }
    }

    console.log("Final offscreenReady status:", this.offscreenReady);
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
      console.log(`=== STARTING SOUND: ${soundKey} ===`);

      // Ensure offscreen document is ready
      const ready = await this.ensureOffscreen();
      if (!ready) {
        console.error("❌ Offscreen document not available, cannot start sound");
        return;
      }

      console.log("✅ Offscreen document ready, proceeding with sound start");

      // Don't stop existing sound here - let offscreen handle it
      // this.stopSound(soundKey);

      // All audio files are now .m4a format
      const audioUrl = chrome.runtime.getURL(`audio/${soundKey}.m4a`);
      console.log(`Starting ambient sound: ${soundKey} at ${audioUrl} with volume ${volume}%`);

      // Send to offscreen document with retry logic
      console.log(`Sending START message to offscreen...`);

      const message = {
        type: "START_AMBIENT_SOUND",
        soundKey: soundKey,
        audioUrl: audioUrl,
        volume: volume / 100, // Convert to 0-1 range
        target: "offscreen",
      };

      const response = await chrome.runtime.sendMessage(message);
      console.log(`✅ Ambient sound ${soundKey} started successfully:`, response);
    } catch (error) {
      console.error(`❌ Failed to start sound ${soundKey}:`, error);

      // If connection failed, mark offscreen as not ready and try once more
      if (error.message.includes("Could not establish connection")) {
        console.log("Connection failed, marking offscreen as not ready and retrying...");
        this.offscreenReady = false;

        try {
          await this.ensureOffscreen();
          if (this.offscreenReady) {
            console.log("Retry attempt after reconnection...");
            const retryMessage = {
              type: "START_AMBIENT_SOUND",
              soundKey: soundKey,
              audioUrl: chrome.runtime.getURL(`audio/${soundKey}.m4a`),
              volume: volume / 100,
              target: "offscreen",
            };

            const retryResponse = await chrome.runtime.sendMessage(retryMessage);
            console.log(`✅ Retry successful for ${soundKey}:`, retryResponse);
          }
        } catch (retryError) {
          console.error(`❌ Retry also failed for ${soundKey}:`, retryError);
        }
      }
    }
  }

  async stopSound(soundKey) {
    try {
      console.log(`Stopping ambient sound: ${soundKey}`);

      // Send stop message to offscreen document
      const ready = await this.ensureOffscreen();
      if (ready) {
        try {
          console.log(`Sending stop message to offscreen for ${soundKey}`);

          const response = await chrome.runtime.sendMessage({
            type: "STOP_AMBIENT_SOUND",
            soundKey: soundKey,
            target: "offscreen",
          });

          console.log(`Stop message sent for ${soundKey}:`, response);
        } catch (error) {
          console.error(`Failed to stop sound:`, error);
        }
      } else {
        console.error("Offscreen document not ready for stopping sound");
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
          console.log(`Sending volume update to offscreen for ${soundKey}: ${volume / 100}`);

          const response = await chrome.runtime.sendMessage({
            type: "UPDATE_AMBIENT_VOLUME",
            soundKey: soundKey,
            volume: volume / 100, // Convert to 0-1 range
            target: "offscreen",
          });

          console.log(`Volume update sent for ${soundKey}:`, response);
        } catch (error) {
          console.error(`Failed to update volume:`, error);
        }
      } else {
        console.error("Offscreen document not ready for volume update");
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
          console.log(`Sending stop all message to offscreen`);

          const response = await chrome.runtime.sendMessage({
            type: "STOP_ALL_AMBIENT_SOUNDS",
            target: "offscreen",
          });

          console.log(`Stop all message sent:`, response);
        } catch (error) {
          console.error(`Failed to stop all sounds:`, error);
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
          console.log(`Sending test message to offscreen for ${soundKey}`);

          const response = await chrome.runtime.sendMessage({
            type: "TEST_AMBIENT_SOUND",
            soundKey: soundKey,
            audioUrl: audioUrl,
            volume: volume / 100,
            target: "offscreen",
          });

          console.log(`Test sound ${soundKey} sent:`, response);
        } catch (error) {
          console.error(`Failed to test sound:`, error);
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pomodoroTimer") {
    pomodoroManager.handleTimerComplete();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "UPDATE_BLOCKING_RULES":
      updateBlockingRules(message.isBlocking, message.blockedUrls).then(sendResponse);
      return true;

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
      pomodoroManager.playNotification(message.context);
      sendResponse({ success: true });
      break;

    case "AMBIENT_UPDATE_SETTINGS":
      ambientManager.updateSettings(message.settings);
      sendResponse({ success: true });
      break;

    case "AMBIENT_UPDATE_VOLUME":
      console.log(`Received volume update request: ${message.soundKey} -> ${message.volume}%`);
      ambientManager.updateVolume(message.soundKey, message.volume);
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
