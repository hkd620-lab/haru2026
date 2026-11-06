# 현황 카드 브라우저 회귀 검사

프런트 의존성을 설치한 작업본에서 다음을 실행한다. 새 패키지는 필요하지 않다.

```sh
node test/month-progress-browser/build.mjs /private/tmp/haru-month-progress-check
python3 -m http.server 4317 --bind 127.0.0.1 --directory /private/tmp/haru-month-progress-check
```

브라우저 뷰포트를 **320×844**로 설정하고 `http://127.0.0.1:4317/`을 연다. 화면에 PASS 16개가 나타나야 한다. 다른 뷰포트에서 가격 검사를 320px 검증으로 기록하지 않는다.

실제 React 훅·카드·RefundPage를 실행하며 Firebase 인증·구독만 합성 어댑터로 바꾼다. 운영 계정·데이터·AI API를 사용하지 않는다. 로그인 지연, 계정 전환, 구독 정리, live region DOM 유지, 카드 넘침, 환불 화면의 세 진입 경로를 검사한다. 가격 검사는 LandingPage의 실제 가격 CSS를 추출해 320px 화면의 내부 카드 폭으로 확인한다. 전체 랜딩/실제 스크린리더 낭독 검증은 아니다.
