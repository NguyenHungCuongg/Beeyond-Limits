// Utility function to get daily quote
export function getDailyQuote(quotes) {
  if (!quotes || quotes.length === 0) {
    return {
      quote: "Every day is a new beginning.",
      author: "Unknown",
    };
  }

  // Get current date string (YYYY-MM-DD) để đảm bảo same quote trong ngày
  const today = new Date();
  const dateString = today.toISOString().split("T")[0]; // "2025-01-30"

  // Sử dụng date string như seed để tạo deterministic random
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    const char = dateString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Đảm bảo positive number
  const positiveHash = Math.abs(hash);
  const quoteIndex = positiveHash % quotes.length;

  return quotes[quoteIndex];
}

// Utility function để format quote hiển thị
export function formatQuote(quote) {
  return {
    text: `"${quote.quote}"`,
    author: `— ${quote.author}`,
  };
}
