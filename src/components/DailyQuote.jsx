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
      <div className="bg-paper brutal-border brutal-shadow p-5 flex flex-col items-center justify-center min-h-[100px]">
        <div className="font-mono font-bold text-ink text-sm uppercase">Loading inspiration...</div>
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="bg-paper brutal-border brutal-shadow p-5 flex flex-col items-center justify-center min-h-[100px]">
        <div className="font-mono font-bold text-ink text-sm uppercase">Inspiration will be with you soon!</div>
      </div>
    );
  }

  return (
    <div className="bg-paper brutal-border brutal-shadow p-5">
      <div className="font-display text-3xl uppercase leading-tight text-ink">
        {quote.text}
      </div>
      <div className="font-mono font-bold mt-2 text-ink">
        {quote.author}
      </div>
    </div>
  );
}

export default DailyQuote;
