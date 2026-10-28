# PR #307 승인 후 병합·배포 확인

- 기록 시각: 2026-10-28T05:01:12.805248+00:00
- 대표님 승인: 같은 작업 대화에서 “승인할께”. 직전 요청 범위는 PR #307 main 병합(Hosting 자동 배포 포함)과 `polishElderBookChapters` 단독 Functions 운영 배포였다.
- PR: https://github.com/hkd620-lab/haru2026/pull/307
- 병합 시각: 2026-10-28T04:53:13Z (KST 13:53:13).
- main 병합 SHA: `f4123f355afe1fd8e132c94d18459ee0f9161f09`.
- 승인된 PR HEAD: `500c0176800462542d27b6ad4fc3462b33336f24`.
- 배포한 로컬 소스와 병합 main의 tree SHA: 모두 `7982499e752e2afbd96623c3fdb05f3b0b868b3e`. `git diff --exit-code HEAD origin/main` 차이 없음 확인 후 배포했다.

## Hosting

- main 자동 배포 성공: https://github.com/hkd620-lab/haru2026/actions/runs/40634820604
- 완료: 2026-10-28T04:54:41Z (KST 13:54:41).
- Actions 로그의 Hosting version: `96270b11e5ba26b3`.
- https://haru2026.com GET: HTTP 200.
- 응답 HTML의 진입 스크립트 `/assets/index-D0IcIH4o.js` 확인. 브라우저 화면 E2E를 수행했다는 뜻은 아니다.

## Functions

실행 명령:

```sh
firebase deploy --only functions:polishElderBookChapters --project haru2026-8abb8 --non-interactive
```

- predeploy Functions 빌드 통과. CLI 최종 `Successful update operation`, `Deploy complete!`, 종료 코드 0.
- 배포 대상: `haru2026-8abb8` / `asia-northeast3` / `polishElderBookChapters` 한 개.
- runtime: Node.js 22, GEN_2.
- 이전 revision: `polishelderbookchapters-00034-xow`.
- 신규 revision: `polishelderbookchapters-00035-rox`.
- 완료 updateTime: 2026-10-28T04:57:06.960084817Z (KST 13:57:06).
- Cloud Run 최신 ready revision과 트래픽: 신규 revision 100%.
- `gcloud functions list --project haru2026-8abb8 --filter='name:polishElderBookChapters'` 실측: ACTIVE, 리전·runtime·revision 일치.
- Cloud Build ID: `81295d47-e79f-42e1-91ec-2f33126ccd09` (asia-northeast3).
- 다른 Functions·Firestore Rules·Storage Rules 배포 없음. Rules 변경이 없어 Rules 배포 시각 해당 없음.

## 배포 소스 검증

- 운영 함수 metadata가 가리키는 소스: `gs://gcf-v2-sources-398138267500-asia-northeast3/polishElderBookChapters/function-source.zip#1793163329990181`.
- 해당 generation을 내려받아 `src/elderBook.ts`, `src/index.ts`, `package.json`, `package-lock.json`을 병합 SHA의 파일과 바이트 단위 대조: 모두 일치.
- 배포 archive 안 `lib/elderBook.js`의 윤문 호출: `model: "gpt-6.1-sol"`, `reasoning_effort: "low"`, `max_completion_tokens: 6000` 확인.
- 소스 archive SHA-256: `2e682aa403c6185a145f3c5a3743b5aa37d36ad194581c0f88453c0bbf8f9f20`.
- archive 및 조회 원본은 로컬 `/private/tmp/haru-pr307-deploy-20261028/`에 보관. API 키·환경변수 원문은 읽거나 이 기록에 포함하지 않았다.

## 운영 확인과 남은 E2E

- 무인증 callable POST `{"data":{}}`: HTTP 403, 응답 status `PERMISSION_DENIED`.
- 소스의 `assertDeveloper`가 DB 읽기와 모델 호출보다 먼저 실행하므로 이 점검에서 책 데이터·AI 출력·발행 상태를 변경하지 않았다.
- 실제 책 전체 윤문·저장·발행 E2E는 미실행. 최소 대표 확인: 책 윤문 실행 후 한 장의 결과를 원문과 대조해 사실·수치·부정 표현·말투 보존과 저장된 윤문 표시를 확인한다. 함수가 여러 장을 처리하므로 단일 장만 실행한 것으로 표현하지 않는다.
- 배포 및 메타데이터·권한 거부 확인은 완료. 실제 책의 의도한 윤문 품질 결과는 **🔍 추가 E2E 필요**.

## 검토 및 기록 범위

- 독립 Claude 최초 결과: [원문](claude-result.md), 코드 개발 범위 “승인”.
- Codex 실행 1: [기존 색인](codex-index.md).
- Draft 해제 후 자동 실행 2: [추가 색인](codex-index-run2.md), 최종 HEAD에서 지적 없음.
- 이 두 새 파일은 배포 후 증거 기록이다. 제품 소스나 운영 배포를 추가 변경하지 않는다. 승인된 PR #307의 main 병합과 구분해 별도 기록 브랜치에 보존한다.

## 조회 원본 (민감 필드 제외)

### 배포 전 함수

```json
{
  "buildConfig": {
    "runtime": "nodejs22",
    "source": {
      "storageSource": {
        "bucket": "gcf-v2-sources-398138267500-asia-northeast3",
        "generation": "1789217338398167",
        "object": "polishElderBookChapters/function-source.zip"
      }
    }
  },
  "name": "projects/haru2026-8abb8/locations/asia-northeast3/functions/polishElderBookChapters",
  "serviceConfig": {
    "allTrafficOnLatestRevision": true,
    "revision": "polishelderbookchapters-00034-xow",
    "service": "projects/haru2026-8abb8/locations/asia-northeast3/services/polishelderbookchapters",
    "uri": "https://polishelderbookchapters-6ieesxet3q-du.a.run.app"
  },
  "state": "ACTIVE",
  "updateTime": "2026-09-12T12:49:15.100856946Z"
}
```

### 배포 후 함수

```json
{
  "buildConfig": {
    "build": "projects/398138267500/locations/asia-northeast3/builds/81295d47-e79f-42e1-91ec-2f33126ccd09",
    "runtime": "nodejs22",
    "source": {
      "storageSource": {
        "bucket": "gcf-v2-sources-398138267500-asia-northeast3",
        "generation": "1793163329990181",
        "object": "polishElderBookChapters/function-source.zip"
      }
    }
  },
  "name": "projects/haru2026-8abb8/locations/asia-northeast3/functions/polishElderBookChapters",
  "serviceConfig": {
    "allTrafficOnLatestRevision": true,
    "revision": "polishelderbookchapters-00035-rox",
    "service": "projects/haru2026-8abb8/locations/asia-northeast3/services/polishelderbookchapters",
    "uri": "https://polishelderbookchapters-6ieesxet3q-du.a.run.app"
  },
  "state": "ACTIVE",
  "updateTime": "2026-10-28T04:57:06.960084817Z"
}
```

### 배포 후 트래픽

```json
{
  "status": {
    "latestReadyRevisionName": "polishelderbookchapters-00035-rox",
    "traffic": [
      {
        "latestRevision": true,
        "percent": 100,
        "revisionName": "polishelderbookchapters-00035-rox"
      }
    ],
    "url": "https://polishelderbookchapters-6ieesxet3q-du.a.run.app"
  }
}
```
