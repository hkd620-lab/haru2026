# PR #291 독립 검토 1 — 기록형식별 통계·합본·EPUB

- PR: https://github.com/hkd620-lab/haru2026/pull/291 (head `cc/stats-merge-epub`, base `codex-write-then-format` = PR #290)
- 검토 대상 HEAD: `b4dfdd436190c321fea061e8a234014e6007b2bc`
- 검토자: 작업 맥락을 넘기지 않은 별도 Claude 에이전트(Opus, 읽기 전용, 별도 worktree)
- 질문 원문: [prompt.md](prompt.md) / 결과 원문: [reviewer-result.md](reviewer-result.md)
- 판정 원문: **"판정: 수정 후 승인"** (같은 건 '수정 후 승인' 1회째)
- 같은 HEAD의 Codex 리뷰: [codex-github-reviews.json](codex-github-reviews.json)(review 5625030048), 지적 1건 [codex-github-comments.json](codex-github-comments.json)(comment 4357019974, P2 "Preserve selected crop arrays through the record save handler")

## CC 반영 내역(커밋 `8baecf98`)

| 지적 | 반영 |
| --- | --- |
| 1 텃밭 garden_crops 미저장(Codex P2 동일) | RecordPage 저장 경계에서 `garden_crops` 문자열 배열 통과. 텃밭일지는 세 경로 모두 빈 배열도 저장(해제 반영). 옛 기록 편집 시 `garden_crop` 문자열로 선택 복원. `test/statsStorage.policy.test.cjs` 추가 |
| 2 특별한 날 키·옛 값 삭제 | 옛 숫자 `_rating` 삭제를 업무일지(`work_rating` 숫자 0/1)로 한정. `형식_special` 대신 `specialDays` 맵을 쓴 이유(반려동물 `pet_special` 입력 칸 충돌)를 코드 주석·Slack·PR에 기록. **키 이름 차이는 허대표님 확인 대상** |
| 3 EPUB 시간·HEAD | timeout 120→300초, 사진 확인 5초·동시 12개, HEAD 실패 시 1바이트 GET 재확인, 라이브러리 fetchTimeout 15초·재시도 2회. **메모리 1GiB 상향은 비용 증가라 허대표님 결정 대상으로 남김(512MiB 유지)**. 운영 사진 다수 EPUB 생성 확인은 미실시 |
| 4 500개 초과 | 합본 뷰어에서 500개 초과 시 서버 호출 전에 "기간을 나눠 주세요" 안내 |
| 5 상한·실패 혼동 | `skippedPhotos`(내려받기 실패)와 `limitedPhotos`(200장 상한)로 나눠 안내 |
| 6 내보내기 노출 | `isExportBodyExcluded`에 `specialDays`·`statsChecks`·`garden_crops` 추가 |
| 7 기분 빈 값 | SayuModal 편집 저장에서 기분을 고른 경우에만 `mood` 저장 |
| 8 로딩 실패·updatedAt | 기존 `getRecordsInRange`의 오류 처리 동작이라 이번 범위에서 바꾸지 않음. 후보 확인 시 `updatedAt` 갱신은 같은 기록 문서 수정이므로 의도대로 둠 |
| 9 결정 ⑥ 프리미엄 일부 | 프리미엄 미출시라 '전체 기간·작년 비교'는 보류로 기록(직접 선택만 구현) |
| 10 lookbehind | `splitSentences`에서 lookbehind 제거, 정책 테스트로 재발 방지 |

재검토 시 이 표와 이전 판정 원문을 함께 넘긴다(운영정책 8.1).
