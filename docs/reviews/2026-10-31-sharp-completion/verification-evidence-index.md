# 검증 근거 색인 — PR #319 (sharp 0.35.5)

## 1. CI

| HEAD | 원문 | 결과 |
|---|---|---|
| `67386e69` | [ci-linux-first-67386e69-raw.json](ci-linux-first-67386e69-raw.json) | job 124489794575 `linux_x64_node22` success. 전체 로그 포함 |
| `871a1f64` | [ci-871a1f64-checks-raw.json](ci-871a1f64-checks-raw.json) | 체크 3건 전부 success. 전체 로그는 파일에 없음 |
| 이 기록 뒤 최종 HEAD | 없음 | 부모가 확인한다 |

- `67386e69` 로그 원문: `# node=v22.23.4 linux/x64 sharp=0.35.5 libvips=8.18.7`, `# exports=114`, `# tests 14`, `# pass 14`, `# fail 0`. 경고 1건은 Actions의 Node.js 20 지원 종료 안내다.
- `871a1f64` 체크: `Deploy Preview`(124492334104), `build_and_preview`(124492051174), `linux_x64_node22`(124492050952). `Deploy Preview`는 PR 미리보기이며 운영 배포가 아니다.
- `build_and_preview`와 `linux_x64_node22`는 `annotations_count`가 각각 2이지만 `annotations` 배열은 비어 있다. 주석 내용은 원문에 없어 확인 불가다.

## 2. Secret·함수 메타데이터

모두 비밀값 없는 메타데이터다. 키 값은 어느 파일에도 없다. 프로젝트 번호와 소스 버킷 이름은 들어 있다.

| 파일 | checkedAt | KST | 결과 |
|---|---|---|---|
| [secret-metadata-1930-failed-raw.json](secret-metadata-1930-failed-raw.json) | 2026-10-31T10:36:15.293234+00:00 | 19:36:15 | 실패 `exitCode 1`. gcloud 설정 폴더 쓰기 거부 |
| [secret-versions-1930-failed-raw.json](secret-versions-1930-failed-raw.json) | 2026-10-31T10:36:19.325379+00:00 | 19:36:19 | 실패 `exitCode 1`. 같은 사유 |
| [secret-metadata-1930-escalated-raw.json](secret-metadata-1930-escalated-raw.json) | 2026-10-31T10:43:15.926773+00:00 | 19:43:15 | 성공. live GEMINI 17, KINDWISE 1, PLANTNET 2 |
| [secret-versions-1930-escalated-raw.json](secret-versions-1930-escalated-raw.json) | 2026-10-31T10:43:18.820678+00:00 | 19:43:18 | 성공. `state:ENABLED` 필터로 GEMINI 17, 16, 15 |
| [plant-secret-versions-1930-raw.json](plant-secret-versions-1930-raw.json) | 2026-10-31 10:46:34 UTC | 19:46:34 | KINDWISE 1, PLANTNET 2 ENABLED |
| [secret-latest-unfiltered-raw.json](secret-latest-unfiltered-raw.json) | 2026-10-31 10:51:16 UTC | 19:51:16 | `stateFilter: false`. GEMINI 17, KINDWISE 1, PLANTNET 2 ENABLED |

**판독**

- live 연결 버전과 최신 ENABLED 버전이 세 secret 모두 같다. GEMINI 17, KINDWISE 1, PLANTNET 2다.
- live 값의 근거는 19:43:15 파일이고, 최신 버전의 근거는 19:51:16 파일이다. 어느 값이든 해당 시점의 실측이다.
- 상태 필터가 없었다는 근거는 19:51:16 파일의 `stateFilter: false`다. 19:46:34 파일에는 명령·상태 필터 표시가 없다. 두 파일 모두 실행 명령 원문은 없고, `secretValuesRead: false`는 기록자의 표시다.
- 이 라이브 조회의 `updateTime`·`generation`과 secret 버전의 `createTime`은 빌드 시각이나 승인 시각이 아니다. 그렇게 해석하지 않는다.

**정정**

- 독립3 질문의 "19:38 실측"은 추정이었다. 파일의 실제 시각은 19:43:15·19:43:18 KST다. 19:36 시도는 실패했고, 위 두 파일로 숨기지 않고 보존한다.
- 같은 질문의 "공개 메타데이터"는 "비밀값 없는 메타데이터"로 읽는다. 질문 원문은 고치지 않는다.
- 독립3 결과의 "KINDWISE·PLANTNET 최신 버전, 상태 필터 없는 재조회 미충족"은 당시 판단 원문이다. 19:46:34 파일은 독립3 실행 중의 것이지만 결과에 반영되지 않았고, 19:51:16 파일은 독립3 결과 mtime(19:49:49) 뒤의 것이다. 두 파일 모두 독립 검토자가 확인한 근거가 아니다.
- 배포 직전 재확인 조건은 그대로 남는다. 이번 실측이 그 확인을 대신하지 않는다.

## 3. 보존하지 않은 것

- 원본 소스 ZIP(`control/polish-live-source.zip`, `control/remaining-live-sources/`)과 환경변수 값은 커밋하지 않았다. 질문 원문에는 경로만 있다.
- 복사 대상 18개를 패턴 검색했다. Google·OpenAI·GitHub·Slack·AWS 키, Bearer 토큰, JWT, 개인키 형식은 0건이다.
- 빈 stderr 3개는 복사하지 않고 [independent-review-index.md](independent-review-index.md)에 0바이트로 기록했다.

## 4. 복사 대조

아래 파일은 control 원문과 SHA-256이 같다. 앞의 독립1 2개 파일을 포함해 기존 파일을 덮어쓴 것은 없다.

| 저장소 파일 | 원문 | 바이트 | SHA-256 |
|---|---|---:|---|
| `independent1-question.txt` | `control/sharp114-independent1-prompt.txt` | 2837 | `52a6d1934c7c007a3ce91461b42aee1e179883f26597c01026c1dc27f0a15e42` |
| `independent1-result-original.json` | `control/sharp114-independent1-result.json` | 1312 | `80048171594ca749931229c51e5e6100b1dfe5e6995590605aba840bc2dc562a` |
| `independent-question-template.txt` | `control/sharp114-independent1-prompt-template.txt` | 1199 | `dcbe17b21bf49ac38920c95958732d18a96b044cd2bec6a49c69ae941761772f` |
| `independent2-question.txt` | `control/sharp114-independent2-prompt.txt` | 3780 | `7361abbe602dc673975f9537b52a61aeb259aa84ec8e38db6dc9e059d9e77044` |
| `independent2-result-original.json` | `control/sharp114-independent2-result.json` | 15701 | `2ef6c0d02e3b6354601f8837880902a3b4b5670e95e1a3ed95f1abe508939bb7` |
| `independent3-question.txt` | `control/sharp114-independent3-prompt.txt` | 5941 | `fe88aa5fd58c4c0f0a12478a7d5605c820337c072dadc156b4f4d0ab69ebd6c2` |
| `independent3-result-original.json` | `control/sharp114-independent3-result.json` | 13585 | `3936072f7c649257a0f015fcb7979b394a868db8271f3885f86e2450369a8bdf` |
| `scope-chronology-correction.md` | `control/scope-chronology-correction.md` | 727 | `0bbc9473d47816ea71418d55b79517415bf34c744b4739c8bdaa61a7b01e5e80` |
| `codex-manual1-comments-raw.json` | `control/sharp114-codex-manual1-comments.json` | 10696 | `89d5e2eb43c6310d359dea7adb766c3a400c6a6dbb84fec07958602fd067966b` |
| `codex-ready2-comments-raw.json` | `control/sharp114-codex-ready2-comments.json` | 10704 | `08c6d9c64996af7b0f727ee40d216cc1de89dc554876eb2164b95e83f6b3cb8f` |
| `ci-871a1f64-checks-raw.json` | `control/sharp114-ci-871a1f64.json` | 2008 | `e2e0c443a281d112ec34aa562bb9de4e0726709cfc5eba5ceeb7ebc259402ccd` |
| `ci-linux-first-67386e69-raw.json` | `control/sharp114-linux-ci-first.json` | 26284 | `e2f7cd013644e248ff77756494d017433a193a4a49ca4c830898ed321376866e` |
| `secret-metadata-1930-failed-raw.json` | `control/sharp114-secret-metadata-1930.json` | 1020 | `8aef552f8f77c674e9e1a2dbf51b17d5dc39957a9b11bc5734609b4dd1bc8bd5` |
| `secret-versions-1930-failed-raw.json` | `control/sharp114-secret-versions-1930.json` | 885 | `fc1c4b6a4336074b33dfd59cf002576a07cfa1a6c8fe8952e58c1929fc4975f6` |
| `secret-metadata-1930-escalated-raw.json` | `control/sharp114-secret-metadata-1930-escalated.json` | 1599 | `d7a0d1d43cce3a09efdff416d583d2afdeda08a32bcc25967dea258202710cbb` |
| `secret-versions-1930-escalated-raw.json` | `control/sharp114-secret-versions-1930-escalated.json` | 812 | `9a6e0478fc89b234a7f14a7ae2dc03108ba1f32fe0d5869631247e9582ac1188` |
| `plant-secret-versions-1930-raw.json` | `control/sharp114-plant-secret-versions-1930.json` | 951 | `6870dd9411c189436d41e4f2b18085604bbd55724d1b0229113d0deac02d0ecd` |
| `secret-latest-unfiltered-raw.json` | `control/sharp114-secret-latest-unfiltered.json` | 1468 | `ecbd898d40924f690f5a6316fb44d6f033efa8ff47f13248082266bbd9fd0b63` |
