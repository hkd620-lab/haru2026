# PR #288 최소 권한 조치 독립 검토 요청 3

- 저장소: https://github.com/hkd620-lab/haru2026
- PR: https://github.com/hkd620-lab/haru2026/pull/288
- 검토 HEAD: `99377e982502d5feb0445a02350c921c6bab307b`
- 이전 구현/코드 검토: https://github.com/hkd620-lab/haru2026/blob/754d4d25/docs/reviews/2026-10-22-pr288-independent-review-2/reviewer-result.md
- 이전 인증 실패: https://github.com/hkd620-lab/haru2026/blob/754d4d25/docs/reviews/2026-10-22-pr288-independent-review-1/result.json
- 진단 CI: https://github.com/hkd620-lab/haru2026/actions/runs/39712130045
- 수정 후 CI: https://github.com/hkd620-lab/haru2026/actions/runs/39712816798
- 새 조치/검증 근거(현재 별도 작업본에 보존한 신규 기록): `docs/reviews/2026-10-22-pr288-preview-permission-fix/README.md`, `evidence.json`, `role.yaml`
- 공식 GetService 권한 명세: https://docs.cloud.google.com/service-usage/docs/reference/rest/v1/services/get

직전 독립 검토의 원문 판정은 **“판정: 승인 — 설계·구현 기준이며, 공식 판정①은 아직 조건이 안 됩니다.”** 이며 CI의 403 때문에 조건 미충족이었다. 인증 실패 실행 1·승인 실행 2 기록을 숨기거나 수정하지 않았다.

이후 허대표님이 “PR #288 미리보기 배포의 403 권한 오류만 원인을 확인하고 최소 범위로 해결해줘. CI 재확인까지 진행하고, 기존 CC와 다른 항목은 건드리지 말고 병합·운영 Hosting·Functions 배포는 아직 하지 마.”라고 추가 승인했다.

이번 추가 범위에 대해 독립 검토해 주세요. 이전 판정과 원문 링크를 확인한 뒤, 확인된 계정에 부여한 `serviceusage.services.get` 한 개가 최소 범위인지, 다른 IAM 바인딩/제품/기존 CC 보존·진단의 비밀값 비노출·workflow 복원·복구 방법/검증 근거가 적절한지 판단해 주세요. 현재 CI는 의존성/웹 빌드 단계에서 진행 중이므로 성공을 전제하지 마세요. 새 기록은 커밋 전 초안이며 CI 결과 필드만 검증 후 보완할 수 있습니다.

판정은 `승인 / 수정 후 승인 / 재설계` 중 하나, 규모는 소/중/대, 정책 8.1 멈춤 조건 해당 여부와 대표 승인 범위 충족을 명시해 주세요. 차단 문제는 파일/행·발생 조건·영향을 적고, 조치 설계 승인과 최신 CI/운영 완료의 충족 여부를 구분해 주세요.

읽기 전용 새 검토입니다. 기존 CC 세션을 사용·재개·중단하지 마세요. 파일 수정·PR 댓글·외부 메시지·빌드/재시험·배포·IAM 변경은 하지 마세요. 운영 사용자 데이터·비밀값·비공개 전체 IAM 스냅샷·인증 파일은 읽지 말고, 공개 가능한 근거 파일만 확인해 주세요. 숨김 LibraryPage·보존 파일·다른 기능은 대상에서 제외합니다. 결과는 한국어로 작성해 주세요.
