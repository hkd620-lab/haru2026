# 미완료 PR 정리 및 PR322 운영 반영 결과

## 확정 결과

2026-11-03(KST) 확인 당시 열린 PR5건을 정리했다. 대체 반영된 #96/#114/#116/#141은 대체 근거와 원래 본문을 보존해 종료했고, #322는 검증·검토·대표 승인 뒤 병합 및 Hosting 자동배포를 완료했다. 이후 열린 PR 조회 결과는 0건이다. 기존 이슈와 미확인 실기기 시나리오까지 모두 완료했다는 뜻은 아니다.

## 승인과 검증

- 대표의 독립 검토 예외 승인 원문: “이번 건만 독립 Codex 검토로 대체”.
- 대표의 최종 운영 승인 원문: “PR #322 병합·Hosting 자동배포 승인”. 이 대화 비동기 질문에 직접 답변했다.
- 검토 HEAD b576f2b62f5e236b04a5e09c8060466ef7949e61. 자동 리뷰1회 지적없음, 독립 Codex1회 원문 “승인”. 수정 후 승인0회.
- Node22.23.2 분리설치178패키지, npm ls --all, 호환성5/5 및 독립 재실행5/5 통과. 잠금파일 원본·설치후·main 병합본 SHA256 일치.
- 같은 PR HEAD 기존 CI 통과. 병합후 운영 Node22 웹 build도 성공.
- 질문·결과·자동색인·실패한 확인 명령의 설명과 원본 로그는 이 디렉터리에 보존했다.

## 병합·배포·운영 확인

- PR322 병합 SHA: `505228b2785f99bde0342b53173132dafa40e5e1`.
- 병합 시각: 2026-11-03 09:43:00 KST.
- 병합 전 main08d66534→새main505228b2의 전체 diff는 tools/package-lock.json 한 파일, 추가3/삭제3줄뿐이다. frontend·Functions·Rules 소스 변경 없음.
- [Hosting run41554822758](https://github.com/hkd620-lab/haru2026/actions/runs/41554822758): SUCCESS, headSha가 병합 SHA와 동일. install/build·Hosting 배포 단계 모두 성공, 작업 종료09:44:28 KST.
- 배포 대상: haru2026-8abb8 Hosting live. 로그의 Hosting version `537dac6b0d697fed`. 별도 release ID는 조회하지 않았다.
- 09:45:01 KST 운영 `https://haru2026.com`을 캐시 재검증 요청으로 읽어 HTTP200 및 제목 표시를 확인했다.
- 운영 script `/assets/index-Ci6j4Mwj.js`, legacy `/assets/index-legacy-CRbOEoO0.js`는 해당 CI 빌드 로그와 동일하다. `production-http.json`에 개인정보 없는 응답 요약을 보존했다.
- 이번 변경은 도구 의존성이고 웹 제품 동작 변경이 없어 운영 인증·저장·데이터삭제 시험을 반복하지 않았다. 운영 사용자 데이터 쓰기·AI 유료 호출 없음.
- Functions·Rules 수동배포 없음. Functions 리전 asia-northeast3, Firestore users/{uid}/records/{date}, 환경변수·결제·인증 정책 유지. 비밀값·API키·사용자 본문·개인정보를 기록하지 않았다.

## 보존·제한·되돌리기

- 원격 감사기록 브랜치 `codex-completion-audit-20261103`에 새 docs/reviews 파일만 추가. 제품 PR322의 검토 SHA를 변경하지 않았으며 감사기록 브랜치는 main에 병합하지 않았다.
- LaCie UUID06827F85-BF9F-465C-9C30-E39085839975 실측. 앞선 검토 기록14개/52,328바이트를 `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/20261103_미완료정리_PR322_01`에 복사·전체SHA256검증 완료. 내부 원본 삭제 없음. 이 최종 배포 기록은 별도 새 보관 폴더로 복사한다.
- npm audit의 다른 도구 의존성 @fastify/busboy·@grpc/grpc-js high2항목은 잔여다. 전체 저장소 보안 감사·해결 범위가 아니다.
- 기존 미확인 범위: 사진OCR 실기기, 음성 실청/재개/iOS, PDF 출력, 독서 저장, 실카드파일/아이폰PWA 저장·중복제외. 기존 성공 근거는 유지한다.
- 열린 이슈273/279 정책·품질 결정, 89사진삭제, 84과거시험은 남아 있다. #89는 현재 SayuModal의 삭제처리와 UI 코드 존재를 추가 확인했지만 운영 사진삭제를 시험하지 않았으므로 전체 완료로 닫지 않았다.
- 롤백은 이 lock만 되돌리는 별도 PR 및 승인된 Hosting 절차로 진행하며 1.4.0 보안상태 복귀 위험을 검토한다. 이번에 롤백·운영자료 삭제 없음.
- 난이도: 5.5 중간(독립 검토자가 평가한 PR322 변경 규모는 소/난이도 낮음).

## Slack 기록용 확정 요약

대체PR96/114/116/141 종료, PR322 대표승인 후 main505228b2 병합. Node22설치·호환성5/5·독립재실행5/5·자동무지적·독립승인·CI통과. Hosting41554822758 SUCCESS/version537dac6b0d697fed, 운영HTTP200·빌드자산일치. 열린PR0건. Functions/Rules/사용자데이터변경없음. 별개audit high2·기존실기기/이슈잔여유지. 검토14파일 LaCie SHA256검증, 최종기록 추가보관. Slack미게시.
