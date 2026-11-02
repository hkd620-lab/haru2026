# 추천안 후속 구현 — 주식 사진 월간 한도

- 기준 HEAD: `cd57b92a11aa503d5b1bcb27e3d043267dd47ebd`, PR #323
- 구현·검증: Codex. CC OAuth 로그인 만료 후 허대표님이 본 대화에서 **“이번 보완은 Codex가 직접 구현·검증”**을 선택해 실행 담당을 승인했다. CC 구현으로 표시하지 않는다.
- 허대표님은 앞서 추천안(주식 OCR 월한도 후 공개, 기존 통계 범위 유지, 검증 후 화면 반영, 서버 제거 별도)에 동의했다.
- 기존 성공 검증과 1·2차 독립 검토 기록은 보존한다. 이번 source 변경은 그 HEAD의 승인에 포함되지 않으므로 재검토 대상이다.

## 구현

- 무료20/베이직100/프리미엄300/개발자300장으로 기존 OCR 요금제 기준을 재사용한다. 한도 숫자는 Codex가 기존 독서 OCR 기준으로 구체화해 사용자에게 알렸다.
- 서버 `extractStockTradeTextFromPhoto`는 입력 검증 뒤 실제 AI 호출 전에 transaction으로 예약한다. 실패 시 예약했던 월의 주식 카운터를 복원한다.
- `users/{uid}/monthlyAiUsage/{YYYY-MM}`의 `byFeature.stock_ocr`만 사용한다. `book_ocr`·일반 AI `usedCount`는 영향 없다. 클라이언트가 plan·사용량을 정하지 못한다.
- auth, 속도 제한(5회/30초), 7MB 제한, 모델, 기존 text/trade 응답을 유지한다. 응답에 자신의 quota 상태만 추가한다. 새로운 callable export는 없다.
- 화면 안내와 두 사진 처리 경로의 월한도 초과 시 배치 중단을 추가한다. 직접 입력·저장에는 이 제한이 없다.
- 독서·일반 AI quota 코드, 주식 통계/합본/EPUB 범위, 저장 식별자, Rules·리전·결제·인증 정책은 변경하지 않는다.

## 검증 결과

| 검증 | 명령/범위 | 결과 |
|---|---|---|
| Functions 빌드 | `npm run build` | 통과 |
| 한도·handler 검증 | `node --test test/stockOcrQuota.test.js test/monthlyOcrQuota.policy.test.js` | 9/9 |
| 공용 기능 회귀 | aiGateway, generateTts, devConsoleCleanup.policy, monthlyAiQuota.policy | 26/26 |
| 화면·진입·초안 | stockOcrQuota, devConsoleCleanup, writeBeforeFormat | 21/21 |
| 실제 SDK 저장·재읽기·수정·권한 | frontend devConsoleRecordSave.emulator.test.mjs | 6/6 |
| 실제 Firestore 마지막 한도 동시 예약·복원 | functions stockOcrQuota.emulator.test.js | 1/1 |
| 프론트 빌드 | 최종 코드, main lock 일치 의존성, 프로세스 검증용 Firebase 값 | Vite8.3.5 exit0, 30.64초 |

로컬 에뮬레이터는 `demo-haru-dev-console`, `127.0.0.1:18879`, 저장소의 기존 firestore.rules를 사용했다. 운영 프로젝트 연결이나 실제 사용자 기록 변경은 없었다. 저장 검증은 실제 firestoreService를 번들링하고 Firebase 초기화만 로컬 SDK로 연결했다. 사용 로그 callable은 auth=null로 호출하지 않았다.

핵심 검증: 각 플랜 마지막1장/초과AI미호출, 병렬 요청의 한도 보장, book/general 카운터 격리, 공급자 실패·월경계 복원, 미인증·입력 검증, 화면의 초과 후 나머지 요청 중단, 세 형식 초안과 실제 기록 저장·재열기, 기존 주식 식별자 및 다른 형식 필드 보존, 타 사용자 조회 거부, 사용자의 quota 직접 초기화 거부.

## 운영 반영 조건

- PR 최신 HEAD CI·Codex 재검토가 필요하다. 이전 리뷰는 새 코드를 승인한 것이 아니다.
- 독립 Claude 검토는 인증 복구 여부를 확인해 시도한다. 실패하면 승인으로 간주하지 않는다.
- 로컬 SDK/Rules 검증은 실제 계정·실기기 화면 E2E를 대체하지 않는다. 일반 계정에서 세 형식 작성→저장→SAYU→재열기를 확인해야 한다.
- 배포할 경우 월간 제한 함수 `extractStockTradeTextFromPhoto`를 `haru2026-8abb8`, `asia-northeast3`에 먼저 선택 배포해 제한 없이 화면이 공개되는 시간차를 피해야 한다. main 병합에 따른 Hosting 자동 배포와 구분한다.
- 운영 전용 함수14개 삭제, Drive/OneDrive 토큰 폐기, 기존 사용자 데이터 삭제는 계속 별도 승인 작업이며 이번에 수행하지 않는다.
- 모델·새 환경변수·Rules·가격 변경 없음. 일반 기록 경로 유지. 롤백은 후속 구현 커밋 revert 및 해당 단일 함수/Hosting의 검증된 버전 재반영이며 자동 실행하지 않는다.

## 저장

소스·필수 테스트·검토 근거는 내부의 정상 개발 worktree와 Git에 유지한다. 일반 내보내기 산출물은 생성하지 않았다. emulator 실행에 필요한 임시 로그/설정은 `/private/tmp/haru-dev-console-emulator-run`에만 있다. 코드에 비밀/실제 개인정보/금융 사진을 추가하지 않았다.
