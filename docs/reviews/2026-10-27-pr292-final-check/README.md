# PR #292 기술 검증·검토 완료 — 운영 미반영

## 결론

구현 보완 HEAD `606577c1`: Functions 빌드·관련 64개 시험 통과, 실제 컴파일 export 114개 동일·다른 export 선언 동일, Codex 실행 2 지적 없음, 독립 Claude 실행 5 **승인**. 실행 4의 수정 후 승인(누적 1회) 원문도 보존했다. 이후 변경은 docs/reviews 신규 파일 추가뿐이다. 최종 HEAD의 CI는 기록 push 후 확인한다. 운영 완료·병합·배포 승인으로 해석하지 않는다.

## 요청 행의 의미(문서 보완 C)

- 모델 단계 행: purpose/stage는 sayuPolish, recordStats, sayuPolishComment. modelInvoked=true.
- 요청 행: **purpose=polishContent, stage=request, modelInvoked=false**. 이 행은 추가 모델 호출이 아니다.
- 입력·월한도 거부는 processingOutcome=rejected. 단계 이후 다른 요청 오류는 processing_error. 같은 단계 오류 전파는 요청 행을 중복 생성하지 않는다.
- model·행 수·requestId의 의미 변화를 과거 로그와 단순 비교하지 않는다. SDK 전송·실청구 횟수는 측정하지 않는다.

## 운영 조건부 항목 확인

2026-10-27 읽기 전용 확인: polishContent revision **polishcontent-00244-sas**, Node.js 22, asia-northeast3, updateTime `2026-10-26T22:20:53.514959814Z`, source generation `1793053161861758`.

해당 generation의 배포 소스에서 lib/aiUsageLogger.js와 src/aiUsageLogger.ts를 검사했다. 새 요청 로거·modelInvoked·요청 purpose·polishUsage 모듈은 없다. hash·불리언 결과만 JSON에 보존하고 전체 배포 소스나 사용자 데이터는 커밋하지 않는다. 이번 계측 필드가 현재 배포 소스에 없다는 확인이며, 운영 로그·외부 쿼리의 전수조사를 뜻하지 않는다.

firebase.json functions[0].predeploy에는 `npm --prefix "$RESOURCE_DIR" run build`가 있다. 향후 승인된 배포 전 빌드가 필요하며 실제 배포는 하지 않았다.

## 다음 첫 행동

최종 기록 커밋의 CI와 필터 없는 `git diff --name-status 606577c1..HEAD`에서 모든 항목이 docs/reviews 아래 A인지 확인한다. PR은 초안으로 유지한다.

허대표님이 명시적으로 승인하면 main 병합과 polishContent 한 개 배포(asia-northeast3)를 진행하고 revision·traffic·운영 로그 E2E를 별도로 확인한다. 전체 Functions·Rules 배포, 로그 삭제·데이터 이동은 하지 않는다. 이번 「다음작업」은 검토 재개로 해석했으며 운영 배포 승인은 받지 않았다.
