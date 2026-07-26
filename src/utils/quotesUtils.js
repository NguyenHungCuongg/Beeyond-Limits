// Utility function to get daily quote
export function getDailyQuote(quotes) {
  if (!quotes || quotes.length === 0) {
    return {
      quote: "Every day is a new beginning.",
      author: "Unknown",
    };
  }

  // Get current local date string (YYYY-M-D) để đảm bảo same quote trong ngày theo giờ local
  const today = new Date();
  const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`; // e.g., "2025-1-30"

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
