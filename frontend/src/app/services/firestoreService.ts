import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type RecordFormat = '일기' | '에세이' | '여행기록' | '텃밭일기' | '애완동물관찰일지' | '육아일기' | '선교보고' | '일반보고' | '업무일지';

export interface HaruRecord {
  id: string;
  uid: string;
  date: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  formats?: RecordFormat[];
  polished?: boolean;
  polishedAt?: string | null;
  sayuContent?: string | null;
  sayuSavedAt?: string | null;
  mergeRating?: number;
  createdAt: string;
  updatedAt?: string;
  content?: string;
  [key: string]: any;
}

export const firestoreService = {
  // 📝 기록 저장 또는 업데이트 (같은 날짜면 덮어쓰기)
  async saveRecord(uid: string, recordData: Partial<HaruRecord>): Promise<string> {
    const recordsRef = collection(db, 'users', uid, 'records');
    
    // 🔍 같은 날짜의 기록이 있는지 확인
    if (recordData.date) {
      const q = query(recordsRef, where('date', '==', recordData.date), limit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // 🔄 기존 기록 업데이트 (덮어쓰기)
        const existingDoc = snapshot.docs[0];
        const docRef = doc(db, 'users', uid, 'records', existingDoc.id);
        await updateDoc(docRef, {
          ...recordData,
          updatedAt: serverTimestamp()
        });
        return existingDoc.id;
      }
    }
    
    // 📝 새 기록 생성
    const newDocRef = doc(recordsRef);
    const data = {
      ...recordData,
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(newDocRef, data);
    return newDocRef.id;
  },

  // 📖 읽기 - 모든 기록 가져오기
  async getRecords(uid: string): Promise<HaruRecord[]> {
    const recordsRef = collection(db, 'users', uid, 'records');
    const q = query(recordsRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as HaruRecord));
  },

  // 📖 읽기 - 특정 기록 가져오기
  async getRecord(uid: string, recordId: string): Promise<HaruRecord | null> {
    const docRef = doc(db, 'users', uid, 'records', recordId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as HaruRecord;
    }
    return null;
  },

  // 🔄 수정 - 기존 기록 수정
  async updateRecord(uid: string, recordId: string, updates: Partial<HaruRecord>): Promise<void> {
    const docRef = doc(db, 'users', uid, 'records', recordId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  // 🗑️ 삭제 - 기록 삭제
  async deleteRecord(uid: string, recordId: string): Promise<void> {
    const docRef = doc(db, 'users', uid, 'records', recordId);
    await deleteDoc(docRef);
  },

  // 📊 통계 - 기록 통계 가져오기
  async getStats(uid: string) {
    console.log('🔵 getStats() 시작됨, uid:', uid);
    const records = await this.getRecords(uid);
    console.log('🔵 기록 데이터 로드됨:', records.length, '개');
    const totalRecords = records.length;
    const polishedCount = records.filter((r) => r.polished).length;
    const sayuCount = records.filter((r) => r.sayuSavedAt).length;
    const formatCounts: Record<string, number> = {};
    records.forEach((r) => {
      r.formats?.forEach((f) => {
        formatCounts[f] = (formatCounts[f] || 0) + 1;
      });
    });
    // 형식별 고유 기록일수 (중복 날짜 제거)
    const formatDateSets: Record<string, Set<string>> = {};
    records.forEach((r) => {
      if (!r.date) return;
      r.formats?.forEach((f) => {
        if (!formatDateSets[f]) formatDateSets[f] = new Set();
        formatDateSets[f].add(r.date);
      });
    });
    const formatDays: Record<string, number> = {};
    Object.keys(formatDateSets).forEach((f) => {
      formatDays[f] = formatDateSets[f].size;
    });

    // 🔍 디버깅 로그
    console.log('📊 통계 데이터:', { formatCounts, formatDays, formatDateSets: Object.keys(formatDateSets).reduce((acc, f) => ({...acc, [f]: Array.from(formatDateSets[f])}), {}) });
    // 월별 기록 수 (최근 6개월)
    const monthlyMap: Record<string, number> = {};
    records.forEach((r) => {
      if (!r.date) return;
      const ym = r.date.slice(0, 7); // 'YYYY-MM'
      monthlyMap[ym] = (monthlyMap[ym] || 0) + 1;
    });
    const now = new Date();
    const monthlyCounts = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { month: ym.slice(5) + '월', count: monthlyMap[ym] ?? 0 };
    });

    // 형식별 최근 기록일
    const formatLastDate: Record<string, string> = {};
    Object.keys(formatDateSets).forEach((f) => {
      const dates = Array.from(formatDateSets[f]).sort();
      formatLastDate[f] = dates[dates.length - 1] ?? '';
    });

    return { totalRecords, polishedCount, sayuCount, formatCounts, formatDays, monthlyCounts, formatLastDate };
  },

  // 📤 내보내기 - 전체 데이터를 JSON으로 내보내기
  async exportData(uid: string): Promise<string> {
    const records = await this.getRecords(uid);
    return JSON.stringify(records, null, 2);
  },

  // 🗑️ 전체 삭제 - 모든 기록 삭제
  async clearAllData(uid: string): Promise<void> {
    const records = await this.getRecords(uid);
    const deletePromises = records.map(record => 
      this.deleteRecord(uid, record.id)
    );
    await Promise.all(deletePromises);
  }
};