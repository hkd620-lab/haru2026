import assert from 'node:assert/strict';
import test from 'node:test';
import { getHomeAssistantSelection } from '../src/app/utils/homeAssistantSelection.ts';

const agents = [
  { key: 'money', label: 'HARU가계부' },
  { key: 'law', label: '하루LAW' },
  { key: 'court', label: '전자소송연습비서' },
];

test('설정이 없는 사용자는 하루LAW 한 개로 시작하고 원격 설정을 생성하지 않는다', () => {
  assert.deepEqual(getHomeAssistantSelection(null, agents), ['law']);
  assert.deepEqual(getHomeAssistantSelection({ personalized: false, selectedAgents: [], selectedRecordFormats: [] }, agents), ['law']);
});

test('새 비서실에서 직접 저장한 선택과 명시적인 전체 해제를 보존한다', () => {
  const settings = { personalized: true, assistantSelectionConfigured: true, selectedAgents: ['court'], selectedRecordFormats: [] };
  assert.deepEqual(getHomeAssistantSelection(settings, agents), ['court']);
  assert.deepEqual(settings.selectedAgents, ['court']);
  assert.deepEqual(getHomeAssistantSelection({ ...settings, selectedAgents: [] }, agents), []);
});

test('구버전에서 모든 비서를 선택한 기존 계정도 하루LAW 한 개로 시작한다', () => {
  const settings = { personalized: true, selectedAgents: agents.map((a) => a.key), selectedRecordFormats: ['HARU가계부', '메모'] };
  const before = structuredClone(settings);
  assert.deepEqual(getHomeAssistantSelection(settings, agents), ['law']);
  assert.deepEqual(getHomeAssistantSelection({ ...settings, assistantSelectionConfigured: false }, agents), ['law']);
  assert.deepEqual(settings, before, '기존 기록과 원격 선택 데이터를 직접 변경하지 않는다');
});

test('새 비서실에서 선택하기 전의 구버전 빈 목록도 하루LAW로 시작한다', () => {
  assert.deepEqual(getHomeAssistantSelection({ personalized: true, selectedAgents: [], selectedRecordFormats: [] }, agents), ['law']);
});

test('새 비서를 출시해도 기존 내 비서 목록에 자동 추가하지 않는다', () => {
  const settings = { personalized: true, assistantSelectionConfigured: true, selectedAgents: ['law'], selectedRecordFormats: [] };
  assert.deepEqual(getHomeAssistantSelection(settings, [...agents, { key: 'new', label: '새 비서' }]), ['law']);
});
