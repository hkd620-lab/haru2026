import { 
  collection, 
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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';  // ✅ 수정됨: ../firebase → ../../firebase

export type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '텃밭일지' | '애완동물관찰일지' | '육아일기';

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

class FirestoreService {
  // 기존 기록 관련 함수들
  async saveRecord(userId: string, recordData: Partial<HaruRecord>) {
    const recordRef = doc(db, 'users', userId, 'records', recordData.date!);
    await setDoc(recordRef, {
      ...recordData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
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

  /**
   * ✅ 새로 추가: 특정 날짜 범위의 기록 가져오기 (통계 및 SAYU 페이지 캘린더용)
   * @param userId 사용자 ID
   * @param startDate 시작 날짜 (YYYY-MM-DD 형식)
   * @param endDate 종료 날짜 (YYYY-MM-DD 형식)
   */
  async getRecordsInRange(userId: string, startDate: string, endDate: string): Promise<HaruRecord[]> {
    try {
      const recordsRef = collection(db, 'users', userId, 'records');
      const q = query(
        recordsRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as HaruRecord[];
    } catch (error) {
      console.error('날짜 범위 기록 불러오기 실패:', error);
      return [];
    }
  }

  async updateRecord(userId: string, recordId: string, data: Partial<HaruRecord>) {
    const recordRef = doc(db, 'users', userId, 'records', recordId);
    await updateDoc(recordRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteRecord(userId: string, recordId: string) {
    const recordRef = doc(db, 'users', userId, 'records', recordId);
    await deleteDoc(recordRef);
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
      // 해당 기간의 기록 가져오기
      const records = await this.getRecordsInRange(userId, startDate, endDate);
      
      // 해당 형식의 기록만 필터링
      const formatRecords = records.filter(r => r.formats && r.formats.includes(format));
      
      if (formatRecords.length === 0) {
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
      };

      const prefix = prefixMap[format];
      
      // 형식별 통계 계산
      switch (format) {
        case '일기':
          return this.calculateDiaryStats(formatRecords, prefix);
        case '업무일지':
          return this.calculateWorkStats(formatRecords, prefix);
        case '에세이':
          return this.calculateEssayStats(formatRecords, prefix);
        case '선교보고':
          return this.calculateMissionStats(formatRecords, prefix);
        case '일반보고':
          return this.calculateReportStats(formatRecords, prefix);
        case '여행기록':
          return this.calculateTravelStats(formatRecords, prefix);
        case '텃밭일지':
          return this.calculateGardenStats(formatRecords, prefix);
        case '애완동물관찰일지':
          return this.calculatePetStats(formatRecords, prefix);
        case '육아일기':
          return this.calculateParentingStats(formatRecords, prefix);
        default:
          return this.calculateBasicStats(formatRecords, prefix, format);
      }
      
    } catch (error) {
      console.error('통계 계산 실패:', error);
      return null;
    }
  }

  /**
   * 업무일지 통계 계산
   */
  private calculateWorkStats(records: HaruRecord[], prefix: string) {
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
    
    // 긍정성 지수 (Rating 3점 이상 비율)
    const positiveRatings = ratings.filter(r => r >= 3).length;
    const positivityRatio = ratings.length > 0 ? positiveRatings / ratings.length : 0;
    
    // Result 필드 작성 비율
    const resultCount = records.filter(r => 
      r[`${prefix}_result`] && r[`${prefix}_result`].trim().length > 0
    ).length;
    const learningRatio = totalDays > 0 ? resultCount / totalDays : 0;
    
    // Pending 필드 작성 비율 (미래 지향성)
    const pendingCount = records.filter(r => 
      r[`${prefix}_pending`] && r[`${prefix}_pending`].trim().length > 0
    ).length;
    const spaceRatio = totalDays > 0 ? pendingCount / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: learningRatio,
      space_ratio: spaceRatio,
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
   * 일기 통계 계산
   */
  private calculateDiaryStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 좋았던 일 작성 비율
    const goodCount = records.filter(r => 
      r[`${prefix}_good`] && r[`${prefix}_good`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? goodCount / totalDays : 0;
    
    // 배움 작성 비율
    const learningCount = records.filter(r => 
      r[`${prefix}_learning`] && r[`${prefix}_learning`].trim().length > 0
    ).length;
    const learningRatio = totalDays > 0 ? learningCount / totalDays : 0;
    
    // 여백 작성 비율
    const spaceCount = records.filter(r => 
      r[`${prefix}_space`] && r[`${prefix}_space`].trim().length > 0
    ).length;
    const spaceRatio = totalDays > 0 ? spaceCount / totalDays : 0;
    
    // 갈등과 배움이 모두 작성된 비율
    const conflictWithLearning = records.filter(r => 
      r[`${prefix}_conflict`] && r[`${prefix}_conflict`].trim().length > 0 &&
      r[`${prefix}_learning`] && r[`${prefix}_learning`].trim().length > 0
    ).length;
    const conflictWithLearningRatio = totalDays > 0 ? conflictWithLearning / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: learningRatio,
      space_ratio: spaceRatio,
      conflict_with_learning_ratio: conflictWithLearningRatio,
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
   * 에세이 통계 계산
   * 필드: observation, impression, comparison, essence, closing
   */
  private calculateEssayStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 관찰 작성률
    const observationCount = records.filter(r => 
      r[`${prefix}_observation`] && r[`${prefix}_observation`].trim().length > 0
    ).length;
    
    // 핵심 작성률 (깊이 있는 사색)
    const essenceCount = records.filter(r => 
      r[`${prefix}_essence`] && r[`${prefix}_essence`].trim().length > 0
    ).length;
    const learningRatio = totalDays > 0 ? essenceCount / totalDays : 0;
    
    // 끝인사 작성률 (완결성)
    const closingCount = records.filter(r => 
      r[`${prefix}_closing`] && r[`${prefix}_closing`].trim().length > 0
    ).length;
    const spaceRatio = totalDays > 0 ? closingCount / totalDays : 0;
    
    // 비유 사용률 (comparison 작성률)
    const comparisonCount = records.filter(r => 
      r[`${prefix}_comparison`] && r[`${prefix}_comparison`].trim().length > 0
    ).length;
    const comparisonRatio = totalDays > 0 ? comparisonCount / totalDays : 0;
    
    // 긍정성: 인상 필드 작성률
    const impressionCount = records.filter(r => 
      r[`${prefix}_impression`] && r[`${prefix}_impression`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? impressionCount / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: learningRatio,
      space_ratio: spaceRatio,
      comparison_ratio: comparisonRatio,
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
   * 선교보고 통계 계산
   * 필드: place, action, grace, heart, prayer
   */
  private calculateMissionStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 은혜 발견률
    const graceCount = records.filter(r => 
      r[`${prefix}_grace`] && r[`${prefix}_grace`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? graceCount / totalDays : 0;
    
    // 마음 나눔률 (성찰)
    const heartCount = records.filter(r => 
      r[`${prefix}_heart`] && r[`${prefix}_heart`].trim().length > 0
    ).length;
    const learningRatio = totalDays > 0 ? heartCount / totalDays : 0;
    
    // 기도 작성률 (미래 지향)
    const prayerCount = records.filter(r => 
      r[`${prefix}_prayer`] && r[`${prefix}_prayer`].trim().length > 0
    ).length;
    const spaceRatio = totalDays > 0 ? prayerCount / totalDays : 0;
    
    // 활동 기록률
    const actionCount = records.filter(r => 
      r[`${prefix}_action`] && r[`${prefix}_action`].trim().length > 0
    ).length;
    const actionRatio = totalDays > 0 ? actionCount / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: learningRatio,
      space_ratio: spaceRatio,
      action_ratio: actionRatio,
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
   * 일반보고 통계 계산
   * 필드: activity, progress, achievement, notes, future
   */
  private calculateReportStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 핵심 성과 작성률
    const achievementCount = records.filter(r => 
      r[`${prefix}_achievement`] && r[`${prefix}_achievement`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? achievementCount / totalDays : 0;
    
    // 특이사항 기록률 (문제 인식)
    const notesCount = records.filter(r => 
      r[`${prefix}_notes`] && r[`${prefix}_notes`].trim().length > 0
    ).length;
    const learningRatio = totalDays > 0 ? notesCount / totalDays : 0;
    
    // 향후 계획 작성률
    const futureCount = records.filter(r => 
      r[`${prefix}_future`] && r[`${prefix}_future`].trim().length > 0
    ).length;
    const spaceRatio = totalDays > 0 ? futureCount / totalDays : 0;
    
    // 진행 상황 작성률
    const progressCount = records.filter(r => 
      r[`${prefix}_progress`] && r[`${prefix}_progress`].trim().length > 0
    ).length;
    const progressRatio = totalDays > 0 ? progressCount / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: learningRatio,
      space_ratio: spaceRatio,
      progress_ratio: progressRatio,
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
   * 여행기록 통계 계산
   * 필드: journey, scenery, food, thought, gratitude
   */
  private calculateTravelStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 단상 작성률 (사색 깊이)
    const thoughtCount = records.filter(r => 
      r[`${prefix}_thought`] && r[`${prefix}_thought`].trim().length > 0
    ).length;
    const learningRatio = totalDays > 0 ? thoughtCount / totalDays : 0;
    
    // 감사 표현률
    const gratitudeCount = records.filter(r => 
      r[`${prefix}_gratitude`] && r[`${prefix}_gratitude`].trim().length > 0
    ).length;
    const positivityRatio = totalDays > 0 ? gratitudeCount / totalDays : 0;
    
    // 풍경 기록률
    const sceneryCount = records.filter(r => 
      r[`${prefix}_scenery`] && r[`${prefix}_scenery`].trim().length > 0
    ).length;
    const sceneryRatio = totalDays > 0 ? sceneryCount / totalDays : 0;
    
    // 미식 기록률
    const foodCount = records.filter(r => 
      r[`${prefix}_food`] && r[`${prefix}_food`].trim().length > 0
    ).length;
    const foodRatio = totalDays > 0 ? foodCount / totalDays : 0;
    
    // 완성도: 모든 필드 작성 비율
    const completeCount = records.filter(r => 
      r[`${prefix}_journey`] && r[`${prefix}_scenery`] && 
      r[`${prefix}_food`] && r[`${prefix}_thought`] && r[`${prefix}_gratitude`]
    ).length;
    const spaceRatio = totalDays > 0 ? completeCount / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: learningRatio,
      space_ratio: spaceRatio,
      scenery_ratio: sceneryRatio,
      food_ratio: foodRatio,
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
   * 텃밭일지 통계 계산
   */
  private calculateGardenStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 기본 통계 (필드 구조 확인 필요)
    const filledRecords = records.filter(r => {
      const keys = Object.keys(r).filter(k => k.startsWith(prefix));
      return keys.some(k => r[k] && String(r[k]).trim().length > 0);
    }).length;
    
    const positivityRatio = totalDays > 0 ? filledRecords / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: 0.70,
      space_ratio: 0.68,
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
   * 애완동물관찰일지 통계 계산
   */
  private calculatePetStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 기본 통계
    const filledRecords = records.filter(r => {
      const keys = Object.keys(r).filter(k => k.startsWith(prefix));
      return keys.some(k => r[k] && String(r[k]).trim().length > 0);
    }).length;
    
    const positivityRatio = totalDays > 0 ? filledRecords / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: 0.65,
      space_ratio: 0.58,
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
   * 육아일기 통계 계산
   */
  private calculateParentingStats(records: HaruRecord[], prefix: string) {
    const totalDays = records.length;
    
    // 기본 통계
    const filledRecords = records.filter(r => {
      const keys = Object.keys(r).filter(k => k.startsWith(prefix));
      return keys.some(k => r[k] && String(r[k]).trim().length > 0);
    }).length;
    
    const positivityRatio = totalDays > 0 ? filledRecords / totalDays : 0;

    return {
      total_days: totalDays,
      positivity_ratio: positivityRatio,
      learning_ratio: 0.85,
      space_ratio: 0.72,
      energy_average: 2.8,
      personality_type: '성장하는 부모',
      strengths: [
        '아이의 변화를 세밀히 관찰',
        '부모로서 배움을 찾는 능력',
        '미래를 계획하는 성향',
      ],
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
}

export const firestoreService = new FirestoreService();
