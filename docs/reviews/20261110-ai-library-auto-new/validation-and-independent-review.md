# 새 자료 자동 분류 · harulab · 본문 표시 검증

최신 검토 대상 HEAD: `25ba8ab46c38cd27361d38cf5219d7000a10f11d`.

사용자 요청에 따라 미래 새 자료만 Jev로 처리한다. 저장 시 직접 고른 6개 폴더와 수동 이동을 보존하며, harulab은 앱 개발 자료의 수동 폴더다. 배포 범위에 harulab을 포함한다. 원문과 출처는 바꾸지 않는다.

## 필수 검증

- Functions build 통과. 자동 처리10, folder/review/parser/import30 통과. 기존 분류 전체82/82 통과.
- Frontend build 통과(합성 Firebase 환경, 실제 Hosting 빌드는 CI의 운영 설정). ai-import36 시험 통과. 코드 fence 유무와 빈 줄·탭 보존 포함.
- 확장13/13 통과. 합성 mounted UI28개 ALL PASSED.
- export 변경은 classifyNewAiLibraryLog 한 개 추가. region asia-northeast3, Node22. 기존4개 함수는6개폴더 지원 재배포 필요.
- 현재 설치본5개 핵심파일 SHA-256이 추적 baseline과 일치. 원본10개파일 LaCie 새 폴더 복사 후 해시비교 완료.

## 독립 검토 원문

| 회차 | HEAD | 시작(UTC) | 종료(UTC) | 판정 |
|---|---|---|---|---|
| 1 | 6d8ad3afc99bae556e29c51670acb50024ece56b | 2026-11-10T10:16:08.546143+00:00 | 2026-11-10T10:21:36.039101+00:00 | 승인 |
| 2 | 1b3b3f4939e6d290bfaca7fc16f379aae1aba2b5 | 2026-11-10T10:46:13.288156+00:00 | 2026-11-10T10:49:05.813812+00:00 | 수정 후 승인 |
| 3 | 09b31ddf11d6dcbe27248a01e0c85c5217eeeb01 | 2026-11-10T11:00:18.689845+00:00 | 2026-11-10T11:01:48.018896+00:00 | 승인 |
| 4 | 25ba8ab46c38cd27361d38cf5219d7000a10f11d | 2026-11-10T11:34:21.064645+00:00 | 2026-11-10T11:35:40.023483+00:00 | 승인 |

각 회차 `claudeN-prompt.txt`, `claudeN.raw.json`, `claudeN.meta.json`, `claudeN.err.log`를 원문 그대로 보관했다. 이전 검토 원문을 다음 검토자에게 모두 제공했다. 수정 후 승인 누적1회. 최종 판정 원문: **“독립 재검토(4회) 판정: 승인”**.

M1 배포 범위 누락, M2 처리중 문구, L3 fence 코드 들여쓰기, N1 시험 taxonomy 불일치와 Codex fence없는코드 들여쓰기 지적 모두 수정. L4 전체기록 이벤트 즉시필터/maxInstances2, L5 요청 생성 실패도 보수 예약, L6 한줄 fence 표기 시 나머지 코드 표시, L7 들여쓴 줄 포함시 전체구조를 pre로 보존하며 검색 강조 제한은 독립 검토자가 비차단으로 수용했다. 저장·복사 원문에는 영향 없음.

## 운영 범위와 제한

지정 Functions5개(classifyNewAiLibraryLog/saveAiLibraryImport/listAiLibraryLogs/moveAiLibraryLog/listAiLibraryReviews) → Hosting → 기존 확장 업데이트. 기존 일괄 AI callable, accountDeletion, Rules 배포 없음. autoNew만 미래시점 활성화, 일 $1 보수예약상한. 기존745건 재전송 없음. 기존 runtime 설정 미변경. 합성3건으로 운영 E2E 후 그3건만 정리하고 immutable attempt/예산 이력 유지.

Slack 읽기 검색에서는 이전 PR367 알림 한 건이 확인됐으며 최신 작업의 배포 완료 기록은 없었다. Slack 메시지는 전송하지 않았다. 이 문서는 운영 완료를 주장하지 않으며 이후 운영 증거에서 실제 배포 상태를 기록한다.
