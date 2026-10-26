판정: 승인

`StatsPeriodPicker.tsx`의 `resolveStatsPeriod` 수정과 회귀 테스트 3개를 검토했습니다. 새로 생긴 회귀, 등급 우회, 날짜를 잘못 해석하는 차단 문제는 찾지 못했습니다. 이번 판정은 '수정 후 승인'이 아니므로 수정 후 승인 횟수는 3회 그대로입니다.

## 1. 수정 코드 확인

```ts
// StatsPeriodPicker.tsx:30-41
const legacyPeriod = !params.has('period') && start && end
  ? STATS_PERIOD_KEYS.find((key) => {
    if (key === 'custom') return false;
    const range = getStatsPeriodRange(key, today);
    return range.start === start && range.end === end;
  }) || 'custom'
  : null;
const period = legacyPeriod || parseStatsPeriod(params.get('period'));
...
return { period, range, locked: !canUseStatsPeriod(period, tier) };
```

- **옛 주소는 이제 날짜가 그대로 유지됩니다.** `period` 없이 `start`와 `end`가 모두 있으면 `custom`으로 바뀝니다. 그다음 `getStatsPeriodRange('custom', …)`가 넘겨받은 날짜를 그대로 씁니다(`recordStats.ts:151-155`). 그래서 `/stats/일기?start=2025-10-23&end=2026-10-23`은 이제 이번 달이 아니라 1년 범위로 해석됩니다.
- **명시적인 `period`가 있으면 예전과 똑같이 동작합니다.** `params.has('period')`가 참이면 수정 부분을 건너뛰고 기존 줄로 갑니다. 앱 안의 링크는 모두 `statsQuery()`로 만들어지고, 이 함수는 항상 `period`를 넣습니다(`StatsPeriodPicker.tsx:45`, `StatisticsPage.tsx:90,94`, `FormatStatisticsPage.tsx:103,132`). 그래서 지금 사용 중인 주소는 수정 부분에 들어가지 않습니다.
- **두 날짜 중 하나만 있으면 예전 동작 그대로입니다.** `legacyPeriod`가 `null`이 되어 기존처럼 `month`로 처리됩니다.
- **합본 화면에는 영향이 없습니다.** `MergePage`는 `resolveStatsPeriod`를 쓰지 않고 `getStatsPeriodRange`를 직접 부릅니다(`MergePage.tsx:143`). 이번 변경을 받는 곳은 `StatisticsPage`와 `FormatStatisticsPage` 두 곳뿐입니다.

## 2. 등급 우회 여부: 우회 경로 없음

- 기본 기간과 날짜가 정확히 같을 때만 그 기간(`week`/`month`/`quarter`/`year`)이 됩니다. 이 경우에도 그 기간의 등급을 `canUseStatsPeriod`로 확인합니다(`recordStats.ts:98-100`).
- 기본 기간과 다르면 모두 `custom`, 즉 프리미엄 전용으로 처리됩니다. 무료·베이직 사용자는 `locked`가 참이 됩니다.
- 잠기면 두 페이지 모두 기록을 불러오지 않습니다(`StatisticsPage.tsx:43`, `FormatStatisticsPage.tsx:68`).
- 결론적으로 옛 주소를 써도 등급보다 넓은 범위의 데이터를 받을 수 없습니다.
- 두 기간의 날짜가 같아지는 경우도 따져 봤습니다.
  - 매월 1일이 월요일이면 이번 주와 이번 달이 같습니다. 이때는 `find` 순서상 `week`가 고르는데, 둘 다 무료 기간입니다.
  - 1월에는 이번 달과 올해가 같습니다. 이때는 `month`가 골라져 더 낮은 등급으로 처리됩니다.
  - 그래서 날짜가 겹쳐도 원래보다 높은 등급을 요구하는 경우는 생기지 않습니다.

## 3. 검증 근거

- 테스트: `/private/tmp/haru-pr293-final-tests.log` → `tests 47 / pass 47 / fail 0`. 새로 추가한 3개 테스트(45-47행)도 통과했습니다.
- 빌드: `/private/tmp/haru-pr293-final-build.log:824` → `✓ built in 58.98s`.
- 타입: `find(...) || 'custom'`의 결과는 `StatsPeriodKey`이고, 빌드에서 타입 오류가 없었습니다.
- **직접 확인하지 못한 것:** 읽기 도구만 있어서 `git`으로 작업 트리와 `739a53b3`가 같은지 확인하지 못했습니다. 작업 트리의 실제 소스는 diff와 같았습니다. PR #293 CI 결과도 보지 못했으니, 병합 전에 확인해 주세요.

## 4. 규모·멈춤 조건·승인 범위

- **규모: 소규모입니다.** 버그 1개를 고쳤고, 바뀐 것은 함수 하나와 테스트뿐입니다.
- **멈춤 조건: 해당 없음.**
  - Functions, 저장 경로, Rules, 결제, 인증, AI 모델, 라우터 변경이 없습니다.
  - 커밋 메시지("이전 통계 주소의 날짜 범위 유지")가 실제 변경과 맞습니다.
- **승인 범위:** 이미 승인된 통계·합본 작업에서 운영 E2E 중 찾은 누락을 같은 기능 안에서 보완한 것입니다. 8.1절 판정①로 진행하면 되고, 대표 승인을 새로 받을 필요는 없다고 판단합니다.

## 5. 이번 변경에서 생긴 비차단 지적

1. **잘못된 날짜가 든 옛 주소는 잠금 화면이 됩니다.** 예를 들어 `?start=abc&end=xyz`처럼 `period`가 없고 날짜 형식이 틀리면 `custom`으로 바뀝니다. 날짜는 기본값(이번 달 1일~오늘)으로 대체됩니다. 무료·베이직 사용자는 예전에는 이번 달 통계를 그대로 봤는데, 이제는 잠금 안내를 봅니다. 앱 안에서는 이런 주소가 만들어지지 않아 영향은 작습니다. 필요하면 수정 부분 조건에 날짜 형식 검사(`/^\d{4}-\d{2}-\d{2}$/`)를 더하면 됩니다.
2. **예전에 이번 달이었던 주소도 시간이 지나면 잠깁니다.** 기본 기간과 일치하는지는 주소를 연 날짜 기준으로 판단합니다. 예를 들어 10월 15일에 만든 `start=2026-10-01&end=2026-10-15`를 10월 23일에 열면 `custom`이 되어 무료 사용자에게는 잠깁니다. 날짜 범위를 유지한다는 요구와 등급 정책을 그대로 따른 결과입니다. 다만 무료 사용자는 옛 책갈피를 못 쓰게 될 수 있으니 참고해 주세요.
3. **잠금 안내에 요청한 날짜가 보이지 않습니다.** 잠기면 범위 문구 대신 잠금 안내만 나옵니다(`StatsPeriodPicker.tsx:120-129`). 그래서 사용자는 옛 주소가 어떤 기간이었는지 알 수 없습니다. 사용성 문제이고 차단 사유는 아닙니다.
4. **코드 정리 한 가지:** 40행이 이미 받아 둔 `start`와 `end` 변수 대신 `params.get(...)`을 다시 부릅니다. 결과는 같습니다.

## 6. 이전부터 있던 문제 (차단 아님, 이전 판정 그대로)

- 옛 숫자 `_rating`이 0보다 크면 특별한 날로 봅니다(#291 정책).
- 합본 뷰어는 화면 이동 때 넘겨받은 값(`location.state`)에 의존하므로 새로고침하면 합본이 사라집니다.
- 쓰이지 않는 `'diary'` 대체값이 남아 있습니다. `MERGE_VIEWER_FORMATS`와 `STATS_MERGE_RECORD_FORMATS`를 하나로 통일하는 것을 후속 과제로 권합니다.
- 날짜 없는 옛 독서 회차 저장 경로, 독서 초안 안내도 후속 과제로 남아 있습니다.

## 7. 병합 전후 확인

1. PR #293 CI가 통과하는지 확인합니다.
2. 운영에서 같은 주소 `/stats/일기?start=2025-10-23&end=2026-10-23`를 엽니다.
   - 프리미엄 계정: '직접 선택'이 켜지고 범위가 2025-10-23 ~ 2026-10-23으로 표시되는지
   - 베이직·무료 계정: '직접 선택' 잠금 안내가 나오고 기록을 불러오지 않는지
3. `?period=month`처럼 기간을 명시한 주소가 예전과 같이 동작하는지 확인합니다.

저장소 파일 수정, Git 변경, Slack 게시, 배포는 하지 않았습니다. 이 세션에는 파일 쓰기 도구가 없어서 계획 파일(`/Users/heogyeongdae/.claude/plans/pr-293-melodic-sparkle.md`)도 만들지 않았습니다.