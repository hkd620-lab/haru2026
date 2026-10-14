// 수정 전·후 함수의 실행 시간과 정규식 최악 입력(역추적) 점검. 시간은 이 컨테이너 측정값이라 절대값이 아니라 비교용이다.
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const oldM = await import(pathToFileURL(`${SP}/cc-270-main/frontend/src/app/utils/assistantRecommendations.ts`).href);
const newM = await import(pathToFileURL(`${SP}/cc-270/frontend/src/app/utils/assistantRecommendations.ts`).href);
const persona = JSON.parse(fs.readFileSync(`${SP}/pr270-verify/corpus-persona.json`, 'utf8')).map((x) => x.text);
const pool = persona.join(' ');
const mk = (n) => pool.repeat(Math.ceil(n / pool.length)).slice(0, n);
function bench(fn, text, iters) {
  for (let i = 0; i < 5; i++) fn(text, ['일기']);
  const t = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn(text, ['일기']);
  return Number(process.hrtime.bigint() - t) / 1e6 / iters;
}
for (const [label, n, iters] of [['짧은 기록 200자', 200, 400], ['보통 기록 2,000자', 2000, 200], ['긴 기록 20,000자', 20000, 40], ['아주 긴 기록 100,000자', 100000, 8]]) {
  const text = mk(n);
  const o = bench(oldM.getAssistantRecommendations, text, iters);
  const w = bench(newM.getAssistantRecommendations, text, iters);
  console.log(`${label}: 수정 전 ${o.toFixed(3)}ms/호출, 수정 후 ${w.toFixed(3)}ms/호출 (x${(w / o).toFixed(1)})`);
}
// 최악 입력: 키워드·조사 반복, 한글 연속, 경계 문자만 반복 등
const adversarial = {
  '아이 반복(공백 없음) 50,000자': '아이'.repeat(25000),
  '아이+조사 반복 50,000자': '아이에서'.repeat(12500),
  '들 반복 50,000자': '아이' + '들'.repeat(50000),
  '키워드 공백 반복 50,000자': '아이 '.repeat(16000),
  '조사 연쇄 50,000자': '아이' + '에서도는만'.repeat(8000),
  '한글 연속 100,000자': '가'.repeat(100000),
  '숫자·기호 반복 100,000자': '1_'.repeat(50000),
  '긴 키워드 접두 반복 50,000자': '혈당수치'.repeat(12500),
};
for (const [label, text] of Object.entries(adversarial)) {
  const t = process.hrtime.bigint();
  const r = newM.getAssistantRecommendations(text, ['일기']);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(`최악 입력 ${label}: ${ms.toFixed(1)}ms, 결과 ${r.map((x) => x.id).join(',') || '없음'}`);
}
