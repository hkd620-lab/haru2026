# 독립 검토 4 — 결과 원문

- 대상 HEAD: `8a7e40d50b62e41a8c34c989411488ea4051be27`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 승인

검토 대상 HEAD는 8a7e40d50b62e41a8c34c989411488ea4051be27이고 코드 HEAD는 ffcfb97c입니다. 로컬 origin 참조가 4942bf81에 멈춰 있어서 `git ls-remote`와 `gh pr view`로 원격 최신 HEAD를 확인했습니다.
- `git diff --name-status ffcfb97c 8a7e40d5` 결과 6개 항목이 모두 `A`이고 경로가 `docs/reviews/` 아래입니다. 검토 기록 전용 커밋 예외에 해당합니다.
- `git diff --check 4942bf81 8a7e40d5`도 통과했습니다.

단, 아래 "새 지적" 1번(Codex 실행 4의 P2)이 8.1절 판정① 조건 3의 관문으로 남아 있습니다. 제 '승인'만으로 판정①을 적을 수는 없습니다.

## 직접 확인한 것
HEAD를 git archive로 scratchpad/r4에 풀어 실행했습니다. 저장소 파일과 브랜치는 건드리지 않았습니다.
- **frontend:**
  - `npm run test:record-stats`: 16개 통과, statsStorage 정책 테스트 통과
  - `vite build`: 성공
- **functions:**
  - scratchpad에서 `npm run build`(tsc): 오류 없음
  - `node --test test/epubContent.test.js`: 6개 통과
  - functions·Rules 변경은 4942bf81 이후 없습니다.
- **PR CI(8a7e40d5):** build_and_preview, Deploy Preview 모두 pass. MERGEABLE/CLEAN.

## 이전 지적 해결 여부

**E(메모 다음 행동 중복 집계)와 Codex 실행 3 P2(comment 4357217414): 해결**
- 위치: `frontend/src/app/records/recordStats.ts:623-627`. 같은 기록의 `memo_action` 문장 집합과 같은 본문 후보를 뺍니다.
- 직접 재현해 확인했습니다.

| 입력 | 결과 |
| --- | --- |
| action만 | 1개, auto |
| 두 칸에 같은 문장 | 1개, auto |
| action 여러 줄 | 1개, auto |
| 목록 기호 '- 치과 예약' | 1개, auto |
| 다른 기록의 같은 문장 | 기록마다 따로 셈(정상) |
| action 없음 | 이전과 같음 |

- 새 회귀는 없습니다. 테스트도 추가됐습니다(`recordStats.test.mjs:170-175`).
- Codex 실행 4(8a7e40d5)도 E를 다시 지적하지 않았습니다.

**A·B·C와 Codex 실행 2 P2:** 그 뒤 코드 변경이 recordStats의 메모 부분뿐이라 3회차 판단을 유지합니다.

## 남긴 항목 기록 상태
- **D(SayuModal의 garden_crop 채우기):** PR 본문 '후속 과제'에 기록돼 있습니다. 3회차 권고를 충족합니다.
- **특별한 날 키 이름(specialDays 맵, 사유 pet_special 충돌), EPUB 메모리 1GiB 상향:** PR 본문 '검토 반영'에 "허대표님 확인 대상"과 "허대표님 결정 대상"으로 적혀 있습니다. 충분합니다.
- **로딩 실패 표시, 전체 기간·작년 비교:** 후속 과제에 있습니다. 충분합니다.

## 새 지적

**1. [낮음~중간, 병합 차단은 아님 — 다만 8.1 조건 3의 관문] Codex 실행 4 P2가 아직 처리되지 않았습니다.**
- 출처:
  - 요청: issue comment 6360056196(07:43:34Z)
  - 결과: review 5625371664(2026-10-23T07:46:35Z, 커밋 8a7e40d5)
  - 지적 원문: comment 4357286425 "간편 기록 통계에서 비활성 프리미엄 칸을 제외하세요"
- 위치:
  - `recordStats.ts:623-627`(memo_action), `:636-637`(mission_prayer), `:647-648`(report_future)
  - 이 세 곳은 `_style`을 보지 않습니다. 반면 `getOriginalBody`(`:209-222`)는 `_style`을 따릅니다.
- 원인(확인함): `FormatModal.tsx:1266`의 `{ ...formData }`. '방식 다시 선택'으로 프리미엄에서 간편으로 바꿔도 프리미엄 칸이 남은 채 저장됩니다.
- 실패 시나리오(직접 재현):
  - 입력: `report_style:'simple'`, `report_simple:'다음 주 설문 조사 예정.'`, `report_future:'다음 달 간담회'`
  - 결과: 향후 계획에 '다음 달 간담회'(auto)만 1개 나옵니다. 간편 본문에 있는 계획은 빠집니다.
  - 선교보고 prayer도 같고, 메모는 남은 action이 '사실'로 셉니다.
- 차단하지 않는 이유:
  - 화면 표시용 계산이라 저장 데이터가 깨지거나 사라지지 않습니다.
  - 남은 프리미엄 칸은 기존 SAYU 원본 보기(`SayuPage.tsx:430`) 등 앱 다른 곳에서도 그대로 읽힙니다.
  - 칸에 내용을 넣은 뒤 방식을 바꾸는 좁은 경로에서만 생깁니다.
- 제안(몇 줄 수정): 세 형식의 칸 사실 집계와 '칸이 있으면 본문 대조 제외' 조건을 "본문이 프리미엄 칸에서 왔을 때"로 한정합니다. 기준은 `getOriginalBody`와 같은 판정입니다(style이 'simple'이고 `_simple`이 있으면 칸을 무시). 테스트로 위 재현 입력 1건을 추가합니다.
- 절차:
  - 8.1 조건 3에 따라 이 P2는 고치는 커밋을 내거나, CC가 반박해 독립 검토자가 받아들여야 해결로 봅니다.
  - 이 검토자는 후속 과제로 미루는 것도 타당하다고 봅니다. 다만 그 반박과 수용은 CC가 기록해야 합니다.
  - 고친다면 코드 변경이므로 Codex 재검토와 검토자 재검토가 다시 필요합니다.
  - 어느 쪽이든 실행 4를 담은 Codex 보조 색인 3을 새 파일로 추가해야 합니다. 현재 index-2는 실행 3까지만 있습니다.

**2. [비차단 메모]** 본문에 마침표가 붙은 '치과 예약.'과 칸의 '치과 예약'은 서로 다른 문장으로 봐서 두 번 셉니다. 이것도 재현했습니다. 표기가 다를 때만 생기므로 후속 과제로 충분합니다.

그 밖에 실제로 실패할 시나리오는 찾지 못했습니다.

## 규모·멈춤 조건
- **규모:** 대규모입니다(통계 화면 전면 교체, 새 저장 필드 specialDays·statsChecks·garden_crops, Functions exportEpub timeout 300초). 이전 판단을 유지합니다.
- **이번 반영으로 새로 생긴 멈춤 조건:** 없습니다.
  - 저장 경로는 users/{uid}/records 그대로입니다.
  - Rules·라우터·결제·인증·AI 호출 변경은 없습니다.
  - region은 asia-northeast3입니다.
- **판정①만으로 병합·배포할 수 있는 건이 아닙니다.** 허대표님 결정이 필요한 것:
  - 대규모 작업 승인
  - 특별한 날 키 이름
  - 메모리 1GiB 상향 여부
  - exportEpub 운영 배포와 실기기 PDF/EPUB 확인

검토 대상 HEAD SHA: 8a7e40d50b62e41a8c34c989411488ea4051be27 (코드 HEAD ffcfb97c)

확인용 파일은 모두 scratchpad에만 있습니다. 저장소 파일 수정은 없습니다.
- 풀어 놓은 HEAD: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/r4
- 재현 스크립트:
  - /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/tools/memo_probe4.mjs
  - /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/tools/style_probe4.mjs
````
