type AssistantOption = { key: string; label: string };
type AssistantSettings = {
  personalized?: boolean;
  assistantSelectionConfigured?: boolean;
  selectedAgents: string[];
  selectedRecordFormats: string[];
};

export function getHomeAssistantSelection(
  settings: AssistantSettings | null,
  agents: AssistantOption[],
): string[] {
  if (!settings?.personalized) {
    return agents.filter((agent) => agent.label === '하루LAW').map((agent) => agent.key);
  }

  const keys = new Set(settings.selectedAgents);
  // 장부가 기록 카드였을 때 저장한 기존 선택도 이어서 표시한다.
  for (const agent of settings.assistantSelectionConfigured ? [] : agents) {
    if ((agent.label === 'HARU가계부' || agent.label === 'HARU보조장부')
      && settings.selectedRecordFormats.includes(agent.label)) {
      keys.add(agent.key);
    }
  }
  return Array.from(keys);
}
