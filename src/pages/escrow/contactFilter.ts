/**
 * Client-side validation that mirrors the DB trigger.
 * Returns an error message if the text contains contact info / external links,
 * or null if it's clean.
 */
export function validateEscrowMessage(text: string): string | null {
  const t = text.toLowerCase();

  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) {
    return 'Sharing email addresses is not allowed.';
  }
  if (/(\+?\d[\d\s\-]{6,}\d)/.test(t)) {
    return 'Sharing phone numbers is not allowed.';
  }
  if (/(t\.me\/|telegram\.me\/|wa\.me\/|whatsapp|@[a-z0-9_]{4,}|instagram\.com\/|fb\.com\/|facebook\.com\/|discord\.gg\/|chat\.whatsapp)/.test(t)) {
    return 'Sharing usernames or external chat links is not allowed.';
  }
  if (/(https?:\/\/|www\.)/.test(t)) {
    return 'Sharing external links is not allowed.';
  }
  return null;
}
