# 부모의 공식 문서 확인 — 2026-10-31

## React Router 8
https://reactrouter.com/upgrading/v7 (부모가공식본문직접조회)
- 최소Node22.22+, React/ReactDOM19.2.7+.
- v8은react-router-dom 재내보내기패키지를제거한다. 일반API는react-router, DOM전용API는react-router/dom으로옮긴다. 삭제되지않은7.xDOM을남기면혼용위험. 사용하지않는금지routes.tsx는건드리지않는다.
- 현재문서최신8.5.1표시. npm registry최종확인으로안정버전고정. 프레임워크전용future플래그를BrowserRouter앱에추가하지않는다.

## Vite8
https://vite.dev/guide/migration.html
- Rolldown/Oxc전환, optimizeDeps.esbuildOptions/build.rollupOptions호환/변경확인. 기본타깃상향되므로기존iOS13/PWA대상명시보존.

## sharp
https://sharp.pixelplumbing.com/changelog/v0.35.5/
- 공식changelog2026-09-27최신0.35.5. npm registry및native바이너리엔진확인필요.

## 음성API
https://developers.openai.com/api/docs/guides/text-to-speech
https://developers.openai.com/api/docs/deprecations
- tts-1과tts-1-hd는현재Speech API에서지원되나2027-01-06종료예정(공식2026-10-01공지). 현재요청한native기능의지원불가를뜻하지않는다. 모델/전체Realtime워크플로를이번승인없이임의대체하지않는다. 전환필요일을PR위험에기록.
- 기존6개voice nova/onyx/alloy/echo/fable/shimmer는두모델지원목록안에있다.
- 사용자에게실제사람의발음이라고오인시키지않게음성이AI생성임을알리는고음질듣기표시가필요. 기존원어민듣기라벨을그대로붙이기전에확인한다.
