# CC 지시서 — refreshNews 인증 추가 (오늘 1단계)

## 작업 개요

허 교장님 작업 — 보안 긴급 수정.

`refreshNews` 함수에 인증 체크가 전혀 없어서 누구나 호출 가능한 상태야.
지금 이 순간에도 비용 폭증 위험이 있으니 개발자만 호출 가능하도록 막아줘.

미래에 일반 사용자에게도 한도 추가하여 개방할 가능성을 염두에 두고,
확장 가능한 구조로 만들어줘.

## 작업 전 안전 저장

```bash
cd ~/HARU2026 && git add -A && git commit -m "작업 전 안전 저장 - refreshNews 인증 추가"
```

## 수정 대상

### 파일: `~/HARU2026/functions/src/index.ts`

### 위치: `refreshNews` 함수 정의부 (대략 2221줄)

현재 코드:
```typescript
export const refreshNews = onCall(
  { secrets: [GEMINI_API_KEY_SECRET], region: 'asia-northeast3' },
  async () => {  // ← request.auth 검증 없음
    // ...
  }
);
```

### 수정 사항

다음 두 가지를 적용해줘:

1. **함수 시그니처 수정**: `async ()` → `async (request)`로 변경
2. **함수 본문 시작 부분에 인증 체크 추가**:

```typescript
// 개발자 UID — 향후 일반 사용자 개방 시 한도 체크 로직 추가 예정
const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const isDeveloper = request.auth?.uid === DEV_UID;

if (!isDeveloper) {
  // TODO: 정식 출시 시 일반 사용자 한도 체크 로직 추가
  // 예: 일 1회 / 월 30회 한도, 또는 유료 구독자만 허용
  throw new HttpsError('permission-denied', '뉴스 새로고침 권한이 없습니다');
}
```

⚠️ 주의:
- `DEV_UID` 상수가 같은 파일 위쪽에 이미 정의되어 있다면 중복 선언하지 말고 기존 것 사용해줘
- `HttpsError`가 import 안 되어 있으면 import 추가해줘
- 다른 onCall 함수들이 이미 비슷한 패턴 쓰고 있으면 그 스타일 따라줘 (일관성 유지)

## 작업 절차

1. **현재 코드 확인** — `index.ts` 2221줄 부근 `refreshNews` 함수 위치 확인
2. **DEV_UID 상수 위치 확인** — 같은 파일에 이미 있는지 확인 (예: `generateProphecy` 부근에 있을 가능성)
3. **HttpsError import 확인** — `import { HttpsError } from 'firebase-functions/v2/https';` 또는 유사한 import 있는지 확인
4. **수정 적용** — 위 수정 사항 반영
5. **빌드 확인** — `cd ~/HARU2026/functions && npm run build`
6. **빌드 성공하면 보고** — 배포는 허 교장님 승인 후 진행

## 보고 형식

작업 완료 후 다음을 보고해줘:

```
1. DEV_UID 상수 — 파일 내 어디에 정의되어 있는지 (또는 새로 정의했는지)
2. HttpsError — 기존 import 사용 / 새로 추가 / 이미 사용 중인지
3. 수정한 줄 번호 (전후 5줄 정도 코드 보여줘)
4. npm run build 결과 (성공/실패)
5. 배포 여부 — 허 교장님 승인 대기 중
```

## ⚠️ 절대 금지 사항

- 다른 함수 임의 수정 금지
- 다른 import 임의 추가/삭제 금지
- 배포 절대 금지 (허 교장님 승인 후)
- frontend 코드 건드리지 말 것 (이번 단계는 functions만)
- 기존 동작에 영향 주는 변경 금지 (refreshNews 인증 체크만 추가)

## 다음 단계 예고

이 작업이 완료되면 다음 작업이 이어질 거야:
- 2단계: fetchTopNews 자동 스케줄 비활성화
- 3단계: HomePage에서 "최신외신 3편" 버튼 개발자만 보이게
- 4단계: /news 라우트에 개발자 가드 추가

지금은 1단계만 처리해줘. 나머지는 허 교장님 검토 후 별도 지시서로 전달할게.
