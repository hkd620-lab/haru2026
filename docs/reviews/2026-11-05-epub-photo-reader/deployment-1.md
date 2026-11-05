# PR340 배포 결과

허대표님이 현재 대화에서 PR340 병합·웹·exportEpub 배포를 명시 승인했다.

- 코드90ca414e, 배포전최종60fdb2a3(27 docs추가만), main squash14429e31f13f38e134a4626ec1bdfbf838011aad, PR340 MERGED.
- exportEpub 단독 선배포 성공: asia-northeast3 / GEN_2 / nodejs22 / exportepub-00034-zem→exportepub-00035-san / ReadyTrue / traffic100% / updateTime2026-11-05T06:22:18.619197016Z.
- gcloud functions list 실측 완료. env8개 값 동일(값을 로그에 출력하지 않고 같음 여부만 비교), secretenv0 유지. 메모리1024Mi·timeout300·concurrency1 유지.
- main Hosting CI 성공: https://github.com/hkd620-lab/haru2026/actions/runs/41980076756 . Hosting live version5ee12bf65c866059 / releaseTime2026-11-05T06:24:43.102Z / FINALIZED. 수동시험dist 배포없음.
- Rules/Firestore·Storage경로/환경변수값/결제·인증정책/AI호출·비용 변경없음. 다른함수배포없음. 원본worktree변경없음.
- 배포 원문은 LaCie 내보내기/2026-11-05_EPUB_사진수정_검증_1220/deployment/ 에 명령별 보존. CC 검증에서 기존13파일 SHA256검사성공, 추가 결과원문도 별도보관. 08의무효개수검사로그를삭제하지않고08b정정근거를추가했다.
- 운영 새 EPUB의 한글 본문·실제사진2장·앞뒤페이지는 갤럭시S21 Play북에서 확인. production-device-1.md 참고. 개인사진/본문은 GitHub/Slack미게시.
- 이전파일은자동변경안됨. 새 EPUB을 다시 내려받아야 수정스타일적용. iOS·기타리더·태블릿은이번검증범위밖.
- 실제로 롤백·기존객체ACL변경·운영데이터정리 실행없음.
