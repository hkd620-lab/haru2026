# 검증 근거 보완

- 코드 HEAD: 90ca414ed40b3593422b204fb876c74f28982442. 독립 검토1의 첫 지적에 따라 원문 출력을 보완했다. 코드 수정 없음.
- functions build exit 0, EPUB tests 18/18, frontend EPUB tests 11/11, frontend build 시험 env로 exit 0. 원문 validation/01~04 로그.
- index.ts diff0, Functions export 목록 base77=HEAD77, exportEpub 동일. 07은 zsh 변수해석 실패 기록이며 삭제하지 않았고 08에서 올바르게 비교했다.
- PR CI와 프리뷰 성공: https://github.com/hkd620-lab/haru2026/actions/runs/41971529095 . Codex 자동리뷰 완료·지적없음은 codex-review-1.md 색인.
- 출력물 보관은 검증 완료 후 LaCie에 별도로 전체 SHA-256 검증한다. 개인 기록 본문·사진은 저장소에 추가하지 않는다.
- 최종 코드 갤럭시 검증은 별도 device-validation.md에 기록. 운영 배포는 아직 미실행.
