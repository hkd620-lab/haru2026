# Node 22 보완 검증 — 2026-10-31

기존 README는 원문대로 보존한다. 독립 1회차 판정 ‘승인’의 추가 검증 요구를 이 파일과 logs-resume로 보완한다.

- 기준 main 5972c5cf93381ea48ba8e31381a4ed883fe1f6bc, 후보 42bc6a4218775fe925cbc88a964377be3ce7ca08. Node v22.23.2/npm 10.9.8.
- CC가 최신 main을 일반 merge했다. 이전 독립 대상 7806c62d 이후 frontend/package.json에 main의 질문 입력 시험 스크립트가 들어왔으므로 최종 통합 독립 확인은 아직 필요하다. 부모는 제품 코드를 추가 수정하지 않았다.
- 첫 보완 실행은 npm ci 중 세션 종료로 SIGTERM. 실패/중단 원문은 logs/에 보존. 부모가 CC 실행기를 재사용해 동기 실행한 결과는 logs-resume/이다. commands.json은 재개 실행의39개명령 원문 기록이다.
- main/후보 각각 Functions npm ci·build·EPUB·AI gateway·HEIC·계측 관련69시험 성공, 웹 npm ci·build·영향시험·Enter21시험·입력칸정책 성공. audit 이외 실패0.
- 웹 산출물797개 SHA-256 모두 동일, Functions lib46개 모두 동일, exports114개 동일. comparison.json과 전후 목록 참고.
- npm view 9개 버전의 integrity/resolved와 후보lock 모두 일치. registry-lock-comparison.json.
- npm audit은 기존 권고 때문에 exit1. frontend26→25, functions52→52. 전체 취약점 해소로 주장하지 않는다. 원문 audit-*.json 보존.
- 이전 README 누락 보완: gaxios7.1.3→rimraf는 lock 선언 경로이지만 로드가 없다. 기존 \brequire 정규식이 놓치는 __require도 새 reachability-followup.cjs에서 검사했다. 3,793개 파일을 검사한 main/후보 결과에서 ip-address·brace-expansion·rimraf·puppeteer 런타임 도달 없음. 컴파일 lib는 해시 목록으로 특정했다.
- 배포 영향: Hosting 빌드 산출물 동일. Functions 소스·lib 변경 없고 변경패키지 런타임 도달 없으므로 운영 함수 배포0개, 다음 해당 함수 배포시 lock 반영. Rules·리전·경로·환경변수·결제·인증·모델 변경 없음.
- Claude Code 월간 사용 한도 메시지로 추가 독립 검토를 실행할 수 없는 상태. Codex·최종CI·독립 통합 확인 전에는 병합하지 않는다.
