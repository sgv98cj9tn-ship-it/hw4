// How catalogue text is shown to shoppers. The database is left unchanged.

/** Product names say "1 4 Zip" (from "1/4 Zip"); show "Quarter-Zip" instead. */
export function displayName(text: string): string {
  return text.replace(/\b1[\s/-]?4[\s-]?zip\b/gi, 'Quarter-Zip').replace(/¼[\s-]?zip\b/gi, 'Quarter-Zip')
}
