export type HaruRecord = any;
export const state = { failMove: false, delayed: false, bounded: false, calls: [] as any[], alerts: [] as string[] };
const seed = () => [
  { id: 'legacy', title: '합성 미분류 대화', content: '합성 원문입니다. 실제 사용자 자료가 아닙니다.', source: 'slack', createdAt: '2026-11-09T01:00:00Z' },
  { id: 'health', title: '합성 건강 자료', content: '합성 건강 자료의 원문입니다.', aiCategory: 'health', source: 'chatgpt.com', createdAt: '2026-11-08T01:00:00Z' },
  { id: 'ai', title: '합성 AI 자료', content: '합성 AI 자료의 원문입니다.', aiCategory: 'ai-tech', source: 'claude.ai', createdAt: '2026-11-07T01:00:00Z' },
];
let records = seed();
export function reset() { records = seed(); state.failMove = state.delayed = state.bounded = false; state.calls = []; state.alerts = []; }
export const useAuth = () => ({ user: { uid: 'synthetic-user', email: 'qa@example.invalid', emailVerified: true } });
export const hasAiLibraryAccess = () => true;
export const getFunctions = () => ({});
export const httpsCallable = (_: unknown, name: string) => async (data: unknown) => { state.calls.push({ name, data }); return { data: { ok: true, bookMaterial: { enabled: true, bookSummary: '합성 책소재 요약' } } }; };
export const firestoreService = {
  async getAiLogPage(cursor?: string, category = 'all') {
    state.calls.push({ name: 'list', category, cursor });
    const logs = records.filter(row => category === 'all' || (row.aiCategory || 'unclassified') === category).map(row => ({ ...row }));
    if (state.delayed && category === 'health') await new Promise(resolve => setTimeout(resolve, 700));
    if (state.bounded && category === 'health' && !cursor) return { logs: [], nextCursor: 'synthetic-scan' };
    return { logs };
  },
  async moveAiLibraryLog(id: string, category: string, expectedCategory: string) {
    state.calls.push({ name: 'move', id, category, expectedCategory });
    await new Promise(resolve => setTimeout(resolve, 30));
    if (state.failMove) throw new Error('Synthetic move failure');
    records = records.map(row => row.id === id ? { ...row, aiCategory: category } : row);
    return { id, category };
  },
  async deleteAiLogs(ids: Set<string>) { records = records.filter(row => !ids.has(row.id)); return ids; },
};
