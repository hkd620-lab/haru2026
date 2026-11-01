# 판정① 조건 대조 — PR #319 (sharp 0.35.5)

CC가 근거를 모은 보조 기록이다. CC 자신의 승인이 아니며 Slack 판정 게시도 아니다. 작성 시점에 Slack은 지시에 따라 접근하지 않았다.

- 기준 main: `a8a8a6b8`
- 제품 최종: `67386e69c5299eaf46f2a1070a902f8217ab6152`
- 최신 검토 대상 HEAD: `871a1f64ff17b968750b32dea3ec22db54ca4cef`

| 조건 | 상태 | 근거 |
|---|---|---|
| 1. 최신 HEAD CI | `871a1f64` 전부 success. **최종 HEAD는 부모 확인 대기** | [verification-evidence-index.md](verification-evidence-index.md) 1절 |
| 2. Functions 필수 검증 | 빌드·시험·export diff 기록 있음. Linux Node 22 14/14, exports 114. **PR 첨부 여부는 확인 필요** | [node22-supplement.md](node22-supplement.md), `ci-linux-first-67386e69-raw.json` |
| 3. Codex | `871a1f64` 완료, 지적 0. 67386e69 완료, 지적 0 | [codex-index-1.md](codex-index-1.md) |
| 4. 독립 검토 | 독립2 판정 "승인", 독립3이 제품 승인 유지. 수정 후 승인 0회 | [independent-review-index.md](independent-review-index.md) |
| 기록 전용 예외 | `871a1f64` 뒤는 `docs/reviews/` 새 파일 추가만 | [record-only-exception.md](record-only-exception.md) |

조건 2의 PR 첨부 여부는 이번 실행에서 `gh pr view`가 권한 거부되어 확인하지 못했다. 우회하지 않았다. PR 현재 상태(draft, mergeable)도 같은 이유로 확인 필요다.

제품 승인과 별개로 병합·배포 권한은 확정되지 않았다. 남은 위험과 범위는 [residual-risks-and-scope.md](residual-risks-and-scope.md)에 있다.

## 재시험

불필요한 재시험은 하지 않았다. 독립2·3 모두 필수 재시험이 없다고 판단했고, `871a1f64` 뒤에 제품 변경이 없다. main이 움직여 제품 파일이 달라지면 재검토가 필요하다. 이 기록 작성 시 원격 main은 `a8a8a6b8`였다.
