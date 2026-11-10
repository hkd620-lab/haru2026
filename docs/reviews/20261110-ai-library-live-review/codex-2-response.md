# Codex 두 번째 검토 지적 반영

요청 https://github.com/hkd620-lab/haru2026/pull/367#issuecomment-6762255283
대상 111cc9566f8fa8587d721f846f0c7aa839b67e44, 시작 2026-11-10T08:05:07.908618Z, 완료 2026-11-10T08:08:05Z, 결과 리뷰 ID 5838564724.
지적 P2: 저장 전후 키 순서에 독립적인 계획 해시를 사용하세요.
원문 https://github.com/hkd620-lab/haru2026/pull/367#discussion_r4522458879

원인: Firestore가 Map 키 순서를 바꾸어 읽어오면 JSON.stringify의 삽입 순서 기반 계획 해시가 달라질 수 있었다.
수정: classificationManifestHash가 모든 객체의 키를 재귀적으로 정렬하고 배열 순서는 유지한다. root 및 records 내부 키 순서가 바뀐 Firestore 형태로도 같은 해시인지, 내용 변경은 다른 해시인지 회귀 시험을 추가했다.

현재 분류 실행 callable은 배포하지 않으며 기존 개인자료 분류 이력·원문·폴더를 변경하지 않는다. 이번 수정도 최신 HEAD 자동 재검토와 독립 재검토 대상으로 포함한다.

독립 Claude 두 번째 검토의 원문은 claude-2-raw.json이다. 판정은 '수정 후 승인 (조건부)'였고 코드상 P1/P2 없음, 남은 조건은 승인근거·CI·최신 Codex 확인이었다. 승인근거와 실제525건 읽기 전용 대조 결과는 approval-and-verification-evidence.md에 보존했다. 이전 판정을 승인으로 바꿔 요약하지 않는다.
