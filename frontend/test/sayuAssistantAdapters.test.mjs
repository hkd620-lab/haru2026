import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildSayuAssistantEntries,
  buildSayuPlantDetectiveEntry,
  getStructuredViewAccess,
  isCompletedSnsStoryRecord,
} from '../src/app/assistants/sayuAdapters.ts';
import { createFixtureContext, fixtureRecords, serializeEntries } from './sayuAssistantAdapters.fixture.mjs';

// 스냅샷은 P2a 이동 전 SayuPage.tsx 원본 블록을 같은 고정 데이터로 실행해 만든 출력이다.
const snapshot = JSON.parse(readFileSync(new URL('./sayuAssistantAdapters.snapshot.json', import.meta.url), 'utf8'));

test('비서 탭 항목은 이동 전 원본 출력 스냅샷과 같다', () => {
  const { ctx, calls } = createFixtureContext();
  assert.deepEqual(serializeEntries(buildSayuAssistantEntries(ctx), calls), snapshot);
});

test('완료된 SNS 갈무리만 포함하고 essay 상세로 연다', () => {
  const { ctx, calls } = createFixtureContext();
  const entries = serializeEntries(buildSayuAssistantEntries(ctx), calls).filter((e) => e.label === 'SNS 갈무리');
  assert.deepEqual(entries.map((e) => e.id), ['sns-done_sns_galmuri', 'sns-legacy_sns_galmuri']);
  assert.equal(entries[0].subtitle.startsWith('SNS 기록 2건 · '), true);
  assert.equal(entries[1].title, 'SNS 갈무리 이야기');
  assert.deepEqual(entries[0].opened[0].args, ['2026-10-03', 'essay', 'SNS 갈무리', 'sns-done']);
  assert.equal(isCompletedSnsStoryRecord({ source: 'sns_story', generationStatus: 'generating' }), false);
});

test('sourceAgent 없는 옛 하루LAW 기록도 기존 조건대로 포함한다', () => {
  const { ctx, calls } = createFixtureContext();
  const entries = serializeEntries(buildSayuAssistantEntries(ctx), calls).filter((e) => e.label === '하루LAW');
  assert.deepEqual(entries.map((e) => e.id), ['law-legacy_haruraw', 'law-new_haruraw']);
  assert.equal(entries[0].subtitle, '전세 · 보증금 · 임대차 · 반환');
  assert.equal(entries[0].color, '#3B5BDB');
  assert.deepEqual(entries[0].opened[0].args, ['2026-10-05', 'haruraw', 'HARUraw', 'law-legacy']);
});

test('지식창고·범위 밖 기록은 빠지고, 성장일기는 관찰일 기준으로 범위를 본다', () => {
  const { ctx, calls } = createFixtureContext();
  const ids = serializeEntries(buildSayuAssistantEntries(ctx), calls).map((e) => e.id);
  assert.equal(ids.some((id) => id.startsWith('kw_') || id.includes('law-out') || id.includes('law-empty')), false);
  assert.equal(ids.includes('plant-old_plant_detective_0'), false);
  assert.equal(ids.includes('plant-old_plant_diary_0'), true);
  assert.equal(ids.includes('plant_public_catalog_cat-other'), false);
});

test('판독기록 단건 빌더는 객체가 아닌 항목에 null 을 돌려준다', () => {
  const { ctx, calls } = createFixtureContext();
  const record = fixtureRecords.find((r) => r.id === 'plant-rec');
  assert.equal(buildSayuPlantDetectiveEntry(ctx, record, 1), null);
  assert.equal(buildSayuPlantDetectiveEntry(ctx, record, 2), null);
  assert.equal(buildSayuPlantDetectiveEntry(ctx, record, 9), null);
  const [entry] = serializeEntries([buildSayuPlantDetectiveEntry(ctx, record, 0)], calls);
  assert.deepEqual(entry, snapshot.find((e) => e.id === 'plant-rec_plant_detective_0'));
  assert.deepEqual(entry.opened[0].detail.imageUrls, ['https://img/1.jpg', 'https://img/2.jpg']);
});

// P2b: 구조화 뷰 열람 판정 — 이동 전 SayuPage 세 곳의 조건식을 그대로 옮겨 적은 기준과 모든 조합에서 같아야 한다.
test('구조화 뷰 열람 판정은 이동 전 세 곳의 조건과 같다', () => {
  const prefixes = ['english_diary', 'child_measure', 'voiding'];
  const consents = [true, false, null, undefined];
  for (const prefix of prefixes) {
    for (const isOwner of [true, false]) {
      for (const healthReadConsent of consents) {
        const access = getStructuredViewAccess(prefix, isOwner, healthReadConsent);
        // openFormatSayu: 소유자 아님 → 조용히 종료, 그다음(기록 존재 확인 뒤) 동의 없음 → 안내 후 종료
        const openOriginal = !isOwner ? 'not_owner' : (prefix !== 'english_diary' && healthReadConsent !== true) ? 'needs_health_consent' : 'allowed';
        assert.equal(access, openOriginal, `open ${prefix} ${isOwner} ${healthReadConsent}`);
        // hasCompletedFormatForRecord: 소유자 아님 또는 동의 없음이면 목록에서 제외
        const listOriginal = !(!isOwner) && !(prefix !== 'english_diary' && healthReadConsent !== true);
        assert.equal(access === 'allowed', listOriginal, `list ${prefix} ${isOwner} ${healthReadConsent}`);
        // 모달 표시: ownerUid 일치 && (영어일기 || 동의 true)
        const modalOriginal = isOwner && (prefix === 'english_diary' || healthReadConsent === true);
        assert.equal(access === 'allowed', modalOriginal, `modal ${prefix} ${isOwner} ${healthReadConsent}`);
      }
    }
  }
});
