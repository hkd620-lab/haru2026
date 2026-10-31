# 공개 약관 경계 시험 import 수정 검증 — 2026-11-01 00:35 재개

실행자: Claude Code (claude-opus-5-5). 이 폴더는 PR #321 Codex 1차 지적 discussion4431491488 반영의 검증 기록이다. 기존 기록은 수정하지 않았다. 이 기록은 판정·승인이 아니다.

## 환경

- cwd `/private/tmp/haru-completion-web-upgrade-20261031`, branch `codex/completion-web-upgrade`
- 시작 HEAD `53aa2917f97852dfde10d8dd2c9004bc94ac6477`, clean. remote `codex-completion-web-upgrade`도 같은 SHA
- 수정 커밋 `028c5bb3`
- Node v22.23.2 (`which node`: `/opt/homebrew/opt/node@22/bin/node`), npm 10.9.8

## 변경

`tests/public-legal-boundary.test.cjs:10`의 `frontendRequire('react-router-dom')`을 `frontendRequire('react-router')`로 바꿨다. 이 한 줄 외 제품·시험 변경은 없다.

## 시험 결과

명령은 저장소 루트에서 실행했다.

| 시점 | 명령 | 종료 코드 | 결과 | 로그 |
| --- | --- | --- | --- | --- |
| 수정 전 | `node --test tests/public-legal-boundary.test.cjs` | 1 | tests 1, pass 0, fail 1. `Cannot find module 'react-router-dom'`, `MODULE_NOT_FOUND` | `before-public-legal-boundary.log` |
| 수정 후 | `node --test tests/public-legal-boundary.test.cjs` | 0 | tests 6, pass 6, fail 0, skip 0 | `after-public-legal-boundary.log` |
| 수정 후 | `node --test frontend/test/webMajorUpgrade.test.mjs` | 0 | tests 12, pass 12, fail 0, skip 0 | `after-webMajorUpgrade.log` |

수정 전 실패 내용은 `limit-2017/web-major-parent-public-legal-failure.log`와 같은 원인·위치(`tests/public-legal-boundary.test.cjs:10:26`)다.

## 실행 경로 차이

- `limit-2017/status.md`의 명령은 `/opt/homebrew/opt/node@22/bin/node` 절대경로다. 이번 세션은 절대경로 실행이 승인 필요로 거부돼 PATH의 `node`로 실행했다. `which node`가 같은 경로를 가리키고 버전도 v22.23.2로 같다.
- 수정 전 시험은 화면 출력 확인 1회, 로그 저장 1회로 총 2회 실행했다. 두 번 모두 종료 코드 1이다.

## 범위와 한계

- 제품 소스 변경이 없어 전역 643시험과 전체 빌드는 지시대로 실행하지 않았다.
- `webMajorUpgrade` 11번 시험은 기존 `frontend/dist` 산출물을 읽는다. 이번에 다시 빌드하지 않았다.
- 복합 상태 조회 명령 1건과 node 절대경로 버전 조회 1건이 승인 필요로 거부돼 실행되지 않았다. 단일 명령과 Read/Grep/Glob으로 같은 내용을 확인했다.
- 최신 CI, Codex 재검토, 독립 Claude 검토는 이 기록에 포함되지 않는다. 병합·배포·Slack 게시·PR 편집은 하지 않았다.
