// 기존 사용자 상태를 합성하는 SDK fixture: 운영 DB 접근 없음.
export async function seedLocal(page, docs) {
 await page.evaluate(async docs=>{const sdk=await import('/sdk.ts');for(const [path,data] of docs)await sdk.setDoc(sdk.doc(sdk.db,...path.split('/')),data,{merge:true});},docs);
}
export const pause = page => page.waitForTimeout(500);
