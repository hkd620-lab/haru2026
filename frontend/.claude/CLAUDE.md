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

### 2026-04-23 (14차)
- 완료: LandingPage 상단 HARU 활용 팁 배너 추가 (스마트폰 기록 → 노트북 완성 안내, 닫기 버튼 + localStorage 기억, 민트그린/딥블루 컬러)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 배포된 랜딩페이지에서 배너 표시 및 닫기 동작 확인

### 2026-04-23 (15차)
- 완료: 랜딩 배너 모바일 반응형 개선 (safe-area-inset-top 적용, 모바일 전용 짧은 문구, 아이콘·폰트 크기 축소)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: PWA 모바일에서 상태표시줄 겹침 해소 및 한 줄 표시 확인

### 2026-04-23 (16차)
- 완료: 랜딩 히어로 섹션 safe-area-inset-top 적용 + 모바일 포도송이↔BRAIN SCIENCE 섹션 간격 축소 (hero-section/grape-animation-container/next-section-after-hero 클래스 추가, @media 640px 분기)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 모바일 PWA에서 상태표시줄 겹침 및 섹션 간 여백 확인

### 2026-04-23 (17차)
- 완료: 랜딩 배너 문구 3단 구조 교체 (제목: 💻 노트북에서 더 빠르게 완성하세요 / 본문: 📱 스마트폰으로 간편하게 입력 + 💻 웹브라우저에서 쓸모있게 완성, '간편하게'·'쓸모있게' 민트그린 강조), 데스크탑/모바일 문구 전환 클래스 제거
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 배포본에서 3단 문구 표시 및 민트그린 강조 확인

### 2026-04-23 (18차)
- 완료: 랜딩 히어로 오른쪽 딥블루 박스에 HARU 3D 오렌지 타이틀 + 서브타이틀 복원 (motion 임포트, H·A·R·U 글자별 오렌지 그라데이션 + shimmer 애니메이션, '하루를 간편하게 입력하고 쓸모있게 남기는 앱' 서브타이틀 + '간편하게'·'쓸모있게' scale 애니메이션)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 하드 새로고침 후 HARU 타이틀 등장/shimmer/서브타이틀 bounce 동작 확인

### 2026-04-23 (19차)
- 완료: HARU 타이틀·서브타이틀 간격 축소 (justifyContent·minHeight 제거, padding 24/28로 축소, HARU marginTop -8px로 포도송이와 겹침, 서브타이틀 marginTop 4px로 바짝 붙임)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 포도송이·HARU·서브타이틀이 한 박스 안에 컴팩트하게 보이는지 확인

### 2026-04-23 (20차)
- 완료: HARU 타이틀·서브타이틀 추가 간격 축소 (HARU marginTop -8→-60px로 포도송이 쪽으로 대폭 끌어올림, 서브타이틀 marginTop 4→-8px, 박스 하단 padding 28→20px)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 포도송이 바로 아래 HARU·서브타이틀 붙는 정도 확인

### 2026-04-23 (21차)
- 완료: HARU 타이틀 추가로 끌어올림 (marginTop -60→-120px), 박스 padding 24/20 → 8/16 으로 상하 축소
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 포도송이 바로 아래 HARU 붙는지 재확인, 과도하면 -90~-100px로 미세 조정

### 2026-04-23 (22차)
- 완료: HARU 타이틀 marginTop 미세 조정 (-120 → -150px, 30px 추가 상승)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 포도송이 바로 아래 HARU 위치 최종 확인, 과하면 -135px / 부족하면 -180px

### 2026-04-23 (23차)
- 완료: HARU 타이틀 marginTop 대폭 조정 (-150 → -280px, 포도송이 박스가 예상보다 커서 130px 추가 상승)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: HARU·포도송이 겹침 여부 최종 확인, 과하면 -240px / 부족하면 -320px

### 2026-04-23 (24차)
- 완료: 랜딩 배너 제목 div 삭제 (본문 2줄만 유지), HARU marginTop 겹침 해소 (-280 → -260px)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 배너 본문 표시 + HARU·포도송이 겹침 해소 확인

### 2026-04-23 (25차)
- 완료: HARU 타이틀 marginTop 추가 20px 하강 (-260 → -240px, 모바일 겹침 해소)
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 모바일/데스크탑 HARU·포도송이 간격 최종 확인

### 2026-04-23 (26차)
- 완료: HARU주식관리 형식 신규 추가 (카테고리: 생활 / prefix: stock / 이모지: 📈), 거래유형·종목명·가격·수량·금액·일시·메모 7개 필드, 캡처 이미지 자동 분석 버튼 + analyzeStockImage Functions (gemini-2.5-flash 비전)
- 수정파일: haruTypes.ts, FormatModal.tsx, RecordDetailPage.tsx, functions/src/index.ts
- 다음할일: 키움증권 카카오 캡처 업로드 → 자동 분석 → 필드 자동 입력 동작 확인

### 2026-04-23 (27차)
- 완료: HARU주식관리 자동 분석 다중 거래 지원 (analyzeStockImage → {trades: [...]} 배열 반환, stockCandidates/showCandidates state + handleSelectTrade, 후보 선택 모달 UI, 거래가격→거래단가 라벨/플레이스홀더 수정, Gemini 프롬프트에 단가×수량=거래금액 자동계산 지시)
- 수정파일: functions/src/index.ts, FormatModal.tsx, RecordDetailPage.tsx
- 다음할일: 캡처 1장에 여러 건 있을 때 후보 목록 표시 + 선택 1건 필드 자동 채움 동작 확인

### 2026-04-23 (28차)
- 완료: 주식 OCR 이미지 전달 방식 변경 (서버 fetch 대신 클라이언트에서 FileReader → base64 변환 후 {base64Data, mimeType} 직접 전송). Firebase Storage URL CORS/인증 우회
- 수정파일: frontend/src/app/components/FormatModal.tsx, functions/src/index.ts
- 다음할일: 클라이언트 base64 변환 + 서버 분석 플로우 동작 확인

### 2026-04-23 (29차)
- 완료: HARU주식관리 입력 방식 전환 (Gemini Vision OCR → 카톡 '대화 내용 내보내기' TXT/CSV 파싱). 프론트에서 [키움]체결통보 블록 분리해 종목명·매수매도·수량·평균단가·날짜시각 추출 → 거래금액 자동 계산. 캡처 버튼을 파일 업로드 라벨로 교체, isAnalyzing→isCsvParsing, handleOcrAnalyze→handleKakaoTxtUpload. 저장 버튼은 '저장' 1개로 단순화(AI 다듬기 생략). analyzeStockImage Cloud Function 소스 제거(orphan 배포본은 남아 있음, 필요 시 firebase functions:delete)
- 수정파일: frontend/src/app/components/FormatModal.tsx, functions/src/index.ts
- 다음할일: 키움증권 카톡 내보내기 TXT 업로드 → 거래 리스트 파싱 + 1건 선택 → 필드 자동 채움 + 저장 1개 버튼 확인

### 2026-04-23 (30차)
- 완료: HARU주식관리 작성창 완전 단순화. 모드 선택 단계 자동 스킵(format === 'HARU주식관리' ? 'input' : 'select'). 제목 input·간편/프리미엄 본문·사진 업로드 섹션 모두 HARU주식관리에서 숨김. 전용 UI 블록(안내문구 + 📂 파일 업로드 라벨 + "N건 분석 완료" 표시)을 별도 영역으로 분리. handleKakaoTxtUpload가 자동 제목 생성(stock_title = "YYYY-MM-DD ~ YYYY-MM-DD 매수N건·매도N건"). handleSaveAllTrades 신규 — 전체 거래 배열을 stock_trades(JSON) + 요약 통계(stock_count/buy_count/sell_count/date_from/date_to) + sayu 요약 텍스트로 한 번에 저장. 저장 버튼은 후보 없을 때 비활성 + "저장 (N건)" 라벨
- 수정파일: frontend/src/app/components/FormatModal.tsx
- 다음할일: 주식관리 작성창에 파일 업로드/저장만 보이는지, 28건 파일 업로드→자동 제목·건수 표시·저장 후 재조회 확인

### 2026-04-23 (31차)
- 완료: 랜딩 상단 배너에 '🪶 나도작가 — AI가 당신의 과거로 미래를 씁니다' 3번째 라인 추가(상단 구분선 + 퍼플 #a78bfa 강조). 나도작가 섹션 desc 카피 교체("AI가 당신의 과거로 미래를 씁니다. 내가 선택한 가치관과 삶의 조각들로 AI가 나만의 서사를 완성합니다.")
- 수정파일: frontend/src/app/pages/LandingPage.tsx
- 다음할일: 배너에 나도작가 문구·구분선 표시 + 나도작가 섹션 새 desc 확인

### 2026-04-23 (32차)
- 완료: SAYU 페이지 HARU주식관리 형식 펼침 시 전용 대시보드 표시 (StockDashboard 컴포넌트 신규). 통계 카드(매수/매도/종목/총금액) + SVG 도넛차트 + 날짜 범위 + 빠른기간 프리셋 + 거래종류·종목·정렬 칩 필터 + 거래 리스트. records→stock_trades JSON 평탄화(폴백으로 단일 stock_* 필드). 형식 목록 렌더 분기: format === 'HARU주식관리'면 대시보드, 아니면 기존 pagedEntries
- 수정파일: frontend/src/app/pages/SayuPage.tsx
- 다음할일: SAYU→생활→HARU주식관리 클릭 시 대시보드 표시 + 필터 동작 확인

### 2026-04-23 (33차)
- 완료: HARU주식관리 저장 모델 전환 — 거래 1건당 독립 레코드(recordId = stock_{YYYYMMDDhhmm}_{index})로 개별 저장. firestoreService.saveRecord가 recordData.id 있으면 사용하도록 개선. RecordPage.handleSaveFormatData는 formatData._recordId를 추출해 saveRecord id로 전달. FormatModal.handleSaveAllTrades는 for 루프로 stockCandidates를 각각 onSave 호출(stock_trades JSON 폐기, 대신 stock_type/stock_name/stock_price/stock_quantity/stock_total/stock_date 필드 직접 저장). SayuPage.StockDashboard는 JSON 파싱 제거하고 r.stock_* 필드를 1:1 매핑으로 평탄화. 같은 분에 여러 거래 있을 때 충돌 방지 위해 recordId에 _{i} 접미사 추가
- 수정파일: firestoreService.ts, RecordPage.tsx, FormatModal.tsx, SayuPage.tsx
- 다음할일: 28건 업로드→Firestore에 28개 stock_YYYYMMDDhhmm_i 문서 생성 + SAYU 대시보드에 28건 모두 표시·필터 동작 확인

### 2026-04-23 (34차)
- 완료: HARU주식관리 저장 시 formats 필드 누락 문제 수정. FormatModal.handleSaveAllTrades dataToSave에 formats: ['HARU주식관리'] 명시 추가 + bracket notation → 고정 stock_* 이름으로 교체. RecordPage.handleSaveFormatData가 formatData.formats 배열을 감지해 selectedFormats를 override하도록 확장(Object.entries 루프에서 'formats' 키 스킵). SAYU 페이지의 getMonthListData 필터(r.formats.includes(format))가 저장 레코드를 정확히 HARU주식관리로 인식 가능
- 수정파일: FormatModal.tsx, RecordPage.tsx
- 다음할일: 기존 주식 기록 삭제 → 재업로드 → SAYU→HARU주식관리 확장 시 거래 리스트 정상 표시 확인

### 2026-04-23 (35차)
- 완료: StockDashboard 날짜 필터/정렬 형식 불일치 수정. stock_date는 'YYYY-MM-DD HH:MM:SS' 형식인데 필터는 'YYYY-MM-DD'로 비교해 모든 항목이 제외되던 문제. 필터는 .slice(0,10)로 날짜만 비교, 정렬은 .slice(0,16)로 분 단위까지 비교
- 수정파일: frontend/src/app/pages/SayuPage.tsx
- 다음할일: 전체기간 선택 시 28건 전체 표시 + 오늘/이번주/이번달 프리셋 동작 확인

### 2026-04-23 (36차)
- 완료: HARU주식관리·나도작가 독립 카테고리 분리. Category 타입에 'HARU주식관리'·'나도작가' 추가. CATEGORY_FORMATS에서 생활 배열에서 HARU주식관리 제거 후 독립 키로 분리. RecordPage 카테고리 네비에 📈/🪶 이모지 추가 + 클릭 시 각각 FormatModal/NovelIntro 바로 오픈(기존 isDeveloper 중복 버튼 제거). SayuPage.getMonthListData에 HARU주식관리 섹션 추가(records 기반 전체기간, 하루LAW 다음 위치). SayuPage 하루AI지식창고 섹션을 isDeveloper 게이트로 감쌈
- 수정파일: haruTypes.ts, RecordPage.tsx, SayuPage.tsx
- 다음할일: 기록 페이지 카테고리 6개 노출(생활·업무·하루학습·하루LAW·📈HARU주식관리·🪶나도작가), HARU주식관리 클릭 시 작성 모달, SAYU에 하루충전소→하루LAW→HARU주식관리→(개발자만)AI지식창고 순서 확인

---

## 2026-04-23 HARU주식관리 대규모 개발

### 배경
- 키움증권 카카오 알림 CSV를 활용한 주식 거래 자동 기록 아이디어 (Gemini 제안)
- 스크린샷 OCR 방식 → Gemini 환각 문제로 포기 → CSV 파싱 방식으로 전환

### 완성된 기능
1. **카톡 내보내기 파싱** — .txt/.csv 업로드 → [키움]체결통보 파싱 → 28건 자동 추출
2. **전체 저장** — 28건을 각각 별도 Firestore 문서로 저장 (stock_YYYYMMDDHHMMSS_i)
3. **SAYU 주식 대시보드** — HARU주식관리 클릭 시 전용 대시보드 표시
   - 통계 카드 (매수·매도·종목수·총거래금액)
   - 도넛차트 (매수/매도 비율)
   - 날짜·기간 필터 (직접입력 + 오늘/이번주/이번달/3개월)
   - 거래종류 필터 (전체/산것/판것)
   - 종목 필터 (실제 거래 종목 자동 목록)
   - 순서 정렬 (최신/오래된/금액높은/금액낮은순)
   - 전체 거래내역 카드 목록
4. **쉬운말+전문용어 병기** — "산 거래 매수", "판 거래 매도" 등 주식초보 배려
5. **랜딩 배너** — 나도작가 "AI가 당신의 과거로 미래를 씁니다" 문구 추가

### 핵심 설계 결정
- formats: ['HARU주식관리'] 필드 필수 → SayuPage 인식
- stock_name/type/price/quantity/total/date 고정 필드명 사용
- 날짜 비교: stock_date.slice(0,10) 방식으로 통일
- 종목코드 매핑 12개 (삼성전자·LG전자·삼성물산·한화 등)

### 나도작가 철학 확정
- "예언가적 도구" — 내가 선택한 가치관으로 AI가 미래 서사 생성
- "과거에 다른 선택을 했다면?" 탐색 도구
- 마케팅 핵심 문구: "AI가 당신의 과거로 미래를 씁니다"

### 내일 할 것
- 키움증권 거래내역 엑셀(.xlsx) 업로드 파싱 추가
- HARU주식관리 독립 카테고리 분리 (생활에서 제거)
- 한국투자증권 계좌 개설 → 주가 비교 기능 개발
- 업로드 방식 안내 개선 (방법①카카오/방법②엑셀)

---

### 2026-04-24 (37차)
- 완료: 하루AI지식창고 검색/제목 개선. aiSearchMode('title'|'content') state 신규. 검색창에 📌 제목 / 🔍 본문 토글 버튼 추가(모드 전환 시 검색어 리셋). 필터 로직: 제목 모드는 ai_title || title, 본문 모드는 content 부분 일치. 카드 클릭 시 ai_title 없으면 Cloud Function 'extractTitle' 호출(content 앞 500자, format 'ai_log')해 Firestore users/{uid}/records/{logId} 문서에 ai_title 업데이트 + 로컬 aiLogs state도 반영. 이미 import되어 있는 getFunctions/httpsCallable/doc/updateDoc/db 재사용(동적 import 대신)
- 수정파일: frontend/src/app/pages/SayuPage.tsx
- 다음할일: AI지식창고 카드 클릭 → 제목 자동 생성 후 목록에 반영, 본문 검색으로 키워드 조회 동작 확인

### 2026-04-24 (38차)
- 완료: 하루AI지식창고 일괄 AI 제목 추출. aiLogs 로드 완료 후 ai_title 없는 항목(content 6자 이상)을 순차 extractTitle 호출해 Firestore + 로컬 state 동시 업데이트. 개별 실패는 console.warn으로 스킵, 전체 실패도 워닝만. 카드 클릭 대기 없이 첫 조회 시 자동 제목 일괄 완성
- 수정파일: frontend/src/app/pages/SayuPage.tsx
- 다음할일: AI지식창고 열기 즉시 기존 항목들 제목이 순차 생성되는지, 새로고침 후 저장된 ai_title이 유지되는지 확인

### 2026-04-24 (39차)
- 완료: FormatModal 사진 업로드 중 포도송이 LoadingOverlay 적용 (isUploading=true일 때 visible). PDF 오버레이는 FormatModal에 isPrinting state 없어 제외(인쇄는 SayuPage 쪽이라 별도 처리 필요)
- 수정파일: frontend/src/app/components/FormatModal.tsx
- 다음할일: 사진 업로드 시 포도송이 오버레이 노출 확인, PDF 오버레이는 SayuPage/PrintModal 등 인쇄 경로에서 별도 적용

### 2026-04-24 (40차)
- 완료: PDFPreviewModal 인쇄/PDF 저장 시 포도송이 LoadingOverlay 적용. isPrinting state 신규, handlePrint/handleDownload 모두 800ms 오버레이 → window.print() → 1초 후 오버레이 해제. 모달 return 최상단 div 끝에 LoadingOverlay(message='PDF 생성 중...') 추가
- 수정파일: frontend/src/app/components/PDFPreviewModal.tsx
- 다음할일: 인쇄/PDF 저장 버튼 클릭 시 800ms 포도송이 표시 후 인쇄 다이얼로그 연동 확인

### 2026-04-24 (41차)
- 완료: PDFPreviewModal 인쇄/PDF 저장 시 안내 토스트 추가(sonner). 🖨️/📄 이모지 + '인쇄 화면이 열릴 때까지 기다려 주세요' 5초 표시, 딥블루(#1A3C6E) 배경 + 흰 글씨 + 10px radius 스타일. react-hot-toast 대신 프로젝트 기본 sonner 사용
- 수정파일: frontend/src/app/components/PDFPreviewModal.tsx
- 다음할일: 인쇄 버튼/PDF 저장 버튼 클릭 시 토스트 + 포도송이 동시 표시 후 인쇄 다이얼로그 연동 확인

### 2026-04-24 (42차)
- 완료: 하단 네비게이션 정리. 기록합침(/merge)·통계(/stats) 메뉴 제거, 책스튜디오(/book-studio)는 isDeveloper 게이트 해제하고 전체 공개. Layers/BarChart3 아이콘 import도 제거. isDeveloper/useAuth/DEVELOPER_UID 상수는 유지(추후 재사용 대비). navItems 5개(HARU·기록·SAYU·책스튜디오·설정)
- 수정파일: frontend/src/app/components/BottomNav.tsx
- 다음할일: 5개 탭 표시 확인, 통계 기능은 각 형식 안으로 이동하는 별도 작업 진행

### 2026-04-24 (43차)
- 완료: 하단 SAYU 탭 라벨을 'SAYU·다듬기'로 변경 (다듬기 기능 강조)
- 수정파일: frontend/src/app/components/BottomNav.tsx
- 다음할일: 모바일 좁은 화면에서도 'SAYU·다듬기' 2줄 안 넘치는지 표시 확인

### 2026-04-24 (44차)
- 완료: 책스튜디오 개발자 전용으로 복구(42차 전체공개 되돌림). baseItems 4개(HARU·기록·SAYU·다듬기·설정), isDeveloper면 3번째 뒤(설정 앞)에 책스튜디오 삽입해 5개
- 수정파일: frontend/src/app/components/BottomNav.tsx
- 다음할일: 일반 사용자 4개 탭, 개발자 5개 탭 표시 확인

### 2026-04-24 (45차)
- 완료: SAYU 리스트 뷰 형식 헤더에 📊 통계/합치기 모달 추가. formatStatModal state(isOpen/format/prefix/entries/tab) 신규. 형식 헤더를 flex div로 래핑 후 펼침 버튼 우측에 📊 버튼 추가(하루LAW·HARU주식관리 제외). 바텀시트 모달에 [📊 통계] 탭(전체/SAYU완료/SAYU비율/기록월수 4카드 + 월별 바 차트 최근 6개월)과 [📎 합치기] 탭(날짜순 정렬 후 각 기록을 '[YYYY년 M월 D일 — 제목]\n본문' 포맷으로 조합 → 클립보드 복사, sonner 토스트)
- 수정파일: frontend/src/app/pages/SayuPage.tsx
- 다음할일: 생활/업무 형식 헤더에서 📊 클릭 → 통계/합치기 동작 확인, 하루LAW·HARU주식관리는 📊 버튼 미노출 확인

### 2026-04-24 (46차)
- 완료: 형식 헤더 UI 재설계. 단일 📊 아이콘 버튼 제거 → [통계](테두리 pill) + [기록합치기](딥블루 pill) + ▼ 화살표 버튼으로 분리. 헤더 배경 #FEFBE8 → #f9fafb (라이트 그레이로 톤 정돈). 아이콘/형식명 영역과 화살표 영역 둘 다 toggleFormat 호출. 통계 버튼은 모달을 'stat' 탭으로, 기록합치기 버튼은 'merge' 탭으로 바로 오픈. 하루LAW·HARU주식관리 제외 조건 유지
- 수정파일: frontend/src/app/pages/SayuPage.tsx
- 다음할일: 리스트 뷰 헤더에서 [통계]/[기록합치기] pill 표시 + 각각 해당 탭으로 모달 오픈 확인

### 2026-04-24 (47차)
- 완료: [통계]/[기록합치기] 버튼을 모달 열지 말고 기존 페이지로 라우팅. 통계 → navigate(`/stats/${format}`), 기록합치기 → navigate('/merge'). useNavigate/navigate는 이미 상단(line 2, 219)에 존재. formatStatModal state 및 바텀시트 모달 JSX는 남겨두되 헤더 버튼은 페이지 이동만
- 수정파일: frontend/src/app/pages/SayuPage.tsx
- 다음할일: 통계 pill 클릭 시 /stats/일기 형식 페이지 진입, 기록합치기 pill 클릭 시 /merge 페이지 진입 확인. 미사용 formatStatModal 모달 JSX는 필요 시 추후 제거

### 2026-04-24 (48차)
- 완료: /stats/:format 라우트 신규 등록(FormatStatisticsPage lazy import). FormatStatisticsPage 뒤로가기 버튼을 '/stats' → '/sayu'로 변경(SAYU로 돌아가기 라벨). MergePage는 뒤로가기 버튼 미존재라 스킵
- 수정파일: frontend/src/app/routes.tsx, frontend/src/app/pages/FormatStatisticsPage.tsx
- 다음할일: /stats/일기 진입 + 뒤로가기로 SAYU 복귀 확인

### 2026-04-24 (49차)
- 완료: MergePage 헤더 오른쪽에 닫기(X) 버튼 추가 → navigate('/sayu')로 SAYU 복귀. X 아이콘/navigate 기존 import 재사용. 22px 회색(#6B7280), padding 6, 원형 hover 영역
- 수정파일: frontend/src/app/pages/MergePage.tsx
- 다음할일: 기록합치기 페이지에서 X 버튼으로 SAYU 복귀 동작 확인

### 2026-04-24 (50차)
- 완료: '나도작가' → 'HARU예언' 리브랜딩. RecordPage 카테고리 배열/클릭분기/라벨/인트로모달(이모지 ✍️→🔮, 제목 'HARU예언', 부제 '사주보다 정확한 AI 예언 — 내 기록이 미래를 말합니다') 전부 교체. NovelStudio 헤더 아이콘/제목 '소설 스튜디오' → '🔮 HARU예언'. Tab 유니온에 'motive' 추가, TABS 배열 맨 앞에 { id: 'motive', icon: '🔮', label: '예언 모티브' } 삽입. NovelSettings에 motive?/motiveCustom? 추가, defaultSettings에 빈 문자열 기본값. MotiveTab 신규 컴포넌트(5옵션: 딸의 미래/나의 미래/그때 이랬다면/로또 1등/직접설정, custom 선택 시 textarea). 탭 렌더 분기에 motive 라인 추가
- 수정파일: frontend/src/app/pages/RecordPage.tsx, frontend/src/app/pages/NovelStudio.tsx
- 다음할일: 기록 페이지 🔮 HARU예언 버튼 → 인트로 모달 → 스튜디오 진입 → 예언 모티브 탭 5개 옵션 선택 + custom 입력 동작 확인

### 2026-04-24 (51차)
- 완료: HARU예언 스튜디오 하단 버튼 동적 교체. 마지막 탭(events)이면 '🔮 시놉시스 생성 →', 그 외엔 '다음 단계 (N/8) — {nextTab.icon} {nextTab.label} →' 텍스트 + setActiveTab으로 진행. IIFE로 currentIndex/isLastTab/nextTab 계산
- 수정파일: frontend/src/app/pages/NovelStudio.tsx
- 다음할일: 각 탭에서 하단 버튼 라벨(1/8~8/8) 확인 + 마지막 탭에서 시놉시스 페이지 진입 확인

### 2026-04-24 (52차)
- 완료: TABS 순서 재배열. 예언모티브 → 인물 → 탄생 → 욕망 → 족쇄 → 사건 → 운 → 서사 (서사를 마지막으로 두어 다음단계 버튼이 '서사' 탭에서 '시놉시스 생성'으로 바뀌게 함)
- 수정파일: frontend/src/app/pages/NovelStudio.tsx
- 다음할일: 새 순서로 탭 진행 + 서사 탭 마지막에서 시놉시스 페이지 연결 확인

### 2026-04-24 (53차)
- 완료: HARU예언 '불운' 탭 신규 추가. Tab 유니온 'unluck' 추가, TABS에 🌧 불운 항목을 '운' 바로 뒤에 삽입해 총 9탭. UnluckTab 컴포넌트(로즈 팔레트 #FFF1F2/#FDA4AF/#9F1239/#E11D48, 불운의 법칙 안내 카드 + 복수 선택 옵션 6개(흙수저로 탄생·장애·사고·자연재해·투자 실패·잘못된 만남) + 직접 입력 textarea). 탭 렌더에 unluck 라인 추가
- 수정파일: frontend/src/app/pages/NovelStudio.tsx
- 다음할일: 운 탭 다음 '불운' 탭 노출 + 복수 선택·직접입력 동작 확인. 다음단계 버튼 N/9 증가 표시 확인

### 2026-04-24 (54차)
- 완료: NovelSynopsisPage 신규 페이지(/novel-synopsis) 생성. 헤더(🔮 HARU예언 + ← 설정으로), 안내 카드(인디고 팔레트 #EEF2FF/#C7D2FE), '예언 시작하기' 버튼(placeholder alert로 Gemini API 연동 대기), '설정 수정하기' 버튼. routes.tsx에 NovelSynopsisPage lazy import + novel-synopsis 라우트 등록
- 수정파일: frontend/src/app/pages/NovelSynopsisPage.tsx (신규), frontend/src/app/routes.tsx
- 다음할일: HARU예언 스튜디오 마지막 탭 → 시놉시스 생성 버튼 → /novel-synopsis 라우팅 확인. Gemini API 연동 시 placeholder alert 제거 필요

### 2026-04-24 (55차)
- 완료: generateHaruProphecy Cloud Function(asia-northeast3) 신규. type='synopsis'는 800~1200자 시놉시스, type='story'는 4000~6000자 소설. 시스템 프롬프트에 HARU예언 5대 법칙(자연/인과/관계/유전과환경/보편원리) 삽입, 독자가 자기 이야기처럼 느끼도록 3인칭 기승전결 + 희망적 마무리 규칙. 사용량은 prophecyUsage/{uid} 문서에 daily/dailyCount/monthly/monthlyCount로 기록, 하루 1회 + 월 30회 제한. 기존 admin.firestore() 전역 db 재사용, gemini-3.1-flash-lite-preview 모델
- 수정파일: functions/src/index.ts
- 다음할일: 프론트(NovelSynopsisPage) → generateHaruProphecy httpsCallable 연결, type 인자로 시놉시스/스토리 분기, 제한 초과 에러 토스트 처리

### 2026-04-24 (56차)
- 완료: NovelStudio 상단 탭 네비게이션 숨김 → "N/9 단계 · 현재탭 · 완료수/9 + 진행바" UI로 교체. activeTab/visitedTabs 초기값 'motive'로 통일. tabDataRef + isDeveloper(DEV_UID naver_lGu8c7z0B13JzA5ZCn...) 추가. 🔮 시놉시스 생성 버튼: 개발자일 때만 saveNow(settings), navigate('/novel-synopsis', { state: { settings, tabData }}). luck/unluck 탭 렌더에 '신의 영역' 안내 카드 추가(luck: amber 팔레트 #FFF8F0/#F59E0B, unluck: rose 팔레트 #FFF1F2/#FDA4AF)
- 수정파일: frontend/src/app/pages/NovelStudio.tsx
- 다음할일: 탭 네비 숨김 + 진행 표시 확인, 시놉시스 페이지에서 location.state.settings 수신 후 generateHaruProphecy 호출 구현

### 2026-04-24 (57차)
- 완료: (1) NovelSettings에 testMode?/birthOwner? 추가. (2) BirthTab이 s/upd 받아 최상단 '누구의 탄생 설정인가요?' 카드 추가(인물 배열이 있으면 이름/역할, 없으면 기본 4역할). (3) 탭 렌더 BirthTab에 s/upd 전달. (4) 헤더 저장버튼 옆 개발자 전용 🧪 테스트 채우기 버튼 — motive/birthOwner/chars(2명)/events(2건) 자동 채우고 모든 탭 방문 처리 + activeTab='narrative' 이동 + sonner 토스트. toast 'sonner' import 추가. (5) MotiveTab에 onNext prop 추가, 'custom' 외 옵션 클릭 시 300ms 후 자동 다음 탭. 탭 렌더에 onNext 주입(이동 시 visitedTabs 갱신). motive 탭 활성일 땐 하단 다음단계 버튼 숨김(return null). (6) NovelSynopsisPage 전면 교체 — useLoading/sonner/httpsCallable 연결, generateHaruProphecy 호출해 type='synopsis' 800~1200자 본문 받아 화면 표시, 결과 후엔 '서사 수정하기'/'다시 생성'/'이야기 생성하기(type=story)'/'PDF 저장' 버튼 노출. 이야기 생성 시 /novel-story 라우트로 state 전달(다음 단계에서 페이지 구현 필요)
- 수정파일: frontend/src/app/pages/NovelStudio.tsx, frontend/src/app/pages/NovelSynopsisPage.tsx
- 다음할일: (a) '누구의 탄생' 선택 후 나머지 필드가 해당 인물과 매핑되도록 로직 확장 (b) /novel-story 페이지/라우트 구현 + generateHaruProphecy(type='story') 결과 렌더 (c) prophecyUsage 남은 횟수 UI 표시

---

최종 업데이트: 2026.04.24
HARU2026 by JOYEL — 허 교장님 전용
