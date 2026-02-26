import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
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
  private recordsCollection = 'records';

  async saveRecord(uid: string, recordData: RecordInput): Promise<void> {
    const recordRef = doc(db, this.recordsCollection, `${uid}_${recordData.date}`);

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
    // 인덱스 불필요한 간단한 쿼리
    const q = query(
      collection(db, this.recordsCollection),
      where('__name__', '>=', `${uid}_`),
      where('__name__', '<=', `${uid}_\uf8ff`)
    );

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

    // 클라이언트 측에서 정렬 (날짜 최신순)
    return records.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getRecordByDate(uid: string, date: string): Promise<HaruRecord | null> {
    const recordRef = doc(db, this.recordsCollection, `${uid}_${date}`);
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
    const recordRef = doc(db, this.recordsCollection, recordId);
    await updateDoc(recordRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  }
}

export const firestoreService = new FirestoreService();
