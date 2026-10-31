# PR #308 검증 근거 및 배포 전 확인

- 검토 대상 코드 HEAD: `b38797a5637fd9369b620cc6e0db4c184b6ac599`
- 기준 main: `d5301f7f7d7a12a8ffa90e61ebc837bbfe33f741`
- 코드 커밋: `4e5f29d1` 단건 날짜/ID 수정, `b38797a5` 모든 웹 EPUB 다운로드 사전 안내.
- Functions: `npm run build` 통과. `node --test test/epubSingleRecord.test.js test/epubContent.test.js` 14/14 통과. `functions/src/index.ts` export diff 없음.
- 프론트: `node --import tsx --test test/epubSingleRecord.test.mjs test/epubReaderGuide.test.mjs test/epubExportGuide.test.mjs` 9/9 통과.
- 프론트 `npm run build` 통과. 로컬은 테스트용 Firebase 값으로 컴파일했으며 해당 dist를 운영에 배포하지 않는다. 운영 웹은 main CI의 실제 환경값으로 빌드한다.
- 코드 HEAD CI: https://github.com/hkd620-lab/haru2026/actions/runs/40670477787 — build_and_preview 및 Deploy Preview SUCCESS.
- 로컬 브라우저: 실제 공통 안내 코드로 Android/iPhone 안내, 다운로드 진행·취소·Escape, 400×800·320×568 배치 확인.
- 독립 검토 1: '승인'. 저장소 밖 diff/로그를 읽지 못한 한계를 원문에 보존.
- CC 대체 검토 2: '승인', 배포 차단 지적 없음. diff·빌드 로그·테스트 로그·이전 원문을 모두 열어 확인했고 읽기 거부 없음.
- 비차단 권고: 구형 dialog 미지원 브라우저 대응, 서버 날짜 형식 검증, 기존 파일명 동시 생성 충돌, 설치 링크 접근성. 원문에 보존하며 이번 범위에서 임의 기능·저장 구조 변경을 추가하지 않는다.
- 코드 diff에는 App.tsx·라우터·홈화면·Rules·환경변수·결제·인증 정책 변경이 없다. Firestore `users/{uid}/records` 및 리전 `asia-northeast3` 유지.

## 배포 전 실측

- 함수: projects/haru2026-8abb8/locations/asia-northeast3/functions/exportEpub
- state ACTIVE / runtime nodejs22 / revision exportepub-00032-hom / allTrafficOnLatestRevision true
- updateTime: 2026-10-24T04:39:03.384746152Z
- Hosting live release: projects/haru2026-8abb8/sites/haru2026-8abb8/channels/live/releases/1793177685790000
- Hosting version: bce59454f6bba074, releaseTime 2026-10-28T08:54:45.790Z
- 순서: exportEpub만 선배포 → 실제 상태·리전 확인 → 승인된 PR 병합 → Hosting 자동배포 → 운영 단건 EPUB·사진·안내 확인.
- 운영 E2E 결과는 실행 후 새 기록에 남긴다. Android/iPhone 실기기 전자책 앱 열기는 별도 확인이 필요하다.

## 전체 코드 변경 경로

```
M frontend/src/app/components/EpubReaderNotice.tsx
M frontend/src/app/components/SayuModal.tsx
M frontend/src/app/pages/MergeViewerPage.tsx
M frontend/src/app/pages/RecordBookPage.tsx
M frontend/src/app/pages/SayuTogetherPage.tsx
A frontend/src/app/services/epubExportGuide.ts
M frontend/src/app/services/epubExportService.ts
M frontend/src/app/utils/epubReaderGuide.ts
A frontend/test/epubExportGuide.test.mjs
M frontend/test/epubReaderGuide.test.mjs
A frontend/test/epubSingleRecord.test.mjs
M functions/src/epubExport.ts
A functions/test/epubSingleRecord.test.js
```

검토 기록 전용 커밋 뒤에는 `git diff --name-status b38797a5..HEAD` 전체 결과가 모두 docs/reviews 아래 A인지 확인하며, 최종 HEAD CI도 확인한다.
