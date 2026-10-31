# PR #289 보완 검증

대상 HEAD d15502935a04e8a7fac390b9200cd57a6a41b0f3, 기준 main 79c219c853b9b965678b78412116a4b1703c70e8.

이전 검토 원문은 ../2026-10-22-pr289-independent-review-1/reviewer-result.md. 판정은 ‘수정 후 승인’(1회), 멈춤 조건 해당 없음.

반영 사항:
1. SayuPage 인쇄의 4장 이상 전체 map 그리드 추가, 기존 1~3장 배치 보존.
2. MergeViewerPage 화면·인쇄의 4장 이상 전체 map 그리드 추가, 기존 1~3장 배치 보존. 인쇄 이미지 높이는 120px 이내.
3. recordPhotoLayouts.test.mjs가 실제 세 페이지 렌더러 코드를 JSX로 실행하여 0/1/2/3/4/5/10장 src 배열이 순서대로 정확히 한 번씩 렌더링되는지 확인(21건).
4. 이전 validation.md는 원문 보존. 그 문서의 실제 브라우저 검증은 FormatModal·SayuModal로 한정되어 인쇄·합본·EPUB 경로는 미검증이었음. 이번 보완은 합본 화면·인쇄/나의 기록 인쇄를 서버 렌더링 테스트로 확인했으며 실제 인쇄 대화상자/PDF 파일/프린터 출력과 EPUB, 실기기 운영 Firestore·Storage E2E는 여전히 미검증이다.

frontend 명령: `node --import tsx --test test/recordPhotoLayouts.test.mjs test/formatPhotoUploadResult.test.mjs test/sayuPhotoUpload.test.mjs test/recordPhotoUploadCore.test.mjs test/recordPhotoPolicy.test.mjs test/recordPhotoCompression.test.mjs test/selectedRecordPhoto.test.mjs test/photoSelectionRoutes.test.mjs`
80건 성공·0실패. /private/tmp/haru-pr289-tests-2.log
`npm run build` 성공(합성 공개 시험 Firebase 환경값), /private/tmp/haru-pr289-build-2.log. 빌드 도중 인쇄 이미지 maxHeight:120 스타일 속성을 추가했으며 최종 SHA의 CI에서 다시 전체 빌드를 확인한다. git diff --check 성공.

사용자는 PR #289 검토·CI 확인 후 문제없으면 병합·배포까지 진행하라고 명시적으로 승인했다. 실제 휴대폰 운영 E2E 완료 판정은 별도이다. Functions·Rules·저장 경로·결제·인증 변경 없음.
