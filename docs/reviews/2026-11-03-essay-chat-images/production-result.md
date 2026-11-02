# PR #326 승인 범위 배포 및 운영 확인

## 승인과 코드

- 대표님이 이 대화에서 `배포승인함`이라고 명시했다. 직전 질문의 범위는 PR #326 main 병합과 chatWithResult 단독 운영 배포다.
- 독립 Codex 대체 검토: 1차 `수정 후 승인` → P2 반영 → 동일 검토자 2차 `승인`. 누적 수정 후 승인 1회. 자동 리뷰 실행 3회와 원문·색인을 보존했다.
- 최종 PR HEAD 8d4b286b5557d6335714ccf12dcd35c24f0f951f, CI 3개 SUCCESS. ready 전환 뒤 자동 실행도 같은 HEAD에서 지적 없이 완료.
- PR #326 병합 SHA: 08d6653412ce46996e6eb1c94ffe2580308454db. 병합 시각 2026-11-02T23:48:56Z (2026-11-03 08:48:56 KST).
- 현재 작업 브랜치를 이 병합 SHA로 fast-forward하여 배포했다. 기존 main의 PR #323 변경이 포함되지만, `chatWithResult` 선언부터 다음 export 직전까지의 구현이 검토된 PR HEAD와 정확히 같음을 배포 전에 직접 비교했다. 이 PR에서 다른 작업의 코드를 다시 작성하지 않았다.

## 배포

- 명령: `firebase deploy --only functions:chatWithResult --project haru2026-8abb8 --non-interactive`.
- 결과: exit 0, `Successful update operation`, `Deploy complete!`. 정상 predeploy `npm run build` 성공 뒤 선택 함수 하나를 업데이트했다.
- 프로젝트 haru2026-8abb8, 리전 asia-northeast3, runtime nodejs22, GEN_2, 상태 ACTIVE.
- 기존 revision chatwithresult-00037-jer → 새 revision **chatwithresult-00038-dey**.
- updateTime: 2026-11-02T23:53:00.032166887Z (2026-11-03 08:53:00 KST), allTrafficOnLatestRevision=true.
- 배포 뒤 `gcloud functions describe`와 `gcloud functions list` 실측으로 위 이름·리전·환경·상태를 확인했다.
- Hosting 자동 배포 Actions 41548276042 SUCCESS, headSha는 병합 SHA와 동일. 원문: hosting-main-deploy.json. Hosting release/version ID는 이번 확인에서 별도로 조회하지 않았다.
- Rules·다른 Functions·Storage ACL·환경변수·인증·결제 정책 배포 없음. 원문·이미지 원본·저장 경로를 바꾸지 않았다.

## 운영 사용자 동작 확인

- 로그인된 Chrome에서 대표님이 문제를 제시한 에세이 기록을 열고 기존 본문 그림 및 이전의 이미지 미전달 답변을 확인했다. 사용자 첨부 내용·본문·UID·이미지 URL·답변 전문은 이 보고서나 Slack·PR에 저장하지 않는다.
- 새 revision ACTIVE 확인 후 같은 에세이 대화에서 동일한 그림 질문을 전송하고 `나의 기록으로 답변`을 선택했다. 외부검색·이미지 재첨부·원문 수정·메모 추가 저장 없이 시험했다.
- 새 답변은 실제 첨부 이미지의 시각적 요소를 설명하고 에세이 본문 맥락과 연결했다. 이전의 텍스트 전용 답변을 재사용하지 않았으며, 그림을 다시 첨부하라는 요구 대신 이미지 내용을 답하는 동작을 확인했다.
- 기존 에세이·이미지를 수정하지 않았으며, 제품의 정상 대화 요청에 따라 새 질문·답변과 사용량 처리만 발생했다. 공개하기·수정하기·삭제 버튼은 누르지 않았다.
- Chrome 연결이 중간에 끊겨 재연결된 같은 프로필의 새 운영 탭에서 시험을 완료했다. 로그인 우회·자격증명 추출·프로그램을 통한 사용자 데이터 직접 조회는 하지 않았다.
- 운영 요청 로그는 질문·본문·개인정보를 제외한 요청 메타데이터만 조회했다. 새 revision의 POST HTTP 200: 2026-11-02T23:54:50.413827Z/1.041047880초(선택 응답), 2026-11-02T23:55:08.277374Z/4.730606303초(그림 답변). 두 요청 모두 chatwithresult-00038-dey.
- 판정: **✅ 해당 에세이의 본문 이미지 인식·답변 단일 시나리오 확인 완료**. 모든 이미지 형식·여러 장·손상/삭제 파일·일반 계정·모바일 실기기 전체 E2E로 확대하지 않는다. 지연·오류·권한 경계는 앞선 합성·에뮬레이터 시험 근거를 유지한다.

## 보존과 되돌리기

- 활성 소스·Git·필수 검토·배포 상태 기록은 정상 내부 저장소와 원격 작업 브랜치에 보존한다. 일반 내보내기 산출물은 만들지 않았다.
- predeploy가 만든 tracked lib의 기존 누적 차이는 배포 뒤 원복한다. 실제 배포는 정상 빌드로 생성한 코드에서 수행했으며 이 기록 커밋에는 새 검토·운영 결과 파일만 추가한다.
- 필요 시 검증된 이전 chatWithResult 소스의 단독 재배포와 해당 병합 revert를 별도 승인 범위에서 진행한다. 이번에 롤백·기존 데이터 정리·다른 함수 배포는 하지 않았다.
- 난이도: 5.5 중간.

## Slack 기록용 확정 요약

PR #326 대표 승인 후 main 08d66534 병합 및 chatWithResult 단독 운영 배포 완료. asia-northeast3/nodejs22/GEN_2/ACTIVE, revision00038-dey·최신 트래픽100%. Hosting41548276042 SUCCESS. 독립 대체 검토 승인·자동 리뷰3차 무지적·최종CI 통과. 로그인 운영 에세이에서 기존과 같은 그림 질문을 기록 기준으로 실행해 재첨부·외부검색 없이 이미지 내용 및 본문 맥락 답변 확인, 새 revision HTTP200. 해당 단일 시나리오 완료이며 모바일/전체 이미지 전수 확인 아님. Rules·다른 함수·원문·사진 변경 없음.
