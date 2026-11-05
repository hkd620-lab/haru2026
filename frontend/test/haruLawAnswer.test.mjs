import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HaruLawAnswer, formatHaruLawAnswer, splitHaruLawAnswer } from '../src/app/components/HaruLawAnswer.tsx';

const render = text => renderToStaticMarkup(React.createElement(HaruLawAnswer, {text}));

test('저장 답변의 문단·강조·제목·순서 목록과 검증코드를 보존한다', () => {
  const text = '먼저 **계약 종료 여부**를 확인하세요.\n\n📋 확인된 사실\n\n첫 문단입니다.\n\n두 번째 문단입니다. 검증코드 `TXT339-P2`.\n\n💡 사용자가 지금 해야 할 행동\n\n1. 계약서를 보관하세요.\n2. 반환 요청을 기록하세요.';
  const {summary, analysis} = splitHaruLawAnswer(text);
  assert.equal(summary, '먼저 **계약 종료 여부**를 확인하세요.');
  const html = render(analysis);
  assert.match(render(summary), /<strong>계약 종료 여부<\/strong>/);
  assert.match(html, /<h3>📋 확인된 사실<\/h3>/);
  assert.match(html, /<p>첫 문단입니다\.<\/p>\s*<p>두 번째 문단입니다/);
  assert.match(html, /<code>TXT339-P2<\/code>/);
  assert.match(html, /<ol>\s*<li>계약서를 보관하세요\.<\/li>/);
  assert.match(html, /<li>반환 요청을 기록하세요\.<\/li>/);
});

test('제목으로 시작하는 답변과 한 문단 답변에서 본문을 버리거나 중복하지 않는다', () => {
  const structured = '### 확인된 사실\n\n주택임대차보호법 제8조의2를 확인했습니다.';
  assert.deepEqual(splitHaruLawAnswer(structured), {summary:'', analysis:structured});
  const paragraph = '적용 여부는 추가 확인이 필요합니다. 계약과 지역에 따라 달라질 수 있습니다.';
  assert.deepEqual(splitHaruLawAnswer(paragraph), {summary:paragraph, analysis:''});
  const softLines = '첫 문장의\n이어지는 내용입니다.\n\n다음 문단입니다.';
  assert.deepEqual(splitHaruLawAnswer(softLines), {summary:'첫 문장의\n이어지는 내용입니다.', analysis:'다음 문단입니다.'});
});

test('직접 인용·법령 번호·코드 블록의 내용을 고치지 않는다', () => {
  const text = '> 확인된 사실\n> "제8조의2(주택임대차위원회)"\n\n````text\n확인된 사실\n```\n주의사항\n````\n\n    주의사항';
  assert.equal(formatHaruLawAnswer(text), text);
  const html = render(text);
  assert.match(html, /제8조의2\(주택임대차위원회\)/);
  assert.doesNotMatch(html, /<h3>/);
  const indented = '    확인된 사실\n    제8조의2';
  assert.equal(formatHaruLawAnswer(indented), indented);
  assert.match(render(indented), /<pre><code>/);
});

test('AI·첨부 문서의 HTML과 위험한 링크를 실행 가능한 내용으로 렌더링하지 않는다', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n![문서 그림](https://example.invalid/tracker.png)\n\n[위험 링크](javascript:alert%281%29)\n\n[공식 법령](https://www.law.go.kr/)');
  assert.doesNotMatch(html, /<script|<img|onerror|href="javascript:/);
  assert.match(html, /href="https:\/\/www\.law\.go\.kr\/"/);
  assert.match(html, /문서 그림/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});
