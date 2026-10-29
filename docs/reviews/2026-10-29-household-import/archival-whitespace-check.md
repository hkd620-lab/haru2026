# 원문 diff 보존과 공백 검사

기록 추가 커밋 4e80ebf6의 기본 git diff --check는 원문으로 보관한 claude-02-change.diff, claude-03-change.diff의 빈 문맥 줄을 trailing whitespace로 보고했다. Unified diff는 변경하지 않은 빈 줄도 문맥 표시용 공백 한 칸으로 표현하므로 원문을 그대로 보관하면 발생하는 경고다.

원문 검토 기록은 고치지 않는다. 두 파일을 각각 검토자에게 제공한 /private/tmp 원문과 cmp로 대조하여 바이트가 같음을 확인했다. git diff --check b777c3be..HEAD -- . ':!docs/reviews/2026-10-29-household-import/*.diff'는 성공했다. 기능 코드의 공백 검사는 각 기능 커밋 전에 성공했다.

기본 검사가 성공했다고 주장하지 않으며, 예외는 원문 diff 두 파일의 문맥 줄에 한정한다. 이 보조 설명도 기록 추가 전용 파일이고 기능 코드를 바꾸지 않는다.
