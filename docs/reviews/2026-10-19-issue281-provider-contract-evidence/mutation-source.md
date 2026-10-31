# 메모리 변이 실행기 원문

실행 명령: `HARU_PROVIDER_MUTANT=<variant> node --require /private/tmp/haru-issue281-test-evidence-20261019/mutants.cjs test/loginProviderStorage.policy.test.cjs`

앱 파일에 쓰지 않고 readFileSync의 반환 문자열에만 한 조건씩 적용했다. 최초 setter 진단은 `currentUser?.uid === uid` 앵커가 여러 곳이라 실행기에서 중단됐다. 이를 회귀 검출로 세지 않고, `setUser((currentUser) => currentUser?.uid === uid`라는 유일 앵커로 좁혀 다시 실행했다. 초기 오류 로그와 최종 실패 로그를 함께 보존한다.

```javascript
const fs = require('node:fs');
const read = fs.readFileSync;
const variants = {
  uid: ['AuthContext.tsx', 'const loginProvider = readRememberedLoginProvider(uid)', 'const loginProvider = readRememberedLoginProvider(user.uid)'],
  priority: ['AuthContext.tsx', 'readRememberedLoginProvider(uid) ?? normalizeLoginProvider(data?.loginProvider)', 'normalizeLoginProvider(data?.loginProvider) ?? readRememberedLoginProvider(uid)'],
  fallback: ['AuthContext.tsx', 'readRememberedLoginProvider(uid) ?? normalizeLoginProvider(data?.loginProvider)', 'readRememberedLoginProvider(uid)'],
  primary: ['AuthContext.tsx', "normalizedPrimaryProvider ?? rememberedProvider", 'rememberedProvider ?? normalizedPrimaryProvider'],
  uidGuard: ['AuthContext.tsx', 'auth.currentUser?.uid === uid', 'true'],
  generation: ['AuthContext.tsx', 'generationRef.current === generation', 'true'],
  cleanup: ['AuthContext.tsx', 'active = false;\n      window.clearTimeout(timeout);', '/* cleanup inactive removed */\n      window.clearTimeout(timeout);'],
  cache: ['AuthContext.tsx', ' || snap.metadata.fromCache', ''],
  pending: ['AuthContext.tsx', ' || snap.metadata.hasPendingWrites', ''],
  setter: ['AuthContext.tsx', 'setUser((currentUser) => currentUser?.uid === uid', 'setUser((currentUser) => true'],
  trim: ['loginProvider.ts', 'value.trim().toLowerCase()', 'value.toLowerCase()'],
  lowercase: ['loginProvider.ts', 'value.trim().toLowerCase()', 'value.trim()'],
};
const [suffix, before, after] = variants[process.env.HARU_PROVIDER_MUTANT];
fs.readFileSync = function(file,...args) {
  const result = read.call(this,file,...args);
  if (!String(file).endsWith('/'+suffix)) return result;
  if (typeof result !== 'string' || result.split(before).length!==2) throw Error('nonunique mutation anchor');
  return result.replace(before,after); // Source return value only. No disk writes.
};
```
