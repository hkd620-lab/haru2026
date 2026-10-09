# F-13~F-19 최종 검토·병합·Hosting 운영 배포 결과

판정: **✅ 승인된 두 PR 병합·Hosting 배포 완료 / 🔍 추가 실기기 E2E 필요**.

허대표님 지시 원문: “cc검토보고 최종확인후 병합 배포 승인”. CC 최종 의견과 독립 재검토 원문을 확인하고, 권고에 따라 #272를 먼저 병합·배포한 뒤 최신 main과 #271을 검증하고 #271을 병합·배포했다. 증거 브랜치의 앱 코드를 main에 병합하지 않았다.

## 검토와 승인 근거

- 독립 검토 1회 결과: `docs/reviews/2026-10-09-ledger-claude-independent-1-result.md` — 원래 두 PR “수정 후 승인”. 원문 보존, 필수 P2 빈 일반 장부 다운로드는 `ee741128`로 수정.
- 독립 재검토 2회 결과: `docs/reviews/2026-10-09-ledger-claude-independent-2-result.md` — “(a) PR #272 ee741128(최종 HEAD a261f482 포함): 승인.” / “(b) 두 PR 병합 상태(a4c8d034+ee741128): 승인(아래 조건).”
- 질문 원문 2개·결과 원문 2개·CC 의견 원문 1개를 #272에서 신규 파일로 추가하여 main에 함께 보존했다. 기존 원문은 고치지 않았다.
- #272 Codex 실행3: https://github.com/hkd620-lab/haru2026/pull/272#issuecomment-6080353221 — 검토 `1417a0d4`, 새 주요 지적 없음. 색인 `2026-10-09-record-feedback-codex-execution-3-result.md`.
- #271 Codex 실행5: https://github.com/hkd620-lab/haru2026/pull/271#issuecomment-6080373346 — 검토 `a4c8d034`, 새 주요 지적 없음. 색인 `2026-10-09-ledger-export-codex-execution-5-result.md`.
- 이전 모든 Codex 실행·지적·반영 커밋과 독립1차 원문을 다음 검토 질문에 함께 전달했다. 검토 이후 차이는 필터 없는 name-status로 A docs/reviews 신규 파일만 확인했다. 최종 CI는 각각 최종 HEAD에서 성공했다.
- CC 최종 감사 기록: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1791546480496259
- 비차단 P2·P3는 PR 본문에 명시하고 후속 이슈로 보존: https://github.com/hkd620-lab/haru2026/issues/273 . 후속 기능 구현은 승인된 것이 아니다.

## 순차 병합과 실제 Hosting 배포

| 항목 | PR #272 (먼저) | PR #271 (다음) |
|---|---|---|
| PR | https://github.com/hkd620-lab/haru2026/pull/272 | https://github.com/hkd620-lab/haru2026/pull/271 |
| 최종 작업 HEAD | `75b77e4bcc0730bb707c67eedd1b9e33c5163c29` | `1cf5465f9952ae779f50d28669b03ce0cd9b886e` |
| main merge SHA | `de9e1c25c3612b83dd2b355fde8ebff775c4d82f` | `69c371cce46f39f8720283167c037d099fede7af` |
| 병합 시각(UTC) | 2026-10-09T12:00:46Z | 2026-10-09T23:23:24Z |
| 운영 배포 run | https://github.com/hkd620-lab/haru2026/actions/runs/37927291456 | https://github.com/hkd620-lab/haru2026/actions/runs/38004176369 |
| 실제 hosting-deploy 단계 | SUCCESS, 2026-10-09T12:02:43Z | SUCCESS, 2026-10-09T23:25:03Z |
| 한국 시각 | 10/9 21:02:43 KST | 10/10 08:25:03 KST |
| Hosting version | `feaf683e2e409771` | `ab6eae926bf42a8a` |

대상 Firebase 프로젝트 `haru2026-8abb8`, Hosting live. GitHub Actions의 실제 `FirebaseExtended/action-hosting-deploy@v0` 단계와 전체 job 성공을 모두 확인했다. Functions·Rules는 배포하지 않았다. Hosting은 정적 배포이므로 Functions runtime/revision/traffic 변경은 해당 없음. Functions 리전 `asia-northeast3`, Firestore `users/{uid}/records/{date}`, Rules·환경변수·결제·인증·모바일·AI 호출/모델/비용 변경 없음.

## 최신 main 결합 검증

#272 배포 후 main `de9e1c25`와 #271 `1cf5465f`를 격리 검증본에서 결합했다. 실행자는 기장/Codex이며 CC가 실행했다고 표현하지 않는다. CC의 별도 실행 결과도 main에 원문 보존되어 있다.

- `git merge-tree --write-tree`: 충돌 없음. 후보 트리 `19a82145da26c13b7b789e2b03e8ed4b48e6d0da`.
- `git merge --no-commit --no-ff`와 `git write-tree`: 같은 후보 트리.
- `cd frontend && node --import tsx --test test/ledgerExportConsistency.test.mjs test/ledgerEmptyExport.test.mjs test/ledgerAmount.test.mjs`: **29/29 통과**.
- QA 가상 Firebase 환경값 `npm run build`: 성공(exit 0). `git diff --cached --check` 통과.
- 작업 재개 후 원격 main과 PR HEAD가 검증한 것과 동일함을 재확인했다. 임시 검증 폴더는 환경 재개 후 존재하지 않았지만 이전 실행 결과와 원격 대상 SHA는 일치했다.
- PR 첨부 검증 근거: https://github.com/hkd620-lab/haru2026/pull/271#issuecomment-6090952703
- 실제 #271 merge commit의 Git tree도 **`19a82145da26c13b7b789e2b03e8ed4b48e6d0da`로 정확히 일치**한다. 최종 부모는 `de9e1c25`, `1cf5465f`이다.
- CC 모의 모바일 하네스: 보정 p14 32/32, p17 4/4. p15 55/58·p16 42/43은 기존 범위 밖 F-21~F-25가 남아 전체 통과라고 기록하지 않는다. CC 관련 테스트 41/41.

## 공개 서비스 응답 확인

최종 배포 이후 운영 `https://haru2026.com/`과 Firebase 기본 도메인 `https://haru2026-8abb8.web.app/`을 Cache-Control no-cache로 읽었다. 둘 다 HTTP 200, 같은 HTML과 앱 자산을 반환했다.

- HTML SHA-256: `76a3885b8df96d9fc2fe19fc08159f0b76d1fe7c9c8050224a53873758ba9661`.
- 앱 자산: `/assets/index-BPWdtXBt.js`, 두 도메인 모두 HTTP 200, 5,754,285 bytes.
- 앱 자산 SHA-256: `d2d5bc6ef6475a522aed69cddd7414857e49f783eb1fc357683cc965aab6ab86`.
- 최종 운영 빌드 로그의 앱 파일명 `index-BPWdtXBt.js`와 일치한다.

이는 정적 자산의 실제 제공 확인이며 로그인 후 사용자 동작·실제 Excel·실기기 검증을 대신하지 않는다. 운영 테스트 기록 저장이나 실제 AI 호출은 하지 않았다.

## 남은 확인·주의와 다음 첫 행동

- 소득세 준비자료는 지출 0건이면 수입만 있는 기간의 요약 다운로드도 막는 현재 방식을 유지했다.
- 거래일 불명 거래는 일반 엑셀에서 입력일 대체, 신고자료에서 제외. SAYU 월 요약·버튼은 입력일 기준, 엑셀은 거래일 기준이다. 변경 여부는 #273에서 별도 결정한다.
- 허대표님 실기기 확인: 거래일 기준 월 엑셀 및 지출합계·공제값, 빈 기간 다운로드 없음, 사진 초과 장수 안내, 긴 글 오류 안내. 실제 Functions 응답·실제 Excel 열기·iOS Safari는 미확인이다.
- 이 기록은 증거 브랜치에 새 파일로 추가한다. 이 브랜치의 오래된 앱 코드는 main에 병합하지 않는다. main 직접 코드 수정·추가 배포 없음.
- 롤백이 필요하면 정확한 병합 커밋을 되돌리는 별도 PR로 검토한다. 두 건 전체 이전 기준은 `4db3ce79`; #271만 되돌릴 때에는 #272 상태 `de9e1c25`를 보존한다. 운영 데이터 마이그레이션/삭제나 캐시 강제 삭제를 하지 않았다.
- 다음 작업 전 실제 경로·branch/status, 원격 main·배포 상태와 #273의 대표 결정 여부를 확인한다. 미승인 범위 밖 수정은 시작하지 않는다.

난이도 **5.5 중간**.
