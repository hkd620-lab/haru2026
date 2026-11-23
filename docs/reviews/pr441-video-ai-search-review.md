# PR 441 영상 AI 검색 검토

2026-11-23, PR #441. 구현에 참여하지 않은 독립 Codex 검토자가 읽기 전용으로 두 차례 확인했다.

## 1차

요청 원문

> 사용자가 후속 샹송 누락 수정과 AI 모드·동의 UI 배포를 승인했고 동일 작업 독립 검토를 이곳에서 진행합니다. /private/tmp/haru-vf-caption-20261123 codex/video-finder-chanson-recall 현재 git diff HEAD 리뷰. AI 후보 응답 파싱/커서, OR 조합, 동의 UI, 자막 정확성 및 배포 범위 확인 후 판정. 읽기 전용.

결과 원문

> 확인된 배포 전 수정 사항 [P1] `frontend/src/app/videoFinder/VideoFinderScreen.tsx:853` 실패 화면 ‘다시 시도’가 현재 모드와 체크박스를 무시하고 이전 `aiSearchLocation`으로 Gemini 재전송합니다. 재현: AI 모드 동의→찾기 실패→동의 해제(또는 일반 모드 선택)→다시 시도. `runSearch(..., true, true)`가 됩니다. 재시도와 이전 검색 경로의 자동 복귀에서 현재 동의와 모드를 확인하고, 동의 해제 후 전송 불가/일반 모드 일반 재시도 UI 회귀를 권합니다. 그 외 후보 처리도 확인 중.

> [P2] `functions/src/videoFinderCore.ts:938-943,994`의 범용 장르 판정이 조사를 남겨 동의한 Gemini 후보까지 버립니다. 같은 모의 응답 Amsterdam/Jacques Brel, 같은 영어 자막 메타로 ‘영어 자막 볼수있는 상송’만 1건, ‘영어 자막이 있는 샹송’, ‘영어 자막으로 볼 수 있는 샹송’, ‘영어 자막 샹송을 찾아줘’는 OR 검색어에 Amsterdam 없음·0건 직접 확인. 명시한 가수/곡은 보존하면서 장르·자막 표지 바로 뒤 조사와 범용 요청 문장을 인식하고 세 표현 회귀 보강 권장. 현재 판정 **수정 후 승인**, 범위 Functions 검색 2개와 app/standalone Hosting UI. 청구·추가 호출 여부는 기존 1회 구조에서 확인, 두 지적 수정 뒤 재검토.

## 재검토

요청 원문

> 재검토 부탁. P1 실패 재시도에 현재 방식/동의 및 AI 경로 일치 확인, 모드 변경·동의 해제·관심 분야 전환 시 전송 참조 초기화. P2 장르와 자막 표지 뒤에 붙는 조사 제거 및 3개 원문 회귀 테스트 반영. 위 이전 1차 판정과 두 지적 메시지를 기준으로 현재 diff 최종 재검토와 판정 부탁합니다.

결과 원문

> 최종 독립 검토 판정 **승인**, 대상 `638a64d2272a92992fa67e3e8e0292bd56e207ee`. 이전 P1은 동의 해제/일반 전환/분야 전환 시 두 참조를 초기화하며, 실패 재시도는 현재 모드·동의·위치 일치 조건을 거쳐 해결. P2는 3개 실제 문장 모두 `Amsterdam – Jacques Brel (English subtitles)` 채택, 특정 가수 원문 보존, 같은 OR 검색식으로 다음 페이지 확인. 독립 실행 Functions 90/90, frontend 지정 스크립트 17/17+policy 통과 및 diff --check. UI 테스트는 소스 가드/클라이언트 테스트로 브라우저 실클릭은 별도. 규모 중(공유 웹 UI+서버 검색), 사용자 승인 범위 내 추가 멈춤 조건 없음. 배포 대상 본앱·독립 Hosting, videoFinderSearch·videoFinderStandalone. 실제 YouTube 응답 및 자막 재생 여부는 별도.

## GitHub 자동 코드 검토

PR 개설로 자동 요청됐다. 638a64d2에서 13:21:07 UTC 완료, 지적 없음. [자동 검토 결과](https://github.com/hkd620-lab/haru2026/pull/441#issuecomment-7102365686)
