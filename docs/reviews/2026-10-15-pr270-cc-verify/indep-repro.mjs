// 독립 검토자 보고의 대표 사례를 CC 환경에서 다시 실행해 재현되는지 확인한다(수정 전 main vs 수정 후 PR).
import { pathToFileURL } from 'node:url';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const oldM = await import(pathToFileURL(`${SP}/cc-270-main/frontend/src/app/utils/assistantRecommendations.ts`).href);
const newM = await import(pathToFileURL(`${SP}/cc-270/frontend/src/app/utils/assistantRecommendations.ts`).href);
const f = (r) => r.map((x) => `${x.id}(${x.matchedKeywords.join('·')})`).join(' ') || '없음';
const groups = {
  '구어 조사(P2-1)': ['강아지랑 산책했다', '강아지하고 산책했다', '아이랑 놀이터에 갔다', '아이들이랑 놀았다', '선생님께 편지를 썼다'],
  '정중체·명사형 감정 활용형(P2-2)': ['걱정돼요', '걱정했어요', '걱정됩니다', '요즘 불안해요', '고민이에요', '불안감이 크다', '고민했는데 결정했다', '요즘 걱정이다', '고민이 많다', '불안한 마음이 든다'],
  '법률 활용형·합성어(P2-3)': ['상대방을 고소했다', '상대방과 합의했다', '합의서를 작성했다', '고소장을 접수했다', '전세보증금을 돌려받지 못했다', '민사소송을 준비 중이다', '행정소송을 검토한다', '무료법률상담을 신청했다', '변호사님과 통화했다'],
  '건강·약(P2-3)': ['공복혈당이 140이 나왔다', '저혈당이 왔다', '고혈압 약을 먹고 있다', '고혈압 진단을 받았다', '두통약을 먹었다', '진료받았다', '병원비가 많이 나왔다', '처방전을 받았다'],
  '재무(P2-3)': ['월급이 입금되었다', '계약금을 입금했다', '건강보험료가 올랐다', '현금영수증을 발급받았다'],
  '식물·여행(P3)': ['파종했다', '부산여행을 계획 중이다'],
  '여전히 뜨는 오탐(P3-3)': ['호박을 넣어 된장찌개를 끓였다', '오늘 점심에 고추를 먹었다', '직원 교육을 받았다', '일본 드라마를 봤다'],
  '이 PR이 해소한 오탐': ['고추장을 담갔다', '안전교육 일정을 정리해야 한다', '일본어 공부를 시작했다', '마음이 불안정하다'],
};
for (const [g, arr] of Object.entries(groups)) {
  console.log(`## ${g}`);
  for (const t of arr) console.log(`  ${t} | 전 ${f(oldM.getAssistantRecommendations(t, ['일기']))} | 후 ${f(newM.getAssistantRecommendations(t, ['일기']))}`);
}
// P3-2 경계 시험 4쌍 + 변이 M01·M03에서의 결과
const base = `${SP}/cc-270-mut/frontend/src/app/utils/`;
const m01 = await import(pathToFileURL(base + 'assistantRecommendations.M01.ts').href);
const m03 = await import(pathToFileURL(base + 'assistantRecommendations.M03.ts').href);
const ids = (m, t) => m.getAssistantRecommendations(t, ['메모']).map((x) => x.id).join(',') || '없음';
console.log('## 독립 검토자 제안 경계 시험 4쌍(기대, 원본, M01 강2, M03 약2)');
for (const [t, exp] of [['소송 임대차 보증금 강아지 산책', 'law'], ['소송 임대차 보증금 강아지 산책 피부', 'law,pet'], ['소송 임대차 보증금 내용증명 강아지 산책 피부', 'law'], ['소송 임대차 보증금 내용증명 강아지 산책 피부 구토', 'law,pet']]) {
  console.log(`  ${t} | 기대 ${exp} | 원본 ${ids(newM, t)} | M01 ${ids(m01, t)} | M03 ${ids(m03, t)}`);
}
