import React from "react";

function BlockedURL({ blockedUrl, onRemove }) {
  // Extract domain name for display
  const getDomain = (url) => {
    try {
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  // Get favicon for the website
  const getFavicon = (url) => {
    try {
      const domain = getDomain(url);
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const domain = getDomain(blockedUrl.url);
  const favicon = getFavicon(blockedUrl.url);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-center space-x-3">
        {/* Favicon */}
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="w-6 h-6 rounded"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "block";
              }}
            />
          ) : null}
          <span className="text-lg" style={{ display: favicon ? "none" : "block" }}>
            🚫
          </span>
        </div>

        {/* URL Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{domain}</h3>
          <p className="text-xs text-gray-500 truncate">{blockedUrl.url}</p>
          <div className="flex items-center space-x-2 mt-1">
            <div className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">🔒 Blocked</div>
            <span className="text-xs text-gray-400">Added {new Date(blockedUrl.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(blockedUrl.id)}
          className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-lg flex items-center justify-center text-red-600 hover:text-red-700 transition-colors opacity-0 group-hover:opacity-100"
          title="Remove from blocklist"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default BlockedURL;
