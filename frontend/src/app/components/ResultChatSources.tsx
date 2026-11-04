import React from 'react';
import type { ResultChatSource } from '../services/resultChatService';
import { getSafeResultChatSources, resultChatSourceLabel } from '../utils/resultChatEvidence';

export function ResultChatSources({ sources }: { sources?: ResultChatSource[] }) {
  const safeSources = getSafeResultChatSources(sources);
  if (!safeSources.length) return null;
  return (
    <aside aria-label="AI 답변 참고 출처" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2, maxWidth: '100%' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8' }}>🔎 {resultChatSourceLabel(safeSources)}</span>
      <span style={{ fontSize: 10, color: '#94A3B8' }}>자료가 답변 전체의 정확성을 보장하지는 않습니다.</span>
      {safeSources.map((source, index) => (
        <a
          key={`${source.uri}_${index}`}
          href={source.uri}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none', wordBreak: 'break-all', overflowWrap: 'anywhere' }}
        >
          {source.citationId ? `[출처 ${source.citationId}] ` : ''}{source.title || source.uri}
        </a>
      ))}
    </aside>
  );
}
