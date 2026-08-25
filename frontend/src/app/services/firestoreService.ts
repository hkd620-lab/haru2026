import { 
  collection, 
  addDoc,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  deleteField,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../../firebase';  // ✅ 수정됨: ../firebase → ../../firebase
import { 
  RecordFormatKorean,
  DiaryStats,
  EssayStats,
  MissionReportStats,
  GeneralReportStats,
  WorkLogStats,
  TravelRecordStats,
  GardenLogStats,
  PetLogStats,
  GrowthDiaryStats,
  ratioToStatScore,
} from '../types/haruTypes';

export type RecordFormat = RecordFormatKorean;

export interface HaruRecord {
  id: string;
  date: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  formats: RecordFormat[];
  content?: string;
  [key: string]: any;
}

export interface GardenCrops {
  crops: string[];
  updatedAt: string;
}

export interface SharedRecordFormat {
  formatKey: string;
  formatLabel: string;
  sayuText: string;
}

export interface SharedRecordPayload {
  ownerUid: string;
  sourcePath: string;
  sourceRecordId: string;
  title: string;
  nickname: string;
  publicPhotoUrls: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt: Timestamp;
  recordDate: string;
  isActive: true;
  formats: SharedRecordFormat[];
}

export interface SharedRecordListItem extends SharedRecordPayload {
  id: string;
}

export interface SharedRecordComment {
  id: string;
  ownerUid: string;
  displayName: string;
  body: string;
  createdAt?: any;
  isDeleted?: boolean;
}

export interface PublishedBook {
  id: string;
  title: string;
  summary: string;
  createdAt?: any;
}

export interface HomePersonalizationSettings {
  selectedRecordFormats: string[];
  selectedAgents: string[];
  personalized?: boolean;
  updatedAt?: any;
}

// ⚖️ 하루LAW 익명 공유 카드 — 관리자 검수를 통과(status: 'published')한 카드만 조회된다.
export interface PublishedHaruLawCard {
  id: string;
  title: string;
  anonymizedQuestion: string;
  summary: string;
  judgmentType?: string;
  relatedStatutes?: { title?: string; article?: string; easySummary?: string }[];
  disclaimer?: string;
  updatedAt?: any;
}

export interface LibraryEntryMeta {
  scientificName?: string;
  identificationStatus?: string;
  subjectType?: string;
  linkedRecordCount?: number;
  firstRecordDate?: string;
  latestRecordDate?: string;
  durationDays?: number;
}

// 🌱 growthSubjects 원본 데이터 → 타임라인 통계 meta (백필·자동 인덱싱 공용)
export const buildTimelineMeta = (data: any): LibraryEntryMeta => {
  const subjectType = (data?.subjectType ?? '').toString().trim();
  const dates = Array.isArray(data?.linkedRecordDates)
    ? data.linkedRecordDates
        .map((d: any) => (d ?? '').toString().trim())
        .filter(Boolean)
        .sort()
    : [];
  const firstRecordDate = dates[0] || '';
  const latestRecordDate =
    (data?.latestRecordDate ?? '').toString().trim() || dates[dates.length - 1] || '';
  let durationDays = 0;
  if (firstRecordDate && latestRecordDate) {
    const diff =
      (new Date(latestRecordDate).getTime() - new Date(firstRecordDate).getTime()) / 86400000;
    if (Number.isFinite(diff)) durationDays = Math.max(0, Math.round(diff));
  }
  return {
    subjectType,
    linkedRecordCount: dates.length,
    firstRecordDate,
    latestRecordDate,
    durationDays,
  };
};

export interface LibraryEntryInput {
  category: string;
  type: string;
  title: string;
  date?: string;
  summary?: string;
  refPath: string;
  meta?: LibraryEntryMeta;
}

export interface LibraryEntry {
  id: string;
  category: string;
  type: string;
  title: string;
  date: string;
  summary: string;
  refPath: string;
  meta?: LibraryEntryMeta;
  createdAt?: any;
}

export interface LibraryBackfillPreview {
  books: LibraryEntryInput[];
  timelines: LibraryEntryInput[];
  plants: LibraryEntryInput[];
  total: number;
}

export interface LibraryBackfillRunResult {
  booksWritten: number;
  timelinesWritten: number;
  plantsWritten: number;
  failed: string[];
  total: number;
}

export interface AssistantPeriodStats {
  typeCounts: Record<string, number>;
  monthCounts: Record<string, number>;
  plant: {
    detectiveCount: number;
    observationCount: number;
    totalCount: number;
    speciesCount: number;
    topPlant?: { name: string; count: number };
    monthCounts: Record<string, number>;
  };
  timeline: {
    timelineCount: number;
    linkedRecordCount: number;
    avgRecords: number;
    longestTimeline?: { title: string; durationDays: number };
    subjectCounts: Record<string, number>;
    subjectText: string;
    monthCounts: Record<string, number>;
  };
}

const PUBLIC_ALLOWED_FORMATS: RecordFormat[] = [
  '일기',
  '에세이',
  '여행기록',
  '텃밭일지',
  '애완동물관찰일지',
  '메모',
  '독서사유',
];

const PUBLIC_FORMAT_PREFIX: Record<RecordFormat, string> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel',
  '독서사유': 'reading',
  '텃밭일지': 'garden',
  '애완동물관찰일지': 'pet',
  '육아일기': 'child',
  'HARU주식관리': 'stock',
  '주식거래일지': 'stock',
  '메모': 'memo',
  '성장타임라인': 'growthTimeline',
  'HARUraw': 'haruraw',
  'HARU보조장부': 'ledger',
  '배뇨일지': 'voiding',
};

const getCleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getTodayString = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const cleanResultChatMemoTitleCandidate = (value: unknown) => {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~[\](){}]/g, ' ')
    .replace(/^\s*[-+•]\s*/gm, ' ')
    .replace(/^\s*\d+[.)]\s*/gm, ' ')
    .replace(/\b20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/g, ' ')
    .replace(/\b20\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\b/g, ' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '이메일')
    .replace(/\b01\d[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '연락처')
    .replace(/[^\p{L}\p{N}\s.,?!%+\-·]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const takeMeaningfulResultChatTitle = (value: unknown) => {
  const cleaned = cleanResultChatMemoTitleCandidate(value)
    .replace(/^(질문|답변|요약|제목)\s*[:：-]?\s*/i, '')
    .trim();
  if (!cleaned) return '';
  const sentence = cleaned.split(/[.!?\n。]/).map((part) => part.trim()).find((part) => part.length >= 2) || cleaned;
  return sentence.length > 36 ? `${sentence.slice(0, 35)}…` : sentence;
};

const extractMarkdownHeadingTitle = (answer: string) => {
  const heading = answer
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^#{1,3}\s+/.test(line));
  return heading ? takeMeaningfulResultChatTitle(heading.replace(/^#{1,3}\s+/, '')) : '';
};

const buildResultChatMemoTitle = (label: string, question: unknown, answer: string) => {
  const fromQuestion = takeMeaningfulResultChatTitle(question);
  const fromHeading = extractMarkdownHeadingTitle(answer);
  const fromAnswer = takeMeaningfulResultChatTitle(answer);
  const contentTitle = fromQuestion || fromHeading || fromAnswer || 'AI 답변 정리';
  return `AI 답변 메모 · ${label || 'AI 답변'} · ${contentTitle}`.slice(0, 90);
};

const dateFromFirestoreValue = (value: unknown) => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof (value as { seconds?: unknown }).seconds === 'number'
  ) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10);
  }
  return getTodayString();
};

const toDateKey = (value: unknown) => {
  if (typeof value === 'string') return value.slice(0, 10);
  return dateFromFirestoreValue(value).slice(0, 10);
};

const isDateInRange = (date: string, startDate: string, endDate: string) => {
  return Boolean(date) && date >= startDate && date <= endDate;
};

const countByMonth = (counts: Record<string, number>, date: string) => {
  const month = date.slice(0, 7);
  if (month) counts[month] = (counts[month] || 0) + 1;
};

const getPlantStatsName = (entry: any) => {
  return getCleanText(entry?.scientificName) ||
    getCleanText(entry?.plantName) ||
    getCleanText(entry?.title) ||
    getCleanText(entry?.userConfirmedName) ||
    getCleanText(entry?.aiKoName) ||
    getCleanText(entry?.aiPrediction);
};

const getDurationDaysFromDates = (dates: string[]) => {
  const sorted = dates.filter(Boolean).sort();
  if (sorted.length < 2) return 0;
  const diff = (new Date(sorted[sorted.length - 1]).getTime() - new Date(sorted[0]).getTime()) / 86400000;
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff)) : 0;
};

const makeLibraryEntryId = (entry: LibraryEntryInput) => {
  const source = `${entry.category}|${entry.type}|${entry.date || ''}|${entry.refPath}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `library_${(hash >>> 0).toString(36)}`;
};

const getPublicImageUrls = (value: unknown): string[] => {
  let source: unknown = value;
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value);
    } catch {
      source = value;
    }
  }

  const values = Array.isArray(source) ? source : [source];
  return values
    .map((item) => getCleanText(item))
    .filter((url) => /^https?:\/\//i.test(url));
};

export type MedicationDoseStatus = 'selected' | 'unknown' | 'not_applicable';
export type MedicationPrescriptionType = '전문의약품' | '일반의약품' | 'unknown';

export interface MedicationSaveInput {
  drugName: string;
  displayName: string;
  selectedDose?: string;
  doseStatus: MedicationDoseStatus;
  ingredient?: string;
  category?: string;
  prescriptionType?: MedicationPrescriptionType;
  efficacySummary: string;
  sideEffectSummary: string[];
  source: 'official-drug-api';
  officialItemSeq?: string;
  originalDrugData?: unknown;
  doseOptions?: string[];
  memo?: string;
}

export interface UserMedication extends MedicationSaveInput {
  id: string;
  addedAt?: Timestamp;
  updatedAt?: Timestamp;
}

class FirestoreService {
  private async recordPaidServiceUsage(
    userId: string,
    eventType: 'record_created' | 'record_updated',
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (!auth.currentUser || auth.currentUser.uid !== userId) return;
      const functions = getFunctions(undefined, 'asia-northeast3');
      const recordUsage = httpsCallable(functions, 'recordPaidServiceUsage');
      await recordUsage({ eventType, details });
    } catch (error) {
      console.warn('유료 이용 개시 로그 기록 실패:', error);
    }
  }

  // 기존 기록 관련 함수들
  async saveRecord(userId: string, recordData: Partial<HaruRecord>): Promise<string> {
    // 수정 7: 같은 날 같은 형식 여러 개 작성 지원 — 고유 ID 생성
    // recordData.id가 명시되면 해당 ID 사용 (주식관리 개별 저장 등)
    const recordId = recordData.id ?? `${recordData.date}_${Date.now()}`;
    const recordRef = doc(db, 'users', userId, 'records', recordId);
    await setDoc(recordRef, {
      ...recordData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    void this.recordPaidServiceUsage(userId, 'record_created', {
      recordId,
      date: recordData.date,
      formats: Array.isArray(recordData.formats) ? recordData.formats.join(',') : undefined,
      source: recordData.source,
    });
    return recordId;
  }

  // 결과물 기반 AI 대화 답변을 '메모' 기록으로 저장 (saveRecord 재사용 → users/{uid}/records/{date}_{ts})
  async saveResultChatMemo(
    userId: string,
    params: {
      answer: string;
      sourceRecordId: string;
      sourceKey: string;
      label: string;
      question?: string;
      sourceIndex?: number;
      threadId?: string;
    },
  ): Promise<string> {
    const today = getTodayString();
    return this.saveRecord(userId, {
      date: today,
      formats: ['메모'] as RecordFormat[],
      content: '',
      memo_title: buildResultChatMemoTitle(params.label, params.question, params.answer),
      memo_content: params.answer,
      source: 'result_ai_chat',
      sourceRecordId: params.sourceRecordId,
      sourceKey: params.sourceKey,
      sourceLabel: params.label,
      // 출처 정확화: 같은 날짜에 판독이 여러 개일 때 어느 판독의 대화인지 구분 (신규 저장부터 적용)
      ...(typeof params.sourceIndex === 'number' ? { sourceIndex: params.sourceIndex } : {}),
      ...(params.threadId ? { threadId: params.threadId } : {}),
    });
  }

  async getRecord(userId: string, date: string): Promise<HaruRecord | null> {
    const recordRef = doc(db, 'users', userId, 'records', date);
    const recordSnap = await getDoc(recordRef);
    
    if (recordSnap.exists()) {
      return {
        id: recordSnap.id,
        ...recordSnap.data(),
      } as HaruRecord;
    }
    
    return null;
  }

  async getRecords(userId: string): Promise<HaruRecord[]> {
    const recordsRef = collection(db, 'users', userId, 'records');
    const q = query(recordsRef, orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as HaruRecord[];
  }

  async upsertLibraryEntry(userId: string, entry: LibraryEntryInput): Promise<string> {
    const normalizedEntry: Required<LibraryEntryInput> = {
      category: getCleanText(entry.category),
      type: getCleanText(entry.type),
      title: getCleanText(entry.title) || '제목 없음',
      date: getCleanText(entry.date) || getTodayString(),
      summary: getCleanText(entry.summary),
      refPath: getCleanText(entry.refPath),
    };

    if (!normalizedEntry.category || !normalizedEntry.type || !normalizedEntry.refPath) {
      throw new Error('library entry 필수값이 누락되었습니다.');
    }

    const entryId = makeLibraryEntryId(normalizedEntry);
    const entryRef = doc(db, 'users', userId, 'library', entryId);
    const payload: Record<string, any> = {
      ...normalizedEntry,
      createdAt: serverTimestamp(),
    };
    if (entry.meta && typeof entry.meta === 'object') {
      const m = entry.meta;
      const cleanedMeta: LibraryEntryMeta = {};
      const sciName = getCleanText(m.scientificName);
      const idStatus = getCleanText(m.identificationStatus);
      const subjectType = getCleanText(m.subjectType);
      const firstRecordDate = getCleanText(m.firstRecordDate);
      const latestRecordDate = getCleanText(m.latestRecordDate);
      if (sciName) cleanedMeta.scientificName = sciName;
      if (idStatus) cleanedMeta.identificationStatus = idStatus;
      if (subjectType) cleanedMeta.subjectType = subjectType;
      if (firstRecordDate) cleanedMeta.firstRecordDate = firstRecordDate;
      if (latestRecordDate) cleanedMeta.latestRecordDate = latestRecordDate;
      if (typeof m.linkedRecordCount === 'number') cleanedMeta.linkedRecordCount = m.linkedRecordCount;
      if (typeof m.durationDays === 'number') cleanedMeta.durationDays = m.durationDays;
      if (Object.keys(cleanedMeta).length > 0) payload.meta = cleanedMeta;
    }
    await setDoc(entryRef, payload, { merge: true });
    return entryId;
  }

  async getLibrary(userId: string): Promise<LibraryEntry[]> {
    const libraryRef = collection(db, 'users', userId, 'library');
    const q = query(libraryRef, orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(libraryDoc => ({
      id: libraryDoc.id,
      ...libraryDoc.data(),
    })) as LibraryEntry[];
  }

  async getLibraryByCategory(userId: string, category: string): Promise<LibraryEntry[]> {
    const entries = await this.getLibrary(userId);
    return entries.filter((entry) => entry.category === category);
  }

  async getAssistantPeriodStats(userId: string, startDate: string, endDate: string): Promise<AssistantPeriodStats> {
    const [records, growthSubjectsSnapshot] = await Promise.all([
      this.getRecords(userId),
      getDocs(collection(db, 'users', userId, 'growthSubjects')),
    ]);

    const monthCounts: Record<string, number> = {};
    const plantMonthCounts: Record<string, number> = {};
    const timelineMonthCounts: Record<string, number> = {};
    const plantNameCounts: Record<string, number> = {};
    const plantSpecies = new Set<string>();
    let detectiveCount = 0;
    let observationCount = 0;

    records.forEach((record) => {
      const recordDate = toDateKey(record.date || record.id);
      if (!isDateInRange(recordDate, startDate, endDate)) return;

      const detectiveEntries = Array.isArray(record.plantDetective) ? record.plantDetective : [];
      detectiveEntries.forEach((entry: any) => {
        detectiveCount += 1;
        countByMonth(monthCounts, recordDate);
        countByMonth(plantMonthCounts, recordDate);
        const name = getPlantStatsName(entry);
        if (name) {
          plantSpecies.add(name);
          plantNameCounts[name] = (plantNameCounts[name] || 0) + 1;
        }
      });

      const observationEntries = Array.isArray(record.plantObservation) ? record.plantObservation : [];
      observationEntries.forEach((entry: any) => {
        observationCount += 1;
        countByMonth(monthCounts, recordDate);
        countByMonth(plantMonthCounts, recordDate);
        const name = getPlantStatsName(entry);
        if (name) {
          plantSpecies.add(name);
          plantNameCounts[name] = (plantNameCounts[name] || 0) + 1;
        }
      });
    });

    const timelineStats: Array<{
      title: string;
      subjectType: string;
      linkedRecordCount: number;
      durationDays: number;
      dates: string[];
    }> = [];

    growthSubjectsSnapshot.docs.forEach((timelineDoc) => {
      const data = timelineDoc.data();
      const dates = Array.isArray(data.linkedRecordDates)
        ? data.linkedRecordDates
            .map((date: any) => toDateKey(date))
            .filter((date: string) => isDateInRange(date, startDate, endDate))
            .sort()
        : [];
      if (dates.length === 0) return;
      dates.forEach((date: string) => {
        countByMonth(monthCounts, date);
        countByMonth(timelineMonthCounts, date);
      });
      timelineStats.push({
        title: getCleanText(data.name) || '이름 없는 타임라인',
        subjectType: getCleanText(data.subjectType) || '기타',
        linkedRecordCount: dates.length,
        durationDays: getDurationDaysFromDates(dates),
        dates,
      });
    });

    records.forEach((record) => {
      const formats = Array.isArray(record.formats) ? record.formats : [];
      const isGrowthTimeline =
        record.recordType === 'growthTimeline' ||
        record.format === '성장타임라인' ||
        formats.includes('성장타임라인' as RecordFormat);
      if (!isGrowthTimeline) return;

      const itemDates = Array.isArray(record.timelineItems)
        ? record.timelineItems
            .map((item: any) => toDateKey(item?.takenDate || record.date || record.id))
            .filter((date: string) => isDateInRange(date, startDate, endDate))
            .sort()
        : [];
      const recordDate = toDateKey(record.date || record.id);
      const dates = itemDates.length > 0
        ? itemDates
        : isDateInRange(recordDate, startDate, endDate)
          ? [recordDate]
          : [];
      if (dates.length === 0) return;
      dates.forEach((date: string) => {
        countByMonth(monthCounts, date);
        countByMonth(timelineMonthCounts, date);
      });
      timelineStats.push({
        title: getCleanText(record.title) || '성장타임라인',
        subjectType: 'recordTimeline',
        linkedRecordCount: dates.length,
        durationDays: getDurationDaysFromDates(dates),
        dates,
      });
    });

    const topPlantEntry = Object.entries(plantNameCounts).sort((a, b) => b[1] - a[1])[0];
    const subjectLabel: Record<string, string> = {
      child: '육아',
      garden: '텃밭',
      recordTimeline: '성장',
      기타: '기타',
    };
    const subjectCounts = timelineStats.reduce<Record<string, number>>((acc, item) => {
      const key = item.subjectType || '기타';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const subjectText = Object.entries(subjectCounts)
      .map(([subject, count]) => `${subjectLabel[subject] || subject} ${count}`)
      .join(' · ');
    const linkedRecordCount = timelineStats.reduce((sum, item) => sum + item.linkedRecordCount, 0);
    const longestTimeline = [...timelineStats].sort((a, b) => b.durationDays - a.durationDays)[0];

    return {
      typeCounts: {
        plant: detectiveCount + observationCount,
        timeline: timelineStats.length,
      },
      monthCounts,
      plant: {
        detectiveCount,
        observationCount,
        totalCount: detectiveCount + observationCount,
        speciesCount: plantSpecies.size,
        ...(topPlantEntry ? { topPlant: { name: topPlantEntry[0], count: topPlantEntry[1] } } : {}),
        monthCounts: plantMonthCounts,
      },
      timeline: {
        timelineCount: timelineStats.length,
        linkedRecordCount,
        avgRecords: timelineStats.length
          ? Math.round((linkedRecordCount / timelineStats.length) * 10) / 10
          : 0,
        ...(longestTimeline ? { longestTimeline: { title: longestTimeline.title, durationDays: longestTimeline.durationDays } } : {}),
        subjectCounts,
        subjectText,
        monthCounts: timelineMonthCounts,
      },
    };
  }

  async previewLibraryBackfill(userId: string): Promise<LibraryBackfillPreview> {
    const timelineSnapshot = await getDocs(collection(db, 'users', userId, 'growthSubjects'));
    const timelines = timelineSnapshot.docs.map((timelineDoc) => {
      const data = timelineDoc.data();
      const title = getCleanText(data.name) || '이름 없는 타임라인';
      return {
        category: '비서',
        type: 'timeline',
        title,
        date: dateFromFirestoreValue(data.createdAt || data.updatedAt || data.latestRecordDate),
        summary: '성장타임라인 기록',
        refPath: `users/${userId}/growthSubjects/${timelineDoc.id}`,
        meta: buildTimelineMeta(data),
      };
    });

    const plantSnapshot = await getDocs(collection(db, 'users', userId, 'plants'));
    const plants = plantSnapshot.docs.map((plantDoc) => {
      const data = plantDoc.data();
      const title =
        getCleanText(data.displayName) ||
        getCleanText(data.userConfirmedName) ||
        getCleanText(data.finalGuess) ||
        '이름 없는 식물';
      const scientificName = getCleanText(data.scientificName);
      const identificationStatus = getCleanText(data.identificationStatus);
      return {
        category: '비서',
        type: 'plant',
        title,
        date: dateFromFirestoreValue(data.date || data.createdAt || data.updatedAt),
        summary: scientificName ? `식물탐정 · ${scientificName}` : '식물탐정 기록',
        refPath: `users/${userId}/plants/${plantDoc.id}`,
        meta: { scientificName, identificationStatus },
      };
    });

    return {
      books: [],
      timelines,
      plants,
      total: timelines.length + plants.length,
    };
  }

  async runLibraryBackfill(userId: string): Promise<LibraryBackfillRunResult> {
    const preview = await this.previewLibraryBackfill(userId);
    const result: LibraryBackfillRunResult = {
      booksWritten: 0,
      timelinesWritten: 0,
      plantsWritten: 0,
      failed: [],
      total: preview.total,
    };

    for (const entry of preview.timelines) {
      try {
        await this.upsertLibraryEntry(userId, entry);
        result.timelinesWritten += 1;
      } catch (error) {
        console.warn('타임라인 library 백필 실패:', entry.refPath, error);
        result.failed.push(entry.refPath);
      }
    }

    for (const entry of preview.plants) {
      try {
        await this.upsertLibraryEntry(userId, entry);
        result.plantsWritten += 1;
      } catch (error) {
        console.warn('식물탐정 library 백필 실패:', entry.refPath, error);
        result.failed.push(entry.refPath);
      }
    }

    return result;
  }

  /**
   * ✅ 새로 추가: 특정 날짜 범위의 기록 가져오기 (통계 및 SAYU 페이지 캘린더용)
   * @param userId 사용자 ID
   * @param startDate 시작 날짜 (YYYY-MM-DD 형식)
   * @param endDate 종료 날짜 (YYYY-MM-DD 형식)
   */
  async getRecordsInRange(userId: string, startDate: string, endDate: string): Promise<HaruRecord[]> {
    try {
      console.log('\n📥 getRecordsInRange 호출');
      console.log('  userId:', userId);
      console.log('  startDate:', startDate);
      console.log('  endDate:', endDate);
      
      const recordsRef = collection(db, 'users', userId, 'records');
      const q = query(
        recordsRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      console.log('  Firestore 쿼리 결과:', querySnapshot.docs.length, '개');
      
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as HaruRecord[];
      
      console.log('  반환할 기록:', records.length, '개\n');
      
      return records;
    } catch (error) {
      console.error('❌ 날짜 범위 기록 불러오기 실패:', error);
      return [];
    }
  }

  async updateRecord(userId: string, recordId: string, data: Partial<HaruRecord>) {
    const recordRef = doc(db, 'users', userId, 'records', recordId);
    
    // ✅ null 값을 deleteField로 변환 (Firestore에서 필드 삭제)
    const processedData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    
    Object.entries(data).forEach(([key, value]) => {
      if (value === null) {
        processedData[key] = deleteField();  // null이면 필드 삭제
      } else {
        processedData[key] = value;
      }
    });
    
    console.log('🔥 Firestore updateRecord:', recordId);
    console.log('  처리된 데이터:', processedData);
    
    await updateDoc(recordRef, processedData);
    void this.recordPaidServiceUsage(userId, 'record_updated', {
      recordId,
      changedKeys: Object.keys(data).slice(0, 40).join(','),
    });
  }

  async deleteRecord(userId: string, recordId: string) {
    const recordRef = doc(db, 'users', userId, 'records', recordId);
    await deleteDoc(recordRef);
  }

  getPublicAllowedFormats() {
    return PUBLIC_ALLOWED_FORMATS;
  }

  getPublishableSharedFormats(record: HaruRecord): SharedRecordFormat[] {
    const recordFormats = Array.isArray(record.formats) ? record.formats : [];
    const formatsToCheck = PUBLIC_ALLOWED_FORMATS.filter((format) => {
      const prefix = PUBLIC_FORMAT_PREFIX[format];
      return recordFormats.includes(format) || Boolean(getCleanText(record[`${prefix}_sayu`])) || Boolean(getCleanText(record[`${prefix}_final_sayu`]));
    });

    return formatsToCheck
      .map((format) => {
        const prefix = PUBLIC_FORMAT_PREFIX[format];
        const sayuText = getCleanText(record[`${prefix}_sayu`]) || getCleanText(record[`${prefix}_final_sayu`]);
        if (!sayuText) return null;
        return {
          formatKey: prefix,
          formatLabel: format,
          sayuText,
        };
      })
      .filter((item): item is SharedRecordFormat => Boolean(item));
  }

  canRecordBePublished(record: HaruRecord): boolean {
    return this.getPublishableSharedFormats(record).length > 0;
  }

  getPublishableSharedPhotoUrls(
    record: HaruRecord,
    formats: SharedRecordFormat[] = this.getPublishableSharedFormats(record),
  ): string[] {
    const urls = formats.flatMap((format) => getPublicImageUrls(record[`${format.formatKey}_images`]));
    return Array.from(new Set(urls)).slice(0, 12);
  }

  buildSharedRecordPayload(
    userId: string,
    record: HaruRecord,
    userProfile: { nickname?: string },
    createdAt: Timestamp = Timestamp.now(),
  ): SharedRecordPayload {
    const nickname = getCleanText(userProfile.nickname);
    if (!nickname) {
      throw new Error('PUBLIC_NICKNAME_REQUIRED');
    }

    const formats = this.getPublishableSharedFormats(record);
    if (formats.length === 0) {
      throw new Error('PUBLIC_SAYU_REQUIRED');
    }

    const firstFormat = formats[0];
    const title =
      getCleanText(record[`${firstFormat.formatKey}_ai_title`]) ||
      getCleanText(record[`${firstFormat.formatKey}_title`]) ||
      (firstFormat.formatKey === 'reading'
        ? getCleanText(record.reading_book_title || record.reading_title)
        : '') ||
      firstFormat.sayuText.split('\n').map((line) => line.trim()).find(Boolean)?.slice(0, 40) ||
      `${firstFormat.formatLabel} 기록`;

    const now = Timestamp.now();
    return {
      ownerUid: userId,
      sourcePath: `users/${userId}/records/${record.id}`,
      sourceRecordId: record.id,
      title,
      nickname,
      publicPhotoUrls: this.getPublishableSharedPhotoUrls(record, formats),
      createdAt,
      updatedAt: now,
      publishedAt: now,
      recordDate: record.date || record.id,
      isActive: true,
      formats,
    };
  }

  async publishRecordToShared(userId: string, recordId: string): Promise<string> {
    const recordRef = doc(db, 'users', userId, 'records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) {
      throw new Error('PUBLIC_RECORD_NOT_FOUND');
    }

    const record = { id: recordSnap.id, ...recordSnap.data() } as HaruRecord;
    const userProfile = await this.getUserProfile(userId);
    const existingSharedId = getCleanText(record.sharedRecordId);
    const sharedRef = existingSharedId
      ? doc(db, 'shared_records', existingSharedId)
      : doc(collection(db, 'shared_records'));

    const existingSharedSnap = existingSharedId ? await getDoc(sharedRef) : null;
    if (existingSharedSnap?.exists() && existingSharedSnap.data().ownerUid !== userId) {
      throw new Error('PUBLIC_OWNER_MISMATCH');
    }

    const existingCreatedAt = existingSharedSnap?.exists() && existingSharedSnap.data().createdAt instanceof Timestamp
      ? existingSharedSnap.data().createdAt
      : Timestamp.now();
    const payload = this.buildSharedRecordPayload(userId, record, userProfile, existingCreatedAt);

    await setDoc(sharedRef, payload, { merge: true });
    await updateDoc(recordRef, {
      isPublic: true,
      sharedRecordId: sharedRef.id,
      updatedAt: new Date().toISOString(),
    });

    return sharedRef.id;
  }

  async unpublishSharedRecord(userId: string, recordId: string): Promise<void> {
    const recordRef = doc(db, 'users', userId, 'records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) {
      throw new Error('PUBLIC_RECORD_NOT_FOUND');
    }

    const record = { id: recordSnap.id, ...recordSnap.data() } as HaruRecord;
    const sharedRecordId = getCleanText(record.sharedRecordId);
    if (sharedRecordId) {
      const sharedRef = doc(db, 'shared_records', sharedRecordId);
      const sharedSnap = await getDoc(sharedRef);
      if (sharedSnap.exists()) {
        if (sharedSnap.data().ownerUid !== userId) {
          throw new Error('PUBLIC_OWNER_MISMATCH');
        }
        await updateDoc(sharedRef, {
          isActive: false,
          updatedAt: Timestamp.now(),
        });
      }
    }

    await updateDoc(recordRef, {
      isPublic: false,
      sharedRecordId: deleteField(),
      updatedAt: new Date().toISOString(),
    });
  }

  async getSharedRecords(): Promise<SharedRecordListItem[]> {
    const sharedQuery = query(
      collection(db, 'shared_records'),
      where('isActive', '==', true),
      limit(50),
    );
    const snapshot = await getDocs(sharedQuery);
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as SharedRecordListItem)
      .sort((a, b) => {
        const aTime = a.publishedAt?.toMillis?.() ?? 0;
        const bTime = b.publishedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
  }

  // ⚖️ 승인된 하루LAW 익명 공유 카드 — firestore.rules가 status == 'published'만 읽기 허용.
  // 검수 중(pending)·반려(rejected)·취소(withdrawn) 카드는 규칙 단에서 차단된다.
  async getPublishedHaruLawCards(): Promise<PublishedHaruLawCard[]> {
    const cardsQuery = query(
      collection(db, 'sharedHaruLawCards'),
      where('status', '==', 'published'),
      limit(50),
    );
    const snapshot = await getDocs(cardsQuery);
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PublishedHaruLawCard)
      .sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() ?? 0;
        const bTime = b.updatedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
  }

  async getPublishedBooks(): Promise<PublishedBook[]> {
    const booksQuery = query(
      collection(db, 'books'),
      where('status', '==', 'serializing'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snapshot = await getDocs(booksQuery);

    return Promise.all(
      snapshot.docs.map(async (bookDoc) => {
        const data = bookDoc.data();
        let summary = getCleanText(data.summary || data.description || data.subtitle);

        if (!summary) {
          const chapterSnapshot = await getDocs(
            query(
              collection(db, 'books', bookDoc.id, 'chapters'),
              orderBy('order', 'asc'),
              limit(1),
            ),
          );
          const firstChapter = chapterSnapshot.docs[0]?.data();
          const content = getCleanText(firstChapter?.content);
          summary = content.length > 160 ? `${content.slice(0, 160)}...` : content;
        }

        return {
          id: bookDoc.id,
          title: getCleanText(data.title) || '제목 없는 책',
          summary,
          createdAt: data.createdAt,
        };
      }),
    );
  }

  async getSharedRecordComments(sharedRecordId: string): Promise<SharedRecordComment[]> {
    const commentsQuery = query(
      collection(db, 'shared_records', sharedRecordId, 'comments'),
      orderBy('createdAt', 'asc'),
    );
    const snapshot = await getDocs(commentsQuery);
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as SharedRecordComment)
      .filter((comment) => comment.isDeleted !== true);
  }

  async addSharedRecordComment(sharedRecordId: string, body: string): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) {
      throw new Error('COMMENT_LOGIN_REQUIRED');
    }

    const trimmedBody = body.trim();
    if (!trimmedBody) {
      throw new Error('COMMENT_BODY_REQUIRED');
    }

    const userProfile = await this.getUserProfile(currentUser.uid);
    const nickname = getCleanText(userProfile?.nickname) || currentUser.displayName || '익명 사용자';

    const commentRef = await addDoc(collection(db, 'shared_records', sharedRecordId, 'comments'), {
      ownerUid: currentUser.uid,
      displayName: nickname,
      body: trimmedBody,
      createdAt: serverTimestamp(),
      isDeleted: false,
    });
    return commentRef.id;
  }

  async getHealthMedications(userId: string): Promise<UserMedication[]> {
    const medicationsRef = collection(db, 'users', userId, 'health', 'medications', 'items');
    const q = query(medicationsRef, orderBy('addedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })) as UserMedication[];
  }

  async saveHealthMedication(userId: string, medicationData: MedicationSaveInput): Promise<string> {
    const medicationsRef = collection(db, 'users', userId, 'health', 'medications', 'items');
    const medicationRef = doc(medicationsRef);
    const cleanData = stripUndefined(medicationData) as Record<string, unknown>;

    await setDoc(medicationRef, {
      ...cleanData,
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return medicationRef.id;
  }

  async updateHealthMedicationDose(
    userId: string,
    medicationId: string,
    selectedDose: string | undefined,
    doseStatus: MedicationDoseStatus
  ) {
    const medicationRef = doc(db, 'users', userId, 'health', 'medications', 'items', medicationId);
    const medicationSnap = await getDoc(medicationRef);
    const medication = medicationSnap.data() as UserMedication | undefined;
    const drugName = medication?.drugName || medication?.displayName || '';
    const displayName = selectedDose ? `${drugName} ${selectedDose}` : drugName;

    await updateDoc(medicationRef, {
      selectedDose: selectedDose || deleteField(),
      doseStatus,
      displayName,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteHealthMedication(userId: string, medicationId: string) {
    const medicationRef = doc(db, 'users', userId, 'health', 'medications', 'items', medicationId);
    await deleteDoc(medicationRef);
  }

  /**
   * ✅ 형식별 통계 데이터 계산
   * @param userId 사용자 ID
   * @param format 형식
   * @param startDate 시작 날짜
   * @param endDate 종료 날짜
   */
  async calculateFormatStatistics(
    userId: string, 
    format: RecordFormat, 
    startDate: string, 
    endDate: string
  ): Promise<any> {
    try {
      console.log('\n\n🔍 ===== 형식별 통계 계산 시작 =====');
      console.log('📅 기간:', startDate, '~', endDate);
      console.log('📋 형식:', format);
      console.log('👤 사용자 ID:', userId);
      
      // 해당 기간의 기록 가져오기
      const records = await this.getRecordsInRange(userId, startDate, endDate);
      
      console.log('\n📦 1단계: 날짜 범위 내 전체 기록');
      console.log('가져온 기록 개수:', records.length);
      records.forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${r.date} - formats:`, r.formats);
      });
      
      // 해당 형식의 기록만 필터링
      const stockFormats = ['HARU주식관리', '주식거래일지'];
      const formatRecords = records.filter(r => {
        if (stockFormats.includes(format)) {
          return (r.formats && r.formats.some((f: string) => stockFormats.includes(f))) || Boolean(r.stock_name);
        }
        if (format === 'HARU보조장부') {
          return (r.formats && r.formats.includes(format)) ||
            Object.keys(r).some((key) => key.startsWith('ledger_') && typeof r[key] === 'string' && r[key].trim().length > 0);
        }
        return r.formats && r.formats.includes(format);
      });
      
      console.log(`\n🎯 2단계: "${format}" 형식 필터링`);
      console.log('필터링 후 기록 개수:', formatRecords.length);
      formatRecords.forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${r.date} - formats:`, r.formats);
      });
      
      if (formatRecords.length === 0) {
        console.log('❌ 해당 형식의 기록이 없습니다!');
        console.log('=================================\n\n');
        return null; // 데이터 없음
      }

      // 형식별 prefix
      const prefixMap: Record<RecordFormat, string> = {
        '일기': 'diary',
        '에세이': 'essay',
        '선교보고': 'mission',
        '일반보고': 'report',
        '업무일지': 'work',
        '여행기록': 'travel',
        '텃밭일지': 'garden',
        '애완동물관찰일지': 'pet',
        '육아일기': 'parenting',
        'HARU주식관리': 'stock',
        '주식거래일지': 'stock',
        'HARU보조장부': 'ledger',
      };

      const prefix = prefixMap[format];
      
      console.log('\n📊 3단계: 통계 계산 진행');
      console.log('prefix:', prefix);
      console.log('total_days:', formatRecords.length);
      
      // 형식별 통계 계산
      let result;
      switch (format) {
        case '일기':
          result = this.calculateDiaryStats(formatRecords, prefix);
          break;
        case '업무일지':
          result = this.calculateWorkStats(formatRecords, prefix);
          break;
        case '에세이':
          result = this.calculateEssayStats(formatRecords, prefix);
          break;
        case '선교보고':
          result = this.calculateMissionStats(formatRecords, prefix);
          break;
        case '일반보고':
          result = this.calculateReportStats(formatRecords, prefix);
          break;
        case '여행기록':
          result = this.calculateTravelStats(formatRecords, prefix);
          break;
        case '텃밭일지':
          result = this.calculateGardenStats(formatRecords, prefix);
          break;
        case '애완동물관찰일지':
          result = this.calculatePetStats(formatRecords, prefix);
          break;
        case '육아일기':
          result = this.calculateParentingStats(formatRecords, prefix);
          break;
        case 'HARU주식관리':
        case '주식거래일지':
          result = this.calculateStockStats(formatRecords, prefix);
          break;
        default:
          result = this.calculateBasicStats(formatRecords, prefix, format);
      }
      
      console.log('\n✅ 최종 결과:', result);
      console.log('=================================\n\n');
      
      return result;
      
    } catch (error) {
      console.error('❌ 통계 계산 실패:', error);
      return null;
    }
  }

  /**
   * 업무일지 통계 계산 - 개선된 버전
   */
  private calculateWorkStats(records: HaruRecord[], prefix: string): WorkLogStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // Rating 평균 계산
    const ratings = records
      .map(r => r[`${prefix}_rating`])
      .filter(rating => rating && rating.includes('★'))
      .map(rating => {
        const stars = (rating.match(/★/g) || []).length;
        return stars;
      });
    
    const energyAverage = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
      : 0;
    
    // ===== WorkLogStats 고유 지표 =====
    
    // 1. task_completion: 업무 완성도 (Result 작성률)
    const resultCount = records.filter(r => 
      r[`${prefix}_result`] && r[`${prefix}_result`].trim().length > 0
    ).length;
    const taskCompletionRatio = totalDays > 0 ? resultCount / totalDays : 0;
    const task_completion = ratioToStatScore(taskCompletionRatio);
    
    // 2. productivity_score: 생산성 점수 (Rating 평균 기반)
    const productivityRatio = ratings.length > 0 ? energyAverage / 5 : 0;
    const productivity_score = ratioToStatScore(productivityRatio);
    
    // 3. self_evaluation: 자기 평가 일관성 (Rating 작성 비율)
    const ratingCount = ratings.length;
    const selfEvaluationRatio = totalDays > 0 ? ratingCount / totalDays : 0;
    const self_evaluation = ratioToStatScore(selfEvaluationRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: Rating 3점 이상 비율
    const positiveRatings = ratings.filter(r => r >= 3).length;
    const positivityRatio = ratings.length > 0 ? positiveRatings / ratings.length : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      task_completion,
      productivity_score,
      self_evaluation,
      energy_average: energyAverage,
      personality_type: '실무형 실행가',
      strengths: [
        '일정 관리 능력',
        '성과 측정 습관',
        '꾸준한 기록',
      ],
    };
  }

  /**
   * 일기 통계 계산 - 개선된 버전
   */
  private calculateDiaryStats(records: HaruRecord[], prefix: string): DiaryStats & { 
    total_days: number; 
    energy_average: number; 
    personality_type: string; 
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== DiaryStats 고유 지표 =====
    
    // 1. emotional_flow: 감정 흐름 (좋았던 일 -> 갈등 -> 배움의 연결성)
    const hasEmotionalFlow = records.filter(r => 
      r[`${prefix}_good`] && r[`${prefix}_good`].trim().length > 0 &&
      r[`${prefix}_conflict`] && r[`${prefix}_conflict`].trim().length > 0 &&
      r[`${prefix}_learning`] && r[`${prefix}_learning`].trim().length > 0
    ).length;
    const emotionalFlowRatio = totalDays > 0 ? hasEmotionalFlow / totalDays : 0;
    const emotional_flow = ratioToStatScore(emotionalFlowRatio);
    
    // 2. self_awareness: 자기인식 (배움 필드의 작성률과 깊이)
    const learningCount = records.filter(r => 
      r[`${prefix}_learning`] && r[`${prefix}_learning`].trim().length > 50
    ).length;
    const selfAwarenessRatio = totalDays > 0 ? learningCount / totalDays : 0;
    const self_awareness = ratioToStatScore(selfAwarenessRatio);
    
    // 3. daily_stability: 일상 안정성 (여백/내일 계획의 규칙성)
    const spaceCount = records.filter(r => 
      r[`${prefix}_space`] && r[`${prefix}_space`].trim().length > 0
    ).length;
    const dailyStabilityRatio = totalDays > 0 ? spaceCount / totalDays : 0;
    const daily_stability = ratioToStatScore(dailyStabilityRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 좋았던 일 작성 비율
    const goodCount = records.filter(r => 
      r[`${prefix}_good`] && r[`${prefix}_good`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? goodCount / totalDays : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      emotional_flow,
      self_awareness,
      daily_stability,
      energy_average: 3.5,
      personality_type: '성장형 균형주의자',
      strengths: [
        '경험에서 배움을 찾는 능력이 뛰어남',
        '미래를 계획하는 성향',
        '갈등을 성장 기회로 전환하는 회복탄력성',
      ],
    };
  }

  /**
   * 기본 통계 계산 (다른 형식들)
   */
  private calculateBasicStats(records: HaruRecord[], prefix: string, format: RecordFormat) {
    const totalDays = records.length;
    
    // 필드가 하나라도 작성된 비율로 긍정성 계산
    const filledRecords = records.filter(r => {
      const keys = Object.keys(r).filter(k => k.startsWith(prefix));
      return keys.some(k => r[k] && String(r[k]).trim().length > 0);
    }).length;
    
    const positivityRatio = totalDays > 0 ? filledRecords / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: 0.5,
      space_ratio: 0.5,
      energy_average: 3.5,
      personality_type: `${format} 작성자`,
      strengths: [
        '꾸준한 기록 습관',
        '경험 기록',
      ],
    };
  }

  /**
   * 에세이 통계 계산 - 개선된 버전
   * 필드: observation, impression, comparison, essence, closing
   */
  private calculateEssayStats(records: HaruRecord[], prefix: string): EssayStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== EssayStats 고유 지표 =====
    
    // 1. theme_frequency: 주제 다양성 (다양한 필드 작성)
    const hasMultipleFields = records.filter(r => {
      const fieldCount = [
        r[`${prefix}_observation`],
        r[`${prefix}_impression`],
        r[`${prefix}_comparison`],
        r[`${prefix}_essence`],
        r[`${prefix}_closing`],
      ].filter(field => field && String(field).trim().length > 0).length;
      return fieldCount >= 4;
    }).length;
    const themeFrequencyRatio = totalDays > 0 ? hasMultipleFields / totalDays : 0;
    const theme_frequency = ratioToStatScore(themeFrequencyRatio);
    
    // 2. emotional_depth: 감정 표현의 깊이 (첫인상 필드)
    const deepImpressions = records.filter(r => 
      r[`${prefix}_impression`] && String(r[`${prefix}_impression`]).trim().length > 50
    ).length;
    const emotionalDepthRatio = totalDays > 0 ? deepImpressions / totalDays : 0;
    const emotional_depth = ratioToStatScore(emotionalDepthRatio);
    
    // 3. reflection_depth: 성찰의 깊이 (핵심 필드)
    const deepEssence = records.filter(r => 
      r[`${prefix}_essence`] && String(r[`${prefix}_essence`]).trim().length > 30
    ).length;
    const reflectionDepthRatio = totalDays > 0 ? deepEssence / totalDays : 0;
    const reflection_depth = ratioToStatScore(reflectionDepthRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 긍정적 끝인사 작성률
    const closingCount = records.filter(r => 
      r[`${prefix}_closing`] && String(r[`${prefix}_closing`]).trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? closingCount / totalDays : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      theme_frequency,
      emotional_depth,
      reflection_depth,
      energy_average: 3.8,
      personality_type: '관찰형 사색가',
      strengths: [
        '사물을 깊이 관찰하는 능력',
        '비유적 사고력이 뛰어남',
        '철학적 통찰력',
      ],
    };
  }

  /**
   * 선교보고 통계 계산 - 개선된 버전
   * 필드: place, action, grace, heart, prayer
   */
  private calculateMissionStats(records: HaruRecord[], prefix: string): MissionReportStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== MissionReportStats 고유 지표 =====
    
    // 1. grace_awareness: 은혜 인식 (Grace 필드 작성 빈도)
    const graceCount = records.filter(r => 
      r[`${prefix}_grace`] && r[`${prefix}_grace`].trim().length > 0
    ).length;
    const graceAwarenessRatio = totalDays > 0 ? graceCount / totalDays : 0;
    const grace_awareness = ratioToStatScore(graceAwarenessRatio);
    
    // 2. spiritual_growth: 영적 성장 (Heart 필드의 깊이)
    const deepHeart = records.filter(r => 
      r[`${prefix}_heart`] && r[`${prefix}_heart`].trim().length > 50
    ).length;
    const spiritualGrowthRatio = totalDays > 0 ? deepHeart / totalDays : 0;
    const spiritual_growth = ratioToStatScore(spiritualGrowthRatio);
    
    // 3. service_impact: 섬김 영향력 (Action 필드의 구체성)
    const actionCount = records.filter(r => 
      r[`${prefix}_action`] && r[`${prefix}_action`].trim().length > 30
    ).length;
    const serviceImpactRatio = totalDays > 0 ? actionCount / totalDays : 0;
    const service_impact = ratioToStatScore(serviceImpactRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 기도 작성률
    const prayerCount = records.filter(r => 
      r[`${prefix}_prayer`] && r[`${prefix}_prayer`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? prayerCount / totalDays : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      grace_awareness,
      spiritual_growth,
      service_impact,
      energy_average: 4.0,
      personality_type: '감사형 헌신자',
      strengths: [
        '은혜를 발견하는 능력',
        '기도 습관',
        '타인에 대한 배려',
      ],
    };
  }

  /**
   * 일반보고 통계 계산 - 개선된 버전
   * 필드: activity, progress, achievement, notes, future
   */
  private calculateReportStats(records: HaruRecord[], prefix: string): GeneralReportStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== GeneralReportStats 고유 지표 =====
    
    // 1. completion_rate: 완성도 (모든 필드 작성 비율)
    const completeCount = records.filter(r => 
      r[`${prefix}_activity`] && r[`${prefix}_progress`] &&
      r[`${prefix}_achievement`] && r[`${prefix}_notes`] && r[`${prefix}_future`]
    ).length;
    const completionRatio = totalDays > 0 ? completeCount / totalDays : 0;
    const completion_rate = ratioToStatScore(completionRatio);
    
    // 2. issue_awareness: 문제 인식 (특이사항 기록률)
    const notesCount = records.filter(r => 
      r[`${prefix}_notes`] && r[`${prefix}_notes`].trim().length > 0
    ).length;
    const issueAwarenessRatio = totalDays > 0 ? notesCount / totalDays : 0;
    const issue_awareness = ratioToStatScore(issueAwarenessRatio);
    
    // 3. planning_quality: 계획 품질 (향후 계획 구체성)
    const detailedFuture = records.filter(r => 
      r[`${prefix}_future`] && r[`${prefix}_future`].trim().length > 30
    ).length;
    const planningQualityRatio = totalDays > 0 ? detailedFuture / totalDays : 0;
    const planning_quality = ratioToStatScore(planningQualityRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 핵심 성과 작성률
    const achievementCount = records.filter(r => 
      r[`${prefix}_achievement`] && r[`${prefix}_achievement`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? achievementCount / totalDays : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      completion_rate,
      issue_awareness,
      planning_quality,
      energy_average: 3.4,
      personality_type: '체계적 보고자',
      strengths: [
        '진행 상황 추적 능력',
        '문제 인식 및 해결 제안',
        '미래 계획 수립',
      ],
    };
  }

  /**
   * 여행기록 통계 계산 - 개선된 버전
   * 필드: journey, scenery, food, thought, gratitude
   */
  private calculateTravelStats(records: HaruRecord[], prefix: string): TravelRecordStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== TravelRecordStats 고유 지표 =====
    
    // 1. experience_richness: 경험의 풍부함 (모든 필드 작성률)
    const completeCount = records.filter(r => 
      r[`${prefix}_journey`] && r[`${prefix}_scenery`] && 
      r[`${prefix}_food`] && r[`${prefix}_thought`] && r[`${prefix}_gratitude`]
    ).length;
    const experienceRichnessRatio = totalDays > 0 ? completeCount / totalDays : 0;
    const experience_richness = ratioToStatScore(experienceRichnessRatio);
    
    // 2. gratitude_level: 감사 수준
    const gratitudeCount = records.filter(r => 
      r[`${prefix}_gratitude`] && r[`${prefix}_gratitude`].trim().length > 0
    ).length;
    const gratitudeLevelRatio = totalDays > 0 ? gratitudeCount / totalDays : 0;
    const gratitude_level = ratioToStatScore(gratitudeLevelRatio);
    
    // 3. reflection_depth: 성찰 깊이 (단상의 질)
    const deepThought = records.filter(r => 
      r[`${prefix}_thought`] && r[`${prefix}_thought`].trim().length > 50
    ).length;
    const reflectionDepthRatio = totalDays > 0 ? deepThought / totalDays : 0;
    const reflection_depth = ratioToStatScore(reflectionDepthRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 감사 표현률
    const positivityRatio = gratitudeLevelRatio;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      experience_richness,
      gratitude_level,
      reflection_depth,
      energy_average: 4.2,
      personality_type: '경험 수집가',
      strengths: [
        '새로운 경험에 대한 개방성',
        '감사하는 마음',
        '풍경과 음식에 대한 감수성',
      ],
    };
  }

  /**
   * 텃밭일지 통계 계산 - 개선된 버전
   */
  private calculateGardenStats(records: HaruRecord[], prefix: string): GardenLogStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== GardenLogStats 고유 지표 =====
    
    // 1. crop_diversity: 작물 다양성 (작물 필드 작성)
    const cropsCount = records.filter(r => 
      r[`${prefix}_crops`] && String(r[`${prefix}_crops`]).trim().length > 0
    ).length;
    const cropDiversityRatio = totalDays > 0 ? cropsCount / totalDays : 0;
    const crop_diversity = ratioToStatScore(cropDiversityRatio);
    
    // 2. observation_detail: 관찰 세밀도 (관찰 필드 상세도)
    const detailedObservation = records.filter(r => 
      r[`${prefix}_observation`] && String(r[`${prefix}_observation`]).trim().length > 30
    ).length;
    const observationDetailRatio = totalDays > 0 ? detailedObservation / totalDays : 0;
    const observation_detail = ratioToStatScore(observationDetailRatio);
    
    // 3. issue_management: 문제 대응력 (문제 인식 및 계획)
    const hasIssueAndPlan = records.filter(r => 
      r[`${prefix}_issue`] && r[`${prefix}_plan`]
    ).length;
    const issueManagementRatio = totalDays > 0 ? hasIssueAndPlan / totalDays : 0;
    const issue_management = ratioToStatScore(issueManagementRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 전반적인 기록 완성도
    const filledRecords = records.filter(r => {
      const keys = Object.keys(r).filter(k => k.startsWith(prefix));
      return keys.some(k => r[k] && String(r[k]).trim().length > 0);
    }).length;
    const positivityRatio = totalDays > 0 ? filledRecords / totalDays : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      crop_diversity,
      observation_detail,
      issue_management,
      energy_average: 3.6,
      personality_type: '관찰형 재배자',
      strengths: [
        '자연 관찰 능력',
        '인내심',
        '성장 과정 기록',
      ],
    };
  }

  /**
   * 애완동물관찰일지 통계 계산 - 개선된 버전
   */
  private calculatePetStats(records: HaruRecord[], prefix: string): PetLogStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== PetLogStats 고유 지표 =====
    
    // 1. care_attention: 돌봄 관심도 (건강 필드 작성)
    const healthCount = records.filter(r => 
      r[`${prefix}_health`] && String(r[`${prefix}_health`]).trim().length > 0
    ).length;
    const careAttentionRatio = totalDays > 0 ? healthCount / totalDays : 0;
    const care_attention = ratioToStatScore(careAttentionRatio);
    
    // 2. emotional_bond: 정서적 유대감 (감정 필드 작성)
    const emotionCount = records.filter(r => 
      r[`${prefix}_emotion`] && String(r[`${prefix}_emotion`]).trim().length > 0
    ).length;
    const emotionalBondRatio = totalDays > 0 ? emotionCount / totalDays : 0;
    const emotional_bond = ratioToStatScore(emotionalBondRatio);
    
    // 3. health_awareness: 건강 인식 (행동과 건강 연결)
    const hasBehaviorAndHealth = records.filter(r => 
      r[`${prefix}_behavior`] && r[`${prefix}_health`]
    ).length;
    const healthAwarenessRatio = totalDays > 0 ? hasBehaviorAndHealth / totalDays : 0;
    const health_awareness = ratioToStatScore(healthAwarenessRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 전반적인 기록 완성도
    const filledRecords = records.filter(r => {
      const keys = Object.keys(r).filter(k => k.startsWith(prefix));
      return keys.some(k => r[k] && String(r[k]).trim().length > 0);
    }).length;
    const positivityRatio = totalDays > 0 ? filledRecords / totalDays : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      care_attention,
      emotional_bond,
      health_awareness,
      energy_average: 4.5,
      personality_type: '따뜻한 관찰자',
      strengths: [
        '공감 능력',
        '세밀한 관찰력',
        '애정 표현',
      ],
    };
  }

  /**
   * 육아(성장)일기 통계 계산 - 개선된 버전
   */
  private calculateParentingStats(records: HaruRecord[], prefix: string): GrowthDiaryStats & {
    total_days: number;
    energy_average: number;
    personality_type: string;
    strengths: string[];
  } {
    const totalDays = records.length;
    
    // ===== GrowthDiaryStats 고유 지표 =====
    
    // 1. growth_observation: 성장 관찰력 (성장 필드 작성)
    const growthCount = records.filter(r => 
      r[`${prefix}_growth`] && String(r[`${prefix}_growth`]).trim().length > 0
    ).length;
    const growthObservationRatio = totalDays > 0 ? growthCount / totalDays : 0;
    const growth_observation = ratioToStatScore(growthObservationRatio);
    
    // 2. emotional_understanding: 감정 이해도 (감정 필드 작성)
    const emotionCount = records.filter(r => 
      r[`${prefix}_emotion`] && String(r[`${prefix}_emotion`]).trim().length > 0
    ).length;
    const emotionalUnderstandingRatio = totalDays > 0 ? emotionCount / totalDays : 0;
    const emotional_understanding = ratioToStatScore(emotionalUnderstandingRatio);
    
    // 3. learning_support: 학습 지원도 (학습 필드 작성)
    const learningCount = records.filter(r => 
      r[`${prefix}_learning`] && String(r[`${prefix}_learning`]).trim().length > 0
    ).length;
    const learningSupportRatio = totalDays > 0 ? learningCount / totalDays : 0;
    const learning_support = ratioToStatScore(learningSupportRatio);
    
    // ===== 공통 지표 =====
    
    // positivity_ratio: 전반적인 기록 완성도
    const filledRecords = records.filter(r => {
      const keys = Object.keys(r).filter(k => k.startsWith(prefix));
      return keys.some(k => r[k] && String(r[k]).trim().length > 0);
    }).length;
    const positivityRatio = totalDays > 0 ? filledRecords / totalDays : 0;
    const positivity_ratio = ratioToStatScore(positivityRatio);

    return {
      total_days: totalDays,
      positivity_ratio,
      growth_observation,
      emotional_understanding,
      learning_support,
      energy_average: 2.8,
      personality_type: '성장하는 부모',
      strengths: [
        '아이의 변화를 세밀히 관찰',
        '부모로서 배움을 찾는 능력',
        '미래를 계획하는 성향',
      ],
    };
  }

  /**
   * 주식거래일지 통계 계산
   */
  private calculateStockStats(records: HaruRecord[], prefix: string) {
    const buyCount = records.filter(r => String(r.stock_type || '').includes('매수')).length;
    const sellCount = records.filter(r => String(r.stock_type || '').includes('매도')).length;
    const reflectedCount = records.filter(r => String(r.stock_reflection || r[`${prefix}_sayu`] || '').trim()).length;
    const totalAmount = records.reduce((sum, r) => {
      const amount = parseInt(String(r.stock_total || '').replace(/[^0-9]/g, ''), 10) || 0;
      return sum + amount;
    }, 0);
    const stocks = new Set(records.map(r => String(r.stock_name || '').trim()).filter(Boolean));
    const reflectionRate = records.length > 0 ? Math.round((reflectedCount / records.length) * 100) : 0;

    return {
      total_days: records.length,
      trade_count: records.length,
      buy_count: buyCount,
      sell_count: sellCount,
      stock_count: stocks.size,
      total_amount: totalAmount,
      reflection_rate: reflectionRate,
      consistency_score: Math.min(100, records.length * 10),
      risk_review_score: reflectionRate,
      personality_type: '거래 복기형 투자자',
      insight: `총 ${records.length}건의 거래를 기록했고, ${stocks.size}개 종목을 다뤘습니다. 거래소감 기록률은 ${reflectionRate}%입니다.`,
    };
  }

  // ✅ 새로 추가: 텃밭일지 작물 관리 함수들
  
  /**
   * 사용자의 현재 작물 목록 가져오기
   */
  async getGardenCrops(userId: string): Promise<string[]> {
    try {
      const cropsRef = doc(db, 'users', userId, 'settings', 'gardenCrops');
      const cropsSnap = await getDoc(cropsRef);
      
      if (cropsSnap.exists()) {
        const data = cropsSnap.data() as GardenCrops;
        return data.crops || [];
      }
      
      return [];
    } catch (error) {
      console.error('작물 목록 불러오기 실패:', error);
      return [];
    }
  }

  /**
   * 사용자의 작물 목록 저장/업데이트
   */
  async saveGardenCrops(userId: string, crops: string[]): Promise<void> {
    try {
      const cropsRef = doc(db, 'users', userId, 'settings', 'gardenCrops');
      await setDoc(cropsRef, {
        crops,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('작물 목록 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 작물 추가 (중복 방지)
   */
  async addGardenCrop(userId: string, crop: string): Promise<string[]> {
    const currentCrops = await this.getGardenCrops(userId);
    
    if (!currentCrops.includes(crop)) {
      const newCrops = [...currentCrops, crop];
      await this.saveGardenCrops(userId, newCrops);
      return newCrops;
    }
    
    return currentCrops;
  }

  /**
   * 작물 삭제
   */
  async removeGardenCrop(userId: string, crop: string): Promise<string[]> {
    const currentCrops = await this.getGardenCrops(userId);
    const newCrops = currentCrops.filter(c => c !== crop);
    await this.saveGardenCrops(userId, newCrops);
    return newCrops;
  }

  // ========================================
  // 설정 페이지 기능
  // ========================================

  /**
   * 사용자 통계 가져오기
   */
  async getStats(userId: string, startDate?: string, endDate?: string) {
    try {
      const records = startDate && endDate
        ? await this.getRecordsInRange(userId, startDate, endDate)
        : await this.getRecords(userId);
      
      console.log('===== 📊 통계 계산 시작 =====');
      if (startDate && endDate) {
        console.log('통계 기간:', startDate, '~', endDate);
      }
      console.log('총 기록 개수:', records.length);
      
      // 총 기록 개수
      const totalRecords = records.length;
      
      // 다듬기 완료 개수 (polished 필드가 있는 기록)
      let polishedCount = 0;
      
      // SAYU 완성 개수 (_sayu 필드가 있는 기록)
      let sayuCount = 0;
      
      // 형식별 카운트 (formats 배열 기준 - 실제 작성한 형식)
      const formatCounts: Record<string, number> = {};
      
      // 형식별 SAYU 완료 카운트 (SAYU 기준)
      const formatSayuCounts: Record<string, number> = {};
      
      // 9개 형식의 prefix
      const formatPrefixes = [
        { name: '일기', prefix: 'diary' },
        { name: '에세이', prefix: 'essay' },
        { name: '선교보고', prefix: 'mission' },
        { name: '일반보고', prefix: 'report' },
        { name: '업무일지', prefix: 'work' },
        { name: '여행기록', prefix: 'travel' },
        { name: '텃밭일지', prefix: 'garden' },
        { name: '애완동물관찰일지', prefix: 'pet' },
        { name: '육아일기', prefix: 'child' },
        { name: 'HARU주식관리', prefix: 'stock' },
        { name: '주식거래일지', prefix: 'stock' },
        { name: 'HARU보조장부', prefix: 'ledger' },
      ];
      
      records.forEach((record, index) => {
        console.log(`\n--- 기록 ${index + 1} (${record.date}) ---`);
        console.log('선택된 형식:', record.formats);
        
        // 이 기록에 SAYU가 있는지 체크
        let hasSayu = false;
        let hasPolished = false;
        
        // ✅ formats 배열 기준으로 카운트 (실제 작성한 형식)
        if (record.formats && Array.isArray(record.formats)) {
          record.formats.forEach((format: string) => {
            formatCounts[format] = (formatCounts[format] || 0) + 1;
            console.log(`  → ${format} 카운트 증가: ${formatCounts[format]}`);
          });
        }
        if (
          (!Array.isArray(record.formats) || !record.formats.includes('HARU보조장부' as RecordFormat)) &&
          Object.keys(record).some((key) => key.startsWith('ledger_') && typeof record[key] === 'string' && record[key].trim().length > 0)
        ) {
          formatCounts['HARU보조장부'] = (formatCounts['HARU보조장부'] || 0) + 1;
          console.log(`  → HARU보조장부 ledger_* 보정 카운트 증가: ${formatCounts['HARU보조장부']}`);
        }
        
        // 각 형식별 SAYU 체크 (SAYU 완료 통계용)
        formatPrefixes.forEach(({ name, prefix }) => {
          const sayuKey = `${prefix}_sayu`;
          if (record[sayuKey] && record[sayuKey].trim().length > 0) {
            hasSayu = true;
            hasPolished = true;  // SAYU 있으면 다듬기도 완료로 간주
            formatSayuCounts[name] = (formatSayuCounts[name] || 0) + 1;
            console.log(`  ✨ ${name} SAYU 발견! SAYU 카운트: ${formatSayuCounts[name]}`);
          }
        });
        
        // 기록당 1번만 카운트
        if (hasSayu) {
          sayuCount++;
        }
        if (hasPolished) {
          polishedCount++;
        }
      });
      
      console.log('\n===== 📊 최종 통계 =====');
      console.log('총 기록 개수:', totalRecords);
      console.log('SAYU 완료 기록 수:', sayuCount);
      console.log('형식별 작성 개수:', formatCounts);
      console.log('형식별 SAYU 완료 개수:', formatSayuCounts);
      console.log('=========================\n');
      
      return {
        totalRecords,
        polishedCount,
        sayuCount,
        formatCounts,      // ✅ 실제 작성한 형식 개수
        formatSayuCounts,  // ✅ SAYU 완료 개수 (참고용)
      };
    } catch (error) {
      console.error('통계 로딩 실패:', error);
      throw error;
    }
  }

  private readonly EXPORT_EXCLUDED_FIELDS = new Set([
    'id', 'uid', 'userId', 'recordId', 'date', 'formats',
    'createdAt', 'updatedAt', 'deletedAt', 'imageMeta',
    'storagePath', 'storagePaths',
  ]);

  private readonly EXPORT_FORMAT_PREFIXES = [
    'diary', 'essay', 'mission', 'report', 'work', 'travel',
    'reading', 'garden', 'pet', 'child', 'parenting', 'stock',
    'memo', 'growthTimeline', 'haruraw', 'ledger', 'voiding',
  ];

  private toExportTimestamp(v: unknown): number {
    if (!v) return 0;
    // Firestore Timestamp instance (toMillis method)
    if (typeof (v as any).toMillis === 'function') return (v as any).toMillis();
    // Plain {seconds, nanoseconds} object
    if (typeof (v as any).seconds === 'number') return (v as any).seconds * 1000;
    // ISO string or date-parseable string
    const ms = Date.parse(String(v));
    return isNaN(ms) ? 0 : ms;
  }

  private extractExportImages(record: HaruRecord): string[] {
    const refs = new Set<string>();

    // *_images fields for all format prefixes
    for (const prefix of this.EXPORT_FORMAT_PREFIXES) {
      const val = record[`${prefix}_images`];
      if (val) getPublicImageUrls(val).forEach(u => refs.add(u));
    }

    // top-level images field
    if (record.images) getPublicImageUrls(record.images).forEach(u => refs.add(u));

    // imageMeta: may be array of {url, path, ...} or {url, path}
    const addImageMeta = (meta: unknown) => {
      if (!meta) return;
      const arr = Array.isArray(meta) ? meta : [meta];
      for (const item of arr) {
        if (typeof item === 'object' && item !== null) {
          const url = (item as any).url || (item as any).downloadUrl || (item as any).downloadURL;
          const path = (item as any).path || (item as any).storagePath;
          if (typeof url === 'string' && url.startsWith('https://')) refs.add(url);
          else if (typeof path === 'string' && path) refs.add(path);
        } else if (typeof item === 'string' && item) {
          refs.add(item);
        }
      }
    };
    addImageMeta(record.imageMeta);

    // storagePath / storagePaths
    if (typeof record.storagePath === 'string' && record.storagePath) refs.add(record.storagePath);
    if (record.storagePaths) {
      const arr = Array.isArray(record.storagePaths) ? record.storagePaths : [record.storagePaths];
      for (const p of arr) { if (typeof p === 'string' && p) refs.add(p); }
    }

    // scan all fields for photo/file/attachment keys that contain URL/path strings
    const MEDIA_KEY_RE = /photo|file|attach/i;
    for (const [k, v] of Object.entries(record)) {
      if (!MEDIA_KEY_RE.test(k)) continue;
      if (typeof v === 'string' && v) {
        refs.add(v);
      } else if (Array.isArray(v)) {
        for (const item of v) { if (typeof item === 'string' && item) refs.add(item); }
      }
    }

    // per-format imageMeta / photo / file / attach sub-fields
    for (const prefix of this.EXPORT_FORMAT_PREFIXES) {
      addImageMeta(record[`${prefix}_imageMeta`]);
      for (const suffix of ['photo', 'file', 'attachment', 'attachments', 'photos']) {
        const val = record[`${prefix}_${suffix}`];
        if (typeof val === 'string' && val) refs.add(val);
        else if (Array.isArray(val)) {
          for (const item of val) { if (typeof item === 'string' && item) refs.add(item); }
        }
      }
    }

    return Array.from(refs);
  }

  private groupRecordsForExport(records: HaruRecord[]): Record<string, HaruRecord[]> {
    const groups: Record<string, HaruRecord[]> = {};
    for (const record of records) {
      const key = record.date ? String(record.date).slice(0, 10) : '날짜 미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) =>
        this.toExportTimestamp(b.createdAt) - this.toExportTimestamp(a.createdAt)
      );
    }
    return groups;
  }

  private sortedExportDates(groups: Record<string, HaruRecord[]>): string[] {
    return Object.keys(groups).sort((a, b) => {
      if (a === '날짜 미지정') return 1;
      if (b === '날짜 미지정') return -1;
      return b.localeCompare(a);
    });
  }

  private buildJsonExportPayload(userId: string, records: HaruRecord[]): object {
    const exportedAt = new Date().toISOString();
    const groups = this.groupRecordsForExport(records);
    const dates = this.sortedExportDates(groups);

    const recordsByDate: Record<string, { summary: Record<string, unknown>; images: string[]; raw: HaruRecord }[]> = {};
    for (const date of dates) {
      recordsByDate[date] = groups[date].map(record => {
        const summary: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(record)) {
          if (this.EXPORT_EXCLUDED_FIELDS.has(k)) continue;
          if (k.endsWith('_images')) continue;
          if (v === null || v === undefined) continue;
          summary[k] = v;
        }
        return { summary, images: this.extractExportImages(record), raw: record };
      });
    }

    return {
      exportInfo: {
        service: 'HARU2026',
        exportedAt,
        totalRecords: records.length,
        scope: 'all_records',
        sortOrder: 'date_desc',
        includesOriginalRecords: true,
        includesImageFiles: false,
        imageNote: '사진·첨부파일은 이 파일에 포함되지 않습니다. 사진이 있는 기록에는 저장 위치 주소가 표시됩니다. 계정 상태 또는 저장 권한에 따라 나중에 열리지 않을 수 있습니다.',
      },
      recordsByDate,
      exportDate: exportedAt,
      userId,
      totalRecords: records.length,
      records,
    };
  }

  private buildTextExportContent(records: HaruRecord[]): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const lines: string[] = [
      '============================',
      'HARU2026 기록 내보내기',
      '============================',
      `내보내기 일시: ${dateStr}`,
      '내보내기 범위: 전체 기록',
      `총 기록 수: ${records.length}건`,
      '정렬 기준: 기록 날짜 최신순, 같은 날짜 안에서는 작성일 최신순',
      '',
      '[사진·첨부파일 안내]',
      '이 파일에는 이미지 파일 자체가 포함되어 있지 않습니다.',
      '사진이 있는 기록에는 저장 위치 주소가 표시됩니다.',
      '주소는 계정 상태 또는 저장 권한에 따라 나중에 열리지 않을 수 있습니다.',
      '탈퇴 전에 사진을 보관하려면 해당 주소를 열어 직접 저장해 주세요.',
      '============================',
      '',
    ];

    const groups = this.groupRecordsForExport(records);
    const dates = this.sortedExportDates(groups);

    for (const date of dates) {
      lines.push(`[ ${date} ]`, '');
      for (const record of groups[date]) {
        const formats = Array.isArray(record.formats) && record.formats.length > 0
          ? record.formats.join(', ')
          : '형식 없음';
        lines.push(`  [${formats}]`);

        for (const [key, value] of Object.entries(record)) {
          if (this.EXPORT_EXCLUDED_FIELDS.has(key)) continue;
          if (key.endsWith('_images')) continue;
          if (value === null || value === undefined) continue;

          let displayKey = key;
          for (const prefix of this.EXPORT_FORMAT_PREFIXES) {
            if (key.startsWith(`${prefix}_`)) {
              displayKey = key.slice(prefix.length + 1);
              break;
            }
          }

          let displayValue: string;
          try {
            if (typeof value === 'string') {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                displayValue = (parsed as unknown[]).map(v => String(v ?? '')).filter(Boolean).join(', ');
              } else if (parsed && typeof parsed === 'object') {
                displayValue = Object.entries(parsed as Record<string, unknown>)
                  .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' / ');
              } else {
                displayValue = String(parsed ?? '');
              }
            } else if (Array.isArray(value)) {
              displayValue = (value as unknown[]).map(v => String(v ?? '')).filter(Boolean).join(', ');
            } else if (typeof value === 'object') {
              displayValue = JSON.stringify(value);
            } else {
              displayValue = String(value);
            }
          } catch {
            displayValue = typeof value === 'string' ? value : String(value);
          }

          if (!displayValue.trim()) continue;
          lines.push(`  ${displayKey}: ${displayValue}`);
        }

        const images = this.extractExportImages(record);
        if (images.length > 0) {
          lines.push('  사진/첨부파일:');
          images.forEach(url => lines.push(`    ${url}`));
        } else {
          lines.push('  사진/첨부파일: 없음');
        }

        lines.push('', '  ----', '');
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 모든 데이터 JSON으로 내보내기
   */
  async exportData(userId: string): Promise<Blob> {
    try {
      const records = await this.getRecords(userId);
      const payload = this.buildJsonExportPayload(userId, records);
      const jsonString = JSON.stringify(payload, null, 2);
      return new Blob([jsonString], { type: 'application/json' });
    } catch (error) {
      console.error('데이터 내보내기 실패:', error);
      throw error;
    }
  }

  /**
   * 모든 기록을 TXT로 내보내기 (Blob 반환만 담당, 파일명·다운로드는 호출부에서 처리)
   */
  async exportDataAsText(userId: string): Promise<Blob> {
    try {
      const records = await this.getRecords(userId);
      const text = this.buildTextExportContent(records);
      return new Blob([text], { type: 'text/plain;charset=utf-8' });
    } catch (error) {
      console.error('TXT 내보내기 실패:', error);
      throw error;
    }
  }

  /**
   * 모든 데이터 삭제 (되돌릴 수 없음!)
   */
  async clearAllData(userId: string): Promise<void> {
    try {
      const recordsRef = collection(db, 'users', userId, 'records');
      const querySnapshot = await getDocs(recordsRef);
      
      // 모든 문서 삭제
      const deletePromises = querySnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);

      console.log(`${deletePromises.length}개의 기록이 삭제되었습니다.`);
    } catch (error) {
      console.error('데이터 삭제 실패:', error);
      throw error;
    }
  }

  async getUnifiedUid(email: string): Promise<string | null> {
    try {
      const docRef = doc(db, 'email_to_uid', email);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const uid = docSnap.data().uid as string;
        console.log('[getUnifiedUid] email:', email, '→ uid:', uid);
        return uid;
      }
      console.warn('[getUnifiedUid] email_to_uid 문서 없음:', email);
      return null;
    } catch (error) {
      console.error('[getUnifiedUid] 조회 실패:', error);
      return null;
    }
  }

  async getAiLogs(userEmail: string): Promise<HaruRecord[]> {
    try {
      const { db, auth } = await import('../../firebase');
      const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
      const uid = auth.currentUser?.uid;
      if (!uid) return [];
      const ref = collection(db, `users/${uid}/records`);
      const q = query(
        ref,
        where('type', '==', 'ai_log'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toISOString()
          ?? doc.data().createdAt ?? '',
      })) as HaruRecord[];
    } catch (error) {
      console.error('[getAiLogs] 실패:', error);
      return [];
    }
  }

  async deleteAiLogs(ids: Set<string>): Promise<void> {
    const { db, auth } = await import('../../firebase');
    const { doc, deleteDoc } = await import('firebase/firestore');
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('로그인이 필요합니다.');
    const promises = Array.from(ids).map(id =>
      deleteDoc(doc(db, 'users', uid, 'records', id))
    );
    await Promise.all(promises);
  }

  /**
   * 사용자 프로필 조회 (users/{uid}/settings/profile)
   * currentAge / realName / nickname 등 generic 프로필 필드.
   */
  async getUserProfile(userId: string): Promise<{
    currentAge?: number;
    ageUpdatedAt?: string;
    realName?: string;
    nickname?: string;
    nameUpdatedAt?: string;
  }> {
    try {
      const profileRef = doc(db, 'users', userId, 'settings', 'profile');
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        return snap.data() as any;
      }
      return {};
    } catch (error) {
      console.error('사용자 프로필 불러오기 실패:', error);
      return {};
    }
  }

  /**
   * 사용자 프로필 저장 (merge). 변경된 필드만 넘기면 됨.
   */
  async saveUserProfile(userId: string, partial: {
    currentAge?: number;
    realName?: string;
    nickname?: string;
  }): Promise<void> {
    try {
      const profileRef = doc(db, 'users', userId, 'settings', 'profile');
      const payload: any = { ...partial };
      if (partial.currentAge !== undefined) payload.ageUpdatedAt = new Date().toISOString();
      if (partial.realName !== undefined || partial.nickname !== undefined) payload.nameUpdatedAt = new Date().toISOString();
      await setDoc(profileRef, payload, { merge: true });
    } catch (error) {
      console.error('사용자 프로필 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 홈 개인화 설정 조회 (users/{uid}/settings/homePersonalization)
   */
  async getHomePersonalization(userId: string): Promise<HomePersonalizationSettings | null> {
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'homePersonalization');
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) return null;
      const data = snap.data() as Partial<HomePersonalizationSettings>;
      return {
        selectedRecordFormats: Array.isArray(data.selectedRecordFormats) ? data.selectedRecordFormats : [],
        selectedAgents: Array.isArray(data.selectedAgents) ? data.selectedAgents : [],
        personalized: data.personalized === true,
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      console.error('홈 개인화 설정 불러오기 실패:', error);
      return null;
    }
  }

  /**
   * 홈 개인화 설정 저장 (users/{uid}/settings/homePersonalization)
   */
  async saveHomePersonalization(userId: string, data: {
    selectedRecordFormats: string[];
    selectedAgents: string[];
  }): Promise<void> {
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'homePersonalization');
      await setDoc(settingsRef, {
        selectedRecordFormats: data.selectedRecordFormats,
        selectedAgents: data.selectedAgents,
        personalized: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('홈 개인화 설정 저장 실패:', error);
      throw error;
    }
  }
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefined(entry));
  }

  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, entry]) => {
        if (entry !== undefined) {
          acc[key] = stripUndefined(entry);
        }
        return acc;
      },
      {}
    );
  }

  return value;
}

export const firestoreService = new FirestoreService();
