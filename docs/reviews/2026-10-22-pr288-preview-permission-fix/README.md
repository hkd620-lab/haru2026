# PR #288 미리보기 403 — 최소 권한 해결 기록

## 승인 범위

허대표님이 “PR #288 미리보기 배포의 403 권한 오류만 원인을 확인하고 최소 범위로 해결”, CI 재확인까지 승인했다. 기존 CC·다른 항목·병합·운영 Hosting/Functions 배포는 보류한다.

기준 PR HEAD는 `754d4d253401c0769d375f346b5ce29e9a7a768f`, main은 `8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9`다. 원본 Developer 작업본과 기존 CC 세션은 사용·재개·중단·수정하지 않았다.

## 원인 확인

- 기존 CI의 웹 빌드는 성공하고, Firebase CLI가 `serviceusage.googleapis.com`에서 `firebasehosting.googleapis.com` 서비스 상태를 읽는 단계에서 403으로 실패했다.
- [Google GetService 권한 명세](https://docs.cloud.google.com/service-usage/docs/reference/rest/v1/services/get)는 이 요청에 `serviceusage.services.get`을 요구한다.
- 기존 GitHub 로그는 계정을 마스킹하므로 계정명을 추정해 권한을 부여하지 않았다. `b62df5a1`에서 PR #288에만 실행되는 임시 지문 진단을 추가했다. 기존 Secret JSON의 client_email을 메모리에서 SHA-256으로 변환하고 **지문만** 출력했다. 키·토큰·JSON 원문·메일은 출력하지 않았다. 합성 유효/무효 입력으로 로그 비노출을 먼저 확인했다.
- [진단 CI 39712130045](https://github.com/hkd620-lab/haru2026/actions/runs/39712130045)의 지문 `892886d9e33e9286de2f554bb1c65ed07ee76a67db734e5b1034d64d66bbbc9e`가 현재 IAM의 GitHub Actions 배포 계정 1개와 유일하게 일치했다. 해당 계정은 `roles/firebasehosting.admin`만 부여된 상태였다.
- 이전 성공 [CI 39425882963](https://github.com/hkd620-lab/haru2026/actions/runs/39425882963)은 `firebase-tools@15.34.0`, 이번 진단 실패와 수정 후 성공 CI는 모두 `15.34.1`이었다. workflow가 `firebase-tools@latest`를 사용하므로 CLI 변화가 이 읽기 점검을 드러냈을 가능성이 있다. 이는 로그 버전 차이에 근거한 추정이며 CLI 패치 자체의 원인을 확정한 것은 아니다. CLI 버전 고정이나 workflow 동작 변경은 하지 않았다.
- 지문은 익명화가 아닌 원문 비노출용이다. 후보 계정명을 아는 사람은 해시를 대조할 수 있으며, 키나 토큰을 뜻하지 않는다.
- 운영자 인증으로 읽은 Hosting API 상태는 이미 `ENABLED`였다. API 비활성 문제로 보고 서비스를 켜지 않았다.
- 지문 확인 후 임시 진단을 `99377e98`에서 제거했다. workflow는 `754d4d25` 기준과 바이트 단위로 동일하다. 두 진단 커밋을 숨기지 않으며 이 작업의 최종 workflow diff는 없다.

## 최소 조치

프로젝트 `haru2026-8abb8`에 사용자 지정 역할 `projects/haru2026-8abb8/roles/firebaseHostingApiStateReader`를 만들고, 확인된 CI 계정 1개에만 연결했다. 생성 전 같은 이름의 사용자 지정 역할이 없음을 확인했다. 포함 권한은 아래 **하나뿐**이다.

```yaml
includedPermissions:
  - serviceusage.services.get
```

[역할 정의](role.yaml). Service Usage Viewer/Consumer/Admin나 Owner/Editor 같은 넓은 역할을 추가하지 않았다. 이 권한은 프로젝트의 API 상태/구성 읽기이며 API enable/disable/use·IAM 수정·Functions 배포·Hosting 쓰기 권한을 추가하지 않는다. 기존 Hosting 관리자 역할은 변경하지 않았다.

IAM 전후를 바인딩 `(role, condition, member)` 단위로 비교했다. 관측 차이는 해당 사용자 지정 역할/CI 계정의 바인딩 **1개 추가**, 삭제 **0개**였으며 다른 정책 필드도 같았다. 전체 정책 덮어쓰기나 다른 계정/역할 수정은 하지 않았다. 원본 IAM 스냅샷과 실제 계정 매핑은 비공개 로컬 진단 파일로만 보존하고 공개 기록에는 복사하지 않는다.

## CI·운영 상태 검증

- 수정 후 workflow 복원 커밋 `99377e98`의 [CI 39712816798](https://github.com/hkd620-lab/haru2026/actions/runs/39712816798)는 **웹 빌드·미리보기 배포 모두 성공**, `2026-10-22T02:50:39Z` 완료다. 추가 권한 오류는 없었다. 재실행 없이 첫 수정 후 실행으로 통과했다.
- [PR 미리보기](https://haru2026-8abb8--pr288-codex-polish-comment-o9crqfa3.web.app)는 HTTP **200**, HTML root와 JS bundle 참조를 확인했다. 실제 AI 호출·사용자 데이터 변경은 하지 않았다.
- 운영 Hosting live는 수정 후 `2026-10-22T04:05:29Z` 읽기 조회에서도 version `4328b2c609937df9`, releaseTime `2026-10-20T21:54:29.901Z`로 동일하다. 이름·URL·updateTime·release·version·상태 전체가 수정 전과 같다. API 상태도 `ENABLED` 유지다.
- 최종 검토 기록 commit의 CI도 별도 확인해 PR/Slack에 남긴다. 배포 성공 check만으로 실제 운영 AI 호출 감소·운영 E2E를 완료로 보지 않는다.
- 제품 코드·기존 시험·모델·Secret·환경변수·Rules·Firestore 경로·Functions 리전·운영 데이터는 바꾸지 않았다. 앱/Functions 빌드는 제품 코드가 바뀌지 않아 반복하지 않았으며, 실제 GitHub CI의 웹 빌드를 확인한다.

운영자 상태 조회는 첫 요청에서 사용자 자격 증명의 quota project 누락으로 거부됐고, 요청 헤더에 프로젝트를 명시한 읽기 전용 요청으로 확인했다. 전역 gcloud/ADC 인증 설정이나 CI Secret을 변경한 조치가 아니다. 이 진단 보정과 CI 계정의 권한 누락을 혼동하지 않는다.

## 복구 방법

이 작업에서 추가한 사용자 지정 역할 바인딩을 **검증한 CI 계정 1개에서만** 제거하면 권한 추가를 되돌릴 수 있다. 기존 Hosting 관리자 역할과 다른 바인딩은 유지한다. 새 사용자 지정 역할 자체를 삭제하려면 연결 주체가 더 생기지 않았는지 먼저 확인하고, 이 작업에서 만든 미사용 역할에 한해 삭제한다. 프로젝트 IAM 전체를 이전 스냅샷으로 덮어쓰지 않는다.

정확한 원래 정책·대상 계정/지문·추가 역할/권한은 `/private/tmp/haru-pr288-iam-before-fix.json`, `/private/tmp/haru-pr288-verified-iam-plan.json`, `/private/tmp/haru-pr288-created-role.json`에 남겼다. 이 파일에는 비밀키/토큰을 저장하지 않았으나 전체 IAM의 다른 주체 정보가 있어 공개하지 않는다. 임시 workflow는 이미 기준 버전으로 복원했다.

임시 파일이 없어져도 다음 읽기 조회로 이 역할의 현재 연결 주체를 찾을 수 있다. 반환된 `members`에서 진단 지문과 일치한 대상 1개를 다시 확인한 다음, 그 대상에만 바인딩 제거를 적용한다. 아래는 복구 절차이며 이번 작업에서 실행하지 않았다.

```sh
gcloud projects get-iam-policy haru2026-8abb8 --flatten='bindings[]' --filter='bindings.role=projects/haru2026-8abb8/roles/firebaseHostingApiStateReader' --format='json(bindings.role,bindings.members,bindings.condition)'
gcloud projects remove-iam-policy-binding haru2026-8abb8 --member='serviceAccount:<검증한 CI 계정>' --role=projects/haru2026-8abb8/roles/firebaseHostingApiStateReader --condition=None
```


## 범위와 남은 일

PR은 초안·자동 병합 없음 상태를 유지한다. 운영 Hosting·Functions·Rules 배포, main 병합, 실제 AI 호출·사용자 데이터 변경은 하지 않는다. CI 미리보기는 수정된 Functions를 배포하지 않으므로 기존 기능 PR의 운영 완료/E2E와 구분한다. 기존 코드 리뷰 지적 없음·독립 설계/구현 승인 기록은 보존한다. 새 권한의 403 등 다른 원인이 생기면 권한을 연속 추가하지 않고 원인과 별도 범위를 보고한다. 이번 승인으로 다른 계정·권한·Secret·workflow 개선까지 확대하지 않는다.

[독립 Claude 실행 3 원문](../2026-10-22-pr288-permission-review-3/reviewer-result.md)은 **“판정: 승인 — 조치 설계 기준입니다. 최신 CI와 판정① 조건은 아직 충족되지 않았습니다.”**다. 원문은 CI 진행 중 판단이며 이후 성공은 위에 별도 기재했다. 임시 workflow 변경 이력이 있어 최신 검토 대상 `99377e98`의 Codex 재검토를 별도 요청했고 **완료·지적 없음**을 확인했다([실행 2 색인](../2026-10-22-pr288-codex-index-2.md)).

작업 난이도: **5.5 중간**.
