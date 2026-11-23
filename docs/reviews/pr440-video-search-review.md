# PR 440 영어 자막 샹송 검색 검토

2026-11-23. 허대표님이 CC 사용량 초과로 이 채팅에서 독립 검토를 요청했다. 구현 맥락을 상속하지 않은 독립 Codex 검토자가 읽기 전용으로 검토했다. 아래 두 회신은 배포 전 확인했다(12:48 UTC).

## 1차 독립 검토

요청 원문

> Act as independent read-only release reviewer for HARU2026 PR #440 HEAD 51aefbf4 at /private/tmp/haru-vf-caption-20261123. User explicitly replaces Claude review with independent Codex review. Inspect git diff origin/main...HEAD and relevant code/tests. Look for significant regressions, precision, original user wants English subtitled chanson, likes ranking after filtering. Provide Korean verdict 승인/수정 후 승인/재설계, concrete actionable findings and release scope. Do not mutate or deploy.

결과 원문

> 독립 검토 판정 **수정 후 승인**. HEAD 51aefbf4 로컬 core 테스트 52/52, 조건 필터→공개 좋아요 정렬 경로는 맞습니다. 그러나 (1) `functions/src/videoFinderCore.ts:332,551`에서 설명이 `English subtitles are not available.` 또는 `영어 자막은 제공하지 않습니다.`인 샹송도 mapVideoItem이 채택됨을 직접 재현. 후보 좋아요가 높으면 1위 노출됩니다. 영어 조동사 포함 부정·한국어 제공 부정을 필터하고 회귀 테스트를 추가하세요. (2) `:370`에서 `샹송 말고 영어 자막 팝송`에도 특수 필터 `chanson-english-subtitles`가 활성화되어 팝송을 버리고 샹송만 반환함을 서비스 진입점에서 재현. 샹송 부정/제외를 인식해 일반 검색으로 넘기고 테스트를 추가하세요. 변경 범위는 검색 core/test, 운영 대상은 videoFinderSearch와 videoFinderStandalone 두 함수. 배포/변경하지 않았습니다. 수정 HEAD 재검토 가능.

## 독립 재검토

요청 원문 (동일 검토자 대화)

> 이전 판정 원문은 위 대화의 수정 후 승인입니다. 반영 c765f0a0. 영어 조동사·한국어 자막 제공 부정과 샹송 제외 표현 처리, 실제 요청 및 좋아요가 높은 반례 포함 테스트 추가. 현재 HEAD에서 두 지적 해결 및 전체 release 재검토 후 최종 판정과 작업 규모·멈춤 조건을 알려주세요.

결과 원문

> 최종 독립 판정 **승인** (c765f0a068b11a375ca5de8d72cc47618296d60f). 최신 TypeScript 소스 직접 실행으로 두 부정 표현 탈락, 영어/한국어 긍정 표현 유지, ‘샹송 말고 영어 자막 팝송’ 일반 검색과 ‘영어 자막 볼수있는 상송’ 특수 필터 확인. core/access 89/89, diff --check 통과. 좋아요 높은 음성 반례 제외 후 공개 좋아요 900→400 순서로 정상. 작업 규모 소, 변경 자체에 정책 §8.1 멈춤 조건 없음. 적용 함수 videoFinderSearch·videoFinderStandalone(asia-northeast3). 제목·설명 문구 근거이며 실제 영상 영어 자막 및 운영 결과는 이 독립 검토 범위 밖. 이 판정은 최신 커밋에 대한 독립 코드/완료 검토이며 운영 실측은 별도입니다.

## GitHub 자동 코드 검토

- 첫 실행은 PR 개설로 자동 요청됐다. 51aefbf4에서 12:42:47 UTC 완료, 지적 없음. [상태 기록](https://github.com/hkd620-lab/haru2026/pull/440#issuecomment-7101500635)
- 수정 커밋 c765f0a0에서 12:47:15 UTC에 재검토를 요청했다. 12:48:18 UTC 완료, 지적 없음. [요청](https://github.com/hkd620-lab/haru2026/pull/440#issuecomment-7101623069) · [응답](https://github.com/hkd620-lab/haru2026/pull/440#issuecomment-7101647667)
