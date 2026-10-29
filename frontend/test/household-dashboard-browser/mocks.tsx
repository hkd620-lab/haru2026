import { useSyncExternalStore } from "react";
import { demoRecords } from "./fixtures";
let scenario = "normal";
let listener = () => {};
export function setScenario(value: string) {
  scenario = value;
  listener();
}
export const useAuth = () => {
  const value = useSyncExternalStore(
    (fn) => {
      listener = fn;
      return () => {};
    },
    () => scenario,
  );
  return {
    user:
      value === "signedout"
        ? null
        : { uid: value === "other" ? "other" : "demo" },
  };
};
export const db = {};
export const doc = (...args: unknown[]) => args;
export const getDoc = async (ref: unknown[]) => ({
  exists: () => ref.includes("demo"),
  data: () => ({ total: 1000000, categories: { 쇼핑: 20000 } }),
});
export let writes = 0;
let writeListener = () => {};
export const useWriteCount = () =>
  useSyncExternalStore(
    (fn) => {
      writeListener = fn;
      return () => {};
    },
    () => writes,
  );
export const setDoc = async () => {
  writes++;
  writeListener();
};
export const firestoreService = {
  getRecords: async (uid: string) => {
    const requested = scenario;
    await new Promise((resolve) =>
      setTimeout(resolve, requested === "slow" ? 1800 : 80),
    );
    if (requested === "error") throw new Error("합성 조회 실패");
    return requested === "empty" || uid === "other" ? [] : demoRecords;
  },
};
