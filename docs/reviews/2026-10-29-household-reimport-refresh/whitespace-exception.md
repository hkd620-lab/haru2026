# 원문 diff 헤더 공백 예외 및 검증 정정

기능 커밋 09e53543의 git diff --cached --check는 보관한 change.diff:99의 hunk 헤더 끝 공백을 trailing whitespace로 보고했다. git diff --unified=0이 만든 함수 문맥 헤더의 원문이며 구현 코드의 공백은 아니다. 원문 검토 기록을 수정하지 않는다.

앞선 validation.md와 command-results.txt의 git diff --check 통과 문구는 원문 change.diff를 stage하기 전 작업 코드 검사에 해당하며, 커밋 전체 기본 공백 검사가 성공했다는 뜻으로 사용하지 않는다. 전체 기본 검사는 위 경고로 실패했다. change.diff를 제외한 기능 코드·기록 공백 검사는 git diff --check af27e7e4..HEAD -- . ':!docs/reviews/2026-10-29-household-reimport-refresh/change.diff'로 별도 확인한다. 이 예외는 change.diff 한 hunk 헤더에 한정한다.
