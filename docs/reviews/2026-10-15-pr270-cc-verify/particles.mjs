// 키워드 '강아지' 뒤에 흔한 조사·어미를 붙여 현재 규칙이 인식하는지 확인한다(수정 후 함수, 반려동물 강한 단어 기준).
import { pathToFileURL } from 'node:url';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const newM = await import(pathToFileURL(`${SP}/cc-270/frontend/src/app/utils/assistantRecommendations.ts`).href);
const sufs = ['이','가','은','는','을','를','의','에','에서','에게','한테','께','으로','로','와','과','랑','이랑','하고','도','만','까지','부터','처럼','보다','마다','조차','마저','밖에','뿐','이나','나','이든','든','이라','이라는','라는','라고','이라고','이다','입니다','이에요','예요','였다','이었다','이야','인데','인','이고','이며','에서는','에서도','에는','에도','으로는','으로도','과의','와의','에서의','으로의','들','들이','들은','들을','들과','들의','님','님이','님과','중','쯤','씩','한테서','에게서','이랑은','하고는','밖에는','만의','만큼','같이','처럼은','치고','라도','이라도','야','아','여','이여','다','했다','했어요','와도','과도','를도'];
const hit = [], miss = [];
for (const s of sufs) {
  const t = `우리 강아지${s} 좋다`;
  (newM.getAssistantRecommendations(t).some((r) => r.id === 'pet') ? hit : miss).push(s);
}
console.log('인식:', hit.join(' '));
console.log('놓침:', miss.join(' '));
