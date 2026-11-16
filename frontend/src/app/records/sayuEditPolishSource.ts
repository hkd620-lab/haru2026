const originalPolishPreviewFormats = new Set([
  'diary', 'essay', 'travel', 'reading', 'garden', 'pet', 'child', 'work', 'memo', 'mission', 'report',
]);

export function supportsSayuOriginalPolishPreview(formatKey: string | undefined): boolean {
  return originalPolishPreviewFormats.has(formatKey ?? '');
}

export function selectSayuPolishSource(
  view: 'ai' | 'original',
  original: string,
  saved: string,
  edited: string,
  preview: { text: string; source: string } | null,
): string {
  const savedText = saved.trim();
  const savedSource = savedText === '내용 없음' ? '' : savedText;
  if (view === 'original') return original.trim() || savedSource;
  if (preview && edited === preview.text) return preview.source;
  const editedText = edited.trim();
  if (edited !== saved) return editedText === '내용 없음' ? '' : editedText;
  return savedSource || original.trim();
}

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
