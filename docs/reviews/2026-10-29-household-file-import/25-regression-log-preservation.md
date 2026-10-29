# 수정 전 실패 로그의 공백 보존과 검사 보충

02c03205의 기록 stage 검사에서24-regression-before.txt 원문 빈 줄의 공백6곳이 경고됐으나, 실행 스크립트가 검사 종료코드를 확인하지 않고 기록 커밋을 진행했다. 코드 검증 성공과 이 기록 검사 경고를 혼합하지 않는다.

원문을 다듬지 않고 보존하며, 기존 `.gitattributes`에 해당 실패 로그1파일의 `-whitespace`만 추가한다.17-build.txt에 한정했던 기존 예외와 같은 원문 보존 목적이다. 코드·테스트 파일의 공백 검사 설정은 바꾸지 않는다. 기록 파일 내용이나 기존 리뷰 판정은 수정하지 않는다.

설정 파일 수정 diff와 이 보충 기록은 다음 최신 Codex 리뷰 및 독립 완료 검토에 함께 제공한다. 설정 변경이 있어 `docs/reviews 아래 추가만` 예외라고 처리하지 않는다.24 원문은 /private/tmp/haru-file-import-review-regression-before.txt와 바이트 동일성을 확인했다. 이어서 `git diff --check c37ff624..HEAD`를 실제 실행하고 결과를 확인한다.
