# PR #320 독립 2차 승인 근거와 기록 보완

`../README.md`, `../resume-1930/`, `../retry-play-fix/`, `../limit-2017/`, `../review-fixes-resume0035/`는 고치지 않고 이 폴더로 보완한다. 시각은 UTC다. 기록자는 Claude Code이며 제품 코드 수정, 전역 시험, build 재실행은 하지 않았다.

## 현재 상태

| 구분 | 상태 |
| --- | --- |
| 제품 승인 | 독립 2차 **승인**. "수정 후 승인" 누적 1/3 유지 |
| 최종 HEAD CI | **대기**. 이 기록 커밋의 CI는 부모가 확인한다 |
| 판정① | **아직 기록할 수 없다**. 최종 HEAD CI가 남았고 아래 조건 2도 미확인이다 |
| 운영 결정 | **대기**. 비용 증가·새 기능·운영 E2E 멈춤 조건에 해당한다. 병합·배포 범위와 순서는 허대표님 결정이 필요하다 |
| 감사 표시 | 🔍 추가 E2E 필요 / 🟨 대표 결정 필요 |

- 검토 대상 HEAD: `4513f63cf52d91dbd4ba7c0afdfea518c1dbf826`
- 제품 커밋: `58ac7a0a0023ff2ea28e008febbfd97e903c23c9`
- base: `a8a8a6b8`

## 독립 2차 판정 원문

원문: `reader141-independent2-result.json`, 질문: `reader141-independent2-prompt.txt`, stderr 0바이트.

> ## 판정: 승인 (제품 코드·설계)
>
> - **기준:** HEAD `4513f63c`, 제품 커밋 `58ac7a0a`, base `a8a8a6b8`
> - **누적:** 8.1절 "수정 후 승인" 1/3회를 유지합니다. 이번 판정은 승인이라 횟수가 늘지 않고, 초기화도 없습니다.
> - **필수 수정:** 없음. 독립1의 F1·F2와 Codex3 P2가 모두 코드에 반영됐습니다.
> - **감사 상태:** 🔍 추가 E2E 필요 / 🟨 대표 결정 필요
> - **아직 아닌 것:** 병합·배포 승인이 아니며, preview·운영 E2E는 미실행입니다.

## 지적별 직접 대조

독립 1차 원문은 `../review-fixes-resume0035/raw/reader141-independent1-result.json`이다. 코드는 현재 작업본 기준이고, `git diff --name-status 58ac7a0a 4513f63c`가 32개 모두 `A`·`docs/reviews/` 아래이므로 제품 코드는 `58ac7a0a`와 같다.

| 지적 | 코드 (`frontend/src/app/pages/BiblePage.tsx`) | 시험 (로그 09) | 변형 (로그 08) |
| --- | --- | --- | --- |
| 독립1 F1 최종 재생 실패·빈 응답 무안내 | `:47-49` 공통 안내, `:1337-1341` 취소 확인 뒤 `native`만 안내, `:1347-1348` 빈 응답을 바깥 `catch`로 보냄, `:1350-1357` 안내 | 23·24·25·26 통과 | F1 변형 4개가 23, 24 또는 16·18·25·26에서 실패 (31~55줄) |
| 독립1 F2 페이지 이탈 뒤 늦은 음성 | `:227-229` cleanup이 `ttsRequestRef`만 증가 | 27·28 통과 | cleanup 제거 변형이 25·27·29에서 실패 (8~14줄) |
| Codex3 [discussion_r4431468969](https://github.com/hkd620-lab/haru2026/pull/320#discussion_r4431468969) 재개 await 취소 누락 | `:1190-1209` 요청 번호·오디오 캡처, `:1197` 실패 시 취소 확인, `:1203-1206` 캡처 오디오만 `pause()` | 29·30·31·33 통과 | Codex3 변형 4개가 29·30·31 또는 31 또는 33에서 실패 (57~83줄) |
| 공통 취소 조건 | `:1219-1220` `isStale`, `:1230`, `:1244`, `:1272`, `:1293`, `:1328`, `:1332`, `:1338`, `:1352`, `:1359` | 27·32 통과 | 무음 재생, AudioContext, 첫 play 변형 3개가 27 또는 32에서 실패 (16~29줄) |

## 시험과 로그

독립 2차가 열지 않았던 구간까지 이번에 직접 읽었다.

| 로그 (`../review-fixes-resume0035/logs/`) | 상태 표시 | 원문 |
| --- | --- | --- |
| `09-bible-grammar-committed-head.log` | HEAD `58ac7a0a`, Node v22.23.2, 제품 변경 없음 | `# tests 35`, `# pass 35`, `# fail 0`, `종료 코드: 0` |
| `08-mutation-checks.log` | HEAD `58ac7a0a`, 임시 변형, 커밋 없음 | 변형 12개 모두 `종료 코드: 1`. 12번째 "Codex3 재개 실패 표준까지 안내"는 80~83줄에서 시험 33 실패. 끝줄 `잡히지 않은 변형: []`, `복원 해시 일치: True` |
| `04-question-enter.log` | HEAD `9b15e0d0` + 수정 미커밋 작업본, Node v22.23.2 | `# tests 21`, `# pass 21`, `# fail 0`, `종료 코드: 0` |
| `05-question-inputs.log` | 위와 같음 | `question input policy checks passed`, `종료 코드: 0` |
| `06-frontend-build.log` | 위와 같음, 더미 환경값 | `✓ built in 49.09s`, `precache  791 entries (21346.96 KiB)`, `종료 코드: 0` |
| `10-diffcheck-product.log` | 제품 diff `9b15e0d0`..`58ac7a0a` | 출력 없음, `종료 코드: 0` |

- 현재 시험 파일의 시험 선언은 35개다.
- 로그 04·05·06은 커밋 직전 작업본의 결과다. 커밋 전후 파일 동일성은 원 구현 기록의 설명이며 이번에 해시로 재확인하지는 않았다. 커밋된 코드 그대로 다시 돌린 것은 로그 09의 영역 시험이다.
- 시험은 모의 `Audio`·callable을 쓴다. 실제 브라우저의 자동재생 거부와 `AbortError`는 확인되지 않았다.

## Codex 4

색인은 `codex-index-4.md`다. 검토 대상 `4513f63c`, 요청 [6546797707](https://github.com/hkd620-lab/haru2026/pull/320#issuecomment-6546797707) 17:32:38Z, 완료 17:34:05.966468Z, [receipt 6546813737](https://github.com/hkd620-lab/haru2026/pull/320#issuecomment-6546813737) 17:34:05Z, [요약 6541437236](https://github.com/hkd620-lab/haru2026/pull/320#issuecomment-6541437236), 지적 0·미해결 0이다. 시작 17:32:50.760637Z는 부모 관찰값이고 현재 완료 스냅샷에는 없다.

## CI

[실행 41218210970](https://github.com/hkd620-lab/haru2026/actions/runs/41218210970)은 검토 대상과 같은 `4513f63c`에서 성공했다. 원문은 `reader320-ci-resume0035.json`, `reader320-ci-resume0035-details.json`이다.

| 검사 | ID | head | 결과 | annotation |
| --- | --- | --- | --- | --- |
| [build_and_preview](https://github.com/hkd620-lab/haru2026/actions/runs/41218210970/job/124587091682) | 124587091682 | `4513f63c` | success | 2 |
| [Deploy Preview](https://github.com/hkd620-lab/haru2026/runs/124587433821) | 124587433821 | `4513f63c` | success | 0 |

독립 2차는 첫 사본만 보아 annotation 본문을 미확인으로 남겼다. details 사본의 실제 2건은 다음과 같다.

- warning: `Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/`
- notice: `"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748"`

둘 다 CI 환경 알림이며 제품 결함이 아니다. 이 CI는 최종 HEAD의 CI를 대신하지 않는다.

## N5 정정: 표준 음성 변화 설명

`../review-fixes-resume0035/README.md`의 "아래 세 가지만 다르다"와 구현 결과의 "표준 음성의 변화 3가지"는 **불완전했다**. 그 파일은 고치지 않고 이 절을 기준으로 삼는다. 독립 2차 원문은 다음과 같다.

> | N5 (신규) | README의 "표준은 세 가지만 다르다"는 표현이 빠뜨린 것이 있습니다. 표준 재개 뒤 취소 시 소리·표시 정리도 달라졌습니다. 개선된 변경이라 기록만 보완하면 됩니다. | 새 파일로 보완 |

`git diff 9b15e0d0 58ac7a0a -- frontend/src/app/pages/BiblePage.tsx`를 직접 대조한 표준 음성의 변화는 다음과 같다. 요청 모양, 캐시, 일반 재생 경로는 그대로다.

| 번호 | 변화 | 출처 |
| --- | --- | --- |
| 1 | 재개 `play()` 실패가 처리되지 않은 거부에서 `console.error`로 바뀌었다. 안내는 없고 일시정지 표시가 남는다 | 기존 기록 |
| 2 | 무음 `play()` 대기 중 취소되면 서버를 호출하지 않는다 | 기존 기록 |
| 3 | 첫 `play()` 대기 중 오디오가 교체되면 옛 오디오를 끄고 표시를 덮지 않는다 | 기존 기록 |
| 4 | **표준 재개 `await` 뒤 취소되면 캡처한 오디오를 `pause()`하고 `setTtsPaused(null)`·`setTtsPlaying(key)`를 실행하지 않는다.** 전에는 소리와 재생 표시가 되살아났다. 개선 변경이다 (`:1203-1206`) | N5 |
| 5 | 재개 `play()`가 취소 뒤 실패하면 `console.error` 없이 끝난다 (`:1197`) | 이번 diff 대조 |
| 6 | F2 cleanup은 음질을 가리지 않아, 페이지 이탈 때 표준의 대기 요청도 취소된다 (`:227-229`) | 이번 diff 대조. 독립 1차 F2 판단에 "표준 절 듣기에도 있던 경로"로 언급 |
| 7 | 첫 `play()` 대기 중 오디오만 교체되면 `finally`가 로딩을 지우지 않는다 (`:1359`) | 이번 diff 대조. 독립 2차가 "로딩 표시 멈춤"에서 멈춤 없음으로 평가 |

5·6·7은 독립 2차 N5에 개별로 적히지 않았지만 모두 취소 경로라, 독립 2차의 "차이는 취소·재개 실패 경로뿐입니다" 범위 안이다. 이번 대조가 판정을 대신하는 것은 아니다.

## P3 정정: 재개 오안내

`../review-fixes-resume0035/README.md`와 구현 결과가 이 항목을 "기존" 문제로 적은 것은 부정확하다. **겹침 구조만 기존이고, 이 잘못된 안내 자체는 이번 PR에서 새로 생겼다.** `:1199`의 안내는 이번 커밋이 추가했다. 독립 2차 원문은 다음과 같다.

> ## CC가 남긴 잔여 문제의 독립 판단: 비차단 P3
>
> - **경로:** 고음질 재개의 `play()` 대기 중 `handleFullChapterTTS`가 `:1427`에서 `pause()`합니다. 서버 응답을 기다리는 동안 요청 번호도 오디오도 그대로라, `:1197`이 취소로 보지 못하고 `:1199`의 안내가 뜹니다.
> - **시험 공백:** 시험 31번은 오디오가 교체된 뒤의 거부만 다룹니다. 이 창은 시험하지 않습니다.
> - **`기존 문제`라는 표현:** 정확하지 않습니다. 겹침 구조는 기존이지만, 이 잘못된 안내는 이번 PR에서 새로 생겼습니다.
> - **터치·마우스:** 코드상 닿기 어렵습니다. 고음질 버튼은 `position: fixed; inset: 0; zIndex: 100` 덮개(`:3598-3600`) 안에 있습니다. 이 페이지에서 그 위에 뜨는 재생 버튼도 없습니다.
> - **키보드:** 포커스 가두기와 `inert`가 없어(`aria-modal`도 0건) Tab으로 뒤쪽 버튼에 닿을 수 있어 보입니다. 다만 코드 판독일 뿐이고 실제 클릭·포커스는 확인하지 못해 도달 가능으로 확정하지 않습니다.
> - **영향:** 키보드 조작이 짧은 `play()` 대기 시간과 겹쳐야 하고, 결과는 잘못된 안내 1회뿐입니다. 비용과 데이터 영향은 없습니다.
> - **처리:** 필수 수정을 요구하지 않습니다. 재현되면 팝업 포커스 처리나 재생 시작 지점의 요청 번호 증가를 별도 과제로 다룹니다.
> - **같은 부류의 경로:** `full_chapter_seq`는 같은 `Audio` 객체를 재사용해(`:1588-1594`) 오디오 비교로 잡히지 않습니다. 도달 조건이 같아 같은 등급입니다.

줄 `:1197`, `:1199`, `:1427`, `:3598-3600`은 현재 코드와 일치한다. 처리는 비차단 P3이고, 실기기 E2E에서 키보드 도달 여부를 확인한다.

## 유지되는 항목

- **N1~N3:** 독립 1차 표 그대로 유지한다. 시험 22번을 실제 한도 안내의 증거로 쓰지 않는다.
- **N4:** `closeWordPopup`(`:997-1003`)은 발음 듣기 요청을 취소하지 않는다. main에도 같은 구조가 있는 기존 구조이고 후속 과제다.
- **고음질 모델:** `tts-1`·`tts-1-hd`는 2027-01-06 종료 예정이다. 그 전에 이행이 필요하며 임의 교체는 금지다.
- **실제 브라우저:** preview와 운영 E2E는 미실행이다.
- **운영 승인:** 병합·배포 승인은 대기 중이다. 독립 승인은 그 권한이 아니다.

## 판정① 조건 상태

| 조건 | 상태 |
| --- | --- |
| 1. 최신 HEAD CI | 대기. `4513f63c`는 성공했지만 이 기록 커밋이 새 HEAD다 |
| 2. 필수 검증 로그의 PR 첨부 | 로그는 저장소에 있다. **PR 본문 첨부 여부는 미확인**이다. `gh pr view`가 권한 거부되어 읽지 못했고 독립 2차도 미확인으로 남겼다. 부모가 확인해야 한다 |
| 3. Codex | `4513f63c` 지적 0·미해결 0 |
| 4. 독립 검토자 | 승인 |

Functions 소스는 이번 재수정에서 바뀌지 않아 기존 build·export 114 근거를 유지한다는 독립 2차 판단을 따른다.

## 원문 보존 대조

control 원본과 이 폴더 사본의 SHA-256을 `shasum -a 256`으로 따로 계산했고 `source-hashes.json`과 7개 모두 일치한다.

| 파일 | 크기 | SHA-256 |
| --- | --- | --- |
| `reader141-independent2-prompt.txt` | 6633 | `3ef71ab3b7c858f8cc5846f1036d7d10c044368be9abef479f0fdfa14e176266` |
| `reader141-independent2-result.json` | 13969 | `419a9abce8c185c1ca1a0c9ea02063bf2f767f8f83a2b90a32b6edfb2c77eab4` |
| `reader141-independent2-stderr.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reader141-review-fixes-resume0035-result.json` | 9699 | `7eb618b585d53b4cf308c0d9626eebe30f956576e53b337ef419d0ecb4b6f398` |
| `reader320-codex4-resume0035-comments.json` | 35665 | `8e6336ed7d9df095ddde3a97fdb266d89931fc45dea43316efada1428e8b9f7b` |
| `reader320-ci-resume0035.json` | 1704 | `7de84701dda5365a0d171718020c28539769c6737f07372481310af8199fd2ee` |
| `reader320-ci-resume0035-details.json` | 1952 | `e523f9ed2df73278c663a2e38f68f7a86181d9bce98af02231a153a38784c352` |

- 이 폴더 8개 원문 파일에서 API 키·토큰·개인키·비밀번호 형식의 패턴은 0건이다.
- 이번 구현의 질문은 `../review-fixes-resume0035/raw/reader141-review-fixes-resume0035-prompt.txt`에 있다.

요청된 필수 원문은 모두 있다. 실제 부족은 다음뿐이다.

- running 시점의 부모 도구 출력 원문은 control에도 없다 (`codex-index-4.md` 참조).
- control의 `reader141-review-fixes-resume0035-stderr.txt`는 0바이트라 사본을 두지 않았다. 잃은 내용은 없다.
- Slack 판정 기록은 없다. 이번 작업 범위 밖이며 판정① 뒤 게시 대상이다.

## 검토 기록 전용 커밋

이 기록 커밋은 `docs/reviews/` 아래 새 파일만 추가한다. 필터 없는 `git diff --name-status 4513f63c..HEAD`의 커밋 뒤 출력은 자기 자신에 담을 수 없어 `/private/tmp/haru-completion-control-20261031/reader141-review2-records-name-status.txt`에 둔다. 판정 기록에는 그 출력을 그대로 붙인다.
