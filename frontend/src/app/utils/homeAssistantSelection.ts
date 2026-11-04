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
  // 구버전에서 저장된 전체 선택은 새 비서실의 명시적 선택으로 취급하지 않는다.
  // 기기 종류와 관계없이 새 비서실에서 직접 선택하기 전에는 하루LAW로 시작한다.
  if (!settings?.personalized || !settings.assistantSelectionConfigured) {
    return agents.filter((agent) => agent.label === '하루LAW').map((agent) => agent.key);
  }

  return Array.from(new Set(settings.selectedAgents));
}
