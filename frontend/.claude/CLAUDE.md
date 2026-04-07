# HARU2026 — Frontend CLAUDE.md
> CC(Claude Code)가 웹 프론트엔드 작업 시 반드시 참조하는 지침서

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

최종 업데이트: 2026.04
HARU2026 by JOYEL — 허 교장님 전용
