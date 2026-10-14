// PR 본문 "동일 함수 실행 비교" 표의 8사례를 수정 전(main)·후(PR) 함수로 직접 실행해 표와 대조한다.
import { pathToFileURL } from 'node:url';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const oldM = await import(pathToFileURL(`${SP}/cc-270-main/frontend/src/app/utils/assistantRecommendations.ts`).href);
const newM = await import(pathToFileURL(`${SP}/cc-270/frontend/src/app/utils/assistantRecommendations.ts`).href);
const short = { health: 'HARU 건강관리 비서', hospital: '내 증상 알아보고 병원찾기', medicine: 'HARU 약 정보 비서', law: '하루LAW', finance: 'HARU 재무 비서', plant: 'HARU 식물탐정', pet: 'HARU 반려동물건강돌봄비서', childcare: 'HARU 육아·교육 비서', travel: 'HARU 여행 비서', life: 'HARU 생활 비서' };
const f = (r) => r.map((x) => `${x.title}(${x.matchedKeywords.join('·')})`).join(', ') || '없음';
// PR 본문 표의 기대 문자열(수정 전 / 수정 후)
const rows = [
  ['소송 임대차 보증금 내용증명 합의 준비 해결 방법 상담', '메모', 'HARU 생활 비서(준비·해결·방법), 하루LAW(소송·임대차·보증금·내용증명·합의), HARU 육아·교육 비서(상담)', '하루LAW(소송·임대차·보증금·내용증명·합의)'],
  ['임차인이 보증금을 돌려주지 않아 소송을 검토한다. 내용증명을 보냈다.', '메모', '하루LAW(소송·보증금·내용증명)', '하루LAW(소송·보증금·내용증명)'],
  ['내일 회의 준비. 자료 정리하고 방법을 찾아 해결한다.', '메모', 'HARU 생활 비서(준비·정리·해결·방법)', '없음'],
  ['법률 상담을 받고 왔다.', '메모', '하루LAW(법률), HARU 육아·교육 비서(상담)', '하루LAW(법률)'],
  ['제주에서 아침 산책을 했다.', '여행기록', 'HARU 여행 비서(제주), HARU 반려동물건강돌봄비서(산책)', 'HARU 여행 비서(제주)'],
  ['새 아이디어를 정리했다.', '메모', 'HARU 생활 비서(정리), HARU 육아·교육 비서(아이)', '없음'],
  ['코스피가 올라서 기분이 좋다.', '메모', 'HARU 여행 비서(코스)', '없음'],
  ['오늘 학교에서 아이들과 상담 시간을 가졌다.', '일기', 'HARU 육아·교육 비서(아이·학교·상담)', 'HARU 육아·교육 비서(아이·학교·상담)'],
];
let okOld = 0, okNew = 0;
for (const [text, fmt, expOld, expNew] of rows) {
  const o = f(oldM.getAssistantRecommendations(text, [fmt]));
  const n = f(newM.getAssistantRecommendations(text, [fmt]));
  const a = o === expOld, b = n === expNew;
  okOld += a; okNew += b;
  console.log(`${a ? 'OK ' : 'DIFF'}/${b ? 'OK ' : 'DIFF'} [${fmt}] ${text}`);
  if (!a) console.log(`   전 실행: ${o}\n   전 표기: ${expOld}`);
  if (!b) console.log(`   후 실행: ${n}\n   후 표기: ${expNew}`);
}
console.log(`PR 표 대조: 수정 전 ${okOld}/8 일치, 수정 후 ${okNew}/8 일치`);
