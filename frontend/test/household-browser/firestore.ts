import { saveHouseholdEntries } from '../../src/app/services/householdSaveService';
import { getFirestore } from './firestore-sdk';
export const firestoreService = {
  saveHouseholdRecord: (uid: string, entries: any[], decisions: any) => saveHouseholdEntries(getFirestore(), uid, entries, decisions),
};
