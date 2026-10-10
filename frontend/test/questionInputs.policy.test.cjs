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
const plantDetective = read('pages/PlantDetectivePage.tsx');
const enterSubmit = read('utils/questionEnterSubmit.ts');

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
assert(
  resultChat.includes('handleQuestionEnterKeyDown(questionEnterGuard, event, () => { void sendQuestion(question); })'),
  'Enter 전송은 기존 sendQuestion 가드를 그대로 써서 한 곳(handleQuestionEnterKeyDown)에서 처리해야 합니다',
);
assert(!resultChat.includes('questionEnterGuard.decide('), '키 판단은 컴포넌트가 아니라 유틸(handleQuestionEnterKeyDown)에 있어야 합니다');
assert(
  resultChat.includes('const [questionEnterGuard] = useState(() => new EnterSubmitGuard());'),
  '가드는 렌더마다 새로 만들지 않고 한 번만 만들어야 합니다',
);
assert(
  resultChat.includes('onCompositionStart={() => questionEnterGuard.compositionStart()}')
    && resultChat.includes('onCompositionEnd={(event) => questionEnterGuard.compositionEnd(event.timeStamp)}')
    && resultChat.includes('onBlur={() => questionEnterGuard.reset()}'),
  '조합 시작·종료(timeStamp)·blur 해제가 연결돼야 합니다',
);
assert(
  enterSubmit.includes('isComposing: event.nativeEvent.isComposing')
    && enterSubmit.includes('keyCode: event.nativeEvent.keyCode')
    && enterSubmit.includes('timeStamp: event.timeStamp')
    && enterSubmit.includes('Math.abs(sinceCompositionEnd) < this.guardMs'),
  'Enter 판단에 isComposing·keyCode(229)·timeStamp가 전달되고 보호 시간은 시각 차이의 절댓값으로 비교해야 합니다',
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
  // 식물탐정 "오늘의 관찰": 같은 폼의 두 입력칸이 이미 3줄이라 자유 메모만 2줄이던 것을 맞췄다.
  ['식물탐정 자유 메모', textareaWhere(plantDetective, (e) => e.includes('setObsMemo'), '식물탐정 자유 메모')],
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

// ── 보존: 질문칸의 값·잠금·글자 수 제한, 작은 편집기·일기 상세는 그대로 ──
const commonQuestion = questionInputs[0][1];
assert(
  commonQuestion.includes('value={question}')
    && commonQuestion.includes('disabled={loading || uploadingFiles || closingAttachments || isChoicePending}'),
  '공통 AI 질문칸은 값 연결과 대기·첨부·확인 대기 잠금을 유지해야 합니다',
);
const readingQuestion = questionInputs[1][1];
assert(
  readingQuestion.includes('maxLength={1000}') && readingQuestion.includes('disabled={locked}'),
  '독서 AI 질문칸은 1000자 제한과 잠금을 유지해야 합니다',
);
assert(
  /rows=\{4\}/.test(textareaWhere(readingAiChat, (e) => e.includes('aria-label="AI 참고 메모 제안"'), 'AI 참고 메모 제안')),
  'AI 참고 메모 제안 편집기는 4줄을 유지해야 합니다(결과 편집기는 줄이지 않음)',
);
const diaryDetail = textareaWhere(formatModal, (e) => e.includes("FORMAT_FIELDS['일기'].find"), '일기 상세');
assertRows3(diaryDetail.replace(/minHeight:\s*'56px',?/, ''), '일기 상세');
assert(/resize:\s*'none'/.test(diaryDetail), '일기 상세는 변경 전부터 resize 없음이라 그대로여야 합니다');

console.log('question input policy checks passed');
