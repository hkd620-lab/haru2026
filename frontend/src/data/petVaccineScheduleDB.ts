export type PetSpecies = 'dog' | 'cat';

export type VaccineScheduleItem = {
  id: string;
  species: PetSpecies[];
  name: string;
  nameAliases: string[];
  ageFromWeeks: number;
  ageToWeeks: number;
  intervalWeeks?: number;
  annualBooster: boolean;
  mandatory: boolean;
  note: string;
  urgency: 'required' | 'recommended' | 'optional';
};

export const petVaccineScheduleDB: VaccineScheduleItem[] = [
  // ── 강아지 ──────────────────────────────────────────────
  {
    id: 'dog_dhppl',
    species: ['dog'],
    name: '종합백신 (DHPPL)',
    nameAliases: ['종합백신', 'dhppl', '5종', '종합'],
    ageFromWeeks: 6,
    ageToWeeks: 16,
    intervalWeeks: 3,
    annualBooster: true,
    mandatory: false,
    note: '생후 6~8주부터 시작해 3주 간격으로 3~4회 접종. 이후 매년 추가 접종.',
    urgency: 'required',
  },
  {
    id: 'dog_rabies',
    species: ['dog'],
    name: '광견병',
    nameAliases: ['광견병', 'rabies'],
    ageFromWeeks: 12,
    ageToWeeks: 52,
    intervalWeeks: 52,
    annualBooster: true,
    mandatory: true,
    note: '생후 3개월 이후 첫 접종. 법정 의무 접종 (매년).',
    urgency: 'required',
  },
  {
    id: 'dog_kennel_cough',
    species: ['dog'],
    name: '켄넬코프 (기관지염)',
    nameAliases: ['켄넬코프', '기관지염', 'kennel cough', '코르'],
    ageFromWeeks: 8,
    ageToWeeks: 52,
    intervalWeeks: 52,
    annualBooster: true,
    mandatory: false,
    note: '다른 개와 접촉이 있는 경우 권장. 매년 추가 접종.',
    urgency: 'recommended',
  },
  {
    id: 'dog_corona',
    species: ['dog'],
    name: '코로나 장염',
    nameAliases: ['코로나', '코로나장염', 'corona'],
    ageFromWeeks: 6,
    ageToWeeks: 16,
    intervalWeeks: 3,
    annualBooster: true,
    mandatory: false,
    note: '생후 6~8주부터 시작. 강아지 시기 집중 접종 후 매년.',
    urgency: 'recommended',
  },
  {
    id: 'dog_heartworm',
    species: ['dog'],
    name: '심장사상충 예방',
    nameAliases: ['심장사상충', '심사', 'heartworm'],
    ageFromWeeks: 8,
    ageToWeeks: 9999,
    intervalWeeks: 4,
    annualBooster: false,
    mandatory: false,
    note: '생후 2개월부터 매달 1회 예방약 투여. 연중 지속 권장.',
    urgency: 'required',
  },
  {
    id: 'dog_influenza',
    species: ['dog'],
    name: '인플루엔자 (독감)',
    nameAliases: ['인플루엔자', '독감', 'influenza'],
    ageFromWeeks: 12,
    ageToWeeks: 9999,
    intervalWeeks: 52,
    annualBooster: true,
    mandatory: false,
    note: '동물병원·애견호텔 이용이 잦은 경우 권장. 매년 접종.',
    urgency: 'optional',
  },

  // ── 고양이 ──────────────────────────────────────────────
  {
    id: 'cat_fvrcp',
    species: ['cat'],
    name: '종합백신 (FVRCP)',
    nameAliases: ['종합백신', 'fvrcp', '고양이종합', '3종'],
    ageFromWeeks: 6,
    ageToWeeks: 16,
    intervalWeeks: 3,
    annualBooster: true,
    mandatory: false,
    note: '생후 6~8주부터 3주 간격으로 3회. 이후 1~3년마다 추가 접종.',
    urgency: 'required',
  },
  {
    id: 'cat_rabies',
    species: ['cat'],
    name: '광견병',
    nameAliases: ['광견병', 'rabies'],
    ageFromWeeks: 12,
    ageToWeeks: 9999,
    intervalWeeks: 52,
    annualBooster: true,
    mandatory: false,
    note: '외출 고양이에게 권장. 생후 3개월 이후 첫 접종.',
    urgency: 'recommended',
  },
  {
    id: 'cat_felv',
    species: ['cat'],
    name: '고양이 백혈병 (FeLV)',
    nameAliases: ['백혈병', 'felv', '고양이백혈병'],
    ageFromWeeks: 8,
    ageToWeeks: 52,
    intervalWeeks: 3,
    annualBooster: true,
    mandatory: false,
    note: '다묘 가정·외출 고양이에게 권장. 생후 2개월 이후 2회 기초 접종.',
    urgency: 'recommended',
  },
  {
    id: 'cat_heartworm',
    species: ['cat'],
    name: '심장사상충 예방',
    nameAliases: ['심장사상충', '심사', 'heartworm'],
    ageFromWeeks: 8,
    ageToWeeks: 9999,
    intervalWeeks: 4,
    annualBooster: false,
    mandatory: false,
    note: '외출 고양이에게 매달 1회 예방약 투여 권장.',
    urgency: 'optional',
  },
];

export function calcAgeInWeeks(birthdate: string, today = new Date()): number {
  const birth = new Date(birthdate + 'T00:00:00');
  if (isNaN(birth.getTime())) return 0;
  const diffMs = today.getTime() - birth.getTime();
  return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

export function calcAgeLabel(weeks: number): string {
  if (weeks < 4) return `생후 ${weeks}주`;
  const months = Math.floor(weeks / 4.33);
  if (months < 12) return `생후 ${months}개월`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}살 ${remMonths}개월` : `${years}살`;
}

export type ScheduleStatus = 'due' | 'booster' | 'upcoming' | 'done';

export type ScheduleResult = VaccineScheduleItem & {
  status: ScheduleStatus;
  statusLabel: string;
  statusColor: string;
};

export function getVaccineScheduleForPet(
  species: PetSpecies,
  ageWeeks: number,
  alreadyVaccinated: string[],
): ScheduleResult[] {
  const normalized = alreadyVaccinated.map((v) => v.toLowerCase().replace(/\s/g, ''));

  const isDone = (item: VaccineScheduleItem): boolean =>
    item.nameAliases.some((alias) =>
      normalized.some((v) => v.includes(alias.toLowerCase().replace(/\s/g, '')))
    );

  return petVaccineScheduleDB
    .filter((item) => item.species.includes(species))
    .map((item): ScheduleResult => {
      const done = isDone(item);
      const inBasicPeriod = ageWeeks >= item.ageFromWeeks && ageWeeks <= item.ageToWeeks;
      const upcoming = ageWeeks < item.ageFromWeeks;

      let status: ScheduleStatus;
      let statusLabel: string;
      let statusColor: string;

      if (done && item.annualBooster) {
        status = 'booster';
        statusLabel = '추가 접종 확인';
        statusColor = '#3b82f6';
      } else if (done) {
        status = 'done';
        statusLabel = '완료';
        statusColor = '#10b981';
      } else if (upcoming) {
        status = 'upcoming';
        statusLabel = `${calcAgeLabel(item.ageFromWeeks)}부터`;
        statusColor = '#9ca3af';
      } else if (inBasicPeriod || (!done && ageWeeks > item.ageFromWeeks)) {
        status = 'due';
        statusLabel = item.mandatory ? '⚠️ 필수 (미접종)' : '접종 필요';
        statusColor = item.mandatory ? '#dc2626' : '#f59e0b';
      } else {
        status = 'booster';
        statusLabel = '추가 접종 시기';
        statusColor = '#3b82f6';
      }

      return { ...item, status, statusLabel, statusColor };
    })
    .sort((a, b) => {
      const order: Record<ScheduleStatus, number> = { due: 0, booster: 1, upcoming: 2, done: 3 };
      return order[a.status] - order[b.status];
    });
}
