// 합성 데이터만 사용한다. Firebase SDK는 이 파일로 치환되어 운영 연결이 없다.
export const db = {}, storage = {};
export const useAuth = () => ({ user: { uid: 'fixture-law-owner' } });
export const useSubscription = () => ({ subscription: { status: 'active', plan: new URLSearchParams(location.search).get('plan') || 'basic' } });
export const state = { failSearch: false, failSave: false, calls: [] as any[], records: {} as Record<string, any> };
export const emit = () => window.dispatchEvent(new Event('law-fixture'));
export const doc = (_db: unknown, ...parts: string[]) => parts.join('/');
export const ref = doc;
export const uploadBytes = async (path: string) => { state.calls.push({ upload: path }); emit(); };
export const getDoc = async (path: string) => ({ exists: () => !!state.records[path], data: () => structuredClone(state.records[path]) });
export const firestoreService = { saveRecord: async (uid: string, data: any) => {
  if (state.failSave) throw { code: 'unavailable' };
  const path = `users/${uid}/records/${data.id}`;
  state.records[path] = { ...state.records[path], ...structuredClone(data) }; emit(); return data.id;
} };
export const getFunctions = (_app: unknown, region: string) => ({ region });
export const httpsCallable = (functions: any, name: string) => async (input: any) => {
  state.calls.push({ name, region: functions.region, ...input }); emit();
  if (state.failSearch) throw { code: 'functions/unavailable' };
  if (name === 'lawSearch') return { data: { success: true, data: [{ lawName: '검증용 법령', articleStr: '제1조', title: '합성 조문', content: '화면 시험용 합성 자료입니다.' }], aiSummary: '합성 분석 결과입니다. 실제 법률 안내가 아닙니다.' } };
  return { data: { success: true, explanation: '합성 AI 해석', data: '합성 AI 해석' } };
};
