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

test('기존 사용자 선택과 명시적인 전체 해제를 보존한다', () => {
  const settings = { personalized: true, selectedAgents: ['court'], selectedRecordFormats: [] };
  assert.deepEqual(getHomeAssistantSelection(settings, agents), ['court']);
  assert.deepEqual(settings.selectedAgents, ['court']);
  assert.deepEqual(getHomeAssistantSelection({ ...settings, selectedAgents: [] }, agents), []);
});

test('기록에 저장되었던 장부 선택은 기존 사용자에게만 이어진다', () => {
  const settings = { personalized: true, selectedAgents: ['court'], selectedRecordFormats: ['HARU가계부'] };
  assert.deepEqual(getHomeAssistantSelection(settings, agents), ['court', 'money']);
  assert.deepEqual(getHomeAssistantSelection({ ...settings, assistantSelectionConfigured: true }, agents), ['court']);
});

test('새 비서를 출시해도 기존 내 비서 목록에 자동 추가하지 않는다', () => {
  const settings = { personalized: true, assistantSelectionConfigured: true, selectedAgents: ['law'], selectedRecordFormats: [] };
  assert.deepEqual(getHomeAssistantSelection(settings, [...agents, { key: 'new', label: '새 비서' }]), ['law']);
});
