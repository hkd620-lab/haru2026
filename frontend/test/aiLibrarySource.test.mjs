import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAiLibrarySource } from '../src/app/utils/aiLibrarySource.ts';

test('김비서 폴더는 기존 sourceUrl로 분류하며 원본 메타데이터를 바꾸지 않는다', () => {
  const record = Object.freeze({source: 'chatgpt.com', sourceUrl: 'https://chatgpt.com/dots/home', title: 'original'});
  assert.equal(getAiLibrarySource(record), 'chatgpt.com/dots');
  assert.equal(record.source, 'chatgpt.com');
  assert.equal(record.title, 'original');
});

test('일반 ChatGPT, 다른 출처, 레거시·유사 주소를 보존한다', () => {
  for (const sourceUrl of [undefined, '', 'invalid', 'https://chatgpt.com/c/example', 'https://chatgpt.com/dots-other', 'https://chatgpt.com.evil.invalid/dots/home', 'http://chatgpt.com/dots/home', 'https://chatgpt.com:444/dots/home']) {
    assert.equal(getAiLibrarySource({source: 'chatgpt.com', sourceUrl}), 'chatgpt.com');
  }
  for (const source of ['slack', 'claude.ai', 'gemini.google.com']) {
    assert.equal(getAiLibrarySource({source, sourceUrl:'https://chatgpt.com/dots/home'}), source);
  }
  assert.equal(getAiLibrarySource({title:'[legacy] original'}), 'legacy');
  assert.equal(getAiLibrarySource({source:'chatgpt.com',sourceUrl:'https://chatgpt.com/dots?x=1'}), 'chatgpt.com/dots');
});
