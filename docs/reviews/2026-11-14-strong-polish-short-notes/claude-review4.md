4차 재검토를 시작합니다. 코드 HEAD 01403dd와 PR HEAD 4e3a3ab를 가져와 docs-only 여부, 3차 판정 원문, N1~N6 반영 코드를 직접 확인하겠습니다.

## 4차 재검토 판정: **승인**

- 검토 코드 HEAD `01403dd04c660f78cfb5f89389e1278c41b4bf58`, PR HEAD `4e3a3abb470224a5de4e1c338606df5b93294ce1`, base `384f856`.
- **docs-only 확인**: `git diff --name-status 01403dd..4e3a3ab`는 5항목 전부 `A docs/reviews/2026-11-14-strong-polish-short-notes/…`(claude-cli-attempt-question.md, claude-cli-attempt.md, claude-review3-question.md, claude-review3.md, codex-review-index.md)이고, `frontend`·`functions`는 두 커밋 사이에 바이트 차이가 없습니다.
- `claude-review3.md`·`claude-review3-question.md`는 제가 낸 3차 판정·받은 질문과 일치합니다. 파일·Git·서비스 수정, 외부 메시지는 하지 않았습니다.

### 직접 재현한 사실
- Functions build 성공, `polishContent.test.js` **43/43**; 프론트 `formatPolishRequest` 10 · `polishStrengthGuide` 3 · `polishCommentOptOut` 14 = **27/27**; `git diff --check` 통과.
- 서버 프롬프트는 3차 이후 변경 없음(d5dd3d4→01403dd 변경은 프론트 4파일) → 3차에서 확인한 `benchmark-final` 프롬프트 SHA-256 일치가 그대로 유효합니다.
- CI: PR HEAD 4e3a3ab에서 Deploy Preview·linux_x64_node22·build_and_preview 세 check run 모두 completed/success.
- Codex: 2026-11-14T01:30:13Z에 커밋 01403dd04c에 대해 "Didn't find any major issues". 색인 파일의 실행 6과 일치.
- PR 본문: 제목 "fix: 강 다듬기와 약강 안내 개선", Draft, 변경 파일 20, 커밋 10, 창작 강 허용 범위·토스트/다시 보지 않기·"웹 Hosting과 단일 Firebase Function `polishContent` 변경"·비용 증가, 롤백 절차·PREMIUM 보고 메모 분리·운영 E2E 미확인이 명시되어 있습니다.

### 3차 지적 N1~N6 처리 상태
| 지적 | 상태 | 대조 근거 |
|---|---|---|
| N1 토스트 잔존 | ✅ 해결 | `PolishStrengthSelect.tsx:43` `return () => toast.dismiss(GUIDE_TOAST_ID)`. 숨김 플래그 시 조기 return은 토스트가 없으므로 정리 불필요. 테스트 "선택 UI가 사라지면 … 닫는다"가 cleanup 호출을 단언. sonner 2.0.3 소스로 dismiss 후 같은 id 재생성이 재표시로 동작함을 확인(`create`가 `dismissedToasts`에서 id 제거 후 publish) |
| N2 숨김 후 정적 안내 | ➖ 허대표님 결정(숨김) | 코드 변경 없음, 결정대로 |
| N3 PREMIUM 창작 추정 위험 | ➖ 허대표님 결정(모델 유지+확인 안내) | 토스트 문구·"다시 다듬기 · 즉시 저장" 버튼·첫 화면 "결과를 확인하고 … 고쳐 저장" 유지 |
| N4 보수형 예시 "어렵다" | ➖ 분리 | `index.ts:2408-2410` 그대로. 분리 작업에 이 지점을 포함해야 함 |
| N5 잔존 문구 | ✅ 해결(별도 승인) | `SayuPage.tsx:4989`, `OnyuPreviewPage.tsx:59,489` 수정. 저장소 전체 재검색에서 "감정 그대로/표현만 다듬/내용은 바꾸지 않고" 잔존 0건 |
| N6 Codex 색인·PR 본문 | ✅ 해결 | `codex-review-index.md`에 실행 1~6(요청 링크·시각·대상 HEAD·결과 링크)과 2차 지적 1건의 반영 커밋 기록. PR 제목·본문 갱신 확인 |

### 승인을 바꾸지 않는 남은 위험·메모
1. **개발 모드 한정**: `main.tsx`가 `React.StrictMode`라 개발 서버에서는 효과가 mount→cleanup→mount로 두 번 실행되어, 정리의 `dismiss`(rAF 뒤 발행)가 두 번째 `toast.custom`보다 늦게 적용되며 토스트가 바로 사라져 보일 수 있습니다. 운영 빌드에서는 발생하지 않으므로, 토스트 실기기 확인은 **Hosting 프리뷰/운영 URL**에서 하십시오.
2. **CI 범위**: 두 워크플로는 Functions tsc·이미지/분류 테스트와 프론트 빌드만 돌리며, 이 PR의 `polishContent.test.js`와 `frontend/test/*.mjs`는 CI에 없습니다. 근거는 CC와 제 로컬 실행입니다(8.1 143행이 요구하는 로그는 PR에 첨부되어야 함).
3. **최신 HEAD Codex 해석**: 8.1 144행은 "최신 HEAD에 대한 Codex 재검토"를 요구하고, 정책에 docs-only 면제 조항은 없습니다. 4e3a3ab는 `docs/reviews/` 추가만이고 코드가 01403dd와 동일함을 제가 확인했으므로 면제가 합리적이지만, 수용 여부는 허대표님 판단입니다(`@codex review` 1회 추가로도 해소됨).
4. **배포 순서**: PR 본문에 순서가 없습니다. 3차 권고대로 `polishContent` 먼저 → `gcloud functions list`·region 실측 기록 → main 병합(Hosting). PWA 서비스워커로 구 번들이 기기에 남는 동안 구 프론트+신 서버는 보수적 출력에 그치지만, 역순이면 화면이 약속한 추정을 서버가 하지 않는 구간이 생깁니다.
5. **벤치마크 공백(변경 없음)**: 에세이·여행기록 창작 강 0건, 보고 그룹 "제목·일시·장소" 0건, 사례당 1표본. PREMIUM 창작 강이 다짐·행위를 단정한 사례(3차 N3)는 그대로 운영 위험으로 남고, 즉시 저장 경로에서 사용자 확인에 의존합니다.

### 작업 규모·8.1 멈춤 조건 (독립 검토자 확인 항목)
- **규모: 중** — 서버 프롬프트, 프론트 컴포넌트 3 + 페이지 3(첫 화면·SAYU·소개 미리보기), 새 UI(토스트+기기 저장), 배포 대상 2곳.
- **멈춤 조건 해당**: ① 홈화면 파일(`LandingPage.tsx`) 변경 ② 비용 증가(창작 강 입력 토큰 +33%, 짧은 일기 PREMIUM 출력 4~5배) ③ 품질 영향 변경(일기류 창작 허용) ④ 운영 완료 판정은 실기기 E2E 필요. 사용자 진술상 ①~③과 Hosting + `asia-northeast3` `polishContent` 단일 함수 배포는 허대표님이 이 대화에서 승인하셨습니다 — 저는 그 승인을 확인할 수 없어 **전제**로 적습니다. 커밋 메시지 10건은 내용과 일치. Rules·저장 경로·결제·인증 변경 없음.

### 운영 E2E 한계 (완료로 단정하지 않음)
실기기(모바일 포함)에서 ① 토스트 표시·닫기·다시 보지 않기·재방문 미표시, 월 한도 모달과의 겹침 ② FormatModal 일기 강 → 미리보기 → 저장 ③ SayuModal 다시 다듬기 강 → 즉시 저장 → 수정 가능 여부 ④ 보고·텃밭 강의 사실 보존 ⑤ 에세이·여행기록 창작 강 실제 출력 ⑥ 첫 화면·SAYU 문구 반영 ⑦ 함수 배포 후 region 실측 ⑧ 요청당 토큰·비용 추이 — 모두 미실시이며, 이 승인은 코드·테스트·합성 벤치마크·CI·Codex에 대한 판정입니다.
