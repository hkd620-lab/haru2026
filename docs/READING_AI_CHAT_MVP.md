# 독서사유 AI 독서대화 MVP 구현·검증 기록

판정: **구현·로컬 검증 완료 / 운영 E2E 필요**. 작업 난이도: **5.5 높음**.

기준 main: `b2938efb`. 작업 브랜치: `feature/reading-ai-chat-20261006`.
운영 main 병합·Functions 배포는 수행하지 않았다. 아래 브라우저 검증은 실제 `FormatModal`과 합성 기록·모의 AI/Firestore로 진행했다.

## 1. 기존 기능 조사 결과

- 책 제목/저자에서 결정적인 ID를 만드는 `makeReadingBookId`, 기존 책 선택과 회차 편집, 마무리 책 차단이 존재한다.
- 회차는 `users/{uid}/records/{recordId}`에 개별 저장된다. 기존 일별 records 컬렉션/저장 서비스를 변경하지 않는다.
- canonical `readingId`, `entryType: readingNote/finalReflection`, `readingStatus`와 legacy `readingBookId`, `readingEntryType: chapter_note/final_reflection`을 함께 지원한다.
- `extractReadingBookTextFromPhoto`는 Gemini Vision으로 OCR하고 본문을 누적한다. 이미지 원본은 요청 메모리에서만 처리한다. 권당 20장/월간 OCR 한도와 개발자 예외는 유지했다.
- `handleSaveChapterNote`는 `polishContent`로 강도 6 수준 정리를 요청하고 SAYU를 저장한다. 기존 마무리 분석·자기성찰·최종 저장도 유지했다.
- `chatWithResult`는 저장된 기록의 결과/sourceKey를 검증하는 구조다. 저장 전 본문과 직접 대화하기에는 제약이 있어 독서 전용 callable을 추가하고 공통 제한·로그 모듈을 재사용했다.

## 2. 추가한 사용자 기능

현재 본문 아래의 ‘AI에게 물어보기’를 누르면 같은 화면에서 자유 질문과 연속 대화가 열린다. 빠른 질문은 보조 입력이며 직접 질문을 막지 않는다.

답변을 최대 3개 선택해 AI 참고 메모를 제안받고 수정한 뒤 반영할 수 있다. 반영은 자동 저장이 아니다. 실제 사용자 질문만 `reading_journal`에 추가하고 AI 답변/메모는 별도 필드에 둔다. ‘내 생각 추가’는 독서장 입력으로 이동한다. 임시 대화 삭제는 이미 저장한 SAYU나 사용자의 독서장을 삭제하지 않는다.

사용자·책·편집 회차별로 대화를 격리했다. 닫기/새로고침 시 저장 전 본문·독서장·대화를 복구할 수 있다. 초안은 해당 브라우저에서 7일 동안 이어쓸 수 있으며 만료 데이터는 다음 독서 편집기 열기 시 정리한다. 서버에는 자동 저장하지 않는다. 한 사용자당 복구 배너는 가장 최근 작성 초안을 제공한다.

## 3. 수정한 파일과 역할

| 파일 | 역할 |
| --- | --- |
| `frontend/src/app/components/FormatModal.tsx` | 기존 OCR/저장/마무리 흐름에 모듈 연결, 초안 복구, 기존 책 ID 보존, 책 변경 시 이전 데이터 분리 |
| `frontend/src/app/components/ReadingAiChat.tsx` | 질문, 대화, 답변 선택, 제안 확인/수정, 오류와 사용량 표시 |
| `frontend/src/app/components/ReadingBookFields.tsx` | 상단 제목/저자 입력과 기존 책 잠금 |
| `frontend/src/app/hooks/useReadingAiChat.ts` | 연속 대화·요약 메모리·중복 호출 방지·책별 로컬 세션 |
| `frontend/src/app/hooks/useReadingDraft.ts` | 작성 초안 복구, 저장 성공 후 정리, 계정 변경 시 잘못된 초안 복사 방지 |
| `frontend/src/app/services/readingAiService.ts` | 서울 리전 callable 요청 및 컨텍스트 크기 제한 |
| `frontend/src/app/services/readingAiCore.ts` | 사용자 질문/AI 참고자료 분리, 최근 기록 요약, 마무리 스냅샷, 책 변경 초기화 |
| `frontend/src/app/services/readingDraft.ts` | 사진 제외 로컬 초안 직렬화, 만료 정리 |
| `frontend/src/app/types/readingAi.ts` | 대화 역할, 요청 컨텍스트, 참고자료와 사용량 타입 |
| `functions/src/index.ts` | `chatWithReadingContext` export |
| `functions/src/readingAi.ts` | Gemini와 공통 rate limit/월간 사용량/사용 로그 연결 |
| `functions/src/readingAiCore.ts` | 서버 입력 검증, 역할 분리 프롬프트, 응답 검증, 실패 환급 orchestration |
| `frontend/test/readingAi.test.mjs` | 분리 저장·긴 대화·ID/legacy·초안·오류 회귀 테스트 |
| `functions/test/readingAi.test.js` | 로그인·한도·입력 제한·연속 컨텍스트·실패 환급 테스트 |
| `frontend/test/reading-ai-browser/*` | 실제 FormatModal을 실행하는 격리 브라우저 검증 환경 |
| `frontend/package.json`, `functions/package.json` | 독서대화 테스트 및 격리 검증 실행 명령 |
| `docs/READING_AI_CHAT_MVP.md` | 조사·설계·검증·운영 이월 기록 |

모바일, 라우터, Firestore Rules/인덱스, 기존 OCR/요금제 정책은 변경하지 않았다. 빌드가 생성한 `functions/lib/index.js`는 커밋에 포함하지 않는다. 배포 시 기존 Functions build가 소스를 컴파일한다.

## 4. 데이터 구조 변경

기존 records 문서에 선택적으로 `reading_ai_context` 문자열(JSON)을 추가한다. 기존 문자열 기반 formData 저장 규칙과 호환되며 마이그레이션은 필요 없다.

```ts
{
  version: 1,
  bookId: string,
  questions: string[], // 사용자가 실제로 보낸 선택 답변의 질문, 최대 3개
  selectedAnswers: { question: string; answer: string }[], // 선택한 AI 답변만
  aiMemo: string // 확인·수정한 AI 참고 요약, 최대 4000자
}
```

필드가 없는 기존 기록도 그대로 읽는다. 다른 bookId의 참고자료는 반영/저장에서 제외한다. 전체 채팅은 Firestore에 무조건 저장하지 않는다. 새 컬렉션이나 책 원문 마이그레이션을 만들지 않았다.

## 5. AI 호출 구조

- 함수: `chatWithReadingContext`, `asia-northeast3`, `gemini-3.1-flash-lite`.
- 우선순위: 현재 본문 → 사용자 독서장 → 같은 책의 이전 독서장/확보 본문 발췌 → 책 제목/저자.
- 최근 본문 최대 12,000자, 독서장 3,000자, 이전 기록 3,000자(최근 6회), 질문 1,000자.
- 최근 대화 최대 12개 메시지/총 12,000자와 1,600자 요약 메모리를 전달한다. 로컬 대화 표시는 최근 60개 메시지까지 유지한다.
- 제공되지 않은 책 전체/다음 장을 아는 척하거나 본문을 장문 재출력하지 않도록 지시한다. 데이터 내부 지시문을 시스템 원칙으로 취급하지 않는다.
- 모든 요청에 로그인 확인, 공통 `enforceRateLimit`(분당 10/시간당 60), `reserveMonthlyAiQuota`가 적용된다. 질문과 참고 메모 제안 각각 1회를 차감한다.
- 공통 무료/베이직/프리미엄/개발자 정책을 그대로 사용한다. 신규 함수용 별도 무료 우회 경로는 없다.
- 제공자 timeout은 45초, callable은 60초다. AI 실패/잘못된 JSON 응답은 예약 사용량을 환급한다. 토큰·모델·성공 여부만 공통 사용 로그에 남긴다.
- 독서장 저장과 최종 분석은 기존 `polishContent`/SAYU 흐름을 이용한다. AI 참고자료의 출처를 명시하고 사용자의 생각으로 바꾸지 않도록 지시한다. 마무리 입력은 기존 5,000자 제한 안에서 여러 회차를 나눠 담아 새 회차가 통째로 잘리지 않게 했다.

## 6. 개인정보·저작권 대응

기존 OCR 이미지 임시 처리 원칙을 유지한다. 새 AI 대화 함수는 이미지/base64 입력을 받지 않으며 Storage에 사진을 저장하지 않는다. 앱의 신규 AI 사용 로그에는 본문·질문·대화·제공자 오류 원문을 기록하지 않는다.

본문은 사용자가 저장할 때 기존 `reading_book_text`에 남고, 선택한 질문/답변만 기존 records 문서의 별도 필드에 저장된다. 초안에는 사진·base64를 넣지 않는다. AI 공급자로 본문/대화가 전송되는 사실과 공급자의 보존 정책은 별개이며, 공급자 측 보존이 없다고 주장하지 않는다.

EPUB/PDF 수집, 책 전체 복제, DRM 우회, 상용 전자책 접근은 추가하지 않았다.

## 7. 테스트 결과

- 신규 기능 테스트: 프론트 11개 + 서버 7개 통과.
- 기존 월간 AI/OCR 정책 테스트 통과. SAYU 모바일 읽기 정책 및 기존 저장 결과 열기 19개 회귀 테스트 통과.
- 프론트/Functions production build 통과. 새 8개 프론트 모듈의 strict 타입 검사 통과.
- 전체 프론트 타입 검사는 기존 `ExportModal.tsx` 구문 오류 때문에 실패한다. 수정 전 main archive와 전체 진단이 동일하다. FormatModal 의존 그래프의 기존 타입 진단도 경로/행번호를 정규화해 비교했으며 추가 진단이 없다. 프로젝트에 별도 lint 명령은 없다.

실제 브라우저에서 아래 버튼/입력을 직접 조작했다. AI와 Firestore 응답은 합성 fixture다.

| 시나리오 | 결과 |
| --- | --- |
| 신규 책 → 사진 선택 → OCR → 질문 → 추가 질문 → 선택 반영 → 회차 저장 | 통과, 역할별 저장 데이터 확인 |
| 기존 책 선택 → 제목/저자 재입력 없이 OCR/질문 → 이전 기록 연결 → 다음 회차 | 통과, 같은 readingId로 2회 누적 확인 |
| OCR 추가 | 기존 본문 뒤에 누적, 이전 저장 회차 원문 유지 |
| 여러 회차 → 마무리 분석 → 자기성찰 → 최종 SAYU | 통과, 실제 사용자 질문과 출처 표시 참고 메모 포함 확인 |
| 마무리 후 이어쓰기/직접 제목 입력으로 추가 시도 | 목록 제외 및 저장 차단 확인 |
| 본문 없음/빈 질문/AI 실패/월간 한도/네트워크/OCR/저장 실패 | 안내와 본문·질문·독서장 보존 확인 |
| 모달 닫기·재진입·새로고침 | 초안과 책별 대화 복구 확인 |
| 다른 책으로 전환 | 이전 책 대화가 신규 책 대화로 섞이지 않음 |
| 좁은 화면 | 독서장 너비가 부모 너비 이내이며 가로 넘침 방지 확인 |

## 8. 기존 기능 회귀 여부

책 ID·legacy 필드 호환, 책별 누적, 권당 OCR 제한/개발자 예외, 원본 사진 비저장, 기존 회차 편집/마무리/SAYU 저장을 유지했다. 새 책 전환 시 이전 책의 완료 상태·OCR·AI 필드를 초기화해 책 사이에 섞이지 않도록 했다.

다른 기록 형식의 처리 흐름이나 8개 주요 화면의 라우팅/import를 변경하지 않았고 전체 앱 production build로 연결을 확인했다. 모든 기존 화면의 운영 사용자 동작을 직접 검증했다는 의미는 아니다.

## 9. 남은 문제와 다음 행동

1. 새 callable을 운영에 배포하지 않았다. Hosting PR preview만 배포해도 실제 독서대화 함수가 자동 배포되는 것은 아니다.
2. 실제 Gemini 답변의 근거성/문체/AI와 사용자 생각의 귀속, 실제 로그인 계정의 제한/Firestore 저장 E2E는 승인 후 추가 확인해야 한다.
3. 이전 기록은 최근 6회 발췌이며 대화/마무리 입력도 크기가 제한된다. 책 전체 기억이나 전체 독서기록의 무손실 장기 분석은 이번 MVP의 범위가 아니다.
4. 초안 복구는 해당 브라우저의 최신 작성 초안이며 기기 간 동기화가 아니다. 브라우저 저장소가 막히면 안내하고 서버 자동 저장으로 대체하지 않는다.
5. 기존 전체 프론트 타입 오류는 이번 범위에서 수정하지 않았다.

운영 승인 후: 해당 브랜치의 `chatWithReadingContext`만 `haru2026-8abb8`에 배포 → PR preview에서 실제 계정으로 신규/기존 책 연속 질문·선택 반영·저장·마무리 검증 → main 병합/Hosting 자동 배포 → 운영 최소 흐름 재확인.

승인 기준: `AGENTS.md`의 ‘사용자 승인 없는 main 직접 push, 대규모 병합, 운영 배포 금지’.
연결된 Slack 도구가 없어 게시하지 않았다. 최종 채팅 보고에 Slack 기록용 확정 요약을 제공한다.
