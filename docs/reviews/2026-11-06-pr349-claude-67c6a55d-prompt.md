# PR 349 독립 Claude 검토 — 질문 원문

- 실행 시각: 2026-11-06
- 검토 대상 HEAD: `67c6a55d`
- 검토자 모델: Opus 5.5 (작업 맥락 없는 별도 에이전트)
- 전달한 것: 저장소 경로, PR·Slack 링크, 질문. CC의 검증 결과와 판단은 넘기지 않음

---

당신은 독립 코드 검토자입니다. 파일을 수정하거나 커밋·push·PR 댓글을 하지 마세요. 읽기만 합니다.

대상
- 저장소: /Users/heogyeongdae/Developer/HARU2026 (GitHub hkd620-lab/haru2026)
- PR: https://github.com/hkd620-lab/haru2026/pull/349 (base main, head feature/share-image-grape, 검토 대상 커밋 67c6a55d)
- 배경 논의: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793936135844209 (Slack 스레드. 읽을 수 있으면 읽고, 못 읽으면 건너뛰세요. 특히 "협의 ③" 답변)
- diff 확인: `git diff origin/main...67c6a55d` 또는 `gh pr diff 349 --repo hkd620-lab/haru2026`
- 프로젝트 규칙: 저장소 루트 CLAUDE.md (특히 "브랜드 로고 및 호박 상징 원칙", "CC 코드 수정 원칙")

확인해 주세요
1. diff가 PR 제목·본문이 말하는 범위와 정확히 일치하는지, 범위를 벗어난 변경이 없는지. 기존 호박 로고·파비콘·앱 아이콘·화면 로고·`firebase.json`이 바뀌지 않았는지.
2. 이미지 파일(`frontend/public/brand/haru2026-share-v1.png`)을 직접 열어(이미지로 읽기) 무엇이 보이는지 적으세요. 포도송이 알 개수와 배치, 알 안의 아이콘, 텍스트 문구가 PR 본문 설명과 맞는지, 개인 정보·계정 화면·흩어진 장면·확정되지 않은 개수 문구가 없는지.
3. 포도송이 배치가 `frontend/src/app/components/GrapeAnimation.tsx`의 '모인 상태'와 같은지, 원본 `docs/brand/haru2026-share-image-v1/source.html`과 컴포넌트를 줄 단위로 대조하세요. 알 크기(28px)·간격(27px)·행/열 좌표, `x = col×27+28`·`y = row×27`, 그라데이션 색·그림자·안쪽 inset·하이라이트, 그리고 `import.meta.glob('../../imports/*.png')`을 정렬한 순서(id 0~9)와 source.html의 파일 순서가 같은지. 이미지가 새로 그린 것이 아니라 기존 구성 요소를 옮긴 것으로 보이는지.
4. `index.html`의 메타 태그가 올바른지: `og:image`가 공개 HTTPS 절대 주소인지, `og:image:width/height`가 PNG의 실제 크기(IHDR)와 같은지, `twitter:card=summary_large_image`와 `twitter:image`의 일관성, 다른 메타 태그가 깨지지 않았는지.
5. 배포 후 `https://haru2026.com/brand/haru2026-share-v1.png`가 이미지로 응답할지: `firebase.json`의 hosting `rewrites`(마지막 `**` → `/index.html`)와 `headers`, 그리고 PWA 서비스워커 설정(`frontend/vite.config.*`의 workbox `navigateFallback`·`denylist` 등)이 이 파일 요청을 가로채 HTML로 돌려줄 가능성이 있는지. `frontend/public/brand/haru-pumpkin-logo.png`가 이미 같은 방식으로 서비스되는지, `firebase.json`에 `welcome-thumb.png` 전용 rewrite가 있는 이유가 이 경우에도 필요한지 코드와 git 이력(`git log -S welcome-thumb`)으로 확인하세요. 확인 못 하면 못 했다고 쓰세요.
6. 새 정책 테스트 `frontend/test/shareImageMeta.policy.test.cjs`와 `frontend/package.json`의 스크립트 한 줄: 의미 있는 검사인지, 직접 실행(frontend 폴더에서 `node test/shareImageMeta.policy.test.cjs`)하고, 선언한 너비를 일부러 틀리게 한 복사본(임시 폴더)에서 실패하는지 확인하세요. 관련 기존 테스트(`subscriptionDisplay.policy`, `loginPerformanceCallsites.policy`, `socialLoginReturnOrigin.policy`)도 실행하세요.
7. 그 밖에 이 변경이 일으킬 수 있는 회귀 위험, 브랜드 관점 위험(CLAUDE.md의 포도 로고·호박 상징 원칙과 충돌하는지), 카카오톡·X(트위터) 공유 카드 관점의 빠진 점.

답변 형식
- 판정: 승인 / 수정 후 승인 / 재설계 중 하나
- 근거: 확인한 파일·줄과 명령, 본 그대로의 결과
- 지적 사항: 번호, 심각도(높음·중간·낮음), 위치, 이유
- 확인하지 못한 것은 "확인 못 함"이라고 분명히 적으세요. 추측을 사실처럼 쓰지 마세요.
