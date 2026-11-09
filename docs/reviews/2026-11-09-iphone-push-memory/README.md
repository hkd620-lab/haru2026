# 2026-11-09 아이폰 테스트 알림 sendTestNotification 메모리 한도 초과 대응

- 작성: CC 실행자 (2026-11-09)
- 브랜치: `codex/iphone-push-memory-20261109` (기반 `origin/main` `6723b5d4`, PR #363 병합 커밋)
- 코드 커밋: `0d1f4315` — `functions/src/index.ts` 1줄
- 상태: **draft PR. 운영 배포·ready 전환·merge 하지 않음** (비용 증가 변경 → 8.1 멈춤 조건, 허대표님 승인 필요)

## 1. 요청 원문 (root → CC 실행자)

> CC 실행자: 사용자 현재 지시는 아이폰 알림 미수신 원인부터 해결하고 남은3건 모두완료입니다. 웹 PR363은 merged6723b5d4/Hosting42561502300성공. 아이폰실기기 새UI등록완료후 본인기기테스트1회에서 sendTestNotification HTTP500발생. 운영로그안전추출로 원인확정: 2026-11-09T04:25:27.236234Z 'Memory limit of 256 MiB exceeded with 259 MiB used'. 이외토큰/UID/개인정보원문을읽거나보존하지마세요. gcloud실측 현재 sendTestNotification nodejs22/asia-northeast3/memory256Mi/CPU1/timeout60/revision sendtestnotification-00130-tah/update2026-09-12T12:38:45.673214178Z.
> 새cwd /private/tmp/haru-push-memory-20261109 branch codex/iphone-push-memory-20261109/main6723기반. canonicalAGENTS/CLAUDE/Slack8.1/9.1읽고준수. 다른worktree/PR364/원본기존변경절대수정/삭제금지.
> 최소수정: functions/src/index.ts sendTestNotification의 onCall options에 memory:'512MiB'만추가. region같음. CPU/timeout/동작/대상/인증/토큰정리/요금정책/Rules/모델/AI호출/다른함수옵션변경금지. global/setGlobalOptions절대변경금지. 이함수1개만512로하면실측259Mi초과가한도안으로들어가나,재배포후동일계정실기기수신재시험필요. 비용영향은메모리설정이요청당256->512로증가(정확한청구증가액은미측정)이며사용자최종승인필요하므로지금운영배포/ready/merge금지. 코드·진단근거와검증을reviewable draftPR까지준비하세요.
> 검증: Node22.23.2 /opt/homebrew/opt/node@22/bin 사용. functions package/lock은현재main42와같아/tmp/haru-pending-major-deps-20261109/functions/node_modules 재사용symlink가능,설치/다운로드금지. Functions build+기존관련 scheduledNotificationCore.test.js+runtimeexports100equal+endpoint metadata 실제확인(sendTestNotification.availableMemoryMb512/region같음,다른export의endpoint옵션이기준과동일한지비교). config만변경이므로구현문자열과똑같은시험추가안해도됨. 값비교는실제로드export.__endpoint 필드선택/필요요약이며credentials/UID/함수전체env값출력금지. 기반표준validation Node22실행은환경PATH명령거부가능. 권한거부면우회하지말고root에게정확한기계실행요청. generated functions/lib/index.js,lib/snsToDiary.js는미커밋그대로stage제외,restore/reset/정리삭제금지. 함수수100현재GCF실배포114와혼동안함.
> docs/reviews/2026-11-09-iphone-push-memory 새폴더에이요청원문·원인실측·전후config·실제검증/권한거부원문/기존경로리전Rules인증결제모델변경없음/비용영향/정확롤백(functiontarget동일옵션256재배포,또는직전revision100%전환은별도승인)기록. 함수256한도에서실패한실기기1회근거이지과거모든실패원인단정하지말것. 최소코드커밋한국어제목,개별stage/cached파일확인push(due remote codex충돌시codex-iphone-push-memory-20261109). 한국어draftPR 목적/변경/검증/운영영향/위험/rollback/region경로환경결제인증포함. Codex @codexreview 수동요청가능하면요청하고시간/HEAD/댓글ID새색인,권한거부면root담당. 독립검토는root별도. 본인자기승인·실제모든사용자알림/Slack메시지/운영데이터삭제/범위외리팩터링금지. 최종코드SHA/PR/실제완료검증/미실행한계반환.

## 2. 원인 실측 (root 제공, CC는 운영 로그를 직접 읽지 않음)

- 사건: PR #363 반영 후 아이폰 실기기에서 새 UI로 기기 등록 → "내 기기 테스트 알림" 1회 → `sendTestNotification` HTTP 500.
- 운영 로그(root 안전 추출): `2026-11-09T04:25:27.236234Z` `Memory limit of 256 MiB exceeded with 259 MiB used`
- 운영 함수(gcloud 실측, root 제공): nodejs22 / asia-northeast3 / memory 256Mi / CPU 1 / timeout 60s / revision `sendtestnotification-00130-tah` / updateTime `2026-09-12T12:38:45.673214178Z`
- 범위 한정: 이 근거는 **256MiB 한도에서 실패한 실기기 1회**에 대한 것이다. 과거의 모든 아이폰 알림 미수신 원인이 메모리라고 단정하지 않는다. 512MiB 재배포 후 동일 계정 실기기 수신 재시험이 필요하다.

## 3. 변경 전후 설정

| 항목 | 변경 전 (`6723b5d4`) | 변경 후 (`0d1f4315`) |
|---|---|---|
| 코드 | `onCall({ region: 'asia-northeast3' }, …)` | `onCall({ region: 'asia-northeast3', memory: '512MiB' }, …)` |
| memory | 지정 없음 → 기본 256MiB (운영 실측 256Mi) | 512MiB |
| region | asia-northeast3 | asia-northeast3 (동일) |
| CPU / timeout / 동시성 | 지정 없음(기본) | 지정 없음(기본, 동일) |

```diff
 export const sendTestNotification = onCall(
-  { region: 'asia-northeast3' },
+  { region: 'asia-northeast3', memory: '512MiB' },
   async (request) => {
```

파일 내 기존 사용례(`{ region: 'asia-northeast3', memory: '512MiB' }`, 예: `functions/src/index.ts` 2546·3039행)와 같은 표기다.

## 4. 바뀌지 않은 것

- 함수 동작·발송 대상(본인 `users/{uid}/settings/settings`의 `fcmTokens`)·인증 확인(`request.auth`)·토큰 정리 로직: 변경 없음
- Firestore 경로, Rules, Storage: 변경 없음
- 결제·요금 정책, 인증 정책: 변경 없음
- AI 호출·모델: 변경 없음
- 다른 함수 옵션, `setGlobalOptions`/전역 옵션: 변경 없음
- 커밋 포함 파일: `functions/src/index.ts` 1개 (`git diff --cached --name-only`로 확인)
- `functions/lib/*` 생성물은 커밋하지 않음

## 5. 비용 영향

- 이 함수의 인스턴스 메모리 할당이 요청당 256MiB → 512MiB로 늘어난다. Cloud Run 기반 2세대 함수는 할당 메모리·CPU와 실행 시간에 따라 과금되므로 이 함수 실행분의 메모리 과금 단가가 늘어난다.
- 정확한 청구 증가액은 **미측정**이다. 이 함수는 사용자가 테스트 알림 버튼을 누를 때만 호출되는 용도다(호출량 실측은 하지 않음).
- 8.1 멈춤 조건 "비용이 늘어나는 변경"에 해당 → **허대표님 최종 승인 전 운영 배포·ready·merge 금지.**

## 6. 검증 (실제 실행 결과와 권한 거부 원문)

### 6.1 실행됨

| 항목 | 명령 | 결과 |
|---|---|---|
| Node 22 확인 | `/opt/homebrew/opt/node@22/bin/node -v` | `v22.23.2` |
| 의존성 재사용 근거 | `cmp package.json …/haru-pending-major-deps-20261109/functions/package.json`, 같은 방식으로 `package-lock.json` | 둘 다 동일 (`PKG_SAME`, `LOCK_SAME`). 브랜치 HEAD = `origin/main` `6723b5d4` 확인 |
| node_modules | `ln -s /tmp/haru-pending-major-deps-20261109/functions/node_modules functions/node_modules` | symlink 생성(설치·다운로드 없음, 커밋 안 함) |
| 알림 핵심 테스트 | `/opt/homebrew/opt/node@22/bin/node test/scheduledNotificationCore.test.js` (cwd `functions`) | `scheduledNotificationCore tests passed` |
| diff 확인 | `git diff` | 위 3절 1줄 변경만 |

### 6.2 권한 거부로 미실행 (우회하지 않음)

Functions 빌드는 Node 22를 PATH에 넣어 실행해야 한다(기본 `node`는 `/opt/homebrew/bin/node` `v26.8.2`). 아래 명령이 세션 권한 정책으로 자동 거부되었고, 요청에 따라 우회하지 않았다.

1. `export PATH=/opt/homebrew/opt/node@22/bin:$PATH; node -v; npm run build …` — 거부 원문: `What required approval: A variable in this command can't be checked before it runs`
2. `PATH=/opt/homebrew/opt/node@22/bin:/usr/bin:/bin npm run build 2>&1 | tail -5` — 거부 원문: `This Bash command contains multiple operations. The following part requires approval: PATH=/opt/homebrew/opt/node@22/bin:/usr/bin:/bin npm run build 2>&1`

따라서 다음은 **미실행**이다: Functions 빌드, runtime export 100개 동일 확인, `__endpoint` 메타데이터 비교.
(함수 수 100은 로컬 `lib` export 기준이며, 현재 GCF 실배포 114개와 다른 수치다.)

### 6.3 root 실행 요청 (정확한 명령)

비교 스크립트: `/private/tmp/haru-push-memory-verify-20261109/endpoint-compare.js` (저장소 밖. dump 파일은 `__endpoint` 전체를 담으므로 저장소·PR·Slack에 올리지 않는다. compare 출력만 요약 기록한다.)

```bash
# (1) 기준(6723b5d4) 빌드 — 별도 임시 폴더, 이 worktree의 lib는 건드리지 않음
BASE=/private/tmp/haru-push-memory-baseline-20261109
mkdir -p "$BASE"
git -C /private/tmp/haru-push-memory-20261109 archive 6723b5d4 functions | tar -x -C "$BASE"
ln -s /tmp/haru-pending-major-deps-20261109/functions/node_modules "$BASE/functions/node_modules"
cd "$BASE/functions" && PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build

# (2) 변경본 빌드 (lib/index.js 등 생성물은 stage하지 않음)
cd /private/tmp/haru-push-memory-20261109/functions && PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build

# (3) 알림 핵심 테스트 재확인
cd /private/tmp/haru-push-memory-20261109/functions && PATH=/opt/homebrew/opt/node@22/bin:$PATH node test/scheduledNotificationCore.test.js

# (4) export/__endpoint 비교 (lib마다 별도 프로세스)
V=/private/tmp/haru-push-memory-verify-20261109
cd /private/tmp && PATH=/opt/homebrew/opt/node@22/bin:$PATH node $V/endpoint-compare.js dump "$BASE/functions/lib/index.js" > $V/base.json
cd /private/tmp && PATH=/opt/homebrew/opt/node@22/bin:$PATH node $V/endpoint-compare.js dump /private/tmp/haru-push-memory-20261109/functions/lib/index.js > $V/next.json
PATH=/opt/homebrew/opt/node@22/bin:$PATH node $V/endpoint-compare.js compare $V/base.json $V/next.json
```

기대 결과: `baseExportCount`=`nextExportCount`=100, `exportNamesEqual: true`, `otherExportsEndpointEqual: true`, `sendTestNotification.after.availableMemoryMb: 512`, `before.region`=`after.region`(`["asia-northeast3"]`), `changedFields: ["availableMemoryMb"]`. 결과는 이 폴더에 **새 파일**로 추가한다(이 README는 고치지 않음).

## 7. 롤백

- 코드: 이 PR을 병합하지 않거나, 병합 후라면 해당 커밋 revert.
- 운영(배포 후 문제 시, **별도 승인 필요**):
  - (a) 256MiB 설정 코드로 같은 함수만 재배포: `firebase deploy --only functions:sendTestNotification --project haru2026-8abb8` (region `asia-northeast3`은 코드 옵션으로 유지)
  - (b) 직전 revision `sendtestnotification-00130-tah`로 트래픽 100% 전환 (Cloud Run 트래픽 전환, 별도 승인)
- 데이터 롤백 대상 없음(설정만 변경).

## 8. 남은 일 (CC 실행자가 하지 않은 것)

- Functions 빌드·export·endpoint 비교 (6.3, root 실행)
- Codex 리뷰 요청·색인, 독립 Claude 검토 (root 담당)
- 허대표님 비용 승인 → `sendTestNotification` 단일 함수 운영 배포 → `gcloud functions list` 실측(512Mi, asia-northeast3, 새 revision) → 동일 계정 아이폰 실기기 수신 재시험
- Slack 기록(CC 실행자는 Slack에 게시하지 않음)
