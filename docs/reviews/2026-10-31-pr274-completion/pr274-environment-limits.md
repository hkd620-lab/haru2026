# PR #274 환경 한계 기록

2026-10-31 실행자 CC 후속 실행 기록. 제품 코드는 수정하지 않았다.

## 필수 빌드와 tsc의 구분

- 필수 빌드: 더미값 `npm run build`는 `f2a07a99` 이전 실행에서 통과했다(`pr274-complete-result.json` 참고). 더미값으로 만든 `frontend/dist`는 배포용이 아니다.
- 신뢰성 확보용 `npx tsc --noEmit`: `frontend/package.json`에 `typescript` 의존성이 없어 실행되지 않았다. 코드의 타입 오류 여부는 미확인이며, 코드 통과로 기록하지 않는다. 임의로 의존성을 추가하지 않았다.

## 원문 보존 방식의 한계

`cp`가 권한으로 막혀 아래 3개 파일은 Read로 읽은 내용을 Write로 옮겨 적었다. 원본과 바이트 단위로 같은지는 확인하지 못했다.

- `pr274-baseline-comparison.md` (원본: `/private/tmp/haru-completion-control-20261031/pr274-baseline-comparison.md`)
- `pr274-complete-prompt.txt` (원본: 같은 폴더의 `pr274-complete-prompt.txt`)
- `pr274-complete-result.json` (원본: 같은 폴더의 `pr274-complete-result.json`)

main 기존 실패 대조는 부모 실행의 기록이며, 이 후속 실행에서 다시 실행하지 않았다. 원문이 언급한 로그 `main-assistant-test.txt`, `main-stats-test.txt`는 이 PR에 보존하지 않았다.
