# #281 초안 PR283 검토·프리뷰 결과

## 승인 범위와 HEAD

허대표님 지시: PR270·PR282/#280 완료 유지. #281의 초안 PR 및 **프리뷰 자동배포만 허용**, Codex·독립 Claude 검토. 앱 코드·Rules·인증 정책 수정과 main병합·운영배포 금지.

- PR https://github.com/hkd620-lab/haru2026/pull/283 , **OPEN/DRAFT 유지**.
- 최종 검토·PR HEAD **dd44257af41c56788716e6aef99379aaafc7412d**.
- base/main **75a6d8490262babe98e5d67fd2c7800b43548894**, 변경 없음.
- 코드5640e0d7: frontend/test/loginProviderStorage.policy.test.cjs 1파일. 5fc95117은 최초 로컬 검증 기록 추가. 이후 dd44257a는 문서1줄 수정. 앱·시험코드를 추가 변경하지 않음.
- 과거 기록의 PR생성·배포금지는 당시 지시이며 이번에 초안·프리뷰만 새로 허용됐다. “승인된 시험 수정”은 당시 사용자 범위 승인을 뜻한다. 과거 판정을 독립 완료 승인으로 소급하지 않는다.

## 검토 결과와 원문

[Codex 전체 실행 색인](2026-10-19-issue281-pr283-codex-review-index.md). 실행1의 P1(개인 홈 경로 익명화)을 dd44257a로 반영한 뒤 실행2의 최신 전체 재검토가 완료됐다. 원문: **“Codex Review: Didn't find any major issues. Bravo.”**. 미해결 지적0, 스레드1개 resolve.

- 독립 Claude1차: 5fc95117, 2026-10-19T06:04:16.125483Z 시작 /06:07:04.191056Z 완료 관측, **“판정: 승인”**.
  - [질문](2026-10-19-issue281-pr283-review/claude-request.md), [결과](2026-10-19-issue281-pr283-review/claude-result.md), 원문 JSON·시각 메타데이터 같은 디렉터리.
- 독립 Claude2차: dd44257a, 06:10:34.100304Z 시작 /06:11:59.933327Z 완료 관측, **“판정: 승인”**.
  - [질문](2026-10-19-issue281-pr283-review/round2/claude-request.md), [결과](2026-10-19-issue281-pr283-review/round2/claude-result.md), 원문 JSON·시각 메타데이터 같은 디렉터리.
- 이전 질문·판정 원문과 Codex 지적, 문서 수정diff를 모두 제공한 별도 읽기 전용 세션. Read/Glob/Grep만, Bash/수정/MCP/다른 에이전트 없음. 두 실행 모두 is_error=false, permission_denials=[]이며 질문·결과를 원문 바이트로 보존했다.
- 같은 #281 건의 **수정 후 승인 누적0회**. 작업 규모 소, 멈춤조건 해당 없음. 독립 검토자는 이 시험전용 PR의 운영 E2E를 필수로 요구하지 않았다.

## 기존 감사 기록 수정의 처리

dd44257a는 **기존** docs/reviews 파일 수정이므로 새 파일 추가 예외로 처리하지 않았다. 최초 검토의 원문, [해당1줄 수정 커밋diff](https://github.com/hkd620-lab/haru2026/commit/dd44257af41c56788716e6aef99379aaafc7412d), Codex 원문을 재검토자에게 모두 제공했고 현재 문서와 대조·수용됐다. 개인정보를 새 기록에 재인용하지 않기 위해 원본diff는 GitHub 출처 링크로 보존한다.

최신 문서의 개인 홈 경로 표기는 익명화됐다. 과거 Git 커밋·기존 GitHub 리뷰 원문은 남아 있다. 과거 노출 제거 완료라고 주장하지 않으며 force 이력재작성은 하지 않았다.

## CI·프리뷰·필수 검증

- 최신 HEAD CI/build_and_preview 및 Deploy Preview **SUCCESS**: https://github.com/hkd620-lab/haru2026/actions/runs/39208118409 , 2026-10-19T06:09:27Z 완료. 첫5fc95117 실행39207628773도 성공했으며 최종HEAD와 구분한다.
- [최신 PR 상태](2026-10-19-issue281-pr283-review/round2/pr-status-final.json).
- [프리뷰](https://haru2026-8abb8--pr283-codex-issue281-provi-gz3bqo0d.web.app) 최신 dd44257a 배포 성공, 배포 후 HTTP200 확인. [헤더](2026-10-19-issue281-pr283-review/round2/preview-headers.txt). 로그인·운영계정·실제 저장·AI 실행 없음.
- [기존 로컬 필수 검증](2026-10-19-issue281-provider-contract-test-fix.md): 대상9통과/0실패/0skip, 관련 인증진단/캐시2파일·콜백/복귀경로정책 시험 통과, npm run build exit0(더미12변수/로컬Node26,75.95초), 유효 변이12종 검출. 최초setter 실행기 앵커 오류는 검출에서 제외하고 정정 실행까지 보존했다.
- 코드 이후 변경은 문서1줄뿐이라 로컬 시험·빌드를 반복하지 않았다. 최종문서 git diff --check 통과. 최종 PR CI는 최신 HEAD에서 별도로 성공했다.
- main 대비 코드 diff는 시험1파일, 나머지는 검증기록. 앱/Functions/Rules/인증정책/워크플로/package/lock diff 없음. Firestore users/{uid}/records/{date}, Functions asia-northeast3, 결제·환경변수 정의·AI 호출 변경 없음.

## 비차단 한계와 범위 유지

- user 객체를 바꾸는 캡처UID 시험은 closure 일관성을 검증한다. 실제 React 계정교체 자체를 증명하는 시험이 아니다. 다른 세션의 콜백은 UID/세대/cleanup 가드 시험으로 다룬다.
- 실제 React DOM/StrictMode 마운트·OAuth·브라우저복원·SDK/Rules 권한·실제 시간경과는 미검증. timeout/error 콜백·includeMetadataChanges 옵션/clearTimeout 동작도 이 범위에서는 검증하지 않는다.
- parser/esbuild는 기존 간접 의존성이다. 의존성 구조 변경 시 시험 로드에 영향이 있을 수 있다. PR CI는 앱 빌드이며 이 시험을 직접 실행하지 않으므로 별도의 수동 시험 로그가 필요하다.
- 독립 검토의 범위 밖 앱 참고사항은 이번에 수정하거나 정책 변경으로 확대하지 않았다. 기존 P3 확대 작업 없음.

## 판정·보존

**✅ 요청 범위 완료. 판정①(검토 기준 dd44257a) 충족:** 최신 PR CI 성공, 로컬 빌드/변경영역 시험 근거 PR첨부, Codex 지적 수정+최신 재검토 완료, 독립 Claude 최종 **“판정: 승인”**.

이 판정은 main 병합·운영배포 승인이 아니다. PR283 DRAFT/#281 OPEN 유지, PR270·PR282/#280 완료 유지. 앱 코드·Rules·인증정책 수정, main병합·운영Hosting·Functions·Rules 배포 없음.

원문·새 보충기록은 별도 codex-issue281-review-records-20261019 브랜치의 docs/reviews 새 파일 추가만으로 push한다. PR HEAD는 dd44257a로 유지하고 추가 프리뷰를 일으키지 않는다. 보조 diff·HTTP 헤더의 줄끝 공백만 최초 보존 전 정리했으며 독립 질문·결과 원문은 바꾸지 않았다.

작업 난이도: **5.5 중간**.
