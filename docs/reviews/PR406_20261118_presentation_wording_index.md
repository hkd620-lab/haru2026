# PR406 발표 다문단 표현 중복 후속 검증

검토 코드 `ac56282463ff3e4687eecf849b00a523af6ec678`. [요청 댓글 6980136054](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6980136054)은 2026-11-18T13:34:51Z에 작성했다. 검토 시작 시각은 확인되지 않았다. [결과 댓글 6980185214](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6980185214)은 2026-11-18T13:36:48Z에 도착했다. 결과 원문은 “Codex Review: Didn't find any major issues. What shall we delve into next?”이다. 별도 구조화된 리뷰 ID 없이 댓글로 회신했다. [검토 원문과 모델 응답](PR406_20261118_presentation_wording_raw.json).

- ‘순서로 엮어 냈고, 자료에 차례를 잡아’처럼 한 결말에서 같은 배열을 두 표현으로 되풀이하는 부분을 다문단 발표 자료 지침에서만 보완했다. 무엇부터 어떻게 설명할 흐름을 갖췄는지 풀어 쓰는 예시로 변경했다.
- 동일 가상 일기의 Gemini gemini-3.1-flash-lite 실제 호출 3/3에서 결말에 ‘순서’와 ‘차례’를 함께 쓰지 않았다. 열 장·세 번·마지막 장까지 정리한 뿌듯함·미발표가 유지됐고, 거듭 바꾼 수고와 무엇부터 어떻게 설명할지 흐름을 갖춘 의미가 나타났다. 표본 기준으로 풍성도 4에 가까운 결과가 반복됐다.
- 별도 발표 일기 1건에서도 결말의 두 단어 중복이 없고 설명 흐름 및 여섯 장·두 번·안도감·미발표가 유지됐다. 일반화 범위는 이 표본까지다. 기존 녹음·앱·전시 모델 응답 12건의 재생 결과는 이전과 같았다.
- Functions 빌드와 다듬기 169개·aiGateway 16개, 총 185개 통과. diff check와 export 변경 없음 확인. 임시 사본에서 빌드해 기존 로컬 생성 파일을 보존했다. 사실 검증 코드·리전·Firestore 경로·환경변수·인증·결제·모델·앱 호출량 변경 없음. 필요하면 코드 커밋을 revert할 수 있다.
- [최신 CC 검토](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6980178539)는 빌드·185개 통과와 새 예시가 검증기를 통과함을 별도 확인했다. 기존 회귀 테스트의 옛 예문을 유지하고 이번 자연스러운 결말은 실모델 응답으로 검증했다. PR 본문에 최신 범위와 검증 결과를 반영한다.
- 직전 [CC 검토](https://github.com/hkd620-lab/haru2026/pull/406#issuecomment-6979704108)를 [Slack 기록](https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1795007852020099)과 대조했다. Slack에는 새 결과를 게시하지 않았다. 병합·운영 배포는 보류한다. push에 수반되는 기존 Hosting preview CI만 실행된다.
