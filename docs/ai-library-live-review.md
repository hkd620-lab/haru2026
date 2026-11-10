# 개인용 수집기 목적 폴더와 보류 화면

대표님 혼자 사용하는 기존 개발자 전용 학습함에 다섯 목적 폴더와 보류 탭을 배포한다. 기존 원문·AI 출처·책 소재·복사·삭제 기능을 보존한다.

보류 메타데이터는 `aiLibraryClassificationPrivate/{uid}/reviewItems/{recordId}`에 본문 없이 `status: pending`, `contentHash`, `recommendation`, `reason`, `manifestHash`로 보관한다. `listAiLibraryReviews`는 기존 개발자 인증 후 현재 기록의 존재·본문 해시·수동 분류 상태를 다시 확인한다. 변경·삭제·수동 이동된 항목은 제외한다. 10개씩 반환하며, 무효 항목을 최대 100개 읽은 빈 페이지도 다음 커서로 진행한다. 최대 1,000개 제한이고 새 인덱스나 Rules 변경은 없다.

보류에서 추천 폴더로 이동하거나 직접 폴더를 선택하면 기존 `moveAiLibraryLog`가 수동 결정을 기록한다. 수동 미분류도 보류에서 제외된다. 범위 밖 판정의 추천은 참고 후보로 표시하며 전송 제외 항목에는 추천을 만들지 않는다.

운영 배포 범위: Hosting, `listAiLibraryLogs`, `saveAiLibraryImport`, `moveAiLibraryLog`, `listAiLibraryReviews`. AI 실행 callable·회원탈퇴 함수·Rules·수집기 설치본은 배포하지 않는다. UI에서 AI 실행 계획 패널을 제거해 이미 완료된 결과 확인과 수동 이동에 집중한다. 추가 모델 호출은 없다.

검증: Functions 빌드 및 폴더·보류 동작 14개, frontend import/분류 회귀 32개와 모달 2개, 실제 React 합성 브라우저 21개 통과. 프런트 합성 설정 빌드와 원격 실제 설정 빌드는 구분한다. 브라우저 합성 시험은 운영 계정 검증의 대체가 아니다.
