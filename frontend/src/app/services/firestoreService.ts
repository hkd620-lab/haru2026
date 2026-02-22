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

  // ✏️ 저장 - 새 기록 저장 (서재에서 사용)
  async saveRecord(uid: string, recordData: Partial<HaruRecord>): Promise<string> {
    const recordsRef = collection(db, 'users', uid, 'records');
    const newDocRef = doc(recordsRef); // 자동 ID 생성
    
    const data = {
      ...recordData,
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(newDocRef, data);
    return newDocRef.id;
  },

  // 🔄 수정 - 기존 기록 수정 (SAYU에서 사용)
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

  // 📊 통계 - 기록 통계 가져오기 (SettingsPage용)
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
    
    return { totalRecords, polishedCount, sayuCount, formatCounts };
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
