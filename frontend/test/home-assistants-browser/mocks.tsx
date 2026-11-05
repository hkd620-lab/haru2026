import { AI_LIBRARY_DEVELOPER_EMAIL } from '../../src/app/utils/aiLibraryAccess';
declare const __HOME_DEVELOPER_UID__: string;
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
const fixtureUser = { uid: params.get('scenario') === 'developer' ? __HOME_DEVELOPER_UID__ : 'fixture-user', email: params.get('scenario') === 'library-developer' ? AI_LIBRARY_DEVELOPER_EMAIL : 'fixture@example.test', emailVerified: params.get('scenario') === 'library-developer' };
export function useAuth() { return { user: fixtureUser, loading: false }; }
export const buildTimelineMeta = () => ({});
export const firestoreService = {
  async saveRecord(_uid: string, data: any) {
    document.getElementById('fixture-status')!.textContent = JSON.stringify({ savedRecord: data });
    return data.id;
  },
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
