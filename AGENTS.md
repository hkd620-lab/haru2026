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
- AGENTS.md 수정 시 반드시 기존 내용 읽은 후 맨 아래에만 추가

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

## HARU2026 원격 Git 협업 운영 규칙

### 역할 구조
- 허대표님 = 총괄대표
- 시박사(ChatGPT) = 전략·기획·운영 구조 설계
- 기장(Codex) = 최고기술자 / 원격 Git 메인 작업자
- cc(Claude Code) = 보조 개발 및 검수

### Git 운영 원칙 (추가)
- GitHub 원격 저장소 = 진실의 원천(Source of Truth)
- 작업 전 git pull 필수
- pull 없이 작업 시작 금지
- git status 확인 후 작업 시작
- main 직접 수정 금지 (반드시 feature/new-formats 경유 후 PR/preview 및 승인 기준에 따라 머지)
- main push = live 배포 / PR = preview 배포
- **git add . 사용 금지** — 수정한 파일만 명시적으로 git add
- 동시 코드 수정 금지

### 보안 원칙
- Secret / API key / JSON key 출력 금지
- private_key 채팅 출력 금지
- GitHub Secret 사용 원칙 유지

### 금지 파일 (수정·커밋 금지)
- routes.tsx
- HaruRawPage.tsx
- *.zombie

### 커밋 제외 대상 (백업/복사본)
- backup/
- archives/
- 파일명에 ` 2.ts` / ` 2.tsx`가 붙은 macOS 중복 복사본

# HARU2026 GitHub Actions 운영 보강 규칙 (2026.05.24)

## GitHub Actions 운영 상태

HARU2026은 GitHub Actions 기반 자동배포 체계를 사용한다.

* Pull Request(PR) 생성 시:

  * Firebase Hosting preview 배포 자동 실행
* main merge 시:

  * Firebase Hosting live 배포 자동 실행

GitHub 원격 저장소를 최종 Source of Truth로 사용한다.

---

## PR 중심 운영 원칙 (매우 중요)

기존:

```text
수정 → firebase deploy
```

현재 운영 원칙:

```text
수정 → feature 브랜치 push → PR 생성 → preview 확인 → merge → live 자동배포
```

가능하면 PR 기반 merge를 우선 사용한다.

---

## main merge 전 최종 확인 필수

main 브랜치 push는 실제 live 서비스에 즉시 반영된다.

따라서 merge 전 반드시 아래를 확인한다.

* npm run build 성공 여부
* git diff 최종 확인
* 원치 않는 파일 add 여부 확인
* Secret/API key 포함 여부 확인
* preview 배포 정상 여부 확인

확인 없이 main merge 금지.

---

## 머지 방식 우선순위

### 방법 1 — PR 방식 (권장)

1. feature/new-formats 작업
2. git push
3. Pull Request 생성
4. preview 배포 확인
5. Merge Pull Request
6. main live 자동배포 확인

### 방법 2 — 로컬 merge 방식 (긴급 상황 전용)

```bash
cd "/Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source"
git checkout main
git pull origin main
git merge feature/new-formats
git push origin main
git checkout feature/new-formats
```

긴급 hotfix 상황 외에는 PR 방식 우선 권장.

---

## rollback 원칙 (신규)

배포 후 장애 발생 시:

* 원인 분석보다 rollback 우선
* 마지막 정상 commit 확인
* 필요 시 main revert 또는 이전 정상 commit redeploy
* 서비스 장애 장시간 유지 금지

---

## 작업 시작 전 필수 확인

작업 시작 전 반드시 실행:

```bash
git pull
git status
```

pull 없이 작업 시작 금지.

---

## GitHub Actions 장애 이력 (2026.05.23)

### 증상

PR preview 배포 실패:

```text
Resource not accessible by integration
```

### 원인

GitHub Actions workflow 권한이 read-only 상태.

### 해결

GitHub Settings → Actions → General:

* Workflow permissions:

  * Read and write permissions
* Allow GitHub Actions to create and approve pull requests:

  * 활성화

### 재발 방지

GitHub Actions workflow 추가/수정 시 권한 설정 먼저 확인.

---

## 배포 명령어 운영 변경

기본 배포 방식:

* GitHub Actions 자동배포

수동 firebase deploy:

* 긴급 상황 전용
* 장애 복구용
* GitHub Actions 실패 시만 사용

---

## 중요 철학

HARU2026은:
“기록 → 사유 → 자산”

구조를 기반으로 하는 장기 운영 SaaS 플랫폼이다.

속도보다:

* 안정성
* rollback 가능성
* 장애 예방
* Git 기록 보존

을 우선한다.

## HARU2026 하네스 원칙

HARU2026은 단순 기록앱이나 단순 AI 챗봇이 아니다.

HARU2026은 사용자의 삶에서 발생하는 기록을 목적별 형식으로 수집하고,
AI와 전문 API로 해석하며,
통계와 합본을 통해 장기 자산화하고,
필요한 순간에 AI 비서가 다시 꺼내 쓰도록 설계된
하네스 기반 AI 라이프 컴파일러다.

따라서 모든 개발 작업은 다음 원칙을 지킨다.

1. 사용자의 기록 구조를 훼손하지 않는다.
2. Firestore 기록 경로 `users/{uid}/records/{date}`를 변경하지 않는다.
3. AI가 사실을 지어내는 구조를 만들지 않는다.
4. 전문 영역은 가능한 한 전문 API, 공공데이터, 신뢰 가능한 데이터와 연결한다.
5. Gemini는 사실 생성자가 아니라 해석·정리·설명 담당으로 사용한다.
6. 기록 → SAYU 다듬기 → 통계 → 합본 → 검색·분류 → AI 비서실 흐름을 HARU2026의 핵심 구조로 유지한다.
7. 요청 범위 밖 리팩터링이나 구조 변경을 하지 않는다.

## HARU2026 하네스 기준문서 우선 확인

HARU2026의 구조 판단, 기능 설계, AI/API 역할 분리, 검수 기준이 필요한 작업은 먼저 `docs/HARU2026_HARNESS_ENGINEERING.md`를 확인한다.

단, 모든 작업에서 최우선 필수 규칙은 AGENTS.md의 브랜치·Firestore 경로·금지 파일·보안·배포 원칙을 따른다.

## 도서 발행 AI 검토 안전장치

- 도서의 최종 발행 상태로 전환되는 모든 경로는 동일한 AI 발행 검토 게이트를 통과해야 한다.
- BookStudio.tsx뿐 아니라 BookCreate.tsx 등 다른 화면이나 함수에서 status를 serializing 또는 이에 준하는 최종 발행 상태로 변경하는 우회 경로가 생기지 않도록 한다.
- AI 검토 결과가 없거나, 원고가 변경되어 contentHash가 불일치하거나, 필수 검토 항목이 통과되지 않은 경우에는 최종 발행을 허용하지 않는다.
- 사용자 오버라이드가 허용된 항목은 명시적인 사용자 확인 기록을 남긴 경우에만 발행 게이트 통과로 인정한다.
- 새로운 도서 발행 경로를 추가할 때도 기존 publishReview 검토 및 발행 게이트를 재사용한다.
- 이 안전장치를 우회하기 위해 별도의 임시 발행 버튼, 직접 status 변경 로직, 예외 경로를 추가하지 않는다.

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

하루랩 및 haru2026의 공식 로고는 `frontend/public/brand/haru-pumpkin-logo.png`이다.

공식 로고는 두 장의 큰 호박잎, 작은 호박 열매, 잎과 열매를 연결하는 줄기로 구성된 투명 배경 PNG다.

공식 원본 SHA-256:

```text
5394b762c3d9475ee07b6f8b2f11a5872b17a73702e4b1ce19c553adb5545bc8
```

### 공식 로고 사용 원칙
- 공식 로고를 AI로 다시 그리거나 유사 이미지로 대체하지 않는다.
- 잎의 개수·모양·위치, 호박 열매, 줄기 형태를 변경하지 않는다.
- 가로·세로 비율을 왜곡하지 않는다.
- 확대·축소, 배치, 여백 조정만 허용한다.
- 공식 로고가 필요할 때는 저장소의 원본 파일을 그대로 사용한다.

### 기존 포도 자산
- 포도 이미지는 과거 서비스 자산이며 더 이상 공식 로고로 취급하지 않는다.
- 새 화면이나 결과물에 포도 로고를 추가하거나 복구하지 않는다.
- 다만 요청 범위 밖의 기존 포도 자산을 이번 문서 작업에서 일괄 삭제하거나 코드까지 수정하지 않는다.
- 잔존 포도 자산 교체는 별도의 승인된 작업으로 진행한다.

### 브랜드 의미
haru2026의 브랜드 철학은 다음 문구로 표현한다.

"두 장의 큰 잎이 호박을 키우다"

의미:
- 잎 하나 = 기록관리
- 잎 둘 = 생활문제 해결
- 호박 = 구독자의 삶

권장 설명:

"두 장의 큰 잎이 호박을 키우듯, 기록관리와 AI 생활비서가 사용자의 삶을 함께 키웁니다."

### 브랜드 표기
- 운영사 기본 시각 표기: 하루lab
- 한글 설명·검색 표기: 하루랩
- 서비스 기본 대외 표기: haru2026
- 기존 코드 식별자와 내부 파일명을 기계적으로 일괄 변경하지 않는다.

## HARU2026 로컬 폴더 구조 정리 기록 (2026-09-04 추가, Cowork 조사)

Cowork(claude-opus-5) 세션에서 로컬 폴더 구조를 실측 조사하고 정리했다. 시박사(ChatGPT)·기장(Codex)·cc(Claude Code) 모두 이 절을 기준으로 삼는다.

### 확인된 사실

- `haru2026-source`, `haru2026-main-deploy`, `haru2026-card-main`, `haru2026-harulaw-final`, `haru2026-inicis-customer-hotfix`, `haru2026-portone-deploy-20260828`, `haru2026-reading-continue-ux-main`, `haru2026-reading-hotfix`, `haru2026-reading-hotfix-main`, `haru2026-subscription-refunds`는 서로 다른 clone이 아니라 **하나의 저장소를 공유하는 git worktree**다. 공통 `.git`은 `haru2026-source/.git`에 있다.
- 같은 브랜치(예: `main`)를 두 worktree에서 동시에 체크아웃할 수 없다. `haru2026-main-deploy`가 `main`을 물고 있으므로, 다른 worktree에서 `main`으로 전환하려 하면 실패한다.
- `/Users/heogyeongdae/HARU2026_old_do_not_delete_yet`(구 `~/HARU2026`)는 위 worktree 목록에 포함되지 않는 **완전히 독립된 별도 clone**이었다. "격리된 구버전"이 아니라, 2026-09-03 배포(PR #134, main `b0249d6a`)가 실제로 실행된 저장소였음이 감사 로그(gcloud audit log)와 터미널 이력으로 확인됨. (이전에 "오래된 백업본"이라는 추정이 있었으나 실측 결과 틀린 것으로 확인됨.)
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

- `~/HARU2026`, `~/HARU2026_old_do_not_delete_yet` 같은 옛 경로는 더 이상 존재하지 않는다. 지시서·안내문에 사용하지 말 것.
- 어느 폴더에서 작업하든 시작 전 `pwd` / `git branch --show-current` / `git status --short`로 실측 확인 후 시작한다. 문서에 적힌 경로·브랜치명을 그대로 믿지 않는다.
- 배포 상태를 서술할 때는 `gcloud functions list --sort-by=~updateTime` 실측을 근거로 한다. 병합 여부만으로 배포 여부를 단정하지 않는다.

## 기장(Codex) 자율진행 및 질문 최소화 원칙 (2026-09-08 추가)

이 절은 기장(Codex)의 작업 중 확인 질문과 관련해 가장 최근에 확정된 운영 규칙이다.
기존 문서의 “작업을 중단하고 허대표님께 확인” 규칙과 충돌할 때는, 아래의 자율진행 범위와 정지 조건을 우선 적용한다.
다만 보안·데이터 보호·운영 배포·결제·권한 제한은 완화하지 않는다.

### 기본 원칙

- 기장은 HARU2026의 기술 구현 책임자로서 요청 범위 안의 기술적 세부사항을 스스로 판단한다.
- 안전하고 되돌릴 수 있는 진행 방법이 하나라도 있으면 허대표님의 중간 확인을 기다리지 않고 계속 진행한다.
- 작업 방법의 선택, 관련 파일 특정, 최소 범위 구현, 오류 수정, 검증 방식 같은 기술 판단을 선택지 질문으로 되돌리지 않는다.
- 중간 진행 상황은 필요한 경우 알릴 수 있지만, 단순 확인이나 동의를 기다리며 작업을 멈추지 않는다.
- 질문이 필요하지 않은 판단 사항은 최종 완료 보고의 “자체 판단 사항”에 근거와 함께 기록한다.
- 아래 정지 조건에 해당하지 않는 한 코드 수정 → 검증 → 커밋 → push → PR 생성·갱신 → preview 및 CI 확인까지 자율적으로 완료한다.

### 질문 없이 자율 처리할 작업

- 작업 시작 전 팩트시트, AGENTS.md, 현재 경로·브랜치·상태와 수정 대상 파일을 읽기 전용으로 확인한다.
- 현재 폴더가 dirty이거나 다른 작업과 충돌할 가능성이 있으면 기존 변경을 건드리지 않고 안전한 별도 clean worktree와 고유 작업 브랜치를 만든다.
- 지시된 브랜치가 다른 worktree에서 사용 중이면 git worktree list로 해당 위치를 확인하고, 기존 변경을 훼손하지 않는 안전한 방법을 선택한다.
- 지시서의 경로·브랜치 설명과 실측 상태가 다르더라도 올바른 저장소·기준 SHA·PR이 명확하고 안전한 대안이 있으면 그 근거를 기록하고 계속 진행한다.
- 구현 방법이 여러 가지이면 기존 구조와 공개 동작을 가장 적게 변경하는 방법을 선택한다.
- 요청 범위 안에서 발견한 빌드·테스트·타입·lint 오류는 원인을 확인해 수정하고 다시 검증한다.
- PR의 CI 실패나 리뷰 지적이 요청 범위 안이면 같은 브랜치와 PR에 보완 커밋을 추가하고 재검증한다.
- 문구·색상·간격·반응형·단일 버그처럼 위험이 낮은 작업은 별도 설계 승인을 요구하지 않는다.
- 수정 파일만 개별 stage하고, git diff·git diff --cached·빌드·필요 테스트를 확인한 뒤 일반 commit과 push를 수행한다.
- PR 생성 또는 기존 PR 갱신 후 preview와 CI 상태를 확인하고 결과를 한 번에 보고한다.
- 일부 검증이 환경 제약으로 불가능하더라도 가능한 구현과 나머지 검증을 먼저 끝내고, 미실행 항목과 이유를 최종 보고한다.

### 질문을 묶어서 최소화하는 원칙

- 단순 선호 확인, 구현 방식 선택, 파일명·컴포넌트명 선택, 테스트 순서 확인은 질문하지 않는다.
- 질문이 꼭 필요한 경우에도 가능한 조사와 안전한 작업을 먼저 끝낸 뒤, 작업을 실제로 막는 항목만 한 번에 묶어 질문한다.
- 한 질문의 답을 기다리는 동안 독립적으로 진행 가능한 다른 작업과 검증을 멈추지 않는다.
- 사용자가 이전에 같은 유형의 작업을 계속 승인했고 현재 지시와 충돌하지 않으면, 그 안전한 패턴을 기본값으로 사용하고 최종 보고한다.

### 반드시 멈추고 허대표님 승인 또는 확인을 받을 작업

- main 병합, main 직접 push, live 자동배포를 유발하는 작업
- Firebase Functions·Hosting·Firestore Rules·Storage Rules의 운영 배포
- 실결제, 실제 청구, 환불 실행, 구독 상태의 운영 변경, 운영 빌링키 발급·삭제
- 운영 Firestore·Storage 데이터의 수정·삭제·이동·마이그레이션 및 대량 정리
- Secret, API key, Firebase·PortOne·KG이니시스·OAuth·웹훅 등 운영 설정 변경
- Firestore 핵심 경로, 저장 스키마, 인증 구조, 결제 구조, 권한 구조 변경
- 모델 교체·다운그레이드, 사용량 한도·가격·과금처럼 품질이나 비용 정책에 영향을 주는 변경
- 요청 범위를 넘어서는 대규모 기능, 홈 화면 전체 개편, 새 핵심 기능, 대규모 라우팅·아키텍처 변경
- 기존 사용자 작업이나 복구하기 어려운 데이터를 삭제·덮어쓸 가능성이 있는 작업
- force push, --force, --no-verify, reset --hard 등 금지되거나 파괴적인 Git 작업
- 권한·로그인·계정 소유자 승인 등 사용자의 실제 행위 없이는 진행할 수 없는 외부 차단
- 지시 대상·기준 SHA·저장소가 서로 충돌하고 안전한 대안을 특정할 수 없는 경우

### 권한 경계

- 이 자율진행 원칙은 요청 범위 안에서 PR과 preview까지 완성할 권한이다.
- main 병합과 운영 반영 권한을 자동으로 부여한 것으로 해석하지 않는다.
- 요청 밖 리팩터링, 파일 정리, 기능 추가, 데이터 구조 변경을 정당화하는 근거로 사용하지 않는다.
- 안전 절차인 git status, git diff, 수정 파일 확인, 필요한 빌드·테스트, Firestore 경로와 Functions 리전 확인은 계속 준수한다.

### 완료 보고

작업 완료 후에는 중간 질문 대신 다음을 한 번에 보고한다.

- 무엇을 왜 변경했는지
- 기장이 자체 판단한 사항과 판단 근거
- 변경 파일 목록
- 실행한 빌드·테스트·검증과 결과
- 미실행 검증과 이유
- 브랜치, 커밋 SHA, PR 주소, preview·CI 상태
- main 병합·운영 배포 여부
- 남은 위험 또는 허대표님이 최종 결정할 사항
