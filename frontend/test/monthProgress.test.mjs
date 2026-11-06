import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getCardFormat, getCardTitle, monthKeyOf, monthRangeLabel, nextMonthStart, normalizeUpdatedMs, selectMonthProgress, todayKeyOf,
} from '../src/app/records/monthProgress.ts';
import { createMonthProgressController, MONTH_PROGRESS_TIMEOUT_MS } from '../src/app/records/monthProgressController.ts';
import { STATS_MERGE_RECORD_FORMATS } from '../src/app/records/formatRegistry.ts';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
const read = (rel) => fs.readFileSync(path.join(appDir, rel), 'utf8');

const diary = (id, date, extra = {}) => ({ id, date, formats: ['일기'], diary_title: `${id} 제목`, ...extra });

// ───────────── 순수 계산 ─────────────

test('월 키·다음 달 1일·기간 문구·오늘 키', () => {
  assert.equal(monthKeyOf('2026-11-06'), '2026-11');
  assert.equal(nextMonthStart('2026-11'), '2026-12-01');
  assert.equal(nextMonthStart('2026-12'), '2027-01-01');
  assert.equal(nextMonthStart('2026-01'), '2026-02-01');
  assert.equal(monthRangeLabel('2026-11-06'), '11월 1일~6일');
  assert.equal(monthRangeLabel('2026-11-01'), '11월 1일');
  assert.equal(todayKeyOf(new Date(2026, 10, 6, 23, 59)), '2026-11-06');
});

test('비서 기록과 11종이 아닌 문서는 세지 않고, 11종 문서만 센다', () => {
  const docs = [
    diary('d1', '2026-11-03'),
    { id: 'chat', date: '2026-11-04', formats: ['메모'], source: 'result_ai_chat', memo_title: '대화 메모' },
    { id: 'tl', date: '2026-11-04', formats: ['성장타임라인'], recordType: 'growthTimeline' },
    { id: 'hh', date: '2026-11-01', formats: ['HARU가계부'], household_title: '가계부' },
    { id: 'ledger', date: '2026-11-02', formats: ['HARU보조장부'] },
    { id: 'stock', date: '2026-11-02', formats: ['주식거래일지'] },
    { id: 'growth', date: '2026-11-02', formats: ['성장기록'] },
    { id: 'void', date: '2026-11-02', formats: ['배뇨일지'] },
    { id: 'sns', date: '2026-11-02', formats: ['diary'] },
    { id: 'noformats', date: '2026-11-02', diary_simple: '형식 배열 없는 옛 문서' },
    { id: 'ailog', type: 'ai_log', formats: ['메모'], date: '2026-11-02' },
  ];
  const result = selectMonthProgress(docs, '2026-11-06');
  assert.equal(result.count, 1);
  assert.deepEqual(result.recent.map((entry) => entry.id), ['d1']);
});

test('한 문서에 형식이 여럿이어도 1편이고, 같은 id가 두 번 와도 한 번만 센다', () => {
  const multi = { id: 'm1', date: '2026-11-05', formats: ['일기', '메모'], diary_title: '여러 형식' };
  const result = selectMonthProgress([multi, multi, diary('d2', '2026-11-05')], '2026-11-06');
  assert.equal(result.count, 2);
  assert.equal(result.recent.find((entry) => entry.id === 'm1').format, '일기');
});

test('월초~오늘만 센다: 오늘 이후·지난달 문서는 제외, 시각이 붙은 날짜 문자열은 센다, Timestamp 날짜는 세지 않는다', () => {
  const docs = [
    diary('today', '2026-11-06'),
    diary('first', '2026-11-01'),
    diary('future', '2026-11-07'),
    diary('prev', '2026-10-31'),
    diary('withtime', '2026-11-06T09:30:00+09:00'),
    { id: 'ts', date: { seconds: 1793000000 }, formats: ['일기'] },
    { id: 'nodate', formats: ['일기'] },
  ];
  const result = selectMonthProgress(docs, '2026-11-06');
  assert.deepEqual(new Set(result.recent.map((entry) => entry.id)), new Set(['today', 'withtime', 'first']));
  assert.equal(result.count, 3);
  // 자정을 넘겨 오늘 키가 바뀌면 같은 문서에서 새 날짜 기록이 들어온다(재구독 없이 화면 집계만 새로)
  assert.equal(selectMonthProgress(docs, '2026-11-07').count, 4);
});

test('최근 3건: 날짜 내림차순, 같은 날은 updatedAt(ISO·Timestamp·null)·id 순', () => {
  const docs = [
    diary('a', '2026-11-05', { updatedAt: '2026-11-05T01:00:00.000Z' }),
    diary('b', '2026-11-05', { updatedAt: { toMillis: () => Date.parse('2026-11-05T05:00:00.000Z') } }),
    diary('c', '2026-11-05', { updatedAt: null }),
    diary('d', '2026-11-04', { updatedAt: '2026-11-04T23:00:00.000Z' }),
    diary('e', '2026-11-06'),
  ];
  const result = selectMonthProgress(docs, '2026-11-06');
  assert.equal(result.count, 5);
  assert.deepEqual(result.recent.map((entry) => entry.id), ['e', 'b', 'a']);
  // id 로만 갈리는 경우
  const tie = selectMonthProgress([diary('x1', '2026-11-05'), diary('x2', '2026-11-05')], '2026-11-06');
  assert.deepEqual(tie.recent.map((entry) => entry.id), ['x2', 'x1']);
});

test('updatedAt 정규화: ISO 문자열, Timestamp, seconds 객체, null·이상한 값', () => {
  assert.equal(normalizeUpdatedMs('2026-11-05T05:00:00.000Z'), Date.parse('2026-11-05T05:00:00.000Z'));
  assert.equal(normalizeUpdatedMs({ toMillis: () => 123 }), 123);
  assert.equal(normalizeUpdatedMs({ seconds: 10, nanoseconds: 5_000_000 }), 10005);
  for (const value of [null, undefined, '쓰기 대기', {}, NaN, 7]) assert.equal(normalizeUpdatedMs(value), 0);
});

test('카드 형식은 formats 순서에서 처음 나오는 11종, 비서·11종 밖이면 null', () => {
  assert.equal(getCardFormat({ id: 'x', formats: ['HARU가계부', '메모', '일기'] }), '메모');
  assert.equal(getCardFormat({ id: 'x', formats: ['HARU가계부'] }), null);
  assert.equal(getCardFormat({ id: 'x', formats: ['메모'], source: 'result_ai_chat' }), null);
  assert.equal(getCardFormat({ id: 'x' }), null);
});

test('제목: 형식별 제목 칸 → 독서사유 책 제목 → 원문 첫 줄 → (내용 없음), 20자 제한', () => {
  assert.equal(getCardTitle({ diary_title: '  산책한   하루  ' }, '일기'), '산책한 하루');
  assert.equal(getCardTitle({ memo_title: '병원 예약 확인' }, '메모'), '병원 예약 확인');
  assert.equal(getCardTitle({ reading_book_title: '어린 왕자', reading_journal: '본문' }, '독서사유'), '어린 왕자');
  assert.equal(getCardTitle({ reading_journal: '\n\n첫 줄 소감\n둘째 줄' }, '독서사유'), '첫 줄 소감');
  assert.equal(getCardTitle({ diary_simple: '간편 본문입니다\n둘째' }, '일기'), '간편 본문입니다');
  assert.equal(getCardTitle({}, '일기'), '(내용 없음)');
  const long = getCardTitle({ diary_title: '가'.repeat(30) }, '일기');
  assert.equal(Array.from(long).length, 20);
  const emoji = getCardTitle({ diary_title: '😀'.repeat(25) }, '일기');
  assert.equal(Array.from(emoji).length, 20, '이모지(서로게이트 쌍)를 반으로 자르지 않는다');
});

// ───────────── 구독 컨트롤러 ─────────────

function harness(initialToday = '2026-11-06') {
  let today = initialToday;
  let nowMs = 1000;
  let nextTimer = 1;
  const timers = new Map();
  const subs = [];
  const deps = {
    subscribe: (uid, monthKey, onNext, onError) => {
      // 실제 SDK 처럼 오류 콜백을 부른 뒤 리스너는 끝난다.
      const sub = { uid, monthKey, onNext, active: true, onError: (error) => { sub.active = false; onError(error); } };
      subs.push(sub);
      return () => { sub.active = false; };
    },
    todayKey: () => today,
    now: () => nowMs,
    setTimer: (callback, ms) => { const id = nextTimer++; timers.set(id, { callback, ms }); return id; },
    clearTimer: (id) => { timers.delete(id); },
  };
  const views = [];
  const controller = createMonthProgressController(deps, (view) => views.push(view));
  return {
    controller, subs, timers, views,
    setToday: (value) => { today = value; },
    setNow: (value) => { nowMs = value; },
    active: () => subs.filter((sub) => sub.active),
    fireTimers: () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } },
  };
}

const snapshot = (docs, { fromCache = false, hasPendingWrites = false } = {}) => ({
  docs: docs.map(({ id, ...rest }) => ({ id, data: () => rest })),
  metadata: { fromCache, hasPendingWrites },
});

test('서버 확정 전에는 숫자를 숨기고(캐시 스냅샷의 대기 중 쓰기 문서 포함), 확정 뒤 보여 준다', () => {
  const h = harness();
  h.controller.start('u1');
  assert.equal(h.active().length, 1);
  assert.equal(h.active()[0].monthKey, '2026-11');
  assert.equal(h.controller.getView().hasConfirmed, false);
  assert.equal(h.controller.getView().status, 'loading');

  h.active()[0].onNext(snapshot([diary('n1', '2026-11-06')], { fromCache: true, hasPendingWrites: true }));
  assert.equal(h.controller.getView().hasConfirmed, false, '캐시 스냅샷의 부분 수는 숨긴다');
  assert.equal(h.controller.getView().status, 'loading');

  h.setNow(5000);
  h.active()[0].onNext(snapshot([diary('n1', '2026-11-06'), diary('n2', '2026-11-05')]));
  const view = h.controller.getView();
  assert.equal(view.hasConfirmed, true);
  assert.equal(view.status, 'ready');
  assert.equal(view.count, 2);
  assert.equal(view.lastConfirmedAt, 5000);
  assert.equal(h.timers.size, 0, '서버 확정을 받으면 8초 타이머를 지운다');
});

test('확정 뒤 대기 중 쓰기 스냅샷은 값을 갱신하고 로딩으로 되돌아가지 않는다', () => {
  const h = harness();
  h.controller.start('u1');
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05')]));
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05'), diary('b', '2026-11-06')], { hasPendingWrites: true }));
  assert.equal(h.controller.getView().count, 2);
  assert.equal(h.controller.getView().status, 'ready');
  assert.equal(h.controller.getView().hasConfirmed, true);
});

test('확정 뒤 오프라인(fromCache)은 마지막 값을 유지하고 실패로 넘기지 않으며 마지막 확정 시각을 지킨다', () => {
  const h = harness();
  h.controller.start('u1');
  h.setNow(7000);
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05')]));
  h.setNow(9000);
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05')], { fromCache: true }));
  const view = h.controller.getView();
  assert.equal(view.status, 'ready');
  assert.equal(view.stale, true);
  assert.equal(view.count, 1);
  assert.equal(view.lastConfirmedAt, 7000, '마지막 !fromCache 스냅샷 시각');
  h.setNow(12000);
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05')]));
  assert.equal(h.controller.getView().stale, false);
  assert.equal(h.controller.getView().lastConfirmedAt, 12000);
});

test('8초 안에 서버 확정이 없으면 실패로 넘기되 리스너는 살아 있고, 늦은 확정이 오면 회복한다', () => {
  const h = harness();
  h.controller.start('u1');
  assert.equal([...h.timers.values()][0].ms, MONTH_PROGRESS_TIMEOUT_MS);
  assert.equal(MONTH_PROGRESS_TIMEOUT_MS, 8000);
  h.fireTimers();
  assert.equal(h.controller.getView().status, 'error');
  assert.equal(h.controller.getView().hasConfirmed, false);
  assert.equal(h.active().length, 1, '시간 초과로 리스너를 끊지 않는다');
  h.active()[0].onNext(snapshot([diary('late', '2026-11-06')]));
  assert.equal(h.controller.getView().status, 'ready');
  assert.equal(h.controller.getView().count, 1);
});

test('오류 콜백은 실패 상태이고, 다시 시도는 기존 구독을 해제한 뒤 새로 열어 활성 구독이 1개다', () => {
  const h = harness();
  h.controller.start('u1');
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05'), diary('b', '2026-11-06')]));
  h.active()[0].onError(new Error('permission-denied'));
  let view = h.controller.getView();
  assert.equal(view.status, 'error');
  assert.equal(view.hasConfirmed, true);
  assert.equal(view.count, 2, '같은 세션 키 안에서는 확정한 값을 유지한다');
  assert.equal(h.active().length, 0, '오류 뒤 SDK 리스너는 끝난다');

  h.controller.retry();
  assert.equal(h.active().length, 1);
  view = h.controller.getView();
  assert.equal(view.status, 'loading');
  assert.equal(view.count, 2, '다시 확인하는 동안 값을 유지');
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05'), diary('b', '2026-11-06'), diary('c', '2026-11-06')]));
  assert.equal(h.controller.getView().status, 'ready');
  assert.equal(h.controller.getView().count, 3);
  assert.equal(h.subs.length, 2);
});

test('시간 초과로 실패한 상태에서 다시 시도하면 살아 있던 기존 리스너를 먼저 해제한다', () => {
  const h = harness();
  h.controller.start('u1');
  h.fireTimers();
  assert.equal(h.active().length, 1);
  const first = h.subs[0];
  h.controller.retry();
  assert.equal(first.active, false, '기존 리스너 해제');
  assert.equal(h.active().length, 1, '활성 구독은 항상 1개');
  assert.notEqual(h.active()[0], first);
});

test('이전 구독의 늦은 콜백은 무시한다(계정 변경·재시도)', () => {
  const h = harness();
  h.controller.start('u1');
  const old = h.active()[0];
  h.controller.start('u2');
  assert.equal(old.active, false);
  assert.equal(h.controller.getView().uid, 'u2');
  old.onNext(snapshot([diary('leak', '2026-11-06')]));
  old.onError(new Error('stale'));
  assert.equal(h.controller.getView().hasConfirmed, false, '이전 계정의 결과는 새 계정 상태에 들어오지 않는다');
  assert.equal(h.controller.getView().count, 0);
  assert.equal(h.controller.getView().status, 'loading');
});

test('계정이 바뀌면 이전 확정 값을 버린다(같은 세션 키만 값 유지)', () => {
  const h = harness();
  h.controller.start('u1');
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05')]));
  h.controller.start('u2');
  const view = h.controller.getView();
  assert.equal(view.hasConfirmed, false);
  assert.equal(view.count, 0);
  assert.equal(view.recent.length, 0);
  assert.equal(view.sessionKey, 'u2:2026-11');
});

test('같은 계정·같은 달로 start 를 되풀이해도 다시 구독하지 않는다', () => {
  const h = harness();
  h.controller.start('u1');
  h.controller.start('u1');
  h.controller.start('u1');
  assert.equal(h.subs.length, 1);
});

test('자정을 넘겨 같은 달 안에서 날짜만 바뀌면 재구독 없이 새 날짜 기록이 들어온다', () => {
  const h = harness('2026-11-06');
  h.controller.start('u1');
  const docs = [diary('a', '2026-11-05'), diary('b', '2026-11-07')]; // 서버 상한이 다음 달 1일 미만이라 이미 구독 결과에 있다
  h.active()[0].onNext(snapshot(docs));
  assert.equal(h.controller.getView().count, 1, '오늘(11-06) 이후 문서는 화면 집계에서 거른다');
  h.setToday('2026-11-07');
  h.controller.refreshToday();
  assert.equal(h.subs.length, 1, '날짜만 바뀌었으니 다시 구독하지 않는다');
  assert.equal(h.controller.getView().todayKey, '2026-11-07');
  assert.equal(h.controller.getView().count, 2);
  assert.equal(h.controller.getView().hasConfirmed, true);
});

test('1분마다 오늘 키를 다시 계산해도(같은 날) 다시 구독하지 않는다', () => {
  const h = harness();
  h.controller.start('u1');
  h.active()[0].onNext(snapshot([diary('a', '2026-11-05')]));
  for (let i = 0; i < 90; i += 1) h.controller.refreshToday();
  assert.equal(h.subs.length, 1);
});

test('월이 바뀌면 새 월로 다시 구독하고 지난달 값은 그리지 않는다', () => {
  const h = harness('2026-11-30');
  h.controller.start('u1');
  h.active()[0].onNext(snapshot([diary('a', '2026-11-29')]));
  assert.equal(h.controller.getView().count, 1);
  h.setToday('2026-12-01');
  h.controller.refreshToday();
  assert.equal(h.subs.length, 2);
  assert.equal(h.subs[0].active, false);
  assert.equal(h.active()[0].monthKey, '2026-12');
  const view = h.controller.getView();
  assert.equal(view.sessionKey, 'u1:2026-12');
  assert.equal(view.hasConfirmed, false);
  assert.equal(view.count, 0, '재구독 직전·직후에 지난달 결과를 그리지 않는다');
  // 이전 구독의 늦은 스냅샷은 무시한다
  h.subs[0].onNext(snapshot([diary('old', '2026-11-29')]));
  assert.equal(h.controller.getView().count, 0);
});

test('화면 복귀 등으로 refreshToday 가 불려도 월이 같으면 아무 것도 새로 열지 않고, 다른 달이면 연다', () => {
  const h = harness('2026-11-06');
  h.controller.start('u1');
  h.controller.refreshToday();
  assert.equal(h.subs.length, 1);
  h.setToday('2027-01-01');
  h.controller.refreshToday();
  assert.equal(h.subs.length, 2);
  assert.equal(h.active()[0].monthKey, '2027-01');
});

test('stop 은 구독과 타이머를 정리하고 이후 콜백을 무시한다', () => {
  const h = harness();
  h.controller.start('u1');
  const sub = h.active()[0];
  h.controller.stop();
  assert.equal(sub.active, false);
  assert.equal(h.timers.size, 0);
  sub.onNext(snapshot([diary('late', '2026-11-06')]));
  assert.equal(h.controller.getView().sessionKey, null);
  assert.equal(h.controller.getView().count, 0);
});

// ───────────── 소스 점검 ─────────────

test('카드·훅·계산 모듈은 읽기 전용이다: 쓰기·새 컬렉션·AI 호출이 없다', () => {
  for (const rel of ['records/monthProgress.ts', 'records/monthProgressController.ts', 'hooks/useMonthRecordProgress.ts', 'components/MonthProgressCard.tsx']) {
    const src = read(rel);
    assert.doesNotMatch(src, /\b(setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction|serverTimestamp)\b/, `${rel}: 쓰기 API 없음`);
    assert.doesNotMatch(src, /httpsCallable|getFunctions|functions\./, `${rel}: Functions·AI 호출 없음`);
  }
  const hook = read('hooks/useMonthRecordProgress.ts');
  assert.match(hook, /collection\(db, 'users', uid, 'records'\)/, '기존 기록 컬렉션만 읽는다');
  assert.equal([...hook.matchAll(/collection\(/g)].length, 1, '컬렉션은 하나뿐');
  assert.match(hook, /where\('date', '>=', `\$\{monthKey\}-01`\)/);
  assert.match(hook, /where\('date', '<', nextMonthStart\(monthKey\)\)/);
  assert.match(hook, /orderBy\('date', 'desc'\)/);
});

test('훅의 effect 의존값은 uid·enabled 뿐이다(1분마다 재구독하지 않는다)', () => {
  const hook = read('hooks/useMonthRecordProgress.ts');
  assert.match(hook, /\}, \[uid, enabled\]\);/);
  assert.doesNotMatch(hook, /useEffect\([\s\S]*?\}, \[[^\]]*(now|todayKey|monthKey)[^\]]*\]\)/);
});

test('홈은 카드를 홈이 마운트된 동안 구독하고 내 하루기록 탭에서만 그린다', () => {
  const home = read('pages/HomePageV2.tsx');
  assert.match(home, /useMonthRecordProgress\(\{ uid: currentUserUid, enabled: Boolean\(currentUserUid\) && onboardingGateReady \}\)/);
  assert.match(home, /homeViewMode === 'my' && currentUserUid && onboardingGateReady && \(\s*<MonthProgressCard/);
  assert.equal([...home.matchAll(/useMonthRecordProgress\(/g)].length, 1, '구독 훅은 홈 한 곳에서만 호출');
  assert.equal([...home.matchAll(/<MonthProgressCard/g)].length, 1);
});

test('카드의 기록 행은 SAYU 열기 상태(한글 형식명 + 문서 id)로 이동하고, 이 상태를 SAYU가 읽는다', () => {
  const home = read('pages/HomePageV2.tsx');
  assert.match(home, /onOpenRecord=\{\(entry\) => navigate\('\/sayu', \{ state: \{ filterFormat: entry\.format, openRecordId: entry\.id \} \}\)\}/);
  const sayu = read('pages/SayuPage.tsx');
  assert.match(sayu, /routeState\?\.filterFormat === 'string'/);
  assert.match(sayu, /routeState\?\.openRecordId === 'string'/);
  // 카드가 넘기는 11종 한글 형식명이 모두 SAYU 형식 라벨에 있어야 SAYU가 그 형식으로 연다
  const labels = sayu.slice(sayu.indexOf('const SAYU_FORMAT_LABELS: string[] = ['), sayu.indexOf('];', sayu.indexOf('const SAYU_FORMAT_LABELS')));
  for (const format of STATS_MERGE_RECORD_FORMATS) assert.ok(labels.includes(`'${format}'`), `SAYU 라벨에 ${format}`);
});

test('카드 문구: 약속 문구 없음, 0건·실패 문구와 접근성 속성이 있다', () => {
  const card = read('components/MonthProgressCard.tsx');
  assert.doesNotMatch(card, /월간 생활문서|편째|문서까지/);
  assert.match(card, /이번 달 아직 남긴 기록이 없어요\. 오늘의 한 줄부터 시작해 보세요\./);
  assert.match(card, /aria-busy="true"/);
  assert.match(card, /role="alert"/);
  assert.match(card, /aria-live="polite"/);
  assert.match(card, /마지막으로 확인한 시각/);
  assert.match(card, /<button\s+type="button"\s+onClick=\{\(\) => onOpenRecord\(entry\)\}/);
  // 숫자는 서버 확정 뒤에만: 확정 전 분기가 count 보다 먼저 온다
  assert.ok(card.indexOf('!hasConfirmed') < card.indexOf('{count}편'));
});
