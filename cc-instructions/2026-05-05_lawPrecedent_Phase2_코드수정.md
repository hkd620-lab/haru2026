# 하루LAW lawPrecedent OpenAPI 연동 — Phase 2 코드 수정 지시서

**작성일:** 2026.05.05
**작성:** 시박사 (CI)
**실행:** CC
**작업 브랜치:** feature/new-formats
**연계:** `2026-05-05_lawPrecedent_OpenAPI연동.md` (Phase 1)

---

## 📌 Phase 1 보고 결과 반영 — 핵심 사실

CC의 Phase 1 분석을 100% 신뢰하고 다음 사실을 전제로 작업합니다:

1. ✅ `LAW_API_KEY` Secret에 OC 키 `harulaw2026` 이미 등록됨 (재사용)
2. ✅ `axios` import 이미 [line 9](functions/src/index.ts:9)에 있음
3. ✅ `lawPrecedent` 인증 가드 이미 있음 ([line 1395-1397](functions/src/index.ts:1395))
4. ✅ `GEMINI_API_KEY_SECRET` 이미 등록되어 있음
5. ❌ `lawPrecedent`의 `secrets` 배열에 `LAW_API_KEY_SECRET` 미등록 → 추가 필요
6. ❌ Gemini 시스템 프롬프트가 환각 유도 → 사실 요약 전용으로 교체

---

## 🎯 5가지 결정 사항 — 허 대표님 승인 완료

| # | 항목 | 결정 |
|---|---|---|
| 1 | 응답 형식 | **JSON** (`type=JSON`) |
| 2 | Gemini 호출 형태 | **메타데이터만, 일괄 요약** (1회 호출) |
| 3 | 반환 객체 | **기존 3개 키 유지 + 신규 필드 추가** |
| 4 | 상위 몇 건 | **3건** |
| 5 | 검색 키워드 | **Gemini 키워드 추출** (lawSearch 0단계 패턴) |

---

## 🔧 Phase 2 작업 — 단계별 코드 수정

### Step 1: `secrets` 배열에 `LAW_API_KEY_SECRET` 추가

**파일:** `functions/src/index.ts`
**위치:** `lawPrecedent` 함수의 `onCall` 옵션 ([line 1391 부근](functions/src/index.ts:1391))

**기존:**
```typescript
secrets: [GEMINI_API_KEY_SECRET]
```

**수정:**
```typescript
secrets: [LAW_API_KEY_SECRET, GEMINI_API_KEY_SECRET]
```

→ **변경 라인 1줄**

---

### Step 2: 함수 본문 전면 교체

**파일:** `functions/src/index.ts`
**위치:** `lawPrecedent` 함수 본문 (인증 가드 직후 ~ return 직전)

**유지할 부분:**
- 인증 가드 (line 1395-1397) **그대로 유지**
- 함수 시그니처 `async (request) => { ... }` 그대로
- 입력 파라미터: `request.data`에서 `lawText`, `userQuery` 분해

**교체할 부분:**
- 기존 Gemini 환각 호출 로직 전체 삭제
- 아래 새 로직으로 교체

#### 새 로직 구조 (의사 코드)

```typescript
// 1. 입력 파라미터 분해 (기존 유지)
const { lawText, userQuery } = request.data;
if (!lawText || lawText.trim().length === 0) {
  throw new HttpsError('invalid-argument', '법령 정보가 필요합니다');
}

// 2. Gemini로 검색 키워드 추출 (lawSearch 0단계 패턴 참고)
//    - 모델: gemini-3.1-flash-lite-preview (lawSearch와 동일)
//    - 입력: lawText + userQuery
//    - 출력: 검색용 핵심 키워드 1개 (5~15자 이내, 한국어)
//    - 프롬프트 예시:
//      """
//      다음 법령 조문과 사용자 질문에서 판례 검색에 사용할 핵심 키워드 1개를 추출하세요.
//      반드시 5~15자 이내의 한국어 명사구로만 답하세요. 다른 텍스트 없이.
//      
//      법령: {lawText}
//      사용자 질문: {userQuery || '없음'}
//      """
//    - 응답 파싱: trim, 첫 줄만 사용

// 3. 국가법령정보 OpenAPI 호출
const ocKey = LAW_API_KEY_SECRET.value();
const searchUrl = `https://www.law.go.kr/DRF/lawSearch.do?OC=${ocKey}&target=prec&type=JSON&query=${encodeURIComponent(추출된_키워드)}&display=10`;

const response = await axios.get(searchUrl, {
  timeout: 10000,
  headers: {
    'Referer': 'https://haru2026.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
});

// 4. 응답 파싱 (JSON)
const precSearch = response.data?.PrecSearch;
const totalCnt = parseInt(precSearch?.totalCnt || '0', 10);
const precList = precSearch?.prec || [];

// 5. 0건 처리
if (totalCnt === 0 || precList.length === 0) {
  return {
    success: true,
    precedents: [],
    message: '관련 판례를 찾을 수 없습니다',
    disclaimer: '이 검색은 국가법령정보센터의 실제 판례 데이터를 기반으로 합니다.'
  };
}

// 6. 상위 3건 선택 (배열이 객체일 수도 있으니 normalize 필요)
const top3 = Array.isArray(precList) ? precList.slice(0, 3) : [precList].slice(0, 3);

// 7. Gemini로 일괄 요약 (메타데이터 전달)
//    - 모델: gemini-2.5-flash (기존과 동일)
//    - 시스템 프롬프트 (환각 차단 강력 지침):
//      """
//      당신은 법률 판례 요약 전문가입니다.
//      아래에 제공된 판례들은 국가법령정보센터에서 가져온 실제 판례입니다.
//      
//      ⚠️ 중요한 규칙:
//      1. 제공된 사건명 외에 새로운 사건명을 만들지 마세요.
//      2. 제공된 사건번호 외에 새로운 사건번호를 만들지 마세요.
//      3. 사건의 구체적 내용·판결 결과를 추측하지 마세요. (본문이 제공되지 않았습니다)
//      4. 사용자가 검색한 맥락에서 "어떤 종류의 사건인지"만 60자 이내로 요약하세요.
//      5. 마크다운 기호 절대 금지, 줄바꿈 없이 한 문장으로.
//      
//      각 판례에 대한 60자 이내 요약을 JSON 배열로 출력하세요.
//      형식:
//      [
//        { "summary": "음주운전 누범 사유에 관한 형사 판례" },
//        { "summary": "..." },
//        { "summary": "..." }
//      ]
//      """
//    - 사용자 프롬프트:
//      """
//      검색 키워드: {추출된_키워드}
//      사용자 질문: {userQuery || '없음'}
//      
//      판례 목록:
//      1. 사건명: {top3[0].사건명} / 사건번호: {top3[0].사건번호} / 법원: {top3[0].법원명} / 선고일: {top3[0].선고일자}
//      2. ... (top3[1])
//      3. ... (top3[2])
//      """

// 8. Gemini 응답 파싱 (마크다운 펜스 제거 후 JSON.parse)

// 9. 반환 객체 조립 (기존 호환 + 신규 필드)
const precedents = top3.map((p, idx) => ({
  // 기존 3개 키 유지 (프론트 호환)
  caseName: p.사건명 || '',
  caseNum: `${p.법원명} ${p.선고일자} 선고 ${p.사건번호}`,
  summary: geminiSummaries[idx]?.summary || '판례 요약 생성 실패',
  
  // 신규 필드 (선택적 활용)
  courtName: p.법원명 || '',
  sentenceDate: p.선고일자 || '',
  caseId: p.판례일련번호 || '',
  detailLink: p.판례상세링크 
    ? `https://www.law.go.kr${p.판례상세링크}` 
    : ''
}));

return {
  success: true,
  precedents,
  totalCount: totalCnt,
  searchKeyword: 추출된_키워드,
  disclaimer: '이 정보는 국가법령정보센터에서 제공한 실제 판례입니다. AI 요약은 참고용이며, 정확한 내용은 법령정보센터에서 확인하세요.'
};
```

---

### Step 3: 에러 처리

다음 시나리오 모두 처리:

| 시나리오 | 처리 방식 |
|---|---|
| OpenAPI 호출 실패 (네트워크·타임아웃) | `try/catch`로 감싸서 `HttpsError('internal', '판례 검색 서버에 연결할 수 없습니다')` |
| OpenAPI 응답이 예상 구조와 다름 | 안전하게 빈 배열 처리 (`success: true, precedents: []`) |
| Gemini 키워드 추출 실패 | `userQuery`를 폴백 키워드로 사용 (없으면 `lawText` 첫 20자) |
| Gemini 일괄 요약 실패 | 판례는 반환하되 `summary` 필드는 "AI 요약 생성 실패" 같은 안전한 기본값 |

⚠️ **절대 금지:** OpenAPI 실패 시 기존 환각 로직으로 폴백. 환각으로 회귀하느니 에러를 보여주는 게 낫습니다.

---

## ⚙️ 작업 원칙 (절대 준수)

1. **요청된 부분만 수정. 기존 함수·import·다른 코드 절대 건드리지 말 것.**
2. lawSearch·lawEasyExplain·다른 함수 일체 손대지 말 것.
3. lawSearch의 dead code(line 1161-1171 외부 선언)도 이번 라운드에서 정리 금지.
4. 새 import 추가 금지 (axios·HttpsError·defineSecret 모두 이미 import됨).
5. OC 키 하드코딩 절대 금지. `LAW_API_KEY_SECRET.value()` 사용.
6. 콘솔 로그(`logger.info` 등) 추가는 디버깅용으로 OK. 단, OC 키 자체는 절대 로그에 찍지 말 것.

---

## 🚀 Phase 3: 빌드·배포

```bash
cd ~/HARU2026/functions && npm run build
```

빌드 성공 확인 후:

```bash
cd ~/HARU2026 && firebase deploy --only functions
```

배포 검증:
- `lawPrecedent` 함수가 update 목록에 있는지
- 다른 함수에 영향 없는지 (특히 `lawSearch`·`lawEasyExplain`)

Frontend 변경 없으니 hosting 배포 불필요.

---

## 🧪 Phase 4: 작동 검증

배포 완료 후, 영어성경 페이지 점검 때처럼 **콘솔 에러 0건 확인**이 핵심.

### 테스트 시나리오 3가지 (HARU2026 사이트에서 실제 클릭)

#### 테스트 1: 정상 검색 (231건 데이터 보장)
- 법령: 도로교통법 또는 음주운전 관련 조문
- 사용자 질문: 빈 값 또는 "회식 후 운전"
- ⚖️ 판례 버튼 클릭
- **기대 결과:**
  - 3건 판례 표시
  - 사건번호가 `2024도XXXX`, `2025도XXXX` 형식 (실제 판례 형식)
  - "선고일자: 2025.XX.XX" 같은 실제 날짜
  - 면책 문구 표시

#### 테스트 2: 일반 검색
- 법령: 민법 이혼 관련 조문
- 사용자 질문: "재산분할"
- ⚖️ 판례 버튼 클릭
- **기대 결과:** 이혼 관련 실제 판례 3건

#### 테스트 3: 0건 처리 검증
- 법령: 임의의 조문
- 사용자 질문: "xyz가나다라마바사뷁뷂뷃"
- ⚖️ 판례 버튼 클릭
- **기대 결과:** 빈 배열 반환, "관련 판례를 찾을 수 없습니다" 메시지

### 환각 차단 확인 (가장 중요)
테스트 1, 2 결과의 사건번호 1~2개를 `https://www.law.go.kr` 에서 직접 검색하여 **실제 존재하는지 확인**. 모두 실제 존재해야 정상.

---

## 🌳 Phase 5: 머지 (오늘 오전·오후 패턴 그대로)

```bash
git status  # working tree clean 확인
```

⚠️ 오전 작업 시 발견된 패턴: `functions/lib/index.js` 컴파일 결과도 함께 staged됨. `functions/src/index.ts` + `functions/lib/index.js` 두 파일 모두 커밋에 포함되도록 주의.

```bash
cd ~/HARU2026
git add functions/src/index.ts functions/lib/index.js
git commit -m "판례 환각 차단: lawPrecedent 국가법령정보 OpenAPI 연동

- Gemini 환각 구조 → 실제 판례 OpenAPI 검색 + Gemini 사실 요약
- LAW_API_KEY Secret 재사용 (harulaw2026)
- Gemini 키워드 추출 (lawSearch 0단계 패턴)
- 상위 3건, JSON 응답, 면책 문구 추가
- 기존 반환 키(caseName/caseNum/summary) 유지로 프론트 호환 보장"

git push origin feature/new-formats
git checkout main
git pull origin main
git merge feature/new-formats
git push origin main
git checkout feature/new-formats
git status
```

충돌 발생 시 즉시 중단·보고. 임의 해결 금지.

---

## 📋 보고 형식 (Phase 5 완료 후)

| 항목 | 내용 |
|---|---|
| 수정 파일 경로 | functions/src/index.ts |
| 변경 라인 수 | 추가 X / 삭제 Y / 순증가 Z |
| 새 Secret 등록 여부 | 없음 (LAW_API_KEY 재사용) |
| Functions 배포 결과 | 성공/실패 + lawPrecedent update 확인 |
| 검증 결과 | 테스트 1/2/3 각각의 결과 요약 |
| 환각 차단 확인 | 실제 사건번호 검증 결과 |
| 보안·코드 커밋 해시 | |
| main 머지 커밋 해시 | |
| 최종 브랜치 위치 | feature/new-formats 복귀 확인 |
| git status clean 여부 | |

---

## ⚠️ 멈춰서 시박사에게 보고해야 할 상황

다음 상황에서는 **임의 진행 금지, 즉시 중단·보고**:

1. Phase 1에서 보고한 내용과 실제 코드가 다른 경우
2. axios 호출 시 예상 못한 응답 구조 (PrecSearch 키 없음 등)
3. Gemini 키워드 추출 결과가 검색에 부적합한 경우 (한자·기호 등)
4. 머지 충돌
5. 빌드 에러
6. .gitignore 등 git 관련 예외 상황 (오늘 오전 패턴)

오늘 두 번 안전 정지(머지 전 미커밋·.gitignore)했던 것처럼, **모호하면 멈추고 물어보는 게 정답**입니다.

---

## 🎯 최종 목표

**환각 0%. 모든 판례는 실제 대법원·헌재 데이터베이스에서 옴.**

5대 독보적 서비스 중 하나인 하루LAW의 판례 기능이 — 오늘부터 진짜로 신뢰할 수 있는 도구가 됩니다.

---

**작성: 시박사 (CI) | 2026.05.05**
**Phase 1 보고 후 작성. CC의 분석 정확성에 기반함.**
