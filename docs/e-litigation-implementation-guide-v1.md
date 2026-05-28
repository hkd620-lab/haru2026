# 전자소송 체크리스트 비서 — 1차 구현 지시문

> 참조 설계서: `docs/e-litigation-checklist-assistant-design.md`  
> 작성 기준일: 2026-05-28  
> 이 문서는 기장(Codex)에게 전달하는 실제 구현 지시문이다.

---

## 1. 작업 목적

전자소송 제출 후 사용자가 놓치기 쉬운 항목(송달 확인, 보정명령 대응, 기한 관리, 서류 누락)을 체크리스트로 관리하는 비서 기능을 HARU2026 앱에 1차 구현한다.

**핵심 원칙 — 반드시 지킨다:**

- 법률 판단 AI가 아니다. 체크리스트·기록·알림 보조 기능이다.
- 기한 자동 계산 금지. 사용자가 직접 입력한 날짜만 사용한다.
- 기존 Firestore 경로 `users/{uid}/records/{date}` 절대 변경 금지.
- 소장 자동작성, 승소 가능성 판단, 지연손해금 자동 계산 구현 금지.

---

## 2. 작업 규모

**중규모** — 새 페이지 2개 + 서비스 파일 1개 + 라우터 1줄 추가 + Firestore rules 수정

---

## 3. 금지 사항 (절대 준수)

| 금지 항목 | 이유 |
|---|---|
| `users/{uid}/records/{date}` 경로 수정 | 기존 일상기록 파괴 |
| `App.tsx` 기존 라우트 수정 | 기존 라우팅 파괴 |
| `BottomNav.tsx` 수정 | 네비게이션 구조 변경 |
| `firestoreService.ts` 기존 함수 수정 | 기존 기록 기능 파괴 |
| `routes.tsx`, `HaruRawPage.tsx`, `.zombie` 파일 수정 | 좀비 파일 |
| `LawsuitPracticePage.tsx` 기존 로직 수정 | 기존 연습 기능 파괴 |
| `firestore.rules` 기존 rules 삭제 | 기존 보안 파괴 |
| 법률 기한 자동 계산 로직 구현 | 법률 책임 문제 |
| 소장 자동작성 기능 구현 | 범위 외 |
| AI 모델 교체·다운그레이드 | 품질 영향 → 머지 전 보고 필수 |

---

## 4. 신규 생성 파일 목록

```
frontend/src/app/services/legalCasesService.ts     ← Firestore CRUD (신규)
frontend/src/app/pages/LegalCasesPage.tsx           ← 사건 목록 + 등록 (신규)
frontend/src/app/pages/LegalCaseDetailPage.tsx      ← 사건 상세 탭 (신규)
frontend/src/app/types/legalCaseTypes.ts            ← 타입 정의 (신규)
```

---

## 5. 수정 대상 파일 목록

```
frontend/src/app/App.tsx          ← 라우트 1줄 추가, import 1줄 추가
firestore.rules                   ← legalCases rules 1개 블록 추가
```

**LawsuitPracticePage.tsx는 선택 수정이다.** 하단에 "사건 관리 비서" 링크 버튼 1개 추가만 허용. 기존 로직은 건드리지 않는다.

---

## 6. Firestore 구조

### 6.1 컬렉션 경로

```
users/{uid}/legalCases/{caseId}
users/{uid}/legalCases/{caseId}/documents/{documentId}
```

서브컬렉션 `documents`는 송달문서, 보정명령 등 문서 기록용이다.

### 6.2 legalCases 문서 필드

```typescript
interface LegalCase {
  id: string;
  title: string;               // 사건명 (예: "홍길동 대여금 청구")
  caseNumber: string;          // 사건번호 (자유입력, 예: "2024가단12345")
  courtName: string;           // 법원명
  caseType: LegalCaseType;     // 아래 enum 참고
  partyRole: PartyRole;        // 신청인/원고 or 피신청인/피고
  submittedAt: string;         // 제출일 (YYYY-MM-DD, 사용자 입력)
  receiptNumber?: string;      // 접수번호 (선택)
  status: LegalCaseStatus;     // 아래 enum 참고
  memo?: string;               // 중요 메모
  lastCheckedAt?: string;      // 마지막 송달확인일 (YYYY-MM-DD)
  checklistSubmit: SubmitChecklist; // 제출 후 체크리스트
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type LegalCaseType = 
  | '지급명령' 
  | '소액대여금' 
  | '물품대금' 
  | '임대차보증금' 
  | '기타';

type PartyRole = '신청인/원고' | '피신청인/피고';

type LegalCaseStatus = 
  | '제출완료' 
  | '송달확인중' 
  | '보정필요' 
  | '추가서류필요' 
  | '종결' 
  | '보류';

interface SubmitChecklist {
  confirmedSubmitScreen: boolean;    // 제출 완료 화면 확인
  savedReceipt: boolean;             // 접수증 저장
  checkedCaseNumber: boolean;        // 사건번호 부여 확인
  confirmedFeePayment: boolean;      // 인지대·송달료 납부 확인
  savedFinalPdf: boolean;            // 제출서류 PDF 보관
  checkedAttachments: boolean;       // 첨부증거 누락 확인
  confirmedMyCaseList: boolean;      // 나의 사건현황 등록 확인
}
```

### 6.3 documents 서브컬렉션 필드

```typescript
interface LegalDocument {
  id: string;
  caseId: string;
  title: string;                     // 문서명
  documentType: LegalDocumentType;   // 아래 enum
  receivedAt?: string;               // 수령·열람일 (YYYY-MM-DD, 사용자 입력)
  dueDateByUserInput?: string;       // 사용자가 직접 입력한 기한 (YYYY-MM-DD)
  requiresAction: boolean;           // 대응 필요 여부
  actionStatus: ActionStatus;        // 처리 상태
  actionMemo?: string;               // 처리 내용 메모
  isCompleted: boolean;              // 처리 완료 여부
  completedAt?: string;              // 처리 완료일 (YYYY-MM-DD)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type LegalDocumentType = 
  | '보정명령' 
  | '결정문' 
  | '기일통지서' 
  | '이행권고결정' 
  | '준비명령' 
  | '판결문'
  | '기타';

type ActionStatus = '확인전' | '검토중' | '처리완료' | '해당없음';
```

---

## 7. Firestore rules 수정

`firestore.rules` 맨 아래에 다음 블록을 추가한다. 기존 rules는 한 줄도 건드리지 않는다.

```
// 전자소송 사건 관리
match /users/{uid}/legalCases/{caseId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;

  match /documents/{documentId} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
}
```

---

## 8. legalCasesService.ts 구현 지시

경로: `frontend/src/app/services/legalCasesService.ts`

**기존 `firestoreService.ts`는 건드리지 않는다. 별도 파일로 만든다.**

구현할 함수 목록:

```typescript
// 사건 CRUD
getLegalCases(uid: string): Promise<LegalCase[]>
getLegalCase(uid: string, caseId: string): Promise<LegalCase | null>
createLegalCase(uid: string, data: Omit<LegalCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>
updateLegalCase(uid: string, caseId: string, data: Partial<LegalCase>): Promise<void>
deleteLegalCase(uid: string, caseId: string): Promise<void>

// 체크리스트 업데이트
updateSubmitChecklist(uid: string, caseId: string, checklist: Partial<SubmitChecklist>): Promise<void>

// 마지막 송달확인일 업데이트
updateLastCheckedAt(uid: string, caseId: string, date: string): Promise<void>

// 문서 CRUD
getDocuments(uid: string, caseId: string): Promise<LegalDocument[]>
addDocument(uid: string, caseId: string, data: Omit<LegalDocument, 'id' | 'caseId' | 'createdAt' | 'updatedAt'>): Promise<string>
updateDocument(uid: string, caseId: string, documentId: string, data: Partial<LegalDocument>): Promise<void>
deleteDocument(uid: string, caseId: string, documentId: string): Promise<void>
```

- `auth`와 `db`는 `../../firebase`에서 import.
- `serverTimestamp()`를 `createdAt`, `updatedAt`에 사용.
- `uid` 파라미터는 `auth.currentUser?.uid`를 함수 외부에서 전달받는 방식으로 한다.

---

## 9. LegalCasesPage.tsx 구현 지시

경로: `frontend/src/app/pages/LegalCasesPage.tsx`

### 역할

사건 목록 + 새 사건 등록 폼을 하나의 페이지에서 처리한다.

### 화면 구성

**상단 헤더:**
- 좌측: `← 뒤로가기` 버튼 (`useNavigate(-1)`)
- 중앙: `전자소송 체크리스트`
- 우측: `+ 사건 추가` 버튼

**사건 목록 영역:**

각 사건 카드에 표시:
- 사건명
- 사건번호
- 법원명
- 현재 상태 배지 (상태별 색상 구분)
- 마지막 송달확인일
- 카드 클릭 시 `/legal-cases/:caseId` 로 이동

**빈 상태:**
- "등록된 사건이 없습니다." 안내 + 사건 추가 버튼

**사건 등록 폼 (모달 또는 하단 슬라이드):**

필수 입력:
- 사건명 (텍스트)
- 사건번호 (텍스트, 자유입력)
- 법원명 (텍스트)
- 사건유형 (드롭다운: 지급명령/소액대여금/물품대금/임대차보증금/기타)
- 당사자 구분 (라디오: 신청인·원고 / 피신청인·피고)
- 제출일 (날짜 입력, YYYY-MM-DD)
- 현재 상태 (드롭다운)

선택 입력:
- 접수번호
- 메모

**폼 하단 고정 안내 문구:**

```
이 기능은 전자소송 진행 중 확인사항을 기록하고 놓치지 않도록 돕는 체크리스트입니다.
법률 효과, 기한, 법적 판단이 필요한 내용은 전자소송포털, 법원 안내문, 관련 법령을 기준으로 확인해야 합니다.
```

### 상태 배지 색상

| 상태 | 색상 |
|---|---|
| 제출완료 | 파란색 |
| 송달확인중 | 노란색 |
| 보정필요 | 빨간색 |
| 추가서류필요 | 주황색 |
| 종결 | 회색 |
| 보류 | 연회색 |

---

## 10. LegalCaseDetailPage.tsx 구현 지시

경로: `frontend/src/app/pages/LegalCaseDetailPage.tsx`  
라우트: `/legal-cases/:caseId`

### 탭 구성 (4개)

```
[사건정보] [체크리스트] [송달기록] [보정·기한]
```

**주의: 문서보관 탭은 1차 구현에서 제외한다. 파일 업로드 보안 검토 전이다.**

---

### 탭 1: 사건정보

표시 항목:
- 사건명, 사건번호, 법원, 사건유형, 당사자 구분, 제출일, 접수번호
- 현재 상태 배지 + 상태 변경 버튼
- 마지막 송달확인일 + `오늘 확인했어요` 버튼
- 메모 영역

`오늘 확인했어요` 버튼 클릭 시: `updateLastCheckedAt(uid, caseId, 오늘날짜)` 호출.

하단 고정 주의 문구:
```
전자송달 문서는 정기적으로 확인해야 합니다.
문서를 열람하지 않아도 법령상 일정 기간이 지나면 송달된 것으로 간주될 수 있습니다.
정확한 효력과 기간은 전자소송포털, 법원 안내문, 관련 법령을 기준으로 확인해야 합니다.
```

---

### 탭 2: 체크리스트

제목: `제출 후 확인 체크리스트`

항목 7개 (각각 체크박스):

```
□ 제출 완료 화면 확인
□ 접수증 또는 제출내역 저장
□ 사건번호 부여 확인
□ 인지대·송달료 납부 상태 확인
□ 제출서류 PDF 최종본 보관
□ 첨부증거 누락 여부 확인
□ 나의 사건현황 등록 확인
```

체크 상태는 `LegalCase.checklistSubmit` 필드에 실시간 저장.

전체 완료 시 상단에 초록색 완료 배너 표시.

---

### 탭 3: 송달기록

**목록 영역:**
- 기록된 송달문서 목록 (역순)
- 각 항목: 문서명, 문서 유형, 수령일, 대응 필요 여부, 처리 상태

**새 기록 추가 버튼:**

입력 필드:
- 문서명 (텍스트)
- 문서 유형 (드롭다운)
- 수령·열람일 (날짜, 사용자 입력)
- 대응 필요 여부 (토글)
- 대응 기한 (날짜, 사용자 직접 입력, 필수 아님)
- 메모 (텍스트)

**하단 고정 주의 문구:**
```
송달 효력 발생일과 간주송달 기간은 사건유형과 적용 법령에 따라 달라질 수 있습니다.
비서는 이를 자동 확정하지 않습니다. 전자소송포털 안내와 법원 문서를 기준으로 확인하세요.
```

---

### 탭 4: 보정·기한

**목록 영역:**
- 기록된 보정명령·기한 항목 목록
- 각 항목: 문서명, 사용자 입력 기한, 처리 상태

**새 기록 추가 버튼:**

입력 필드:
- 문서명 (텍스트)
- 문서 유형 (드롭다운: 보정명령/석명준비명령/기일통지서/결정문/기타)
- 수령·열람일 (날짜, 사용자 입력)
- **기한 (날짜, 사용자가 법원 문서 확인 후 직접 입력)**
- 해야 할 내용 (텍스트)
- 처리 완료 여부 (체크박스)
- 처리 완료일 (날짜)
- 메모

**기한 입력 필드 옆 고정 안내:**
```
기한은 사용자가 법원 문서를 확인한 뒤 직접 입력합니다.
비서는 기한을 자동 확정하지 않습니다.
```

기한까지 남은 일수를 표시할 때는 다음 형식으로 표시:
- "입력된 기한까지 D-3" (AI 계산 아님, 사용자 입력 날짜 기준 단순 차이)
- 기한 당일: 빨간색 강조
- 기한 지난 경우: "입력된 기한이 지났습니다 (기한 직접 확인 필요)"

---

## 11. App.tsx 수정 지시

**추가 내용만. 기존 라우트는 한 줄도 수정하지 않는다.**

import 추가 (기존 import 블록 맨 아래):
```tsx
import LegalCasesPage from './pages/LegalCasesPage';
import LegalCaseDetailPage from './pages/LegalCaseDetailPage';
```

라우트 추가 (기존 `<Route path="/lawsuit-practice">` 아래):
```tsx
<Route path="/legal-cases" element={<LegalCasesPage />} />
<Route path="/legal-cases/:caseId" element={<LegalCaseDetailPage />} />
```

---

## 12. LawsuitPracticePage.tsx 선택 수정 (선택 작업)

기존 LawsuitPracticePage 맨 마지막 화면(제출 완료 화면)에 다음 링크 버튼 1개를 추가할 수 있다.

```tsx
<button onClick={() => navigate('/legal-cases')}>
  사건 관리 비서로 이동
</button>
```

**조건:** 기존 코드를 한 줄도 수정하지 않는 경우에만 추가한다. 기존 조건부 렌더링, 상태 관리, 로직에 영향이 있다면 이 선택 작업은 건너뛴다.

---

## 13. UI/UX 가이드라인

- 기존 HARU2026 스타일 시스템(Tailwind, 기존 색상 팔레트)을 그대로 따른다.
- 새 UI 라이브러리를 추가하지 않는다.
- 기존 페이지들의 헤더 패턴(← 뒤로가기 + 중앙 제목)을 동일하게 적용한다.
- 법률 관련 주의 문구는 항상 작은 텍스트(text-xs 또는 text-sm)로 회색 배경 박스에 표시한다.
- 모바일 퍼스트. 웹 브라우저에서도 동작해야 하나, 좁은 화면 기준으로 설계한다.

---

## 14. 알림 기능

**1차 구현에서는 브라우저 알림(Notification API) 또는 FCM 알림을 구현하지 않는다.**

대신 다음만 구현한다:
- 사건 목록 화면에서 "오늘 송달 미확인" 사건에 노란 배지 표시
  - 조건: 마지막 송달확인일이 오늘이 아닌 사건, 상태가 '종결' 또는 '보류'가 아닌 사건
- 보정·기한 탭에서 기한이 3일 이내인 항목 빨간 강조 표시

푸시 알림 및 Functions 기반 알림은 2차 구현으로 이관한다.

---

## 15. 검수 체크리스트

작업 완료 후 아래를 직접 확인한다.

### 코드 검수

- [ ] `users/{uid}/records/{date}` 경로를 수정한 코드가 없는가
- [ ] `firestoreService.ts` 기존 함수를 수정한 코드가 없는가
- [ ] `App.tsx` 기존 라우트를 수정한 코드가 없는가
- [ ] `BottomNav.tsx`를 수정한 코드가 없는가
- [ ] `firestore.rules` 기존 블록을 수정한 코드가 없는가
- [ ] 법률 기한 자동 계산 로직이 없는가
- [ ] 승소 가능성, 법률 판단 자동화 코드가 없는가
- [ ] 모든 기한 표시가 "사용자 입력 날짜 기준"으로만 동작하는가

### 빌드 검수

```bash
cd ~/HARU2026/frontend
npm run build
```

오류 없음 확인.

### Firestore rules 검수

새로 추가한 rules 블록만 존재하고 기존 블록은 변경 없음 확인.

### 안전 문구 검수

- [ ] 모든 주의 문구가 설계서 9절 "위험 문구 제한" 기준을 준수하는가
- [ ] 간주송달 관련 단정 표현이 없는가
- [ ] 기한 자동 확정 표현이 없는가

---

## 16. 배포 절차

중규모 작업이므로 로컬 확인 후 배포.

```bash
# 1. 빌드 확인
cd ~/HARU2026/frontend && npm run build

# 2. 로컬 확인 후 허대표 승인

# 3. Firebase 배포
d  # frontend 디렉토리에서 실행

# 4. 커밋 및 머지
cd ~/HARU2026
git add .
git commit -m "Add e-litigation checklist assistant (Phase 1)"
git checkout main
git merge feature/new-formats
git push origin main
git checkout feature/new-formats
git push origin feature/new-formats
```

---

## 17. 2차 구현으로 이관된 항목

아래는 1차 구현에서 제외하고 설계서에 메모만 남긴다.

- 문서보관 탭 (파일 업로드, Firebase Storage)
- 브라우저 알림 (Notification API)
- FCM 푸시 알림 (Functions)
- 사건번호 자동 파싱 (연도, 부호, 일련번호 분리)
- 증거목록 탭
- 사건 기록 내보내기 (PDF)
- Firestore rules 세부 보안 강화

---

## 18. 작업 완료 보고 양식

기장은 작업 완료 후 아래 항목을 포함하여 보고한다.

```
- 현재 브랜치:
- 생성 파일:
  - legalCasesService.ts
  - LegalCasesPage.tsx
  - LegalCaseDetailPage.tsx
  - legalCaseTypes.ts
- 수정 파일:
  - App.tsx (라우트 2줄 추가만)
  - firestore.rules (1개 블록 추가만)
  - LawsuitPracticePage.tsx (선택, 추가 여부 명시)
- 기존 기록 경로 변경 없음 확인:
- 빌드 성공 확인:
- Firebase 배포 완료 여부:
- main merge/push 완료 여부:
- feature push 완료 여부:
```
