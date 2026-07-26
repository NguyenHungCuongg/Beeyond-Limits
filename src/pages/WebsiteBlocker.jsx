import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import BlockedURL from "../components/BlockedURL";
import BlockerStats from "../components/BlockerStats";
import { normalizeDomain, sanitizeBlockedUrls } from "../core/blocking";

/* global chrome */

const DEFAULT_BLOCKED_URLS = [
  { id: 1, url: "youtube.com", createdAt: new Date().toISOString() },
  { id: 2, url: "facebook.com", createdAt: new Date().toISOString() },
  { id: 3, url: "tiktok.com", createdAt: new Date().toISOString() },
];

const hasExtensionStorage =
  typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

function WebsiteBlocker({ onNavigate }) {
  const [blockedUrls, setBlockedUrls] = useState([]);
  const [isBlocking, setIsBlocking] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadConfiguration() {
      try {
        if (hasExtensionStorage) {
          const stored = await chrome.storage.local.get([
            "blockedUrls",
            "isBlocking",
          ]);
          setBlockedUrls(
            Array.isArray(stored.blockedUrls)
              ? sanitizeBlockedUrls(stored.blockedUrls)
              : DEFAULT_BLOCKED_URLS,
          );
          setIsBlocking(Boolean(stored.isBlocking));
        } else {
          const storedUrls = localStorage.getItem("beeyond-blocked-urls");
          setBlockedUrls(
            storedUrls
              ? sanitizeBlockedUrls(JSON.parse(storedUrls))
              : DEFAULT_BLOCKED_URLS,
          );
          setIsBlocking(
            localStorage.getItem("beeyond-blocking-status") === "true",
          );
        }
      } catch (error) {
        console.error("Unable to load website blocker configuration:", error);
        toast.error("Could not load your blocklist");
      } finally {
        setIsLoading(false);
      }
    }

    loadConfiguration();
  }, []);

  async function persistConfiguration(nextIsBlocking, nextBlockedUrls) {
    const normalizedUrls = sanitizeBlockedUrls(nextBlockedUrls);
    setIsSaving(true);

    try {
      if (hasExtensionStorage) {
        const response = await chrome.runtime.sendMessage({
          type: "UPDATE_BLOCKING_RULES",
          isBlocking: nextIsBlocking,
          blockedUrls: normalizedUrls,
        });

        if (!response?.success) {
          throw new Error(response?.error || "Unable to update blocking rules");
        }

        setIsBlocking(response.isBlocking);
        setBlockedUrls(response.blockedUrls);
      } else {
        localStorage.setItem(
          "beeyond-blocked-urls",
          JSON.stringify(normalizedUrls),
        );
        localStorage.setItem("beeyond-blocking-status", String(nextIsBlocking));
        setIsBlocking(nextIsBlocking);
        setBlockedUrls(normalizedUrls);
      }

      return true;
    } catch (error) {
      console.error("Unable to update website blocker:", error);
      toast.error(error.message || "Could not update website blocking");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function addBlockedUrl(event) {
    event.preventDefault();
    const domain = normalizeDomain(newUrl);
    if (!domain) {
      toast.error("Enter a valid domain, for example youtube.com");
      return;
    }

    if (blockedUrls.some((item) => item.url === domain)) {
      toast.error("This website is already in your blocklist");
      return;
    }

    const nextBlockedUrls = [
      {
        id: globalThis.crypto?.randomUUID?.() ?? Date.now(),
        url: domain,
        createdAt: new Date().toISOString(),
      },
      ...blockedUrls,
    ];

    if (await persistConfiguration(isBlocking, nextBlockedUrls)) {
      setNewUrl("");
    }
  }

  async function removeBlockedUrl(urlId) {
    await persistConfiguration(
      isBlocking,
      blockedUrls.filter((item) => item.id !== urlId),
    );
  }

  async function clearAllBlocked() {
    if (
      window.confirm("Are you sure you want to remove all blocked websites?")
    ) {
      await persistConfiguration(isBlocking, []);
    }
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 font-primary">
      <div className="p-6">
        <div className="mb-6 flex flex-col items-start">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-label="Back to home"
            className="mr-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ←
          </button>
          <div className="flex-1 self-center text-center">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              Website Blocker
            </h1>
            <p className="text-sm text-blue-100">
              Block distracting websites to stay focused!
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-white/30 bg-white/20 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div aria-hidden="true" className="text-2xl">
                🛡️
              </div>
              <div>
                <h2 className="font-semibold text-white">Website Blocking</h2>
                <p className="text-sm text-blue-100" aria-live="polite">
                  {isBlocking
                    ? "Currently blocking distracting sites"
                    : "Blocking is disabled"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isBlocking}
              aria-label="Website blocking"
              disabled={isSaving}
              onClick={() => persistConfiguration(!isBlocking, blockedUrls)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
                isBlocking ? "bg-green-500" : "bg-white/30"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isBlocking ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <form
          onSubmit={addBlockedUrl}
          className="mb-6 rounded-xl border border-white/30 bg-white/20 p-4 backdrop-blur-sm"
        >
          <label htmlFor="blocked-domain" className="sr-only">
            Website domain to block
          </label>
          <div className="flex space-x-3">
            <input
              id="blocked-domain"
              type="text"
              inputMode="url"
              value={newUrl}
              onChange={(event) => setNewUrl(event.target.value)}
              placeholder="Enter website to block (e.g., youtube.com)"
              className="flex-1 rounded-lg border-0 bg-white/90 px-4 py-3 text-gray-800 placeholder-gray-500 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              type="submit"
              disabled={!newUrl.trim() || isSaving}
              className="rounded-lg bg-white px-6 py-3 font-medium text-blue-600 shadow-lg transition-all duration-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-white/50 disabled:text-gray-400"
            >
              Block
            </button>
          </div>
          <p className="mt-2 text-xs text-blue-100">
            💡 Paths are removed automatically; the domain and its subdomains
            will be blocked.
          </p>
        </form>

        <div className="mb-6 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-white" role="status">
              Loading your blocklist…
            </div>
          ) : blockedUrls.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-white">
                  Blocked Websites ({blockedUrls.length})
                </h2>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={clearAllBlocked}
                  className="text-sm text-white/80 underline hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
                >
                  Clear All
                </button>
              </div>
              {blockedUrls.map((blockedUrl) => (
                <BlockedURL
                  key={blockedUrl.id}
                  blockedUrl={blockedUrl}
                  onRemove={removeBlockedUrl}
                />
              ))}
            </>
          ) : (
            <div className="py-12 text-center">
              <div aria-hidden="true" className="mb-4 text-6xl">
                🌐
              </div>
              <h2 className="mb-2 text-lg font-medium text-white">
                No blocked websites yet
              </h2>
              <p className="text-sm text-white/80">
                Add websites above to start blocking distractions!
              </p>
            </div>
          )}
        </div>

        <BlockerStats
          blockedUrls={blockedUrls}
          isBlocking={isBlocking}
          blocksToday={0}
        />

        <div className="mt-6">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="w-full rounded-xl border border-white/20 bg-white/10 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default WebsiteBlocker;
