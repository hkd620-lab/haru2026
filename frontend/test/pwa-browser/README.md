# 실제 SW 두 탭 격리 검증

운영 Firebase·개인 기록에 연결하지 않는다. 제품 pwaRegistration/PwaStatus/pwaUpdateController를 그대로 사용한다.

1. frontend에서 `./node_modules/.bin/vite build --config test/pwa-browser/vite.config.mjs`.
2. `python3 test/pwa-browser/serve.py --port 18775`.
3. Chrome에서 같은 주소를 두 탭 A/B로 열고 SW 제어 중인지 확인. B에 합성 시험 글 입력.
4. A에서 새 버전 준비. 양쪽 안내 후 B에서 나중에, A에서 업데이트 및 저장 확인 선택.
5. A의 시작 횟수만 증가하고 B는 시작 횟수 1과 글을 유지하는지 확인.
6. 처음 방문 A의 controlling 이벤트가 오지 않으면 12초 후 화면 다시 열기가 활성화되는지 확인하고 저장 확인을 거쳐 재열기. 일반 설치 세션에서는 두 번째 업데이트가 즉시 승인한 탭만 다시 여는지 확인.

서버는 worker 응답의 공개 버전 주석만 변경해 설치 업데이트를 모의한다. 운영 배포나 실기기 iOS/Android E2E를 대신하지 않는다. 로컬 테스트 캐시·탭만 사용하며 다른 사용 중인 탭·CC 세션을 조작하지 않는다.
