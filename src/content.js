// Content script to manually check and block pages
/* global chrome */

let isPageBlocked = false;

// Debug function
function debugLog(message, data = null) {
  console.log(`[Content Script] ${message}`, data || "");
}

// Validate that we have access to chrome.storage
function validateChromeAPI() {
  if (typeof chrome === "undefined") {
    console.error("❌ Chrome API not available");
    return false;
  }
  if (!chrome.storage) {
    console.error("❌ Chrome storage API not available");
    return false;
  }
  debugLog("✅ Chrome APIs available");
  return true;
}

// Check if current page should be blocked
async function checkAndBlockPage() {
  if (isPageBlocked) {
    debugLog("Page already blocked, skipping");
    return;
  }

  // Validate Chrome APIs first
  if (!validateChromeAPI()) {
    console.error("❌ Cannot access Chrome APIs - extension may not be loaded properly");
    return;
  }

  try {
    const { blockedUrls = [], isBlocking = false } = await chrome.storage.local.get(["blockedUrls", "isBlocking"]);

    debugLog("Storage data retrieved:", {
      blockedUrls: blockedUrls.map((u) => u.url),
      isBlocking,
      urlCount: blockedUrls.length,
    });

    if (!isBlocking || blockedUrls.length === 0) {
      debugLog("Blocking disabled or no URLs to block");
      return;
    }

    const currentHost = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    debugLog("Checking current URL:", { hostname: currentHost, url: currentUrl });

    // Check if current page matches any blocked URL
    const isBlocked = blockedUrls.some((blockedUrl) => {
      const domain = blockedUrl.url.toLowerCase();
      const matches =
        currentHost.includes(domain) ||
        currentHost === domain ||
        currentHost === `www.${domain}` ||
        currentUrl.includes(domain) ||
        domain.includes(currentHost);

      debugLog(`Checking domain ${domain} against ${currentHost}:`, matches);
      return matches;
    });

    if (isBlocked) {
      debugLog("🚫 PAGE BLOCKED!", currentHost);
      isPageBlocked = true;
      blockPageImmediately(currentHost);
    } else {
      debugLog("✅ Page allowed", currentHost);
    }
  } catch (error) {
    console.error("❌ Content script error:", error);
  }
}

function blockPageImmediately(hostname) {
  debugLog("🛑 Blocking page immediately:", hostname);

  // Stop all loading
  try {
    window.stop();
  } catch (e) {
    debugLog("Could not stop window loading:", e);
  }

  // Prevent any further navigation
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

  debugLog("✅ Page blocked successfully");
}

// Initialize immediately - multiple execution strategies
debugLog("🚀 Content script starting...");

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

debugLog("✅ Content script initialization complete");
