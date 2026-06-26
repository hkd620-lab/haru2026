export type PetFoodItem = {
  nameKo: string[];
  nameEn: string[];
  species: ('dog' | 'cat')[];
  riskLevel: 'safe' | 'caution' | 'danger' | 'emergency' | 'unknown';
  answer: string;
  reason: string;
  symptoms?: string[];
  emergency: boolean;
  source: string;
};

export const petFoodSafetyDB: PetFoodItem[] = [
  { nameKo: ['포도', '건포도'], nameEn: ['grape', 'raisin'], species: ['dog', 'cat'], riskLevel: 'emergency', answer: '절대 금지', reason: '신장 손상 유발, 소량도 치명적', symptoms: ['구토', '무기력', '신부전'], emergency: true, source: 'ASPCA' },
  { nameKo: ['초콜릿'], nameEn: ['chocolate'], species: ['dog', 'cat'], riskLevel: 'emergency', answer: '절대 금지', reason: '테오브로민 중독', symptoms: ['구토', '경련', '심부전'], emergency: true, source: 'ASPCA' },
  { nameKo: ['자일리톨'], nameEn: ['xylitol'], species: ['dog'], riskLevel: 'emergency', answer: '절대 금지', reason: '저혈당·간부전 유발', symptoms: ['구토', '경련', '황달'], emergency: true, source: 'ASPCA' },
  { nameKo: ['양파'], nameEn: ['onion'], species: ['dog', 'cat'], riskLevel: 'danger', answer: '위험', reason: '적혈구 파괴 (용혈성 빈혈)', symptoms: ['빈혈', '무기력', '구토'], emergency: true, source: 'ASPCA' },
  { nameKo: ['마늘'], nameEn: ['garlic'], species: ['dog', 'cat'], riskLevel: 'danger', answer: '위험', reason: '양파보다 5배 독성, 소량도 위험', symptoms: ['빈혈', '구토'], emergency: true, source: 'ASPCA' },
  { nameKo: ['대파', '쪽파', '부추'], nameEn: ['green onion', 'chive'], species: ['dog', 'cat'], riskLevel: 'danger', answer: '위험', reason: '파 종류 전체 독성', symptoms: ['빈혈', '구토'], emergency: true, source: 'ASPCA' },
  { nameKo: ['알코올', '술', '맥주', '소주'], nameEn: ['alcohol', 'beer', 'wine'], species: ['dog', 'cat'], riskLevel: 'danger', answer: '절대 금지', reason: '신경계·간 손상', symptoms: ['구토', '경련', '혼수'], emergency: true, source: 'ASPCA' },
  { nameKo: ['카페인', '커피', '녹차'], nameEn: ['caffeine', 'coffee', 'tea'], species: ['dog', 'cat'], riskLevel: 'danger', answer: '위험', reason: '심박수 증가, 경련 유발', symptoms: ['떨림', '경련', '심박이상'], emergency: true, source: 'ASPCA' },
  { nameKo: ['아보카도'], nameEn: ['avocado'], species: ['dog', 'cat'], riskLevel: 'danger', answer: '위험', reason: '퍼신(Persin) 독소 포함', symptoms: ['구토', '호흡곤란'], emergency: true, source: 'ASPCA' },
  { nameKo: ['마카다미아'], nameEn: ['macadamia'], species: ['dog'], riskLevel: 'danger', answer: '위험', reason: '신경·근육 독성', symptoms: ['다리 떨림', '고열', '무기력'], emergency: true, source: 'ASPCA' },
  { nameKo: ['닭뼈', '생선뼈', '뼈'], nameEn: ['chicken bone', 'fish bone'], species: ['dog', 'cat'], riskLevel: 'danger', answer: '위험', reason: '날카로운 파편이 내장 천공 유발', symptoms: ['구토', '혈변', '복통'], emergency: true, source: 'ASPCA' },
  { nameKo: ['참치', '참치캔'], nameEn: ['tuna'], species: ['cat'], riskLevel: 'caution', answer: '소량만', reason: '과다 섭취 시 수은 중독, 비타민E 결핍', emergency: false, source: 'PetMD' },
  { nameKo: ['생고기', '날고기'], nameEn: ['raw meat'], species: ['dog', 'cat'], riskLevel: 'caution', answer: '주의', reason: '살모넬라·E.coli 위험', emergency: false, source: 'AVMA' },
  { nameKo: ['우유', '유제품'], nameEn: ['milk', 'dairy'], species: ['dog', 'cat'], riskLevel: 'caution', answer: '소량만', reason: '유당불내증으로 설사 가능', emergency: false, source: 'PetMD' },
  { nameKo: ['날달걀', '생달걀'], nameEn: ['raw egg'], species: ['dog', 'cat'], riskLevel: 'caution', answer: '익혀서', reason: '날것은 살모넬라, 아비딘 비타민B7 결핍', emergency: false, source: 'ASPCA' },
  { nameKo: ['감자'], nameEn: ['potato'], species: ['dog', 'cat'], riskLevel: 'caution', answer: '익힌 것만', reason: '날감자·녹색감자는 솔라닌 독소 포함', emergency: false, source: 'ASPCA' },
  { nameKo: ['사과'], nameEn: ['apple'], species: ['dog', 'cat'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '씨앗 제거 후 소량은 안전, 비타민C 풍부', emergency: false, source: 'ASPCA' },
  { nameKo: ['바나나'], nameEn: ['banana'], species: ['dog', 'cat'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '당분이 있어 소량만, 칼륨 풍부', emergency: false, source: 'ASPCA' },
  { nameKo: ['고구마'], nameEn: ['sweet potato'], species: ['dog', 'cat'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '익혀서 소량, 식이섬유·비타민A 풍부', emergency: false, source: 'ASPCA' },
  { nameKo: ['당근'], nameEn: ['carrot'], species: ['dog', 'cat'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '저칼로리, 치아 건강에도 좋음', emergency: false, source: 'ASPCA' },
  { nameKo: ['브로콜리'], nameEn: ['broccoli'], species: ['dog', 'cat'], riskLevel: 'safe', answer: '소량은 괜찮아요', reason: '소량은 안전, 과다 섭취 시 소화불량', emergency: false, source: 'ASPCA' },
];
