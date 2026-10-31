# 독립 Claude 검토 1차 요청 원문

- 대상 HEAD: 2acf20b2447342bbf5827bebd06819b641cf434c
- 요청 실행: Claude Code 2.1.291, --print --tools 빈 문자열 --no-session-persistence
- 시작 시각: 별도 실측 기록 없음(추정하지 않음)

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
