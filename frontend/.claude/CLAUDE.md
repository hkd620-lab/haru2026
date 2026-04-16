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

✅ AI 제목 자동추출: 10개 형식 전체 적용. 제목을 비워두면 저장 시 AI가 자동으로 제목 생성.

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
- 수정파일: frontend/src/app/pages/AiLibraryPage.tsx, frontend/src/app/services/firestoreService.ts
- 다음할일: 삭제 기능 테스트 및 사용자 피드백 확인

### 2026-04-09 (3차)
- 완료: 삭제 로직 conversations 컬렉션 구조로 수정 (source, timestamp 필드 사용)
- 수정파일: frontend/src/app/services/firestoreService.ts
- 다음할일: 별도 Firebase 프로젝트 연결 확인 필요

### 2026-04-09 (4차)
- 완료: my-ai-library-74805 Firebase 프로젝트 연결 추가 및 AI학습함 데이터 소스 변경
- 수정파일: frontend/src/firebase.ts, frontend/src/app/services/firestoreService.ts
- 다음할일: AI학습함 페이지 기능 테스트

### 2026-04-09 (5차)
- 완료: AI학습함 작업 관련 3개 파일 git 복귀 및 안정화
- 수정파일: frontend/src/app/pages/AiLibraryPage.tsx, frontend/src/app/services/firestoreService.ts, frontend/src/firebase.ts (복귀)
- 다음할일: 기존 안정 버전 유지

### 2026-04-09 (6차)
- 완료: AI학습함 my-ai-library-74805 프로젝트 연결 및 conversations 컬렉션 접근
- 수정파일: frontend/src/firebase.ts, frontend/src/app/services/firestoreService.ts, frontend/src/app/pages/AiLibraryPage.tsx
- 다음할일: 사용자 이메일로 conversations 조회 테스트

### 2026-04-09 (7차)
- 완료: AI학습함 선택 삭제 기능 구현 (체크박스, 일괄 삭제, UI/UX 개선)
- 수정파일: frontend/src/app/pages/AiLibraryPage.tsx, frontend/src/app/services/firestoreService.ts
- 다음할일: 선택 삭제 기능 테스트 및 사용자 피드백 수집

### 2026-04-09 (8차)
- 완료: 기록 페이지에 'AI대화' 카테고리 추가 (ChatGPT, Claude, Gemini, 기타)
- 수정파일: frontend/src/app/types/haruTypes.ts, frontend/src/app/pages/RecordPage.tsx
- 다음할일: AI대화 기록 기능 개발 준비

### 2026-04-09 (9차)
- 완료: Footer 하단 네비게이션 바 겹침 문제 해결 (margin-bottom 추가)
- 수정파일: frontend/src/app/components/Footer.tsx
- 다음할일: 모바일/데스크톱 Footer 표시 테스트

### 2026-04-11 (10차)
- 완료: SayuModal 사진 기능 개선 (localImages 기반 표시, 개별 삭제 버튼, 위치 조정)
- 수정파일: frontend/src/app/components/SayuModal.tsx
- 다음할일: 사진 삭제 기능 테스트 및 사용자 피드백 확인

### 2026-04-16 (11차)
- 완료: 책 스튜디오 Stage 1 구현 (Firestore 규칙, BookStudio 페이지, 네비게이션 추가)
- 수정파일: firestore.rules, frontend/src/app/pages/BookStudio.tsx, frontend/src/app/components/BottomNav.tsx, frontend/src/app/App.tsx
- 다음할일: 빌드+배포 후 haru2026.com에서 책 스튜디오 메뉴 확인

### 2026-04-16 (12차)
- 완료: 책 스튜디오 Stage 2 구현 (generateBook Cloud Function, BookCreate 페이지)
- 수정파일: functions/src/bookStudio.ts (신규), functions/src/index.ts, frontend/src/app/pages/BookCreate.tsx (신규), frontend/src/app/pages/BookStudio.tsx, frontend/src/app/App.tsx
- 다음할일: ANTHROPIC_API_KEY Secret 설정 확인 후 실제 챕터 생성 테스트

---

최종 업데이트: 2026.04
HARU2026 by JOYEL — 허 교장님 전용
