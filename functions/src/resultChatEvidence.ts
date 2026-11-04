import type { GenerateContentResponse } from '@google/genai';

export type ResultChatEvidenceSource = { title: string; uri: string; citationId: number };

// Search attribution identifies supporting passages; it is not independent fact verification.
export function buildResultChatEvidence(response: Pick<GenerateContentResponse, 'text' | 'candidates'>, maxLength = 5000) {
  const raw = response.text || '';
  // Leave room for citation markers (500) and the route/quota preface (300).
  // Cached answers must not truncate a cited passage after adding that preface.
  const visible = raw.slice(0, Math.max(0, maxLength - 800));
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts;
  const textParts = parts?.filter((part) => typeof part.text === 'string' && !part.thought);
  const matchesParts = !parts || textParts?.map((part) => part.text).join('') === raw;
  const grounding = candidate?.groundingMetadata;
  const chunks = grounding?.groundingChunks || [];
  const points = new Map<number, Set<number>>();
  const validSources = new Map<number, { title: string; uri: string }>();

  chunks.forEach((chunk, index) => {
    const uri = chunk.web?.uri;
    if (!uri) return;
    try {
      const url = new URL(uri);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return;
      validSources.set(index, { title: (chunk.web?.title || url.hostname).slice(0, 300), uri: url.href });
    } catch { /* Invalid links cannot be evidence. */ }
  });

  if (matchesParts) for (const support of grounding?.groundingSupports || []) {
    const segment = support.segment;
    const partIndex = segment?.partIndex ?? 0;
    const part = parts ? parts[partIndex] : partIndex === 0 ? { text: raw } : undefined;
    if (!part || part.thought || typeof part.text !== 'string') continue;
    const start = segment?.startIndex ?? 0;
    const end = segment?.endIndex;
    const bytes = Buffer.from(part.text, 'utf8');
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end! <= start || end! > bytes.length) continue;
    const before = bytes.subarray(0, start).toString('utf8');
    const passage = bytes.subarray(start, end).toString('utf8');
    // SDK offsets are UTF-8 bytes, not JavaScript character indices (Korean and emoji differ).
    if (Buffer.byteLength(before) !== start || Buffer.byteLength(passage) !== end! - start) continue;
    if (!passage.trim() || (segment?.text && segment.text !== passage)) continue;
    const prefixLength = parts
      ? parts.slice(0, partIndex).filter((item) => !item.thought).map((item) => item.text || '').join('').length
      : 0;
    const position = prefixLength + before.length + passage.length;
    if (position > visible.length) continue;
    const indices = points.get(position) || new Set<number>();
    for (const index of support.groundingChunkIndices || []) {
      if (Number.isInteger(index) && validSources.has(index)) indices.add(index);
    }
    if (indices.size) points.set(position, indices);
  }

  const sources: ResultChatEvidenceSource[] = [];
  const citationByUri = new Map<string, number>();
  let answer = '';
  let cursor = 0;
  let markerLength = 0;
  const emittedCitations = new Set<number>();
  for (const [position, indices] of [...points].sort((a, b) => a[0] - b[0])) {
    const ids = new Set<number>();
    for (const index of indices) {
      const source = validSources.get(index)!;
      let citationId = citationByUri.get(source.uri);
      if (!citationId) {
        if (sources.length >= 20) continue;
        citationId = sources.length + 1;
        sources.push({ ...source, citationId });
        citationByUri.set(source.uri, citationId);
      }
      ids.add(citationId);
    }
    // A distinct citation namespace preserves bracketed years, arrays and other source data.
    const marker = [...ids].map((id) => `[출처 ${id}]`).join('');
    if (markerLength + marker.length > 500) break;
    ids.forEach((id) => emittedCitations.add(id));
    answer += visible.slice(cursor, position) + marker;
    markerLength += marker.length;
    cursor = position;
  }
  answer += visible.slice(cursor);
  const cited = sources.filter((source) => emittedCitations.has(source.citationId));
  return { answer: answer.trim(), sources: cited, usedWebSearch: cited.length > 0 };
}

export function isRecordMediaQuestion(question: string): boolean {
  // Requests for a work's author/origin or an explicit lookup still use the user's search choice.
  if (/(검색|인터넷|웹|최신|외부|출처|작가|화가|원작|제작자|역사|시세|가격|오늘|내일|현재|최근|이번\s*주|날씨|기온|환율|주가|일정|운영\s*시간|영업\s*시간|입장료|법령|정책|지원금|뉴스|추천)/.test(question)) return false;
  // Conservatively retain source selection for multiple requests, even when one is media observation.
  if (/(그리고|또한|아울러|더불어|설명하고|분석하고|묘사하고|읽고|보여주고|알려주고|[?!.]\s*\S)/.test(question)) return false;
  return /(사진|그림|이미지|첨부|PDF|pdf)/.test(question)
    && /(어떤|무엇|뭐|내용|설명|묘사|분석|읽어|보여|보이|그려)/.test(question);
}
