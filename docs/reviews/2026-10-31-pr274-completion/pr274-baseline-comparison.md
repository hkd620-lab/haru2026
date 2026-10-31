# main 기존 실패 대조

2026-10-31 부모 실행 환경에서 원본 Developer/HARU2026의 frontend/src, test, package.json, lock이 origin/main 693af514와 차이 없음을 git diff --quiet로 확인했다. 원본 worktree 코드는 수정하지 않았다.

- node --import tsx --test test/assistantSavedResultOpen.test.mjs: exit 1, 19건 중 18통과, isSpecialDayRecord is not defined 동일.
- node test/statsStorage.policy.test.cjs: exit 1, 동일한 photoEditorSessionRef effect dependency 정규식의 user?.uid 누락 기대값 문제.
- 로그 main-assistant-test.txt, main-stats-test.txt는 임시 control 폴더에 보관. 시험환경 실패는 PR #274 새 결함이 아니다.
