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
