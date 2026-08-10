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
- 모든 작업은 feature/new-formats 브랜치에서 진행
- 작업 완료 후 feature/new-formats에 커밋·push한다.
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

## HARU2026 출시 전 품질·API·AI 운용 원칙 (2026-08-10 추가)

HARU2026은 본격적인 유료 구독 및 홍보 단계에 들어가기 전, 기능의 존재보다 **구독자가 실제로 만족하고 신뢰할 수 있는가**를 최우선 기준으로 고도화한다.

### 1. 최우선 판단 기준

모든 기능·API·AI 모델 검토는 다음 순서로 판단한다.

1. 구독자에게 실제 가치와 만족을 주는가
2. 답변과 계산 결과를 신뢰할 수 있는가
3. 사용자의 기록이 실제 생활자산으로 활용되고 있다고 느끼게 하는가
4. 응답속도와 사용 흐름이 불필요하게 복잡하지 않은가
5. 개인정보와 민감정보가 안전하게 처리되는가
6. 비용 대비 실질적인 효용이 있는가

기술적으로 새롭거나 기능이 많다는 이유만으로 기능·API·AI 모델을 추가하지 않는다.

### 2. API 운용 감사 원칙

API가 코드에 존재하는지만 확인하지 않는다. 반드시 다음을 확인한다.

- 실제 사용자 화면에서 호출되는가
- 해당 기능의 목적에 맞는 API인가
- API와 Gemini의 역할이 적절히 분리되어 있는가
- 인증, Secret, Functions region, timeout, rate limit, 오류 처리가 적절한가
- 공식 API 실패 시 Gemini 또는 웹검색이 공식 데이터인 것처럼 대체되지 않는가
- 사용자에게 데이터의 실제 출처가 올바르게 전달되는가
- 불필요하거나 중복된 API 호출로 비용이 낭비되지 않는가

### 3. 전문 데이터와 Gemini의 역할

건강·의약품·법률·금융 등 중요한 생활문제에서는 생성형 AI의 일반 지식만으로 사실을 확정하지 않는다.

가능한 경우 정부·공공기관·전문 API를 사실원으로 우선 사용한다.

기본 구조는 다음을 지향한다.

사용자 질문·기록 → 위험도와 정보종류 판단 → 적절한 공식·전문 데이터 확인 → 근거와 출처 확보 → Gemini가 해석·정리·사용자 설명

예:
- 의약품 사실 확인 → 식약처
- 병원 사실정보 → HIRA 등 공식·전문 데이터
- 법령 원문 → 법제처
- 식물 식별 → 전문 식물 식별 API
- 사용자의 기록 정리·해석·글 다듬기 → Gemini

Gemini는 전문 데이터가 담당해야 하는 사실 확인 역할을 임의로 대신하지 않는다.

### 4. AI 모델 선택 원칙

최신 모델이라는 이유만으로 교체하지 않는다.

각 기능별로 텍스트 생성, 분류, Vision/OCR, 검색 grounding, 요약, 대화 용도를 구분하여 적절한 모델을 사용한다.

모델 변경은 기존 기능의 품질·속도·비용·안전성을 비교한 뒤 별도 작업으로 진행한다.

SDK 이전, 모델 변경, 기능 리팩터링을 한 작업에 무리하게 묶지 않는다.

### 5. API 추가 원칙

API를 많이 연결하는 것을 고도화로 간주하지 않는다.

다음 조건을 만족할 때만 새로운 전문 API를 검토한다.

1. 현재 구조로 신뢰할 수 있는 사실 확인이 어렵고
2. 해당 분야에 신뢰도 높은 공식·전문 데이터가 존재하며
3. 사용자 만족도와 결과 신뢰도를 실질적으로 높이고
4. 개발·운영·비용·규제 부담보다 효익이 큰 경우

이미 적절하게 작동하는 기능은 이유 없이 교체하거나 확장하지 않는다.

### 6. 개인정보·보안 우선

건강, 금융, 보조장부, SNS, 사진, OCR 등 민감정보를 다루는 기능은 일반 기능보다 엄격하게 검토한다.

확인 대상:
- 원본 이미지 저장 여부
- Base64 및 OCR 원문 로그
- Firestore 저장 범위
- 브라우저 console 출력
- 공개 URL 생성
- Gemini로 전달되는 정보 범위
- 불필요한 개인정보 전송

보안·개인정보 문제가 실제 확인되면 일반 기능 개선보다 우선한다.

### 7. 출시 전 품질감사 원칙

본격적인 유료 구독·홍보 전 고도화 작업은 단순 코드리뷰가 아니라 **출시 전 품질감사**의 관점에서 수행한다.

최종적으로 각 기능을 다음 중 하나로 판정한다.

- 현행 유지
- 반드시 수정
- 설정 개선
- API 교체 검토
- 전문 API 추가 검토
- 미사용 코드 정리 검토
- 현재 단계에서는 보류

### 8. 검토와 구현 역할 분리

- CC: 현재 코드·API·AI 구조의 읽기전용 검토와 위험 분석
- 시박사: CC 결과 재검토, 사용자 만족도 관점 판단, 우선순위 결정
- 허대표님: 최종 수정범위 결정
- 기장(Codex): 승인된 범위만 실제 코드 수정·검증·Git 작업

검토가 끝나기 전에 기장이 추측으로 코드를 수정하지 않는다.

### 9. 최종 목표

HARU2026의 고도화 목표는 다음 질문으로 판단한다.

> **“처음 유료로 사용하는 구독자가 이 서비스라면 계속 비용을 지불하며 사용할 가치가 있다고 느끼는가?”**

기능을 많이 보여주는 것보다,

**“내 기록이 가치 있어졌다고 느끼게 하는 앱”**

이라는 HARU2026의 핵심 제품 원칙을 모든 API·AI·UX 판단보다 우선한다.
