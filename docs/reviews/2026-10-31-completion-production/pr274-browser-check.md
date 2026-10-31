# PR #274 브라우저 실측

2026-10-31 Chrome, PR preview 2be694b8. 기존 Google 계정 정상 로그인 후 /record 진입. 읽기 전용 DOM 실측과 실제 마우스 끌기로 확인했다.

- 기록 내용 textarea rows=3, 초기 높이98px, lineHeight24px, resize=vertical.
- 손잡이를 실제 끌어 높이가182px로 증가, rows=3 유지.
- 화면확인 이미지: input-three-lines-preview.png (개인기록 본문 없음).
- 실제 iOS/Android 한글 IME는 확인하지 않았다. 이 결과는 데스크톱 Chrome과 해당 입력칸 범위다.
