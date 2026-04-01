# HARU2026 Flutter Mobile — CLAUDE.md
> CC(Claude Code) 및 Claude AI 공통 참조 파일
> 작성일: 2026.03.30

당신은 HARU2026 Flutter 모바일 앱의 개발자입니다.
아래 순서대로 반드시 점검하세요.

---

## 프로젝트 기본 정보

| 항목 | 내용 |
|---|---|
| 경로 | ~/HARU2026/mobile/ |
| 브랜드 | HARU by JOYEL |
| 철학 | "간편하게 입력하고, 쓸모있게 남깁니다" |
| Firebase 프로젝트 | haru2026-8abb8 (웹앱과 공유) |
| Firebase 리전 | asia-northeast3 |
| Firestore 경로 | users/{uid}/records/{date} |
| GitHub 브랜치 | feature/new-formats |

---

## 기술 스택

| 항목 | 내용 |
|---|---|
| 프레임워크 | Flutter 3.35.4 |
| 언어 | Dart |
| 인증 | Firebase Auth (Google / 카카오 / 네이버) |
| 데이터베이스 | Firestore |
| 스토리지 | Firebase Storage |
| AI 엔진 | Gemini API — Firebase Functions 경유 전용 |

---

## 브랜드 컬러

| 이름 | 값 |
|---|---|
| 딥블루 | #1A3C6E |
| 오프화이트 | #FAF9F6 |
| 그린 | #10b981 |

---

## 핵심 기능

### SAYU(사유)
- 기능명은 항상 **SAYU(사유)** 로 표기
- 원문 감정·내용 보존 원칙 / 재창작·교훈 추가 금지
- Gemini API (gemini-3.1-flash-lite-preview) — Functions 경유 전용
- 결과: prefix + _sayu 필드에 저장
- SAYU 저장 버튼 2가지:
  - **다듬지 않고 SAYU 저장** — 원문을 _sayu 필드에 그대로 저장
  - **AI 다듬은 후 SAYU 저장** — 프리미엄 다듬기 후 _sayu 필드에 저장

### 홈 화면 위젯
- 처음부터 설계 필요 (핵심 기능)

### 소셜 로그인
- Google / 카카오 / 네이버
- Firebase Custom Token 방식 (카카오, 네이버)
- Functions 경유: kakaoLoginStart, kakaoCallback, naverLoginStart, naverCallback

---

## 기록 형식 10개

| 형식명 | Firestore prefix |
|---|---|
| 일기 | diary_ |
| 에세이 | essay_ |
| 여행기록 | travel_ |
| 텃밭일지 | garden_ |
| 애완동물관찰일지 | pet_ |
| 육아일기 | child_ |
| 선교보고 | mission_ |
| 일반보고 | report_ |
| 업무일지 | work_ |
| 메모 | memo_ |

---

## 구독 요금제

| 플랜 | 금액 |
|---|---|
| 무료 | ₩0 |
| 프리미엄 월 | ₩4,000 |
| 프리미엄 연 | ₩40,000 |

- 개발자 계정 UID: naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8 → 프리미엄 잠금 면제

---

## 보안 원칙 (절대 준수)

- API 키 앱 코드에 직접 노출 금지
- Gemini 포함 모든 API는 반드시 Firebase Functions 경유
- Secret Manager 사용 (KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)

---

## 점검 순서 (반드시 이 순서대로)

### 1단계: 빌드 오류 확인
```
flutter build apk --debug
```
오류 있으면 즉시 중단하고 수정 후 재시도

### 2단계: 영향받은 파일 확인
수정된 파일 목록을 보고 연관된 파일 모두 체크

### 3단계: 주요 화면 안전 점검
아래 화면이 import/라우팅 오류 없는지 확인
- LoginPage (로그인)
- HomePage (홈 + 홈 화면 위젯)
- RecordPage (기록)
- FormatModal (형식 모달)
- SayuPage / SayuModal (SAYU)
- CalendarPage (달력)
- SettingsPage (설정)
- BottomNav (네비게이션)

### 4단계: Firestore 경로 확인
users/{uid}/records/{date} 구조 유지되는지 확인

### 5단계: 보안 확인
API 키가 앱 코드에 노출되지 않았는지 확인
Gemini API는 반드시 Firebase Functions 경유인지 확인

### 6단계: Git 커밋
작업 완료 후 반드시 커밋

```
cd ~/HARU2026
git add -A
git commit -m "커밋메시지"
git push origin feature/new-formats
```

커밋 메시지 규칙 (한글 작성):
- feat: 새 기능 추가
- fix: 버그 수정
- design: UI/디자인 변경
- refactor: 코드 정리
- 예시: "feat: SAYU 저장 기능 추가"

---

## 점검 결과 보고 형식

✅ 빌드: 정상
✅ 영향 파일: 이상 없음
✅ 주요 화면: 이상 없음
✅ Firestore 경로: 정상
✅ 보안: 이상 없음
✅ Git 커밋 완료: [커밋 메시지]

문제 발견 시:
❌ [단계명]: [발견된 문제]
⛔ 작업 중단 - 수정 후 재시도

---

## CC 작업 원칙

- 요청된 것만 수정 — 임의 변경 절대 금지
- 작업 전 백업 권장 (file.dart.old)
- 과도하게 상세한 지시는 CC 창의성 제한 → 팩트만 간결하게 지시
- 완료 후 결과 보고 필수

---

## 주요 학습사항

- Gemini: gemini-3.1-flash-lite-preview만 사용 (다른 모델 사용 금지)
- Firebase Functions 환경변수: defineSecret / Secret Manager 사용
- 개발자 계정 면제는 이메일이 아닌 Firebase UID 기반
- 카카오 REST API 키: haru2026 키 사용 (default 키 사용 금지)
- Secret 값 입력 시 줄바꿈 문자(%0A) 포함 주의

---

*— HARU2026 Project Leader —*
