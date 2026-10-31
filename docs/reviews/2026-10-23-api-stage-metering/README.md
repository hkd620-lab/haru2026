# API 요청·단계별 계측 및 로그용 구독 조회 재사용

- 사용자 직접 지시: CC 작업과 겹치지 않는 별도 작업본에서 두 보완 진행.
- 기준: origin/main `771ecf69f56dae0457335d53b4840f0b686ea51a`.
- 작업본: `/private/tmp/haru-api-stage-metering`, 브랜치 `codex/api-stage-metering`.
- CC의 Developer 작업본/브랜치/미커밋 파일은 수정하지 않았다. 자동 검토 체계의 실행 역할 예외는 이번 사용자 직접 실행 지시에 따른다.
- 판정: 구현·로컬 검증 완료 / 독립 검토 미실행 / 운영 미반영. 공식 판정① 아님.

## 변경 계약

`polishContent` 요청에 랜덤 requestId를 하나 부여하고 본문(sayuPolish), 통계(recordStats), 한마디(sayuPolishComment)의 논리 callAi 진입당 결과 로그 한 행을 남긴다. 기존 featureName과 토큰/요금제 필드는 유지한다. modelInvoked는 논리 창구 진입이며 실제 HTTP 전송·SDK 재시도·과금 횟수가 아니다.

providerOutcome은 returned/error/not_called, processingOutcome은 success/provider_error/response_error/processing_error/rejected다. latencyMs는 생성·text 읽기·처리 시간을 포함하고 로그 DB 기록 시간은 제외한다. 통계 JSON이 없거나 잘못되면 처리 실패 한 행만 남기고 stats:null 부분 성공은 유지한다. success는 그 단계의 처리 결과다. 공급자가 응답했다면 처리 실패여도 알려진 토큰을 보존한다. 생략·미지원 단계는 모델 행을 만들지 않는다. 입력/월한도 거부는 stage=request, modelInvoked=false다. 인증·rate 거부는 기존처럼 usage 행을 추가하지 않는다.

`createRequestAiUsageLogger`는 요청에만 존재하며 첫 로그 시점의 기존 resolveActualPlan 결과를 재사용한다. 처리 중 구독 변경·만료가 발생해도 같은 요청 로그는 이 스냅샷을 사용한다. 조회 실패 시 기존 fallback을 요청 내 재사용하고 다음 요청에서 다시 조회한다. 기존 inactive/만료/endDate/expiresAt/개발자/명시적 actualPlan/일반 fallback 의미를 유지한다. 이는 로깅의 요금제일 뿐 권한이나 quota 판정이 아니다. 직접 logAiUsage 호출자는 캐시를 적용하지 않는다.

구독 조회는 비개발자·actualPlan 미지정의 지원 형식 기본 요청에서 로그용 3→1, includeAiComment:false에서는 2→1이다. quota의 별도 조회와 트랜잭션은 그대로다. 새 전역 캐시·서버 잠금·토큰 상한·AI 호출·통계 계산 정책 변경은 없다. 실패한 한마디에도 결과 행을 남기므로 과거 로그 행 수와 직접 비교할 수 없다. 기존 로그는 소급 변경하지 않는다.

새 로그 필드는 정해진 ID·목적·상태·시간뿐이다. 본문·프롬프트·응답·첨부·raw 오류를 새 계측 필드에 기록하지 않는다.

## 검증

- functions `npm run build`: 통과([build.log](build.log)).
- `node --test test/polishContent.test.js test/aiUsageLogger.request.test.js test/aiGateway.test.js test/monthlyAiQuota.policy.test.js`: 55/55 통과([원문](related-tests.log)).
- 공급자/응답 읽기/JSON 실패, 요청 ID·행 수·토큰 보존, 부분 성공/예약 환원, 명시적 false 및 기본 동작, 입력·rate·quota·개발자·만료·inactive·조회/저장 실패·요청 간 분리를 합성 대역으로 검증했다.
- 기존 aiGateway 소스 경계 시험이 로그 필드 위치에 의존해 실패하여 callable 선언 경계로 바꿨다. SDK 우회 금지 단언은 유지한다.
- export 114개 동일 및 polishContent 외 export 선언 동일을 비교했다. 결과: export-check.json.
- 실제 AI·운영 사용자 데이터·Firestore 트랜잭션·실청구·운영 로그 E2E는 실행하지 않았다.

## 독립 검토와 다음 단계

최초 독립 Claude CLI는 기존 CC 세션을 재개하지 않는 별도 print 실행이며 도구/MCP/세션 저장을 비활성화했다. [질문 원문(JSON 문자열에 그대로 보존)](independent-prompt.json), [결과 원문](independent-result.txt). OAuth 만료 401로 검토 미실행이다. 승인·공식 판정①으로 취급하지 않는다. 이후 재검토 시 이 실패 이력을 함께 제공한다.

작업 브랜치 push·초안 PR 후 자동 리뷰/독립 검토를 받아야 한다. main 병합·Hosting·Functions·Rules 배포는 하지 않았다. 향후 승인된 배포는 빌드 후 polishContent만 대상이다. aiUsageLogger의 기존 직접 호출자는 행동이 같다. Functions region asia-northeast3, Firestore records 경로·Rules·환경변수·Secret·모델·프롬프트·결제/인증 정책 불변. 롤백은 승인 범위에서 이 PR 소스만 되돌려 대상 함수를 재배포하며 운영 로그 삭제는 하지 않는다.

functions/lib는 기준에 오래된 생성물이 추적돼 재빌드 시 관련 없는 대량 차이도 생긴다. 이번에는 TS 소스·시험·증거만 커밋하고 생성물은 제외한다. 향후 배포 전 build가 필요하다. node_modules는 기존 설치본을 가리키는 작업본 전용 symlink이며 커밋하지 않는다.

작업 난이도: 5.5 중간.
