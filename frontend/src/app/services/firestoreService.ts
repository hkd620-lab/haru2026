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
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
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

export interface LibraryEntryInput {
  category: string;
  type: string;
  title: string;
  date?: string;
  summary?: string;
  refPath: string;
}

export interface LibraryEntry extends Required<LibraryEntryInput> {
  id: string;
  createdAt?: any;
}

export interface LibraryBackfillPreview {
  books: LibraryEntryInput[];
  timelines: LibraryEntryInput[];
  total: number;
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
};

const getCleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getTodayString = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

class FirestoreService {
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
    return recordId;
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
    await setDoc(
      entryRef,
      {
        ...normalizedEntry,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
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

  async previewLibraryBackfill(userId: string): Promise<LibraryBackfillPreview> {
    const booksSnapshot = await getDocs(
      query(collection(db, 'books'), where('authorUid', '==', userId)),
    );
    const books = booksSnapshot.docs.map((bookDoc) => {
      const data = bookDoc.data();
      const title = getCleanText(data.title) || '제목 없는 책';
      const totalChapters = typeof data.totalChapters === 'number' ? data.totalChapters : 0;
      return {
        category: '비서',
        type: 'book',
        title,
        date: dateFromFirestoreValue(data.createdAt),
        summary: totalChapters > 0 ? `생성된 챕터 ${totalChapters}개` : '책 생성 기록',
        refPath: `books/${bookDoc.id}`,
      };
    });

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
      };
    });

    return {
      books,
      timelines,
      total: books.length + timelines.length,
    };
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
  async getStats(userId: string) {
    try {
      const records = await this.getRecords(userId);
      
      console.log('===== 📊 통계 계산 시작 =====');
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

  /**
   * 모든 데이터 JSON으로 내보내기
   */
  async exportData(userId: string): Promise<Blob> {
    try {
      const records = await this.getRecords(userId);
      
      // 내보낼 데이터 구조
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: userId,
        totalRecords: records.length,
        records: records,
      };
      
      // JSON 문자열로 변환 (들여쓰기 2칸)
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Blob 생성
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      return blob;
    } catch (error) {
      console.error('데이터 내보내기 실패:', error);
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
}

export const firestoreService = new FirestoreService();
