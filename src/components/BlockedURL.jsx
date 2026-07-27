import React from "react";
import { Ban, Lock, X } from "./Icons";

function BlockedURL({ blockedUrl, onRemove }) {
  const getDomain = (url) => {
    try {
      const urlObj = new URL(
        /^https?:\/\//i.test(url) ? url : `https://${url}`,
      );
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  const domain = getDomain(blockedUrl.url);

  return (
    <div className="bg-paper brutal-border brutal-shadow-sm p-3 flex justify-between items-center mb-3">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 border-[3px] border-black bg-crimson flex items-center justify-center shrink-0">
          <Ban size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-sans font-bold text-lg uppercase text-ink truncate">{domain}</h3>
          <p className="font-mono text-xs text-ink truncate uppercase">{blockedUrl.url}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(blockedUrl.id)}
        aria-label={`Remove ${domain} from blocklist`}
        className="w-8 h-8 brutal-border bg-canvas flex items-center justify-center text-ink hover:bg-crimson hover:text-white transition-colors brutal-shadow-sm"
        title="Remove from blocklist"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default BlockedURL;
