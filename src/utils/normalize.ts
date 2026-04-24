export function normalizeText(text: string): string {
  return (
    text
      // Collapse whitespace
      .replace(/\s+/g, " ")
      // "3 200" → "3200" (Finnish number formatting)
      .replace(/(\d)\s+(\d{3})(?!\d)/g, "$1$2")
      // Ensure euro sign has a space before it
      .replace(/(\d)€/g, "$1 €")
      // Remove null bytes and control characters
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "")
      .trim()
  );
}
