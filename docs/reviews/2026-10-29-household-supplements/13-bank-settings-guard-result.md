# 13. 은행 화면 가계부 설정 비동기 경계 보완 결과

요청: `12-bank-settings-guard-request.txt`. 범위는 FormatModal의 가계부 설정 상태/effect/직접 추가와 은행 파일 파싱 후 제안 구간, 좁은 보조 함수 1개, 회귀 테스트. 다른 기록 형식·사진 처리·인증 처리, protected 파일·Rules·Functions·AI·데이터 경로·결제는 바꾸지 않았다. 새 데이터 경로·운영 쓰기 없음. 커밋/push/PR 없음.

## 1. 요청별 반영

| # | 위험 | 반영 | 위치 |
|---|---|---|---|
| 1 | 늦게 끝난 최초 분류 조회가 직접 추가 트랜잭션 결과를 과거 값으로 덮음 | Dashboard와 같은 수정 번호(`householdCategoryRevision`)를 둔다. 트랜잭션/새 조회 결과를 반영할 때(`keepHouseholdCategories`) 번호를 올리고, 최초 조회는 시작 시 번호와 같을 때만 반영한다. | `FormatModal.tsx` 설정 블록 |
| 1 | 계정·모달 전환 뒤 늦은 결과와 이전 분류명 toast | `ownsHouseholdSession(uid, session)`: 렌더마다 갱신하는 현재 uid ref와 기존 `photoEditorSessionRef`(isOpen/format/recordId/uid 변경 시 증가)를 함께 확인한다. 직접 추가의 then/catch, 최초 조회의 then/catch 모두 이 확인을 통과해야 상태 반영이나 toast를 한다. | 같은 블록 |
| 1 | 설정 읽기 실패가 완전 무음 | 현재 계정/세션일 때만 `분류 설정을 불러오지 못해 기본 분류로 표시합니다.`를 한 번 표시한다(effect 실행당 1회). | 같은 블록 |
| 2 | 파일 처리에서 파일을 고른 렌더의 오래된 `householdCategoryViews` closure로 제안 | 파싱이 끝난 뒤, 첫 중복 확인 전에 `readHouseholdSuggestionBasis`로 그 uid의 분류 설정과 거래처 규칙을 함께 새로 읽고, 그 결과의 views/rules로 제안한다. 세션/계정이 바뀌었으면 결과를 버린다. 새로 읽은 설정은 수정 번호가 그대로일 때만 화면 설정에도 반영한다. | `handleKakaoXlsxDecryptAndParse` |
| 2 | 분류 설정 실패 시 보관 여부 모르는 규칙 적용 | 보조 함수가 설정 실패 시 `rules: []`, 기본 분류 views, `failed: true`를 돌려준다. 규칙만 실패해도 `rules: []`. 실패하면 `분류 설정이나 거래처 분류 기억을 불러오지 못해 기본 분류로 표시합니다. 파일을 다시 선택하면 다시 불러옵니다.`를 표시한다. 구분 변경에서 쓰는 `householdImportRulesRef`에도 같은 규칙(실패 시 빈 목록)을 넣는다. | `householdVendorRules.ts` `readHouseholdSuggestionBasis` |
| 2 | 저장된 거래/원본 식별키 영향 | 제안은 저장 전 새 행의 `import-default`/빈 분류에만 적용된다(기존 `suggestHouseholdCategory` 그대로). id·`importSource.key`는 바뀌지 않음을 테스트로 고정했다. 저장 서비스는 변경 없음. | 테스트 |

보조 함수는 로더 두 개를 인자로 받아 `Promise.allSettled`로 함께 읽는다. Firestore 경로는 기존 `loadHouseholdCategories`/`loadHouseholdVendorRules` 그대로이며 읽기만 한다.

## 2. 테스트 변경

`frontend/test/householdCategories.test.mjs`에 2개 추가.
- `은행 파일 제안 기준은 최신 분류 설정과 규칙을 함께 읽고, 설정을 못 읽으면 규칙을 적용하지 않는다`: 새로 읽은 설정에서 보관된 분류는 제안하지 않음. 설정 실패 시 규칙 버림·기본 분류·failed. 규칙 실패 시 failed. 정상일 때 제안하며 id·원본 키 유지.
- `은행 화면의 분류 설정은 계정·편집 세션·수정 번호 경계 안에서만 반영한다`(소스 계약): 최초 조회 반영/실패 안내, 직접 추가 결과/toast의 경계 조건, 수정 번호 증가, 파싱 구간에서 새 기준이 `checkHouseholdDuplicates`보다 먼저 쓰이고 `householdCategoryViews` closure를 쓰지 않음.

두 테스트 모두 수정 전 코드에서는 실패한다(보조 함수 없음, 경계 조건 문자열 없음).

## 3. 검증 결과

| 항목 | 결과 |
|---|---|
| `node --import tsx --test test/householdCategories.test.mjs` | 10/10 통과 |
| 가계부 단위 테스트 10개 파일(amount, cashEntry, categories, dashboard, duplicates, edit, export, pdf, savePreview, summary) | 91/91 통과 |
| `git diff --check` | 출력 없음(통과). 미추적 파일 `householdVendorRules.ts`는 줄 끝 공백 검색 0건 |
| `FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs` | **미실행** — 도구 승인 필요로 차단. 기장 실행 필요. 변경은 읽기 경로 조합뿐이며 저장/편집 서비스는 바뀌지 않았다. |
| `npx tsc --noEmit -p .` | **미실행** — 도구 승인 필요로 차단 |
| `npm run build` | **미실행** — prebuild `validate:build-env`가 `VITE_FIREBASE_*` 환경 변수 없음으로 중단. `npx vite build` 직접 실행은 승인 필요로 차단 |

참고: `test/household*.test.mjs` 글롭으로 돌리면 에뮬레이터 파일 2개가 `FIRESTORE_EMULATOR_HOST` 없이 실패한다(이번 변경과 무관).

## 4. 남은 위험·판단 필요

- 파일 처리에서 분류 설정을 못 읽으면, 화면에 이미 불러온 설정이 있어도 규칙을 적용하지 않는다(요청대로 최신 보관 여부를 확인할 수 없으면 기본값). 재시도는 파일을 다시 선택하는 방식이다.
- 설정 실패 안내는 최초 조회와 파일 처리에서 각각 한 번씩 뜰 수 있다(서로 다른 시점의 다른 읽기).
- 타입 검사·빌드·SDK 에뮬레이터 테스트는 기장 실행이 필요하다.
