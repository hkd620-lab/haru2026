// 운영 Firebase와 연결하지 않는 메모리 저장소. 실제 저장·편집·설정 서비스 코드를 그대로 실행한다.
// 실패·응답 유실·다른 기기 수정·계정 전환은 화면의 시험 버튼으로 만든다.
import { useSyncExternalStore } from "react";
import { demoRecords, legacyArrayRecords } from "./fixtures";
import { saveHouseholdEntries } from "../../src/app/services/householdSaveService";

let scenario = "normal";
let listener = () => {};
let failNext: "" | "fail" | "lost" = "";
export function setScenario(value: string) {
  scenario = value;
  listener();
}
export function injectFailure(mode: "fail" | "lost") {
  failNext = mode;
  bump();
}
const authUid = () =>
  scenario === "signedout"
    ? null
    : scenario === "other"
      ? "other"
      : scenario === "empty"
        ? "empty"
        : scenario === "legacy-array"
          ? "legacy-array"
          : "demo";
export const useAuth = () => {
  const value = useSyncExternalStore(
    (fn) => {
      listener = fn;
      return () => {};
    },
    () => scenario,
  );
  void value;
  const uid = authUid();
  return { user: uid ? { uid } : null };
};

const store = new Map<string, Record<string, any>>();
for (const record of demoRecords) {
  const { id, ...data } = record;
  store.set(`users/demo/records/${id}`, data);
}
for (const record of legacyArrayRecords) {
  const { id, ...data } = record;
  store.set(`users/legacy-array/records/${id}`, data);
}
store.set("users/demo/settings/householdBudget", {
  total: 1000000,
  categories: { 쇼핑: 20000 },
});

export let writes = 0;
let writeListener = () => {};
const bump = () => writeListener();
export const useWriteCount = () =>
  useSyncExternalStore(
    (fn) => {
      writeListener = fn;
      return () => {};
    },
    () => `${writes}|${failNext}`,
  );

const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T,>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));
// 다른 계정의 경로는 기존 Rules처럼 거부한다.
function guard(path: string) {
  const owner = path.split("/")[1];
  if (owner !== authUid()) {
    const error = new Error("합성 권한 거부") as Error & { code: string };
    error.code = "permission-denied";
    throw error;
  }
}
function write(path: string, data: Record<string, any>, merge: boolean) {
  store.set(path, merge ? { ...(store.get(path) || {}), ...clone(data) } : clone(data));
}

export const db = {};
export const doc = (_db: unknown, ...segments: string[]) => ({
  path: segments.join("/"),
  id: segments[segments.length - 1],
});
export const collection = (_db: unknown, ...segments: string[]) => ({
  path: segments.join("/"),
});
const snapshot = (ref: { path: string; id: string }) => {
  const data = store.get(ref.path);
  return { id: ref.id, exists: () => data !== undefined, data: () => clone(data) };
};
export const getDoc = async (ref: { path: string; id: string }) => {
  await delay();
  guard(ref.path);
  return snapshot(ref);
};
export const getDocFromServer = getDoc;
export const getDocsFromServer = async (col: { path: string }) => {
  await delay();
  guard(col.path);
  const depth = col.path.split("/").length + 1;
  return {
    docs: [...store]
      .filter(([path]) => path.startsWith(`${col.path}/`) && path.split("/").length === depth)
      .map(([path, data]) => ({ id: path.split("/").pop()!, data: () => clone(data) })),
  };
};
export const setDoc = async (
  ref: { path: string },
  data: Record<string, any>,
  options?: { merge?: boolean },
) => {
  await delay();
  guard(ref.path);
  write(ref.path, data, Boolean(options?.merge));
  writes++;
  bump();
};
export const runTransaction = async (
  _db: unknown,
  fn: (transaction: any) => Promise<any>,
) => {
  await delay(150);
  const pending: [string, { path: string }, Record<string, any>, boolean][] = [];
  const result = await fn({
    get: async (ref: { path: string; id: string }) => {
      guard(ref.path);
      return snapshot(ref);
    },
    set: (ref: { path: string }, data: Record<string, any>, options?: { merge?: boolean }) =>
      pending.push(["set", ref, data, Boolean(options?.merge)]),
    update: (ref: { path: string }, data: Record<string, any>) =>
      pending.push(["update", ref, data, true]),
  });
  if (failNext === "fail") {
    failNext = "";
    bump();
    throw new Error("합성 네트워크 실패 — 저장되지 않음");
  }
  for (const [, ref, data, merge] of pending) {
    guard(ref.path);
    write(ref.path, data, merge);
  }
  if (pending.length) writes++;
  bump();
  if (failNext === "lost") {
    failNext = "";
    bump();
    throw new Error("합성 응답 유실 — 실제로는 저장됨");
  }
  return result;
};

// 다른 기기에서 이번 달 첫 편집 가능 거래의 메모를 고친 상황을 만든다.
export function externalEdit() {
  const now = new Date();
  const path = `users/demo/records/2026-${String(now.getMonth() + 1).padStart(2, "0")}-01_household`;
  const data = store.get(path);
  if (!data) return;
  const entries = JSON.parse(data.household_entries);
  const index = entries.findIndex((entry: any) => entry.id);
  entries[index] = { ...entries[index], memo: `${entries[index].memo || ""} (다른 기기에서 수정)`.trim() };
  store.set(path, { ...data, household_entries: JSON.stringify(entries) });
  writes++;
  bump();
}

export const firestoreService = {
  getRecords: async (uid: string) => {
    const requested = scenario;
    await delay(requested === "slow" ? 1800 : 80);
    if (requested === "error") throw new Error("합성 조회 실패");
    return [...store]
      .filter(([path]) => path.startsWith(`users/${uid}/records/`))
      .map(([path, data]) => ({ id: path.split("/").pop(), ...clone(data) }))
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
  },
  saveHouseholdRecord: (uid: string, entries: any[], decisions: any) =>
    saveHouseholdEntries(db as any, uid, entries, decisions),
};
