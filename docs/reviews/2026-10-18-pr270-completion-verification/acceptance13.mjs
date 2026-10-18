// 근거 문서(2-1절) 합격 기준 13행을 수정 후(PR) 함수로 직접 실행해 확인한다. 수정 전(main) 결과를 함께 적는다.
import { pathToFileURL } from 'node:url';
const SP = '/private/tmp';
const oldM = await import(pathToFileURL(`${SP}/haru-pr270-completion-20261018/frontend/src/app/utils/assistantRecommendations.main.ts`).href);
const newM = await import(pathToFileURL(`${SP}/haru-pr270-completion-20261018/frontend/src/app/utils/assistantRecommendations.ts`).href);
const ids = (r) => r.map((x) => x.id);
const f = (r) => r.map((x) => `${x.id}(${x.matchedKeywords.join('·')})`).join(' ') || '없음';
const rows = [
  ['1a 법률 메모 하루LAW 1장만(메모)', '소송 임대차 보증금 내용증명 합의 준비 해결 방법 상담', ['메모'], (i) => i.length === 1 && i[0] === 'law'],
  ['1b 법률 메모 하루LAW 1장만(일기)', '소송 임대차 보증금 내용증명 합의 준비 해결 방법 상담', ['일기'], (i) => i.length === 1 && i[0] === 'law'],
  ['2 회의 메모 추천 없음', '내일 회의 준비. 자료 정리하고 방법을 찾아 해결한다.', ['메모'], (i) => i.length === 0],
  ['3 법률 상담: 하루LAW 있음·육아교육 없음', '법률 상담을 받고 왔다.', ['메모'], (i) => i.includes('law') && !i.includes('childcare')],
  ['4 제주 산책: 여행만(F-21)', '제주에서 아침 산책을 했다.', ['여행기록'], (i) => i.length === 1 && i[0] === 'travel'],
  ['5 새 아이디어: 육아교육 없음', '새 아이디어를 정리했다.', ['메모'], (i) => !i.includes('childcare')],
  ['6 새 아이템 회의: 육아교육 없음', '새 아이템 회의를 했다.', ['업무일지'], (i) => !i.includes('childcare')],
  ['7 코스피: 여행 없음', '코스피가 올라서 기분이 좋다.', ['메모'], (i) => !i.includes('travel')],
  ['8 일정하다: 여행 없음', '요즘 컨디션이 일정하다.', ['일기'], (i) => !i.includes('travel')],
  ['9 강아지와 산책: 반려동물 있음', '강아지와 아침 산책을 했다.', ['일기'], (i) => i.includes('pet')],
  ['10 고민·불안·걱정: 생활 있음', '요즘 고민이 많고 불안하다. 어떻게 준비해야 할지 걱정이다.', ['메모'], (i) => i.includes('life')],
  ['11 아이 학교 상담: 육아교육 있음', '아이 학교 상담이 있었다.', ['일기'], (i) => i.includes('childcare')],
  ['12 혈당·병원 검사: 건강관리 또는 병원찾기', '혈당이 높아 병원 검사를 받았다.', ['일기'], (i) => i.includes('health') || i.includes('hospital')],
  ['13 F-10 교사 맥락(결과만 기록, 해소 불요)', '오늘 학교에서 아이들과 상담 시간을 가졌다.', ['일기'], () => true],
];
let pass = 0;
for (const [name, text, fmts, ok] of rows) {
  const n = newM.getAssistantRecommendations(text, fmts);
  const o = oldM.getAssistantRecommendations(text, fmts);
  const good = ok(ids(n));
  pass += good;
  console.log(`${good ? 'PASS' : 'FAIL'} ${name}\n     후 ${f(n)} | 전 ${f(o)}`);
}
console.log(`합격 기준 ${pass}/${rows.length}`);
