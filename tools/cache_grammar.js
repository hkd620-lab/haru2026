const admin = require('firebase-admin');
const path = require('path');

// Firebase 초기화
const serviceAccount = require('/Users/heogyeongdae/.config/gcloud/application_default_credentials.json');
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'haru2026-8abb8'
});

const db = admin.firestore();

// 장 번호 인자 받기
const chapter = parseInt(process.argv[2]);
if (!chapter || chapter < 1 || chapter > 50) {
  console.log('사용법: node cache_grammar.js [장번호]');
  console.log('예시: node cache_grammar.js 1');
  process.exit(1);
}

// genesis JSON 읽기
const genesisData = require(`/Users/heogyeongdae/Documents/my apps/HARU2026/frontend/src/data/genesis_${chapter}.json`);
const verses = genesisData.verses;

console.log(`\n창세기 ${chapter}장 캐시 생성 시작 (${verses.length}절)\n`);

async function callGrammarFunction(verseKey, verseText) {
  const fetch = (await import('node-fetch')).default;
  const url = `https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/getGrammarExplain`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { verseKey, verseText }
    })
  });
  
  return res.json();
}

async function main() {
  let success = 0;
  let skip = 0;
  let fail = 0;

  for (const verse of verses) {
    const verseKey = `genesis_${chapter}_${verse.verse}`;
    
    // 이미 캐시 있으면 스킵
    const existing = await db.collection('grammarCache').doc(verseKey).get();
    if (existing.exists) {
      console.log(`⏭️  스킵 (캐시 있음): ${verseKey}`);
      skip++;
      continue;
    }

    try {
      console.log(`⏳ 처리 중: ${verseKey}`);
      await callGrammarFunction(verseKey, verse.text);
      console.log(`✅ 완료: ${verseKey}`);
      success++;
      
      // API 과부하 방지 (3초 대기)
      await new Promise(r => setTimeout(r, 3000));
      
    } catch (err) {
      console.log(`❌ 실패: ${verseKey} - ${err.message}`);
      fail++;
    }
  }

  console.log(`\n=============================`);
  console.log(`창세기 ${chapter}장 완료!`);
  console.log(`✅ 성공: ${success}절`);
  console.log(`⏭️  스킵: ${skip}절`);
  console.log(`❌ 실패: ${fail}절`);
  console.log(`=============================\n`);
  
  process.exit(0);
}

main();
