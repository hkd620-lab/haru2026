# #280 초안 PR282 검토·프리뷰 결과

## 승인 범위와 기준

허대표님 새 지시: “PR #270은 완료 상태로 유지하고, #280은 프리뷰 자동배포만 허용하니 초안 PR을 만들어 Codex와 독립 Claude 검토를 진행해 줘. 앱 코드·Rules 수정과 main 병합·운영 배포는 하지 마.”

- 초안 PR: https://github.com/hkd620-lab/haru2026/pull/282 (OPEN/DRAFT 유지)
- 검토·최종 PR HEAD: `6b6dea1cb5240ae22f2e03ebe8191b84207705e6`.
- main: `a4d55436fee851f2b66f1ae86a62dcdeb21dcadf`, 변경 없음. PR270 MERGED/완료 유지. #280은 OPEN 유지.
- 이번에 새로 허용된 배포는 PR 프리뷰뿐이다. 기존 검증 문서의 PR 미생성·배포금지는 당시 승인 범위의 역사 기록으로 보존한다. 기존 기록을 수정하지 않았다.
- 검토 원문·이번 보충 증거는 별도 `codex-issue280-review-records-20261019` 브랜치의 새 docs/reviews 파일로만 보존한다. PR 브랜치를 재변경하거나 추가 프리뷰를 일으키지 않는다.

## Codex 지적과 반영

[전체 Codex 실행 색인](2026-10-19-issue280-pr282-codex-review-index.md). 첫 검토 P2 1건은 StrictMode setup → cleanup → setup을 하네스가 재현하지 않아 setup 초기화 결함을 놓칠 수 있다는 지적이었다.

`6b6dea1c`에서 시험 하네스만 수정했다(+6/−2). 실제 effect를 setup → cleanup → setup으로 실행하고 마지막 cleanup을 unmount에 사용한다. 앱 소스는 수정하지 않았다. 최신 전체 재검토 결과 원문: **“Codex Review: Didn't find any major issues. Keep it up!”**. 최신 요약에 unresolved findings=false를 확인한 후 스레드1개를 resolve했다.

## 독립 Claude 전체 검토 — 모든 원문 보존

- 1차: 대상 `3fb503f3e280da4b05a2e1b765eb9b0ad29caf11`, 2026-10-19T00:57:46.927158Z 시작 / 01:00:06.782565Z 완료 관측. **“판정: 승인”**.
  - [질문 원문](2026-10-19-issue280-pr282-independent-review/round1/claude-request.md), [결과 원문](2026-10-19-issue280-pr282-independent-review/round1/claude-result.md), JSON·시각 메타데이터 같은 디렉터리.
  - 저장소 밖 변이 실행기 Read 1회 거부를 결과에 명시했다. 실패를 숨기지 않았다.
- 2차: 대상 `6b6dea1cb5240ae22f2e03ebe8191b84207705e6`, 2026-10-19T01:02:27.431069Z 시작 / 01:03:57.251453Z 완료 관측. **“판정: 승인”**.
  - [질문 원문](2026-10-19-issue280-pr282-independent-review/round2/claude-request.md), [결과 원문](2026-10-19-issue280-pr282-independent-review/round2/claude-result.md), JSON·시각 메타데이터 같은 디렉터리.
  - 이전 질문·판정 원문과 Codex 지적·반영 diff를 모두 제공한 새 읽기 전용 세션. Read/Glob/Grep만 제공했고 파일 수정·Bash·MCP·다른 에이전트 사용 없음. CLI 기본 모델 claude-opus-5-5. 권한 거부0, is_error=false. 실행기를 허용 디렉터리로 제공해 직접 읽었다.
- #280 같은 건의 “수정 후 승인” 누적 **0회**. PR270의 횟수를 상속하지 않는다.
- 독립 검토자의 작업 규모 **소**, 멈춤 조건 **해당 없음**. 이 시험 PR의 완료 조건에 운영 E2E는 필요 없다고 판정했다. 이는 운영 저장 정상·권한 검증·병합·운영 배포 승인이 아니다.

## 검증과 프리뷰

- 최신 시험 `node test/haruLawSave.test.cjs`: **12통과/0실패/1skip**, 취소0. [원문](2026-10-19-issue280-pr282-independent-review/round2/target-tests.log).
- StrictMode setup의 mounted=true 대입을 메모리에서 제거한 새 변이: **7통과/5실패/1skip**, exit1, 취소0. 기존 lock/saved/mounted/cleanup 네 변이는 각11통과/1실패/1skip, exit1. [실행기·다섯 로그·요약](2026-10-19-issue280-pr282-independent-review/round2/). 디스크 앱 파일 수정 없음. 첫 실행기 원문도 round1에 함께 보존했다.
- 기존 관련 오류·첨부·쉬운설명 시험 및 로컬 빌드 통과 근거는 [이전 검증 기록](2026-10-19-issue280-harness-contract-fix-and-verification.md). 코드 변경은 그 뒤 하네스 effect 재실행뿐이다.
- 최종 HEAD CI 빌드·프리뷰 배포 **SUCCESS**: https://github.com/hkd620-lab/haru2026/actions/runs/39183371659 (2026-10-19T01:03:00Z 완료). 첫 HEAD의 별도 CI도 SUCCESS였고 최종 상태와 혼동하지 않았다.
- [최신 프리뷰](https://haru2026-8abb8--pr282-codex-issue280-test-7zfxpt4p.web.app) 배포 댓글은 6b6dea1c를 명시한다. 만료 2026-10-26T01:02:53Z. 배포 후 HTTP200 확인. 헤더·PR CI 원문은 round2. 화면 클릭·로그인·실제 저장·AI 실행은 하지 않았다.
- main 대비 코드 diff는 시험1파일. [전체 변경 목록](2026-10-19-issue280-pr282-independent-review/round2/final-scope.txt). frontend/src 트리 양쪽 `8d5a15526e809637906b626879f628cf8d9d7182`, firestore.rules blob 양쪽 `82b201d532562b99297ca08470756c0aeece0b0a`. Functions/Rules/workflow diff 없음.
- Firestore users/{uid}/records/{date}, Functions asia-northeast3, 환경변수 정의·결제·인증·AI 호출 변경 없음. Functions·Rules 배포 없음.

## 검토에서 확인한 한계 — P3 확대 구현 없음

1. 순차적으로 만든 새 인스턴스가 정상 이동한다는 단언이 모든 공유ref 결함을 검출하는 것은 아니다. 호출마다 새 ref를 만드는 하네스 구조와 React useRef 계약을 대조한 근거와 구분한다. 기존 기록의 “수명 상태가 공유되지 않음”을 이 시험 하나의 전면 증명으로 읽지 않는다.
2. 실제 React DOM 마운트가 아닌 추출 callback/ref/effect 경량 하네스다. StrictMode 개발 effect 재실행을 모델링한다. 메모리 변이는 다섯 조건으로 한정된다.
3. Rules1skip은 기존 에뮬레이터/변경 전 Rules baseline 전제가 없어 미실행이다. 권한 검증 완료를 주장하지 않는다. 로컬 Node26 빌드와 PR CI 빌드 증거를 구분한다.
4. 실기기 저장 동작 운영 완료로 확대하려면 별도 E2E와 대표님 결정이 필요하다. 이번 시험 PR 범위에서는 요구하지 않는다. #280 close나 실기기 완료 선언은 하지 않았다.
5. 기존 P3·#281은 수정하지 않았다. 이전 감사 기록을 수정하지 않고 이 새 기록으로 현재 승인 범위·다섯째 변이·실행기 원문·독립성 한계를 보충했다.

검토 질문·결과·JSON·시각 메타데이터는 원문 바이트를 보존했다. 보조 시험 로그·diff·HTTP 헤더는 최초 커밋 전 줄끝 공백/CRLF만 정리했으며 내용·결과를 바꾸지 않았다.

## 판정과 유지 상태

**✅ 요청 범위 완료. 판정①(검토 기준 HEAD 6b6dea1c) 조건 충족:** 최신 PR CI 성공, 대상 시험 및 빌드 근거 첨부, Codex P2 수정+최신 재검토 완료, 독립 Claude 최종 “판정: 승인”. 원문과 검증은 위 링크로 보존한다. 본 기록 브랜치는 최종 PR HEAD 이후의 새 docs/reviews 추가만이며 PR HEAD는 그대로다.

이 판정은 병합·운영 배포 승인이 아니다. 초안 PR·#280 OPEN 유지, main 병합·운영 Hosting·Functions·Rules 배포 없음, PR270 완료 유지.

작업 난이도: **5.5 중간**.
