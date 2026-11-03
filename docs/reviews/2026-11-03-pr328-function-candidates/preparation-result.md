# PR #328 Functions 의존성 전용 후보 준비

판정: **✅ 로컬 후보 준비 완료 / ⚠️ 운영 Functions 적용 미완료**. 배포 승인 요청 전 독립 검토와 최종 실행 절차 확정이 필요하다. 이번 작업은 후보 준비이며 운영 변경은 없다. 난이도: **중간**.

## 기준과 확인 결과

- 저장소 `/Users/heogyeongdae/Developer/HARU2026`, 작업 브랜치 `codex-completion-audit-20261103`, 시작 HEAD `f5996c92a2adc27cf66bfcb947b60adbfda485b0`, 시작 시 작업 트리 깨끗함. 제품 코드 수정 없음.
- GitHub 재확인: PR #328 MERGED, main 병합 SHA `69480ecafdb8b170051e1ea3ae71bb72512f1208`, Hosting Actions `41586795863` success. 이전 빌드·관련 시험·Hosting 운영 확인 근거는 원래 완료 기록을 유지한다.
- Slack 공개 검색: `#haru2026-개발`의 2026-11-03 14:56:18 KST PR #328 병합·main push 봇 알림이 GitHub와 일치. 직접 게시 지시가 없어 이번 후보 준비 결과는 Slack 미게시.
- 운영 읽기 전용 목록 114개 중 기존 비교 대상 100개 source bucket/object/generation이 이전 기록과 일치. 이전 export 밖 14개는 후보에 포함하지 않았다.
- 대상 100개 모두 `ACTIVE`, `nodejs22`, `asia-northeast3`. 기존 source·build·revision·updateTime·traffic 기준은 `function-matrix.json`에 함수별로 기록했다. 실제 트래픽 분배는 배포 승인 직전 Cloud Run 서비스에서 별도 확인해야 한다.

## 생성한 후보

- 외장 위치: `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/20261103_PR328_Functions_후보_01`.
- LaCie APFS, UUID `06827F85-BF9F-465C-9C30-E39085839975` 실측 확인 후 새 폴더에 생성했다. 기존 파일 덮어쓰기·내부 원본 삭제 없음.
- 운영 원본 36묶음 → 후보 ZIP 36개, 총 489,433,920바이트. 함수 100개와 각 후보의 대응표 제공.
- 후보마다 `package-lock.json`의 `packages["node_modules/node-forge"]`에서 `version`, `resolved`, `integrity`만 PR #328의 값으로 변경했다. 버전 `1.4.0 → 1.4.2`.
- JSON 구조를 비교해 3필드만 변경됐음을 검증했다. ZIP 전체 항목을 다시 읽어 파일 추가·제거 없이 잠금 파일만 달라졌고, 나머지 총 4,169개 항목의 SHA-256이 원본과 일치함을 확인했다. ZIP 압축 크기 자체는 달라질 수 있다.
- 기존 `package.json`, `src/`, `lib/`, 데이터·폰트·부가파일을 그대로 보존했다. main의 최신 코드를 옛 운영 소스에 섞지 않았다. 이전 grammar 컴파일 파일도 원본대로 유지했다.
- 각 묶음에 `candidate.zip`, 수정된 `package-lock.json`, `lock.patch`가 있다. `sha256-manifest.json`의 모든 파일을 저장 후 다시 읽어 검증했다.
- 원본 ZIP은 기존 내부 검증 위치 `/private/tmp/haru-pr328-20261103/live-source-comparison`에 유지한다. 원본·후보 ZIP이나 환경·자격증명 원문은 Git·PR·Slack에 게시하지 않는다. 저장소에는 준비 스크립트와 비밀값 없는 메타데이터·시험 로그만 추가한다.

## 재컴파일 조건

운영 목록에서 대상 100개 모두 빌드 환경변수 `GOOGLE_NODE_RUN_SCRIPTS`가 **존재하며 빈 문자열**임을 확인했다. 누락과 빈 값을 구분했다. 모든 원본 manifest에 `build`가 있지만 `gcp-build`, `prepare`, 설치 lifecycle script는 없고 다른 패키지 관리자 잠금 파일도 없다.

Google 공식 문서는 빈 `GOOGLE_NODE_RUN_SCRIPTS`로 기본 빌드 스크립트 실행을 막을 수 있다고 설명한다. 이 기존 설정을 유지해야 후보 ZIP 안의 컴파일 파일을 그대로 사용한다. 설정이 누락되거나 바뀌었으면 배포를 중단하고 재검토한다.

- [Node.js Buildpacks 빌드 스크립트 설정](https://docs.cloud.google.com/docs/buildpacks/nodejs)
- [Cloud Functions v2 PATCH와 updateMask](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch)

미래 실행안은 **함수 한 개씩**, 업로드한 후보 소스를 지정하고 `updateMask=buildConfig.source`만 사용하는 API 갱신이다. 기존 설정 전체를 재작성하거나 저장소의 `firebase deploy` predeploy를 실행하지 않는다. API 업로드·PATCH는 이번에 실행하지 않았으며 아직 검증된 배포 도구가 아니다. 빈 updateMask는 전체 필드 갱신이므로 금지한다.

## 검증과 한계

- 잠금 그래프는 3종류(대표 묶음 01/02/09). 각각 Node 22에서 `npm ci --omit=dev --ignore-scripts` 성공, 잠금 파일 바이트 유지.
- 대표 02는 기존 캐시로 설치. 01/09는 기존 sharp 0.34.5가 캐시에 없어 첫 offline 설치 실패 후 일반 네트워크 설치로 재검증했다. 실패와 재시도 결과는 `validation.json`에 보존했다.
- 각 그래프에서 기존 합성 호환성 시험 7개 통과, **총 21/21**: node-forge 버전·PEM·ASN.1·인증서·합성 RSA custom token·잘못된 키 거부·Firebase Admin의 실제 의존성 해석·PKCS 키 호환성 범위.
- 이번에는 제품 소스 재컴파일을 하지 않았다. 배포 후보의 컴파일 파일을 바꾸지 않는 것이 목적이며, PR #328의 기존 Functions 빌드·관련 18개 시험 근거는 별도로 유지한다.
- 설치 lifecycle script를 끈 검증이므로 sharp 등 네이티브 패키지 실행 확인을 뜻하지 않는다. Cloud Build·Linux 컨테이너·실사용자 E2E도 수행하지 않았다.
- 소스와 잠금 파일만의 변경 범위를 보증한다. 서버 재빌드에 따라 기반 이미지·런타임 패치·플랫폼 주입 패키지는 달라질 수 있어 최종 컨테이너 전체의 차이가 node-forge 하나뿐이라고 주장하지 않는다.

## 첫 소규모 배포 후보와 복구 기준 — 미승인

첫 검토 대상은 `getMonthlyAiQuotaStatus` 한 개(묶음 26)로 제안한다. 운영 컴파일 코드에서 로그인 확인 후 본인의 구독·사용량을 조회하며 AI 호출·사용량 증가 없이 응답하는 경로를 확인했다. 결제·환불·회원탈퇴 실행 함수를 첫 대상으로 삼지 않는다.

- 후보: 외장 폴더 `group-26/candidate.zip`
- SHA-256: `1ca7890e8730c5e8ff673726916cbd7f701a0022d1a908f4d6db9cfb48c78e20`
- 기존 revision: `getmonthlyaiquotastatus-00007-yel`
- 기존 source: `gs://gcf-v2-sources-398138267500-asia-northeast3/getMonthlyAiQuotaStatus/function-source.zip#1789322815127907`

승인에 올리기 전 정확한 후보 hash·단일 함수명·기존 revision·최소 E2E·복구 범위를 독립 검토한다. 정책 8.1의 독립 Claude 검토 및 해당되는 PR 자동 검토 게이트를 로컬 자기 검증으로 대체하지 않는다. 이번 보조 Codex 기술 검토 역시 Claude 검토를 대체하지 않는다.

향후 실행 절차:

1. 배포 직전 source generation/revision/updateTime, 빌드 비활성화 설정, 실제 Cloud Run 트래픽, 현재 환경·Secret 참조·서비스계정·트리거·IAM을 읽기 전용 대조한다. 민감한 값은 보고서에 남기지 않는다. 기준 변경 시 후보를 그대로 배포하지 않는다.
2. 단일 대상과 정확한 ZIP hash에 대한 허대표님 Functions 승인을 받은 뒤 새 업로드 객체로 후보를 전송한다. 반환된 bucket/object/generation을 확인하고 단일 source 필드만 PATCH한다. 변경 승인 전 업로드도 실행하지 않는다.
3. 작업 완료 후 새 source/build/revision, nodejs22, asia-northeast3, 실제 트래픽을 기록한다. Cloud Build 로그로 빌드 스크립트가 실행되지 않았고 1.4.2가 설치됐는지 확인한다. 로그로 확인이 부족하면 생성 이미지의 패키지를 읽기 전용으로 검사한다. 소스 lock만으로 실행 의존성 확인을 대신하지 않는다.
4. 비로그인 거부와 승인된 시험 계정의 월간 사용량 조회, 전후 카운터 불변을 확인한다. 실제 계정 정보·토큰·응답 원문은 기록하지 않는다. 실패하면 다음 함수로 진행하지 않는다.
5. 복구는 별도 승인 범위에 맞춰 기존 revision으로 트래픽을 되돌리는 방식 또는 보존한 원본 source로 재배포하는 방식을 검토한다. 후자는 빌드 환경 재현을 보장하지 않으며 node-forge 1.4.0도 복원하므로 긴급 복구 한계를 보고한다. 복구 실행·기존 revision 삭제는 이번 범위에 없다.
6. 첫 대상 검증 결과를 검토한 후 나머지 함수의 단계별 대상·시나리오를 확정한다. 100개 일괄 배포로 확대하지 않는다.

Functions 리전·Firestore 경로·환경변수·결제·인증 정책 변경 없음. Functions·Rules 배포, legacy14 삭제, 사용자 데이터 변경 없음.

## Slack 기록용 확정 요약 — 미게시

PR #328 Functions 의존성 전용 로컬 후보 36개/대상100개 준비. 기존 운영 source 참조 변화 없음. 각 후보는 node-forge lock3필드만 변경, 나머지4169항목 동일. 기존 빌드 비활성화 설정100개 확인, 잠금 그래프3종 설치 및 합성 호환성21/21. LaCie 새 폴더에 SHA-256 검증 저장. 운영 배포 없음. 독립 검토·단일 대상 승인 및 배포 후 컨테이너/E2E 확인이 남음.
