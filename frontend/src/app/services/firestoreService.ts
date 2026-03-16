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

export type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록';

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
    const records = await this.getRecords(uid);
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
    return { totalRecords, polishedCount, sayuCount, formatCounts, formatDays };
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