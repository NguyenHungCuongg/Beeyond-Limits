import React, { useState, useEffect, useCallback } from "react";
import BlockedURL from "../components/BlockedURL";
import BlockerStats from "../components/BlockerStats";
import toast from "react-hot-toast";

// eslint-disable-next-line no-undef
const chromeStorage = typeof chrome !== "undefined" ? chrome.storage : null;

function WebsiteBlocker({ onNavigate }) {
  const [blockedUrls, setBlockedUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);

  // Save blocked URLs function
  const saveBlockedUrls = useCallback(async (urlsToSave) => {
    try {
      if (chromeStorage && chromeStorage.local) {
        await chromeStorage.local.set({ blockedUrls: urlsToSave });
        console.log("[WebsiteBlocker] Saved URLs, triggering background update");
      } else {
        // Fallback for development
        localStorage.setItem("beeyond-blocked-urls", JSON.stringify(urlsToSave));
      }
    } catch (error) {
      console.error("Error saving blocked URLs:", error);
    }
  }, []);

  // Load blocked URLs from Chrome storage
  const loadBlockedUrls = useCallback(async () => {
    try {
      setIsLoading(true);
      if (chromeStorage && chromeStorage.local) {
        const result = await chromeStorage.local.get(["blockedUrls"]);
        if (result.blockedUrls && Array.isArray(result.blockedUrls)) {
          setBlockedUrls(result.blockedUrls);
        } else {
          // Initialize with some default blocked sites
          const defaultBlocked = [
            {
              id: 1,
              url: "youtube.com",
              createdAt: new Date().toISOString(),
            },
            {
              id: 2,
              url: "facebook.com",
              createdAt: new Date().toISOString(),
            },
            {
              id: 3,
              url: "tiktok.com",
              createdAt: new Date().toISOString(),
            },
          ];
          setBlockedUrls(defaultBlocked);
          if (chromeStorage && chromeStorage.local) {
            await chromeStorage.local.set({ blockedUrls: defaultBlocked });
          } else {
            localStorage.setItem("beeyond-blocked-urls", JSON.stringify(defaultBlocked));
          }
        }
      } else {
        // Fallback for development
        const storedUrls = localStorage.getItem("beeyond-blocked-urls");
        if (storedUrls) {
          setBlockedUrls(JSON.parse(storedUrls));
        } else {
          const defaultBlocked = [];
          setBlockedUrls(defaultBlocked);
          localStorage.setItem("beeyond-blocked-urls", JSON.stringify(defaultBlocked));
        }
      }
    } catch (error) {
      console.error("Error loading blocked URLs:", error);
      setBlockedUrls([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load blocking status
  const loadBlockingStatus = useCallback(async () => {
    try {
      if (chromeStorage && chromeStorage.local) {
        const result = await chromeStorage.local.get(["isBlocking"]);
        setIsBlocking(result.isBlocking || false);
      } else {
        const status = localStorage.getItem("beeyond-blocking-status");
        setIsBlocking(status === "true");
      }
    } catch (error) {
      console.error("Error loading blocking status:", error);
    }
  }, []);

  useEffect(() => {
    loadBlockedUrls();
    loadBlockingStatus();
  }, [loadBlockedUrls, loadBlockingStatus]);

  // Validate URL format
  const isValidUrl = (url) => {
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    return urlPattern.test(url);
  };

  // Clean URL (remove protocol, www, trailing slash)
  const cleanUrl = (url) => {
    return url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "")
      .toLowerCase();
  };

  const addBlockedUrl = async () => {
    if (newUrl.trim() && isValidUrl(newUrl.trim())) {
      const cleanedUrl = cleanUrl(newUrl.trim());

      // Check if URL already exists
      const exists = blockedUrls.some((blocked) => cleanUrl(blocked.url) === cleanedUrl);

      if (exists) {
        toast.error("This website is already in your blocklist!");
        return;
      }

      const newBlockedUrl = {
        id: Date.now(),
        url: cleanedUrl,
        createdAt: new Date().toISOString(),
      };

      const updatedUrls = [newBlockedUrl, ...blockedUrls];
      setBlockedUrls(updatedUrls);
      await saveBlockedUrls(updatedUrls);
      console.log("[WebsiteBlocker] Added URL:", cleanedUrl, "Total URLs:", updatedUrls.length);
      setNewUrl("");
    } else {
      toast.error("Please enter a valid website URL (e.g., youtube.com)");
    }
  };

  const removeBlockedUrl = async (urlId) => {
    const updatedUrls = blockedUrls.filter((blocked) => blocked.id !== urlId);
    setBlockedUrls(updatedUrls);
    await saveBlockedUrls(updatedUrls);
  };

  const toggleBlocking = async () => {
    const newStatus = !isBlocking;
    setIsBlocking(newStatus);
    try {
      if (chromeStorage && chromeStorage.local) {
        await chromeStorage.local.set({ isBlocking: newStatus });
        // Force trigger background script update
        console.log("[WebsiteBlocker] Blocking status changed to:", newStatus);
        setTimeout(() => {
          console.log("[WebsiteBlocker] Storage should be updated now");
        }, 100);
      } else {
        localStorage.setItem("beeyond-blocking-status", newStatus.toString());
      }
    } catch (error) {
      console.error("Error saving blocking status:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addBlockedUrl();
    }
  };

  const clearAllBlocked = async () => {
    if (window.confirm("Are you sure you want to remove all blocked websites?")) {
      setBlockedUrls([]);
      await saveBlockedUrls([]);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 font-primary overflow-auto">
      <div className="p-6">
        {/* Header with back button */}
        <div className="flex flex-col items-start mb-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors mr-4"
          >
            ←
          </button>
          <div className="flex-1 text-center self-center">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">Website Blocker</h1>
            <p className="text-blue-100 text-sm">Block distracting websites to stay focused!</p>
          </div>
        </div>

        {/* Blocking Toggle */}
        <div className="mb-6 bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🛡️</div>
              <div>
                <h3 className="font-semibold text-white">Website Blocking</h3>
                <p className="text-blue-100 text-sm">
                  {isBlocking ? "Currently blocking distracting sites" : "Blocking is disabled"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleBlocking}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isBlocking ? "bg-green-500" : "bg-white/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isBlocking ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Add New URL */}
        <div className="mb-6 bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
          <div className="flex space-x-3">
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter website to block (e.g., youtube.com)"
              className="flex-1 bg-white/90 backdrop-blur-sm border-0 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              onClick={addBlockedUrl}
              disabled={!newUrl.trim()}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                newUrl.trim()
                  ? "bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:scale-105"
                  : "bg-white/50 text-gray-400 cursor-not-allowed"
              }`}
            >
              Block
            </button>
          </div>
          <div className="mt-2 flex items-center space-x-2 text-blue-100 text-xs">
            <span>💡</span>
            <span>Tip: Enter just the domain name (e.g., "youtube.com" instead of "https://www.youtube.com")</span>
          </div>
        </div>

        {/* Blocked URLs List */}
        <div className="space-y-3 mb-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-bounce">🔒</div>
              <h3 className="text-white text-lg font-medium mb-2">Loading your blocklist...</h3>
              <p className="text-white/80 text-sm">Just a moment while we fetch your blocked sites</p>
            </div>
          ) : blockedUrls.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold">Blocked Websites ({blockedUrls.length})</h3>
                {blockedUrls.length > 0 && (
                  <button onClick={clearAllBlocked} className="text-white/80 hover:text-white text-sm underline">
                    Clear All
                  </button>
                )}
              </div>
              {blockedUrls.map((blockedUrl) => (
                <BlockedURL key={blockedUrl.id} blockedUrl={blockedUrl} onRemove={removeBlockedUrl} />
              ))}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🌐</div>
              <h3 className="text-white text-lg font-medium mb-2">No blocked websites yet</h3>
              <p className="text-white/80 text-sm">Add websites above to start blocking distractions!</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <BlockerStats blockedUrls={blockedUrls} isBlocking={isBlocking} blocksToday={0} />

        {/* Home Button */}
        <div className="mt-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-full bg-white/10 backdrop-blur-sm text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default WebsiteBlocker;
