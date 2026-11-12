# PR #390 독립 Claude 검토 원문

- 검토 대상 HEAD: `450336b9b9f5fbcbe4fcbae578747839fc6188df`
- 요청 시각: 2026-11-12T11:04:56.244Z
- 완료 시각: 2026-11-12T11:06:56.680Z
- 이전 판정 원문: PR #389 검토 기록 참조. 검토 요청에 이전 판정을 명시함.

## 질문 원문

독립 재검토 요청입니다. 이전 판정 원문은 이 대화의 1차 「수정 후 승인」 및 2차 「승인」 응답 전체입니다. 같은 재미 영상 기능의 후속 PR #390, 구현 HEAD 450336b9b9f5fbcbe4fcbae578747839fc6188df를 검토하세요. 작업 폴더는 /private/tmp/haru-fun-videos-review-20261112 입니다. 해당 작업 폴더에서 git diff origin/main...450336b9, firestore.rules, FunVideosPage.tsx, functions/test/funVideos.emulator.test.mjs를 읽으세요. 로컬 빌드 2건과 Firestore 에뮬레이터 테스트 4/4 통과는 실행자 보고이며, 직접 실행 가능하면 검증하세요. 파일 수정·Git 변경·외부 메시지 금지. 한국어로 판정(승인/수정 후 승인/재설계), 구체적 지적, 작업 규모와 8.1 멈춤 조건, 검토 HEAD·근거를 작성하세요.

## 결과 원문

**1) 판정: 승인** (HEAD `450336b9b9f5fbcbe4fcbae578747839fc6188df`)

코드와 보안 설계에 차단 이슈는 없습니다. 다만 Rules 변경이라 허대표님 승인이 필요합니다(3번). 8.1 판정① 절차도 아직 닫히지 않았습니다(2번 4항).

**2) 구체적 지적**

직접 확인한 사항:
- **변경 범위**: `git diff origin/main...450336b9`는 `firestore.rules`, `FunVideosPage.tsx`, `functions/test/funVideos.emulator.test.mjs` 3개 파일입니다. Functions 소스는 바뀌지 않았고 `git diff --check`도 통과했습니다.
- **기준 브랜치**: `origin/main`은 `3ed092ba`이고, 이 커밋에 #389가 병합돼 있습니다(병합 시각 2026-11-12T10:50:36Z). 이 PR은 그 위에 올라온 단일 커밋입니다.
- **Rules**: `funVideosTrash`의 읽기와 삭제는 관리자만 가능합니다. 생성은 관리자만 하며 필드를 5개(`title`, `videoId`, `url`, `createdAt`, `deletedAt`)로 고정하고 `hasOnly`와 `hasAll`을 함께 검사합니다. 문서 ID, `videoId`, URL, 제목 길이, 두 시각의 타입도 검사하고 `update`는 `false`입니다. `funVideos` 규칙은 그대로이고, `getFunVideos`는 `funVideos`만 읽으므로 휴지통은 구독자에게 노출되지 않습니다.
- **프런트**: 삭제와 복원이 `writeBatch`로 원자적입니다. 휴지통 구독과 보관함 UI는 `isDeveloper`일 때만 나타납니다. 삭제한 영상과 같은 링크를 다시 게시하는 것은 `isRemovedDuplicate`로 막습니다. 외부 링크는 지난번처럼 `videoId`로 재조립합니다.
- **테스트 재현**: `/private/tmp/haru-fun-videos-review-20261112`를 수정하지 않고 스크래치 폴더에 복사본을 만들어 직접 검증했습니다. PR의 `firestore.rules`·테스트·`functions/src`를 복사해 `tsc`로 빌드한 뒤 `firebase emulators:exec --only firestore --project demo-…`로 실행했습니다. `node --test` 결과는 4건 통과, 실패 0건, 종료 코드 0입니다. 로그에 나온 `PERMISSION_DENIED`는 거절을 기대한 음성 케이스입니다.
- **추가 프로브**(저장소 파일 아님, 스크래치 스크립트):

| 케이스 | 결과 |
|---|---|
| 첫 삭제 | 성공 |
| 휴지통에 이미 있는 영상을 다시 삭제(오래된 탭 시나리오) | `permission-denied`, 활성 문서는 그대로 남음(원자성 유지) |
| `deletedAt` 누락 | 거절 |
| 허용되지 않은 키 | 거절 |
| 비관리자의 휴지통 문서 삭제 | 거절 |
| 관리자의 휴지통 문서 삭제 | 성공 |

- **빌드**: 프런트와 Functions 로컬 빌드 2건은 직접 재실행하지 않았습니다. 프런트는 워크트리에 `node_modules`가 없고, 프로젝트 사정상 빌드에 환경변수 자리값이 필요합니다. PR CI의 `build_and_preview`와 Deploy Preview가 `450336b` 기준으로 성공한 것은 확인했습니다. Functions는 스크래치에서 `tsc`가 통과했습니다.

남은 지적(모두 비차단):
1. **휴지통 구독 오류가 활성 목록을 가립니다.** `FunVideosPage.tsx`의 휴지통 `onSnapshot` 오류 콜백이 `setLoadError(true)`를 호출해, 관리자에게는 활성 목록도 "목록을 불러오지 못했습니다"로 바뀝니다. Rules가 배포되기 전에 Hosting이 먼저 나가면 이 화면이 보입니다. PR 본문대로 Rules를 먼저 배포하면 문제가 없습니다. 이 순서를 승인 조건으로 못 박으십시오. 오류를 목록 전체가 아니라 보관함 영역에만 표시하는 것이 안전한 보강입니다.
2. **방금 게시해 서버 시각이 아직 확정되지 않은 영상을 삭제하면 실패할 수 있습니다.** 이때 `createdAt`이 비어 있어 `batch.set`이 거절되고 "삭제하지 못했습니다" 토스트가 뜹니다. 활성 문서는 그대로이고 잠시 후 다시 하면 됩니다. 데이터 손실은 없습니다.
3. **테스트 공백**: 저장소 테스트는 정상 삭제와 복원, 구독자의 직접 접근 거절, `getFunVideos`의 제외·재노출을 다룹니다. 오래된 탭의 재삭제(`update: false`), `deletedAt` 누락, 비관리자의 휴지통 삭제는 저장소 테스트에 없습니다. 위 프로브로 정상 동작은 확인했으므로 필수는 아니고 후속 보강 권고입니다.
4. **8.1 판정① 절차 미완료**:
   - Codex 리뷰가 `450336b`에서 아직 Running입니다(요약 댓글 2026-11-12T11:04:14Z). 결과와 지적 해결이 필요하고, 응답이 없으면 2시간 규칙을 적용합니다.
   - PR 본문은 "에뮬레이터 시험 4개 통과", "웹 빌드 통과"만 적었고 실행 명령과 결과 요약이 없습니다. 판정①은 명령과 결과 로그를 PR에 요구합니다.
   - 이 독립 검토의 질문·결과 원문을 `docs/reviews/`에 새 파일로 남겨야 합니다. 같은 건에서 "수정 후 승인"은 1회이고 이번이 "승인"입니다.
5. **보관 정책**: 휴지통 문서는 영구 보관됩니다. 저작권·삭제 요청 때문에 내린 영상이라면 링크와 제목이 계속 남습니다. Rules가 관리자 삭제를 허용하므로 UI 없이 영구 삭제할 수 있습니다. 비밀·개인정보는 담기지 않아 보안 문제는 아닙니다.
6. **#389에서 이어지는 항목**: `endDate` 부재 시 서버만 거절하는 불일치, 이 테스트가 package script·CI에 연결되지 않은 점은 #389 판정 그대로입니다.

**3) 작업 규모와 8.1 멈춤 조건**
- **규모**: 소~중규모입니다. 화면 한 곳, Rules 한 블록, 테스트 추가입니다. 함수·결제·인증·AI 호출 변경은 없습니다.
- **해당하는 멈춤 조건**:
  - Firestore Rules 변경과 그 배포: 판정① 이후에도 허대표님 승인이 필요합니다.
  - 새 컬렉션 `funVideosTrash` 추가: 기록 경로(`users/{uid}/records`)가 아닌 관리자 전용 공용 콘텐츠 경로입니다. 저장 경로 변경·마이그레이션이나 운영 데이터 삭제·변경에는 해당하지 않아 보이지만, 허대표님 보고에 새 경로 추가를 명시하십시오.
- **배포 순서**: Rules를 먼저, Hosting을 나중에 하십시오(위 1항).

**4) 검토 HEAD와 근거**
- **검토 HEAD**: `450336b9b9f5fbcbe4fcbae578747839fc6188df` (기준 `origin/main` = `3ed092baa77b3a5d58c385660bd2f87c34399e34`)
- **읽은 범위**: 지정된 작업 폴더의 `git diff origin/main...450336b9`, `firestore.rules`, `FunVideosPage.tsx`, `functions/test/funVideos.emulator.test.mjs`와 PR #390의 본문·체크·댓글입니다.
- **직접 실행한 것**: Functions 소스의 스크래치 빌드, 에뮬레이터 테스트 4/4, 규칙 프로브(위 표).
- **실행하지 않은 것**: 프런트 빌드. CI 결과로 갈음했습니다.
- **변경하지 않은 것**: 저장소와 지정 작업 폴더, Git, 외부 메시지는 건드리지 않았습니다. 스크래치 복사본은 `/private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/b9b1e63e-572b-44cc-8982-c2968ecfc77b/scratchpad/rv390`에만 만들었습니다.
