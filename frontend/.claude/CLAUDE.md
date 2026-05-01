# HARU2026 — Frontend CLAUDE.md
> CC(Claude Code)가 웹 프론트엔드 작업 시 반드시 참조하는 지침서

## 작업 규칙
- 각 단계 완료시 반드시 /compact 입력 안내
- 전체 작업 완료시 /clear 입력 안내
- MCP 도구는 10개 이하 유지

---

## 🤖 CC 자동 규칙 (항상 적용)

1. 작업을 완료할 때마다 CLAUDE.md의 "완료된 작업 이력"에 자동으로 추가할 것
2. 추가 형식:
   ### YYYY-MM-DD
   - 완료: [무엇을 했는지]
   - 수정파일: [파일명]
   - 다음할일: [다음 단계]

3. 새 대화 시작 시 반드시 CLAUDE.md를 먼저 읽을 것
4. 이미 완료된 작업은 절대 다시 하지 말 것

---

## 📌 프로젝트 기본 정보

| 항목 | 내용 |
|------|------|
| 프로젝트명 | HARU2026 |
| 브랜드 | HARU by JOYEL |
| 핵심 철학 | "간편하게 입력하고, 쓸모있게 남깁니다" |
| 배포 URL | https://haru2026.com / https://haru2026-8abb8.web.app |
| 개발자 UID (프리미엄 면제) | naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8 |

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | React + TypeScript + Vite |
| 스타일링 | Tailwind CSS |
| 백엔드 | Firebase Functions (리전: asia-northeast3) |
| DB | Firestore |
| 스토리지 | Firebase Storage |
| AI 엔진 | Gemini API (gemini-3.1-flash-lite-preview) — Functions 경유 전용 |
| HARUraw AI | gemini-2.5-pro (법령 해석/판례) + gemini-3.1-flash-lite-preview (키워드 추출/조문선별) |
| 법령 검색 | 법제처 오픈API (LAW_API_KEY — Secret Manager 보관) |
| 소셜 로그인 | Google / 카카오 / 네이버 |
| 결제 | PortOne → KakaoPay + TossPayments (심사 진행 중) |

---

## 📂 Firestore 데이터 구조

users/{uid}/records/{date}   ← 서브컬렉션 구조 (루트 records 절대 금지)

### 기록 형식 10개

| 카테고리 | 형식명 | prefix |
|----------|--------|--------|
| 생활 | 일기 | diary_ |
| 생활 | 에세이 | essay_ |
| 생활 | 여행기록 | travel_ |
| 생활 | 텃밭일지 | garden_ |
| 생활 | 애완동물관찰일지 | pet_ |
| 생활 | 육아일기 | parenting_ |
| 업무 | 선교보고 | mission_ |
| 업무 | 일반보고 | report_ |
| 업무 | 업무일지 | work_ |
| 업무 | 메모 | memo_ |
| 법률 | HARUraw | haruraw_ |

✅ 제목 입력 필수. AI 자동생성 제거됨 (2026-04-13 변경)

### 공통 메타데이터 필드
_sayu / _polished / _tags / _images / _rating

---

## 🚀 배포 명령어

# 프론트엔드 빌드 + 전체 배포
cd ~/HARU2026/frontend && d

# Functions만 별도 배포
cd ~/HARU2026/functions && npm run build && firebase deploy --only functions

# 완료 후 알림음
afplay /System/Library/Sounds/Glass.aiff

⚠️ 코드 변경 후 반드시 재빌드 + 재배포 필수.

---

## 🔐 보안 원칙 (절대 준수)

- API 키 frontend 직접 노출 금지
- 모든 API(Gemini 포함)는 반드시 Firebase Functions 경유
- Functions 환경변수: defineSecret 사용 (.env 불안정)
- 민감 키: Google Cloud Secret Manager 보관

---

## ✨ SAYU(사유) 핵심 원칙

> 허 교장님이 특별한 의미를 부여한 핵심 기능. 표기는 항상 "SAYU(사유)".

- BASIC / PREMIUM 2가지 모드
- Gemini gemini-3.1-flash-lite-preview 모델만 사용
- 원문 감정·내용 보존 원칙 / 재창작·교훈 추가 금지
- SAYU 결과: {prefix}_sayu 필드에 저장
- 저장 버튼: "다듬지 않고 SAYU 저장" / "AI 다듬은 후 SAYU 저장"

---

## 💳 구독 요금제

| 플랜 | 가격 |
|------|------|
| 웹앱 무료 | 0원 |
| 웹앱 프리미엄 월 | 3,000원 |
| 웹앱 프리미엄 연 | 30,000원 |
| Flutter 월 | 4,000원 |
| Flutter 연 | 40,000원 |

프리미엄 잠금: SAYU PDF 내보내기 / 월·분기·연간 기록합침 / 월·분기·연간 통계
PortOne Store ID: store-7a100ca2-8d9f-4015-8fdb-723e4527e2c2

---

## 🎨 브랜드 컬러

딥블루: #1A3C6E / 오프화이트: #FAF9F6 / 그린: #10b981

---

## ⚠️ 실패 이력 — 절대 반복 금지

| 문제 | 확정 해결책 |
|------|------------|
| PDF 생성 | window.print() + @media print CSS |
| 모바일 텍스트 입력 줌 | fontSize: 16 필수 |
| SAYU 통계 카운트 | hasSayu boolean 플래그 사용 |
| Firebase Functions 환경변수 | defineSecret 사용 |
| Gemini 모델 | gemini-3.1-flash-lite-preview 고정 |
| Firestore 경로 | users/{uid}/records/{date} 서브컬렉션 |
| Git reset | 반드시 백업 브랜치 생성 후 진행 |
| HARUraw AI 답변 마크다운 | 후처리 코드로 강제 제거 (**, ##, --, •, > 모두 replace) |
| HARUraw 글자수 초과 | 60자 초과 시 slice(0,57)+'...' 강제 적용 |
| HARUraw 엉뚱한 법령 | exact match 우선 + 조문 선별 프롬프트 강화 |

---

## ⚖️ HARUraw 핵심 원칙

> HARU2026 기록 페이지 내 법률 AI 검색 기능

### AI 모델 역할 분담
| 기능 | 모델 |
|------|------|
| 키워드 추출 | gemini-3.1-flash-lite-preview |
| 조문 선별 | gemini-3.1-flash-lite-preview |
| AI분석 (lawEasyExplain) | gemini-2.5-pro |
| 판례 (lawPrecedent) | gemini-2.5-pro |

### 동작 흐름
1. 사용자 일상어 질문 입력
2. gemini-3.1-flash-lite-preview → 법령 이름 키워드 추출
3. 법제처 오픈API → 법령 전문 조회
4. gemini-3.1-flash-lite-preview → 관련 조문 선별 (최대 3개)
5. 결과 표시 + AI분석/판례 버튼 제공

### 질문자 입장 파악 원칙 (핵심)
사용자 질문에서 역할을 먼저 파악 후 답변:

| 역할 | 판단 키워드 |
|------|------------|
| 피해자 | "당했어요", "피해를 입었어요", "신고하고 싶어요" |
| 피고발인 | "고발당했어요", "억울해요", "나를 신고했어요" |
| 제3자(관리자) | "직원이 신고했어요", "어떻게 처리해야 하나요" |

답변 구성:
1. 질문자 역할 먼저 명시 → "고발을 당하신 입장에서 답변 드립니다."
2. 해당 역할에 맞는 실질적 행동 지침 우선 제공
3. 법조문은 보조 참고자료로만 활용
4. 역할 불명확 시 확인 질문 먼저

### AI분석 버튼 (lawEasyExplain)
- 모델: gemini-2.5-pro
- 출력: 60자 이내 한 문장
- 마크다운 절대 금지
- 60자 초과 시 slice(0,57)+'...' 강제 적용

### 판례 버튼 (lawPrecedent)
- 모델: gemini-2.5-pro
- 출력: JSON 배열만
- summary 60자 이내
- 마크다운 절대 금지

### Firestore 저장 필드
- haruraw_query / haruraw_summary / haruraw_articles / haruraw_simple

### 구독 정책
- 무료 회원: HARUraw 사용 불가
- 프리미엄: 일 5회 제한
- 개발자 UID: 무제한

---

## 🛡️ 작업 전 필수 안전 수칙 (매번 반드시 실행)

### 1. Git 안전 저장 (작업 시작 전)
```bash
cd ~/HARU2026 && git add -A && git commit -m "작업 전 안전 저장"
```

### 2. 수정할 파일 백업
```bash
# Functions 수정 시
cp ~/HARU2026/functions/src/index.ts ~/HARU2026/functions/src/index.ts.bak

# 프론트엔드 페이지 수정 시 (파일명 맞게 변경)
cp ~/HARU2026/frontend/src/app/pages/[파일명].tsx ~/HARU2026/frontend/src/app/pages/[파일명].tsx.bak
```

> ⚠️ .bak / .old / .old2 / .backup_* 파일은 .gitignore 등록됨 — Git에 올라가지 않음

### 3. 문제 발생 시 복구 방법
```bash
# 파일 직접 복구
cp ~/HARU2026/functions/src/index.ts.bak ~/HARU2026/functions/src/index.ts

# Git으로 특정 시점 복구
git log --oneline -10                                      # 커밋 목록 확인
git checkout 커밋ID -- functions/src/index.ts             # 해당 파일만 복구
```

---

## 🔧 CC 작업 원칙

1. 요청된 것만 수정 — 임의 변경 절대 금지
2. 작업 전 백업 — file.tsx.old 형태
3. Git 커밋 메시지 — 한글
4. 완료 후 배포 URL 확인 및 결과 보고
5. 계획 합의 후 진행
6. 완료 후: afplay /System/Library/Sounds/Glass.aiff

---

## 📋 작업 브랜치

GitHub: hkd620-lab/haru2026
작업 브랜치: feature/new-formats

---

## 📝 완료된 작업 이력

### 2026-04-09 (1차)
- 완료: AiLibraryPage.tsx 필터 버튼 동적 생성 및 카드 레이아웃 개선
- 수정파일: frontend/src/app/pages/AiLibraryPage.tsx
- 다음할일: 사용자 테스트 및 피드백 반영

### 2026-04-09 (2차)
- 완료: AiLibraryPage.tsx 날짜별 삭제 기능 추가
- 수정파일: frontend/src/app/pages/AiLibraryPage.tsx, firestoreService.ts
- 다음할일: 삭제 기능 테스트 및 사용자 피드백 확인

### 2026-04-09 (3차)
- 완료: 삭제 로직 conversations 컬렉션 구조로 수정
- 수정파일: frontend/src/app/services/firestoreService.ts
- 다음할일: 별도 Firebase 프로젝트 연결 확인 필요

### 2026-04-09 (4차)
- 완료: my-ai-library-74805 Firebase 프로젝트 연결 추가
- 수정파일: frontend/src/firebase.ts, firestoreService.ts
- 다음할일: AI학습함 페이지 기능 테스트

### 2026-04-09 (5차)
- 완료: AI학습함 작업 관련 3개 파일 git 복귀 및 안정화
- 수정파일: AiLibraryPage.tsx, firestoreService.ts, firebase.ts
- 다음할일: 기존 안정 버전 유지

### 2026-04-09 (6차)
- 완료: AI학습함 my-ai-library-74805 프로젝트 연결 및 conversations 컬렉션 접근
- 수정파일: firebase.ts, firestoreService.ts, AiLibraryPage.tsx
- 다음할일: 사용자 이메일로 conversations 조회 테스트

### 2026-04-09 (7차)
- 완료: AI학습함 선택 삭제 기능 구현
- 수정파일: AiLibraryPage.tsx, firestoreService.ts
- 다음할일: 선택 삭제 기능 테스트

### 2026-04-09 (8차)
- 완료: 기록 페이지에 AI대화 카테고리 추가
- 수정파일: haruTypes.ts, RecordPage.tsx
- 다음할일: AI대화 기록 기능 개발 준비

### 2026-04-09 (9차)
- 완료: Footer 하단 네비게이션 바 겹침 문제 해결
- 수정파일: Footer.tsx
- 다음할일: 모바일/데스크톱 Footer 표시 테스트

### 2026-04-11 (10차)
- 완료: SayuModal 사진 기능 개선
- 수정파일: SayuModal.tsx
- 다음할일: 사진 삭제 기능 테스트

### 2026-04-13 (11차)
- 완료: FormatModal 제목 입력 필수화 및 AI 제목 자동생성 제거
- 수정파일: FormatModal.tsx
- 다음할일: 수동 제목 입력 기능 사용자 테스트

### 2026-04-13 (12차)
- 완료: SayuModal 제목 편집, RecordDetailModal 복사 기능, AiLibraryPage 카드별 복사 버튼 추가
- 수정파일: SayuModal.tsx, RecordDetailModal.tsx, AiLibraryPage.tsx
- 다음할일: 제목 편집 및 복사 기능 사용자 테스트

### 2026-04-13 (13차)
- 완료: HARUraw 기능 추가 (법령 검색 + AI분석 + 판례 + 저장)
- 수정파일: functions/src/index.ts, RecordPage.tsx, LibraryPage.tsx, haruTypes.ts
- 다음할일: 구독 플랜 분리, 일일 횟수 제한

### 2026-04-13 (14차)
- 완료: HARUraw 질문자 입장 파악 원칙 추가 (피해자/피고발인/제3자 역할 구분)
- 수정파일: CLAUDE.md
- 다음할일: HARUraw 구독 정책 적용 및 일일 횟수 제한 구현

### 2026-04-16 (11차)
- 완료: 책 스튜디오 Stage 1 구현 (Firestore 규칙, BookStudio 페이지, 네비게이션 추가)
- 수정파일: firestore.rules, frontend/src/app/pages/BookStudio.tsx, frontend/src/app/components/BottomNav.tsx, frontend/src/app/App.tsx
- 다음할일: 빌드+배포 후 haru2026.com에서 책 스튜디오 메뉴 확인

### 2026-04-16 (12차)
- 완료: 책 스튜디오 Stage 2 구현 (generateBook Cloud Function, BookCreate 페이지)
- 수정파일: functions/src/bookStudio.ts (신규), functions/src/index.ts, frontend/src/app/pages/BookCreate.tsx (신규), frontend/src/app/pages/BookStudio.tsx, frontend/src/app/App.tsx
- 다음할일: ANTHROPIC_API_KEY Secret 설정 확인 후 실제 챕터 생성 테스트

### 2026-04-16 (13차)
- 완료: BookCreate 다중 소스 입력 UI, generateBook 소스 배열 처리 + 심리 레이어 챕터 자동 생성
- 수정파일: frontend/src/app/pages/BookCreate.tsx, functions/src/bookStudio.ts
- 다음할일: 소스 2개 이상 입력 후 챕터 생성 테스트, Firestore books/{bookId}/chapters 확인

### 2026-04-26
- 완료: 작업 전 안전 수칙 추가 / 불필요한 CLAUDE-2.md 정리 / .gitignore 백업파일 제외 등록
- 수정파일: frontend/.claude/CLAUDE.md, .gitignore
- 다음할일: GPT-4o 검증 프롬프트 강화 (getGrammarExplain)

---

최종 업데이트: 2026.04.26
HARU2026 by JOYEL — 허 교장님 전용

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
- CLAUDE.md 수정 시 반드시 기존 내용 읽은 후 맨 아래에만 추가

## 역할 정의 (2026.04.30 추가)

- **허 교장님** = 프로젝트 총책임자
- **CI (Claude.ai 웹채팅)** = 허 교장님 비서.
  CFM이 잘 알아들을 수 있도록 바이브코딩 문장을 작성하는 역할.
  문장이 이상하거나 위험하면 허 교장님이 이의 제기 → CI가 수정.
- **CFM (Claude for Mac)** = 실행자. CI가 작성한 지시서를 받아 코드 수정·빌드·배포.
- **Gemini** = Firebase Functions API 호출, SAYU 엔진.

> CI의 바이브코딩 문장이 이상할 때는 허 교장님이 반드시 이의를 제기한다.
> CFM은 CI 문장을 맹목적으로 따르지 말고, 문제 발견 시 멈추고 보고한다.

## CI → CC 지시 방식
- CI(Claude.ai)는 바이브 문장으로 지시
- 딱딱한 지시서 형식(##작업목표 등) 금지
- CC는 파일 직접 분석 후 자율적으로 최선의 방법으로 구현
