/** Display-only whitespace layout. Never use this output for storage, hashes, or copying. */
export function aiLibraryReadingParagraphs(text: string): string[] {
  const result: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split(/\n+/)) {
    if (!line.trim()) continue;
    if (line.length <= 400) { result.push(line.trim()); continue; }
    // Keep punctuation with its sentence; do not split URLs or decimal numbers.
    const pieces = line.split(/([.!?。！？]+[ \t]+)/);
    let paragraph = '';
    for (let i = 0; i < pieces.length; i += 2) {
      paragraph += pieces[i] + (pieces[i + 1] || '');
      if (paragraph.length >= 280) { result.push(paragraph.trim()); paragraph = ''; }
    }
    if (paragraph.trim()) result.push(paragraph.trim());
  }
  return result;
}
export const aiLibraryReadingHeading = (text: string): boolean => /^(?:👤|🤖|#{1,6}\s|\d+[.)]\s|[-*•]\s|[①-⑳])/.test(text);
