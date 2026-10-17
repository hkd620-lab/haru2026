# 사진 입력 전체 경로 검증 기록

대상 HEAD d536cfba42660feb5e8fa20be0b2c079c1aa6430
프론트 코드 변경이며 Functions/Rules/모바일 변경 없음.

frontend 작업 디렉터리에서 실행:
```
node --import tsx --test test/sayuPhotoUpload.test.mjs test/photoSelectionRoutes.test.mjs test/formatPhotoUploadResult.test.mjs test/selectedRecordPhoto.test.mjs test/recordPhotoCompression.test.mjs test/plantDetectivePhotoEdit.test.mjs test/sayuGrowthTimeline.test.mjs test/haruLawAttachmentCleanup.test.mjs test/haruLawError.test.mjs test/readingAi.test.mjs
node --import tsx test/recordPhotoUploadCore.test.mjs
node test/recordPhotoPolicy.test.mjs
npm run build
```
루트에서 git diff --check 통과. 위 모든 명령 exit 0.
빌드는 명시적 demo-haru Firebase 환경값을 전달해 실행했고 이 로컬 산출물은 배포하지 않는다. 빌드의 기존 큰 청크/dynamic import 경고는 남음.

저장 트랜잭션: record photo upload transaction behavior tests passed
정책: record photo policy checks passed

CI d536cfba: build_and_preview 및 Deploy Preview SUCCESS
https://github.com/hkd620-lab/haru2026/actions/runs/38991212207/job/117273792097
https://github.com/hkd620-lab/haru2026/runs/117274186279

실기기: adb devices에 연결된 기기가 없음. S21 실패라는 허대표님 답변은 확인했다. 실제 iPhone/S21 업로드·저장 재열기·소요시간은 미확인이며 운영 완료로 판정하지 않는다.

## 빌드 완료 로그
✓ built in 1m 1s

## 실행 테스트 원문

```text
✔ all unreadable photos retain the failure reason and never report zero-photo success; retry works (29.255417ms)
✔ an upload failure does not discard another successfully uploaded photo (4.49325ms)
✔ successful uploads preserve the notice about excluded extra selections (4.40025ms)
✔ Android HEIC NotReadableError identifies the source-file read failure before calling the server (1.52725ms)
✔ oversized or invalid selections are counted as failures rather than zero-photo success (39.765208ms)
✔ the handler snapshots the picker before size/EXIF access and reads the original only once (15.052208ms)
✔ processed photo promises are removed from the queue (4.157209ms)
✔ period ledger photos update the selected entry and preserve its existing photo metadata (3.531625ms)
✔ unsupported local HEIC falls back to server conversion before uploading and keeps original metadata (8.195417ms)
하루LAW 첨부 정리 19개 시나리오 통과
✔ test/haruLawAttachmentCleanup.test.mjs (363.088167ms)
haruLAW frontend error mapping tests passed
✔ test/haruLawError.test.mjs (335.805583ms)
✔ handleBookTextOcrUpload captures before clearing and deferred OCR (147.390208ms)
✔ handleStockOcrPhotoSelect captures before clearing and deferred OCR (13.070125ms)
✔ handleLedgerOcrPhotoSelect captures before clearing and deferred OCR (5.714291ms)
✔ handleHouseholdOcrPhotoSelect captures before clearing and deferred OCR (11.092ms)
✔ LAW photos read immediately while PDF identity is preserved (3.466166ms)
✔ batch selection retains readable photos alongside failed photos (1.656875ms)
✔ handleBookTextOcrUpload ignores a slower earlier selection (5.853083ms)
✔ handleStockOcrPhotoSelect ignores a slower earlier selection (5.955542ms)
✔ handleLedgerOcrPhotoSelect ignores a slower earlier selection (4.827875ms)
✔ handleBookTextOcrUpload ignores pending reads after context is invalidated (4.834084ms)
✔ handleStockOcrPhotoSelect ignores pending reads after context is invalidated (4.265625ms)
✔ handleLedgerOcrPhotoSelect ignores pending reads after context is invalidated (3.690042ms)
✔ handleHouseholdOcrPhotoSelect ignores pending reads after context is invalidated (4.594416ms)
✔ upload locks editing and overlapping photo writes immediately; completion remains editable (34.763ms)
✔ editing stays locked through reanalysis after the photo has been persisted (6.138875ms)
✔ photo removal blocks editing while its write is pending and updates the snapshot on success (5.685416ms)
✔ failed final save retains the first persisted photo snapshot without unsaved AI mutations (3.899208ms)
✔ failed reanalysis keeps the persisted photo and leaves a matching editable snapshot (3.537ms)
✔ failed first photo save releases the lock and preserves the previous snapshot (3.793458ms)
✔ failed photo removal preserves the snapshot and releases the lock (9.75125ms)
✔ a photo operation starting during digest calculation prevents late navigation (1.589833ms)
✔ only chosen answers and their actual user questions become reference material (6.819958ms)
✔ old records without the field remain readable and cross-book reference is rejected (1.663042ms)
✔ switching books drops old completion flags, OCR and AI fields while preserving unrelated formats (1.885875ms)
✔ reapplying a selection does not duplicate user questions (0.249292ms)
✔ long conversation stays bounded and preserves the latest follow-up pair (0.530708ms)
✔ long local sessions drop invisible selections so new answers remain selectable (0.391167ms)
✔ prior notes favor recent user journals and final snapshot includes new sessions (0.553042ms)
✔ stable book IDs and original canonical/legacy meta remain compatible (1.255375ms)
✔ close/refresh recovery retains text without photos, and account/book chats stay isolated (1.105292ms)
✔ expired drafts are purged and unavailable storage reports failure (0.9155ms)
✔ monthly quota, login and network errors are understandable and retain drafts (0.589ms)
✔ a locally decoded HEIC uploads the local JPEG without a conversion request (3.54775ms)
✔ unsupported HEIC uses the existing server path exactly once and compresses the converted JPEG (4.019125ms)
✔ a non-HEIC compression failure never calls the HEIC server (1.497625ms)
✔ server conversion failure remains a failure without further retries (0.725958ms)
✔ 성장타임라인 판정·목록·날짜 클릭·상세 열기 출력이 이동 전 원본과 같다 (base) (238.442167ms)
✔ 성장타임라인 판정·목록·날짜 클릭·상세 열기 출력이 이동 전 원본과 같다 (noConsent) (40.885ms)
✔ 성장타임라인 판정·목록·날짜 클릭·상세 열기 출력이 이동 전 원본과 같다 (consentLoading) (31.067042ms)
✔ 성장타임라인 판정·목록·날짜 클릭·상세 열기 출력이 이동 전 원본과 같다 (notOwner) (26.49925ms)
✔ SayuPage 에 성장타임라인 정의가 남지 않고 어댑터 것을 쓴다 (13.827042ms)
✔ 목록 항목: 대표사진 미리보기·부제·열기 대상 (23.432833ms)
✔ 구조화 뷰 상세 열기: 소유자 → 기록 존재 → 동의 순서와 안내 문구 (74.247333ms)
✔ 경로 진입 동의 대기 대상은 이동 전 라벨 목록과 같다 (3.207208ms)
✔ 육아일기 측정 필드 제외 조건은 이동 전 조건과 같다 (0.518958ms)
✔ 경로 진입: 동의 로딩 중에는 성장기록·배뇨일지 진입을 멈추고, 다른 형식과 동의 확정 뒤에는 진행한다 (26.642292ms)
✔ 구조화 뷰 동의 판정은 영어일기만 면제한다(새 구조화 비서도 기본은 동의 필요) (1.241208ms)
✔ edit snapshots iphone.jpg once and commits old/new photos and EXIF (25.304958ms)
✔ edit snapshots android.heic once and commits old/new photos and EXIF (4.9845ms)
✔ edit HEIC failure falls back to server exactly once (4.028292ms)
✔ read failure uploads nothing and permits retry (3.167958ms)
✔ save failure rolls back only the new object without changing old photos (3.376167ms)
✔ starts all picker reads immediately without size, lastModified, slicing, or waiting for the first file (5.611708ms)
✔ one unreadable picker file does not reject another readable file (25.64225ms)
✔ preserves the exact 20MiB boundary and rejects oversized bytes before downstream upload (44.795125ms)
✔ does not read non-image selections (0.761334ms)
✔ EXIF-less photos do not acquire an upload date from the memory File lastModified (24.410583ms)
✔ cancels an oversized stream at the limit instead of reading the complete source (9.646042ms)
✔ normalizes extension-only iPhone/Android photo MIME without provider metadata (2.977875ms)
✔ limits a selection to 60MiB and cancels excess streams (34.210208ms)
✔ interleaved 16MiB files retain three successes after refunding the fourth (70.935166ms)
✔ read failures refund consumed bytes before slow cancellation finishes (37.686334ms)
✔ oversized files refund previously accepted chunks for later valid files (47.477166ms)
ℹ tests 74
ℹ suites 0
ℹ pass 74
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1129.070209

```

## 미리보기 산출물 실측

```json
{
  "preview": "https://haru2026-8abb8--pr277-codex-photo-all-entr-3q1metag.web.app",
  "scripts": [
    {
      "path": "/assets/index-DtR_HILi.js",
      "sha256": "b6346304290fe5fa736d525edf6464b1c674f286d17f0fc723d66ce5f57979ed",
      "bytes": 5757629
    },
    {
      "path": "/assets/index-legacy-CweLaLTM.js",
      "sha256": "e78701a53370bea924e82958fdbb400f461ce6357c6fba6913174ce11134436c",
      "bytes": 5859635
    }
  ]
}
```
