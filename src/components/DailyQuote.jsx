import React, { useState, useEffect } from "react";
import { getDailyQuote, formatQuote } from "../utils/quotesUtils";

/* global chrome */

function DailyQuote() {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDailyQuote();
  }, []);

  const loadDailyQuote = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load quotes from JSON file
      const response = await fetch(chrome.runtime.getURL("quotes.json"));

      if (!response.ok) {
        throw new Error("Failed to load quotes");
      }

      const quotes = await response.json();

      // Get today's quote
      const dailyQuote = getDailyQuote(quotes);
      const formattedQuote = formatQuote(dailyQuote);

      setQuote(formattedQuote);
    } catch (err) {
      console.error("Error loading daily quote:", err);
      setError(err.message);

      // Fallback quote
      setQuote({
        text: '"Every day is a new beginning."',
        author: "— Unknown",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
        <div className="text-center">
          <div className="text-2xl mb-2">💭</div>
          <div className="text-white/70 text-sm">Loading daily inspiration...</div>
        </div>
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
        <div className="text-center">
          <div className="text-2xl mb-2">💫</div>
          <div className="text-white/70 text-sm">Inspiration will be with you soon!</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
      <div className="text-center">
        <div className="text-2xl mb-3">💭</div>
        <h3 className="text-white font-medium text-sm mb-3">Daily Inspiration</h3>

        <div className="space-y-2">
          <p className="text-white/90 text-sm italic leading-relaxed">{quote.text}</p>
          <p className="text-white/70 text-xs font-medium">{quote.author}</p>
        </div>
      </div>
    </div>
  );
}

export default DailyQuote;
