# 다듬기 보조 출력 감사 재현

제품 구현·기존 시험 변경 없이 소스에서 함수를 추출해 합성 데이터로 진단한다. `audit.cjs`는 Node 표준 모듈과 기존 TypeScript 파서/변환기만 사용한다. 애플리케이션/Firebase/AI SDK를 import하지 않고 네트워크/운영 저장소를 호출하지 않는다.

운영 소스는 권한 있는 환경에서 메타데이터의 GCS generation을 고정해 내려받고 `src/index.ts`와 `lib/index.js`만 로컬 임시 폴더에 추출한다. 원본 ZIP·비밀값·자격증명·사용자 데이터는 저장소에 추가하지 않는다.

```sh
HARU_AUDIT_DEPS=/기존/functions/node_modules \
HARU_AUDIT_DEPLOYED_SOURCE=/운영소스/추출폴더 \
node docs/reviews/2026-10-21-polish-output-audit-evidence/audit.cjs
```

같은 package-lock을 쓰는 기존 Developer/functions/node_modules의 TypeScript를 재사용했다. 새 의존성 설치나 앱 빌드는 하지 않았다. [원본 결과](results.json), [실행 요약](run-output.json), [운영 메타데이터](deployment.json)를 보관한다.

서버 버전별 27개 시나리오, 총 81개:

- 통계 지원 10형식, BASIC 모드, reading/voiding/미등록/format 누락.
- 현재 구현되지 않은 includeStats/includeAiComment false 옵션이 호출을 생략하지 않음.
- 텍스트 누락/빈 값/비문자열/5,000자 초과/미인증.
- 통계 JSON 무효/통계 공급자 실패/한마디 실패/본문 실패, rate limit·월간 quota 거부.

실제 클라이언트 함수를 추출한 추가 진단:

- FormatModal 저장 payload에 객체 stats가 있지만 RecordPage의 실제 문자열 필터에서 빠짐. 본문·사용자 제목 보존 및 레거시 문자열 stats 통과.
- SayuModal 재다듬기는 본문·한마디만 저장하고 stats는 저장하지 않음. 빈 한마디일 때 과거 한마디 보존.
- FormatModal 세 소비처의 responseData 필드 참조.
- 일기 AI stats 지표 변경은 현재 계산 결과에 영향을 주지 않음. 메모 기본 통계는 메타데이터만으로 필드 존재 수가 바뀔 수 있음.

한계: 모의 SDK는 합성 응답을 돌려준다. 실제 모델 품질·토큰/청구량·시간·네트워크/Firestore 권한·사용자 기록 저장 E2E를 검증하지 않는다. 서버 세 버전의 결과 일치는 위 시나리오의 분기·응답 계약 범위이며 코드 전체 동일성을 뜻하지 않는다. 성능·절감액 수치는 산정하지 않았다.
