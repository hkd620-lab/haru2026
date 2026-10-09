// Cloud Functions 모의 응답 — 실제 AI·외부 API를 호출하지 않는다.
// 서버가 검증하는 입력 제한·월 한도 오류는 운영과 같은 모양으로 흉내 내어,
// "AI 품질"이 아니라 "앱이 그 응답/오류를 어떻게 다루는가"만 확인한다.
import { qa, persona, getQuotaUsed, addQuotaUsed } from './fixture';

const PLAN_LIMITS = { free: 10, basic: 100, premium: 300 } as const;
const MOCK_MARK = '[모의 다듬기 결과 — 실제 AI 아님]';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fnError(code: string, message: string, details?: unknown) {
  const e: any = new Error(message);
  e.code = `functions/${code}`;
  if (details !== undefined) e.details = details;
  return e;
}

function period() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quotaStatus() {
  const plan = persona.plan ?? 'free';
  const limit = PLAN_LIMITS[plan];
  const used = getQuotaUsed();
  return {
    plan, used, limit, remaining: Math.max(0, limit - used), period: period(),
    freeLimit: PLAN_LIMITS.free, basicLimit: PLAN_LIMITS.basic, premiumLimit: PLAN_LIMITS.premium,
  };
}

// 형식(prefix)별 통계 모양 — 운영 polishContent 가 돌려주는 stats 를 흉내 낸 고정값
const STATS_BY_PREFIX: Record<string, Record<string, number>> = {
  diary: { emotional_flow: 72, self_awareness: 65, daily_stability: 70 },
  essay: { theme_frequency: 60, emotional_depth: 68, literary_skill: 62 },
  child: { developmental_tracking: 70, parental_reflection: 66, emotional_connection: 74 },
  travel: { journey_diversity: 64, sensory_richness: 70, reflection_depth: 61 },
  garden: { cultivation_care: 71, growth_observation: 66, ecological_harmony: 63 },
  pet: { observation_detail: 69, behavioral_insight: 64, bond_expression: 72 },
  mission: { grace_awareness: 70, spiritual_growth: 66, ministry_impact: 62 },
  report: { completion_rate: 68, detail_level: 64, planning_quality: 66 },
  work: { task_completion: 70, time_management: 63, productivity: 67 },
};

// 클라이언트가 붙이는 안내문 뒤의 사용자 본문만 꺼낸다(없으면 전체).
function extractUserContent(text: string): string {
  const marker = text.lastIndexOf('본문 내용...');
  if (marker >= 0) return text.slice(marker + '본문 내용...'.length).trim();
  return text.trim();
}

async function polishContent(data: any) {
  const text = data?.text;
  if (!text || typeof text !== 'string') throw fnError('invalid-argument', '텍스트가 필요합니다.');
  if (text.length > 5000) throw fnError('invalid-argument', '텍스트는 5000자 이내여야 합니다.'); // 운영 서버와 같은 제한
  const status = quotaStatus();
  if (status.remaining <= 0) {
    throw fnError('resource-exhausted', '이번 달 AI 도움 한도를 모두 사용했습니다.', {
      reason: 'MONTHLY_AI_QUOTA_EXCEEDED', used: status.used, limit: status.limit,
    });
  }
  addQuotaUsed(1);
  await delay(150);
  const content = extractUserContent(text);
  return {
    text: `${MOCK_MARK}\n\n${content}`,
    stats: STATS_BY_PREFIX[String(data?.format || '')] ?? null,
  };
}

export async function fakeCallable(name: string, data: any): Promise<any> {
  await delay(20);
  switch (name) {
    // batch7: UI 계약만 흉내 낸다. ZIP 파싱·식물 식별·공매 조회·의학 품질은 검증하지 않는다.
    case 'analyzeFacebookZip': {
      if ((window as any).__qaBatch7Failure === name) throw fnError('unavailable', '격리 ZIP 분석 실패');
      const sdk = await import('./sdk');
      const posts = [
        { timestamp: 1790816400, text: '가족과 생일을 보냈다. 🎂\n소중한 추억', thumbnails: [] },
        { timestamp: 1790902800, text: '쇼핑몰 신상품 준비를 마쳤다.', thumbnails: [] },
        { timestamp: 1790989200, text: '가족과 공원에 갔다.', thumbnails: [] },
      ];
      for (let i = 0; i < posts.length; i++) await sdk.setDoc(sdk.doc(sdk.db, 'users', persona.uid, 'snsRecords', `mock-post-${i}`), { ...posts[i], source: 'facebook', createdAt: sdk.serverTimestamp() });
      return { success: true, count: posts.length };
    }
    case 'detectPlantAdvanced':
      if ((window as any).__qaBatch7Failure === name) throw fnError('unavailable', '격리 식물 분석 실패');
      return {
        plantId: null,
        plantNet: { name: 'Mock orchid', koName: '모의 호접란', scientificName: 'Mock species', confidence: 0.8, alternatives: [] },
        gemini: { finalGuess: '모의 호접란', finalLatinName: 'Mock species', analysis: '[모의 판독 — 실제 식물 식별 아님]', warning: '실제 식물 판단에 사용하지 마세요.', edible: 'unknown', poisonousRisk: false, similarSpecies: [], needMorePhotos: [], confidence: 'medium', careSummary: '[모의 관리 설명]', autoDiary: '[모의 관찰일지]' },
        meta: { imageCount: data.images.length, plantNetAvailable: true, geminiError: null, plantIdStatus: 'disabled', plantIdDisabledReason: '격리 모의 환경' },
      };
    case 'getOnbidRealEstateList': {
      if ((window as any).__qaBatch7Failure === name) throw fnError('unavailable', '격리 온비드 조회 실패');
      const empty = String(data?.onbidCltrNm).includes('결과없음');
      return { success: true, items: empty ? [] : [{ cltrMngNo: `MOCK-${data.pageNo}`, onbidCltrNm: `격리 공매 물건 ${data.pageNo}`, lctnSdnm: '서울특별시', lctnSggnm: '송파구', apslEvlAmt: 200000000, lowstBidPrcIndctCont: '100000000', cltrBidBgngDt: '202610011000', cltrBidEndDt: '202610091700' }], totalCount: empty ? 0 : 11, pageNo: data.pageNo, numOfRows: data.numOfRows, disclaimer: '격리 모의 응답' };
    }
    case 'petFoodCheck':
      if ((window as any).__qaBatch7Failure === name) throw fnError('unavailable', '격리 먹거리 확인 실패');
      return { riskLevel: 'unknown', answer: '[모의 안내 — 실제 먹거리 판단 아님]', reason: '화면 흐름 검증', emergency: false, geminiText: null, source: '격리 모의 데이터' };
    // batch5: 고정 모의 결과/오류. 법률·PDF 서버 품질을 판정하지 않는다.
    case 'lawSearch': {
      if (String(data?.query).includes('[모의 오류]')) throw fnError('unavailable', '격리 오류 응답');
      if (String(data?.query).includes('[모의 결과 없음]')) return { success: false, message: '격리 환경: 검색 결과 없음' };
      return { success: true, data: [{ lawName: '모의 법령', articleStr: '모의 조문', title: '격리 화면 점검용', content: '실제 법률 내용이 아닙니다. 화면·저장 흐름만 확인합니다.' }], aiSummary: '[모의 분석 — 실제 법률 자문 아님] 입력 자료를 확인하는 화면 점검입니다.' };
    }
    case 'generateGrowthTimelinePdf': {
      if (String(data?.title).includes('fallback') || (window as any).__qaForcePdfFailure) throw fnError('unavailable', '격리 PDF 실패 응답');
      return { downloadUrl: 'http://127.0.0.1:18762/mock-timeline.pdf', cached: false };
    }
    // batch6: 고정 응답. 실제 전망·법률·번역 품질 평가에서 제외한다.
    case 'analyzeRecordForProphecy':
      return { chars: '모의 인물', desire: '모의 목표', shackle: '모의 제약', events: '모의 사건', relationship: '모의 관계', personality: '모의 성격', motive: '모의 동기', theme: '모의 주제', threeLiner: '모의 줄거리' };
    case 'generateHaruProphecy':
      return { text: data?.mode === 'story' ? '[모의 미래 이야기 — 실제 예측 아님]' : '[모의 미래전망 결과 — 실제 예측 아님]' };
    case 'generateLawsuitClaimReason':
      return { claimReasonText: '[모의 청구원인 — 실제 법률 문서 아님] 입력 자료를 직접 확인하세요.', quotaRemaining: 2 };
    case 'translateToEnglish':
      if (String(data?.text).includes('[모의 오류]')) throw fnError('unavailable', '격리 번역 실패 응답');
      return { sentences: [String(data?.text).includes('산책') ? 'Mock walk sentence.' : String(data?.text).includes('독서') ? 'Mock reading sentence.' : 'Mock translation for isolated UI testing.'] };
    case 'getWordMeaning':
      return { meaning: '모의 단어 뜻', partOfSpeech: '모의 품사', phonetic: 'mock', koreanPronunciation: '모크' };
    case 'getMonthlyAiQuotaStatus':
      return quotaStatus();
    case 'polishContent':
      return polishContent(data);
    case 'extractTitle': {
      const first = String(data?.text || '').split(/[\n.!?。]/)[0].trim();
      return { title: first.slice(0, 10) };
    }
    case 'recordPaidServiceUsage':
      return { ok: true };
    case 'extractKeywords': {
      // SAYU 목록을 열면 기록마다 한 번씩 호출된다 — 응답 내용이 아니라 호출 횟수가 관찰 대상
      const words = String(data?.text || '').split(/[\s,.!?…]+/).filter((w) => w.length >= 2);
      return { keywords: [...new Set(words)].slice(0, Math.min(Number(data?.max) || 6, 4)) };
    }
    default: {
      // 아직 모의하지 않은 함수 — 제품 결함이 아니라 하네스 공백이므로 별도로 집계한다.
      if (!qa.unknownCallables.includes(name)) qa.unknownCallables.push(name);
      throw fnError('not-found', `[persona-sim] 모의되지 않은 함수: ${name}`);
    }
  }
}
