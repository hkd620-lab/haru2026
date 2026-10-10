const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// 질문 입력칸·기록 작성 입력칸의 3줄 통일(PR #274) 정책을 소스에서 확인한다.
// - 질문칸: 처음부터 3줄, 세로 크기 조절 없음
// - 장문 작성칸: 처음은 3줄, 사용자가 세로로 키울 수 있음
// - 생성 결과 편집기 등 큰 편집기는 3줄로 줄이지 않는다
const read = (rel) => fs.readFileSync(path.resolve(__dirname, '../src/app', rel), 'utf8');

const resultChat = read('components/ResultChatModal.tsx');
const formatModal = read('components/FormatModal.tsx');
const readingAiChat = read('components/ReadingAiChat.tsx');
const haruLawPanel = read('assistants/haruLaw/HaruLawPanel.tsx');
const diaryLearn = read('pages/DiaryLearnPage.tsx');
const novelStudio = read('pages/NovelStudio.tsx');

// <textarea ...> 한 요소의 원문을 잘라 낸다. 조건에 맞는 첫 요소를 쓴다.
function textareaWhere(source, predicate, label) {
  let from = 0;
  for (;;) {
    const start = source.indexOf('<textarea', from);
    assert(start >= 0, `${label}: textarea를 찾지 못했습니다`);
    const end = source.indexOf('/>', start);
    assert(end > start, `${label}: textarea 끝을 찾지 못했습니다`);
    const element = source.slice(start, end + 2);
    if (predicate(element)) return element;
    from = end + 2;
  }
}

function assertRows3(element, label) {
  assert(/rows=\{3\}/.test(element), `${label}: rows={3}이어야 합니다`);
  assert(!/minHeight|[^a-zA-Z]height:/.test(element), `${label}: 3줄 높이를 덮는 height/minHeight가 없어야 합니다`);
}

// ── 질문 Enter 전송: requestSubmit 비의존, 한글 조합 보호 ──
assert(!resultChat.includes('requestSubmit'), '질문 Enter 전송은 requestSubmit에 의존하지 않아야 합니다(Safari 16 미만)');
assert(resultChat.includes('void sendQuestion(question);'), 'Enter 전송은 기존 sendQuestion 가드를 그대로 써야 합니다');
assert(
  resultChat.includes('onCompositionStart={() => questionEnterGuard.compositionStart()}')
    && resultChat.includes('onCompositionEnd={(event) => questionEnterGuard.compositionEnd(event.timeStamp)}')
    && resultChat.includes('onBlur={() => questionEnterGuard.reset()}'),
  '조합 시작·종료(timeStamp)·blur 해제가 연결돼야 합니다',
);
assert(
  resultChat.includes('isComposing: event.nativeEvent.isComposing')
    && resultChat.includes('keyCode: event.nativeEvent.keyCode')
    && resultChat.includes('timeStamp: event.timeStamp'),
  'Enter 판단에 isComposing·keyCode(229)·timeStamp가 전달돼야 합니다',
);

// ── 질문칸: rows=3, resize 없음 ──
const questionInputs = [
  ['공통 AI 질문', textareaWhere(resultChat, (e) => e.includes('aria-label="기록·비서 AI 질문"'), '공통 AI 질문')],
  ['독서 AI 질문', textareaWhere(readingAiChat, (e) => e.includes('aria-label="독서 AI 질문"'), '독서 AI 질문')],
  ['하루LAW 질문', textareaWhere(haruLawPanel, (e) => e.includes('aria-label="하루LAW 질문"'), '하루LAW 질문')],
  ['전망 직접 질문', textareaWhere(novelStudio, (e) => e.includes('motiveCustom'), '전망 직접 질문')],
];
for (const [label, element] of questionInputs) {
  assertRows3(element, label);
  assert(/resize:\s*'none'/.test(element), `${label}: 질문칸은 resize:none이어야 합니다`);
}

// ── 장문 작성칸: rows=3, resize 세로 허용 ──
const writingInputs = [
  ['독서 현재 본문', textareaWhere(formatModal, (e) => e.includes('aria-label="현재 읽는 본문"'), '독서 현재 본문')],
  ['간편 작성', textareaWhere(formatModal, (e) => e.includes('placeholder="자유롭게 기록해 주세요..."'), '간편 작성')],
  ['보조장부 업무 메모', textareaWhere(formatModal, (e) => e.includes('businessContextMemo'), '보조장부 업무 메모')],
  ['보조장부 일반 메모', textareaWhere(formatModal, (e) => e.includes('placeholder="관련 메모 (선택사항)"'), '보조장부 일반 메모')],
  ['독서장', textareaWhere(formatModal, (e) => e.includes("'내 독서장'"), '독서장')],
  ['기록 형식 공통 상세 입력', textareaWhere(formatModal, (e) => e.includes('handleChange(field.key, e.target.value)') && !e.includes("'내 독서장'"), '기록 형식 공통 상세 입력')],
  ['외국어일기 작성', textareaWhere(diaryLearn, (e) => e.includes('setKoreanInput'), '외국어일기 작성')],
];
for (const [label, element] of writingInputs) {
  assertRows3(element, label);
  assert(/resize:\s*'vertical'/.test(element), `${label}: 장문 작성칸은 resize:vertical이어야 합니다`);
}

// ── 생성 결과 편집기·SAYU 분석 편집기는 큰 높이를 유지 ──
assert(
  textareaWhere(formatModal, (e) => e.includes('AI가 다듬은 내용을 자유롭게 수정할 수 있습니다'), 'AI 다듬기 결과 편집기').includes("minHeight: '400px'"),
  'AI 다듬기 결과 편집기는 400px 높이를 유지해야 합니다',
);
assert(
  textareaWhere(formatModal, (e) => e.includes('value={readingAnalysis}'), '독서사유 SAYU 분석 편집기').includes('minHeight: 240'),
  '독서사유 SAYU 분석 편집기는 240px 높이를 유지해야 합니다',
);

console.log('question input policy checks passed');
