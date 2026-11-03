# 미완료 작업 대조 및 PR #322 검증

- 확인일: 2026-11-03 KST. 실행자: Codex.
- 요청: 허대표님 “완료하지 못한 작업을 찾아 완료시키자”.
- 기준 main: `08d6653412ce46996e6eb1c94ffe2580308454db`.
- 이 기록은 확인된 사실이며 자동 판정①이나 운영 배포 승인이 아니다.

## 종료 처리한 중복 PR 4건

| 원래 PR | 대체 반영 | 종료 이유 |
| --- | --- | --- |
| #96 | #321 / bea0aadc | 웹 기반 의존성을 현행 구조로 이행. Vite8.3.5·플러그인 정렬과 검증을 대체 PR에 보존 |
| #116 | #321 / bea0aadc | react-router8.5.1 반영. 구8.3.0 변경을 추가 병합할 필요 없음 |
| #114 | #319 / a5258e46 | sharp0.35.5 반영. 구0.35.0 변경 대체 |
| #141 | #320 / 79543644 | 잔여 문법·음성·독서 기능 이식. 이미 반영된 처리·옛 지침·생성lib 제외 내역을 기존 README에 보존 |

4건 모두 기존 본문 앞에 대체 근거·잔여 E2E를 추가하고 CLOSED로 변경했다. 원래 브랜치·커밋은 삭제하지 않았다. PR #323의 후속 화면 제거 결정을 되돌리지 않았다. 새 코드 병합·배포가 아니다.

- [GitHub 대체 PR319](https://github.com/hkd620-lab/haru2026/pull/319), [320](https://github.com/hkd620-lab/haru2026/pull/320), [321](https://github.com/hkd620-lab/haru2026/pull/321)
- [기존 Slack 감사 대표 스레드](https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793410851272079): 검토·중단·재개·제품 승인 원문 확인. 해당 스레드는 배포 전 시점이며 그 이후 상태는 GitHub 운영 기록을 근거로 했다.
- Hosting run41360647969: SUCCESS, headSha bea0aadcd8afe6e548ea8b9c3a8d221b0f471225 재조회.
- [기존 운영 결과](https://github.com/hkd620-lab/haru2026/blob/codex-completion-web-upgrade/docs/reviews/2026-11-02-completion-deployment/final-state.md)

## PR #322: 미반영 업데이트의 검증 완료, 검토 대기

- PR HEAD `b576f2b62f5e236b04a5e09c8060466ef7949e61`. 열린 PR은 이 1건만 남았다.
- diff: `tools/package-lock.json`의 node-forge version/resolved/integrity 세 줄만 1.4.0→1.4.2. 현재 main과 비교해도 tools의 변경은 동일하다.
- Node22.23.2 / npm10.9.8. 독립 임시 디렉터리에 정확한 PR manifest·lock을 추출했다.
- `npm ci --ignore-scripts --no-audit --no-fund`: 178패키지 설치 성공. `npm ls --all`: exit0. firebase-admin13.8.0→node-forge1.4.2 확인.
- 호환성5/5 통과: 잠긴 버전 로드, PEM string/Buffer 동일 처리, ASN.1 인증서 왕복·서명 검증, 합성 RSA 키를 쓴 Firebase Admin 로컬 토큰 서명·검증, node-fetch ESM 로드.
- 기존 CI build_and_preview SUCCESS(run41202161809). 이는 tools 검증을 대신하지 않으며 위 검증을 별도로 수행했다.
- 후보 `npm audit --json`: node-forge 권고 없음, 별개 의존성 @fastify/busboy·@grpc/grpc-js의 high 2항목이 남아 exit1. 이 결과를 설치·호환성 실패 또는 전체 보안 해결로 표현하지 않는다. 이번 PR은 이 두 패키지를 바꾸지 않는다.
- 레지스트리 version/tarball/SHA512가 lock과 일치. 설치 후 lock SHA256 `aecff18eaef5e80e1180fd0824cd5f7d9999775fb37aa7010356401cb100cbd7`는 원격 PR 원본과 동일.
- `git diff --check` 통과. 제품 코드·환경변수·Firestore 경로·Functions 리전·Rules·결제·인증 정책 변경 없음. 운영 Firebase 호출 및 사용자 데이터 조회·변경 없음. 시험 키·토큰은 메모리에서만 생성하고 출력·보관하지 않았다.
- `tools`에는 build 스크립트 및 유효한 test 스크립트가 없다. 운영 쓰기를 하는 cache_grammar.js를 시험으로 실행하지 않았다.
- 배포 영향: tools 의존성만 바뀌지만 현행 workflow는 main의 모든 push에서 Hosting 자동배포를 실행한다. 병합은 별도 운영 승인 대상이며 Functions·Rules 수동배포는 필요 없다.
- 롤백: 문제 시 이 lock 변경만 별도 revert PR로 되돌린다. 이번에는 병합·배포하지 않았다.

## 검토 절차와 제한

- Slack 운영정책8.1은 최신 HEAD 자동 Codex 결과와 독립 Claude 승인을 요구한다.
- 현재 PR322 리뷰는 없음. 부모 Codex의 diff·호환성 검증은 독립 완료 승인이 아니다.
- `claude auth status`: loggedIn=false / authMethod=none. 비밀값 조회·재인증·대체 검토 실행 없음.
- 사용자에게 이번 건 독립 Codex 대체 또는 Claude 로그인 복구 선택을 요청했다. 이 기록 시점에는 답변 대기이며 병합·배포 승인도 요청·획득하지 않았다.
- PR322 관련 Slack 검색 결과는 없었다. 기록 부재를 코드 실패로 해석하지 않는다. 이번 대화에서는 Slack 메시지를 게시하지 않았다.

## 기존 완료 유지 및 실제 잔여 범위

- #326: GitHub·Slack 개발/감사와 로컬 운영 근거에서 이미지 답변 단일 시나리오 배포·운영 확인 완료. 재개하지 않았다.
- #323: 배포·세 형식 텍스트 저장/재열기 확인 근거 유지. 사진 OCR 월한도·다중사진 운영 실기기는 미확인.
- #319~321: 배포·기존 합성운영 성공 유지. 음성 실청/일시정지 재개/iOS, PDF 출력, 독서 저장의 미확인 범위는 전체 완료로 올리지 않는다.
- #317: 카드파일·아이폰PWA 저장/재가져오기 실기기 확인은 Slack상 남아 있다. 실제 금융자료를 임의 사용하지 않았다.
- 열린 이슈 #279·#273은 선택적 정책/품질·보조장부 결정 사항이다. 이번 요청만으로 추천 정책·회계 집계 기준을 임의 선택하지 않았다. #89(사진삭제), #84(과거 Copilot 시험)는 open 상태를 확인했으나 새 기능 구현 또는 시험문서 생성 지시로 취급하지 않았다.

## 저장 및 난이도

- 소스·Git은 원래 내부 경로 유지. 검증용 의존성·임시 스크립트는 `/private/tmp/haru-completion-20261103`에 생성했다.
- 검증 로그와 상태 기록은 이 폴더에 보존하고, 일반 보관본은 UUID를 확인한 LaCie의 새 작업 폴더로 복사·SHA256 검증한다. 실제 보관 경로·완료 결과는 별도 결과 파일에 기록한다.
- 난이도: 5.5 중간.

## Slack 기록용 확정 요약

2026-11-03 GitHub·Slack 대조 후 대체 반영된 PR96/114/116/141을 근거·기존본문 보존하여 종료. 후속319/320/321 병합·Hosting 성공 근거 유지, 새 배포 아님. 열린PR은322 하나. node-forge1.4.2 Node22 설치·의존성트리·호환성5/5·lock무변경 검증 통과. 자동/독립 검토 미완료, Claude로그인해제·검토방식 답변대기. 운영실기기 잔여범위는 유지. Slack미게시.
