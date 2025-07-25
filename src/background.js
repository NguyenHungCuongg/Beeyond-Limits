// Background script for dynamic website blocking
/* global chrome */

// Debug function
function debugLog(message, data = null) {
  console.log(`[Beeyond Limits] ${message}`, data || "");
}

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
    debugLog("🔄 Starting updateBlockingRules");

    // Get current settings
    const { blockedUrls = [], isBlocking = false } = await chrome.storage.local.get(["blockedUrls", "isBlocking"]);
    debugLog("📊 Current settings:", {
      blockedUrls: blockedUrls.map((u) => u.url),
      isBlocking,
      count: blockedUrls.length,
    });

    // Remove ALL existing dynamic rules first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map((rule) => rule.id);

    debugLog("🗑️ Removing existing rules:", ruleIdsToRemove);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
      debugLog("✅ Removed all existing rules");
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
          debugLog(`🎯 Created rule for ${blockedUrl.url} with pattern: ${pattern}`);
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
        debugLog(`🎯 Created catch-all rule for ${blockedUrl.url}`);
      }); // Add all rules at once
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
      });

      debugLog("✅ Successfully added rules:", {
        totalRules: newRules.length,
        domains: blockedUrls.map((u) => u.url),
      });

      // Verify rules were added
      const finalRules = await chrome.declarativeNetRequest.getDynamicRules();
      debugLog("🔍 Final active rules:", finalRules.length);
    } else {
      debugLog("⚠️ No rules to add:", { isBlocking, urlCount: blockedUrls.length });
    }
  } catch (error) {
    console.error("❌ Error updating blocking rules:", error);
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  debugLog("📝 Storage changed:", { changes: Object.keys(changes), areaName });

  if (areaName === "local" && (changes.blockedUrls || changes.isBlocking)) {
    debugLog("🔄 Triggering rule update due to storage change");
    await updateBlockingRules();
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  debugLog("🚀 Extension startup - initializing rules");
  await updateBlockingRules();
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  debugLog("📦 Extension installed/updated:", details.reason);
  await updateBlockingRules();
});

// Manual debug trigger
chrome.action.onClicked.addListener(async () => {
  debugLog("👆 Extension icon clicked - manual debug");

  // Show current status
  const storage = await chrome.storage.local.get(["blockedUrls", "isBlocking"]);
  const rules = await chrome.declarativeNetRequest.getDynamicRules();

  debugLog("=== DEBUG STATUS ===");
  debugLog("Blocked URLs:", storage.blockedUrls?.map((u) => u.url) || []);
  debugLog("Is Blocking:", storage.isBlocking);
  debugLog("Active Rules:", rules.length);
  debugLog("==================");

  await updateBlockingRules();
});
