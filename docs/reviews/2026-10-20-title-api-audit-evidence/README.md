# 제목 일괄 생성 무과금 모의 진단 근거

`audit.cjs`는 애플리케이션이나 Firebase/provider SDK를 import하지 않는다. Babel AST로 실제 핸들러·검증 함수를 추출하고 esbuild로 TypeScript를 지운 뒤 격리된 vm에서 실행한다. 기록은 합성 메모리 객체, AI는 합성 제목을 반환하는 대역이다. 실제 네트워크·AI·Firestore 요청은 없다.

실행 예(기존 의존성 재사용):

```sh
HARU_AUDIT_DEPS=/private/tmp/haru-issue281-test-fix-20261019/frontend/node_modules \
HARU_DEPLOYED_TS=/private/tmp/haru-titles-deployed-index.ts \
HARU_DEPLOYED_JS=/private/tmp/haru-titles-deployed-index.js \
node docs/reviews/2026-10-20-title-api-audit-evidence/audit.cjs \
  docs/reviews/2026-10-20-title-api-audit-evidence/results.json
```

main만 재현할 때는 두 HARU_DEPLOYED_* 변수를 생략한다. 운영 소스 전체·ZIP·비밀값·계정 식별자는 저장소에 넣지 않았다. `results.json`의 main/deployedTypeScript/deployedJavaScript SHA-256과 본 보고서의 배포 generation/ZIP SHA가 출처를 식별한다. main 기준은 be7f9afe이다.

13개 시나리오: 제목 없음, 사용자 제목, AI 제목, 무효 사용자 제목, 무효 사용자+유효 AI 제목, 무효 AI 제목, 본문 없음, 비문자열 사용자 제목, 중복 형식, 동시 요청, 저장 실패 후 재시작, 인증 없음, 개발자 권한 없음. 세 버전의 결과가 동일함을 단언한다.

모의 호출 수는 코드의 논리 모델 진입 수다. SDK 내부 재시도·실청구·운영 빈도·사용자 피해·AI 제목 품질·운영 E2E는 검증하지 않는다. 중복 형식·비문자열 제목이 실제 운영 기록에 존재하는지도 확인하지 않았다. 임시 잠금이나 개선 코드를 끼워 넣지 않아 결과는 현행 동작을 보여준다.
