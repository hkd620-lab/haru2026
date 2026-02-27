import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';

const db = getFirestore();

export type RecordFormat =
  | '일기'
  | '에세이'
  | '선교보고'
  | '일반보고'
  | '업무일지'
  | '여행기록'
  | '애완동물관찰일지'
  | '육아일기'
  | '텃밭일지';

export interface HaruRecord {
  id: string;
  date: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  formats?: RecordFormat[];
  content?: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface RecordInput {
  date: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  formats?: RecordFormat[];
  content?: string;
}

class FirestoreService {
  // users/{uid}/records 경로로 변경
  private getRecordsCollection(uid: string) {
    return collection(db, 'users', uid, 'records');
  }

  async saveRecord(uid: string, recordData: RecordInput): Promise<void> {
    // users/{uid}/records/{date} 경로
    const recordRef = doc(this.getRecordsCollection(uid), recordData.date);
    const existingDoc = await getDoc(recordRef);

    if (existingDoc.exists()) {
      await updateDoc(recordRef, {
        ...recordData,
        updatedAt: Timestamp.now(),
      });
    } else {
      await setDoc(recordRef, {
        ...recordData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  }

  async getRecords(uid: string): Promise<HaruRecord[]> {
    // users/{uid}/records 서브컬렉션에서 가져오기
    const recordsCol = this.getRecordsCollection(uid);
    const q = query(recordsCol, orderBy('date', 'desc'));
    
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date || '',
        weather: data.weather,
        temperature: data.temperature,
        mood: data.mood,
        formats: data.formats || [],
        content: data.content || '',
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        ...data,
      };
    });

    return records;
  }

  async getRecordByDate(uid: string, date: string): Promise<HaruRecord | null> {
    // users/{uid}/records/{date} 경로
    const recordRef = doc(this.getRecordsCollection(uid), date);
    const snapshot = await getDoc(recordRef);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      id: snapshot.id,
      date: data.date || '',
      weather: data.weather,
      temperature: data.temperature,
      mood: data.mood,
      formats: data.formats || [],
      content: data.content || '',
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      ...data,
    };
  }

  async updateRecord(uid: string, recordId: string, updateData: Record<string, any>): Promise<void> {
    // users/{uid}/records/{recordId} 경로
    const recordRef = doc(this.getRecordsCollection(uid), recordId);
    await updateDoc(recordRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  }
}

export const firestoreService = new FirestoreService();