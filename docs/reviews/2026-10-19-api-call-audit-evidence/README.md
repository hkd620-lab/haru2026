# 무과금 API 호출 경로 진단

기준 main: `9141f7f37fa9ff7e41baae977f9a594de649d603`. Node v26.8.2에서 실행했다.

```sh
HARU_AUDIT_DEPS=/path/to/existing/node_modules node docs/reviews/2026-10-19-api-call-audit-evidence/audit.cjs /private/tmp/api-audit-results.json
```

필요한 기존 개발 의존성은 `@babel/parser`, `esbuild`다. 앱을 import하거나 서버를 기동하지 않는다. 소스 AST에서 실제 핸들러/표현식/필터를 추출해 TypeScript를 변환하고 vm 안에서 실행한다. 실제 AI·Firebase·권한·quota·로그 SDK 대신 모의 함수, 고정 합성 응답, 메모리 문서만 쓴다. 운영 데이터·계정·토큰·유료 API는 쓰지 않는다.

`results.json`에 기준 소스 해시와 모든 관찰값을 보존했다. 정상 처리 시 마지막 status는 `all assertions passed`다. 실제 코드·스키마·식별자가 바뀌면 기존 기대 단언이 실패할 수 있으므로 기준 SHA를 함께 확인한다.

- 식별자 선언 수는 AST 기반 참조 점검이다. 동적 외부 호출 또는 운영 호출량을 측정한 것이 아니다.
- 모델 호출 수는 `callAi` 진입 수다. SDK 내부 네트워크 재시도·과금 토큰·청구액·월간 사용자 quota를 의미하지 않는다.
- `polishContent`의 실제 분기와 `analyzeStats`를 실행하지만 comment 프롬프트 생성·로그·quota·권한 함수는 모의다. 실제 권한/과금/AI 품질 검증으로 확대하지 않는다.
- 메모 객체 stats는 실제 RecordPage 필터를 통과시키고, voiding 소비값은 실제 `res.data.result ?? ''` 표현식을 실행한다. 실제 화면 클릭·Firestore 저장·의료 안전성 E2E가 아니다.
- 백필은 합성 메모1건에 같은 핸들러를 두 번 적용한다. 실제 기록이나 기존 AI 제목을 변경하지 않는다.

이 파일들은 문서용 진단이며 앱 경로에 연결하지 않는다. 모델·호출 정책·코드를 수정하지 않았다.
