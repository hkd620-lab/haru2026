// '내 영상 찾기' 서버 핵심 로직 시험. 실제 코드(src/videoFinderCore.ts)를 메모리 저장소·가짜 YouTube로 실행한다.
// 실행: npm run test:video-finder (네트워크·Firebase·키 사용 없음)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const core = require('../src/videoFinderCore.ts');

const {
  createVideoFinderService, evaluateQuotaReservation, resolveVideoFinderLimits, validateFilters, validatePageToken,
  periodBounds, buildSearchParams, dayKey, VideoFinderError, DAY_MS, META_REFRESH_AFTER_MS, META_MAX_AGE_MS,
  SEARCH_RESERVATION_UNITS, USER_QUOTA_TIME_ZONE, GLOBAL_QUOTA_TIME_ZONE, sanitizeVideoMeta, DATE_RELEVANCE_CURSOR,
  assertActiveAccount, planMetaUpdate, MAX_SAVED_PER_USER, META_PURGE_INTERVAL_HOURS, DEFAULT_VIDEO_FINDER_LIMITS,
  SEARCH_LIST_UNITS, issueStandaloneSession, createStandaloneGateway, hashSessionToken, accountKeyFor,
  VIDEO_FINDER_SESSION_TTL_MS, VIDEO_FINDER_STANDALONE_ORIGINS,
} = core;

const NOW = Date.UTC(2026, 10, 20, 3, 0, 0); // 2026-11-20 12:00 KST
const ON = { enabled: true, standaloneSignIn: true, userDailySearches: 3, globalDailyUnits: 5000 };
const ACTIVE = { consents: { terms: true } };
const AUTH_OK = { disabled: false, emailVerified: true, providerIds: ['google.com'], tokensValidAfterMs: null };

function vid(n) { return `vid${String(n).padStart(8, '0')}`; }

function meta(id, extra = {}) {
  return { videoId: id, title: `영상 ${id}`, channel: '채널', channelId: `ch_${id}`, publishedAt: '2026-11-01T00:00:00Z',
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, duration: 'PT5M', views: 10, subscribers: 1000, description: '', ...extra };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

// Firestore 저장소와 같은 계약: 각 메서드는 비동기 경계 뒤 읽기·판단·쓰기를 한 번에 한다(트랜잭션 원자성).
// 만들기·바꾸기는 매번 계정 상태를 확인하고, 바꾸기는 plan이 고른 필드만 반영하며 없는 문서는 만들지 않는다.
function memoryStore(limits = ON) {
  const users = new Map();
  const globalUnits = new Map();
  const accounts = new Map();
  const authUsers = new Map();
  const sessions = new Map();
  const u = (uid) => {
    if (!users.has(uid)) users.set(uid, { saved: new Map(), history: new Map(), quota: undefined });
    return users.get(uid);
  };
  const account = (uid) => (accounts.has(uid) ? accounts.get(uid) : ACTIVE);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  return {
    users, globalUnits, accounts, authUsers, sessions,
    limits,
    async getLimits() { return this.limits; },
    async reserveQuota(uid, units, countSearch, nowMs, lim) {
      await null; // 비동기 경계 뒤 읽기·판단·쓰기를 한 번에(트랜잭션과 같은 원자성)
      assertActiveAccount(account(uid));
      const userDay = dayKey(nowMs, USER_QUOTA_TIME_ZONE);
      const globalDay = dayKey(nowMs, GLOBAL_QUOTA_TIME_ZONE);
      const d = evaluateQuotaReservation({ user: u(uid).quota, global: globalUnits.get(globalDay), userDay, globalDay, units, countSearch, limits: lim });
      if (!d.ok) throw core.quotaErrorFor(d.reason);
      u(uid).quota = d.user;
      globalUnits.set(globalDay, d.global);
      return d.remainingSearches;
    },
    async listSaved(uid, limit) { return [...u(uid).saved.values()].map(clone).sort((a, b) => b.savedAt - a.savedAt).slice(0, limit); },
    async getSaved(uid, id) { const x = u(uid).saved.get(id); return x ? clone(x) : null; },
    async createSaved(uid, doc, max) {
      await null;
      assertActiveAccount(account(uid));
      const s = u(uid).saved;
      if (s.has(doc.videoId)) return { created: false, doc: clone(s.get(doc.videoId)) };
      if (s.size >= max) return { limitReached: true };
      s.set(doc.videoId, clone(doc));
      return { created: true, doc };
    },
    async updateSavedFields(uid, id, plan) {
      await null;
      assertActiveAccount(account(uid));
      const s = u(uid).saved;
      if (!s.has(id)) return { doc: null };
      const current = clone(s.get(id));
      const fields = plan(current);
      if (!fields) return { doc: current };
      const next = { ...current, ...clone(fields) };
      s.set(id, next);
      return { doc: clone(next) };
    },
    async deleteSaved(uid, id) { await null; return u(uid).saved.delete(id); },
    async listHistory(uid, limit) { return [...u(uid).history.values()].map(clone).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit); },
    async putHistory(uid, entry) { await null; assertActiveAccount(account(uid)); u(uid).history.set(entry.id, clone(entry)); },
    async trimHistory(uid, keep) {
      const sorted = [...u(uid).history.values()].sort((a, b) => b.createdAt - a.createdAt);
      sorted.slice(keep).forEach((h) => u(uid).history.delete(h.id));
    },
    async deleteHistory(uid, id) { if (id) u(uid).history.delete(id); else u(uid).history.clear(); },
    async deleteAll(uid) { u(uid).saved.clear(); u(uid).history.clear(); },
    async createSession(hash, record) {
      await null;
      assertActiveAccount(account(record.uid));
      if (sessions.has(hash)) throw new Error('already exists');
      sessions.set(hash, clone(record));
    },
    async getSession(hash) { return sessions.has(hash) ? clone(sessions.get(hash)) : null; },
    async deleteSession(hash) { sessions.delete(hash); },
    async getAccount(uid) {
      return { userData: account(uid), authUser: authUsers.has(uid) ? authUsers.get(uid) : AUTH_OK };
    },
  };
}

function fakeYouTube({ searchPages = [], details } = {}) {
  const calls = { search: [], details: [] };
  let i = 0;
  return {
    calls,
    async search(params) {
      calls.search.push(params);
      const page = searchPages[Math.min(i, searchPages.length - 1)] || { items: [] };
      i += 1;
      return typeof page === 'function' ? page(params) : page;
    },
    async videoDetails(ids) {
      calls.details.push(ids);
      if (this.gate) await this.gate;
      const out = {};
      for (const id of ids) {
        const m = details ? details(id) : meta(id);
        if (m) out[id] = m;
      }
      return out;
    },
  };
}

const items = (ids) => ({ items: ids.map((id) => ({ id: { videoId: id } })) });

function service(store, youtube, now = () => NOW) {
  return createVideoFinderService({ store, youtube, now });
}

const baseFilters = { query: '텃밭 토마토 지지대', category: '전체 분야', minSubscribers: 0, period: 'all', duration: 'any', sort: 'relevance' };

// ───── 계정 격리 ─────

test('A 계정의 보관·메모·이력·백업은 B 계정에 보이지 않고 B가 바꾸거나 지울 수 없다', async () => {
  const store = memoryStore();
  const yt = fakeYouTube({ searchPages: [items([vid(1)])] });
  const svc = service(store, yt);

  await svc.search('uidA', { filters: baseFilters });
  await svc.library('uidA', { action: 'save', video: meta(vid(1)), category: '건강' });
  await svc.library('uidA', { action: 'update', videoId: vid(1), changes: { note: '토요일에 해보기' } });

  const listA = await svc.library('uidA', { action: 'list' });
  assert.equal(listA.saved.length, 1);
  assert.equal(listA.saved[0].note, '토요일에 해보기');

  const listB = await svc.library('uidB', { action: 'list' });
  assert.deepEqual(listB.saved, []);
  assert.deepEqual((await svc.library('uidB', { action: 'history' })).history, []);
  const backupB = (await svc.library('uidB', { action: 'backup' })).backup;
  assert.equal(backupB.saved.length, 0);
  assert.equal(backupB.history.length, 0);
  assert.ok(!JSON.stringify(backupB).includes('토요일에 해보기'));

  await assert.rejects(svc.library('uidB', { action: 'update', videoId: vid(1), changes: { note: '덮어쓰기' } }),
    (e) => e instanceof VideoFinderError && e.code === 'not-found');
  assert.deepEqual(await svc.library('uidB', { action: 'remove', videoId: vid(1) }), { removed: false });
  await svc.library('uidB', { action: 'deleteHistory', historyId: null });
  await svc.library('uidB', { action: 'deleteAll', confirm: 'DELETE_MY_VIDEO_FINDER_DATA' });

  const afterA = await svc.library('uidA', { action: 'list' });
  assert.equal(afterA.saved[0].note, '토요일에 해보기');
  assert.equal((await svc.library('uidA', { action: 'history' })).history.length, 1);

  // 같은 영상을 B가 따로 담으면 B만의 메모를 가진다.
  await svc.library('uidB', { action: 'save', video: meta(vid(1)) });
  await svc.library('uidB', { action: 'update', videoId: vid(1), changes: { note: 'B의 메모' } });
  assert.equal((await svc.library('uidA', { action: 'list' })).saved[0].note, '토요일에 해보기');
  assert.equal((await svc.library('uidB', { action: 'list' })).saved[0].note, 'B의 메모');
});

test('서비스 입력에 uid를 넣어도 무시되고 호출자 uid만 사용한다', async () => {
  const store = memoryStore();
  const svc = service(store, fakeYouTube());
  await svc.library('uidA', { action: 'save', video: meta(vid(2)), uid: 'uidB' });
  assert.equal(store.users.get('uidA').saved.size, 1);
  assert.equal(store.users.has('uidB'), false);
});

test('전체 삭제는 확인 문구가 있어야 하고 자기 데이터만 지운다', async () => {
  const store = memoryStore();
  const svc = service(store, fakeYouTube());
  await svc.library('uidA', { action: 'save', video: meta(vid(3)) });
  await assert.rejects(svc.library('uidA', { action: 'deleteAll' }), (e) => e.code === 'invalid-argument');
  await svc.library('uidA', { action: 'deleteAll', confirm: 'DELETE_MY_VIDEO_FINDER_DATA' });
  assert.equal((await svc.library('uidA', { action: 'list' })).saved.length, 0);
});

// ───── 할당량: 외부 호출 전 선예약 ─────

test('운영 스위치가 꺼져 있으면 YouTube 호출은 0회이고 보관함은 열린다', async () => {
  const store = memoryStore(resolveVideoFinderLimits(null));
  const yt = fakeYouTube({ searchPages: [items([vid(1)])] });
  const svc = service(store, yt);
  await assert.rejects(svc.search('uidA', { filters: baseFilters }), (e) => e.code === 'failed-precondition');
  assert.equal(yt.calls.search.length, 0);
  const list = await svc.library('uidA', { action: 'list' });
  assert.equal(list.searchEnabled, false);
});

test('사용자 일일 한도를 넘으면 외부 호출 없이 쉬운 안내를 준다', async () => {
  const store = memoryStore();
  const yt = fakeYouTube({ searchPages: [items([vid(1)])] });
  const svc = service(store, yt);
  for (let i = 0; i < ON.userDailySearches; i += 1) await svc.search('uidA', { filters: baseFilters });
  await assert.rejects(svc.search('uidA', { filters: baseFilters }), (e) => e.code === 'resource-exhausted' && /내일/.test(e.message));
  assert.equal(yt.calls.search.length, ON.userDailySearches);
  // 다른 사용자는 자기 한도를 따로 쓴다.
  await svc.search('uidB', { filters: baseFilters });
  assert.equal(yt.calls.search.length, ON.userDailySearches + 1);
});

test('동시에 몰린 요청도 사용자·전체 한도를 넘겨 외부 호출하지 않는다', async () => {
  const store = memoryStore({ ...ON, userDailySearches: 100, globalDailyUnits: SEARCH_RESERVATION_UNITS * 4 });
  const yt = fakeYouTube({ searchPages: [items([vid(1)])] });
  const svc = service(store, yt);
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => svc.search(`uid${i % 3}`, { filters: baseFilters })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 4);
  assert.equal(yt.calls.search.length, 4);
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'resource-exhausted'));
});

test('사용자 한도는 한국 날짜, 전체 한도는 태평양 날짜로 초기화된다', () => {
  const limits = ON;
  const user = { day: '2026-11-19', count: 3 };
  const ok = evaluateQuotaReservation({ user, global: { day: '2026-11-19', units: 4990 }, userDay: '2026-11-20', globalDay: '2026-11-19', units: 102, countSearch: true, limits });
  assert.deepEqual(ok, { ok: false, reason: 'global' });
  const reset = evaluateQuotaReservation({ user, global: { day: '2026-11-18', units: 4990 }, userDay: '2026-11-20', globalDay: '2026-11-19', units: 102, countSearch: true, limits });
  assert.equal(reset.ok, true);
  assert.equal(reset.remainingSearches, 2);
  assert.equal(dayKey(NOW, USER_QUOTA_TIME_ZONE), '2026-11-20');
  assert.equal(dayKey(NOW, GLOBAL_QUOTA_TIME_ZONE), '2026-11-19');
});

test('운영 한도 설정은 범위를 벗어나면 안전한 값으로 고정된다', () => {
  assert.deepEqual(resolveVideoFinderLimits({ enabled: 'true', userDailySearches: 9999, globalDailyUnits: 999999 }),
    { enabled: false, standaloneSignIn: false, userDailySearches: 100, globalDailyUnits: 9500 });
});

// ───── 검색 규칙 (v0.3.1 유지) ─────

test('필수 조건: 전체 분야에서는 검색어가 필요하고 지원하지 않는 값은 거절한다', () => {
  assert.throws(() => validateFilters({ ...baseFilters, query: '' }), (e) => e.code === 'invalid-argument');
  assert.equal(validateFilters({ ...baseFilters, query: '', category: '건강' }).category, '건강');
  assert.throws(() => validateFilters({ ...baseFilters, sort: 'rating' }));
  assert.throws(() => validateFilters({ ...baseFilters, minSubscribers: 5 }));
  assert.throws(() => validateFilters({ ...baseFilters, period: 'custom' }));
  assert.throws(() => validateFilters({ ...baseFilters, period: 'custom', dateFrom: '2026-02-30' }));
  assert.throws(() => validateFilters({ ...baseFilters, period: 'custom', dateFrom: '2026-11-20', dateTo: '2026-11-01' }));
  assert.throws(() => validateFilters({ ...baseFilters, query: 'a'.repeat(201) }));
});

test('기간은 한국 날짜 0시 기준 UTC로 바뀌고 관심 분야가 검색어에 더해진다', () => {
  const f = validateFilters({ ...baseFilters, category: '건강', period: 'custom', dateFrom: '2026-11-01', dateTo: '2026-11-20' });
  assert.deepEqual(periodBounds(f, NOW), { after: '2026-10-31T15:00:00Z', before: '2026-11-20T15:00:00Z' });
  const { params } = buildSearchParams(f, '', NOW);
  assert.equal(params.q, '텃밭 토마토 지지대 건강');
  assert.equal(params.type, 'video');
  assert.equal(params.order, 'relevance');
  assert.equal('key' in params, false, '키는 검색 인자에 넣지 않는다');
});

test('페이지 토큰은 형식이 맞을 때만 받는다', () => {
  assert.equal(validatePageToken('CDIQAA'), 'CDIQAA');
  assert.equal(validatePageToken(`${DATE_RELEVANCE_CURSOR}CDIQAA`), `${DATE_RELEVANCE_CURSOR}CDIQAA`);
  assert.throws(() => validatePageToken('../x'));
  assert.throws(() => validatePageToken(5));
});

test('최신순 후보가 5개 미만이고 다음 페이지가 없으면 관련 후보로 한 번 보충하고 중복 없이 날짜순 정렬한다', async () => {
  const store = memoryStore();
  const dates = { [vid(1)]: '2025-12-19T00:00:00Z', [vid(2)]: '2026-11-11T00:00:00Z', [vid(3)]: '2026-10-30T00:00:00Z' };
  const yt = fakeYouTube({
    searchPages: [items([vid(1)]), { ...items([vid(1), vid(2), vid(3)]), nextPageToken: 'NEXT1' }],
    details: (id) => meta(id, { publishedAt: dates[id] }),
  });
  const svc = service(store, yt);
  const result = await svc.search('uidA', { filters: { ...baseFilters, sort: 'date' } });
  assert.equal(yt.calls.search.length, 2);
  assert.equal(yt.calls.search[0].order, 'date');
  assert.equal(yt.calls.search[1].order, 'relevance');
  assert.deepEqual(result.videos.map((v) => v.videoId), [vid(2), vid(3), vid(1)]);
  assert.equal(result.nextPageToken, `${DATE_RELEVANCE_CURSOR}NEXT1`);
  assert.ok(/최신/.test(result.notice));

  const next = await svc.search('uidA', { filters: { ...baseFilters, sort: 'date' }, pageToken: result.nextPageToken });
  assert.equal(yt.calls.search[2].order, 'relevance');
  assert.equal(yt.calls.search[2].pageToken, 'NEXT1');
  assert.ok(next);
  // 다음 페이지는 이력을 새로 만들지 않는다.
  assert.equal((await svc.library('uidA', { action: 'history' })).history.length, 1);
});

test('보충 예약이 거절되면 첫 결과를 그대로 보여준다', async () => {
  const store = memoryStore({ ...ON, globalDailyUnits: SEARCH_RESERVATION_UNITS });
  const yt = fakeYouTube({ searchPages: [items([vid(1)])] });
  const svc = service(store, yt);
  const result = await svc.search('uidA', { filters: { ...baseFilters, sort: 'date' } });
  assert.equal(yt.calls.search.length, 1);
  assert.deepEqual(result.videos.map((v) => v.videoId), [vid(1)]);
});

test('구독자 조건은 숨김 채널을 빼고 구독자순 정렬을 적용한다', async () => {
  const store = memoryStore();
  const subs = { [vid(1)]: 50000, [vid(2)]: null, [vid(3)]: 2000000 };
  const yt = fakeYouTube({ searchPages: [items([vid(1), vid(2), vid(3)])], details: (id) => meta(id, { subscribers: subs[id] }) });
  const result = await service(store, yt).search('uidA', { filters: { ...baseFilters, minSubscribers: 10000, sort: 'subscribers' } });
  assert.deepEqual(result.videos.map((v) => v.videoId), [vid(3), vid(1)]);
});

test('같은 조건의 검색 기록은 하나로 합쳐지고 최근 50개만 남는다', async () => {
  const store = memoryStore({ ...ON, userDailySearches: 100 });
  let t = NOW;
  const svc = service(store, fakeYouTube({ searchPages: [items([])] }), () => (t += 1000));
  await svc.search('uidA', { filters: baseFilters });
  await svc.search('uidA', { filters: { ...baseFilters, query: '  텃밭   토마토 지지대 ' } });
  assert.equal((await svc.library('uidA', { action: 'history' })).history.length, 1);
  store.limits = { ...ON, userDailySearches: 100, globalDailyUnits: 9500 };
  for (let i = 0; i < 55; i += 1) await svc.search('uidA', { filters: { ...baseFilters, query: `검색 ${i}` } });
  const history = (await svc.library('uidA', { action: 'history' })).history;
  assert.equal(history.length, 50);
  assert.equal(history[0].query, '검색 54');
});

// ───── 보관·메모 입력 검증과 영상 정보 보관 기한 ─────

test('보관 정보는 정리하고, 메모·태그 한도를 지킨다', async () => {
  const store = memoryStore();
  const svc = service(store, fakeYouTube());
  const cleaned = sanitizeVideoMeta({ ...meta(vid(5)), thumbnail: 'https://evil.example/x.png', title: '<b>제목</b>\u0000' });
  assert.equal(cleaned.thumbnail, '');
  assert.equal(cleaned.title, '<b>제목</b>');
  await assert.rejects(svc.library('uidA', { action: 'save', video: { videoId: '../../x' } }), (e) => e.code === 'invalid-argument');
  await svc.library('uidA', { action: 'save', video: meta(vid(5)) });
  await assert.rejects(svc.library('uidA', { action: 'update', videoId: vid(5), changes: { note: 'x'.repeat(2001) } }));
  await assert.rejects(svc.library('uidA', { action: 'update', videoId: vid(5), changes: { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) } }));
  const updated = await svc.library('uidA', { action: 'update', videoId: vid(5), changes: { note: '첫 줄\n둘째 줄', tags: ['토마토', '토마토', '텃밭'], favorite: true, category: '없는분야' } });
  assert.equal(updated.item.note, '첫 줄\n둘째 줄');
  assert.deepEqual(updated.item.tags, ['토마토', '텃밭']);
  assert.equal(updated.item.category, '전체 분야');
  // 같은 영상을 다시 담아도 메모가 지워지지 않는다.
  const again = await svc.library('uidA', { action: 'save', video: meta(vid(5)) });
  assert.equal(again.created, false);
  assert.equal(again.item.note, '첫 줄\n둘째 줄');
});

test('25일이 지난 영상 정보는 열람 때 최신화하고, 사라진 영상은 정보만 지우고 메모는 남긴다', async () => {
  const store = memoryStore();
  let t = NOW;
  const gone = new Set([vid(7)]);
  const yt = fakeYouTube({ details: (id) => (gone.has(id) ? null : meta(id, { title: `새 제목 ${id}` })) });
  const svc = service(store, yt, () => t);
  await svc.library('uidA', { action: 'save', video: meta(vid(6)) });
  await svc.library('uidA', { action: 'save', video: meta(vid(7)) });
  await svc.library('uidA', { action: 'update', videoId: vid(7), changes: { note: '남길 메모' } });
  t = NOW + META_REFRESH_AFTER_MS + DAY_MS;
  const list = (await svc.library('uidA', { action: 'list' })).saved;
  const byId = Object.fromEntries(list.map((x) => [x.videoId, x]));
  assert.equal(byId[vid(6)].meta.title, `새 제목 ${vid(6)}`);
  assert.equal(byId[vid(7)].meta, null);
  assert.equal(byId[vid(7)].metaStatus, 'unavailable');
  assert.equal(byId[vid(7)].note, '남길 메모');
});

test('최신화할 수 없으면 27일째에 영상 정보를 지운다(30일 기한 전 여유)', async () => {
  const store = memoryStore();
  let t = NOW;
  const svc = service(store, fakeYouTube(), () => t);
  await svc.library('uidA', { action: 'save', video: meta(vid(8)) });
  store.limits = resolveVideoFinderLimits(null); // 검색 꺼짐 → 최신화 불가
  t = NOW + META_REFRESH_AFTER_MS + DAY_MS;
  assert.ok((await svc.library('uidA', { action: 'list' })).saved[0].meta, '27일 전에는 유지');
  t = NOW + META_MAX_AGE_MS;
  const item = (await svc.library('uidA', { action: 'list' })).saved[0];
  assert.equal(item.meta, null);
  assert.equal(item.metaStatus, 'expired');
});

test('정리 작업 주기를 더해도 30일보다 앞서 지운다', () => {
  assert.equal(META_MAX_AGE_MS, 27 * DAY_MS);
  const worstCase = META_MAX_AGE_MS + META_PURGE_INTERVAL_HOURS * 60 * 60 * 1000 + 300 * 1000;
  assert.ok(worstCase < 28 * DAY_MS, `가장 늦은 정리 시점 ${worstCase / DAY_MS}일`);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'videoFinder.ts'), 'utf8');
  assert.ok(src.includes('schedule: `every ${META_PURGE_INTERVAL_HOURS} hours`'));
  assert.ok(!/batch\.update\(d\.ref/.test(src), '정리 작업은 조회 결과를 일괄 덮어쓰지 않고 문서마다 다시 읽는다');
  assert.ok(src.includes('expireSavedMetaIfStale(db, d.ref, nowMs)'));
});

test('정리 판정: 그사이 최신화됐거나 정보가 이미 없으면 쓰지 않고, 오래된 것만 영상 정보 필드를 지운다', () => {
  const base = { videoId: vid(1), category: '전체 분야', note: '메모', tags: ['t'], favorite: true, savedAt: NOW, updatedAt: NOW,
    meta: meta(vid(1)), metaFetchedAt: NOW, metaStatus: 'fresh', metaCheckedAt: NOW };
  const later = NOW + META_MAX_AGE_MS;
  assert.equal(planMetaUpdate({ ...base, metaFetchedAt: NOW + DAY_MS }, { kind: 'expired', nowMs: later }), null, '최신화된 항목');
  assert.equal(planMetaUpdate({ ...base, meta: null, metaFetchedAt: null }, { kind: 'expired', nowMs: later }), null, '이미 비어 있음');
  const fields = planMetaUpdate(base, { kind: 'expired', nowMs: later });
  assert.deepEqual(fields, { meta: null, metaFetchedAt: null, metaStatus: 'expired' });
  for (const f of [fields, planMetaUpdate(base, { kind: 'fresh', meta: meta(vid(1)), checkedAt: later }),
    planMetaUpdate(base, { kind: 'unavailable', checkedAt: later })]) {
    for (const k of ['note', 'tags', 'favorite', 'category', 'updatedAt', 'savedAt']) assert.ok(!(k in f), `영상 정보 갱신은 ${k}를 쓰지 않는다`);
  }
  assert.equal(planMetaUpdate(base, { kind: 'fresh', meta: meta(vid(1)), checkedAt: NOW - 1 }), null, '옛 응답은 쓰지 않는다');
});

test('백업에는 보관 링크와 내 메모·태그·검색 조건만 있고 YouTube 영상 정보는 복제하지 않는다', async () => {
  const store = memoryStore();
  const svc = service(store, fakeYouTube({ searchPages: [items([vid(9)])] }));
  await svc.search('uidA', { filters: baseFilters });
  await svc.library('uidA', { action: 'save', video: meta(vid(9), { title: '제3자 제목', channel: '제3자 채널', description: '제3자 설명' }) });
  await svc.library('uidA', { action: 'update', videoId: vid(9), changes: { note: '메모', tags: ['텃밭'], favorite: true } });
  const { backup } = await svc.library('uidA', { action: 'backup' });
  assert.equal(backup.format, 'haru-video-finder-backup');
  assert.match(backup.notice, /YouTube/);
  assert.deepEqual(Object.keys(backup.saved[0]).sort(), ['category', 'favorite', 'note', 'savedAt', 'tags', 'updatedAt', 'url', 'videoId']);
  assert.equal(backup.saved[0].note, '메모');
  assert.deepEqual(backup.saved[0].tags, ['텃밭']);
  assert.equal(backup.saved[0].url, `https://www.youtube.com/watch?v=${vid(9)}`);
  assert.equal(backup.history[0].query, baseFilters.query);
  const text = JSON.stringify(backup);
  for (const thirdParty of ['제3자 제목', '제3자 채널', '제3자 설명', 'i.ytimg.com', 'subscribers', 'views', '"meta"']) {
    assert.ok(!text.includes(thirdParty), `백업에 ${thirdParty} 없음`);
  }
  assert.ok(!/transcript|caption/i.test(text));
});

// ───── 동시 편집·삭제 경쟁 회귀 ─────

test('경쟁: 목록 최신화가 기다리는 사이 쓴 메모·즐겨찾기는 최신화 뒤에도 남는다', async () => {
  const store = memoryStore();
  let t = NOW;
  const yt = fakeYouTube({ details: (id) => meta(id, { title: '새 제목' }) });
  const svc = service(store, yt, () => t);
  await svc.library('uidA', { action: 'save', video: meta(vid(1)) });
  t = NOW + META_REFRESH_AFTER_MS + DAY_MS;
  const gate = deferred();
  yt.gate = gate.promise;
  const listing = svc.library('uidA', { action: 'list' });
  while (!yt.calls.details.length) await new Promise((r) => setImmediate(r));
  yt.gate = null;
  await svc.library('uidA', { action: 'update', videoId: vid(1), changes: { note: '동시에 쓴 메모', favorite: true } });
  gate.resolve();
  const listed = (await listing).saved[0];
  const stored = store.users.get('uidA').saved.get(vid(1));
  assert.equal(stored.note, '동시에 쓴 메모');
  assert.equal(stored.favorite, true);
  assert.equal(stored.meta.title, '새 제목');
  assert.equal(listed.note, '동시에 쓴 메모', '응답도 저장된 최신 문서를 보여준다');
});

test('경쟁: 최신화가 기다리는 사이 보관함에서 뺀 영상은 되살아나지 않는다(목록·수동 최신화 모두)', async () => {
  const store = memoryStore();
  let t = NOW;
  const yt = fakeYouTube();
  const svc = service(store, yt, () => t);
  await svc.library('uidA', { action: 'save', video: meta(vid(2)) });
  await svc.library('uidA', { action: 'save', video: meta(vid(3)) });
  t = NOW + META_REFRESH_AFTER_MS + DAY_MS;
  let gate = deferred();
  yt.gate = gate.promise;
  const listing = svc.library('uidA', { action: 'list' });
  while (!yt.calls.details.length) await new Promise((r) => setImmediate(r));
  await svc.library('uidA', { action: 'remove', videoId: vid(2) });
  gate.resolve();
  const listed = (await listing).saved.map((x) => x.videoId);
  assert.deepEqual(listed, [vid(3)]);
  assert.equal(store.users.get('uidA').saved.has(vid(2)), false);

  gate = deferred();
  yt.gate = gate.promise;
  const before = yt.calls.details.length;
  const refreshing = svc.library('uidA', { action: 'refreshMeta', videoId: vid(3) });
  while (yt.calls.details.length === before) await new Promise((r) => setImmediate(r));
  await svc.library('uidA', { action: 'remove', videoId: vid(3) });
  gate.resolve();
  assert.deepEqual(await refreshing, { item: null });
  assert.equal(store.users.get('uidA').saved.size, 0);
  await assert.rejects(svc.library('uidA', { action: 'update', videoId: vid(3), changes: { note: '늦은 메모' } }), (e) => e.code === 'not-found');
  assert.equal(store.users.get('uidA').saved.size, 0, '지운 뒤 편집도 문서를 만들지 않는다');
});

test('경쟁: 늦게 도착한 옛 최신화 응답은 더 새 영상 정보를 덮지 않는다', async () => {
  const store = memoryStore();
  let t = NOW;
  const gates = [];
  const yt = {
    async search() { return { items: [] }; },
    async videoDetails(ids) {
      const g = deferred();
      gates.push(g);
      const title = await g.promise;
      return Object.fromEntries(ids.map((id) => [id, meta(id, { title })]));
    },
  };
  const svc = service(store, yt, () => t);
  await svc.library('uidA', { action: 'save', video: meta(vid(4)) });
  t = NOW + 1000;
  const older = svc.library('uidA', { action: 'refreshMeta', videoId: vid(4) });
  while (gates.length < 1) await new Promise((r) => setImmediate(r));
  t = NOW + 2000;
  const newer = svc.library('uidA', { action: 'refreshMeta', videoId: vid(4) });
  while (gates.length < 2) await new Promise((r) => setImmediate(r));
  gates[1].resolve('새 응답');
  assert.equal((await newer).item.meta.title, '새 응답');
  gates[0].resolve('옛 응답');
  assert.equal((await older).item.meta.title, '새 응답', '옛 응답은 반영하지 않고 최신 문서를 돌려준다');
  assert.equal(store.users.get('uidA').saved.get(vid(4)).meta.title, '새 응답');
});

test('경쟁: 동시에 담기를 몰아도 보관 최대 개수를 넘지 않는다', async () => {
  const store = memoryStore();
  const svc = service(store, fakeYouTube());
  const saved = store.users.get('uidA') || (await store.listSaved('uidA', 1), store.users.get('uidA'));
  for (let i = 0; i < MAX_SAVED_PER_USER - 2; i += 1) saved.saved.set(`x${i}`, { videoId: `x${i}`, savedAt: i });
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => svc.library('uidA', { action: 'save', video: meta(vid(100 + i)) })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'resource-exhausted'));
  assert.equal(saved.saved.size, MAX_SAVED_PER_USER);
  const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'videoFinderStore.ts'), 'utf8');
  const create = storeSrc.slice(storeSrc.indexOf('async createSaved'), storeSrc.indexOf('async updateSavedFields'));
  const remove = storeSrc.slice(storeSrc.indexOf('async deleteSaved'), storeSrc.indexOf('async listHistory'));
  for (const [name, body] of [['createSaved', create], ['deleteSaved', remove]]) {
    assert.ok(body.includes('tx.get(lockRef)') && body.includes('tx.set(lockRef'), `${name}는 사용자별 레지스터를 같은 트랜잭션에서 읽고 쓴다`);
  }
});

test('저장소 계약: 기존 보관 문서는 set으로 덮어쓰지 않고, 만들기·바꾸기는 트랜잭션 안에서 계정 상태를 확인한다', () => {
  const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'videoFinderStore.ts'), 'utf8');
  assert.ok(!/savedCol\(uid\)\.doc\([^)]*\)\.set\(/.test(storeSrc), '보관 문서 통째 set 금지');
  assert.ok(!/putSaved/.test(storeSrc + fs.readFileSync(path.join(__dirname, '..', 'src', 'videoFinderCore.ts'), 'utf8')));
  for (const method of ['reserveQuota', 'createSaved', 'updateSavedFields', 'putHistory', 'createSession']) {
    const start = storeSrc.indexOf(`async ${method}(`);
    const body = storeSrc.slice(start, storeSrc.indexOf('\n    },\n', start));
    assert.ok(body.includes('runTransaction') && body.includes('tx.get(userRef('), `${method}: 트랜잭션에서 users/{uid}를 읽는다`);
    assert.ok(body.includes('assertActiveAccount('), `${method}: 활성 계정 확인`);
  }
  const update = storeSrc.slice(storeSrc.indexOf('async updateSavedFields'), storeSrc.indexOf('async deleteSaved'));
  assert.ok(update.includes('tx.update(ref, fields)') && !update.includes('tx.set('), '바뀐 필드만 update하고 없는 문서는 만들지 않는다');
});

// ───── 탈퇴 신청·삭제 시작과의 경쟁 ─────

test('탈퇴 신청·삭제가 시작된 계정은 검색·담기·편집·이력·세션 쓰기가 모두 거절되고 데이터가 바뀌지 않는다', async () => {
  for (const state of [{ ...ACTIVE, accountStatus: 'pending_deletion' }, { ...ACTIVE, deletionStartedAt: 1 }, null]) {
    const store = memoryStore();
    const yt = fakeYouTube({ searchPages: [items([vid(1)])] });
    const svc = service(store, yt);
    await svc.library('uidA', { action: 'save', video: meta(vid(1)) });
    store.accounts.set('uidA', state);
    await assert.rejects(svc.search('uidA', { filters: baseFilters }), (e) => e.code === 'failed-precondition');
    assert.equal(yt.calls.search.length, 0, '외부 호출 0회');
    await assert.rejects(svc.library('uidA', { action: 'save', video: meta(vid(2)) }), (e) => e.code === 'failed-precondition');
    await assert.rejects(svc.library('uidA', { action: 'update', videoId: vid(1), changes: { note: 'x' } }), (e) => e.code === 'failed-precondition');
    await assert.rejects(store.putHistory('uidA', { id: 'a'.repeat(32), createdAt: NOW }), (e) => e.code === 'failed-precondition');
    await assert.rejects(issueStandaloneSession({ store, now: () => NOW }, 'uidA', { audience: VIDEO_FINDER_STANDALONE_ORIGINS[0] }));
    assert.equal(store.users.get('uidA').saved.size, 1);
    assert.equal(store.users.get('uidA').saved.get(vid(1)).note, '');
    assert.equal(store.sessions.size, 0);
  }
});

test('경쟁: 최신화를 기다리는 사이 삭제가 시작되면 영상 정보도 쓰지 않는다', async () => {
  const store = memoryStore();
  let t = NOW;
  const yt = fakeYouTube({ details: (id) => meta(id, { title: '새 제목' }) });
  const svc = service(store, yt, () => t);
  await svc.library('uidA', { action: 'save', video: meta(vid(1)) });
  t = NOW + META_REFRESH_AFTER_MS + DAY_MS;
  const gate = deferred();
  yt.gate = gate.promise;
  const listing = svc.library('uidA', { action: 'list' });
  while (!yt.calls.details.length) await new Promise((r) => setImmediate(r));
  store.accounts.set('uidA', { ...ACTIVE, accountStatus: 'pending_deletion', deletionStartedAt: 1 });
  gate.resolve();
  await assert.rejects(listing, (e) => e.code === 'failed-precondition');
  assert.equal(store.users.get('uidA').saved.get(vid(1)).meta.title, `영상 ${vid(1)}`);
});

// ───── 독립 주소 전용 세션 ─────

const ORIGIN = VIDEO_FINDER_STANDALONE_ORIGINS[0];

async function standaloneSetup(limits = ON) {
  const store = memoryStore(limits);
  let t = NOW;
  const yt = fakeYouTube({ searchPages: [items([vid(1)])] });
  const svc = () => service(store, yt, () => t);
  const gateway = createStandaloneGateway({ store, now: () => t, service: svc });
  const issued = await issueStandaloneSession({ store, now: () => t }, 'uidA', { audience: ORIGIN });
  return { store, yt, gateway, issued, setNow: (v) => { t = v; } };
}

test('세션: 강한 난수 원문은 저장하지 않고 해시만 저장하며 Firebase 토큰 형식이 아니다', async () => {
  const { store, issued } = await standaloneSetup();
  assert.match(issued.session, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(!issued.session.includes('.'), 'JWT(Firebase 토큰) 형식이 아니다');
  assert.deepEqual([...store.sessions.keys()], [hashSessionToken(issued.session)]);
  assert.ok(!JSON.stringify([...store.sessions.entries()]).includes(issued.session));
  const record = store.sessions.get(hashSessionToken(issued.session));
  assert.deepEqual(record, { uid: 'uidA', audience: ORIGIN, createdAt: NOW, expiresAt: NOW + VIDEO_FINDER_SESSION_TTL_MS });
  assert.equal(VIDEO_FINDER_SESSION_TTL_MS, 8 * 60 * 60 * 1000);
  assert.equal(issued.accountKey, accountKeyFor('uidA'));
  assert.ok(!JSON.stringify(issued).includes('uidA'), '독립 주소에 UID를 보내지 않는다');
  const second = await issueStandaloneSession({ store, now: () => NOW }, 'uidA', { audience: ORIGIN });
  assert.notEqual(second.session, issued.session);
});

test('세션 발급: 운영 스위치가 꺼졌거나 허용되지 않은 주소면 만들지 않는다', async () => {
  const store = memoryStore({ ...ON, standaloneSignIn: false });
  await assert.rejects(issueStandaloneSession({ store, now: () => NOW }, 'uidA', { audience: ORIGIN }), (e) => e.code === 'failed-precondition');
  store.limits = ON;
  for (const audience of ['https://evil.example', 'http://youtube.haru2026.com', undefined]) {
    await assert.rejects(issueStandaloneSession({ store, now: () => NOW }, 'uidA', { audience }), (e) => e.code === 'invalid-argument');
  }
  assert.equal(store.sessions.size, 0);
});

test('세션 사용: 같은 세션으로 검색·보관함·하위 화면 요청이 이어지고 UID는 세션에서만 정한다', async () => {
  const { store, gateway, issued } = await standaloneSetup();
  const s = issued.session;
  const who = await gateway.handle({ op: 'session', session: s }, ORIGIN);
  assert.equal(who.accountKey, accountKeyFor('uidA'));
  await gateway.handle({ op: 'search', session: s, payload: { filters: baseFilters } }, ORIGIN);
  await gateway.handle({ op: 'library', session: s, payload: { action: 'save', video: meta(vid(1)), uid: 'uidB' } }, ORIGIN);
  const listed = await gateway.handle({ op: 'library', session: s, payload: { action: 'list' } }, ORIGIN);
  assert.equal(listed.saved.length, 1);
  const history = await gateway.handle({ op: 'library', session: s, payload: { action: 'history' } }, ORIGIN);
  assert.equal(history.history.length, 1);
  assert.equal(store.users.has('uidB'), false);
});

test('세션 사용: 운영 스위치를 끄면 이미 발급된 세션도 매 요청 거절된다', async () => {
  const { store, yt, gateway, issued } = await standaloneSetup();
  await gateway.handle({ op: 'session', session: issued.session }, ORIGIN);
  store.limits = { ...ON, standaloneSignIn: false };
  for (const op of ['session', 'search', 'library']) {
    await assert.rejects(gateway.handle({ op, session: issued.session, payload: { filters: baseFilters, action: 'list' } }, ORIGIN), (e) => e.code === 'failed-precondition');
  }
  assert.equal(yt.calls.search.length, 0);
});

test('세션 사용: 만료·로그아웃·다른 출처·형식 오류·없는 세션은 거절된다', async () => {
  const { store, gateway, issued, setNow } = await standaloneSetup();
  const s = issued.session;
  await assert.rejects(gateway.handle({ op: 'session', session: s }, 'https://evil.example'), (e) => e.code === 'permission-denied');
  await assert.rejects(gateway.handle({ op: 'session', session: s }, undefined), (e) => e.code === 'permission-denied');
  for (const bad of ['', 'x', `${'a'.repeat(20)}.${'b'.repeat(22)}`, 'A'.repeat(43)]) {
    await assert.rejects(gateway.handle({ op: 'session', session: bad }, ORIGIN), (e) => e.code === 'unauthenticated');
  }
  setNow(NOW + VIDEO_FINDER_SESSION_TTL_MS);
  await assert.rejects(gateway.handle({ op: 'session', session: s }, ORIGIN), (e) => e.code === 'unauthenticated');
  assert.equal(store.sessions.size, 0, '만료 세션은 지운다');

  setNow(NOW);
  const again = await issueStandaloneSession({ store, now: () => NOW }, 'uidA', { audience: ORIGIN });
  assert.deepEqual(await gateway.handle({ op: 'signOut', session: again.session }, ORIGIN), { signedOut: true });
  assert.equal(store.sessions.size, 0);
  await assert.rejects(gateway.handle({ op: 'library', session: again.session, payload: { action: 'list' } }, ORIGIN), (e) => e.code === 'unauthenticated');
  await assert.rejects(gateway.handle({ op: 'admin', session: again.session }, ORIGIN));
});

test('세션 사용: 탈퇴 신청·Auth 정지·다른 곳 로그아웃(토큰 취소)·이메일 미인증이면 기존 세션이 끝난다', async () => {
  const cases = [
    (store) => store.accounts.set('uidA', { ...ACTIVE, accountStatus: 'pending_deletion' }),
    (store) => store.authUsers.set('uidA', { ...AUTH_OK, disabled: true }),
    (store) => store.authUsers.set('uidA', null),
    (store) => store.authUsers.set('uidA', { ...AUTH_OK, tokensValidAfterMs: NOW + 1 }),
    (store) => store.authUsers.set('uidA', { ...AUTH_OK, providerIds: ['password'], emailVerified: false }),
  ];
  for (const apply of cases) {
    const { store, yt, gateway, issued } = await standaloneSetup();
    apply(store);
    await assert.rejects(gateway.handle({ op: 'search', session: issued.session, payload: { filters: baseFilters } }, ORIGIN),
      (e) => ['failed-precondition', 'unauthenticated'].includes(e.code));
    assert.equal(yt.calls.search.length, 0);
  }
});

// ───── 운영 할당량 표현 ─────

test('기본 전체 상한 8,000단위와 102단위 선예약은 표준 할당량(search.list 약 100회/일) 안에서 멈춘다', () => {
  assert.equal(SEARCH_RESERVATION_UNITS, 102);
  assert.equal(DEFAULT_VIDEO_FINDER_LIMITS.globalDailyUnits, 8000);
  const maxSearches = Math.floor(DEFAULT_VIDEO_FINDER_LIMITS.globalDailyUnits / SEARCH_RESERVATION_UNITS);
  assert.equal(maxSearches, 78);
  assert.ok(maxSearches * SEARCH_LIST_UNITS <= 10000 && maxSearches < 100);
  // 운영 문서로 올려도 9,500단위를 넘지 않는다.
  assert.equal(resolveVideoFinderLimits({ globalDailyUnits: 100000 }).globalDailyUnits, 9500);
  let reserved = 0;
  let accepted = 0;
  for (let i = 0; i < 200; i += 1) {
    const d = evaluateQuotaReservation({ user: null, global: { day: 'd', units: reserved }, userDay: 'u', globalDay: 'd', units: SEARCH_RESERVATION_UNITS, countSearch: false, limits: { ...DEFAULT_VIDEO_FINDER_LIMITS, enabled: true } });
    if (!d.ok) break;
    reserved = d.global.units;
    accepted += 1;
  }
  assert.equal(accepted, 78);
  assert.ok(reserved <= 8000);
});

// ───── 연결부 정적 점검 ─────

test('Functions 연결부: 리전·Secret 참조·UID 도출·유료 AI 미연결', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'videoFinder.ts'), 'utf8');
  const regionUses = src.match(/region: REGION/g) || [];
  assert.equal(regionUses.length, 5);
  assert.ok(!/createCustomToken|customToken/.test(src), 'Firebase custom token을 만들거나 독립 주소로 넘기지 않는다');
  assert.ok(src.includes('cors: VIDEO_FINDER_STANDALONE_ORIGINS'), '독립 주소 호출은 CORS 허용 목록을 쓴다');
  assert.ok(src.includes('gateway.handle(request.data, request.rawRequest?.headers?.origin)'), '서버에서도 Origin을 세션과 대조한다');
  const standaloneFn = src.slice(src.indexOf('export const videoFinderStandalone'), src.indexOf('export const purgeStaleVideoFinderMetadata'));
  assert.ok(!standaloneFn.includes('request.auth'), '독립 주소 호출은 Firebase 로그인을 받지 않고 전용 세션만 받는다');
  assert.ok(!/logger\.[a-z]+\([^)]*session/i.test(src), '세션 값을 로그에 남기지 않는다');
  assert.deepEqual(VIDEO_FINDER_STANDALONE_ORIGINS, ['https://youtube.haru2026.com']);
  // 다른 Functions·Rules는 이 세션을 받지 않는다: 세션 컬렉션은 이 기능의 저장소와 탈퇴 정리에서만 쓴다.
  const srcDir = path.join(__dirname, '..', 'src');
  const users = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'))
    .filter((f) => /videoFinderSessions|VIDEO_FINDER_SESSION_COLLECTION|hashSessionToken/.test(fs.readFileSync(path.join(srcDir, f), 'utf8')));
  assert.deepEqual(users.sort(), ['accountDeletion.ts', 'videoFinder.ts', 'videoFinderCore.ts', 'videoFinderStore.ts']);
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
  assert.ok(!/videoFinder/.test(rules), '내 영상 찾기 경로에는 클라이언트 허용 규칙이 없다(기본 거부)');
  assert.ok(!/match \/\{document=\*\*\}/.test(rules), '최상위 전체 허용 규칙이 없다');
  assert.ok(/match \/users\/\{uid\}\/rateLimits\/\{feature\} \{\s*allow read, write: if false;/.test(rules), 'rateLimits는 서버 전용 유지');
  assert.ok(src.includes("const REGION = 'asia-northeast3';"));
  assert.ok(src.includes("defineSecret('VIDEO_FINDER_YOUTUBE_API_KEY')"));
  assert.ok(!/AIza[0-9A-Za-z_-]{10,}/.test(src), 'API 키 문자열이 없어야 한다');
  assert.ok(src.includes('request.auth?.uid'));
  assert.ok(!/request\.data\??\.uid/.test(src), '클라이언트가 보낸 uid를 쓰지 않는다');
  assert.ok(!/gemini|typesafe|jev/i.test(src.replace(/\/\/.*$/gm, '')), '유료 AI 모델 호출 코드가 없어야 한다');
  assert.ok(!/captions|timedtext|download/i.test(src.replace(/\/\/.*$/gm, '')), '자막·영상 다운로드 경로가 없어야 한다');
  assert.ok(src.includes("'X-Goog-Api-Key': apiKey"), '키는 헤더로만 보낸다');
  const index = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
  assert.ok(index.includes("from './videoFinder';"));
});
