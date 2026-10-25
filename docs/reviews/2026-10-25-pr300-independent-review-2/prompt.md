독립 읽기 전용 재검토 2입니다. 구현 대화는 제공하지 않습니다. 파일 수정·외부 메시지·명령 실행·운영 API·병합·배포 금지. Read/Glob/Grep만 허용합니다.

저장소: /Users/heogyeongdae/Developer/HARU2026
PR: https://github.com/hkd620-lab/haru2026/pull/300
대상 HEAD: e2b90ca00894da99147a966bd36d4dc0edbc3a85
기준 main: 535cae73
요구: 독서장에서 본문 없는 질문 허용, 외부 AI 답변 가져오기.

먼저 이전 질문과 판정 원문 전체를 읽어 주세요:
- docs/reviews/2026-10-25-pr300-independent-review-1/prompt.md
- docs/reviews/2026-10-25-pr300-independent-review-1/reviewer-result.md
- docs/reviews/2026-10-25-pr300-independent-review-1/result.json
- docs/reviews/2026-10-25-pr300-codex-index-1.md
- docs/reviews/2026-10-25-pr300-independent-review-1/codex-review-comments.json

이전 판정: '판정: 수정 후 승인'. 차단 B1: 내부 AI 메모를 반영하면 외부 참고자료가 경고 없이 사라짐. Codex P2 2건: 같은 소실 문제와 긴 외부 답변 textarea maxLength 자동 잘림. 이전 판정 및 비차단 메모를 숨기지 말고 원문과 이번 수정을 대조해 주세요. 수정 후 승인 누적 1회.

반영 내역: services/readingAiCore.ts의 mergeInAppReadingReference가 기존 외부 답변을 유지하고 선택한 내부 답변·메모를 합치며 합산 3개/4,000자를 검사합니다. ReadingAiChat.tsx의 내부 확인 반영이 이 함수를 사용하고 실패 시 자료와 제안을 보존합니다. textarea maxLength와 useReadingAiChat.ts 복원 시 slice를 제거해 초과 원문을 보존하고 가져오기 검증에서 오류를 안내합니다. 이전 내부 답변 교체 방식은 유지합니다.

검증 근거: 프론트 17/17, 변경 프론트 tsc, 웹 합성 설정 빌드 통과. Functions 제품 변경 없음, 이전 8/8와 빌드 통과. 격리 실제 FormatModal에서 외부 자료가 있는 회차에 내부 질문→선택→제안→반영 후 외부 출처/원문과 내부 메모 동시 보존 확인. 3,253자 외부 답변 가져오기는 초과 오류, 입력 원문 유지, 새로고침→독서 초안 이어쓰기 후 전체 3,253자·끝표식 복원 확인. 운영 E2E나 실제 모델 검증이 아닙니다.

새 CI와 최신 Codex 리뷰는 별도 진행 중이며 통과 전에 병합하지 않습니다. 허대표님은 이번 건에 검토·CI 통과 시 병합·배포를 명시적으로 지시했습니다. 규모·멈춤 조건을 다시 확인하고 최종 '판정: 승인 / 판정: 수정 후 승인 / 판정: 재설계' 중 하나로 작성해 주세요. 운영 E2E 미확인과 별개로 설계·코드 판정을 해 주세요. 비밀값·개인정보·숨김 LibraryPage·보존 파일은 읽지 마세요.
