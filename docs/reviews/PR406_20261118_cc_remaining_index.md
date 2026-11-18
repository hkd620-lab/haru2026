# PR406 CC 잔여 지적·aiGateway 후속 검증

검토 코드 HEAD: `3288ca2e50c4bc7ff72155384aa89a2063961877`. [전체 원문·Gemini12건](PR406_20261118_cc_remaining_raw.json).

## 실행 원문 색인

|종류|시각 UTC|원문|대상/비고|
|---|---|---|---|
|요청|2026-11-18T01:33:36Z|[댓글 6966289247](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6966289247)|7ee1de320b6635eb46242bdcfc04baab1b82aa20|
|결과/CC 검토|2026-11-18T01:34:26Z|[댓글 6966303515](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6966303515)|원문 참조|
|요청|2026-11-18T01:44:03Z|[댓글 6966463615](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6966463615)|6f5850f8d20359e9b4c297cfa8cabb0d4ef1230b|
|요청|2026-11-18T01:54:56Z|[댓글 6966639944](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6966639944)|3c71918ebd36911767b490b67e3c174a159aaeed|
|요청|2026-11-18T02:08:19Z|[댓글 6966854658](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6966854658)|3288ca2e50c4bc7ff72155384aa89a2063961877|
|결과/CC 검토|2026-11-18T02:10:42Z|[댓글 6966893005](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6966893005)|3288ca2e50|
|Codex 리뷰|2026-11-18T01:37:12Z|[리뷰 5949548609](https://github.com/hkd620-lab/haru2026/pull/406#pullrequestreview-5949548609)|`7ee1de320b6635eb46242bdcfc04baab1b82aa20`|
|Codex 리뷰|2026-11-18T01:47:10Z|[리뷰 5949628472](https://github.com/hkd620-lab/haru2026/pull/406#pullrequestreview-5949628472)|`6f5850f8d20359e9b4c297cfa8cabb0d4ef1230b`|
|Codex 리뷰|2026-11-18T01:59:06Z|[리뷰 5949718949](https://github.com/hkd620-lab/haru2026/pull/406#pullrequestreview-5949718949)|`3c71918ebd36911767b490b67e3c174a159aaeed`|

요청 시각은 원문 댓글 기준. 별도 시작 시각은 확인 불가. 결과가 없는 실행을 승인으로 세지 않는다.

## 지적 반영

|지적|원문|반영|
|---|---|---|
|완료 어휘가 소비한 활용형까지 고려해 부정 상태를 판정하세요|[댓글 4608141790](https://github.com/hkd620-lab/haru2026/pull/406#discussion_r4608141790)|6f5850f8|
|불규칙 활용형을 정규화한 뒤 의도 동사 어간을 비교하세요|[댓글 4608141797](https://github.com/hkd620-lab/haru2026/pull/406#discussion_r4608141797)|6f5850f8|
|‘우’로 끝나는 정상 동사의 의도 어미를 인식하세요|[댓글 4608208185](https://github.com/hkd620-lab/haru2026/pull/406#discussion_r4608208185)|3c71918e|
|마무리의 계획·진행 활용형도 상태 대조에 포함하세요|[댓글 4608208193](https://github.com/hkd620-lab/haru2026/pull/406#discussion_r4608208193)|3c71918e|
|‘마무리하기로 했다’를 실제 완료의 근거에서 제외하세요|[댓글 4608283261](https://github.com/hkd620-lab/haru2026/pull/406#discussion_r4608283261)|3288ca2e|
|처음 주장 대조에서 같은 동사의 서술형과 관형형을 연결하세요|[댓글 4608283269](https://github.com/hkd620-lab/haru2026/pull/406#discussion_r4608283269)|3288ca2e|

- 기존 CC의 날짜 조사·이동 동사·최초 주장·들고 오인·수만/그저께·행사 안내 지적 및 aiGateway 기존 실패는 7ee1de32에서 보완했다.
- CC 추가 수만 명/몇만 원 회귀, 구어체 최초 주장·부분 완료 정도 및 Codex 완료 부정·불규칙 의도 지적은 6f5850f8에서 보완했다.
- 추가 Codex의 배우다·세우다 의도, 마무리 계획·진행은 3c71918e에서 보완했다.
- 결정·완료 구분과 굽다 최초 대상 활용은 3288ca2e에서 보완했다.
- 모델 응답의 원문 밖 “스스로 정한”은 7ee1de32에서 차단하고 그 문장만 복원했다. 다른 의미 문장은 보존된다.

## 검증과 한계

- Functions build, polishContent 163/163, aiGateway 16/16, 총179/179 및 diff check 통과. 이전 aiGateway 실패 해소.
- Gemini gemini-3.1-flash-lite 실제 호출: 앱·전시·녹음 × 한 문단/다문단 ×2회=12회 성공. 이후 검증 로직 수정 후 최종 코드에 원응답12건을 재생했다. 의미·사실 보존 결과 12/12 유지, 전체 원문 복귀 없음.
- 앱: 만들어 온 과정과 첫 실제 사용, 기쁨, 심사·출시 미완료를 유지. 전시: 사진 스무 장·여러 번 배치·뿌듯함·하나의 이야기 의미를 유지. 녹음: 연습·첫 녹음·끝까지 연주한 뿌듯함·정리와 공개 미완료·다시 들을 수 있는 기록을 유지.
- 풍성도4는 기계적 점수가 아닌 이 대상 표본의 과정·감정·상태 변화 표현에 대한 편집 판정이다. 모든 일기로의 일반화나 의미 오류 완전 차단을 보장하지 않는다.
- export·asia-northeast3·Firestore users/{uid}/records/{date}·환경변수·인증·결제·모델·앱 호출량 변경 없음. 생성 lib 2개는 로컬 보존·커밋 제외.
- Slack #haru2026-감사의 c64de8f 잔여 지적 기록과 GitHub를 대조했다. 새 결과를 Slack에 직접 게시하지 않았다.
- 병합·운영 배포 보류. 기존 Hosting preview CI만 자동 실행. 되돌리기는 필요 시 이번 코드 커밋을 역순 revert하는 별도 검토 작업.

## 최신 Codex 결과

코드 `3288ca2e50c4bc7ff72155384aa89a2063961877`에 대한 [결과 댓글](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6966893005)은 “Codex Review: Didn't find any major issues. Keep it up!”이다. 결과 댓글 ID 6966893005이며 구조화된 APPROVED 리뷰 또는 배포 승인이 아니다. 코드 HEAD CI 3개도 통과했다.
