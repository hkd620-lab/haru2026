export function getSayuEditPolishOriginal(formatKey: string | undefined, originalData: Record<string, string>, isFinalReading: boolean): string {
  if (formatKey === 'reading') {
    if (isFinalReading) return '';
    const { reading_book_title, reading_author, reading_book_text, reading_journal } = originalData;
    if (!reading_book_text?.trim() && !reading_journal?.trim()) return '';
    return [reading_book_title, reading_author, reading_book_text, reading_journal]
      .filter(value => typeof value === 'string' && value.trim())
      .join('\n\n');
  }

  return Object.entries(originalData)
    .filter(([key]) => key.startsWith(`${formatKey}_`)
      && !/_(sayu|polished|polishedAt|mode|style|stats|ai_comment|title|keywords|status|images|image_meta)$/.test(key))
    .map(([, value]) => value)
    .filter(value => typeof value === 'string' && value.trim())
    .join('\n\n');
}
