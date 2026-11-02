# 빌드 직후 생성 코드와 통합시험 재대조

독립 검토자가 현재 추적 lib/index.js가 stale인 점을 발견했다. 첫 통합시험은 build→시험 exit 0→생성물의 기존 누적 차이 원복 순서로 진행했으므로 시험 성공과 모순되지 않지만, 생성 파일의 정합성을 다시 직접 확인하도록 재실행했다.

- 명령: `cd functions && npm run build && FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 GCLOUD_PROJECT=demo-haru-essay-images GOOGLE_CLOUD_PROJECT=demo-haru-essay-images node test/resultChat.integration.js`
- 결과: exit 0. 실제 Firestore 에뮬레이터, 합성 이미지 및 모의 Gemini.
- 실행 결과: Gemini39/legacy11/Files upload25 delete30/webSearch26/resultChatLog33. 느린 이미지·첫 모델·검색 재시도·네이티브 abort를 포함한 전체 시험 통과.
- 이 재실행 중 생성 lib를 원복하지 않고 독립 검토자에게 읽기 전용 대조를 요청했다. 검토자가 index.js 및 resultChatImages.js가 현재 TS의 transpile 결과와 바이트 단위로 일치함을 직접 확인했다.
- 시험에 사용한 생성 index.js SHA-256: `7372df7ef84a754ae50ee3fb440a969614ef227105fb5761a624036cae0754a4`
- 시험에 사용한 생성 resultChatImages.js SHA-256: `f8f426aa9f69ee710a2ad72583889c88e363259c38ab258c1ddd6d682d38eded`
- 독립 검토 종료 뒤 lib/index.js·lib/snsToDiary.js의 기존 누적 재생성 차이는 다시 원복하여 소스·시험·검토 근거만 커밋한다. 운영 배포 전에 predeploy build를 반드시 실행해야 한다.
- 운영 API·사용자 데이터 사용 없음. 기존 실제 Gemini 합성 이미지 인식 성공은 별도 real-image-smoke.json으로 유지하며 이번 재실행은 실제 모델 품질 시험이 아니다.
