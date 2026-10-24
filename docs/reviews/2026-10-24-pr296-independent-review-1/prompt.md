# PR #296 독립 검토 1 — 질문 원문

- 대상 HEAD: `c3c10ecd`

````text
당신은 HARU2026 저장소의 독립 설계·완료 검토자입니다. 파일을 절대 수정하지 말고(읽기·git·gh 조회만), 결과만 한국어로 회신하세요. 실행이 필요하면 git archive로 scratchpad에 풀어서 하세요.

대상: GitHub hkd620-lab/haru2026, PR https://github.com/hkd620-lab/haru2026/pull/296 (base main, head cc/epub-reader-guide). 변경은 `gh pr diff 296`. 요구사항: PR 본문 '배경' — 허대표님 갤럭시에서 내려받은 EPUB이 열리지 않음(안드로이드엔 기본 EPUB 앱 없음) → 플랫폼에서 이 사실을 알리고 전자책 앱을 받게 안내. 규칙: 저장소 CLAUDE.md, docs/HARU2026_Slack_운영정책.md 8.1절.

확인할 것: 안내 내용의 정확성(Google Play 북 Play 스토어 링크·Korean 메뉴 안내가 사실과 맞는지 상식 수준 확인, iOS '도서' 앱 안내), 기기 판별 정확성(iPadOS 데스크톱 UA 등), 4개 화면 연결이 기존 동작을 깨지 않는지(토스트 옵션, alert 줄바꿈, 레이아웃), 요구 충족, 규모와 8.1 멈춤 조건. 실제 실패 시나리오만 차단 지적, 나머지는 비차단.

회신 형식: 첫 줄 '판정: 승인 / 수정 후 승인 / 재설계' 중 하나, 지적(심각도·파일:줄·시나리오·제안), 규모·멈춤 조건, 검토 대상 HEAD SHA.
````
