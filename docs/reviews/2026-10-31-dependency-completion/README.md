# 2026-10-31 오래된 의존성 PR 완료 후보 기록

- 브랜치: `codex/completion-dependencies`, 기준 `origin/main` `693af514`
- 제품 커밋: `b5f4016b`(프론트), `b6ae8a0b`(Functions)
- 상태: **검토 가능한 후보**. push·PR·병합·배포·외부 메시지 없음. 8.1절 판정①(PR CI·Codex·독립 검토자)은 아직 시작 전이다.
- 라이브 데이터 호출 없음. 빌드 산출물은 더미 env로 만든 것이며 배포 금지.

## 1. 대상 6건 결과

레지스트리 `npm view`의 integrity와 tarball이 아래 값과 PR 패치에 모두 일치했고, `npm ci --ignore-scripts`도 통과했다.

| PR | 영역 | 변경 | 설치 경로 | 운영 도달 |
|---|---|---|---|---|
| #97 | frontend | `react-router`·`react-router-dom` 최소선언 `^7.13.x`→`^7.18.1`(manifest·lock 루트). 잠긴 버전 7.18.1 유지, 구PR 목표 7.18.0으로 내리지 않음 | 직접 의존성 | 버전 변화 없음 |
| #120 | frontend | `fast-uri` 3.1.4→3.1.5 | `vite-plugin-pwa`→`workbox-build`→`ajv` (dev) | 없음 |
| #122 | frontend | `postcss` 8.5.15→8.5.26, 필수 동반 `nanoid` 3.3.12→3.3.17 | `vite`→`postcss`→`nanoid` (dev) | 없음(CSS 산출물 동일) |
| #123 | frontend | `dompurify` 3.4.12→3.4.13 | `jspdf` 선택 의존성 | 없음. `src`에 `jspdf`·`dompurify` 사용 0건, `dist` 766개 js/html 검색 0건 |
| #121 | functions | `brace-expansion` 2.1.2→2.1.4, `test-exclude` 하위 1.1.16→1.1.18 | 2.x: `google-gax`→`rimraf`→`glob`→`minimatch`, `ejs`→`jake`→`filelist`→`minimatch` / 1.x: `jest` 계열 dev | 없음(2절) |
| #125 | functions | `ip-address` 10.2.0→10.5.0 | `puppeteer`→`@puppeteer/browsers`→`proxy-agent`→`socks-proxy-agent`→`socks` | 런타임 없음(2절) |

결정 사항:

- **#122 nanoid 포함**: `postcss@8.5.26`이 `nanoid ^3.3.17`을 요구한다. 무관한 추가가 아니라 필수 동반이다.
- **#121 1.x**: 원 PR 교체 범위가 1.1.16→1.1.18이고 1.1.16에 high 권고(`<1.1.17`, `<1.1.18`)가 있어 반영했다. `test-exclude`의 `minimatch@3`이 `^1.1.7`을 요구하므로 1.x 계열은 그대로 유지된다. 엔트리를 그대로 두는 뜻의 "보존"이었다면 4절의 방법으로 이 3줄만 되돌린다.
- **#125 prepare 스크립트**: 10.5.0에 추가된 `prepare`는 레지스트리 tarball 설치 시 실행되지 않고, 실제 코드 의존성도 추가되지 않았다.
- 현재 main이 이미 목표를 넘은 항목은 없었다. `overrides`·저장소 구조·다른 의존성 변경 없음.
- `frontend` lock의 `filelist/brace-expansion` 2.1.2는 대상 밖이라 두었다.

## 2. Functions 영향과 배포 목록

`reachability.cjs`로 `functions/lib/*.js`에서 require·import를 정적으로 추적했다. 의존성 코드를 실행하지 않았고 파일 3,792개·패키지 201개를 방문했다.

- `ip-address`, `socks`, `puppeteer`, `brace-expansion`, `minimatch`: **도달 0건**(패치 전후 동일). `functions/src`에는 `puppeteer` 문자열 자체가 없다.
- `ejs`는 `epub-gen-memory`로 도달하지만 `jake`는 `ejs/bin/cli.js`만 사용하고 런타임 라이브러리는 쓰지 않는다. `google-gax`도 도달하지만 `rimraf`까지 가지 않는다.
- 미해결 지정자는 예시·문자열 조각, sharp 플랫폼 와일드카드, 선택 패키지뿐이며 대상과 무관하다.
- 한계: 정적 분석이라 변수로 만든 `require`는 볼 수 없다. Cloud Build가 설치 스크립트를 실행하면 `puppeteer` 설치 단계에서 `ip-address`가 빌드 시점에 쓰일 수 있으나 함수 런타임과는 별개다.

**필요한 Functions 배포 목록: 없음(0개).** runtime 변경을 받는 함수가 없다. 이 lock은 이후 다른 사유의 명시 배포 때 함께 반영된다. 전체 배포는 하지 않는다.

**Hosting**: main 병합 시 자동 배포가 돌지만, 더미 env 빌드 기준 전후 797개 파일 SHA-256이 모두 같아(추가·삭제·수정 0) 사용자 코드 변화는 없다.

## 3. 검증

실행 환경은 macOS, Node v26.8.2, npm 11.19.1이다. 저장소 기준인 Node 22에서는 실행하지 않았다(`EBADENGINE` 경고는 이 차이에서 나온 것).

| 검증 | 패치 전 | 패치 후 |
|---|---|---|
| frontend `npm ci --ignore-scripts` | 통과 | 통과 |
| functions `npm ci --ignore-scripts` | 통과 | 통과 |
| frontend `npm run build`(더미 env) | 통과, 3,558 모듈 | 통과, 3,558 모듈, 산출물 동일 |
| functions `npm run build` | 통과 | 통과 |
| `test:epub-content` | 8/8 | 8/8 |
| `test:ai-gateway` | 16/16 | 16/16 |
| `test:convert-heic-behavior` | 통과 | 통과 |
| frontend 라우터 사용 등 5개 파일(`householdSummary`, `structuredAssistantRecords`, `originalAssistantRecords`, `recordStats`, `readingAi`) | 96/96 | 96/96 |
| 컴파일 export([전](exports-before.txt)·[후](exports-after.txt)) | 114 | 114, 추가·삭제 0 |

기존 실패와 구분:

- 위 실행 범위에서 패치 전후 **실패 0건**이라 기존 실패도 신규 실패도 없다.
- **기존 드리프트**: 추적 중인 `functions/lib`가 소스보다 오래되어 빌드하면 `index.js`·`snsToDiary.js`가 크게 바뀐다(HEAD에서도 동일). 이번 변경과 무관해 커밋하지 않고 검증 뒤 HEAD로 되돌렸다. 배포는 `firebase.json` predeploy가 다시 빌드한다.
- **실행하지 못한 것**: functions 비에뮬레이터 40개 일괄 회귀는 도구 권한 승인 필요로 거부되어 실행하지 못했다. 위 `test:*` 스크립트로 한정했다. 런타임 도달이 없는 변경이라 영향은 작지만 독립 검토자가 범위를 판단해야 한다.
- **의도적으로 제외**: emulator·`resultChat.integration` 시험(라이브·에뮬레이터 의존), 실기기 E2E.

## 4. 남은 권고와 되돌리기

지시된 목표 버전으로 올렸지만 audit 권고가 전부 사라지지는 않았다. 목표를 넘겨 올리지 않았다.

- audit 합계: frontend 26→25(high 13→12), functions 52→52(high 20→19, moderate 28→29, `ip-address`가 high→moderate).
- 해소: `postcss`(권고 없음), `fast-uri` GHSA-7p8r-x3mc-p8w7, `brace-expansion` GHSA-mh99-v99m-4gvg·GHSA-rgw5-rvv9-x895, `ip-address` high GHSA-mwp4-54f8-5fhr.

| 패키지 | 현재 | 남은 권고 | 실제 노출 |
|---|---|---|---|
| `dompurify` | 3.4.13 | critical GHSA-cg2g-xh64-v4q7 등, `<=3.4.16` 범위 | `dist`에 없음 |
| `react-router` | 7.18.1 | high GHSA-qwww-vcr4-c8h2, `<7.18.2`, RSC 모드 CSRF | 앱은 `BrowserRouter` 클라이언트 라우팅, RSC 미사용 |
| `fast-uri` | 3.1.5 | high 다수, `<3.1.6`~`<3.1.9` | 빌드 도구 경로 |
| `nanoid` | 3.3.17 | high GHSA-2v37-7h3g-55p8, `<3.3.18` | 빌드 도구 경로 |
| `brace-expansion` | 2.1.4 / 1.1.18 | high 2건, moderate 1건, `<2.1.7`·`<1.1.21` | 런타임 도달 없음 |
| `ip-address` | 10.5.0 | moderate 5건, `<=10.7.3` | 런타임 도달 없음 |

되돌리기:

- 전체: `git revert b6ae8a0b b5f4016b`. 병합 뒤라면 revert PR.
- #121 1.x만: `functions/package-lock.json`의 `node_modules/test-exclude/node_modules/brace-expansion` version·resolved·integrity 3줄을 1.1.16 값으로 복구.
- 운영 되돌리기는 필요 없다. Functions 배포 0개이고 Hosting 산출물이 같다.

## 5. 수정하지 않은 3건 — 설계 필요, 완료 아님

### #96 Vite 6→8·plugin 메이저 묶음

- 현재: `vite` 6.4.3, `plugin-react` 4.7.0, `plugin-legacy` ^6.1.1, `@tailwindcss/vite`·`tailwindcss` 4.1.12, `vite-plugin-pwa` ^1.2.0. PR 기준은 vite 6.4.2라 그대로 적용 불가.
- 위험: `vite@8.0.16` 레지스트리 의존성은 `rolldown` 1.0.3과 `lightningcss`로 바뀐다. `vite.config.ts`의 `legacy({ targets: ['ios >= 13'] })` 산출물과 PWA precache가 달라질 수 있다. 빌드 통과만으로 옛 iOS 동작을 보장할 수 없다.
- 필요 이관: Vite·plugin 4종 동시 상향, `pnpm.overrides`의 `vite` 6.4.3 갱신, PR 목록에 없는 `tailwindcss` 본체와의 버전 정렬 확인, Node `^20.19 || >=22.12` 확인.
- 검증 조건: 전후 번들 비교, legacy chunk, 서비스워커, iOS 실기기 E2E.
- 영향: Hosting 전체, Functions 없음. Vite 6.4.3에도 audit high 권고가 있어 별도 판단이 필요하다.

### #116 react-router 7→8 단독

- 현재: 둘 다 7.18.1. PR은 `react-router`만 ^8.3.0으로 올려 `react-router-dom`의 7.18.1이 중첩 설치된다.
- 정확한 위험: `App.tsx`의 `BrowserRouter`·`Routes`는 `react-router-dom`(7, 총 68개 파일이 사용)에서, `Layout.tsx`·`ProtectedRoute.tsx` 등 39개 파일은 `react-router`(8)에서 가져온다. 패키지가 둘로 갈리면 라우터 컨텍스트가 분리되어 `useNavigate` 등이 실패할 수 있다. 빌드는 통과해도 런타임에서 깨질 수 있어 단독 병합 금지.
- 필요 이관: `react-router` 8은 `react`·`react-dom` `>=19.2.7`과 Node `>=22.22.0`을 요구한다. 현재 React는 18.3.1이므로 React 19 이관이 선행이다. 이어서 import를 한 패키지로 통일한다.
- 영향: `App.tsx`와 라우터 import 파일 전체. **라우터 변경은 8.1 멈춤 조건이며 이번 완료 지시의 승인 범위가 아니다.** Functions 없음.

### #114 sharp 0.34→0.35

- 현재: `^0.34.5`. PR은 sharp·`@img/*`·libvips 1.3.0·`semver`·`@emnapi/runtime`을 함께 바꾼다.
- 정확한 위험: 네이티브 바이너리 교체(libvips 8.18.3). `functions/src/index.ts:12`가 최상위에서 `require('sharp')`를 하므로 로딩 실패 시 `index.js`를 읽는 **함수 전체**가 기동 불가다. 재인코딩 JPEG 바이트도 달라질 수 있다.
- API 영향: 제거·개명된 `failOnError`, `paletteBitDepth`, `format.jp2k`, `sharpen` 구옵션 사용 0건. Node 22는 `>=20.9` 충족. 새 기본값 `limitInputChannels=5`와 HEIF 기본 프레임 변경은 실제 입력으로 확인이 필요하다.
- 직접 사용 함수 3개:
  - `generateGrowthTimelinePdf` — `functions/src/index.ts:7015`, `.rotate().resize().jpeg()`
  - `detectPlantAdvanced` — `functions/src/index.ts:12462`, PlantNet 전 JPEG 정규화
  - `analyzeFacebookZip` — `functions/src/snsAnalyzer.ts:207`, 사진 축소
- 필요 이관: Linux x64 glibc·Node 22 로딩 확인, 샘플 이미지 전후 비교, 위 3개 명시 배포 후 `gcloud functions list` 실측. 다른 함수는 다음 배포 전까지 기존 sharp를 유지하므로 혼재 기간을 설계에 포함한다.
