# 가계부 중복 처리 격리 검증

운영 데이터와 연결하지 않는다. Java 에뮬레이터는 `-Duser.language=en -Duser.country=US`로 시작하고 저장소의 기존 `firestore.rules`를 로드한다. 프로젝트는 `demo-haru-household-dedup`, 호스트는 `127.0.0.1:18867`로 고정한다.

```sh
java -Duser.language=en -Duser.country=US -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-v1.21.0.jar --host 127.0.0.1 --port 18867 --project_id demo-haru-household-dedup --single_project_mode --single_project_mode_error --rules firestore.rules
```

frontend에서:

```sh
node --import tsx --test test/householdAmount.test.mjs test/householdSummary.test.mjs test/householdExport.test.mjs test/householdDuplicates.test.mjs test/householdPdf.test.mjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs
npm run dev -- --config test/household-browser/vite.config.mjs
```

`http://127.0.0.1:18767`에서 실제 FormatModal·중복 분석·Firestore 저장 코드를 사용한다. 가계부는 어느 화면에서 열더라도 FormatModal 공통 저장 분기에서 처리하며 일반 호출자 콜백은 실행하지 않는다. fixture의 일반 콜백은 호출되면 실패하도록 구성한다. 인증·AI·암호 해제만 모의 구현이다. 실제 Firestore SDK와 기존 Rules의 로컬 에뮬레이터를 사용한다. PDF와 암호 없는 XLSX는 실제 로컬 파서로 읽는다. 암호 있는 XLSX의 서버 해제는 모의 구현이므로 실제 암호 해제 성공을 증명하는 시험은 아니다.

1. 가계부 작성 → 날짜는 빈칸(기준일 2026-10-05) → 금액 4500, 사용처 시험 카페 → 저장. 1건·4500원 확인.
2. 같은 날·금액의 합성 은행 XLSX를 선택 → 암호 빈칸 → 파일 읽기. 겹침 비교 표시.
3. 선택 전 가계부에 저장 → 확인 요청, 미저장.
4. 기존 거래 사용 → 가계부에 저장 → 거래 1건·4500원 유지, 기존 거래 사용 1건.
5. 동일 파일 재가져오기 → 이미 저장 1건·선택 0건·선택 체크박스 비활성.

원본 식별 해시는 암호 해제 자료와 행 위치에 기반한다. 파일명 변경에도 같지만 다른 내용의 기간 중복 파일은 의심으로 비교한다. 같은 파일 안의 정상 반복 행은 보존한다.

카카오뱅크 텍스트 PDF(20MB·200쪽 이내)와 XLSX를 지원한다. 스캔 PDF와 다른 은행의 임의 양식은 지원하지 않는다. PDF worker는 번들 안에서 제공하며 원본·암호를 서버로 전송하지 않는다. 암호가 있는 XLSX만 기존 asia-northeast3의 decryptKakaoXlsx를 사용한다.

합성 PDF는 test/fixtures/household-synthetic.pdf이며 실제 계좌와 무관하다. PDF 선택 → 암호 빈칸 → 파일 읽기 → 2개월 2건 확인 → 저장 → 같은 PDF 재가져오기 시 이미 저장 2건·선택 0건을 확인한다. 은행명·필수 표·날짜·금액·행 수 검증 실패 시 부분 가져오지 않는다.

신규 입력은 기존 users/{uid}/records 컬렉션의 YYYY-MM-01_household 문서에 월별로 추가한다. 기존 문서는 이동하지 않는다. 명확한 출처 키는 재저장을 제외하고 같은 날짜·금액의 다른 출처는 사용자의 선택을 요구한다. 월별 대상 및 비교 문서를 한 트랜잭션에서 다시 확인하며 모든 선택 거래를 함께 저장한다. SAYU 원본 편집은 바꾼 필드만 저장하며 열어 둔 사이 거래가 변경되면 저장을 중단한다. 이전 버전 클라이언트·다른 일반 편집 전체를 전역 잠금하지는 않는다. 실제 자료를 이용한 로컬 검증의 원본·변환 파일·거래 정보는 저장소에 보관하지 않는다.
