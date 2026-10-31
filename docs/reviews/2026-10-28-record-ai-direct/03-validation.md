# 수정 후 검증

- 실행 명령: frontend에서 `node --import tsx --test test/formatPolishRequest.test.mjs test/formatPhotoUploadResult.test.mjs test/writeBeforeFormat.test.mjs test/recordPhotoUploadCore.test.mjs test/selectedRecordPhoto.test.mjs test/recordPhotoUploadDeadline.test.mjs test/originalSaveAutoTitle.test.mjs test/formatRegistry.test.mjs test/polishCommentOptOut.test.mjs`
- 결과: 85 pass / 0 fail. 실제 AI 결과 저장 handler의 사진·메타데이터·초안 ID 전달 검증 포함.
- `npm run build`: 로컬 Firebase 필수 환경값이 없어 qa-placeholder 등 합성 환경값을 지정해 컴파일 검증, exit 0. 운영 배포용 산출물이 아니다.
- `git diff --check`: 통과.
- 아래 로그는 비밀값·개인정보 없이 합성 데이터 테스트 결과만 담는다.
