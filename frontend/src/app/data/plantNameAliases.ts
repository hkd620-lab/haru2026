// 🌱 식물명 로컬 매핑 사전 — 한국명 → 영어명/학명 자동완성용
// NIBR API/외부 호출 없이 HARU 내부에서만 사용. 1차 최소 항목으로 시작해 점진 확장.
export type PlantNameAlias = {
  koreanNames: string[];
  englishName: string;
  scientificName: string;
};

export const PLANT_NAME_ALIASES: PlantNameAlias[] = [
  {
    koreanNames: ['수세미', '수세미오이'],
    englishName: 'Sponge gourd / Luffa',
    scientificName: 'Luffa cylindrica',
  },
  {
    koreanNames: ['호박'],
    englishName: 'Pumpkin / Squash',
    scientificName: 'Cucurbita moschata',
  },
  {
    koreanNames: ['오이'],
    englishName: 'Cucumber',
    scientificName: 'Cucumis sativus',
  },
  {
    koreanNames: ['참외'],
    englishName: 'Korean melon',
    scientificName: 'Cucumis melo var. makuwa',
  },
];

// 공백 제거 + 소문자화로 느슨하게 비교 (정확 일치 기준)
const normalizeKoreanName = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, '');

export function lookupPlantAlias(koreanName: string): PlantNameAlias | null {
  const key = normalizeKoreanName(koreanName);
  if (!key) return null;
  for (const alias of PLANT_NAME_ALIASES) {
    if (alias.koreanNames.some((kn) => normalizeKoreanName(kn) === key)) {
      return alias;
    }
  }
  return null;
}
