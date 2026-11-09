# AI 답변 근거 연결 개선 — 검증 기록

- 구현 HEAD: `0539818bf4f2883abd3dd9aeaebefd00fc695fa3`
- 대상: `hkd620-lab/haru2026`, 웹 `ResultChatModal`과 기존 `chatWithResult`.
- 허대표님 지시: HARU에서 먼저 적용·확인하고 괜찮으면 HEL·EEB에 전파. 두 프로젝트 안내·수정은 보류한다.
- 브랜치: `codex-answer-evidence-20261104`. 원격에 `refs/heads/codex`가 있어 기본 `codex/...` 이름의 push가 거부되었으며 기존 원격 브랜치는 보존했다.

## 변경과 검증

1. 사진 내용 질문은 기록·첨부 분석으로 처리한다. 검색·작가·출처 등 외부 확인 요청은 기존 사용자 선택을 유지한다. 자동 기록 답변에도 화면의 사용자 질문을 보존한다.
2. 검색어/링크 존재만으로 검색 근거 확보 성공을 판정하지 않는다. `groundingSupports.segment`와 `groundingChunkIndices`로 실제 본문에 연결된 출처만 번호를 붙인다. 한글·이모지의 UTF-8 바이트 위치, 여러 part, thought 제외, 중복 주소, 잘린 구간, 잘못된 위치·URL을 검사한다.
3. 근거 없는 응답은 기존 재시도 1회 후 실패 안내, 월간/검색 사용량 복구, 성공 대화 미저장 경로를 유지한다. 첨부 오류와 빈 응답의 기존 처리도 보존한다.
4. 기록 사실·첨부 관찰·일반지식/AI 해석·외부 사실을 구분하도록 요청하고 공식 원자료를 우선한다. 과거 출처는 문장별 연결 미확인으로 표시하며 기존 운영 대화 원문을 고치지 않는다. 새 검색 캐시에 과거 연결 미확인 답변을 재사용하지 않는다.
5. 화면의 번호·출처 링크를 메모 저장에도 보존한다. 위험 주소와 자격 증명 포함 URL은 화면·메모에서 제외한다.

| 실행 | 결과 |
| --- | --- |
| `functions: npm run build` | 통과 |
| `node --test test/resultChatEvidence.test.js test/resultChatImages.test.js` | 16/16 통과 |
| `FIRESTORE_EMULATOR_HOST=127.0.0.1:8399 npm run test:result-chat` | 통과. fake Gemini 41회, legacy 11회, web search 경로 26회, 요금제 4종 |
| `frontend: npm run build` | 통과. 운영 키 없이 시험용 Firebase 설정으로 컴파일. 산출물 미배포 |
| `node --import tsx --test test/resultChatEvidence.test.mjs test/questionEnterSubmit.test.mjs` | 25/25 통과. 실제 출처 컴포넌트 SSR·메모 보존 포함 |
| `node test/questionInputs.policy.test.cjs` | 통과 |
| `git diff --check` | 통과 |
| Functions export 목록 비교 | 100개 동일 |

프론트 빌드에는 기존 큰 번들·정적/동적 import·Vite 설정 경고가 있다. 변경 범위 밖이므로 구조를 변경하지 않았다. SDK 의존성은 기존 작업본의 node_modules를 시험용으로 재사용했으며 추가 설치하지 않았다. 저장소 관례대로 빌드 생성물을 커밋하지 않는다.

## 실제 API 확인 범위

운영 키를 출력·저장하지 않고 메모리에서만 사용해, 개인정보나 사용자 기록 없는 공개 질문 1건을 `gemini-3.1-flash-lite`와 Google Search로 실행했다. 검색어 1개, chunk 4개, support 5개 중 출처 4개가 본문 인용으로 연결됐다. 출처에는 블로그도 포함되어 있어 **연결 성공만 확인했으며 답변 사실의 정확성·모든 자료의 권위를 검증한 결과가 아니다**. 이 관찰 뒤 공식기관 도메인·1차자료 우선 지침을 추가하고 최종 빌드를 통과시켰다. 추가 AI 호출이나 모델 변경은 앱에 넣지 않았다.

## 검토 기록과 남은 조건

- 독립 Claude 1회차 요청: [질문 원문](claude-request-01.md), [결과 원문](claude-result-01.json).
- 결과 원문: `Failed to authenticate: OAuth session expired and could not be refreshed`. 코드 검토가 실행되지 않았으므로 승인·수정 후 승인·재설계 판정은 없다. 로그인 갱신 후 동일 HEAD(또는 수정된 최신 HEAD) 검토가 필요하다. 실패 기록도 보존한다.
- Codex PR 검토·CI·운영 병합·배포·운영 E2E는 이 기록 시점에 완료로 판정하지 않는다. 검토 기록은 별도 새 파일로 추가한다.
- 배포 대상은 웹과 `chatWithResult`만이다. `asia-northeast3`, `users/{uid}/records/{date}`와 대화 하위 경로 유지. 환경변수·모델·사용량 상한·결제·인증·Rules 변경 없음.
- 운영 배포는 별도 승인 범위 확인 후 진행한다. 배포 후 사진 내용 질문, 외부검색 문장 인용, 근거 없는 응답, 메모 보존을 확인해야 한다. 기존 성공 근거를 무효화하거나 다른 영역 재시험을 요구하는 기록이 아니다.
- 출처 연결은 독립 의미·사실검증이 아니다. 발행기관·발행일이 SDK에서 확인되지 않으면 임의 생성하지 않는다. 기존 대화·운영 데이터 마이그레이션은 없다.
- 되돌리기: 본 구현 커밋을 되돌리고 웹과 `chatWithResult`만 승인 후 재배포. 저장된 대화 삭제는 포함하지 않는다.

## Slack

대표 개발 기록: https://harulab-hq.slack.com/archives/C0C11P98MHV/p1793695358296999
후속 구현·검토 상태는 같은 스레드에 기록한다. HEL·EEB 전파 보류 방침을 유지한다.
