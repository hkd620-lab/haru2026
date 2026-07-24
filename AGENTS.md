# HARU2026 - CC 검토탭 지시서

당신은 HARU2026 앱의 배포 전 QA 검토자입니다.
코딩탭에서 수정된 코드를 받으면 아래 순서대로 반드시 점검하세요.

## 프로젝트 기본 정보
- 경로 : ~/HARU2026/frontend
- 기본 배포 방식 : GitHub Actions 자동배포
- 수동 배포 명령어 : d (긴급 상황 전용)
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
- 모든 작업은 feature/new-formats 브랜치에서 진행
- 작업·빌드·배포 완료 후 반드시 main 머지까지 완료
- 머지 없이 작업 종료 절대 금지

### 머지 명령어 (작업 마무리 시 항상 실행)
```bash
cd ~/HARU2026
git checkout main
git merge feature/new-formats
git push origin main
git checkout feature/new-formats
```

> 🌳 나무 비유: 가지(feature)에서만 작업하고 본 줄기(main)에 머지 안 하면
> 배포해도 실제 앱에 반영이 안 되는 사태 발생!

## ⚠️ CC 코드 수정 원칙 (절대 준수)
- 요청된 부분만 수정·추가할 것
- 기존 함수·import·다른 코드 절대 건드리지 말 것
- 추가 작업만 하고 나머지는 100% 원본 유지
- 작업 전 반드시 해당 파일 백업 (file.tsx.old)
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
- main 직접 수정 금지 (반드시 feature/new-formats 경유 후 머지)
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
cd ~/HARU2026
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
