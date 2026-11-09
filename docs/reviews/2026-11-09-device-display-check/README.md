# 2026-11-09 이 기기 알림 표시 시험 (draft)

## 목적

아이폰 알림 미수신의 원인을 "서버 → 기기 전달"과 "기기 안 표시"로 나눠 보기 위한 최소 기능이다.
기존 설정 화면에는 서버(FCM) 발송 시험(`sendTestNotification`)만 있어, 서버가 접수했는데 알림이 보이지 않을 때 어느 쪽 문제인지 구분할 수 없었다.

이 기능은 사용자가 버튼을 직접 눌렀을 때만, 이미 등록된 `firebase-messaging-sw.js` 서비스워커의 `registration.showNotification`으로 이 기기에 알림 표시를 요청한다. 서버 발송이 아니며, 서버 푸시 수신 확인도 아니다.

## 원인 상태: 미확정

- PR #363(기기 등록 UI), #364, #365(테스트 알림 함수 메모리 512MiB)는 각각 병합·배포됐다. 서버 메모리 문제는 해소됐다.
- 07:27 앱 열림(FG) 서버 시험: HTTP 200, 2 성공 / 2 실패, 어느 기기에서도 미수신.
- 07:45 백그라운드(BG): HTTP 200, 2 성공 / 0 실패, 미수신.
- iOS HARU 알림 허용·잠금화면·알림센터·배너·사운드 모두 ON 실측. 07:54 BG: HTTP 200, 2 성공 / 0 실패, 미수신.
- 집중 모드: 사용자가 켜져 있던 것을 확인하고 끈 뒤 07:54 시험을 했다고 **보고**했다. 제어 센터의 실제 활성 상태는 실측하지 않았다.
- 따라서 원인은 아직 확정되지 않았다. 앱 열림 상태의 서비스워커 문제만으로 설명할 수 없다.
- 독립 읽기 전용 진단 원문: `/private/tmp/haru-push-delivery-independent-diagnose-1.*`, 원격 브랜치 `codex-iphone-push-delivery-evidence-20261109`(f383fafd).
- 진단에서 제안된 서비스워커 선처리 변경은 이번 범위가 아니며 구현하지 않았다.
- 위 진단 내용과 사유는 새 제품 변경이나 배포에 대한 승인이 아니다.

## 변경

| 파일 | 내용 |
|---|---|
| `frontend/src/app/services/pushDevice.ts` | 순수 helper 추가: `requestDeviceDisplayTest`(의존성 주입, 결과 `requested`/`unsupported`/`permission`/`no-registration`/`failed`), `describeDeviceDisplayTestResult`(정적 안내 문구), `runDeviceDisplayTest`(busy 켜고 끄기, 진행 중 중복 클릭 무시, 예외 흡수). 제목 `HARU 기기 표시 시험`, 본문 `이 알림은 기기 표시만 확인합니다. 서버 푸시 수신 시험과는 다릅니다.`, tag `haru-device-display-test`(기존 `haru-notification`과 분리), 아이콘·배지는 기존 `FOREGROUND_NOTIFICATION_OPTIONS` 값 그대로 사용 |
| `frontend/src/app/services/notificationService.ts` | `findActiveFcmSwRegistration`(기존 registration 목록에서 active `firebase-messaging-sw.js`만 찾음, 없으면 새로 등록하지 않음)와 `requestThisDeviceDisplayTest` 추가. 기존 `getFcmSwRegistration`은 없으면 등록하므로 이 시험에는 쓰지 않음 |
| `frontend/src/app/pages/SettingsPage.tsx` | 기존 "내 기기에 테스트 알림 보내기" 아래에 점선으로 구분한 "이 기기 알림 표시 시험" 버튼, 설명, 결과 문구 추가. 클릭으로만 실행, 진행 중 비활성화. 중복 클릭 guard는 값을 직접 바꾸는 imperative 값이므로 `useRef({ running: false })`로 두고 `.current`를 넘긴다(root 검토 반영, 처음 초안의 `useState(() => ({ running: false }))`에서 변경) |
| `frontend/test/deviceDisplayTest.test.mjs` | 신규 시험 9개 |

성공 문구: "표시 요청이 완료됐습니다. 실제 알림이 왔는지 확인해 주세요. 서버 푸시 수신 확인은 아닙니다." `requested`는 `showNotification` 요청이 오류 없이 끝났다는 뜻일 뿐, 실제로 화면에 표시됐다는 보장이 아니다. 성공 문구 색은 서버 성공(초록)과 섞이지 않도록 회색이다.

오류 문구는 권한 미허용 / 알림 준비(등록) 필요 / 미지원 / 표시 요청 실패의 정적 안내만 보이며, 예외 원문·payload·토큰·UID를 로그로 남기거나 화면에 노출하지 않는다.

하지 않은 것: 권한 요청 팝업, 서비스워커 신규 등록·갱신·해제, 푸시 구독 변경, `getToken`/토큰 재발급, `getMessaging`, 서버(Functions) 호출, Firestore 읽기·쓰기, 캐시 삭제, 자동 실행. 기존 기기 등록·서버 발송 시험 코드는 그대로 두었다.

## 최소 검증

시험 명령(frontend): `node --import tsx --test test/deviceDisplayTest.test.mjs test/pushDevice.test.mjs test/pushDeviceRejection.regression.test.mjs` — 신규 9 + 기존 26 = 35개.

시험 범위: 서버 호출 없음 / 권한 요청 함수 없음 / 권한 default·denied면 SW 조회·표시 안 함 / SW 없으면 새로 등록하지 않음 / 토큰·저장 의존성 없음 / 별도 tag, 기존 아이콘 / 실패 구분과 정적 문구 / busy 복구, 중복 클릭 무시, 예외 흡수 / 화면 연결(클릭으로만 실행, 서버 발송 핸들러와 분리). guard를 `useRef`로 바꾼 것은 구현을 그대로 옮긴 시험이 되므로 새 시험을 더하지 않았고, 위 35개 회귀로만 확인한다.

실행 이력(시점별로 나눔):

1. **CC 1차 실행(초안 작성)**: Node v26.8.2로 35개 통과, 실패 0. 이 세션에서 아래 3건은 권한이 자동 거부돼 실행되지 않았다(원문은 `raw/haru-device-display-check-cc-1.raw.json`의 `permission_denials`).
   - 기존 시험·Node 경로 확인용 복합 명령(`ls … | head; grep …; which -a node`)
   - `ls /Users/heogyeongdae/.nvm/versions/node/` (Node 22 경로 확인)
   - 자리값 env를 넣은 `npm run build`
2. **root 재시험(useRef 보완 전 소스)**: `/private/tmp/haru-device-display-check-verify.sh`, Node v22.23.2. 로그 `raw/haru-device-display-check-verify.log`.
   - 관련 35개 pass 35 / fail 0, `tests_exit=0`.
   - 합성 자리값 env로 `npm run build`, `build_exit=0`. 실제 배포값이 아니며 배포하지 않았다.
   - runner는 `set -u`이고 출력을 `tee`로 넘기므로 runner 프로세스의 종료 코드 0만으로는 통과라고 볼 수 없다. 위 두 결과는 로그의 개별 `tests_exit`·`build_exit` 줄로 확인했다.
   - `functions/node_modules`가 없어 runner 안의 tsc 단계는 실행되지 않았다("tsc 없음" 출력). 또 이 단계의 `changed_files_tsc_errors=0`은 grep에 걸리는 줄이 없을 때도 찍히므로 구문 오류에 가려질 수 있어 **타입 검사 성공 근거로 쓰지 않는다.**
3. **CC 2차 실행(useRef 보완)**: 보완한 소스에서 Node v22.23.2로 같은 35개를 돌려 pass 35 / fail 0을 봤다. 참고용이며, 빌드는 이 세션에서 돌리지 않았다. 이 세션에서도 권한 자동 거부가 3건 있었다. 시험 파일 grep과 `python3`로 1차 raw를 요약하는 복합 명령, `$?`가 들어간 폴더 생성+`cp -p` 명령, 옵션 `-p`를 붙인 `cp`다. 각각 Grep 도구, node 단독 폴더 생성, 옵션 없는 `cp`로 나눠 다시 실행했다. 제품 코드와 시험 결과에는 영향이 없다.
4. **root 최종 재시험(예정)**: 보완한 최종 소스에서 Node 22 시험과 build를 root가 다시 실행한다. **이 결과가 나오기 전에는 최종 소스의 build 통과를 주장하지 않는다.**

타입 검사:
- root가 `pushDevice.ts` 하나만 tsc strict로 따로 검사한다. 종료 코드 확인은 아직 남아 있다.
- 저장소 전체 `tsc`는 기존 `ExportModal.tsx` 구문 오류 때문에 통과하지 않는다. 이번에 고치지 않았고, 전체 타입 검사가 통과했다고 주장하지 않는다.

## 근거 원문 (`raw/`)

`/private/tmp`의 원본을 옵션 없이 `cp`로 복사했고, 원본과 바이트를 비교하고 SHA-256을 대조해 모두 일치했다. 파일 끝 빈 줄을 포함해 원문을 고치지 않았다.

| 파일 | 바이트 | SHA-256 |
|---|---|---|
| `haru-device-display-check-cc-1.prompt.txt` | 4593 | `4ee1cf7a53b38b02d851d5b1bd18088a4514ace9e6afc885013cbd5999cb0535` |
| `haru-device-display-check-cc-1.raw.json` | 7700 | `ddf86c128ba50cf477d792548e113a07ac4cb8caab517a5b1bbc9ae7cc28012f` |
| `haru-device-display-check-cc-1.meta.json` | 859 | `a91c56a5c9faf4e5b037574dcd169bf67348cb144967c16289f28659653d9e7d` |
| `haru-device-display-check-cc-1.err.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `haru-device-display-check-verify.log` (root 재시험, 보완 전 소스) | 19202 | `09a853c8758b20807d0132eb45ca0bce9eb6e5624bd43a70665c5946a02c4cbf` |
| `haru-device-display-check-verify.sh` (실제 실행한 runner) | 1679 | `82fe640adb150aac1087a40906f3dd33d66453d859122d1140f1ca049f6f7f34` |

CC 2차 실행의 prompt/raw/meta/err는 이 문서를 쓰는 시점에 실행 중이어서 넣지 않았다(raw 0바이트는 실패가 아니라 진행 중이라는 뜻이다). root가 끝난 뒤 보존한다.

## 데이터·비용·인증

- Firestore 경로·Rules·Functions·리전·env·결제·인증·AI 모델: 변경 없음.
- 서버 호출이 없어 Functions·FCM 비용이 생기지 않는다.

## 배포와 되돌리기

- 사용자에게 보이려면 새 Hosting 배포가 필요하며, **현재 배포 승인은 없다.** draft PR까지만 준비한다.
- 되돌리기: 배포 후 문제가 생기면 이전 main Hosting으로 되돌린다. 되돌리기도 별도 승인이 필요하다.

## 남은 일

- root: 최종 소스로 Node 22.23.2 시험·`npm run build` 재실행, `pushDevice.ts` strict tsc 종료 코드 확인, CC 2차 실행 원문 보존, 기계 stage/commit/push, draft PR.
- Codex 자동 리뷰와 독립 검토(자가 승인 아님).
- 배포 승인 후 실제 아이폰 E2E: 홈 화면 PWA에서 버튼 → 알림이 실제로 보이는지 사람이 확인. 표시되면 기기 표시 경로는 정상이므로 서버→기기 전달 쪽을 본다. 표시되지 않으면 기기 표시 경로부터 본다. 이 시험은 아직 하지 않았다.
