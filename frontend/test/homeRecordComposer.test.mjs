import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeRecordComposer } from '../src/app/components/HomeRecordComposer.tsx';

// Node의 TSX 로더는 Vite의 자동 JSX 설정을 읽지 않는다.
globalThis.React = React;
const render = (state) => renderToStaticMarkup(React.createElement(HomeRecordComposer, {
  content: '', onContentChange() {}, onContinue() {}, onBrowseFormats() {}, onLogin() {}, ...state,
}));

test('비로그인 상태에서는 기록을 입력받기 전에 로그인 동선을 제공한다', () => {
  const html = render({ signedIn: false, ready: false });
  assert.match(html.match(/<textarea[^>]*>/)[0], /disabled/);
  assert.match(html, /로그인하고 기록하기/);
  assert.match(html, /로그인하면 나의 기록을 남길 수 있어요/);
});

test('첫 안내의 자동 이동 여부가 결정되기 전에는 글을 입력받지 않는다', () => {
  const html = render({ signedIn: true, ready: false });
  assert.match(html.match(/<textarea[^>]*>/)[0], /disabled/);
  assert.match(html, /첫 사용 안내를 확인하고 있어요/);
  assert.match(html, /작성 화면 준비 중/);
});

test('로그인과 안내 확인이 끝나면 기존 작성 전후 형식 선택 흐름을 제공한다', () => {
  const html = render({ signedIn: true, ready: true, content: '작성할 기록' });
  assert.doesNotMatch(html.match(/<textarea[^>]*>/)[0], /disabled/);
  assert.match(html, /작성할 기록/);
  assert.match(html, /다음 · 기록 형식 고르기/);
  assert.match(html, /다음 화면에서 내용을 확인한 뒤 저장해요/);
});
