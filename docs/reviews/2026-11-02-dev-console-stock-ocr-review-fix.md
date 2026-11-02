# 자동 리뷰 P2 반영 — 초안 사진 저장 보존

- 검토 대상: `923c119397e408a00dea5cd2794e41bf22fa0c1b`
- 자동 리뷰 원문: https://github.com/hkd620-lab/haru2026/pull/323#discussion_r4443233074
- 제목: 월한도 도달 시 OCR만 중단하고 초안 사진 업로드는 계속하세요
- 결과 Review ID: `5737635467`

지적을 수용했다. 공통 초안에 사진 여러 장을 첨부하고 주식 형식을 고르면 `requireAll=true` 사진 처리에서 월한도 오류의 break가 업로드 전체를 중단해 저장 차단 플래그를 켤 수 있었다.

보완:
- 선택한 OCR 전용 사진 배치는 기존대로 월한도에서 중단한다.
- 공통 초안의 업로드 경로는 월한도에 도달하면 이후 OCR만 건너뛰고, 남은 사진 업로드·메타데이터 처리를 모두 끝낸다.
- 전체 `uploadSelectedImages` 실제 handler를 실행하는 회귀 테스트로 사진3장/월한도 초과 시 업로드3장·OCR1회·저장 차단 플래그 false를 확인한다. 단순 부분 코드 테스트를 대체했다.

검증: stockOcrQuota + writingDraftLifecycle + formatPhotoUploadResult 28/28 통과. 변경 영역은 프론트 handler와 해당 테스트뿐이며 Functions는 변경하지 않았다. 프론트 최종 빌드 결과는 상위 실행 기록 및 PR CI로 확인한다.

이 반영 뒤 최신 HEAD에 Codex 재검토를 요청한다. 스레드 resolve만으로 해결 판정하지 않는다. 독립 Claude 검토는 OAuth 인증 실패 원문을 보존하며 승인으로 간주하지 않는다.
