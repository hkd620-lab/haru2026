# PR #291 독립 검토 2 — 기록형식별 통계·합본·EPUB

- 검토 대상 HEAD: `5afe4b9e97627ef6419729ea2d580a266bc99520`(코드 반영 `8baecf98` + 검토 기록 전용 커밋)
- 질문 원문: [prompt.md](prompt.md)(이전 판정 원문·CC 반영 내역 경로를 함께 넘김) / 결과 원문: [reviewer-result.md](reviewer-result.md)
- 판정 원문: **"판정: 수정 후 승인"** (같은 건 '수정 후 승인' 2회째)

## CC 반영 내역(커밋 `5fecb9f4`, `d7efa1e3`)

| 지적 | 반영 |
| --- | --- |
| A SAYU 원본 칸·다시 다듬기에 garden_crops 배열 유입(TypeError) | SayuPage 원본 칸 수집에 `typeof record[key] === 'string'` 조건, SayuModal 다시 다듬기 필터를 `typeof v === 'string' && v.trim()`으로 방어. 정책 테스트 추가 |
| B 빈 배열이 본문 대조를 끔 | 고른 작물이 1개 이상일 때만 사실로 보고, 빈 배열은 등록 작물 본문 대조(본문 후보)로 넘김. 통계 테스트에 `garden_crops: []` + 본문 언급 사례 추가 |
| C 옛 garden_crop 문자열 복원 | 옛 기록은 빈 선택으로 시작(등록 작물 전체·자유 문장을 고른 작물로 복원하지 않음). 정책 테스트 추가 |
| D SayuModal이 비어 있는 garden_crop에 등록 작물 전체를 채움(기존 코드) | 이번 범위에서 고치지 않고 후속 과제로 기록(통계는 garden_crops를 써서 수치 영향 없음) |
| Codex 실행 2 P2(comment 4357171271) EPUB 호출 제한 시간 | `httpsCallable(..., { timeout: 310_000 })`로 서버 300초를 수용(`d7efa1e3`). 정책 테스트 추가 |

남긴 항목(검토자 '타당' 판단): 특별한 날 키 이름 차이·메모리 1GiB(허대표님 확인 대상), 로딩 실패 표시·updatedAt(기존 동작), 프리미엄 전체 기간·작년 비교(출시 전 보류).
