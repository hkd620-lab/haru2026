import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAiLibrarySource, getAiLibraryOriginalUrl } from '../src/app/utils/aiLibrarySource.ts';

test('기존 주소와 본문 유튜브 주소를 표시하고 제목만으로는 링크를 만들지 않는다', () => {
  assert.equal(getAiLibraryOriginalUrl({ sourceUrl: 'https://youtu.be/abcdefghijk' }), 'https://youtu.be/abcdefghijk');
  assert.equal(getAiLibraryOriginalUrl({ content: '요약\nhttps://www.youtube.com/watch?v=abcdefghijk' }), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(getAiLibraryOriginalUrl({ content: '영상 제목만 저장됨' }), null);
});

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

test('dynamic legacy records retain valid source and title fallback without mutation', () => {
  const rows = [
    [{ id: 'synthetic', date: '2026-11-09', formats: [] }, ''],
    [{ source: 'slack', title: '[Claude] synthetic' }, 'slack'],
    [{ title: '[Claude] synthetic' }, 'Claude'],
    [{ source: 'chatgpt.com', sourceUrl: 'https://chatgpt.com/dots/synthetic' }, 'chatgpt.com/dots'],
    [{ source: 'chatgpt.com', sourceUrl: 'https://chatgpt.com.evil.invalid/dots/synthetic' }, 'chatgpt.com'],
  ];
  for (const [row, expected] of rows) {
    const before = structuredClone(row);
    assert.equal(getAiLibrarySource(row), expected);
    assert.deepEqual(row, before);
  }
});

test('malformed legacy metadata is ignored rather than coerced or executed', () => {
  for (const invalid of [null, false, 3, [], {}]) {
    assert.equal(getAiLibrarySource({ source: invalid, title: invalid, sourceUrl: invalid }), '');
    assert.equal(getAiLibrarySource({ source: invalid, title: '[slack] synthetic' }), 'slack');
    assert.equal(getAiLibrarySource({ source: 'chatgpt.com', sourceUrl: invalid }), 'chatgpt.com');
  }
  const value = { toString() { throw Error('must not coerce'); }, match() { throw Error('must not call'); } };
  assert.equal(getAiLibrarySource({ source: value, title: value, sourceUrl: value }), '');
});
