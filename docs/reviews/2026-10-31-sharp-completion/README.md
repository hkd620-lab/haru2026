# #114 sharp 0.35 이행 실행 기록

- 판정 상태: ⚠️ 부분완료. **Node 22 검증은 이 세션에서 하지 못했다.** Node 22는 Linux Actions 결과로 확인해야 한다.
- 지시 원문: [prompt.md](prompt.md)
- 시작 HEAD: `a8a8a6b8b0e38464bbadbd683cb3a9319166eeae`
- 배포: 하지 않음. runtime·region·Rules·env·저장 경로 변경 없음.

## 1. 선택 버전

| 항목 | 이전 | 이행 |
|---|---|---|
| `sharp` | 0.34.5 | **0.35.5** (`npm view`의 0.35.x 최신, 2026-09-27 공개) |
| libvips 실측 | 8.17.3 | 8.18.7 |
| `@img/sharp-libvips-*` | 1.2.4 | 1.3.4 |
| `@emnapi/runtime` | 1.8.1 | 1.11.3 |
| `sharp` 하위 `semver` | 7.7.4 | 7.8.5 |

- 원래 PR #114의 0.35.0이 아니라 현행 안정판을 택했다. 원래 PR의 lock은 가져오지 않고 npm으로 새로 만들었다.
- `sharp` tarball integrity: `sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==`
- `@img/sharp-libvips-linux-x64@1.3.4` integrity는 lock과 `npm view` 값이 같다.
- lock 변경은 sharp 계열로 한정된다: [logs/lock-diff.patch](logs/lock-diff.patch)

### 근거의 한계

- 0.35.0 변경 내역은 `control/dependency-pr114.json`의 공식 릴리스 노트 사본으로 확인했다.
- **0.35.1~0.35.5의 공식 changelog와 보안 권고는 확인하지 못했다.** `gh api` 조회가 권한 거부되었다. "보안 수정 포함" 여부는 `확인 필요`다.
- `npm audit`(후보 lock): 전체 51건(low 3, moderate 29, high 18, critical 1). `sharp`·`@img/*` 항목은 0건이다. 다른 패키지의 기존 항목이며 이번 범위가 아니다: [logs/audit-candidate.json](logs/audit-candidate.json)

## 2. 전체 Functions 영향

- `functions/src/index.ts:12`가 최상위에서 `require('sharp')`를 한다. 네이티브 로딩이 실패하면 `lib/index.js`를 읽는 모든 함수가 기동하지 못한다.
- 제거된 API(`failOnError`, `paletteBitDepth`, `format.jp2k`, `sharpen` 구옵션) 사용은 소스에 없다.
- 0.35는 `sharp/package.json` 경로를 export하지 않는다. 제품 코드는 이 경로를 쓰지 않는다. 첫 시험 실패로 드러났고 시험만 `sharp.versions`로 고쳤다.
- 0.35의 `limitInputChannels` 기본값 5로 6채널 이상 입력은 `Input image exceeds channel limit`로 거부된다. 세 함수 모두 기존 catch가 받는다(타임라인은 이미지 없이 진행, 식물은 원본 사용, SNS는 해당 썸네일 생략).
- `functions/src` 변경 없음. 제품 코드 diff는 `functions/package.json`(의존성·시험 스크립트)과 lock뿐이다.

## 3. 대상 함수 경로와 시험 연결

`functions/test/sharpImagePipelines.test.js`는 합성 이미지만 쓴다. 체인 복제본이 실제 소스와 달라지면 실패하도록 소스 대조 시험을 두었다.

| 함수 | 현재 소스 | 체인 |
|---|---|---|
| `generateGrowthTimelinePdf` | `functions/src/index.ts:6927` (`prepareTimelinePdfImage`) | `.rotate().resize(cover).jpeg(84)` 후 pdfkit |
| `detectPlantAdvanced` | `functions/src/index.ts:12374` (`callPlantNetIdentification`) | `.rotate().jpeg(88)` |
| `analyzeFacebookZip` | `functions/src/snsAnalyzer.ts:207` | `.resize(400, withoutEnlargement).jpeg(75)` |

확인 항목: 리사이즈·최소 치수, EXIF 방향, 투명 PNG 평탄화, CMYK·Display P3·16비트 정규화, EXIF·GPS·ICC 제거, WebP·GIF·TIFF·AVIF 입력, HEIC·손상 입력 거부, 5·6채널 경계, PDF 삽입 후 재열기, `lib/index.js` cold load.

- HEIC는 헤더만 합성한 바이트로 **거부 경로**만 확인했다. 실제 HEVC HEIC 해독은 시험하지 않았다. `convertHeic`는 Cloudinary를 쓰며 sharp와 무관하다.
- HEIF 기본 프레임 변경은 다중 프레임 파일을 만들 수 없어 시험하지 못했다.
- SNS 썸네일은 `.rotate()`가 없어 EXIF 방향을 적용하지 않는다. 기존 동작이며 시험이 그대로 고정한다. 이번에 고치지 않았다.
- 체인을 복제해 돌리므로 callable 전체 흐름(인증·Storage·PlantNet 호출)은 시험하지 않았다.

## 4. 검증 결과

모두 macOS arm64, **Node v26.8.2, npm 11.19.1**이다. 지시한 Node 22가 아니므로 참고 근거다.

| 항목 | 결과 | 로그 |
|---|---|---|
| 0.34.5 기준 시험 | 13/13 통과 (5·6채널 시험 추가 전, 버전 표시 수정 전) | [log](logs/test-baseline-sharp-0.34.5-node26.txt) |
| 0.35.5 `npm ci` (`--ignore-scripts`) | 성공, `EBADENGINE` 경고 있음 | [log](logs/npm-ci-sharp-0.35.5-node26.txt) |
| 0.35.5 빌드 | 성공 | [log](logs/build-sharp-0.35.5-node26.txt) |
| 0.35.5 시험 최종 | **14/14 통과** | [log](logs/test-sharp-0.35.5-node26-final.txt) |
| 0.35.5 첫 시험 | 12/13, 위 `sharp/package.json` 시험 결함 | [log](logs/test-sharp-0.35.5-node26.txt) |
| export 목록 | 114개, 기준 대비 **차이 없음** | [baseline](logs/exports-baseline.txt) / [candidate](logs/exports-candidate.txt) |
| 기존 HEIC·SNS 썸네일 시험 4종 | 통과 | `logs/test-convert-heic-*`, `logs/test-sns-thumbnail-*` |

0.35.5 시험 파일은 5채널 시험을 위해 그 뒤에도 수정했다. 전 파일 최종본 기준 결과는 위 14/14이다.

## 5. Linux x64 Node 22 검증

`.github/workflows/functions-sharp-linux.yml`을 추가했다.

- 대상 경로 변경 PR 또는 수동 실행에서만 돈다. 비밀값 없음, 권한 `contents: read`.
- Node 22·linux·x64를 확인하고 실패하면 멈춘다. `npm ci`, Linux 네이티브 패키지 존재 확인, 빌드, 위 시험(cold load 포함)을 실행한다.
- 아직 실행되지 않았다. 수동 실행은 main에 워크플로가 있어야 하므로 PR 트리거로 돌린다. **부모가 PR 생성 후 결과를 확인해야 한다.**

## 6. 배포 대상과 롤백

- 배포 대상 3개(`asia-northeast3`): `generateGrowthTimelinePdf`, `detectPlantAdvanced`, `analyzeFacebookZip`
- **라이브 리비전·소스 SHA·배포 시각은 `확인 필요`다.** `gcloud functions list`가 권한 거부되었다. 부모가 배포 전에 세 함수의 revision과 이미지를 기록해야 하며, 그 값이 롤백 후보다.
- 롤백 소스 후보: `a8a8a6b8`(sharp 0.34.5, 현재 main). 이 커밋이 라이브와 같은지는 확인하지 못했다. 라이브가 더 오래되었다면 소스 재배포 롤백은 이번 범위 밖의 변경까지 되돌리거나 함께 내보낼 수 있다. 이전 Cloud Run revision으로 트래픽을 돌리는 방식을 우선한다.
- 소스 차이: 후보 대 main의 Functions 차이는 sharp 계열 lock과 `package.json`뿐이다. 다만 배포는 main 전체를 빌드하므로, 세 함수의 라이브와 main 사이의 다른 변경도 함께 나간다.

### 위험

1. 최상위 `require('sharp')`: Linux 로딩 실패 시 배포된 함수가 기동하지 못한다. Actions와 배포 직후 실측으로 확인한다.
2. 혼재 기간: 세 함수만 배포하면 다른 함수는 다음 배포까지 이전 sharp를 유지한다.
3. JPEG 바이트 변화: libvips가 바뀌어 재인코딩 결과가 달라질 수 있다. 치수·색 판정은 같고 합성 CMYK 파랑 값만 `27,60,141`→`28,59,139`로 달랐다.
4. 6채널 이상 입력 거부: 일반 사진에서는 드물다. 거부 시 위 catch 동작을 따른다.
5. `pdfkit`이 `package.json`의 직접 의존성이 아니고 `pdfmake` 경유로 쓰인다. 이번 변경과 무관한 기존 상태이며 고치지 않았다.
6. 추적 중인 `functions/lib/index.js`, `functions/lib/snsToDiary.js`는 소스보다 오래되어 빌드하면 2,300줄 이상 차이가 난다. 이번 변경과 무관해 커밋하지 않고 되돌렸다. `firebase.json`의 predeploy가 소스를 빌드하므로 배포 결과에는 영향이 없다.

## 7. 권한 거부 기록

우회하지 않았다. 아래 명령은 이 세션에서 실행되지 않았다.

| 명령 | 사유 | 영향 |
|---|---|---|
| `/opt/homebrew/opt/node@22/bin/node -v` 포함 복합 명령 | 승인 필요, 승인 수단 없음 | Node 22 미검증 |
| `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm view ...` | 변수 검사 불가 | 같은 조회를 기본 npm으로 수행 |
| `PATH=/opt/homebrew/opt/node@22/bin:/usr/bin:/bin node -v` | 승인 필요 | Node 22 미검증 |
| `gh api repos/lovell/sharp/releases ...` | 승인 필요 | 0.35.1~0.35.5 changelog 미확인 |
| `gh api /advisories?...` | 명령 조각으로 판정 | 보안 권고 미확인 |
| `gcloud functions list ...` | 승인 필요 | 라이브 리비전 미확인 |

## 8. 실행 명령

```text
npm view sharp@0.35 version engines --json
npm view sharp@0.35.5 dist.tarball dist.integrity optionalDependencies --json
npm view @img/sharp-libvips-linux-x64@1.3.4 version license dist.integrity
npm view sharp time --json
npm --prefix functions ci --ignore-scripts --no-audit --no-fund
npm --prefix functions run build
node --test functions/test/sharpImagePipelines.test.js
npm --prefix functions install sharp@^0.35.5 --ignore-scripts --no-audit --no-fund
npm --prefix functions audit --json
npm --prefix functions run test:convert-heic-behavior
npm --prefix functions run test:convert-heic-guard
npm --prefix functions run test:sns-thumbnail-privacy
npm --prefix functions run test:sns-thumbnail-cleanup
git diff --check
```
