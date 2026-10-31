# PR #292 최신 main 통합

최종 기록 push 직후 main에 PR #301이 병합돼 index.ts와 aiGateway 시험이 충돌했고, 충돌 상태에서는 PR CI가 시작되지 않았다. main `0df591459d771e6926d593a44aa5d29b2eab8117`을 이 작업 브랜치에만 통합한다. 다른 원본 작업본은 수정하지 않는다.

- 최신 main의 BASIC→sayuPolishBasic(Luna), 그 밖의 모드→sayuPolish 경로와 원문 보존 프롬프트를 그대로 유지한다. 이 PR에서 모델 정책을 새로 바꾸지 않는다.
- 실제 선택된 polishPurpose/model을 usage.stage에 전달하고 허용 목적 타입에 sayuPolishBasic을 추가한다.
- gateway 회귀 시험의 callable 경계 개선과 main의 목적/모델 라우팅 단언을 모두 유지한다.
- 자동 병합된 main의 BASIC 실패 시험은 과거 요청 실패행 model:null을 기대했다. 이 PR은 단계 실패에도 실제 모델을 보존하므로 실제 모델·purpose·단일행 단언으로 맞췄다. 요청 행 purpose=polishContent 단언도 추가했다.
- 통합 Functions 빌드 성공, 관련69시험 통과. 실제 AI·운영 데이터·배포 없음. 이전64시험·승인 원문은 과거HEAD에 대한 기록으로 보존하며 통합HEAD는 다시 두 검토를 받는다.
- 추적 lib 생성물은 merge index의 원래 내용으로 돌려 소스만 포함한다. 이후 predeploy build가 필요하다.
