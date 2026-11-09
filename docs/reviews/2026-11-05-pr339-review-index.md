# PR339 검토 색인과 배포 전 판정 근거

- PR: https://github.com/hkd620-lab/haru2026/pull/339
- 최신 기능 검토 HEAD: `5794d24b300d9aafe741ff048eb49e168cbb65ce`.
- 이전 독립 실행 실패 원문은 `2026-11-05-haru-law-dedicated-local-validation.md`에 그대로 보존했다. 당시 샌드박스의 인증 조회/갱신 실패 후, 실제 CLI 환경에서는 기존 로그인이 정상임을 확인했다. 사용자에게 다시 로그인하도록 요구한 뒤 재확인으로 원인을 바로잡았으며 인증 설정은 바꾸지 않았다.
- 독립 Claude 첫 승인 및 최신 재검토 승인 원문: [f05b](2026-11-05-pr339-claude-f05b-raw.md), [5794](2026-11-05-pr339-claude-5794-raw.md). 최신 판정 원문: **"판정: 승인"**. 수정 후 승인 누적0. 모델 검토자는 파일을 수정하거나 시험을 실행하지 않았으며 실행자의 시험 결과와 변경 범위를 근거로 읽기 검토했다.
- Codex 요청·리뷰·인라인 댓글·최신 요약 원문 스냅샷: [JSON](2026-11-05-pr339-codex-raw.json). 원본은 GitHub에 있다.

| 실행 | 요청 원문·시각 UTC | 대상 HEAD | 시작 UTC | 완료 UTC | 결과 리뷰 ID·원문 | 지적 및 반영 |
|---|---|---|---|---|---|---|
| 1 | 없음(초안→ready 자동 실행, ready 03:08:45) | e4ca01c47ec1db0bc38c65a40c9b73a0d56f6586 | 03:08:53Z | 03:11:13Z(리뷰 제출), 요약03:11:15.731731Z | 5779377303, https://github.com/hkd620-lab/haru2026/pull/339#pullrequestreview-5779377303 | P1 header spine 거부, https://github.com/hkd620-lab/haru2026/pull/339#discussion_r4476193166 → f05b5b4619f91e98e5160a4beba919495800f0df |
| 2 | https://github.com/hkd620-lab/haru2026/pull/339#issuecomment-6648771889 ,03:20:49Z | f05b5b4619f91e98e5160a4beba919495800f0df | 03:21:09.526807Z | 03:23:15Z(리뷰 제출), 요약03:23:18.303288Z | 5779454417, https://github.com/hkd620-lab/haru2026/pull/339#pullrequestreview-5779454417 | P2 상대 경로가 루트 동명 파일 선택, https://github.com/hkd620-lab/haru2026/pull/339#discussion_r4476257338 → 5794d24b300d9aafe741ff048eb49e168cbb65ce |
| 3 | https://github.com/hkd620-lab/haru2026/pull/339#issuecomment-6648914507 ,03:31:02Z | 5794d24b300d9aafe741ff048eb49e168cbb65ce | 별도 시작시각 확인 불가 | 요약03:33:10.025621Z | 별도 리뷰 객체 없음(무지적), 결과 요약 댓글 ID6648604002, https://github.com/hkd620-lab/haru2026/pull/339#issuecomment-6648604002 | status completed / has_any_findings false / has_unresolved_findings false, 최신 독립 Claude가 P1/P2 해결 수용 |

- 완료된 세 실행이며 결과 없이 중단·대체된 실행 없음. 별도 최신 리뷰 객체 ID가 없는 사실을 요약 댓글 ID와 구분해 기록한다.
- f05b→5794 변경은 parser와 해당 회귀시험 두 파일뿐임을 `git diff --name-status f05b5b46..5794d24b`로 확인했다.
- 5794 Functions 빌드 통과, Node22 문서/worker/첨부 전달 13/13. 기존 웹/Storage/저장시험 근거는 보존한다. Functions public export 및 리전·Firestore Rules 변경 없음.
- 실제 공개 샘플 https://github.com/ohah/hwpjs/tree/main/apps/docs/docs/public/editor/fixtures 의 example.hwp(26624B)와 example.hwpx(25748B)를 worker로 읽었다. 공백 제외 본문 SHA256 둘 다 `c85d240d16d9e7cb16956264325495b4eb183758944660405f35c5ad6103b9b7`로 일치했다. 바이너리 원문은 저장소에 재배포하지 않는다.
- 두 파일 SHA256: HWP `4760a48d2f4fccdcaed32c88a5c5fae99b5ab9f62da143994c4218ec0c6725c1`, HWPX `4bc0e084ef9c4701103ef17dd0621fd9897924e357d3cb21a5fa2b62ef03318d`.
- latest code CI: https://github.com/hkd620-lab/haru2026/actions/runs/41961672928 (웹), https://github.com/hkd620-lab/haru2026/actions/runs/41961672927 (Linux Node22) 성공. 뒤에 추가되는 검토 기록은 docs/reviews 신규 A 파일만인지 다시 대조하고 최종 HEAD CI를 확인한다.
- 사용자 최신 지시가 PR339 병합 및 웹/lawSearch/chatWithResult/Storage 규칙 배포를 명시적으로 승인했다. 독립 검토자가 PR 전체를 대규모·멈춤조건 해당으로 분류하고 현재 지시로 범위 충족을 확인했다. 코드 승인과 운영 완료는 구분한다.
- 배포 순서: Storage Rules → Functions lawSearch/chatWithResult → main 병합과 Hosting 자동 배포. 전체 Functions/Firestore Rules 배포 없음.
- 기존 운영 Rules는 main과 바이트 동일, SHA256 `c13a69beeca23871eff46d87902c4a120fd312e321c00f05eb3fd80dcb7ac49d`; 이전 ruleset `projects/haru2026-8abb8/rulesets/3e9ae9db-d48b-4016-be53-55b61cdb8b2f`(2026-09-15T21:15:17.546976Z). 후보 Rules SHA256 `0647d1dca7491179f2b994368004a2a99b06d18d612af6f971e1e5a692d399a0`.
- 이전 Functions: lawSearch `lawsearch-00140-maw`, chatWithResult `chatwithresult-00038-dey`, nodejs22, asia-northeast3, allTrafficOnLatestRevision true. 실패 시 이전 release/revision 및 제품 되돌리기 PR로 복구하며 기존 기록/첨부는 삭제하지 않는다.
- 현재 운영 검색·첨부·저장 E2E는 아직 수행하지 않았고 승인으로 대신하지 않는다. 배포 후 별도 근거를 추가한다.
- Slack 직접 게시 승인은 없어 미게시하며, 최종 대화에 확정 요약을 제공한다.
