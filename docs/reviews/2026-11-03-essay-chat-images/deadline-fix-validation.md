# 독립 검토 P2 반영과 검증

독립 검토 1차 판정 `수정 후 승인`을 수용했다. 원문은 independent-codex-result-01.md이며 누적 수정 후 승인 횟수는 1회다. 기존 무지적 자동 리뷰와 별도로 발견된 제한 공백을 수정했다.

## 변경

- 에세이 이미지가 있는 요청에도 시작 시점 기준의 기존 절대 work deadline(60초)을 적용한다. 90초 callable 내에서 후처리 15초와 최종 복구 15초를 남기는 기존 첨부 처리 구조를 재사용한다.
- 이미지 읽기는 `min(5초, 공통 마감까지 남은 시간)`으로 제한한다. 각 읽기·변환 뒤 마감을 확인하며 이미지 준비 전체에도 deadline race를 적용한다. 초과 후 다음 이미지를 읽거나 모델을 시작하지 않는다.
- 첫 모델 호출과 검색 재시도는 동일한 work deadline 및 AbortSignal을 공유한다. 응답이 돌아온 뒤에도 마감을 확인한다.
- 성공 시에는 기존 deadline 제한 transaction을 재사용하여 대화·로그·검색 사용량을 함께 저장한다. 실패 시 월간·검색 예약 복구에도 기존 복구 deadline을 적용하고 잠금을 해제한다.
- 에세이 시간 초과는 일반 기록용 `deadline-exceeded` 안내로 반환하며 하루LAW 전용 오류 사유를 사용자에게 노출하지 않는다.
- 이미지가 없는 에세이와 다른 기록의 경로, 모델·AI 호출 단계·리전·Firestore 경로·Rules·환경변수·결제·인증 정책은 유지한다. 이미지 처리 함수의 내부 인자는 추가됐지만 외부 callable 요청 계약은 변경하지 않았다.

## 검증 명령과 결과

- `cd functions && npm run build`: exit 0.
- `node --test test/resultChatImages.test.js`: 9/9 통과. 기존 7건과 공통 마감의 읽기 예산 감소·마감 후 미호출 2건.
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 GCLOUD_PROJECT=demo-haru-essay-images GOOGLE_CLOUD_PROJECT=demo-haru-essay-images node test/resultChat.integration.js`: exit 0. 실제 Firestore emulator + 모의 Gemini. 기존 시나리오와 아래 4개 마감 시나리오를 모두 통과.
  - 이미지 준비 자체가 work deadline 초과: 모델 미호출, 사용량 미차감, 잠금 해제.
  - 5장 읽기 총 20초 + 첫 모델 40,001ms: 초과 답변 미저장, 월간/검색 예약 복구, 잠금 해제.
  - 5장 읽기 총 20초 + 첫 모델 20초 + 검색 재시도 20,001ms: 두 호출에 abort signal 전달, 초과 답변 미저장, 월간/검색 예약 복구, 잠금 해제.
  - 5장 읽기 총 20초 + 네이티브 모델 AbortError: 일반 기록 시간 초과 안내, 월간/검색 예약 복구, 잠금 해제.
- 위 지연은 통제된 Date.now와 모의 공급자 응답으로 주입했다. 실제 60초씩 기다리거나 운영 장애를 재현한 시험이 아니다.
- 통합시험 출력: 모의 Gemini 39회, legacy 11회, Gemini Files upload 25회/delete 30회, 검색 도구 요청 26회, result_chat 로그 33개. 모의 SDK 및 합성 파일만 사용한다.
- `node test/monthlyAiQuota.policy.test.js`: 통과.
- `node --experimental-strip-types test/haruLawErrorCore.test.js`: 통과. 손상 PDF fixture 파싱 경고는 예상된 기존 출력.
- `git diff --check`: 통과. 생성 lib의 누적 stale 차이는 커밋하지 않는다.

실제 Gemini 합성 그림 시험의 기존 성공 근거는 유지하지만 이번 시간 제한 수정 이후 새 실제 모델 호출이나 운영 데이터 사용은 하지 않았다. 최신 수정 코드에 대한 자동 Codex 재검토·동일 독립 검토자의 재검토·최종 CI 확인이 남는다. 독립 검토 대체는 병합·배포의 새 승인이 아니다.
