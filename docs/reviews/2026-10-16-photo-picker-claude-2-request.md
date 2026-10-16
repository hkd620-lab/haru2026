# 독립 Claude claude-2 요청 원문

- 대상 HEAD: 8a7ac2f87eb77ce6f75f9dd8d5fa3367249cafe9
- 요청: 별도 세션, Claude Code --print --tools 빈 문자열 --no-session-persistence
- 시작 시각: 별도 실측 기록 없음(추정하지 않음)

독립 재검토 2차 요청. PR https://github.com/hkd620-lab/haru2026/pull/275 대상 HEAD 8a7ac2f87eb77ce6f75f9dd8d5fa3367249cafe9 . 파일 수정/도구 사용 없이 제공된 저장소 근거를 검토하세요. 승인/수정 후 승인/재설계와 이유를 한국어로 답하세요. 작업 규모와 저장소 멈춤 조건 해당 여부도 검토하세요. 운영 배포 승인은 별도입니다.

이전 질문 원문:
독립 코드 검토 요청. 파일 수정과 도구 사용 없이 아래 저장소 diff만 검토하세요. PR https://github.com/hkd620-lab/haru2026/pull/275, 대상 HEAD 2acf20b2. Android Chrome 파일 선택 후 메타정보 선조회에 따른 ERR_UPLOAD_FILE_CHANGED 대응입니다. 정확성, 회귀, 메모리 위험, 누락된 테스트와 운영 판정 한계를 검토하고 승인/수정 후 승인/재설계 중 하나와 근거를 한국어로 답하세요. 검토가 처음이며 이전 검토 결과는 없습니다.

diff --git a/frontend/src/app/components/FormatModal.tsx b/frontend/src/app/components/FormatModal.tsx
index 9f759044..bbff158b 100644
--- a/frontend/src/app/components/FormatModal.tsx
+++ b/frontend/src/app/components/FormatModal.tsx
@@ -10,6 +10,7 @@ import { getFunctions, httpsCallable } from 'firebase/functions';
 import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, type StorageReference } from 'firebase/storage';
 import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
 import { compressImage } from '../services/imageService';
+import { startSelectedRecordPhotoReads } from '../services/selectedRecordPhoto';
 import { useAuth } from '../contexts/AuthContext';
 import { toast } from 'sonner';
 import heic2any from 'heic2any';
@@ -1863,19 +1864,27 @@ ${contentValues}`,
       ? toast.warning(`최대 ${maxPhotos}장까지 첨부할 수 있어 선택한 ${files.length}장 중 앞의 ${remainingSlots}장만 업로드합니다. 초과한 ${excludedCount}장은 제외됩니다.`)
       : undefined;
     const filesToUpload = Array.from(files).slice(0, remainingSlots);
+    const selectedPhotoReads = startSelectedRecordPhotoReads(filesToUpload);
 
     setIsUploading(true);
     try {
       const storage = getStorage();
       const newImageUrls: string[] = [];
       const newImageMeta: UploadedImageMeta[] = [];
+      const failures: string[] = [];
       const functionsInstance = getFunctions(undefined, 'asia-northeast3');
 
-      for (const file of filesToUpload) {
+      for (const photoRead of selectedPhotoReads) {
+        const selectedPhoto = await photoRead;
+        if (!selectedPhoto.ok) {
+          failures.push(selectedPhoto.message);
+          continue;
+        }
+        const { file, buffer } = selectedPhoto;
         let pendingStorageRef: StorageReference | null = null;
         let uploadTracked = false;
         if (file.size > 20 * 1024 * 1024) {
-          toast.warning(`${file.name}은 20MB를 초과하여 건너뜁니다.`);
+          failures.push('20MB를 초과한 사진이 있습니다.');
           continue;
         }
 
@@ -1883,7 +1892,7 @@ ${contentValues}`,
           file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
 
         if (!file.type.startsWith('image/') && !isHeic) {
-          toast.warning(`${file.name}은 이미지 파일이 아닙니다.`);
+          failures.push('이미지 형식으로 인식하지 못한 파일이 있습니다.');
           continue;
         }
 
@@ -1892,7 +1901,7 @@ ${contentValues}`,
         const fileName = `${timestamp}_${randomId}.jpg`;
 
         if (!user?.uid) {
-          toast.error('로그인이 필요합니다.');
+          failures.push('로그인이 필요합니다.');
           continue;
         }
 
@@ -1904,8 +1913,7 @@ ${contentValues}`,
           try {
             toast.info('HEIC 파일을 변환 중...');
 
-            const arrayBuffer = await file.arrayBuffer();
-            const bytes = new Uint8Array(arrayBuffer);
+            const bytes = new Uint8Array(buffer);
             let binary = '';
             const chunkSize = 8192;
             for (let i = 0; i < bytes.length; i += chunkSize) {
@@ -1918,7 +1926,9 @@ ${contentValues}`,
             fileToProcess = await decodeConvertedJpeg(result.data);
           } catch (err) {
             console.error('HEIC 변환 실패:', err);
-            toast.error('HEIC 변환에 실패했습니다.');
+            failures.push(err instanceof Error && err.name === 'NotReadableError'
+              ? '사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.'
+              : 'HEIC 변환에 실패했습니다.');
             continue;
           }
         }
@@ -1961,15 +1971,20 @@ ${contentValues}`,
             }
           }
           if (fileError?.message === 'FILE_READER_ERROR') {
-            toast.error(
-              '각종 클라우드에 있는 사진은 직접 업로드가 안 됩니다. 스마트폰에서 직접 업로드하거나 클라우드의 사진을 다운받은 후 추가해주세요.'
-            );
+            failures.push('사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.');
             continue;
           }
-          throw fileError;
+          console.error('사진 처리 실패:', fileError?.code || fileError?.name || 'unknown');
+          failures.push('사진 처리 또는 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
         }
       }
 
+      const failureDetails = [...new Set(failures)].join(' ');
+      if (newImageUrls.length === 0) {
+        toast.error(`사진을 업로드하지 못했습니다. ${failureDetails}`, { id: uploadNoticeId });
+        return;
+      }
+
       if (periodRow) {
         updateLedgerPeriodEntry(periodRow.id, {
           ...periodRow.entry,
@@ -1980,12 +1995,14 @@ ${contentValues}`,
         setUploadedImages(prev => [...prev, ...newImageUrls]);
         setUploadedImageMeta(prev => [...prev, ...newImageMeta]);
       }
-      toast.success(
-        excludedCount > 0
-          ? `${newImageUrls.length}장의 사진이 업로드되었습니다. 최대 ${maxPhotos}장 제한으로 초과한 ${excludedCount}장은 제외되었습니다.`
-          : `${newImageUrls.length}장의 사진이 업로드되었습니다!`,
-        { id: uploadNoticeId },
-      );
+      const uploadedMessage = excludedCount > 0
+        ? `${newImageUrls.length}장의 사진이 업로드되었습니다. 최대 ${maxPhotos}장 제한으로 초과한 ${excludedCount}장은 제외되었습니다.`
+        : `${newImageUrls.length}장의 사진이 업로드되었습니다!`;
+      if (failures.length > 0) {
+        toast.warning(`${uploadedMessage} ${failures.length}장은 실패했습니다. ${failureDetails}`, { id: uploadNoticeId });
+      } else {
+        toast.success(uploadedMessage, { id: uploadNoticeId });
+      }
     } catch (error) {
       console.error('이미지 업로드 실패:', error);
       toast.error('이미지 업로드에 실패했습니다.');
diff --git a/frontend/src/app/services/selectedRecordPhoto.ts b/frontend/src/app/services/selectedRecordPhoto.ts
new file mode 100644
index 00000000..f18936df
--- /dev/null
+++ b/frontend/src/app/services/selectedRecordPhoto.ts
@@ -0,0 +1,27 @@
+const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
+
+export type SelectedRecordPhoto =
+  | { ok: true; file: File; buffer: ArrayBuffer }
+  | { ok: false; message: string };
+
+// Start every read in the input change handler, before inspecting size/EXIF or
+// awaiting another file. Android picker metadata snapshots can otherwise cause
+// ERR_UPLOAD_FILE_CHANGED. Only memory-backed files reach downstream readers.
+export function startSelectedRecordPhotoReads(files: File[]): Promise<SelectedRecordPhoto>[] {
+  return files.map(async (source): Promise<SelectedRecordPhoto> => {
+    const isHeic = /image\/(heic|heif)/i.test(source.type) || /\.(heic|heif)$/i.test(source.name);
+    if (!source.type.startsWith('image/') && !isHeic) {
+      return { ok: false, message: '이미지 형식으로 인식하지 못한 파일이 있습니다.' };
+    }
+    try {
+      // Do not read source.size/source.lastModified or slice the source here.
+      const buffer = await source.arrayBuffer();
+      if (buffer.byteLength > MAX_PHOTO_BYTES) {
+        return { ok: false, message: '20MB를 초과한 사진이 있습니다.' };
+      }
+      return { ok: true, file: new File([buffer], source.name, { type: source.type }), buffer };
+    } catch {
+      return { ok: false, message: '사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.' };
+    }
+  });
+}
diff --git a/frontend/test/formatPhotoUploadResult.test.mjs b/frontend/test/formatPhotoUploadResult.test.mjs
new file mode 100644
index 00000000..43028045
--- /dev/null
+++ b/frontend/test/formatPhotoUploadResult.test.mjs
@@ -0,0 +1,106 @@
+import assert from 'node:assert/strict';
+import { readFileSync } from 'node:fs';
+import vm from 'node:vm';
+import { transform } from 'esbuild';
+import { test } from 'node:test';
+import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';
+
+const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
+const handler = source.slice(source.indexOf('  const handleImageUpload = async'), source.indexOf('  // Firebase Storage URL →'));
+const { code } = await transform(`${handler}\nglobalThis.runUpload = handleImageUpload;`, { loader: 'ts' });
+function fixture(outcomes) {
+  const notices = [], images = [], tracked = [], busy = [];
+  let attempt = 0;
+  const toast = Object.fromEntries(['warning', 'error', 'success', 'info'].map(level => [level, (...args) => notices.push({ level, message: args[0] })]));
+  const context = {
+    toast, console: { error() {} }, File, Date, Math, Error, Uint8Array, btoa, startSelectedRecordPhotoReads,
+    isCleaningSessionUploadsRef: { current: false }, ledgerInputMode: 'single',
+    uploadedImages: [], format: '일기', user: { uid: 'fixture' }, recordId: 'record', prefix: 'diary',
+    setIsUploading: value => busy.push(value), getStorage: () => ({}), getFunctions: () => ({}),
+    readOriginalImageMeta: async () => ({ metadataSource: 'none' }),
+    compressImage: async () => { const result = outcomes[attempt++]; if (result instanceof Error) throw result; return new Blob(['photo']); },
+    ref: (_, path) => ({ fullPath: path }), uploadBytes: async () => {}, getDownloadURL: async () => `fixture:${attempt}`,
+    sessionUploadedImageUrlsRef: { current: tracked }, isStockFormat: false,
+    setUploadedImages: update => images.push(...update([])), setUploadedImageMeta: () => {},
+    fileInputRef: { current: { value: 'selected' } }, deleteObject: async () => {}, enqueuePendingRecordPhotoCleanup: () => {},
+  };
+  vm.runInNewContext(code, context);
+  const run = async count => context.runUpload({ target: { files: Array.isArray(count) ? count : Array.from({ length: count }, () => new File(['photo'], 'fixture.jpg', { type: 'image/jpeg' })), value: 'selected' } });
+  return { run, notices, images, tracked, busy, context };
+}
+test('all unreadable photos retain the failure reason and never report zero-photo success; retry works', async () => {
+  const f = fixture([new Error('FILE_READER_ERROR'), 'ok']);
+  await f.run(1);
+  assert.equal(f.notices.at(-1).level, 'error');
+  assert.match(f.notices.at(-1).message, /원본/);
+  assert.equal(f.notices.some(n => n.level === 'success'), false);
+  assert.deepEqual(f.images, []);
+  assert.deepEqual(f.busy, [true, false]);
+  assert.equal(f.context.fileInputRef.current.value, '');
+  await f.run(1);
+  assert.equal(f.notices.at(-1).level, 'success');
+  assert.equal(f.images.length, 1);
+});
+test('an upload failure does not discard another successfully uploaded photo', async () => {
+  const f = fixture(['ok', new Error('network'), 'ok']);
+  await f.run(3);
+  assert.deepEqual(f.images, ['fixture:1', 'fixture:3']);
+  assert.deepEqual(f.tracked, f.images);
+  assert.equal(f.notices.at(-1).level, 'warning');
+  assert.match(f.notices.at(-1).message, /2장의 사진/);
+  assert.match(f.notices.at(-1).message, /1장은 실패/);
+});
+test('successful uploads preserve the notice about excluded extra selections', async () => {
+  const f = fixture(['ok', 'ok', 'ok']);
+  await f.run(5);
+  assert.equal(f.images.length, 3);
+  assert.equal(f.notices.at(-1).level, 'success');
+  assert.match(f.notices.at(-1).message, /초과한 2장/);
+});
+
+test('Android HEIC NotReadableError identifies the source-file read failure before calling the server', async () => {
+  const f = fixture([]);
+  const error = new Error('device provider unavailable'); error.name = 'NotReadableError';
+  let serverCalls = 0;
+  f.context.httpsCallable = () => { serverCalls++; throw new Error('must not call server'); };
+  await f.run([{ name: 'fixture.heic', type: 'image/heic', size: 100, arrayBuffer: async () => { throw error; } }]);
+  assert.equal(serverCalls, 0);
+  assert.equal(f.notices.at(-1).level, 'error');
+  assert.match(f.notices.at(-1).message, /원본을 읽지 못했습니다/);
+  assert.equal(f.notices.some(n => n.level === 'success'), false);
+});
+test('oversized or invalid selections are counted as failures rather than zero-photo success', async () => {
+  const f = fixture([]);
+  await f.run([{ name: 'large.jpg', type: 'image/jpeg', arrayBuffer: async () => new ArrayBuffer(21 * 1024 * 1024) }, { name: 'document.txt', type: 'text/plain', size: 10 }]);
+  assert.equal(f.notices.at(-1).level, 'error');
+  assert.match(f.notices.at(-1).message, /20MB/);
+  assert.match(f.notices.at(-1).message, /이미지 형식/);
+});
+
+test('the handler snapshots the picker before size/EXIF access and reuses the HEIC bytes', async () => {
+  const f = fixture(['ok']);
+  let reads = 0, conversionCalls = 0;
+  f.context.httpsCallable = () => async ({ imageBase64 }) => {
+    conversionCalls++;
+    assert.equal(imageBase64, btoa('fixture'));
+    return { data: 'jpeg' };
+  };
+  f.context.decodeConvertedJpeg = async () => new Blob(['jpeg'], { type: 'image/jpeg' });
+  f.context.readOriginalImageMeta = async file => {
+    assert.ok(file instanceof File);
+    assert.equal(file.name, 'fixture.heic');
+    assert.equal(await file.text(), 'fixture');
+    return { metadataSource: 'none' };
+  };
+  const source = {
+    name: 'fixture.heic', type: 'image/heic',
+    get size() { throw new Error('original metadata must never be read'); },
+    get lastModified() { throw new Error('original metadata must never be read'); },
+    arrayBuffer() { reads++; return Promise.resolve(new TextEncoder().encode('fixture').buffer); },
+  };
+  await f.run([source]);
+  assert.equal(reads, 1);
+  assert.equal(conversionCalls, 1);
+  assert.equal(f.notices.at(-1).level, 'success');
+  assert.equal(f.images.length, 1);
+});
diff --git a/frontend/test/selectedRecordPhoto.test.mjs b/frontend/test/selectedRecordPhoto.test.mjs
new file mode 100644
index 00000000..9c6a005a
--- /dev/null
+++ b/frontend/test/selectedRecordPhoto.test.mjs
@@ -0,0 +1,52 @@
+import assert from 'node:assert/strict';
+import { test } from 'node:test';
+import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';
+
+test('starts all picker reads immediately without size, lastModified, slicing, or waiting for the first file', async () => {
+  const started = [], finish = [];
+  const sources = [0, 1].map(index => ({
+    name: `fixture-${index}.heic`, type: index ? '' : 'image/heic',
+    get size() { throw new Error('picker metadata queried'); },
+    get lastModified() { throw new Error('picker metadata queried'); },
+    slice() { throw new Error('picker source sliced'); },
+    arrayBuffer() { started.push(index); return new Promise(resolve => finish.push(resolve)); },
+  }));
+  const reads = startSelectedRecordPhotoReads(sources);
+  assert.deepEqual(started, [0, 1]);
+  const bytes = new TextEncoder().encode('fixture');
+  finish.forEach(resolve => resolve(bytes.buffer));
+  for (const [index, result] of (await Promise.all(reads)).entries()) {
+    assert.equal(result.ok, true);
+    assert.equal(result.file.name, sources[index].name);
+    assert.deepEqual(new Uint8Array(result.buffer), bytes);
+    assert.equal(await result.file.text(), 'fixture');
+  }
+});
+
+test('one unreadable picker file does not reject another readable file', async () => {
+  const results = await Promise.all(startSelectedRecordPhotoReads([
+    { name: 'unreadable.jpg', type: 'image/jpeg', arrayBuffer() { throw new Error('NotReadableError'); } },
+    new File(['jpeg'], 'readable.jpg', { type: 'image/jpeg' }),
+  ]));
+  assert.equal(results[0].ok, false);
+  assert.match(results[0].message, /원본을 읽지 못했습니다/);
+  assert.equal(results[1].ok, true);
+});
+
+test('preserves the exact 20MiB boundary and rejects oversized bytes before downstream upload', async () => {
+  const [atLimit, oversized] = await Promise.all(startSelectedRecordPhotoReads([
+    new File([new Uint8Array(20 * 1024 * 1024)], 'limit.jpg', { type: 'image/jpeg' }),
+    new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }),
+  ]));
+  assert.equal(atLimit.ok, true);
+  assert.equal(oversized.ok, false);
+  assert.match(oversized.message, /20MB/);
+});
+
+test('does not read non-image selections', async () => {
+  const [result] = await Promise.all(startSelectedRecordPhotoReads([
+    { name: 'fixture.txt', type: 'text/plain', arrayBuffer() { throw new Error('must not read'); } },
+  ]));
+  assert.equal(result.ok, false);
+  assert.match(result.message, /이미지 형식/);
+});


이전 판정 원문(생략 없음):
# PR #275 검토 (HEAD 2acf20b2)

## 판정: 수정 후 승인

방향은 맞습니다. 파일을 선택한 직후 모든 원본 읽기를 동기적으로 시작하고, 이후 단계는 메모리에 복사한 `File`만 쓰는 방식은 ERR_UPLOAD_FILE_CHANGED 대응으로 타당합니다. 여러 장 중 일부가 실패해도 나머지를 살리는 처리와 "0장 성공" 오보를 없앤 처리도 개선입니다. 다만 아래 두 가지는 병합 전에 고쳐야 합니다. 첫째는 메모리 보유 구조이고, 둘째는 `lastModified` 소실이 촬영 시각 메타데이터에 주는 영향입니다.

---

## 1. 정확성

**맞는 부분**
- `files.map(async ...)`는 첫 `await` 전까지 동기적으로 실행됩니다. 그래서 모든 `source.arrayBuffer()` 호출이 변경 이벤트 핸들러 안에서 즉시 시작됩니다. 비이미지 파일은 읽지 않고 걸러지며, 이 동작은 테스트로 검증됩니다.
- 헬퍼의 promise는 reject되지 않고 항상 `{ok}` 형태로 resolve됩니다. 핸들러가 중간에 빠져나가도 unhandled rejection이 생기지 않습니다.
- 기존에는 `throw fileError` 때문에 루프 전체가 중단됐습니다. 이제는 파일 단위 `continue`로 바뀌어, 이미 성공한 업로드가 결과에 반영됩니다. 테스트에서 `tracked`와 `images`가 일치하는 것도 확인됩니다.
- 0장 성공일 때 `return`해도 `finally`가 실행되므로 `setIsUploading(false)`와 input 초기화가 유지됩니다. 테스트로 확인됩니다.

**확인·수정이 필요한 부분**
1. **`lastModified` 소실 (회귀 가능성 높음)**: `new File([buffer], name, { type })`로 만들면 `lastModified`가 생성 시각(현재 시각)이 됩니다. `readOriginalImageMeta`가 EXIF가 없을 때 `file.lastModified`를 촬영 시각으로 대신 쓴다면, EXIF 없는 사진과 HEIC→JPEG 변환본의 날짜가 업로드 시각으로 바뀝니다. 원본의 `lastModified`를 읽지 않는 것이 이번 설계의 전제이므로, 대체값 로직을 제거하거나 "메타데이터 없음"으로 명시하는 처리가 필요합니다. 해당 함수의 사용처를 꼭 확인하세요.
2. **헬퍼 호출 이전의 원본 접근 여부**: diff에는 `files.length`, `slice`만 보입니다. 하지만 `handleImageUpload`에서 `startSelectedRecordPhotoReads` 호출 전 구간이나 `onChange` 상위에서 `file.size`, `file.name`, 미리보기 `URL.createObjectURL` 같은 접근이 없는지 전체 핸들러를 확인해야 합니다. 같은 문제를 가진 다른 업로드 진입점(다른 기록 형식, 프로필, 가계부 등)은 이번 범위 밖이라 여전히 취약합니다.
3. **죽은 분기**: HEIC 변환 catch의 `NotReadableError` 분기는 이제 메모리 버퍼만 다루므로 사실상 실행될 일이 없습니다. 테스트 이름("Android HEIC NotReadableError ... before calling the server")도 실제로는 헬퍼의 catch를 검증합니다. 해롭지는 않지만, 분기를 제거하거나 주석으로 의도를 밝히는 편이 낫습니다.
4. **겹치는 검사**: 루프 안의 20MB 검사와 형식 검사는 헬퍼와 중복이고, 형식 판정 기준도 미묘하게 다릅니다(헬퍼는 type의 heic/heif 정규식, 모달은 확장자 위주). 지금은 결과가 같지만, 한쪽만 수정되면 어긋날 수 있습니다.
5. **토스트 잔존**: 바깥 `catch`의 `toast.error`에는 `{ id: uploadNoticeId }`가 없습니다. 그래서 장수 초과 경고 토스트가 오류 토스트와 함께 남습니다(경미).

## 2. 메모리 위험 (주요 수정 사항)

- **동시 전량 적재**: 선택한 모든 파일을 한꺼번에 `ArrayBuffer`로 읽습니다. 20MB를 넘는 파일도 **전부 읽은 뒤에야** 거절됩니다. size를 읽을 수 없다는 제약상 불가피하지만, 대형 파일이 섞이면 순간 메모리가 크게 튑니다.
- **이중 보유와 해제 불가**: 반환값에 `buffer`와 `new File([buffer])`가 함께 담깁니다. Blob 생성 시 데이터가 복사되므로 파일당 약 2배를 차지합니다. 게다가 `selectedPhotoReads` 배열이 resolve된 promise, 곧 버퍼를 핸들러가 끝날 때까지 참조합니다. 이미 처리한 사진의 버퍼도 GC되지 않습니다. 최대 장수 × 20MB × 2에 압축 캔버스와 HEIC base64 문자열(UTF-16 이진 문자열 포함 수 배)까지 더하면, 저사양 Android Chrome에서 탭 강제 종료(OOM)가 날 수 있습니다.
- **권장 수정**:
  - 헬퍼는 메모리 기반 `File`(Blob)만 반환하고 `buffer`는 반환하지 않습니다. Chrome은 Blob 데이터를 JS 힙 밖 blob 저장소로 옮길 수 있습니다.
  - HEIC 경로는 메모리 기반 `file.arrayBuffer()`를 다시 호출합니다. 원본이 아니므로 ERR_UPLOAD_FILE_CHANGED 위험이 없습니다.
  - 처리가 끝난 항목은 배열 슬롯을 `undefined`로 비워 참조를 끊습니다.
  - HEIC base64 변환은 `String.fromCharCode` 누적 대신 `FileReader.readAsDataURL`처럼 중간 문자열이 적은 방식을 검토합니다(선택 사항).

## 3. 테스트

**좋은 점**: 원본의 `size`·`lastModified`·`slice` 접근을 getter가 던지는 예외로 막아 검증하는 방식이 이번 수정의 핵심 불변식을 잘 고정합니다. 부분 실패, 재시도, 20MiB 경계 테스트도 적절합니다.

**한계와 누락**
- `formatPhotoUploadResult.test.mjs`는 소스 문자열을 마커(`const handleImageUpload = async`, `// Firebase Storage URL →`)로 잘라 `loader: 'ts'`로 vm에서 실행합니다. 리팩터링이나 JSX 유입에 매우 취약하고, 실패하면 원인이 테스트 인프라인지 코드인지 구분하기 어렵습니다. 장기적으로는 핸들러 로직을 순수 함수로 분리하길 권합니다.
- `.ts`를 직접 import하므로 CI의 Node 버전과 type stripping 플래그 설정을 확인해야 합니다.
- 누락된 테스트:
  - `periodRow`(가계부 기간 입력) 경로
  - `readOriginalImageMeta`에 넘어가는 `lastModified` 값(위 회귀 검증용)
  - 처리 완료 후 버퍼 참조 해제 여부(구조 수정 후 간접 검증)
  - 로그인 없음이 여러 장일 때 실패 메시지 개수
- Node의 `File`은 Chrome의 snapshot·content URI 동작을 재현하지 못합니다. 지금 테스트는 "원본 메타데이터를 건드리지 않는다"는 **설계 불변식**만 증명할 뿐, 실제 오류가 해소된다는 증명은 아닙니다.

## 4. 운영 판정의 한계

- 근본 원인 가설은 이렇습니다. Chrome이 content URI 파일의 snapshot(size/mtime)을 처음 접근할 때 확정하고, 이후 읽기에서 provider 값이 달라지면 오류가 납니다. 이 가설로 보면 이번 수정은 **실패 창을 줄이는 것이지 없애는 것이 아닙니다**. 클라우드 전용 항목처럼 provider가 읽는 도중 내용을 실체화하는 경우에는 여전히 실패할 수 있고, 이때는 "기기에 다운로드" 안내로 넘어갑니다.
- 병합 전후로 실기기 확인을 권장합니다: Google 포토(로컬/클라우드 전용), 삼성 갤러리, Drive 선택, HEIC, 여러 장 동시 선택, 저메모리 기기.
- 현재는 실패가 `console.error`로만 남아 현장 재발 여부를 판단할 수 없습니다. 실패 사유 범주(읽기 실패/용량/형식/업로드)별 카운트를 분석·로그로 수집하면 효과를 판정할 근거가 생깁니다. 개인정보가 포함되지 않도록 사유 코드만 남기세요.

## 요약

| 항목 | 판단 |
|---|---|
| 접근 방식(즉시 읽기 후 메모리 복사본 사용) | 타당 |
| 부분 실패 처리·알림 | 개선, 승인 |
| 메모리(버퍼 이중·전량 보유) | **수정 필요** |
| `lastModified` 소실의 메타데이터 영향 | **확인·수정 필요** |
| 테스트 | 불변식 검증은 양호, 취약한 구조와 일부 누락 |
| 운영 효과 | 실기기와 계측 없이는 판정 불가 |

→ **수정 후 승인**: 메모리 보유 구조를 고치고 `lastModified` 영향을 확인·보완하면 승인 가능합니다. 재설계까지는 필요 없습니다.


반영 내역:
- 원본 stream/getReader/read를 change 핸들러에서 즉시 시작하고, 크기·수정시각 선조회 없이 청크 읽기. 누적 20MiB 초과 시 cancel/release. 원본 전체 arrayBuffer 적재 제거.
- 반환은 메모리 File만 유지. 완료 Promise는 shift로 해제하고 HEIC는 메모리 File만 읽음.
- readOriginalImageMeta는 EXIF 날짜만 사용하고 lastModified fallback 없음. EXIF 없는 사진이 업로드 날짜를 얻지 않는 시험과 원문 함수 아래 제공.
- 기간 보조장부·읽기 큐 해제·초과 스트림 취소 시험 추가. 관련 시험 14건 및 기존 2종 통과, 시험용 Firebase 설정 빌드 통과.

현재 전체 diff:
diff --git a/frontend/src/app/components/FormatModal.tsx b/frontend/src/app/components/FormatModal.tsx
index 9f759044..0eb3ffc7 100644
--- a/frontend/src/app/components/FormatModal.tsx
+++ b/frontend/src/app/components/FormatModal.tsx
@@ -10,6 +10,7 @@ import { getFunctions, httpsCallable } from 'firebase/functions';
 import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, type StorageReference } from 'firebase/storage';
 import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
 import { compressImage } from '../services/imageService';
+import { startSelectedRecordPhotoReads } from '../services/selectedRecordPhoto';
 import { useAuth } from '../contexts/AuthContext';
 import { toast } from 'sonner';
 import heic2any from 'heic2any';
@@ -1863,19 +1864,27 @@ ${contentValues}`,
       ? toast.warning(`최대 ${maxPhotos}장까지 첨부할 수 있어 선택한 ${files.length}장 중 앞의 ${remainingSlots}장만 업로드합니다. 초과한 ${excludedCount}장은 제외됩니다.`)
       : undefined;
     const filesToUpload = Array.from(files).slice(0, remainingSlots);
+    const selectedPhotoReads = startSelectedRecordPhotoReads(filesToUpload);
 
     setIsUploading(true);
     try {
       const storage = getStorage();
       const newImageUrls: string[] = [];
       const newImageMeta: UploadedImageMeta[] = [];
+      const failures: string[] = [];
       const functionsInstance = getFunctions(undefined, 'asia-northeast3');
 
-      for (const file of filesToUpload) {
+      while (selectedPhotoReads.length > 0) {
+        const selectedPhoto = await selectedPhotoReads.shift()!;
+        if (!selectedPhoto.ok) {
+          failures.push(selectedPhoto.message);
+          continue;
+        }
+        const { file } = selectedPhoto;
         let pendingStorageRef: StorageReference | null = null;
         let uploadTracked = false;
         if (file.size > 20 * 1024 * 1024) {
-          toast.warning(`${file.name}은 20MB를 초과하여 건너뜁니다.`);
+          failures.push('20MB를 초과한 사진이 있습니다.');
           continue;
         }
 
@@ -1883,7 +1892,7 @@ ${contentValues}`,
           file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
 
         if (!file.type.startsWith('image/') && !isHeic) {
-          toast.warning(`${file.name}은 이미지 파일이 아닙니다.`);
+          failures.push('이미지 형식으로 인식하지 못한 파일이 있습니다.');
           continue;
         }
 
@@ -1892,7 +1901,7 @@ ${contentValues}`,
         const fileName = `${timestamp}_${randomId}.jpg`;
 
         if (!user?.uid) {
-          toast.error('로그인이 필요합니다.');
+          failures.push('로그인이 필요합니다.');
           continue;
         }
 
@@ -1904,8 +1913,7 @@ ${contentValues}`,
           try {
             toast.info('HEIC 파일을 변환 중...');
 
-            const arrayBuffer = await file.arrayBuffer();
-            const bytes = new Uint8Array(arrayBuffer);
+            const bytes = new Uint8Array(await file.arrayBuffer());
             let binary = '';
             const chunkSize = 8192;
             for (let i = 0; i < bytes.length; i += chunkSize) {
@@ -1918,7 +1926,9 @@ ${contentValues}`,
             fileToProcess = await decodeConvertedJpeg(result.data);
           } catch (err) {
             console.error('HEIC 변환 실패:', err);
-            toast.error('HEIC 변환에 실패했습니다.');
+            failures.push(err instanceof Error && err.name === 'NotReadableError'
+              ? '사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.'
+              : 'HEIC 변환에 실패했습니다.');
             continue;
           }
         }
@@ -1961,15 +1971,20 @@ ${contentValues}`,
             }
           }
           if (fileError?.message === 'FILE_READER_ERROR') {
-            toast.error(
-              '각종 클라우드에 있는 사진은 직접 업로드가 안 됩니다. 스마트폰에서 직접 업로드하거나 클라우드의 사진을 다운받은 후 추가해주세요.'
-            );
+            failures.push('사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.');
             continue;
           }
-          throw fileError;
+          console.error('사진 처리 실패:', fileError?.code || fileError?.name || 'unknown');
+          failures.push('사진 처리 또는 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
         }
       }
 
+      const failureDetails = [...new Set(failures)].join(' ');
+      if (newImageUrls.length === 0) {
+        toast.error(`사진을 업로드하지 못했습니다. ${failureDetails}`, { id: uploadNoticeId });
+        return;
+      }
+
       if (periodRow) {
         updateLedgerPeriodEntry(periodRow.id, {
           ...periodRow.entry,
@@ -1980,12 +1995,14 @@ ${contentValues}`,
         setUploadedImages(prev => [...prev, ...newImageUrls]);
         setUploadedImageMeta(prev => [...prev, ...newImageMeta]);
       }
-      toast.success(
-        excludedCount > 0
-          ? `${newImageUrls.length}장의 사진이 업로드되었습니다. 최대 ${maxPhotos}장 제한으로 초과한 ${excludedCount}장은 제외되었습니다.`
-          : `${newImageUrls.length}장의 사진이 업로드되었습니다!`,
-        { id: uploadNoticeId },
-      );
+      const uploadedMessage = excludedCount > 0
+        ? `${newImageUrls.length}장의 사진이 업로드되었습니다. 최대 ${maxPhotos}장 제한으로 초과한 ${excludedCount}장은 제외되었습니다.`
+        : `${newImageUrls.length}장의 사진이 업로드되었습니다!`;
+      if (failures.length > 0) {
+        toast.warning(`${uploadedMessage} ${failures.length}장은 실패했습니다. ${failureDetails}`, { id: uploadNoticeId });
+      } else {
+        toast.success(uploadedMessage, { id: uploadNoticeId });
+      }
     } catch (error) {
       console.error('이미지 업로드 실패:', error);
       toast.error('이미지 업로드에 실패했습니다.');
diff --git a/frontend/src/app/services/selectedRecordPhoto.ts b/frontend/src/app/services/selectedRecordPhoto.ts
new file mode 100644
index 00000000..ba37be88
--- /dev/null
+++ b/frontend/src/app/services/selectedRecordPhoto.ts
@@ -0,0 +1,40 @@
+const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
+
+export type SelectedRecordPhoto =
+  | { ok: true; file: File }
+  | { ok: false; message: string };
+
+// Start every stream read in the input change handler, before inspecting
+// size/EXIF or awaiting another file. Android picker metadata snapshots can
+// otherwise cause ERR_UPLOAD_FILE_CHANGED. Keep only bounded memory Files.
+export function startSelectedRecordPhotoReads(files: File[]): Promise<SelectedRecordPhoto>[] {
+  return files.map(async (source): Promise<SelectedRecordPhoto> => {
+    const isHeic = source.type === 'image/heic' || source.type === 'image/heif' || /\.(heic|heif)$/i.test(source.name);
+    if (!source.type.startsWith('image/') && !isHeic) {
+      return { ok: false, message: '이미지 형식으로 인식하지 못한 파일이 있습니다.' };
+    }
+    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
+    try {
+      // Do not query source.size/source.lastModified or slice the source.
+      reader = source.stream().getReader();
+      const chunks: BlobPart[] = [];
+      let totalBytes = 0;
+      while (true) {
+        const { done, value } = await reader.read();
+        if (done) break;
+        totalBytes += value.byteLength;
+        if (totalBytes > MAX_PHOTO_BYTES) {
+          await reader.cancel().catch(() => {});
+          return { ok: false, message: '20MB를 초과한 사진이 있습니다.' };
+        }
+        chunks.push(new Uint8Array(value));
+      }
+      return { ok: true, file: new File(chunks, source.name, { type: source.type }) };
+    } catch {
+      await reader?.cancel().catch(() => {});
+      return { ok: false, message: '사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.' };
+    } finally {
+      reader?.releaseLock();
+    }
+  });
+}
diff --git a/frontend/test/formatPhotoUploadResult.test.mjs b/frontend/test/formatPhotoUploadResult.test.mjs
new file mode 100644
index 00000000..37f3385c
--- /dev/null
+++ b/frontend/test/formatPhotoUploadResult.test.mjs
@@ -0,0 +1,134 @@
+import assert from 'node:assert/strict';
+import { readFileSync } from 'node:fs';
+import vm from 'node:vm';
+import { transform } from 'esbuild';
+import { test } from 'node:test';
+import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';
+
+const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
+const handler = source.slice(source.indexOf('  const handleImageUpload = async'), source.indexOf('  // Firebase Storage URL →'));
+const { code } = await transform(`${handler}\nglobalThis.runUpload = handleImageUpload;`, { loader: 'ts' });
+function fixture(outcomes) {
+  const notices = [], images = [], tracked = [], busy = [];
+  let attempt = 0;
+  const toast = Object.fromEntries(['warning', 'error', 'success', 'info'].map(level => [level, (...args) => notices.push({ level, message: args[0] })]));
+  const context = {
+    toast, console: { error() {} }, File, Date, Math, Error, Uint8Array, btoa, startSelectedRecordPhotoReads,
+    isCleaningSessionUploadsRef: { current: false }, ledgerInputMode: 'single',
+    uploadedImages: [], format: '일기', user: { uid: 'fixture' }, recordId: 'record', prefix: 'diary',
+    setIsUploading: value => busy.push(value), getStorage: () => ({}), getFunctions: () => ({}),
+    readOriginalImageMeta: async () => ({ metadataSource: 'none' }),
+    compressImage: async () => { const result = outcomes[attempt++]; if (result instanceof Error) throw result; return new Blob(['photo']); },
+    ref: (_, path) => ({ fullPath: path }), uploadBytes: async () => {}, getDownloadURL: async () => `fixture:${attempt}`,
+    sessionUploadedImageUrlsRef: { current: tracked }, isStockFormat: false,
+    setUploadedImages: update => images.push(...update([])), setUploadedImageMeta: () => {},
+    fileInputRef: { current: { value: 'selected' } }, deleteObject: async () => {}, enqueuePendingRecordPhotoCleanup: () => {},
+  };
+  vm.runInNewContext(code, context);
+  const run = async count => context.runUpload({ target: { files: Array.isArray(count) ? count : Array.from({ length: count }, () => new File(['photo'], 'fixture.jpg', { type: 'image/jpeg' })), value: 'selected' } });
+  return { run, notices, images, tracked, busy, context };
+}
+test('all unreadable photos retain the failure reason and never report zero-photo success; retry works', async () => {
+  const f = fixture([new Error('FILE_READER_ERROR'), 'ok']);
+  await f.run(1);
+  assert.equal(f.notices.at(-1).level, 'error');
+  assert.match(f.notices.at(-1).message, /원본/);
+  assert.equal(f.notices.some(n => n.level === 'success'), false);
+  assert.deepEqual(f.images, []);
+  assert.deepEqual(f.busy, [true, false]);
+  assert.equal(f.context.fileInputRef.current.value, '');
+  await f.run(1);
+  assert.equal(f.notices.at(-1).level, 'success');
+  assert.equal(f.images.length, 1);
+});
+test('an upload failure does not discard another successfully uploaded photo', async () => {
+  const f = fixture(['ok', new Error('network'), 'ok']);
+  await f.run(3);
+  assert.deepEqual(f.images, ['fixture:1', 'fixture:3']);
+  assert.deepEqual(f.tracked, f.images);
+  assert.equal(f.notices.at(-1).level, 'warning');
+  assert.match(f.notices.at(-1).message, /2장의 사진/);
+  assert.match(f.notices.at(-1).message, /1장은 실패/);
+});
+test('successful uploads preserve the notice about excluded extra selections', async () => {
+  const f = fixture(['ok', 'ok', 'ok']);
+  await f.run(5);
+  assert.equal(f.images.length, 3);
+  assert.equal(f.notices.at(-1).level, 'success');
+  assert.match(f.notices.at(-1).message, /초과한 2장/);
+});
+
+test('Android HEIC NotReadableError identifies the source-file read failure before calling the server', async () => {
+  const f = fixture([]);
+  const error = new Error('device provider unavailable'); error.name = 'NotReadableError';
+  let serverCalls = 0;
+  f.context.httpsCallable = () => { serverCalls++; throw new Error('must not call server'); };
+  await f.run([{ name: 'fixture.heic', type: 'image/heic', size: 100, stream: () => { throw error; } }]);
+  assert.equal(serverCalls, 0);
+  assert.equal(f.notices.at(-1).level, 'error');
+  assert.match(f.notices.at(-1).message, /원본을 읽지 못했습니다/);
+  assert.equal(f.notices.some(n => n.level === 'success'), false);
+});
+test('oversized or invalid selections are counted as failures rather than zero-photo success', async () => {
+  const f = fixture([]);
+  await f.run([new File([new Uint8Array(21 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' }), { name: 'document.txt', type: 'text/plain', size: 10 }]);
+  assert.equal(f.notices.at(-1).level, 'error');
+  assert.match(f.notices.at(-1).message, /20MB/);
+  assert.match(f.notices.at(-1).message, /이미지 형식/);
+});
+
+test('the handler snapshots the picker before size/EXIF access and reads the original only once', async () => {
+  const f = fixture(['ok']);
+  let reads = 0, conversionCalls = 0;
+  f.context.httpsCallable = () => async ({ imageBase64 }) => {
+    conversionCalls++;
+    assert.equal(imageBase64, btoa('fixture'));
+    return { data: 'jpeg' };
+  };
+  f.context.decodeConvertedJpeg = async () => new Blob(['jpeg'], { type: 'image/jpeg' });
+  f.context.readOriginalImageMeta = async file => {
+    assert.ok(file instanceof File);
+    assert.equal(file.name, 'fixture.heic');
+    assert.equal(await file.text(), 'fixture');
+    return { metadataSource: 'none' };
+  };
+  const source = {
+    name: 'fixture.heic', type: 'image/heic',
+    get size() { throw new Error('original metadata must never be read'); },
+    get lastModified() { throw new Error('original metadata must never be read'); },
+    stream() { reads++; return new Blob(['fixture']).stream(); },
+  };
+  await f.run([source]);
+  assert.equal(reads, 1);
+  assert.equal(conversionCalls, 1);
+  assert.equal(f.notices.at(-1).level, 'success');
+  assert.equal(f.images.length, 1);
+});
+
+test('processed photo promises are removed from the queue', async () => {
+  const f = fixture(['ok', 'ok', 'ok']);
+  let queue;
+  f.context.startSelectedRecordPhotoReads = files => {
+    queue = startSelectedRecordPhotoReads(files);
+    return queue;
+  };
+  await f.run(3);
+  assert.equal(queue.length, 0);
+  assert.equal(f.images.length, 3);
+});
+
+test('period ledger photos update the selected entry and preserve its existing photo metadata', async () => {
+  const f = fixture(['ok']);
+  let update;
+  Object.assign(f.context, {
+    ledgerInputMode: 'period', format: 'HARU보조장부', expandedLedgerXlsxRowId: 'row',
+    ledgerXlsxPreviewRows: [{ id: 'row', entry: { imageUrls: ['existing'], imageMeta: [{ url: 'existing' }] } }],
+    updateLedgerPeriodEntry: (id, entry) => { update = { id, entry }; },
+  });
+  await f.run(1);
+  assert.equal(update.id, 'row');
+  assert.deepEqual(Array.from(update.entry.imageUrls), ['existing', 'fixture:1']);
+  assert.equal(update.entry.imageMeta.length, 2);
+  assert.equal(update.entry.imageMeta[0].url, 'existing');
+  assert.equal(f.images.length, 0);
+});
diff --git a/frontend/test/selectedRecordPhoto.test.mjs b/frontend/test/selectedRecordPhoto.test.mjs
new file mode 100644
index 00000000..e60e18ab
--- /dev/null
+++ b/frontend/test/selectedRecordPhoto.test.mjs
@@ -0,0 +1,103 @@
+import assert from 'node:assert/strict';
+import { test } from 'node:test';
+import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';
+import { readFileSync } from 'node:fs';
+import vm from 'node:vm';
+import { transform } from 'esbuild';
+
+test('starts all picker reads immediately without size, lastModified, slicing, or waiting for the first file', async () => {
+  const started = [], finish = [];
+  const sources = [0, 1].map(index => ({
+    name: `fixture-${index}.heic`, type: index ? '' : 'image/heic',
+    get size() { throw new Error('picker metadata queried'); },
+    get lastModified() { throw new Error('picker metadata queried'); },
+    slice() { throw new Error('picker source sliced'); },
+    stream() {
+      let consumed = false;
+      return { getReader: () => ({
+        read() {
+          if (consumed) return Promise.resolve({ done: true });
+          consumed = true; started.push(index);
+          return new Promise(resolve => finish.push(bytes => resolve({ done: false, value: new Uint8Array(bytes) })));
+        },
+        cancel: async () => {}, releaseLock() {},
+      }) };
+    },
+  }));
+  const reads = startSelectedRecordPhotoReads(sources);
+  assert.deepEqual(started, [0, 1]);
+  const bytes = new TextEncoder().encode('fixture');
+  finish.forEach(resolve => resolve(bytes.buffer));
+  for (const [index, result] of (await Promise.all(reads)).entries()) {
+    assert.equal(result.ok, true);
+    assert.equal(result.file.name, sources[index].name);
+    assert.equal('buffer' in result, false, 'do not retain both a raw buffer and a memory File');
+    assert.deepEqual(new Uint8Array(await result.file.arrayBuffer()), bytes);
+    assert.equal(await result.file.text(), 'fixture');
+  }
+});
+
+test('one unreadable picker file does not reject another readable file', async () => {
+  const results = await Promise.all(startSelectedRecordPhotoReads([
+    { name: 'unreadable.jpg', type: 'image/jpeg', stream() { throw new Error('NotReadableError'); } },
+    new File(['jpeg'], 'readable.jpg', { type: 'image/jpeg' }),
+  ]));
+  assert.equal(results[0].ok, false);
+  assert.match(results[0].message, /원본을 읽지 못했습니다/);
+  assert.equal(results[1].ok, true);
+});
+
+test('preserves the exact 20MiB boundary and rejects oversized bytes before downstream upload', async () => {
+  const [atLimit, oversized] = await Promise.all(startSelectedRecordPhotoReads([
+    new File([new Uint8Array(20 * 1024 * 1024)], 'limit.jpg', { type: 'image/jpeg' }),
+    new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }),
+  ]));
+  assert.equal(atLimit.ok, true);
+  assert.equal(oversized.ok, false);
+  assert.match(oversized.message, /20MB/);
+});
+
+test('does not read non-image selections', async () => {
+  const [result] = await Promise.all(startSelectedRecordPhotoReads([
+    { name: 'fixture.txt', type: 'text/plain', arrayBuffer() { throw new Error('must not read'); } },
+  ]));
+  assert.equal(result.ok, false);
+  assert.match(result.message, /이미지 형식/);
+});
+
+test('EXIF-less photos do not acquire an upload date from the memory File lastModified', async () => {
+  const source = new File(['no-exif'], 'fixture.jpg', { type: 'image/jpeg', lastModified: 0 });
+  const [snapshot] = await Promise.all(startSelectedRecordPhotoReads([source]));
+  assert.equal(snapshot.ok, true);
+  // Exercise the production metadata mapping with a parser that found no EXIF.
+  // exifr's browser namespace import is not directly compatible with Node ESM.
+  const metadataSource = readFileSync(new URL('../src/app/services/photoMetadataService.ts', import.meta.url), 'utf8');
+  const { code } = await transform(metadataSource.replace("import * as exifr from 'exifr';", ''), { loader: 'ts', format: 'cjs' });
+  const context = { module: { exports: {} }, exifr: { parse: async file => {
+    assert.equal(await file.text(), 'no-exif');
+    return {};
+  } } };
+  vm.runInNewContext(code, context);
+  const metadata = await context.module.exports.readOriginalImageMeta(snapshot.file);
+  assert.equal(metadata.originalName, source.name);
+  assert.equal(metadata.metadataSource, 'none');
+  assert.equal(metadata.takenAt, undefined);
+  assert.equal(metadata.takenDate, undefined);
+});
+
+test('cancels an oversized stream at the limit instead of reading the complete source', async () => {
+  let pulls = 0, cancelled = false, released = false;
+  const reader = {
+    async read() { pulls++; return { done: false, value: new Uint8Array(1024 * 1024) }; },
+    async cancel() { cancelled = true; },
+    releaseLock() { released = true; },
+  };
+  const [result] = await Promise.all(startSelectedRecordPhotoReads([
+    { name: 'large.jpg', type: 'image/jpeg', stream: () => ({ getReader: () => reader }),
+      get size() { throw new Error('must not inspect provider metadata'); } },
+  ]));
+  assert.equal(result.ok, false);
+  assert.equal(pulls, 21);
+  assert.equal(cancelled, true);
+  assert.equal(released, true);
+});


현재 photoMetadataService.ts 원문:
import * as exifr from 'exifr';

export type UploadedImageMeta = {
  url: string;
  originalName: string;
  takenAt?: string;
  takenDate?: string;
  takenTime?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  metadataSource: 'exif' | 'none';
  uploadedAt: string;
};

function toLocalDateTimeParts(value: Date | string | number | undefined) {
  if (!value) return {};
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return {};
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return {
    takenAt: date.toISOString(),
    takenDate: `${yyyy}-${mm}-${dd}`,
    takenTime: `${hh}:${mi}:${ss}`,
  };
}

function formatGpsLabel(latitude?: number, longitude?: number) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return '';
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export async function readOriginalImageMeta(file: File): Promise<Omit<UploadedImageMeta, 'url' | 'uploadedAt'>> {
  try {
    const meta = await exifr.parse(file, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
    } as any);

    const dateValue = meta?.DateTimeOriginal || meta?.CreateDate || meta?.ModifyDate || meta?.DateCreated;
    const parts = toLocalDateTimeParts(dateValue);
    const latitude = typeof meta?.latitude === 'number' ? meta.latitude : undefined;
    const longitude = typeof meta?.longitude === 'number' ? meta.longitude : undefined;
    const locationName = [
      meta?.City,
      meta?.State,
      meta?.Country,
      meta?.Location,
      meta?.SubLocation,
      meta?.ContentLocationName,
    ].filter((v: any) => typeof v === 'string' && v.trim()).join(' ').trim();
    const gpsLabel = formatGpsLabel(latitude, longitude);

    return {
      originalName: file.name,
      ...parts,
      latitude,
      longitude,
      locationLabel: locationName || gpsLabel || undefined,
      metadataSource: parts.takenDate || gpsLabel ? 'exif' : 'none',
    };
  } catch (error) {
    console.warn('사진 EXIF 읽기 실패:', error);
    return {
      originalName: file.name,
      metadataSource: 'none',
    };
  }
}
