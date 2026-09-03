# 로컬 런타임 검증 체크리스트 — 무인증 AI 7개 + 문법캐시 격리

전제: main 병합 후 firebase deploy --only functions 완료 상태. 전부 테스트 계정으로.

- [ ] 1. 로그아웃 상태에서 성경 단어 뜻보기 호출 → unauthenticated 차단 확인
- [ ] 2. 로그아웃 상태에서 반려동물 음식 확인(petFoodCheck) 호출 → 차단 확인
- [ ] 3. 로그인 후 성경 읽기·단어 탭·영어일기 번역 정상 동작 (회귀 없음)
- [ ] 4. 분당 한도 초과로 연속 호출 → resource-exhausted 확인,
       1분 대기 후 재호출 시 정상 리셋 확인
- [ ] 5. 정상 사용 패턴(분당 1~2회)에서 오탐 차단 없음 확인
- [ ] 6. 테스트 계정 A로 영어일기 문법 해설 생성 →
       Firebase 콘솔에서 grammarCache 문서 ID가 diary_{A의 uid}_... 형태인지 확인 →
       테스트 계정 B로 같은 문장 해설 생성 시 A의 캐시가 재사용되지 않는지 확인

하나라도 실패 → main 병합 금지. 실패 항목과 증상 그대로 보고.

롤백 참고: git show main:functions/src/index.ts
