// Background script for dynamic website blocking
/* global chrome */

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
