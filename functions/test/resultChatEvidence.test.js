const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildResultChatEvidence, isRecordMediaQuestion } = require('../lib/resultChatEvidence');

const chunk = (uri = 'https://example.test/official') => ({ web: { title: '공식 안내', uri } });
const support = (text, indices = [0], prefix = '', partIndex = 0) => ({
  segment: { startIndex: Buffer.byteLength(prefix), endIndex: Buffer.byteLength(prefix + text), text, partIndex },
  groundingChunkIndices: indices,
});
const response = (text, supports = [], chunks = [chunk()], parts) => ({
  text,
  candidates: [{ content: parts ? { parts } : undefined, groundingMetadata: {
    webSearchQueries: ['검색'], groundingChunks: chunks, groundingSupports: supports,
  } }],
});

test('검색어·링크만 있고 답변 연결이 없으면 출처로 채택하지 않음', () => {
  const result = buildResultChatEvidence(response('사진이 전달되지 않았습니다.'));
  assert.equal(result.usedWebSearch, false);
  assert.deepEqual(result.sources, []);
});

test('한글·이모지 바이트 위치에 인용하고 답변에서 사용하지 않은 링크 제외', () => {
  const prefix = '기록에는 여행을 다녀왔다고 적혀 있습니다. 🌿\n';
  const fact = '공식 관람 시간은 오전 9시입니다.';
  const result = buildResultChatEvidence(response(prefix + fact + ' 확인 후 방문하세요.',
    [support(fact, [1], prefix)], [chunk('https://example.test/unrelated'), chunk()]));
  assert.equal(result.answer, prefix + fact + '[출처 1] 확인 후 방문하세요.');
  assert.deepEqual(result.sources, [{ title: '공식 안내', uri: 'https://example.test/official', citationId: 1 }]);
});

test('여러 문장·중복 URL·뒤섞인 연결은 본문 등장 순서로 번호를 매김', () => {
  const first = '첫 번째 사실.';
  const second = '두 번째 사실.';
  const result = buildResultChatEvidence(response(first + second,
    [support(second, [0, 2], first), support(first, [1, 1])],
    [chunk('https://example.test/b'), chunk('https://example.test/a'), chunk('https://example.test/a')]));
  assert.equal(result.answer, first + '[출처 1]' + second + '[출처 2][출처 1]');
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].uri, 'https://example.test/a');
});

test('다중 part·thought 제외 후 위치를 연결하고 비정상 part는 거부', () => {
  const text = '기록 사실.외부 사실.';
  const parts = [{ text: '내부 추론', thought: true }, { text: '기록 사실.' }, { text: '외부 사실.' }];
  const result = buildResultChatEvidence(response(text, [support('외부 사실.', [0], '', 2)], [chunk()], parts));
  assert.equal(result.answer, text + '[출처 1]');
  assert.equal(buildResultChatEvidence(response(text, [support('내부 추론')], [chunk()], parts)).usedWebSearch, false);
});

test('틀린 인덱스·본문 불일치·잘린 문장·위험 URL·없는 chunk로는 인용 불가', () => {
  const text = '한글 문장입니다.';
  const variants = [
    [support('다른 문장입니다.')],
    [{ ...support(text), segment: { startIndex: 1, endIndex: Buffer.byteLength(text) } }],
    [{ ...support(text), segment: { startIndex: 0, endIndex: 999 } }],
    [support(text, [20, -1, 0.5])],
    [support(text, [0], '', 99)],
  ];
  for (const supports of variants) assert.equal(buildResultChatEvidence(response(text, supports)).usedWebSearch, false);
  for (const uri of ['javascript:alert(1)', 'data:text/html,evil', 'https://user:pass@example.test', 'invalid']) {
    assert.equal(buildResultChatEvidence(response(text, [support(text)], [chunk(uri)])).usedWebSearch, false);
  }
  const longText = '가'.repeat(4600);
  assert.equal(buildResultChatEvidence(response(longText, [support(longText)])).usedWebSearch, false);
  assert.equal(buildResultChatEvidence(response(text, [support(text)], [chunk()], [{ text: '다른 part' }])).usedWebSearch, false);
});

test('연도·배열 등 대괄호 숫자 원문은 보존하고 서버 인용을 별도 표기로 구분', () => {
  const prefix = '정부가 [2026]년에 발표한 배열 값은 [100]입니다. ';
  const fact = '확인된 사실입니다.';
  const result = buildResultChatEvidence(response(prefix + fact, [support(fact, [0], prefix)]));
  assert.equal(result.answer, prefix + fact + '[출처 1]');
  assert.equal(buildResultChatEvidence(response(prefix, [support(prefix)])).answer, prefix.trim() + ' [출처 1]');
});

test('첨부 관찰 질문은 기록 분석, 명시적 외부 확인은 검색 선택 유지', () => {
  for (const question of ['첨부한 사진은 어떤 사진이야?', '본문속의 그림은 어떤 그림이지?', '첨부 PDF 내용을 읽어줘',
    '사진을 분석해주세요', '본문 속의 이미지 내용을 설명해 주세요']) {
    assert.equal(isRecordMediaQuestion(question), true, question);
  }
  for (const question of ['사진 속 그림의 화가를 검색해줘', '그림의 역사와 원작을 알려줘', '최신 외부자료로 사진의 출처를 확인해줘', '내일 날씨는?',
    '사진 내용을 설명하고 오늘 서울 날씨도 알려줘', '사진을 분석하고 주변 맛집도 알려줘',
    '첨부 PDF를 읽고 내일 환율을 설명해줘', '사진을 설명해줘. 박물관 영업시간도 알려줘',
    '사진 내용을 설명해주면서 주변 맛집도 알려줘', '그림 내용 설명에 박물관 개관 정보도 포함해줘']) {
    assert.equal(isRecordMediaQuestion(question), false, question);
  }
});
