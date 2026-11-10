/** Display-only whitespace layout. Never use this output for storage, hashes, or copying. */
export function aiLibraryReadingParagraphs(text: string): string[] {
  const result: string[] = [];
  let code: string[] | null = null;
  let fence = '';
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (code) {
      code.push(line);
      if (new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(line)) {
        result.push(code.join('\n')); code = null;
      }
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (opening) { fence = opening[1]; code = [line]; continue; }
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
  if (code) result.push(code.join('\n'));
  return result;
}
export const aiLibraryReadingCode = (text: string): boolean => /^ {0,3}(?:`{3,}|~{3,})/.test(text);
export const aiLibraryReadingHeading = (text: string): boolean => /^(?:👤|🤖|#{1,6}\s|\d+[.)]\s|[-*•]\s|[①-⑳])/.test(text);
