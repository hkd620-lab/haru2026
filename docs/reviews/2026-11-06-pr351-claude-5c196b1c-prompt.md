# PR 351 독립 Claude 코드 검토 — 질문 원문

- 실행 시각: 2026-11-06
- 검토 대상 HEAD: `5c196b1c` (현황 카드 구현 커밋 1개)
- 검토자 모델: Opus 5.5 (작업 맥락 없는 별도 에이전트)
- 전달한 것: 저장소 경로, 브랜치·PR 링크, 설계 문서 경로, 검토 관점. CC의 검증 결과와 판단은 넘기지 않음

---

당신은 작업 맥락을 공유하지 않는 독립 코드 검토자입니다. 읽기 전용으로만 작업하세요(파일 수정·커밋·push·PR 코멘트 금지, 빌드 산출물 외 쓰기 금지).

대상: /Users/heogyeongdae/Developer/HARU2026 저장소의 브랜치 feature/home-month-progress-card (PR https://github.com/hkd620-lab/haru2026/pull/351). 비교 기준은 origin/main 입니다. `git diff origin/main...HEAD` 와 새 파일을 읽으세요.

배경: React+TS+Firebase 앱의 홈 화면에 '이번 달 기록 현황 카드'를 추가한 변경입니다. 설계 문서는 docs/HARU2026_홈_이번달_기록현황_카드_설계.md 입니다(먼저 읽으세요). 변경 파일: frontend/src/app/records/monthProgress.ts, monthProgressController.ts, hooks/useMonthRecordProgress.ts, components/MonthProgressCard.tsx, pages/HomePageV2.tsx(일부), frontend/test/monthProgress.test.mjs, frontend/package.json.

검토 관점(설계 문서 기준으로 구현이 맞는지, 그리고 설계가 놓친 버그가 있는지):
1. 집계 정확성: 11개 형식(STATS_MERGE_RECORD_FORMATS), 비서 기록 제외(isAssistantRecord), 월초~오늘, date 문자열 형태(시각 접미사 등), 중복 id, 정렬.
2. 구독 수명과 경쟁 상태: 계정 전환, 월 경계, 자정, 다시 시도, 시간 초과 후 늦은 확정, 오류 콜백 뒤 리스너 종료, 언마운트 정리, React StrictMode 이중 effect, 훅의 uid 불일치 렌더.
3. 서버 확정 전 숫자 숨김과 오프라인 표시가 실제 Firestore onSnapshot(includeMetadataChanges) 의미와 맞는지. Firestore 쿼리(where 두 개 + orderBy 같은 필드)가 별도 복합 색인 없이 동작하는지.
4. 접근성·문구·모바일 레이아웃(14px 이상, 터치 영역), SAYU로 이동하는 route state(filterFormat, openRecordId)가 SayuPage에서 실제로 쓰이는 값인지.
5. 읽기 전용 원칙(쓰기·새 컬렉션·AI 호출 없음)과 Firestore 경로 원칙(users/{uid}/records).
6. 테스트가 실제로 위험을 잡는지(약한 단언, 빠진 시나리오).

가능하면 `cd frontend && node --import tsx --test test/monthProgress.test.mjs` 를 실행해 결과를 확인하세요. 타입 검사는 typescript 미설치라 불가합니다.

보고 형식: 심각도(높음/중간/낮음)별 발견 목록. 각 항목에 파일:줄, 근거 코드 발췌, 재현 시나리오 또는 수정 제안 스케치를 쓰세요. 확신이 없는 항목은 '추정'이라고 표시하고, 문제가 없다고 확인한 영역도 한 줄씩 적으세요. 마지막에 '병합 가능 / 수정 후 병합 / 병합 불가' 중 하나로 판정하세요.
