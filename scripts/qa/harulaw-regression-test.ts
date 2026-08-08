// 하루LAW 품질 회귀 테스트 자동화 스크립트
// 실행: npx tsx scripts/qa/harulaw-regression-test.ts  (반드시 haru2026-source 루트에서 실행)
//
// 질문 출처: 하루LAW_품질회귀테스트체크리스트.md (8개 질문)
// 배포된 lawSearch 함수를 실제로 호출해 aiSummary 응답을 파일로 저장한다.
// 판정/평가는 하지 않는다 — 원문 그대로 수집만.

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'haru2026-8abb8';
const REGION = 'asia-northeast3';
const FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/lawSearch`;
// functions/src/index.ts의 DEVELOPER_UIDS와 동일한 개발자 계정 (QA 호출은 isDev로 집계됨)
const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

const QUESTIONS: { no: number; title: string; query: string }[] = [
  { no: 1, title: '근로/해고', query: '직원이 무단결근을 반복해서 해고했는데, 부당해고라고 노동청에 신고한다고 합니다. 어떻게 대응해야 하나요?' },
  { no: 2, title: '임대차 보증금', query: '세입자가 나갔는데 벽지 훼손을 이유로 보증금에서 200만원을 공제하려고 합니다. 세입자가 소송하겠다고 합니다.' },
  { no: 3, title: '소비자 환불 분쟁', query: '온라인으로 산 제품에 하자가 있어서 환불을 요청했는데 판매자가 단순 변심이라며 거부합니다.' },
  { no: 4, title: '온라인 명예훼손/모욕', query: 'SNS에서 저희 가게에 대해 거짓 후기를 올린 사람을 고발하고 싶습니다.' },
  { no: 5, title: '반려동물 관련 사고', query: '산책 중이던 저희 강아지가 다른 사람을 물어서 다치게 했습니다. 상대방이 치료비와 위자료를 요구합니다.' },
  { no: 6, title: '교통사고 초기 대응 (경미)', query: '주차장에서 접촉사고가 났는데 상대방이 블랙박스 영상 공유를 거부하고 과실비율을 다투고 있습니다.' },
  { no: 7, title: '가족/상속', query: '부모님이 돌아가셨는데 형제 중 한 명이 유언장 없이 재산을 독차지하려고 합니다.' },
  { no: 8, title: '개인 간 금전 대여', query: '지인에게 돈을 빌려줬는데 차용증 없이 구두로만 약속했고 갚지 않고 있습니다.' },
];

function readEnvValue(envPath: string, key: string): string {
  const content = fs.readFileSync(envPath, 'utf-8');
  const line = content.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  if (!line) throw new Error(`${key}를 ${envPath}에서 찾을 수 없습니다.`);
  return line.split('=').slice(1).join('=').trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getIdToken(): Promise<string> {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: PROJECT_ID,
      // 로컬 ADC(사용자 자격증명)는 signBlob 대상 서비스 계정을 자동 판별하지 못해 명시 지정
      // (hkd620@gmail.com에 firebase-adminsdk-fbsvc SA에 대한 Service Account Token Creator 권한 부여됨)
      serviceAccountId: 'firebase-adminsdk-fbsvc@haru2026-8abb8.iam.gserviceaccount.com',
    });
  }
  const customToken = await admin.auth().createCustomToken(DEV_UID);

  const envPath = path.resolve(process.cwd(), 'frontend/.env');
  const apiKey = readEnvValue(envPath, 'VITE_FIREBASE_API_KEY');

  const res = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
    20000
  );
  const json: any = await res.json();
  if (!res.ok || !json.idToken) {
    throw new Error(`signInWithCustomToken 실패: ${JSON.stringify(json)}`);
  }
  return json.idToken;
}

async function callLawSearch(
  idToken: string,
  query: string
): Promise<{ ok: boolean; aiSummary?: string; error?: string }> {
  try {
    const res = await fetchWithTimeout(
      FUNCTION_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ data: { query } }),
      },
      110000
    );
    const json: any = await res.json();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(json)}` };
    }
    const result = json.result ?? json;
    if (!result?.success) {
      return { ok: false, error: `함수 응답 실패: ${JSON.stringify(json)}` };
    }
    return { ok: true, aiSummary: result.aiSummary };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function main() {
  console.log(`하루LAW 회귀 테스트 시작 — ${QUESTIONS.length}개 질문`);
  console.log(`대상: ${FUNCTION_URL}`);

  const idToken = await getIdToken();
  console.log('테스트 계정 인증 완료 (커스텀 토큰 → ID 토큰 교환)');

  const results: Array<{ no: number; title: string; query: string; ok: boolean; aiSummary?: string; error?: string }> = [];

  for (const q of QUESTIONS) {
    console.log(`\n[${q.no}/${QUESTIONS.length}] ${q.title} 질문 중...`);
    const r = await callLawSearch(idToken, q.query);
    results.push({ ...q, ...r });
    console.log(r.ok ? `  응답 수신 (${r.aiSummary?.length ?? 0}자)` : `  실패: ${r.error}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), 'scripts/qa/results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `harulaw-regression-${timestamp}.md`);

  const lines: string[] = [];
  lines.push('# 하루LAW 품질 회귀 테스트 결과');
  lines.push('');
  lines.push(`실행 시각: ${new Date().toISOString()}`);
  lines.push(`대상 함수: lawSearch (${FUNCTION_URL})`);
  lines.push('');
  lines.push('---');
  for (const r of results) {
    lines.push('');
    lines.push(`## ${r.no}. ${r.title}`);
    lines.push('');
    lines.push(`**질문**: ${r.query}`);
    lines.push('');
    if (r.ok) {
      lines.push('**응답**:');
      lines.push('');
      lines.push(r.aiSummary || '(빈 응답)');
    } else {
      lines.push(`**오류**: ${r.error}`);
    }
    lines.push('');
    lines.push('---');
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`\n결과 저장 완료: ${outPath}`);
}

main().catch((err) => {
  console.error('스크립트 실행 실패:', err);
  process.exit(1);
});
