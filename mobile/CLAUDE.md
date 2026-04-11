# HARU2026 — Mobile (Flutter) CLAUDE.md
> CC(Claude Code)가 Flutter 모바일 앱 작업 시 반드시 참조하는 지침서
> 경로: ~/HARU2026/mobile/CLAUDE.md

## 작업 규칙
- 각 단계 완료시 반드시 /compact 입력 안내
- 전체 작업 완료시 /clear 입력 안내
- MCP 도구는 10개 이하 유지

---

## 📌 프로젝트 기본 정보

| 항목 | 내용 |
|------|------|
| 프로젝트명 | HARU2026 (Flutter 앱) |
| 브랜드 | HARU by JOYEL |
| 핵심 철학 | "간편하게 입력하고, 쓸모있게 남깁니다" |
| 웹앱 URL | https://haru2026.com |
| 로컬 경로 | ~/HARU2026/mobile/ |
| 실행 명령어 | `m` (CC 탭에서 Flutter 실행 단축키) |

---

## 🛠 Flutter 환경

| 항목 | 내용 |
|------|------|
| Flutter 버전 | 3.35.4 |
| Android toolchain | 준비 완료 |
| Xcode | 준비 완료 (iOS 빌드 가능) |
| 백엔드 | 웹앱과 동일한 Firebase 프로젝트 공유 |
| DB | Firestore (웹앱과 동일 구조) |
| AI 엔진 | Gemini API (`gemini-3.1-flash-lite-preview`) — Functions 경유 전용 |

---

## 📂 Firestore 데이터 구조 (웹앱과 동일)

```
users/{uid}/records/{date}   ← 서브컬렉션 구조
```

### 기록 형식 10개 (웹앱과 동일 prefix 사용)

| 카테고리 | 형식명 | prefix |
|----------|--------|--------|
| 생활 | 일기 | `diary_` |
| 생활 | 에세이 | `essay_` |
| 생활 | 여행기록 | `travel_` |
| 생활 | 텃밭일지 | `garden_` |
| 생활 | 애완동물관찰일지 | `pet_` |
| 생활 | 육아일기 | `parenting_` |
| 업무 | 선교보고 | `mission_` |
| 업무 | 일반보고 | `report_` |
| 업무 | 업무일지 | `work_` |
| 업무 | 메모 | `memo_` |

> ✅ **AI 제목 자동추출**: 10개 형식 **전체** 적용. 제목을 비워두면 저장 시 AI가 내용을 분석해 자동으로 제목 생성.

### 공통 메타데이터 필드

```
_sayu       ← SAYU(사유) 결과 저장
_polished   ← AI 다듬기 결과
_tags       ← 태그
_images     ← 이미지 경로 배열
_rating     ← 별점
```

---

## 💳 Flutter 앱 구독 요금제

| 플랜 | 가격 |
|------|------|
| Flutter 앱 월 | 4,000원 |
| Flutter 앱 연 | 40,000원 |

### 프리미엄 잠금 기능
- SAYU(사유) PDF 내보내기
- 월·분기·연간 기록합침
- 월·분기·연간 통계

### 개발자 계정 (프리미엄 면제)
```
UID: naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8
```

---

## 🔐 보안 원칙 (절대 준수)

- **API 키 Flutter 앱 직접 노출 금지**
- **모든 API(Gemini 포함)는 반드시 Firebase Functions 경유**
- **Functions 환경변수:** `defineSecret` 사용 (`.env` 불안정)
- **민감 키:** Google Cloud Secret Manager 보관

---

## ✨ SAYU(사유) 핵심 원칙

> 허 교장님이 특별한 의미를 부여한 핵심 기능. 표기는 항상 **"SAYU(사유)"**.

- BASIC / PREMIUM 2가지 모드
- Gemini `gemini-3.1-flash-lite-preview` 모델만 사용
- 원문 감정·내용 보존 원칙 / 재창작·교훈 추가 금지
- SAYU 결과: `{prefix}_sayu` 필드에 저장
- 저장 버튼 텍스트:
  - "다듬지 않고 SAYU 저장"
  - "AI 다듬은 후 SAYU 저장"

---

## 🎨 브랜드 컬러

| 이름 | HEX |
|------|-----|
| 딥블루 | `#1A3C6E` |
| 오프화이트 | `#FAF9F6` |
| 그린(민트) | `#10b981` |

---

## ⚠️ 주요 주의사항

| 문제 | 확정 해결책 ✅ |
|------|--------------|
| iOS 텍스트 입력 자동 줌 | fontSize 16 이상 유지 필수 |
| Gemini 모델 선택 | `gemini-2.5-flash` 고정 (다른 모델 실패 이력) |
| Firestore 경로 오류 | `users/{uid}/records/{date}` 서브컬렉션만 사용 |
| iOS PWA 백그라운드 알림 | Apple 제한으로 완전 해결 어려움 — 대안 방식 사용 |
| PDF 생성 | Puppeteer 유료 솔루션 검토 중 (html2canvas 금지) |

---

## 🔧 CC 작업 원칙

1. **요청된 것만 수정** — 다른 부분 임의 변경 절대 금지
2. **작업 전 백업** — `file.dart.old` 형태로 백업
3. **Git 커밋 메시지** — 한글로 작성
4. **작업 완료 후** — 결과 보고 필수
5. **계획 합의 후 진행** — 임의로 진행 금지
6. **완료 후 알림:** `afplay /System/Library/Sounds/Glass.aiff`

---

## 📋 작업 브랜치

```
GitHub: hkd620-lab/haru2026
작업 브랜치: feature/new-formats
```

---

*최종 업데이트: 2026.04*
*HARU2026 by JOYEL — 허 교장님 전용*
