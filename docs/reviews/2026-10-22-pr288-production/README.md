# PR #288 병합·Hosting 자동배포·polishContent 단일 함수 운영 배포

## 현재 판정과 승인 범위

**✅ 승인된 병합·배포·기술 검증 완료 / 🔍 실제 계정 AI 생성·저장 E2E는 별도 확인 필요.**

허대표님은 PR #288 병합, Hosting 자동배포와 `polishContent` 함수 운영 배포를 승인했다. 기존 CC 및 다른 항목은 대상에서 제외했다. 이 기록은 새 제품 코드 수정이나 다른 함수·Rules 배포 승인이 아니다. 실행 중인 기존 CC를 사용·재개·중단하거나 그 작업본을 수정하지 않았다.

## 요구 → 검토 → 병합 → 배포

- 목적: FormatModal의 일반 다듬기·독서 마무리·중간 독서장 세 요청에서만 미사용 한마디 생성 호출을 생략한다. 서버는 명시적 false만 생략하고 옵션 누락·SayuModal 생성/저장은 유지한다.
- [PR #288](https://github.com/hkd620-lab/haru2026/pull/288): PR HEAD `8c6c4d5cbcaa50b4405a3621954ba6ec205c88b6`, main 병합 커밋 **`79c219c853b9b965678b78412116a4b1703c70e8`**, 병합 `2026-10-22T04:43:36Z`.
- `git diff --name-status 8c6c4d5c..79c219c8` 결과 없음. 병합 tree와 검토/CI 대상 tree가 동일하다. 운영 배포를 위해 별도 detached 작업본을 만들었고 원본 Developer 브랜치/clean 상태를 보존했다.
- 기존 PR CI와 Codex·독립 Claude 승인 원문은 이전 기록을 유지한다. draft ready 전환으로 자동 실행된 [Codex 실행 3 색인](../2026-10-22-pr288-codex-index-3.md)도 추가 보존한다. 대상 `8c6c4d5c`, `2026-10-22T04:42:45.781995Z` 완료·지적 없음. 완료 후 병합했다.
- [기존 독립 승인 원문 2](../2026-10-22-pr288-independent-review-2/reviewer-result.md): **“판정: 승인 — 설계·구현 기준이며, 공식 판정①은 아직 조건이 안 됩니다.”**
- [403 조치 독립 승인 원문 3](../2026-10-22-pr288-permission-review-3/reviewer-result.md): **“판정: 승인 — 조치 설계 기준입니다. 최신 CI와 판정① 조건은 아직 충족되지 않았습니다.”** 두 원문은 당시 CI 미충족 판단이다. 이후 CI·배포 결과를 원문 수정 없이 별도로 기록한다.

## Hosting 자동배포와 실제 운영 웹

- [main CI 39723978658](https://github.com/hkd620-lab/haru2026/actions/runs/39723978658), SHA `79c219c8`: 웹 build·live 배포 모두 성공. 완료 `2026-10-22T04:45:11Z`.
- Firebase `haru2026-8abb8` live version: `4328b2c609937df9` → **`509e8a0bba5531ef`**, releaseTime **`2026-10-22T04:45:09.206Z`**. API 상태 ENABLED 유지.
- `https://haru2026.com`과 `https://haru2026-8abb8.web.app` 모두 HTTP **200**, 동일 HTML SHA-256. 실제 제공되는 `/assets/index-BawkdBYL.js`도 200이고 명시적 false 요청 옵션이 **3개** 포함됐다. 운영 AI 생성/청구·저장 결과까지 확인한 것은 아니다.

## Functions 빌드·검증·대상 배포

배포 대상은 **프로젝트 haru2026-8abb8 / 리전 asia-northeast3 / polishContent / nodejs22**로 전후 확인했다.

```sh
cd functions
npm run build
node --test --test-reporter=tap test/polishContent.test.js test/aiGateway.test.js test/monthlyAiQuota.policy.test.js
# 저장소 루트에서
firebase deploy --only functions:polishContent --project haru2026-8abb8 --non-interactive
```

- 병합 커밋의 실제 Functions 빌드 및 관련 시험 **32/32 통과**. 시험은 합성 AI·메모리 대역이며 실제 AI 호출이나 운영 사용자 데이터 읽기/쓰기 없음.
- 실제 생성 lib export **114개**, 이전 검증 목록과 추가/삭제 없음. 컴파일 결과에 `includeAiComment !== false` 분기 확인. 배포 predeploy 빌드도 통과했다.
- 기존 웹 관련 시험 **36/36** 결과는 제품 tree가 동일해 유지된다. 이번 main CI에서 운영 설정의 웹 빌드를 다시 확인했다.
- Firebase CLI **15.16.0**, 단일 함수 배포 exit **0**, 로그의 Successful update 대상은 **polishContent(asia-northeast3) 1개뿐**이다. SDK 업데이트 권고는 기존 의존성 경고여서 이번 범위에서 변경하지 않았다.
- revision: `polishcontent-00242-pay` → **`polishcontent-00243-des`**. 상태 ACTIVE, 업데이트 **`2026-10-22T04:51:09.570204446Z`**.
- Cloud Run latestCreated/Ready가 모두 새 revision이며 실제 traffic **100%**다. runtime Node.js 22 유지.
- 배포 전후 Functions 목록 **114→114**, 추가/삭제 없음. 변경 항목은 polishContent 1개이며 **다른 113개 함수의 관측 메타데이터(상태·배포 시각·runtime 포함)가 동일**하다.
- 실제 callable URL에 인증 없이 합성 요청 1회를 보내 HTTP **401 / UNAUTHENTICATED / 로그인이 필요합니다.** 응답 확인. 인증 검사에서 중단되어 AI 호출과 운영 사용자 데이터 접근을 하지 않는다.
- 전체 Functions·Rules 배포, 모델/프롬프트·Secret·환경변수·리전·Firestore 경로 변경, 데이터 수정은 하지 않았다. 기존 403 조치에서 승인된 API 조회 권한 1개도 추가 변경하지 않았다.

## 근거와 기록 브랜치

[구조화 근거](evidence.json)에 SHA·파일 해시·빌드/시험 결과·Hosting version·함수 revision/source/build ID·traffic·인증 차단·다른 함수 비교 해시를 보존한다. 비밀값·전체 IAM 정책·사용자 데이터·전체 Functions 목록은 공개 기록에 복사하지 않는다.

이 문서와 실행 3 색인은 배포 후 `codex-pr288-production-record` 브랜치의 **새 docs/reviews 파일만** 추가한 기록이다. 운영 코드 SHA는 계속 `79c219c8`이며 기록을 운영 main에 직접 push하거나 별도 병합/재배포하지 않는다. 원격에 `codex` 브랜치가 있어 기존 작업과 같은 하이픈 이름을 사용한다.

## 되돌리기와 다음 첫 행동

되돌리기는 장애 원인·대상·영향을 확인하고 별도 승인 범위에서 수행한다. Hosting의 직전 version은 `4328b2c609937df9`, 함수 직전 revision은 `polishcontent-00242-pay`다. 함수의 이전 소스 bucket/object/generation과 새 소스·build ID는 evidence에 남겼다. 롤백이 필요하면 이전 Hosting release 또는 해당 함수의 확인된 이전 소스/리비전만 대상으로 하며 전체 Functions/Rules 배포·데이터 복구 작업으로 확대하지 않는다. 이번에 롤백·캐시 강제 삭제는 실행하지 않았다.

실제 계정 확인이 다음 작업이다. 최소 확인은 **FormatModal에서 AI 다듬기 → 저장 → 새로고침 후 본문 유지**, 그리고 **SayuModal에서 한마디 생성·저장 유지**다. 독서 마무리/중간 독서장 세 경로의 실제 요청 옵션과 한마디 호출 생략 여부도 별도로 확인할 수 있다. 이 확인 전 실제 품질·실청구 절감·사용자 동작 전체를 운영 완료로 단정하지 않는다. 기존 CC·다른 항목·새 코드 수정은 계속 제외한다.

작업 난이도: **5.5 중간**.
