# 하루LAW 판례 환각 차단 — OpenAPI 연동 작업 지시서

**작성일:** 2026.05.05
**작성:** 시박사 (CI)
**실행:** CC
**작업 브랜치:** feature/new-formats

---

## 📌 한 줄 요약

`lawPrecedent` 함수가 Gemini에게 직접 판례를 만들게 하는 환각 구조 → 국가법령정보 OpenAPI(이미 승인 완료)로 실제 판례를 가져와 Gemini는 요약·해설만 담당하는 구조로 전환.

---

## 🚨 작업 배경

### 현재 문제 (CC 분석 보고 기준)

`lawPrecedent` 함수([functions/src/index.ts:1384~](functions/src/index.ts:1384))는 실제 대법원 DB 조회 없이 Gemini가 직접 사건명·사건번호·요지를 생성. 가짜 판례를 사용자가 진짜로 받아들일 위험. 5대 독보적 서비스(하루LAW)의 핵심 신뢰도 훼손 가능성.

### 활용 가능한 자원 (이미 확보됨)

- **국가법령정보 공동활용 OPEN API** 활용 신청 승인 완료 (2026.04.11 신청)
- **OC 인증키:** `harulaw2026`
- **승인 데이터:** 판례·헌재결정례·법령해석례·행정심판례 모두 승인
- **승인 도메인:** haru2026.com
- **승인 서버 IP:** 193.186.4.174 / 220.76.245.100
- **검증 완료:** "음주운전" 검색 시 231건 실제 판례 정상 응답 확인

### API 사용법 검증됨

```
판례 목록 검색:
http://www.law.go.kr/DRF/lawSearch.do?OC=harulaw2026&target=prec&type=JSON&query=검색어

응답 구조:
{
  "PrecSearch": {
    "totalCnt": "231",
    "prec": [
      {
        "사건번호": "2025도15970",
        "사건명": "사기·도로교통법위반(음주운전)...",
        "선고일자": "2026.01.29",
        "법원명": "대법원",
        "판례일련번호": "616247",
        "판례상세링크": "/DRF/lawService.do?OC=harulaw2026&target=prec&ID=616247&type=HTML&mobileYn="
      },
      ...
    ]
  }
}

판례 본문 조회:
http://www.law.go.kr/DRF/lawService.do?OC=harulaw2026&target=prec&ID=판례일련번호&type=JSON
```

---

## ⚙️ 작업 원칙 (절대 준수)

1. **요청된 부분만 수정. 기존 함수·import·다른 코드 절대 건드리지 말 것.**
2. OC 키는 절대 코드에 하드코딩 금지. **Firebase Secret Manager + defineSecret() 패턴** 사용 (기존 보안 원칙).
3. 폴백 로직: OpenAPI 호출 실패 시 환각으로 회귀하지 말 것. **에러 메시지 반환**.
4. Gemini 프롬프트는 "**이 판례는 실제 존재하므로 사실만 요약하라**" 강력 지침 포함.
5. 사용자에게 "AI 해설은 참고용" 면책 문구 결과에 포함.
6. lawSearch·lawEasyExplain은 절대 건드리지 말 것 (이번 라운드 범위 외).

---

## 🔧 작업 단계

### Phase 1: 사전 분석 (수정 없음)

다음을 확인해서 보고만 해주세요:

1. **현재 lawSearch 함수가 외부 API를 어떻게 호출하는지 패턴 확인**
   - axios 사용? fetch? 내장 라이브러리?
   - OC 키를 어디서 가져오는지 (Secret Manager? 환경변수? 하드코딩?)
   - 응답 파서 (xml2js 등)
   - 에러 처리 방식

2. **현재 lawPrecedent 함수의 정확한 구조**
   - 입력 파라미터 (request.data에서 무엇을 받는지)
   - Gemini 프롬프트 전문
   - 출력 형식 (return 객체 구조)
   - 인증 가드 (오늘 오전에 추가한 것 확인)

3. **Firebase Secrets 확인**
   - 현재 어떤 Secret들이 등록되어 있는지
   - lawSearch가 OC 키를 Secret으로 쓰고 있는지 (있으면 그 Secret 재사용 가능)

**Phase 1 결과를 보고하고, 시박사의 다음 지시를 기다려 주세요. 코드 수정 시작 금지.**

---

### Phase 2: 코드 수정 (Phase 1 결과 받고 시박사가 추가 지시)

⚠️ Phase 2 세부 지시는 Phase 1 보고 후 시박사가 추가로 작성합니다. Phase 1 결과에 따라 구현 패턴이 달라지기 때문.

대략의 방향만 미리 안내:

```
[lawPrecedent 새 구조]

1. 인증 가드 (이미 있음, 유지)
   ↓
2. request.data에서 검색어 추출
   ↓
3. 국가법령정보 OpenAPI 호출 (lawSearch.do?target=prec)
   - OC 키: Secret Manager에서 가져오기
   - 검색 파라미터: query=검색어, type=JSON
   ↓
4. 응답 받기
   - 0건: "관련 판례를 찾을 수 없습니다" 반환
   - 1건 이상: 상위 3~5건의 사건번호·사건명·선고일자·법원명 추출
   ↓
5. Gemini에게 전달
   - 시스템 프롬프트: "이 판례는 실제 대법원 데이터입니다. 사실만 요약하고 새로운 정보를 만들어내지 마세요"
   - 입력: 실제 판례 메타데이터
   - 작업: 사용자 친화적 요약·해설 (사용자가 검색한 맥락에서)
   ↓
6. 결과 반환
   - 실제 판례 목록 (사건번호·사건명·선고일자·법원명·법령정보센터 링크)
   - Gemini의 요약·해설 (주의: 사실 추가 금지)
   - 면책 문구: "AI 해설은 참고용입니다. 정확한 내용은 국가법령정보센터에서 확인하세요."
```

---

### Phase 3: 빌드·배포 (Phase 2 완료 후)

```bash
cd ~/HARU2026/functions && npm run build
cd ~/HARU2026 && firebase deploy --only functions
```

Functions 수정만이라 hosting 배포 불필요.

배포 검증:
- lawPrecedent 함수가 update 목록에 있는지
- 다른 함수에 영향 없는지

---

### Phase 4: 작동 검증

배포 후 다음 검색어로 테스트:

1. **음주운전** — 231건이라 응답 빠름, 검증 쉬움
2. **이혼** — 일반적 검색
3. **xyz가나다라마바사** — 0건 응답 처리 검증

각 결과에서 확인할 점:
- 사건번호가 실제 존재하는 형식인지 (2024도XXXX 등)
- Gemini가 새 정보를 만들어내지 않는지
- 면책 문구가 표시되는지

---

### Phase 5: 머지 (오늘 오전·오후 패턴 그대로)

```bash
git status  # working tree clean 확인
git push origin feature/new-formats
git checkout main
git pull origin main
git merge feature/new-formats
git push origin main
git checkout feature/new-formats
git status
```

충돌 시 즉시 중단·보고. 임의 해결 금지.

---

## 📋 보고 형식 (Phase 5 완료 후)

| 항목 | 내용 |
|---|---|
| 수정 파일 | (예: functions/src/index.ts) |
| 변경 라인 수 | (대략) |
| 새 Secret 등록 여부 | (LAW_OPEN_API_OC 등) |
| Functions 배포 결과 | 성공/실패 + lawPrecedent update 확인 |
| 검증 결과 | 음주운전·이혼·xyz 테스트 각각의 결과 요약 |
| 보안 커밋 해시 | |
| main 머지 커밋 해시 | |
| 최종 브랜치 위치 | feature/new-formats 복귀 확인 |
| git status clean 여부 | |

---

## ⚠️ 주의사항

1. **lawSearch·lawEasyExplain·다른 함수 절대 건드리지 말 것** (이번 라운드 범위 외)
2. **충돌·문제 발생 시 즉시 중단·보고** (임의 해결 금지)
3. `--force` 푸시 금지, rebase 금지, main 작업 금지
4. **Phase 1 보고 후 Phase 2 진행 시 시박사 추가 지시 대기 필수**
5. OC 키 `harulaw2026`은 **절대 코드에 하드코딩 금지**

---

## 📞 작업 중 의문점 발생 시

작업을 멈추고 시박사에게 상황 보고. 추측으로 진행 금지.
오늘 오전 머지 작업 중 .gitignore 이슈에서 멈춰서 확인받았던 것처럼, 모호한 상황은 즉시 보고.

---

**작성: 시박사 (CI) | 2026.05.05**
