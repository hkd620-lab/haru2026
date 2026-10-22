# FormatModal 미사용 AI 한마디 선택 생략 — 1차 수정·검증

**✅ 승인된 1차 수정과 로컬 검증 완료. PR·병합·배포·운영 E2E는 하지 않았다.**

## 목적과 범위

허대표님 요청: “FormatModal의 미사용 AI 한마디 선택 생략 1차 개선만 수정하고 검증해줘. 옵션 누락 시 기존 동작과 SayuModal의 한마디 생성·저장은 유지하고, 다른 항목 수정·PR·병합·배포는 아직 하지 마.”

기준 main은 `8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9`다. 원본 Developer 작업본 `codex-question-input-three-lines` / `9fa88ead`의 clean 상태를 보존하고 별도 작업본의 `codex-polish-comment-opt-out` 브랜치에서 진행했다. 원격에 `codex`라는 브랜치가 있어 하위 경로 이름과 충돌하므로 하이픈 이름을 사용했다.

[이전 소비처 감사](https://github.com/hkd620-lab/haru2026/blob/579e99a61f4c3b65f7ad09846f47f1a5456d97be/docs/reviews/2026-10-21-polish-output-consumption-audit.md)의 가장 작은 개선 범위만 반영했다. 제목 일괄 생성·배뇨일지는 기존 완료 상태를 유지한다.

## 실제 변경

| 파일 | 변경 |
| --- | --- |
| `functions/src/index.ts` | polishContent 요청의 `includeAiComment`를 읽고 **명시적 false에서만** 한마디 생성/해당 사용량 기록을 생략. `aiComment:''`를 포함한 기존 응답 키 유지 |
| `frontend/src/app/components/FormatModal.tsx` | 일반 다듬기·독서 마무리·중간 독서장 세 요청에 `includeAiComment:false` 추가 |
| `functions/test/polishContent.test.js` | 실제 callable/보조 함수 추출, AI·quota·로그 대역을 사용한 계약/실패/제한 회귀시험 |
| `frontend/test/polishCommentOptOut.test.mjs` | 실제 세 handler 실행, 미리보기/저장·기존 제목/한마디 보존 및 SayuModal 대조 시험 |
| 이 문서·`validation.json`·`exports.json` | 검증 근거와 인수인계 |

- 옵션 누락·true는 기존 한마디 생성을 유지한다. null/0/문자열 `'false'` 등도 boolean false와 혼동하지 않는다. 구형 요청에 새 타입 오류를 추가하지 않았다.
- false인 정상 지원 형식은 본문+통계 **3→2**, reading은 본문만 **2→1**의 논리 모델 진입을 확인했다. 통계 생성/저장 계약은 그대로다. 실제 SDK 전송·청구액·월 절감액을 측정한 결과는 아니다.
- 한마디의 기존 프롬프트·정리·50자 반환 처리·부분 실패 처리는 생성하는 경로에서 유지했다. 옵션 생략 시 body/stats/comment 순서도 유지한다.
- **SayuModal 소스는 수정하지 않았다.** 옵션을 보내지 않으므로 생성은 유지된다. 새 한마디를 저장/로컬 표시하고, 빈 값·누락·비문자열 응답에서는 기존 한마디와 stats를 보존하는 실제 handler 시험을 통과했다.
- FormatModal 저장 payload도 기존 한마디/사용자 제목을 유지한다. RecordPage의 문자열 저장 필터나 기존 객체 stats 유실은 이번에 바꾸지 않았다.
- 인증, 5,000자 검증, rate limit, 월 quota 예약/본문 실패 시 환원, 유료 이용 로그, 모델·프롬프트·통계, Firestore 경로·Functions 리전·결제/인증 정책·환경변수는 유지했다. 계측 개선·구독 중복 조회·잠금·캐시·강제 재생성·출력 상한·다른 항목은 수정하지 않았다.

## 검증

검증 환경은 Node `v26.8.2`, TypeScript `5.9.3`이다. Functions runtime 설정 `nodejs22`는 변경하지 않았다.

| 명령 / 확인 | 결과 |
| --- | --- |
| `cd functions && npm run build` | 통과 |
| `cd functions && node --test --test-reporter=tap test/polishContent.test.js test/aiGateway.test.js test/monthlyAiQuota.policy.test.js` | **32/32 통과**: 새 계약 17 + 기존 gateway 14 + quota policy 파일 1 |
| `cd frontend && node --import tsx --test --test-reporter=tap test/polishCommentOptOut.test.mjs test/readingAi.test.mjs test/voidingRecordTarget.test.mjs` | **36/36 통과**: 새 요청/저장 8 + 기존 독서 11 + 배뇨 안전/저장 17 |
| `cd frontend && npm run build` (CI와 같은 검증용 더미 Firebase 설정) | 환경 검증·웹/PWA 빌드 통과. chunk 크기 및 정적/동적 import 혼용 경고 있음. 이번에 경고 관련 코드는 수정하지 않음 |
| 수정 전/후 실제 Functions 빌드 export 목록 | **114→114**, 추가/삭제 없음 |
| 수정 전/후 실제 빌드 index.js 대조 | `polishContent` 전체 대입문 외 내용 일치. snsToDiary.js도 수정 전 빌드와 일치 |
| `git diff --check`·변경 경로 | 통과, 승인 범위만 포함 |

새 회귀시험은 먼저 미수정 main에서 실행했다. 서버 17개 중 기존 동작 11개가 통과하고 새 false 계약 관련 6개가 실패했으며, 웹 8개 중 SayuModal 대조군 4개는 통과하고 FormatModal 옵션 4개는 실패했다. 수정 후 모두 통과해 기존 구현에서 생략되지 않던 호출과 요청 플래그 누락을 실제로 검출함을 확인했다. 본문/통계 실패·false에서도 quota/rate/auth 유지·입력 경계·기존 데이터 보존을 포함한다.

원격 API를 부르지 않는 로컬 대역 시험이다. 실제 React 렌더/브라우저 UI·운영 AI 품질·운영 저장·실청구액은 확인하지 않았다. 서버는 source AST에서 실제 handler/보조 함수를 추출해 실행하며 공용 SDK 어댑터의 기존 회귀시험과 Functions 타입 빌드를 함께 확인했다.

### 빌드 산출물 보존

미수정 main을 빌드한 단계부터 추적 중인 `functions/lib/index.js`·`functions/lib/snsToDiary.js`에 기존 소스/산출물 동기화 차이가 생겼다. 이번 수정 전후의 실제 빌드를 별도로 비교해 export 동일·polishContent 밖 동일을 확인한 뒤, 이 별도 작업본에서 **자신이 빌드로 만든 두 파일의 차이만** 원래 HEAD로 되돌렸다. 원본 사용자 작업은 건드리지 않았다. 직전 PR #287과 같이 src/test를 변경 대상으로 삼으며, 관련 없는 대규모 생성물 diff를 커밋에 포함하지 않는다. `firebase.json`의 Functions predeploy 빌드는 유지한다. [빌드 대조 결과](exports.json).

웹 산출물은 더미 설정으로 만든 검증용이며 운영 배포물로 사용하면 안 된다. 빌드 환경·배포 설정·의존성 파일은 수정하지 않았다.

## Git·배포 상태와 되돌리기

이 작업은 작업 브랜치 커밋/push까지만 진행한다. PR 생성·CI/자동 PR 리뷰·독립 검토·공식 판정①·main 병합·Hosting/Functions/Rules 배포는 하지 않았다. 실제 운영 AI 호출·운영 사용자 데이터 조회/변경도 없다. 원본 작업본과 main을 보존한다.

향후 별도 승인으로 배포할 경우 대상은 프론트와 `functions:polishContent`다. 프로젝트 `haru2026-8abb8`, 리전 `asia-northeast3`, 핵심 기록 경로 `users/{uid}/records/{date}`를 유지한다. 서버가 옵션을 먼저 지원해야 호출이 줄어든다. 구형 서버는 false를 무시해 기존 생성이 계속되고, 구형 클라이언트는 새 서버에서도 기본 생성을 유지한다. 현재 main의 공통 AI 창구/Secret 연결과 기존 운영 함수의 직접 SDK 방식 차이도 실제 배포 승인 단계에 다시 확인해야 한다.

현재는 배포 전이므로 운영 롤백은 필요 없다. 추후 변경을 되돌릴 경우 승인된 절차로 이 작업 커밋을 revert하고, 실제 배포했던 프론트/해당 함수만 다시 배포한다. 데이터 마이그레이션·기존 값 삭제는 없다.

## 인수인계

현재 상태는 **1차 구현·로컬 검증 완료, PR/배포 전**이다. 다음 첫 행동은 `codex-polish-comment-opt-out`의 승인 범위 diff와 이 검증 기록을 검토하는 것이다. PR 생성·미리보기 배포·병합·운영 Hosting/Functions 배포는 허대표님의 다음 범위 지시가 있기 전 진행하지 않는다. SayuModal 한마디·stats·안전 검증 유지, 다른 API 항목·제목 잠금/강제 재생성·운영 데이터 변경 금지를 이어받는다.

작업 난이도: **5.5 중간**.
