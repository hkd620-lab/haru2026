import { state, emit, user } from './fixture';
export const db = {}, auth = { currentUser: user }, app = {}, storage = {};
export const getFirestore = () => db, getFunctions = () => ({}), getStorage = () => ({});
export const doc = (...args: any[]) => ({ path: args.filter((arg) => typeof arg === 'string').join('/') });
export const collection = doc, query = (reference: any, ...constraints: any[]) => ({ ...reference, constraints }), where = (...args: any[]) => args;
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const getDocs = async () => {
  const docs = state.records.map((record: any) => ({ id: record.id, data: () => structuredClone(record) }));
  return { docs, empty: !docs.length, forEach: (callback: any) => docs.forEach(callback) };
};
export const setDoc = async () => { throw new Error('QA: direct write forbidden'); };
export const writeBatch = () => { throw new Error('QA: batch write forbidden'); };
export const ref = (...args: any[]) => args;
export const uploadBytes = async () => { throw new Error('QA: permanent image upload forbidden'); };
export const getDownloadURL = async () => { throw new Error('QA: storage lookup forbidden'); };
export const deleteObject = async () => {};
export const httpsCallable = (_functions: unknown, name: string) => async (input: any) => {
  // Store only synthetic text fields, never image base64.
  const { imageBase64, ...safeInput } = input || {};
  state.calls.push({ name, ...safeInput, imageReceived: !!imageBase64 }); emit();
  if ((name === 'extractReadingBookTextFromPhoto' && state.fail === 'ocr') || (name === 'chatWithReadingContext' && state.fail === 'ai')) throw { code: 'functions/internal', message: '합성 AI 실패' };
  if (name === 'chatWithReadingContext' && state.fail === 'quota') throw { code: 'functions/resource-exhausted', details: { reason: 'MONTHLY_AI_QUOTA_EXCEEDED' } };
  if (name === 'chatWithReadingContext' && state.fail === 'network') throw { code: 'functions/unavailable' };
  if (name === 'extractReadingBookTextFromPhoto') return { data: { text: '합성 OCR 본문: 자유는 책임을 동반한다.', usedCount: 1, limit: 20, remainingCount: 19 } };
  if (name === 'chatWithReadingContext') return { data: { answer: input.action === 'journal' ? '선택한 AI 답변은 자유와 책임을 연결했다. AI 설명이며 사용자의 생각이 아니다.' : `합성 AI 답변: 질문 ‘${input.question}’에 대해 현재 제공된 본문은 자유와 책임의 연결을 보여줍니다.${input.previousReadingSummary ? ' 같은 책의 이전 사용자 기록도 참고했습니다.' : ''}${input.conversation.length ? ' 앞선 질문의 문맥을 이어갑니다.' : ''}`, memory: '사용자 질문: 자유와 책임의 관계. AI 설명(참고): 제공된 본문에서 연결된다.', usage: { plan: 'free', used: ++state.used, limit: 10, remaining: 10 - state.used, period: '2026-10' } } };
  if (name === 'polishContent') return { data: { text: input.text.includes('누적 기록:') ? '합성 마무리 분석: 사용자는 자유와 책임을 반복해서 질문하고 자신의 선택을 돌아봤다. AI 메모는 보조자료다.' : '합성 다듬기: 사용자가 자신의 선택을 돌아보고 자유와 책임의 관계를 질문했다.' } };
  throw new Error(`QA: unknown callable ${name}`);
};
