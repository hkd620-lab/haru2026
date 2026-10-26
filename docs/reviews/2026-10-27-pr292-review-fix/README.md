# PR #292 독립 검토 A·B 반영

독립 실행4의 수정 후 승인(누적1회)을 반영한다. 이전 원문은 수정하지 않는다.

## A: 오류 진단 코드

기존 sharedHelpers.getAiUsageErrorCode는 error.message를 fallback으로 쓰므로 새 계측에 그대로 주입하면 사용자 본문이 섞인 오류 원문이 노출될 수 있다. polishUsage 안에서 정해진 Firebase/network 코드와 숫자 HTTP 4xx/5xx만 허용하는 별도 정제 함수를 사용한다. 429/503/504·deadline-exceeded·ETIMEDOUT·RESOURCE_EXHAUSTED를 보존하고 알 수 없는 code/message는 processingOutcome 범주만 남긴다. 공용 helper와 다른 소비처는 수정하지 않는다.

## B: 단계 이후 요청 실패

실제로 첨부 누락된 마지막 부분은 logPaidServiceUsage(...).catch(logger.warn)와 반환 객체다. 정상 비동기 paid log 실패는 기존 catch가 흡수하지만 logger.warn 등이 throw할 경우를 완전히 배제하지 않는다. 이미 기록한 단계 오류와 동일한 객체가 외부 catch로 전파되면 요청 행을 중복 생성하지 않고, 다른 요청 오류면 stage=request/modelInvoked=false/processingOutcome=processing_error로 남긴다. 이 행은 추가 모델 호출이 아니다. modelInvoked/providerOutcome은 해당 로그 행 기준이다. 본문 단계 실패의 quota1회 환원과 통계·한마디 부분 실패의 환원0회는 유지한다.

## 검증

Functions build 성공, 관련64시험 통과(기존55+오류코드8+단계후요청실패1). 마지막 시험은 모든 단계 성공·통계 부분실패·한마디 부분실패 후 각각 발생한 요청 오류를 모두 확인한다. 세 경우 모델행3개+요청실패행1개, quota1회 환원, raw 오류 미포함을 확인한다. 기존 SDK/인증·rate·quota·반환값·부분실패·구독판정 시험도 통과했다. 실제 AI/운영 데이터 작업 없음.

aiUsageLogs 소비처 확인 범위: 저장소 검색상 요청 ID·단계 성공값으로 quota를 차감하는 소비처 없음. 별도 계정삭제 익명화와 결과대화 직접 기록은 수정하지 않음. 실제 관리자/외부 쿼리·운영 비용 계측은 미확인. 새 행 의미는 PR에 명시한다.

내보내기 목록 비교 결과는 export-check.json. 추적 functions/lib의 기준 생성물 차이는 커밋에서 제외한다. 이후 배포는 predeploy build 필요. 다음은 최신 소스 Codex 재검토와 실행4 원문·반영내역을 포함한 독립 재검토다. 판정①·main 병합·운영배포 없음.
