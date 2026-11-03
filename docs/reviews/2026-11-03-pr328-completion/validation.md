# PR #328 검증 및 운영 적용 구분

대상 e829fa4cc2197703ab21e6318b174fb19b4f9fd2. base 5732554c022d83bd12d7769daf62e7f69b3c9584. Functions package-lock.json의 node-forge 1.4.0→1.4.2 세 필드만 변경. manifest 및 Functions 소스 변경 없음. 리전 asia-northeast3, Firestore users/{uid}/records/{date}, 환경변수, 결제·인증 정책 변경 없음.

## 재현 및 결과

정확한 HEAD의 functions 디렉터리를 git archive로 내부 임시 작업 위치 /private/tmp/haru-pr328-20261103/functions에 추출했다. 환경 파일·실제 인증값을 복사하지 않았다. Node v22.23.2/npm 10.9.8, PUPPETEER_SKIP_DOWNLOAD=true로 불필요한 Chromium 다운로드를 생략했다.

1. `npm ci --no-audit --no-fund --cache /private/tmp/haru-pr328-20261103/npm-cache`: 성공. 잠금 파일이 Git 원본과 바이트 단위로 같음을 설치 후 다시 확인.
2. `npm run build`: 성공(tsc 및 폰트 복사). 제품 파일 변경 없음.
3. `node --test compatibility.cjs`: 최종 7/7. node-forge 로드, string/Buffer PEM, ASN.1 인증서 roundtrip/서명, Admin 합성키 JWT 서명·변조 거부, 비정상 키 거부, 실제 Admin 의존경로, PKCS1·PKCS8 키 호환성. 최초 6/6 로그도 보존.
4. `node --test test/googleOAuthCallback.behavior.test.js test/oauthCallbackDiagnostics.test.js test/oauthStateCore.test.js test/oauthInitialization.test.js test/sharpImagePipelines.test.js`: 18/18, compiled Functions cold load/export 100개 포함. 실제 로그인·결제·Firestore·Storage 작업 없음.
5. exports-check.cjs: base/HEAD의 Functions 소스 diff 0, export 100개 동일, 추가·삭제 0.
6. CI build_and_preview 41563990998, linux_x64_node22 41563991115 모두 정확 HEAD 성공. Linux 실제 설치·Functions 빌드·sharp 경로 시험 포함.
7. 독립 Codex 원문 판정 “승인”, RSA/PEM/Admin 합성 재시험 성공. 허대표님이 이 PR만 독립 Claude 대신 Codex를 허용했다. 검토 질문·결과·후속 근거 전달을 보존한다.
8. 자동 Codex 1회 무지적 완료. 자동 색인 및 GitHub 원문 확인.

`npm audit --json`은 node-forge 권고 없이 다른 의존성 64건(critical 2/high 41/moderate 18/low 3)으로 exit 1이다. 이번 PR을 전체 보안 해결로 판정하지 않는다. 원문 npm 로그의 EOF 빈줄은 기록 보존 대상이며 문서 공백검사와 구분한다.

## 운영 영향·남은 단계

- GitHub/Slack 대조: [Slack #328 생성 기록](https://harulab-hq.slack.com/archives/C0C11P98MHV/p1793671569265139) 11:06:09 KST와 GitHub PR을 확인했다. 별도 대표 배포 승인 기록은 없다. 직접 대화의 독립 검토 대체 승인은 병합·배포 승인이 아니다.
- gcloud read-only 목록: 운영 114개 모두 asia-northeast3/nodejs22. 현재 export 100개는 모두 운영에 존재한다. 이전 함수 14개는 source export에 없으며 기존 삭제 보류 범위를 유지한다. 목록과 소스 참조는 deployment-scope.json/live-source-refs.json에 있다.
- main 병합은 Hosting 자동배포만 실행한다. 운영 Functions의 node-forge를 갱신하려면 별도 Functions 배포가 필요하다. 함수별 기존 배포 소스와 후보 소스의 차이를 아직 확인하지 않았으므로 공통 의존성 변경만 적용된다고 단정할 수 없다.
- 다음 운영 준비: 100개 기존 함수의 소스 차이를 검토해 배포에 섞이는 변경을 특정하고, 대상 함수 이름·배포 순서·롤백 방법·확인 동작을 확정한 뒤 별도 승인을 받는다. 14개 이전 함수의 삭제·복구는 포함하지 않는다. 전체 functions 배포 명령을 실행하지 않는다.
- 현재는 코드 검증·검토 완료이며 main 병합·Hosting 승인 대기. Functions 적용은 미완료다. Rules 배포 없음.
- 위험·되돌리기: lock 변경 자체는 별도 revert PR로 되돌릴 수 있으나 1.4.0 보안 위험이 돌아온다. Functions를 배포한 뒤의 되돌리기는 함수별 이전 소스·revision을 확인한 계획이 필요하다.
- 난이도: 중간. Slack 미게시.
