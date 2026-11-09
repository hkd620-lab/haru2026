# 보충 1: 현재 상태 (README 이후)

`README.md`는 CC 1차 작성 시점(root 최종 재시험·CC 2차 원문 보존 전)의 기록이다. 원문 보존(append-only) 원칙에 따라 README는 고치지 않고, 현재 상태는 이 문서에 적는다. **README와 이 문서가 다르면 이 문서가 최신이다.**

README에서 지금은 맞지 않는 부분:
- "4. root 최종 재시험(예정)" → 끝났다(아래 "현재 검증 상태").
- "strict tsc 종료 코드 확인은 아직 남아 있다" → exit 0으로 끝났다.
- "CC 2차 실행의 prompt/raw/meta/err는 … 넣지 않았다" → 커밋 `ad869b04`에 보존돼 있다.
- SHA 표 6개 → 실제 raw는 12개였고, 이번 독립 1차 원문 4개를 더해 16개다. JSON 2개도 있다(아래 manifest).
- "남은 일"의 root 항목 → 대부분 끝났다(아래 "완료/남은 일").

독립 1차 판정(수정 후 승인, 1회째)과 반영 위치는 `INDEPENDENT-REVIEW-1.md`에 있다.

## 현재 검증 상태

근거: `FINAL-VALIDATION.json`, `raw/haru-device-display-check-verify-final.log`(1행 `== node: v22.23.2`, 215~218행 `# tests 35`/`# pass 35`/`# fail 0`, 223행 `tests_exit=0`, 316행 `build_exit=0`).

- **최종 소스 시험:** Node 22.23.2, 관련 35개 중 35개 통과, 실패 0, `tests_exit=0`.
- **최종 소스 빌드:** `npm run build` `build_exit=0`. 합성 자리값 env로 만든 빌드다. 실제 배포값이 아니며, 이 빌드 산출물(`dist`)은 배포하지 않는다.
- **타입 검사, 범위가 좁다:**
  - `frontend/src/app/services/pushDevice.ts` 하나만 strict tsc exit 0. 정확한 명령은 `RAW-LOG-WHITESPACE.json`의 `standaloneHelperStrictCommand`:
    ```text
    /opt/homebrew/opt/node@22/bin/node /private/tmp/haru-pending-major-deps-20261109/functions/node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM frontend/src/app/services/pushDevice.ts
    ```
  - `notificationService.ts`와 `SettingsPage.tsx`는 어떤 compiler로도 타입 검사를 받지 않았다. Vite build는 타입을 검사하지 않으므로 `build_exit=0`은 타입 검사 통과가 아니다.
  - 최종 runner의 tsc 단계는 `functions/node_modules`가 없어 실행되지 않았다(로그 318행 "tsc 없음"). 이 단계의 0은 근거로 쓰지 않는다.
  - 전체 앱 tsc는 기존 `ExportModal.tsx` 구문 오류로 통과하지 않는다. 이번에 고치지 않았다.
- **소스 SHA:** HEAD의 4개 소스 SHA-256은 `FINAL-VALIDATION.json`의 `sourceHashes`와 같다(이번에 다시 계산해 확인).

### 원문 로그 후행 공백

전체 staged `git diff --check`는 exit 2, 코드(frontend)만 검사하면 exit 0이다(`RAW-LOG-WHITESPACE.json`). 독립 1차 검토자는 이 예외를 받아들였다. 판정 원문 그대로:

> - **후행 공백 예외: 받아들입니다.**
>   - 코드만 검사한 `git diff --check f38e0ddc..HEAD -- frontend`는 exit 0임을 직접 확인했습니다.
>   - 전체 diff의 exit 2는 보존한 Vite 원문 로그 2개의 255·285행, 4곳뿐입니다.
>   - 원문 바이트와 SHA 보존이 우선이므로 고치지 않는 것이 맞습니다.
>   - 코드 영역의 필수 검증은 build와 테스트이고, 이것은 충족됐습니다.

이번에 추가한 문서 2개와 원문 4개는 이 예외를 바꾸지 않는다. 후행 공백이 있는 곳은 여전히 위 로그 2개뿐이다.

### 빌드 환경

`frontend/node_modules`는 `/private/tmp/haru-complete-pending-20261109/frontend/node_modules`를 가리키는 링크다(커밋 대상 아님). 그쪽 `frontend/package.json`·`frontend/package-lock.json`이 이 브랜치의 두 파일과 바이트 단위로 같음을 `cmp`로 확인했다. 그래서 재사용했다.

## 파일 manifest (파일 바이트 SHA-256)

경로는 이 폴더 기준이다. 모두 이번에 다시 계산했다. raw 16개 = 기존 12개 + 독립 1차 원문 4개. README 표(6개)에 없던 것은 `ad869b04`에 이미 있던 8개(cc-2 4개, verify-final 2개, JSON 2개)와 이번에 추가한 독립 1차 원문 4개다.

| 파일 | 바이트 | SHA-256 | README 표 |
|---|---|---|---|
| `raw/haru-device-display-check-cc-1.prompt.txt` | 4593 | `4ee1cf7a53b38b02d851d5b1bd18088a4514ace9e6afc885013cbd5999cb0535` | 있음 |
| `raw/haru-device-display-check-cc-1.raw.json` | 7700 | `ddf86c128ba50cf477d792548e113a07ac4cb8caab517a5b1bbc9ae7cc28012f` | 있음 |
| `raw/haru-device-display-check-cc-1.meta.json` | 859 | `a91c56a5c9faf4e5b037574dcd169bf67348cb144967c16289f28659653d9e7d` | 있음 |
| `raw/haru-device-display-check-cc-1.err.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 있음 |
| `raw/haru-device-display-check-verify.log` | 19202 | `09a853c8758b20807d0132eb45ca0bce9eb6e5624bd43a70665c5946a02c4cbf` | 있음 |
| `raw/haru-device-display-check-verify.sh` | 1679 | `82fe640adb150aac1087a40906f3dd33d66453d859122d1140f1ca049f6f7f34` | 있음 |
| `raw/haru-device-display-check-cc-2.prompt.txt` | 1906 | `b2cd9bfe37023abd1397a0d1e047954bdaf6de67ab90b54b5f7d5c847e5b5eba` | 없음 |
| `raw/haru-device-display-check-cc-2.raw.json` | 7143 | `a1e99b1a0a5cea95cf9a36732c1b6ee3946dc96764cdb2007bf1e10abdb839aa` | 없음 |
| `raw/haru-device-display-check-cc-2.meta.json` | 859 | `df985fccef1416409b53332deb29af00e5e17a55ec20473606a2c18a13c00449` | 없음 |
| `raw/haru-device-display-check-cc-2.err.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 없음 |
| `raw/haru-device-display-check-verify-final.log` | 19196 | `c48f82f31a9358b094bf418981bf9c48ae0e9bdf5326972edd8c2bbdcad6e05e` | 없음 |
| `raw/haru-device-display-check-verify-final.sh` | 1685 | `4c006e7015ea2d5a2a745649106fa9d44d97f6176ed607f65c791315863a8e89` | 없음 |
| `raw/haru-device-display-independent-first.prompt.txt` | 2229 | `08e36f3cde62aef68e202f93728fdd1cf893292d43a80dc0941a57a3e4c1da6b` | 없음(이번 추가) |
| `raw/haru-device-display-independent-first.raw.json` | 9382 | `2c7c7b9e4f7fac974727421e3500af6fcdb2934fcc5b5d6b65384e253ae28916` | 없음(이번 추가) |
| `raw/haru-device-display-independent-first.meta.json` | 678 | `3d0a176563241db91191cfe5c91995fdf7ac872050e452662abbea7d6801dd31` | 없음(이번 추가) |
| `raw/haru-device-display-independent-first.err.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 없음(이번 추가) |
| `FINAL-VALIDATION.json` | 1533 | `d038c42f910ff888e3b24c8096a565bb931f0ce1c0bd0ab277a441000003c70d` | 없음 |
| `RAW-LOG-WHITESPACE.json` | 1090 | `bb611868f3f388875d6652c3dd5431c9ebd85e1196d338c5efea7e23840a5c4a` | 없음 |
| `README.md` (수정하지 않음) | 9898 | `794de89c370d88bb2e2187a67afbdeb2232edf7e9565a4a96f7cc39158df0439` | — |
| `INDEPENDENT-REVIEW-1.md` (이번 추가) | 6433 | `526829c275f71782336ae8e8d50bc0d194ae48052c1fddeaf2edeb0b2f97d825` | — |

- cc-2 4개와 verify-final 2개는 `ad869b04`에 이미 들어 있고, `/private/tmp` 원본과 바이트가 같다(`FINAL-VALIDATION.json` `rawCopies`, 독립 1차 검토자도 `cmp`로 확인).
- 독립 1차 4개는 이번에 옵션 없는 `cp`로 복사했고, `/private/tmp` 원본과 `cmp`로 같음을 확인했다. SHA-256도 원본과 같다.
- 0바이트 `err.log` 3개는 실패가 아니다. 세 실행 모두 meta 종료 코드가 0이다.

## 폰 E2E 판독 기준 (아직 하지 않음)

독립 1차 권고를 문서로만 반영했다. 제품 코드는 바꾸지 않았다.

- **배너만으로 판정하지 않는다.** 버튼은 앱이 열린 상태에서만 누를 수 있다. 앱이 열려 있을 때 iOS가 알림을 어떻게 보여주는지는 확인하지 못했다. 배너가 안 떠도 표시됐을 수 있으므로 **알림센터와 잠금화면을 함께 확인해 기록**한다. "안 보임"을 곧바로 기기 표시 경로 문제로 단정하지 않는다.
- **반복 시험 주의.** tag가 `haru-device-display-test`로 고정이고 `renotify`가 없다. 같은 기기에서 두 번째 시험부터는 소리·배너 없이 기존 알림만 바뀔 수 있다(독립 1차 검토자가 Android Chromium 계열에서 가능하다고 지적. 이번에 실측하지 않음). 반복할 때는 이전 시험 알림을 지운 뒤 누르거나, 결과를 알림센터에서 확인한다.
- **알림을 누르면** 기존 서비스워커(`frontend/public/firebase-messaging-sw.js`)의 클릭 처리대로 `/record`(기록 화면)가 열린다. 시험용 동작이 따로 있지 않다.
- 아이콘·배지는 현재 운영 아이콘 경로를 그대로 쓴다(`FOREGROUND_NOTIFICATION_OPTIONS`).

## 배포 승인 요청 때 알릴 점

- 버튼은 관리자 전용이 아니다. **알림을 켠 일반 사용자 모두에게 보인다.** 기존 서버 시험 버튼과 같은 노출 방식이다.
- 사용자에게 보이려면 새 Hosting 배포가 필요하다. 허대표님 명시 승인 전까지 draft로 둔다. 기존 승인은 PR364/365 병합과 Functions 2건 배포뿐이다.

## 원인 상태: 미확정 (그대로 유지)

- 사용자 보고 조건 3회(앱 열림 FG 07:27, 백그라운드 BG 07:45, 집중 모드를 끈 뒤 BG 07:54) 모두 미수신. 서버는 HTTP 200으로 접수했다.
- 집중 모드를 끈 것은 사용자 보고이고, 제어 센터의 실제 상태는 실측하지 않았다.
- 별도로, 사용자가 집중 모드 허용 앱에 포도 HARU를 직접 추가하도록 요청받아 root가 UI를 확인하는 중이다. 결과는 아직 없다. 이 문서는 그 결과를 적지 않는다.
- 이 PR이 승인돼도 폰 E2E 실수신은 끝나지 않은 일이다.

## 완료 / 남은 일

완료:
- CC 2차 원문(prompt/raw/meta/err) 보존 — `ad869b04`.
- 최종 소스 Node 22.23.2 시험 35/35(`tests_exit=0`)과 합성 자리값 env 빌드(`build_exit=0`) — root, `verify-final.*`.
- `pushDevice.ts` 단독 strict tsc exit 0 — root.
- 독립 1차 검토(수정 후 승인, 1회째) 원문 보존과 필수·권고 문서 반영 — 이 문서와 `INDEPENDENT-REVIEW-1.md`(커밋·push 전).

남은 일:
- 이 보충 반영분의 커밋·push(root 기계 실행).
- Codex 재리뷰. Codex 1차(root 전달값): 요청 `6735680546` 08:33:36Z, target `ad869b04`, 결과 `6735702385` 08:34:57Z 지적 0. summary `6735686462`의 완료 시각은 root가 후속 색인 예정.
- 독립 재검토(판정 원문과 반영 diff 함께 전달).
- 최신 HEAD의 최종 CI 확인.
- 허대표님 승인(main 병합·새 Hosting 배포).
- 배포 후 폰에서 이 기기 표시 시험 E2E(위 판독 기준). 아직 하지 않았다.
