import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultChatSources } from '../src/app/components/ResultChatSources.tsx';
import { formatResultChatMemo, getSafeResultChatSources, resultChatSourceLabel } from '../src/app/utils/resultChatEvidence.ts';

test('메모로 저장해도 문장 인용 번호와 원문 링크가 함께 보존됨', () => {
  const sources = [{ title: '공공기관 안내', uri: 'https://example.test/policy', citationId: 1 }];
  const text = formatResultChatMemo('외부 사실입니다.[1]', sources);
  assert.match(text, /외부 사실입니다\.\[1\]/);
  assert.match(text, /\[1\] 공공기관 안내\nhttps:\/\/example.test\/policy/);
  assert.equal(resultChatSourceLabel(sources), '답변 문장에 연결된 출처');
});

test('과거 답변은 문장 연결이 검증된 새 출처처럼 표시하지 않음', () => {
  const legacy = [{ title: '과거 검색 링크', uri: 'https://example.test/old' }];
  assert.equal(resultChatSourceLabel(legacy), '검색 참고자료 · 문장별 연결 미확인');
  assert.match(formatResultChatMemo('과거 답변', legacy), /문장별 연결 미확인/);
  assert.equal(formatResultChatMemo('  기록 분석  ', []), '기록 분석');
});

test('위험한 주소·자격 증명 포함 링크는 화면과 메모에서 모두 제외됨', () => {
  const sources = [
    { title: '안전', uri: 'https://example.test/page', citationId: 1 },
    { title: '스크립트', uri: 'javascript:alert(1)' },
    { title: '잘못된 주소', uri: 'invalid' },
    { title: '인증정보', uri: 'https://user:pass@example.test/page' },
  ];
  assert.deepEqual(getSafeResultChatSources(sources), [sources[0]]);
  assert.doesNotMatch(formatResultChatMemo('답변[1]', sources), /javascript:|user:pass|invalid/);
});

test('실제 출처 컴포넌트가 인용 번호·안전한 링크·과거 출처 구분을 렌더링', () => {
  const render = (sources) => renderToStaticMarkup(React.createElement(ResultChatSources, { sources }));
  const current = render([{ title: '기관 안내', uri: 'https://example.test/official', citationId: 1 }]);
  assert.match(current, /답변 문장에 연결된 출처/);
  assert.match(current, /\[1\] 기관 안내/);
  assert.match(current, /href="https:\/\/example.test\/official"/);
  assert.match(current, /rel="noopener noreferrer"/);
  assert.match(render([{ title: '과거 출처', uri: 'https://example.test/old' }]), /문장별 연결 미확인/);
  assert.equal(render([{ title: '위험', uri: 'javascript:alert(1)' }]), '');
  assert.equal(render([]), '');
});
