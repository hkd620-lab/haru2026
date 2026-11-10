# 사용자 요청 기존 앱 자료 harulab 이동

사용자 요청: “기존 자료 중 현재 개발 중인 앱 관련 내용도 harulab 폴더로 모아줘. 원문과 내가 직접 지정한 분류는 유지해줘.”

앱 코드 변경·병합·배포는 없다. 운영 기준은 main b7f9ec7c(PR370)이며, 본건은 명시 승인된 자료의 분류3필드만 갱신한 작업이다. 원문·제목·출처·날짜·기존 AI 이력은 그대로 보존했다. 일반 AI/유튜브 소개와 단순 하루랩 인사말은 대상 선정에서 제외했다. 모호한 자료는 이동하지 않았다. 추가 외부 모델 호출 없음.

## 실행과 검증

- 초기746건을 읽어467건 선정, 초기manual2건 제외. 실행 전 기준이 바뀌어 최신747건을 별도 백업했다. 기존 선택467건의 본문은 동일하고 신규manual3건은 제외했다. 초기manual 중1건은 최신ai_log 쿼리에 없어 재생성하거나 수정하지 않았다.
- v1 preflight: Timestamp 객체와 JSON 객체의 키 순서 차이로467건 모두changed_preserved, 실행 전 중단. 데이터 쓰기 없음.
- 독립 검토1: 수정 후 승인. Timestamp비교, moved수검증, allSettled실행기록 개선을 요구. 원문 review1.raw.json.
- v2: JSON복제 후 정렬해 동일 표현 비교, manual전체일치 사전검사, allSettled후fsync, moved/notMoved총합 및 건너뜀 사유 검증 추가. 독립검토2 승인(review2.raw.json). 수정 후 승인 누적1회.
- v2 preflight: eligible467, manualExact1. 실행하지 않음. 최신자료의 수동 상태를 새 스냅샷으로 읽었다.
- v3는 승인된v2와 입력스냅샷/계획/외장폴더표시 파일 경로3개만 다르며 보호 로직은 바이트 대조로 동일함을 확인. 선정목록은 동일467건. 최신747건과manual3건을 새로 백업·SHA검증. preflight eligible467/manualExact3 통과 후 실행.
- 트랜잭션마다 실제 record identity/updateTime/비분류필드hash/manual상태를 확인. 복원 영수증 원자생성과 category/source/categoryUpdatedAt3필드 update만 수행. private manualBatches 아래 서버영수증으로 재실행과 중복반영 방지. 기존review메타데이터는 삭제하지 않고manual필터로 숨겨짐.
- 실행467/467 moved. 검증747건 모두비분류필드hash일치, 기존manual3/3전체일치, 미이동280건전체일치, 차이0. 추후사용자수동변경은복원으로덮어쓰지않아야 함.
- 실제로그인한운영AI학습함의harulab에서 HARU2026/HEL/EEB개발기간기록 등 이동된 자료와목록표시 확인. 검색초기화 후 폴더열어둠.

개인 자료·실제 기록ID·UID·백업 본문은 저장소에 올리지 않았다. 원본백업/선정목록/실행기록/검증은 사용자가 지정한 LaCie의 본건 새 폴더에 저장했다. 원문검토질문·결과·시각·검토한연산스크립트는 이 디렉터리에 보존했다. Slack은 직접 게시하지 않는다. 본 기록은 검토 증거 추가이며 프로그램 배포가 아니다.
