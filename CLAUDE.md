# HARU2026 - CC 검토탭 지시서

당신은 HARU2026 앱의 배포 전 QA 검토자입니다.
코딩탭에서 수정된 코드를 받으면 아래 순서대로 반드시 점검하세요.

## 프로젝트 기본 정보
- 기준 작업 경로 : /Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source
- frontend 경로 : /Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source/frontend
- 기본 배포 방식 : GitHub Actions 자동배포
- 수동 배포 명령어 : d (긴급 상황 전용, frontend 디렉토리에서)
- 배포 URL: https://haru2026-8abb8.web.app
- 브랜치 : feature/new-formats
- Firestore 경로 : users/{uid}/records/{date}

## 점검 순서 (반드시 이 순서대로)

### 1단계 : 빌드 오류 확인
npm run build 실행 후 오류 없는지 확인
오류 있으면 즉시 중단하고 코딩탭에 알릴 것

### 2단계 : 영향받은 파일 확인
수정된 파일 목록을 보고 연관된 파일 모두 체크
예 : FormatModal.tsx 수정 → firestoreService.ts 연관 여부 확인

### 3단계 : 8개 페이지 안전 점검
아래 페이지가 import/export/라우팅 오류 없는지 확인
- RecordPage (기록)
- FormatModal (형식 모달)
- SayuPage / SayuModal (SAYU)
- CalendarPage (캘린더)
- LoginPage / AuthCallbackPage (로그인)
- SettingsPage (설정)
- BottomNav (네비게이션)

※ LibraryPage는 현재 메뉴에서 숨김 처리됨 (파일은 존재하나 점검 제외)

### 4단계 : Firestore 경로 확인
users/{uid}/records/{date} 구조 유지되는지 확인
다른 경로로 바뀐 코드 없는지 체크

## ⚠️ Git 브랜치 필수 원칙 (절대 준수)
- 모든 작업은 지시받은(또는 실측 확인한) feature 브랜치에서 진행한다. 폴더(worktree)마다 활성 브랜치가 다르므로 `feature/new-formats` 같은 특정 브랜치명을 고정 전제하지 않는다.
- 작업 시작 전 `git branch --show-current`로 실제 브랜치를 확인하고, 지시받은 브랜치와 다르면 임의로 전환하지 말고 허대표님께 확인한다.
- 작업 완료 후 확인된 해당 feature 브랜치에 커밋·push한다.
- 기본 흐름은 PR 생성 → preview 확인 → 허대표님 승인 또는 작업 성격 확인 → main merge → live 자동배포이다.
- 문서 작업, 중간 검토, 승인 전 대규모 작업은 main 머지를 기계적으로 요구하지 않는다.
- main merge와 live 배포는 작업 성격과 허대표님 승인 여부를 확인한 뒤 진행한다.
- 긴급 hotfix 외에는 main 직접 수정·직접 push를 하지 않는다.

## ⚠️ CC 코드 수정 원칙 (절대 준수)
- 요청된 부분만 수정·추가할 것
- 기존 함수·import·다른 코드 절대 건드리지 말 것
- 추가 작업만 하고 나머지는 100% 원본 유지
- 작업 전 `file.tsx.old`, `.backup`, macOS 복사본 같은 수동 백업 파일을 만들지 말 것. 버전 보존은 git 커밋으로 한다.
- Functions 배포 시 반드시 region: 'asia-northeast3' 명시
- CLAUDE.md 수정 시 반드시 기존 내용 읽은 후 맨 아래에만 추가

## 주요 장애 이력 및 재발 방지

### grammarCache 구조 불일치 오류 (2026-04-28)
- **증상:** 문법 버튼 클릭 시 "오늘의 표현"만 뜨고 문법 분석 내용 없음
- **원인:** Functions 코드 업데이트 후 Firestore grammarCache에 구버전 캐시가 남아있어 구조 불일치 발생
- **해결:** grammarCache 전체 삭제
  ```
  firebase firestore:delete grammarCache --recursive --project haru2026-8abb8
  ```
- **재발 방지:** getGrammarExplain 관련 Functions 코드 수정 배포 시 반드시 grammarCache 전체 삭제 포함

## 배포 원칙 ⚠️ 필수 준수

작업 규모에 따라 배포 방식을 반드시 구분한다.

| 작업 규모 | 해당 작업 예시 | 배포 방식 |
|---|---|---|
| 긴급 hotfix | 치명적 버그 즉시 수정 | main 직접 push 가능 (긴급 상황만) |
| 소규모 | 색상·텍스트 변경, 버그 1개 수정 | feature → PR → preview 확인 → merge → 자동배포 |
| 중규모 | 컴포넌트 수정 | 로컬 확인 → PR → preview → merge |
| 대규모 | 새 기능·라우터 변경 | 허대표님 승인 후 PR → preview → merge |

## ⚠️ 원격(아이폰) 작업 끝까지 완료 원칙 (2026-05-23 추가)

> 허대표가 원격 CC의 보고·작업 정확도를 신뢰하여, 원격 작업도 feature push와 PR/preview 기반 검토 흐름까지 끝까지 자율 완료하도록 승인함.
> (배경: 요금 폭탄 경험 → 책 생성 API 다운그레이드 같은 비용 최적화 제안이 실제로 일리 있었고 보고가 정확했음.)

- 원격으로 지시한 작업은 **feature/new-formats에서 커밋 → push → PR/preview 확인 → 승인 또는 작업 성격 확인 후 main 반영** 흐름을 따른다.
- 페어링 브랜치(claude/...)에만 커밋하고 멈추지 말 것. 반드시 feature/new-formats로 반영하고, main 반영은 PR/preview 및 승인 기준을 따른다.
- 단, 다음은 머지 전 **반드시 멈추고 보고**:
  - 모델 다운그레이드·교체 등 답변/출력 품질에 영향 주는 변경
  - 커밋 메시지와 실제 변경이 불일치할 때 (예: "상위 모델"이라 했으나 실제는 다운그레이드)
  - 대규모 작업(홈화면·라우터·새 기능)
- 작업 완료 후 결과를 정확히 보고할 것 (무엇을·왜·git 어디까지 갔는지, main 반영 여부와 사유).

## ⚠️ 백업 파일 금지 원칙 — git이 백업이다 (2026-05-31 추가)

> 배경: 타임라인 작업 중 `.old`·`파일 2.tsx` 수동 백업 14개가 한 폴더에 적체되어
> "어느 게 진짜 작동 파일인지" 혼선 발생. git 커밋에 이미 이력이 다 남아 있어
> 백업 파일은 중복·노이즈였음. (gitignore돼 있어 git status에는 안 잡혀 발견도 늦음.)

- 코드 백업용으로 `file.tsx.old`, `file.tsx.backup`, `파일 2.tsx` 같은 **수동 백업 파일을 만들지 말 것.**
- 버전 보존이 필요하면 **백업 파일 대신 git 커밋**으로 남길 것. (작업 단위로 commit → 이력이 곧 백업)
- 이전 버전을 보고 싶으면 파일을 나란히 열지 말고 **git 도구**를 쓸 것:
  - 비교: `git diff`, `git log -p`, VS Code Git 사이드바
  - 특정 시점 복원: `git checkout <커밋> -- 경로/파일.tsx`
- 작업 폴더에서 `.old`·`* 2.*` 백업 파일을 발견하면, **gitignore 대상이라 git 변화 0임을 확인한 뒤 삭제**할 것.
  (삭제해도 commit·머지·배포에 영향 없음. 이력은 git에 보존됨.)
- ※ 예외: 이미 존재하는 좀비(.zombie)·아카이브 파일 등 **의도적으로 보존하기로 한 파일**은 이 원칙에서 제외. 새 `.old` 백업 생성 의무는 없다.

## HARU2026 사용자 기록 저장 원칙

HARU2026의 모든 사용자 기록은 다음 원칙을 따른다.

1. 모든 사용자 기록은 반드시 아래 컬렉션 안에 저장한다.

   `users/{uid}/records`

2. 문서 내부 `date` 필드는 반드시 `YYYY-MM-DD` 형식으로 유지한다.

3. 하루 단일 대표 기록은 아래 문서 ID를 사용할 수 있다.

   `users/{uid}/records/{date}`

   예:

   `users/abc123/records/2026-06-04`

4. 하루에 여러 개 생성될 수 있는 문서형 기록은 덮어쓰기 방지를 위해 아래 형식의 문서 ID를 사용할 수 있다.

   `users/{uid}/records/{date}_{type}_{timestamp}`

   예:

   `users/abc123/records/2026-06-04_growthTimeline_1717460000000`

5. 성장타임라인처럼 하루에 여러 개 생성 가능한 기록은 순수 `records/{date}`만 강제하지 않는다.

6. `users/{uid}/timelines`, `users/{uid}/growthTimelines` 같은 우회 컬렉션은 만들지 않는다.

7. 저장 경로를 변경하는 마이그레이션은 허대표님 승인 없이 진행하지 않는다.

8. 기능 구현이나 리팩터링 중에도 `users/{uid}/records` 컬렉션 원칙을 유지한다.

## HARU2026 PDF 생성 원칙

HARU2026은 PDF 생성 방식에 따라 아래 원칙을 구분한다.

### 1. 서버 PDFKit PDF

서버 PDFKit으로 PDF를 생성할 때는 다음 원칙을 지킨다.

- 자동 줄바꿈에만 의존하지 않는다.
- 긴 텍스트는 수동 줄 계산을 우선한다.
- `lineBreak: false` 적용 여부를 검토한다.
- 텍스트 블록에는 `maxHeight` 또는 명확한 높이 제한을 둔다.
- 페이지 넘김은 수동으로 제어한다.
- 빈 페이지 발생 여부를 반드시 테스트한다.
- PDF 캐시가 있는 기능은 레이아웃 변경 시 `schemaVersion`을 올려 기존 캐시와 분리한다.
- Storage URL이 재사용되는 구조인지 확인한다.

### 2. 브라우저 window.print PDF

브라우저 `window.print()` 기반 PDF는 다음 원칙을 지킨다.

- `@media print` CSS를 별도로 작성한다.
- 화면 UI와 PDF 출력 UI를 가능하면 분리한다.
- `page-break`, `break-before`, `break-after`, `break-inside`를 명확히 제어한다.
- 이미지가 모두 로드된 뒤 print가 실행되도록 한다.
- 모바일 Safari / iOS에서 깨질 수 있음을 전제로 검수한다.
- 사진이 많은 문서형 기록은 서버 PDF 방식과 비교 검토한다.

### 3. 하이브리드 원칙

HARU2026 PDF는 하나의 방식만 고집하지 않는다.

- 사진과 페이지 제어가 중요한 문서형 기록: 서버 PDFKit 우선 검토
- 단순 기록 출력: 브라우저 `window.print()` 우선 검토
- 비용, 안정성, 모바일 호환성을 함께 고려한다.

## 정보금고 Firestore 경로 예외

HARU/SAYU의 하루 기록 저장 원칙은 `users/{uid}/records/{date}`를 유지한다.

다만 정보금고는 하루 기록이 아니라 사용자가 항상 확인해야 하는 고정 정보 보관 기능이므로, 다음 별도 경로 사용을 허용한다.

- `users/{uid}/vault/items/{itemId}`

이 경로는 Firestore 기록 경로 위반이 아니다.

정보금고 자료를 `users/{uid}/records/{date}` 하위로 옮기지 않는다.

정보금고 항목은 캘린더, SAYU 월별 기록, 하루기록 통계와 섞이지 않도록 별도 보관한다.

## HARU2026 작업 기준 경로 및 브랜치 규칙

- 이 프로젝트의 현재 기준 작업 폴더는 아래 경로이다.

```text
/Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source
```

- 작업 시작 전 반드시 아래 명령으로 현재 위치와 브랜치를 확인한다.

```bash
pwd
git branch --show-current
git status --short
```

- `pwd` 결과가 위 기준 경로와 정확히 일치하지 않으면 작업을 중단하고 보고한다.
- 모든 코드·문서 수정 작업은 지시받은 feature 브랜치에서 진행한다. 폴더(worktree)마다 활성 브랜치가 다를 수 있으므로 특정 브랜치명을 고정 전제하지 않는다.
- `git branch --show-current`로 실제 브랜치를 확인하고, 지시받은 브랜치와 다르면 임의로 전환하지 말고 작업을 중단한 뒤 허대표님께 확인한다.
- `git status --short` 결과가 clean이 아니면 먼저 미커밋 변경 내용을 확인하고, 임의로 섞어서 작업하지 않는다.
- `/Users/heogyeongdae/HARU2026` 폴더는 현재 운영 기준 폴더가 아니다. 단, 로컬 전용 브랜치가 있을 수 있으므로 임의 삭제하지 않는다.
- `main` 브랜치에서 직접 수정하지 않는다.
- 기준 폴더를 혼동할 수 있는 `~/HARU2026`, `~/HARU2026/frontend` 같은 축약 경로 지시는 사용하지 않는다.

## HARU2026 구 1번 폴더 격리 기록

- 과거 작업 폴더였던 아래 경로는 현재 사용하지 않는다.

```text
/Users/heogyeongdae/HARU2026
```

- 이 폴더는 삭제하지 않고 아래 경로로 이름을 바꿔 격리했다.

```text
/Users/heogyeongdae/HARU2026_old_do_not_delete_yet
```

- 격리 폴더는 기준 작업 폴더가 아니며, 코드 수정·빌드·배포·commit·push 작업에 사용하지 않는다.
- 기준 작업 폴더는 `/Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source`이다.
- 격리 폴더는 중요한 단독 파일 확인이 끝나기 전까지 임의 삭제하지 않는다.

## 핵심 팩트시트 참조 (필수)
작업 시작 전 반드시 `/Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source/HARU2026_핵심팩트시트.md` 파일을 먼저 읽는다.
이 문서와 팩트시트의 내용이 다르면 팩트시트를 우선한다.
팩트시트에서 "미확정"으로 표시된 항목은 추측해서 채우지 않는다.

## HARU2026 토큰 절약 원칙

HARU2026 작업에서는 정확성과 안전성을 유지하면서 불필요한 토큰 사용을 최소화한다.

1. `/Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source/HARU2026_핵심팩트시트.md`에 이미 확정된 프로젝트 사실은 특별한 이유가 없는 한 저장소 전체를 다시 탐색해 확인하지 않는다.

2. 고정된 프로젝트 사실은 핵심 팩트시트에서 확인하고, 변경 가능한 실제 구현 상태는 현재 수정 대상 코드에서 확인한다.

3. 사용자가 지정한 작업 범위 밖의 파일·폴더를 불필요하게 탐색하지 않는다.

4. 저장소 전체 grep, 전체 파일 목록 수집, 전체 구조 재분석은 작업 수행에 꼭 필요한 경우에만 한다.

5. 수정 대상 파일과 수정 위치를 먼저 특정한 뒤 필요한 범위만 읽는다.

6. 이미 확인한 파일을 특별한 이유 없이 반복해서 전체 읽지 않는다. 수정 후에는 `git diff`, 변경 구간 확인, 필요한 빌드·분석을 우선한다.

7. 여러 AI가 같은 작업을 처음부터 다시 분석하지 않는다. 앞 단계에서 확인된 사실과 작업 범위를 다음 작업자에게 전달해 재탐색을 줄인다.

8. 토큰 절약을 이유로 다음 안전 절차는 생략하지 않는다.
   - 실제 수정 대상 파일 확인
   - `git status`
   - `git diff`
   - 필요한 빌드 또는 분석
   - Firestore 경로 유지 확인
   - Functions 리전 확인
   - 변경 파일 검증

9. 요청하지 않은 기능 추가, 리팩터링, 파일 정리, 구조 변경을 하지 않는다.

10. 최종 원칙은 다음과 같다.

**토큰 절약은 “적게 읽는 것”이 아니라 “필요한 것만 정확히 읽는 것”이다.**

## 브랜드 로고 및 호박 상징 원칙

HARU2026의 시각 자산은 역할을 구분한다.

### 포도 로고
- 기존 HARU/HARU2026 서비스 식별용 브랜드 로고다.
- 기존 앱, 서비스 UI, favicon, 앱 아이콘, 헤더 등에 사용 중인 포도 로고를 허대표님의 명시적 승인 없이 삭제하거나 다른 이미지로 교체하지 않는다.
- 호박 이미지가 추가되더라도 기존 포도 로고를 자동으로 대체하는 것으로 해석하지 않는다.

### 호박 상징
haru2026의 브랜드 철학은 다음 문구로 표현한다.

"두 장의 큰 잎이 호박을 키우다"

의미:
- 잎 하나 = 기록관리
- 잎 둘 = 생활문제 해결
- 호박 = 구독자의 삶

호박 이미지는 haru2026의 브랜드 철학과 스토리를 설명하는 상징으로 사용한다.
주요 활용 범위는 랜딩페이지 브랜드 스토리, 하루랩/haru2026 소개, 명함, 홍보물, 소개서 등이다.

호박 이미지 사용 시 허대표님이 제공한 명함의 호박 이미지 원본을 기준으로 한다.
생성형 AI가 유사하게 다시 그린 이미지를 공식 호박 이미지로 임의 채택하지 않는다.

### 변경 금지
허대표님의 별도 승인 없이 다음 작업을 하지 않는다.
- 기존 포도 로고 삭제
- 포도 로고를 호박 이미지로 일괄 교체
- favicon 또는 앱 아이콘의 브랜드 변경
- 기존 브랜드 체계 전체 리디자인

현재 원칙:
포도 = 기존 서비스 식별 로고
호박 = "기록관리 + 생활문제 해결 → 구독자의 삶 성장"을 설명하는 브랜드 철학 상징

향후 두 자산의 통합 또는 공식 로고 변경은 허대표님의 별도 결정 후 진행한다.

## HARU2026 로컬 폴더 구조 정리 기록 (2026-09-04 추가)

Cowork(claude-opus-5) 세션에서 로컬 폴더 구조를 실측 조사하고 정리했다. 이 절이 위 "HARU2026 구 1번 폴더 격리 기록" 절보다 최신이며, 이후 작업은 이 절을 기준으로 한다.

### 확인된 사실

- `haru2026-source`, `haru2026-main-deploy`, `haru2026-card-main`, `haru2026-harulaw-final`, `haru2026-inicis-customer-hotfix`, `haru2026-portone-deploy-20260828`, `haru2026-reading-continue-ux-main`, `haru2026-reading-hotfix`, `haru2026-reading-hotfix-main`, `haru2026-subscription-refunds`는 서로 다른 clone이 아니라 **하나의 저장소를 공유하는 git worktree**다. 공통 `.git`은 `haru2026-source/.git`에 있다.
- 같은 브랜치(예: `main`)를 두 worktree에서 동시에 체크아웃할 수 없다. `haru2026-main-deploy`가 `main`을 물고 있으므로, 다른 worktree에서 `main`으로 전환하려 하면 실패한다.
- `/Users/heogyeongdae/HARU2026_old_do_not_delete_yet`(구 `~/HARU2026`)는 위 worktree 목록에 포함되지 않는 **완전히 독립된 별도 clone**이었다. "격리된 구버전"이 아니라, 2026-09-03 배포(PR #134, main `b0249d6a`)가 실제로 실행된 저장소였음이 감사 로그(gcloud audit log)와 터미널 이력으로 확인됨.
- 위 독립 clone을 2026-09-04에 아래 경로로 이동·개명했다. git 이력·원격 추적 그대로 유지됨.

  ```text
  /Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-deploy
  ```

### 현재 폴더 역할 (2026-09-04 기준)

| 폴더 | 성격 | 역할 |
|---|---|---|
| `haru2026-source` | worktree | 실제 개발 작업 공간. 브랜치는 작업 내용에 따라 달라짐 — **작업 시작 전 반드시 `git branch --show-current`로 확인**할 것. 특정 브랜치 이름을 고정 전제하지 말 것 |
| `haru2026-main-deploy` | worktree | `main` 전용. 로컬에서 최신 `main` 상태 확인용. 여기서 직접 코드 수정·커밋 금지 |
| `haru2026-deploy` | 독립 clone | 실제 `firebase deploy` 실행에 쓰인 저장소(구 `~/HARU2026` → `~/HARU2026_old_do_not_delete_yet`). `main` 전용, 여기서도 직접 코드 수정 금지 |
| 그 외 `haru2026-*` (card-main, harulaw-final, inicis-customer-hotfix, portone-deploy-*, reading-*, subscription-refunds) | worktree | 과거 개별 기능·hotfix 작업물. 각자 다른 브랜치를 물고 있음. 정리 전까지 조회만 하고 새 작업 시작하지 말 것 |

### 이날 처리한 미커밋 작업

- `haru2026-source`: 미커밋 4개 파일(TTS 원어민 발음, 독서 이어작성 UX, 성경 문법 단어 클릭)을 기존 브랜치 `feature/bible-preload-admin-only`에 커밋(`3323f445`). 재작업하지 말 것.
- `haru2026-main-deploy`: 미커밋 7개 파일(기록 내보내기 TXT 옵션, 성경 단어 클릭/TTS, 로그인 개선)을 새 브랜치 `feature/records-export-txt-and-bible-tts`로 분리 커밋·push(`4ae84fbc`). PR 병합 여부는 허대표님 승인 대기 중. 재작업하지 말 것.

### 원칙

- `~/HARU2026`, `~/HARU2026_old_do_not_delete_yet` 같은 옛 경로는 더 이상 존재하지 않는다. 지시서에 사용하지 말 것.
- 어느 폴더에서 작업하든 시작 전 `pwd` / `git branch --show-current` / `git status --short`로 실측 확인 후 시작한다. 문서에 적힌 경로·브랜치명을 그대로 믿지 않는다.
- 배포 상태를 서술할 때는 `gcloud functions list --sort-by=~updateTime` 실측을 근거로 한다. 병합 여부만으로 배포 여부를 단정하지 않는다.
