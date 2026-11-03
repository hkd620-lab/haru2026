# PR327 루트 node-forge 업데이트 검증

- 요청: 허대표님 “남은작업마무리 하자”. PR327 검토·검증을 진행했다.
- 검토 HEAD268fd5ac66747a603c83af112065702e1fe88102. 기준main505228b2785f99bde0342b53173132dafa40e5e1.
- diff는 루트 package-lock.json node-forge1.4.0→1.4.2 version/resolved/integrity 세 필드만이다. tools의 PR322와 별도 환경이다.
- Node22.23.2/npm10.9.8, /private/tmp/haru-pr327-20261103/candidate에 PR manifest·lock을 추출해 npm ci --ignore-scripts --no-audit --no-fund 실행. 212패키지 설치 성공.
- npm ls --all exit0. firebase-admin12.7.0→node-forge1.4.2, firebase12.9.0 설치. Admin 허용범위 ^1.3.1 안이다.
- node --test compatibility.cjs 6/6 성공: 잠긴 버전 로드, PEM string/Buffer, ASN.1 인증서/서명, 합성키 Admin 토큰서명·변조거부, Firebase client SDK·Firestore 초기화/종료, 잘못된 키 로컬 거부.
- 합성키·토큰은 메모리에만 있으며 출력/저장 없음. 운영 API·사용자 데이터·실제 인증정보를 사용하지 않았다. export-logs 등 운영자료 접근 스크립트는 실행하지 않았다.
- npm view node-forge@1.4.2의 version/dist.integrity/dist.tarball 원문을 보존했으며 lock과 일치한다.
- 설치후 lock SHA256 d499990f95e4aaf8aa1fdfc30793928836766013d1f3d5b6195f14a9ff837a5c는 PR 원본과 동일하다.
- git diff 268fd5ac^ 268fd5ac --check 통과. PR CI41554969170 SUCCESS는 tools/루트 검증을 대신하지 않으며 합성시험을 따로 실행했다.
- 루트에는 build·test 스크립트가 없으며 제품 프론트 소스 변경도 없다. 필요 없는 전체 제품 빌드는 반복하지 않는다. main 병합 시 기존 workflow가 웹build·Hosting 자동배포를 실행한다.
- npm audit 전체 원문 보존. node-forge 항목 유무와 별개 의존성 잔여를 구분하며 전체 보안 해결로 주장하지 않는다.
- 리전asia-northeast3/Firestore users/{uid}/records/{date}/환경변수/Rules/인증·결제 정책 변경 없음. Functions·Rules 배포 대상 없음.
- 되돌리기: 해당 루트 lock만 별도 revert PR로 복구하되 1.4.0 보안상태 복귀 위험을 함께 검토한다.

## 검토·권한

- Claude auth status loggedIn=false. 대표님에게 이전 예외가 PR322 한정임을 설명했고 “#327도 독립 Codex 검토로 대체”라는 직접 답변을 받았다. 이번 PR327에 한한 예외다.
- GitHub 자동요청 https://github.com/hkd620-lab/haru2026/pull/327#issuecomment-6593385797 , 대상 SHA 동일.
- 독립 검토는 별도 Codex로 진행하며 자동 리뷰와 구분한다. 최초 독립 검토, 이전 판정 없음.
- Slack 공개 개발/감사에서327 검색 결과없음. 이를 실패로 보지 않는다. 새 Slack 게시 없음.
- 이 검증 기록 작성 시점 병합/Hosting 배포 승인 없음. 제품검토 예외가 운영 승인은 아니다.
- npm 원본 로그의 마지막 빈 줄은 원문 보존 대상으로 두며 문서·코드·JSON 공백 검사와 구분한다.
