# API 호출 계측 감사 재현

기준 main: `8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9`.

```sh
HARU_AUDIT_DEPS=/Users/heogyeongdae/Developer/HARU2026/functions/node_modules node docs/reviews/2026-10-22-api-metering-audit-evidence/audit.cjs
```

Node.js와 설치된 TypeScript만 필요하다. HARU_AUDIT_DEPS는 TypeScript를 포함하는 node_modules의 절대 경로로 바꿀 수 있다. 앱 SDK·환경변수 파일·키·운영 데이터는 로드하지 않으며 네트워크에 접속하지 않는다. source hash는 results.json에 기록한다.

진단은 TS AST에서 polishContent, analyzeStats, 제목 함수, 사용량 로거, rate limit, 토큰/요금제 변환을 추출해 vm에서 실행한다. AI 응답과 Firestore는 합성 대역, monthly quota 예약은 대역이다. 서버 20시나리오, 토큰 변환 5개, 요금제 의미 차이 1개, 대상 callAi 설정 5개, 클라이언트 가드 3개의 단언이 있다. logOnlySubscriptionReads는 로그용 구독 get만 세며 quota·기타 Firestore 호출은 제외한다.

병렬 요청은 실제 UI 더블클릭/네트워크 재전송을 재현하지 않는다. rate-limit 메모리 트랜잭션은 Firestore의 서버 동시성·재시도를 구현하지 않는다. 모델 진입 횟수는 과금 확정이 아니다. 본문 품질·출력 상한값의 적절성·운영 중복률·실제 요금제·청구액은 확인하지 않았다.

results.json은 재실행 시 덮어쓴다. run-output.json은 마지막 검증 실행 stdout이다. deployment.json은 읽기 전용 gcloud functions describe 결과의 비밀값 없는 선택 필드이며, main과 운영 소스 전체가 동일하다는 증거가 아니다.
