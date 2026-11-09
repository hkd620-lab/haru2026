@codex review

검토 대상 HEAD: 1588d57a31204356a15099db135e2ad1d4962c4d (코드 변경 c6a753a6a85fc16aa28d92428989a315b2491ed9 + 문서 1588d57a). 이전 검토 6500eac858 이후 후속 1입니다.

검토해 주실 점:
- `registerDeviceForPush`: 권한 요청을 지원 확인(`isSupported`)보다 먼저 동기적으로 시작하는 순서(iOS 사용자 제스처)를 유지하면서, 시작 직후 거부 처리를 붙여 처리되지 않은 거부가 생기지 않는지. `requestPermission` 동기 예외 처리.
- 서버 `fcmTokens` 저장 성공 뒤 localStorage 캐시·`onRegistered` 실패를 `{ ok: true, warning }`로 구분하는 설계가 서버 등록 실패(`save`)와 섞이지 않는지, 오표시가 없는지.
- `SettingsPage` `handleRegisterThisDevice` → `runDeviceRegistration`: 예기치 못한 예외·거부 시 로딩 해제, 등록 완료 미표시, 예외 누수 없음.
- 회귀시험 `frontend/test/pushDeviceRejection.regression.test.mjs`.

근거: docs/reviews/2026-11-09-iphone-push/followup-1/INDEX.md. 저장소 전체 타입검사는 통과하지 않으며(기존 진단), 이번 변경의 신규 진단 0을 baseline 대조로 확인했습니다. 합성 env 빌드는 운영 배포 확인이 아니고, 운영 실수신은 후속 시험입니다.
