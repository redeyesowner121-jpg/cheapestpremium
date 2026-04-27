// Generates contextual follow-up suggestions based on AI response content
export function generateFollowUps(content: string): string[] {
  const suggestions: string[] = [];
  const lc = content.toLowerCase();
  if (lc.includes('netflix')) suggestions.push('Compare Netflix plans');
  if (lc.includes('spotify')) suggestions.push('Tell me Spotify features');
  if (lc.includes('price') || content.includes('₹')) suggestions.push('Show cheapest option');
  if (lc.includes('coupon') || lc.includes('discount')) suggestions.push('Any other offers?');
  if (lc.includes('flash sale')) suggestions.push('Show flash sale details');
  if (suggestions.length === 0) suggestions.push('Give more details', 'Show similar products');
  return suggestions.slice(0, 3);
}

// Splits long web messages into multiple bubbles for readability
export function splitWebMessage(text: string): string[] {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2) return paragraphs;
  const productPattern = /\n(?=📦|🔥|➡️|•\s|[-]\s|\d+[\.\)]\s)/;
  const productSplit = text.split(productPattern).map(p => p.trim()).filter(Boolean);
  if (productSplit.length >= 2) return productSplit;
  return [text];
}
