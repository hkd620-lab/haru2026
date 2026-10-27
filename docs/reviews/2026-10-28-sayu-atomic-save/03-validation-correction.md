# 기준 테스트 검증 정정과 보완 근거

- 기준 main: 601b743792f10cf010f56de887dccfdfdb21ce8f.
- 독립 검토 1의 필수 수정 ② 반영. 최초 보고에서 기준과 현재의 오류가 모두 같다고 쓴 것은 최초 기준 로그에 한해 부정확했다.
- 최초 기준 추출은 frontend/src와 frontend/test만 포함했다. package.json·tsconfig가 없는 환경에서 30개 중 23개 통과, 7개 실패했으나, 6개는 SyntaxError Unexpected token default, 1개만 ReferenceError isSpecialDayRecord였다.
- 최초 로그: /private/tmp/haru-atomic-baseline-tests.log. 현재 로그: /private/tmp/haru-atomic-current-tests.log. 최초 로그를 수정하거나 삭제하지 않았다.
- 같은 main의 frontend/package.json·tsconfig.json을 임시 기준 폴더에 추가하고 재실행했다. node_modules는 현재 설치본을 연결해 현재 테스트와 같은 의존성을 사용했다. 저장소 작업 파일의 restore/stash/덮어쓰기는 없었다.
- 재실행: 임시 기준 frontend에서 `node --import tsx --test test/sayuGrowthTimeline.test.mjs test/assistantSavedResultOpen.test.mjs`.
- 교정 후 기준·현재 모두 30개 중 23개 통과·7개 실패하며, 7건 모두 `ReferenceError: isSpecialDayRecord is not defined`다. 로그: /private/tmp/haru-atomic-baseline-corrected-tests.log.
- 위 오류는 함수 소스를 잘라 실행하는 하네스에 도우미가 주입되지 않은 경계다. 이번 수정은 해당 열기 함수·하네스를 변경하지 않는다. 기존 오류 수정은 이번 범위 밖이다.

## 비차단 권고 대조

- main SayuModal.tsx:1410-1428에서도 제목을 바꾸지 않아도 titleUpdate[formatKey_title]에 editedTitle.trim()을 저장했다. 가계부 표시용 제목을 저장하는 동작은 이번에 새로 도입하지 않았다.
- main SayuPage.tsx:2719와 SayuModal.tsx:1442 부근 모두 success toast가 있다. 성공 안내 중복은 기존 동작이므로 이번 범위에서 바꾸지 않는다.
- frontend/node_modules/.bin/tsc가 설치되어 있지 않다. build는 Vite 변환이며 tsc 타입검사를 대신한다고 주장하지 않는다. 타입검사를 위해 의존성을 추가하지 않았다.
- 운영 E2E 미실시. 병합·운영 배포 승인 없음.
