# 합성 성능 계측 재현

기준 소스 SHA는 `manifest.json`에 있다. 앱 코드·정책은 수정하지 않는다. 이 하네스는 전체 SayuPage나 실기기 E2E가 아니다.

1. 기준SHA 작업본에서 `npm ci`로 확보한 `frontend/node_modules` 또는 **동일 lockfile**의 기존 의존성을 사용한다. Node26.8.2, Chrome155, Apple M4에서 최초 실행했다.
2. 아래 명령으로 임시 번들을 만든다. prepare가 실제추천모듈을 번들하고 상세계산식·소스텍스트헬퍼를 추출한다. `source-adapter.ts`는 생성물이다.

```sh
HARU_BENCH_DEPS=/path/to/frontend/node_modules node docs/reviews/2026-10-19-issue279-performance-evidence/prepare.mjs /private/tmp/haru279-bench-site
python3 docs/reviews/2026-10-19-issue279-performance-evidence/serve.py /private/tmp/haru279-bench-site /private/tmp/haru279-chrome-results.json
```

3. 실제 Chrome에서 `http://127.0.0.1:18779/`를 열고 **계측 시작**을 한 번 누른다. 수분 걸릴 수 있다. 완료 표시는 `완료: Chrome 계측 결과 저장됨`이다. 서버가 지정JSON을 저장한다. 합성자료만localhost로 전송하며 운영데이터를 사용하지 않는다. CPUthrottling·다른벤치 동시 실행을 피하고 전원/활성상태 등 조건을 기록한다.
4. Chrome 완료 후 Node를 순차 실행한다.

```sh
node /private/tmp/haru279-bench-site/node.mjs /private/tmp/haru279-node-results.json
```

5. p50/p95와전체20표본은JSON에 저장된다. 순수함수/결합/캐시각3예열+20표본, React진단6렌더다. 모든길이는실제UTF-16길이로보고한다. `near`생성기는최초측정에서88,481자를생성했으므로100,000자사례로해석하지않는다.
6. `constructors-only`는 진단 동안만전역RegExp생성자를캐시하고복원한다. `phases`는 별도Proxy/test타이머계측이며원래p95표본과합치지않는다. `memo-stable`등은최소React컴포넌트에만적용한진단이다. 앱소스변경이아니다.
7. 결과ID는tail/head/composition/cache=law, none/near=빈배열이어야한다. same-ID본문갱신진단은calls2와visible `1:pet`를확인한다. 원시결과와기준소스SHA를함께보존한다.

이미보존한 `chrome-results.json`, `node-results.json`은 최초실행원문이다. `extracted-source-adapter.txt`는 그실행의추출어댑터로추적용이다. 읽기전용서버는사용후종료한다. 번들/node_modules/개인기록은커밋하지않는다.
