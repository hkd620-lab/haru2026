const params = new URLSearchParams(window.location.search);
const law = 'path:/record:{"category":"하루LAW"}';
let selection: any = params.get('scenario') === 'existing'
  ? { personalized: true, assistantSelectionConfigured: true, selectedRecordFormats: ['메모'], selectedAgents: ['path:/legal-assistant:{}'] }
  : params.get('scenario') === 'law-selected'
    ? { personalized: true, assistantSelectionConfigured: true, selectedRecordFormats: ['메모'], selectedAgents: [law] }
  : params.get('scenario') === 'legacy'
    ? { personalized: true, selectedRecordFormats: ['HARU가계부', '메모'], selectedAgents: [law, 'path:/legal-assistant:{}'] }
    : params.get('scenario') === 'empty'
      ? { personalized: true, assistantSelectionConfigured: true, selectedRecordFormats: ['메모'], selectedAgents: [] }
      : null;
export function useAuth() { return { user: { uid: 'fixture-user', email: 'fixture@example.test', emailVerified: false }, loading: false }; }
export const firestoreService = {
  async getHomePersonalization() { return selection; },
  async saveHomePersonalization(_uid: string, data: any) {
    if (params.get('scenario') === 'error') throw new Error('fixture-save-failure');
    selection = { ...data, personalized: true, assistantSelectionConfigured: true };
    document.getElementById('fixture-status')!.textContent = JSON.stringify(selection);
  },
};
export async function shouldShowAssistantOnboarding() { return false; }
export function TimelineCollageModal() { return null; }
export function finishLoginTrace() {}
export function markLoginTrace() {}
