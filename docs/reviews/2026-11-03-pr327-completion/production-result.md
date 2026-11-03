# PR #327 병합·Hosting 배포 결과

- 판정: ✅ 완료 — 루트 node-forge 갱신, 승인된 main 병합과 Hosting 자동배포 범위.
- 허대표님 직접 승인: “#327 병합·Hosting 자동배포 승인”. 기존 독립 Codex 대체 승인과 별개로 이 대화에서 운영 승인을 받았다.
- 검토 HEAD: `268fd5ac66747a603c83af112065702e1fe88102`. 호환성 6/6, 독립 재시험 6/6, 같은 HEAD CI 성공, 자동 Codex 무지적 및 독립 원문 “승인”. 기존 검토 원문은 그대로 보존한다.
- main 병합: `5732554c022d83bd12d7769daf62e7f69b3c9584`. 이전 main `505228b2` 대비 루트 package-lock.json의 version/resolved/integrity 3개 필드만 변경했다. 병합 후 lock 바이트가 검토 HEAD와 동일하며 SHA-256은 `d499990f95e4aaf8aa1fdfc30793928836766013d1f3d5b6195f14a9ff837a5c`다.
- [PR #327](https://github.com/hkd620-lab/haru2026/pull/327), [Hosting 실행 41563853913](https://github.com/hkd620-lab/haru2026/actions/runs/41563853913): 전체 성공. Node 22 설치·프론트 빌드·Hosting 배포 성공. 배포 단계 완료 2026-11-03 11:06:07 KST, 실행 완료 11:06:11 KST.
- 프로젝트 `haru2026-8abb8`, Hosting live 버전 `448b4ad1a8645d34`. 워크플로 대상과 로그 버전을 대조했다. 로그의 프로젝트·사이트 값은 GitHub에서 마스킹되어 있다.
- 운영 확인 11:07:12 KST: https://haru2026.com HTTP 200, HTML 제목 정상. HTML의 modern/legacy 자산명이 CI 빌드 결과와 일치하고 두 JS 파일 모두 HTTP 200이다. 상세 시각·파일 해시는 production-http.json에 있다. 프론트 소스가 바뀌지 않아 자산명이 이전 배포와 같은 것은 정상이다. 배포 구분 근거는 해당 main SHA의 Actions 실행과 Hosting 버전이다.
- Functions·Rules 수동 배포, Firestore/Storage 데이터 변경, 실제 결제·인증 조작 없음. Functions 리전·runtime·traffic 및 Rules 배포 시각은 이번 변경 대상이 아니다.
- GitHub·Slack 대조: Slack 공개 검색(node-forge, after:2026-11-02)에서 #haru2026-개발 GitHub 연동의 #327 병합 알림 11:04:56 KST 및 main push 알림 11:04:55 KST가 SHA와 일치했다. 이는 GitHub 봇 자동 알림이며 별도 감사 판정 게시를 수행한 것은 아니다. Slack 게시에 대한 직접 전송 지시는 없으므로 게시하지 않았다.
- 잔여 제한: audit의 별도 패키지 high 5항목은 남는다. 이 PR의 갱신과 별개로 기존 실기기 E2E·정책 결정 항목은 remaining-work.md에 보존하며 전체 제품 완료로 확대하지 않는다. 기존 review-ready.md의 “승인 대기”는 당시 상태이며 이 기록이 후속 결과다.
- 롤백이 필요하면 root lock만 별도 revert PR로 검토한다. 1.4.0 보안 상태로 돌아가는 위험과 운영 배포 승인을 확인하며 자동 롤백하지 않는다.
- 증빙 보관 예정: LaCie UUID 확인 후 `20261103_PR327_배포완료_01` 새 폴더에 전체 증빙을 복사하고 SHA-256을 비교한다. 실제 복사 결과는 최종 보고 및 보관 폴더의 SHA256-검증.json으로 확인한다. 내부 원본 삭제 없음.
- 난이도: 5.5 낮음.

## Slack 기록용 확정 요약 (미게시)

PR #327 루트 node-forge 1.4.2 갱신 완료. 호환성·독립 재시험 각 6/6, CI·자동 Codex·독립 Codex 승인 후 허대표님 운영 승인으로 main 5732554c 병합. Hosting 41563853913 성공, live 448b4ad1a8645d34, 운영 HTML·JS HTTP 200 및 빌드 자산 대조 완료. Functions·Rules 배포 없음. 별도 보안 항목·실기기 E2E·정책 결정은 기존 잔여 장부 유지.
