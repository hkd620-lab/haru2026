// 저장 직전 "같은 이름의 아이가 이미 있는지" Firestore에서 다시 확인한다 — 대상 목록을 불러오기 전에 저장했거나 다른 기기에서
// 막 등록한 경우에도 같은 아이가 둘로 갈라지지 않게 한다. 결과 판정은 utils/growthSubject.ts 의 resolveSameNameChild 가 맡는다.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { resolveSameNameChild, type SameNameChildLookup } from '../utils/growthSubject';

export async function findSameNameChildSubject(uid: string, name: string): Promise<SameNameChildLookup> {
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'growthSubjects'), where('subjectType', '==', 'child')));
    const result = resolveSameNameChild(snap, name);
    if (result.status === 'error') console.warn('같은 이름의 아이 확인 실패: 서버에 닿지 못해 캐시로만 응답');
    return result;
  } catch (error) {
    console.warn('같은 이름의 아이 확인 실패:', error);
    return { status: 'error' };
  }
}
