# PR 442 영상 AI 검색 Jev 검토

2026-11-23. 허대표님 승인 범위에서 구현과 분리된 독립 Codex 검토를 진행했다.

## 독립 검토

1차 검토 요청

> 이전 영상 검색의 후속 작업입니다. 현재 /private/tmp/haru-vf-caption-20261123 codex/video-finder-condition-judge git diff와 신규 functions/src/videoFinderSearchJudge.ts 읽기 전용 독립 검토. 특히 동의·재전송/실패 시 결과, TypeSafe 전송 범위, 유료 호출 한도와 보충 검색, 빌드 회귀를 보고 출시 막을 문제 및 로컬 판정만 회신. 운영 자격증명·배포는 금지.

1차 판정은 **수정 후 승인**이었다. 지적은 실패 결과 캐싱 및 무효 응답 처리, 영어 자막 제외 조건 보존, 한국어 후보의 24KB 요청 크기 제한, 음악 보충 검색에 영화 검색어를 붙이는 문제였다.

재검토 요청

> 귀하의 4개 발견 모두 반영. 오류는 unavailable 예외로 캐싱 없음 및 malformed Jev 응답은 실패; 영어 자막 긍정 조건에만 사전 검사, minus·부정 테스트; 24KB에 맞게 끝 후보부터 정리; 보충 검색 토픽 유지. 현재 diff 짧게 재검토 후 기존 문제 해소 여부와 판정만 보내주세요. 운영·쓰기 없음.

재검토 회신

> 허대표님, 현재 작업본의 로컬 재검토 판정은 **승인**입니다. 이전 지적 네 건 모두 해소됐습니다.
>
> Jev 장애와 유효한 판정이 전혀 없는 응답은 재시도 가능한 오류로 처리됩니다. 영어 자막을 제외한 검색도 후보를 유지합니다. 긴 한국어 요청은 24,000바이트 이내로 후보 수를 줄이고, 음악 보충 검색은 원래 주제를 유지합니다. 관련 로컬 테스트 109개가 모두 통과했습니다.

최종 재검토 요청

> PR #442 deploy approved in main conversation. Read-only independent recheck at /private/tmp/haru-vf-caption-20261123 HEAD dc0a8b2f. Prior approval at 8ff569b0; since then added TypeSafe disclosure from official docs, and GitHub P2 fixes to pass category, retain previous film scope, preserve late caption evidence with search-only longer description. Please verify changes, required release scope, verdict. No secret/operations exposure.

최종 회신

> PR #442 dc0a8b2f 최종 독립 판정 **승인**. diff와 회귀 테스트에서 선택 분야를 개인정보 가림 후 Jev state에 포함하고, 한국 영화/첫사랑 기존 선별 유지, 검색 시 5,000자 설명으로 후단 근거 확인 후 반환 300자+근거 발췌, 전송에 기존 24KB 상한을 적용함을 확인. 서버·전송/접근 로컬 테스트 110/110, diff --check 성공. 미국 처리·일반 고정 보관기간 미공개 안내는 https://help.typesafe.ai/articles/5974925716 와 일치. 배포 범위 본앱 Hosting, 독립 videoFinder Hosting, 서울 리전 함수 **videoFinderSearch·videoFinderStandalone·videoFinderAccess** 세 개. 특히 본앱은 videoFinderAccess.status에서 새 플래그를 받아 세 번째도 필요. 이 판정에서 운영/키 접근 및 실전송 없었습니다.

## GitHub 자동 검토

- 첫 실행은 PR 개설로 자동 요청했다. 7e9db486에서 14:04:41 UTC에 완료했다. 리뷰 6023024784, 지적 두 건은 [긴 설명의 자막 근거](https://github.com/hkd620-lab/haru2026/pull/442#discussion_r4666868495)와 [선택한 관심 분야 적용](https://github.com/hkd620-lab/haru2026/pull/442#discussion_r4666868507)이다. 두 건 모두 dc0a8b2f에서 반영했다.
- 최종 재검토는 14:10:39 UTC에 요청했다. dc0a8b2f에서 14:12:26 UTC에 완료됐고 추가 지적은 없다. [재검토 요청](https://github.com/hkd620-lab/haru2026/pull/442#issuecomment-7103596360) · [자동 검토 결과](https://github.com/hkd620-lab/haru2026/pull/442#issuecomment-7103379357)
