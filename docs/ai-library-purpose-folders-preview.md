# 학습함 목적 폴더 미리보기

2026-11-09 기준. 로컬 구현·합성 검증 단계이며 운영 적용 완료가 아니다.

## 범위

목적 폴더는 의료신기술(`medical-tech`), 건강상식(`health`), 생활정보(`life`), 투자정보(`investment`), AI신기술(`ai-tech`) 다섯 개다. 분류 필드가 없거나 이전 값인 자료는 화면에서 미분류로 읽는다. 미분류는 여섯 번째 주제가 아니다.

수집기 선택 → 임시 import payload → 웹 검증 → `saveAiLibraryImport`까지 선택한 분류를 전달한다. 폴더가 없던 이전 payload는 그대로 지원한다. 중복 import는 기존 원문과 분류를 덮어쓰지 않는다. 파일시스템 폴더 이동이나 기존 자료 일괄 마이그레이션은 없다.

HARU의 목적 폴더 조회는 서버 목록 전체를 대상으로 한다. 날짜 정렬은 폴더 안에서 유지한다. 기존 검색·AI 출처 필터는 불러온 기록에 적용된다는 표시를 유지한다. 펼치기·책 소재 변환·복사·삭제 기능도 유지한다.

## 저장 및 API 계약

- 기존 `users/{uid}/records/{id}`, `type: ai_log`, Functions 리전과 개발자 이메일·본인 인증 제한을 유지한다.
- 분류 필드는 `aiCategory`, 분류 경로는 `aiCategorySource`, 분류 시각은 `aiCategoryUpdatedAt`이다. 사용자 선택은 `manual`이다.
- `saveAiLibraryImport`의 선택적 `category`는 다섯 주제만 허용한다. 없으면 미분류로 남긴다.
- `listAiLibraryLogs`는 선택적 `category`를 받는다. 전체 목록의 기존 v1 커서는 유지하고 폴더 목록의 v2 커서는 해당 폴더에 묶는다.
- 폴더 목록은 기존 색인을 사용해 요청당 최대 100개를 읽고 최대 10개를 반환한다. 일치하는 기록이 없는 중간 페이지도 다음 커서가 있으면 계속 조회할 수 있다. 새 색인이나 Rules 변경은 없다. 전체 목록보다 읽기 비용이 늘 수 있다.
- `moveAiLibraryLog({id, category, expectedCategory})`는 인증된 본인 기록만 트랜잭션으로 수정한다. `unclassified`는 분류를 지우되 수동 결정 표시는 유지한다. 이전 분류가 달라졌으면 충돌로 거절한다.
- 수동 이동은 분류 필드만 바꾸며 본문·날짜·AI 출처·원문 URL·기존 책 소재를 보존한다. 별도 AI 보관함의 분류는 함께 변경하지 않는다.

## 보존 및 경계

확장 런타임은 실제 기존 v2.8의 개선을 검토 작업공간으로 가져온 것이다. 기존 설치 디렉터리는 수정하지 않았으며 다섯 파일의 원본 해시를 별도 보관했다. 권한·호스트·수신 범위를 확장하지 않았다.

Jev 1.14 Choice/Noul, HTTP transport, 서버 전용 저장·검토·승인·비용·중복 방지 callable 및 실행 화면의 코드를 연결했다. 실제 키 구성·운영 활성화·Functions 배포·자동 트리거는 하지 않았으며 기본 실행은 잠금 상태다. 미리보기에서도 실제 분류 호출은 차단한다. 실제 자료 분류나 과금 호출은 없다. 최신 트랜잭션 자료의 `aiCategorySource: manual`과 원문 해시를 확인해 사용자의 이동을 보호하도록 합성 시험했다. [자동 분류 설계와 활성화 조건](ai-library-jev-classification-design.md)을 참조한다.

## 검증

Node 22와 기존 의존성으로 다음 시험을 수행했다. 실자료·운영 Firebase·유료 AI는 호출하지 않았다.

```sh
cd extensions/ai-collector && node --test test/*.test.cjs
cd functions && node --test test/aiLibraryCategory.behavior.test.js
cd frontend && npm run test:ai-import
```

- 확장 13개, Functions 동작 9개, 프런트엔드 import/분류 22개 시험 통과.
- 기존 Functions 접근 정책 시험과 전체 TypeScript 검사 통과.
- Functions 전체 TypeScript 산출·폰트 복사 빌드는 임시 출력 경로에서 통과. 추적 중인 `functions/lib`는 수정하지 않았다.
- 프런트엔드 전체 빌드는 더미 Firebase 컴파일 설정으로 통과.
- 실제 React 페이지를 가짜 Firebase·합성 기록으로 올린 `frontend/test/ai-library-browser`에서 브라우저 상호작용 14개 통과. 이동 성공/실패, 늦게 온 이전 폴더 응답 배제, 빈 중간 페이지, 기존 버튼과 선택 초기화를 확인했다.
- 독립 코드 검토에서 조치할 제품 결함은 발견하지 않았다.

위 시험은 실제 Firestore 트랜잭션 재시도·색인·배포 환경·확장과 웹의 실제 연동 검증을 대신하지 않는다.

## 승인 후 적용 순서

1. 검토와 병합·배포 범위를 확정한다. 승인 없이 main 병합·운영 배포·설치본 교체를 하지 않는다.
2. 별도 승인된 배포에서 `saveAiLibraryImport`, `listAiLibraryLogs`, `moveAiLibraryLog` 세 Functions만 정확히 지정한다. Rules와 전체 Functions는 배포 대상이 아니다.
3. 웹을 배포하고 시험용 기록으로 저장→폴더 조회→이동→다시 읽기를 검증한다. 기록 원문·출처와 이전 기능을 비교한다.
4. 기존 설치본을 보존한 별도 디렉터리의 확장을 명시적 승인 후 설치하고 연결 진단·합성 자료 연동을 확인한다.
5. Jev 연동은 전송 자료·수신 업체·목적·민감정보 제외/처리·보존 조건·비용 한도·지속적 키 접근과 운영 배포에 대한 승인을 별도로 받은 뒤 활성화·검증한다.

실패 시 기존 코드와 설치본을 유지한다. 이미 저장된 분류 필드는 이전 코드에서 무시되므로 자동 삭제하지 않는다. 분류 정리·백필·대량 변경·롤백도 별도 범위와 복구 계획을 확인한 뒤 수행한다.
