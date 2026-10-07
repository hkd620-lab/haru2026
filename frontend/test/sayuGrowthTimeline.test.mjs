import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as adapter from '../src/app/assistants/sayuAdapters.ts';
import { hasStructuredAssistantRecord, isGrowthMeasurementField } from '../src/app/utils/structuredAssistantRecords.ts';
import { fixtureEnvVariants, fixtureOpenCalls, fixtureRecords } from './sayuGrowthTimeline.fixture.mjs';
import { evalComponentConst, extractSayuBlocks, runSayuTimelineScenarios } from './sayuGrowthTimeline.harness.mjs';

// 스냅샷은 P2c 이동 전 원본(main 33483fc)의 SayuPage.tsx 블록과 원본 어댑터를 같은 하네스·고정 데이터로 실행한 출력이다.
const snapshot = JSON.parse(readFileSync(new URL('./sayuGrowthTimeline.snapshot.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/app/pages/SayuPage.tsx', import.meta.url), 'utf8');
const run = (envOverrides) => runSayuTimelineScenarios({ source, adapter, records: fixtureRecords, openCalls: fixtureOpenCalls, envOverrides });

for (const [variant, envOverrides] of Object.entries(fixtureEnvVariants)) {
  test(`성장타임라인 판정·목록·날짜 클릭·상세 열기 출력이 이동 전 원본과 같다 (${variant})`, async () => {
    assert.deepEqual(await run(envOverrides), snapshot[variant]);
  });
}

test('SayuPage 에 성장타임라인 정의가 남지 않고 어댑터 것을 쓴다', () => {
  const { names } = extractSayuBlocks(source);
  for (const name of ['isGrowthTimelineRecord', 'normalizeTimelineItems', 'GROWTH_TIMELINE_FORMAT_LABEL', 'GROWTH_TIMELINE_SAYU_LABEL']) {
    assert.equal(names.includes(name), false, name);
  }
  assert.equal(/function normalizeTimelineItems|type GrowthTimelineRecordItem =/.test(source), false);
  assert.equal(/'성장기록', '배뇨일지'/.test(source), false);
  assert.equal(source.includes("prefix === 'child' && hasStructuredAssistantRecord"), false);
});

test('목록 항목: 대표사진 미리보기·부제·열기 대상', async () => {
  const { entries } = await run({});
  const full = entries.find((e) => e.id === 'tl-full_growthTimeline');
  assert.equal(full.title, '우리 아이 첫 걸음');
  assert.equal(full.subtitle, '2026-09-01 ~ 2026-10-03 · 4장');
  assert.equal(full.extra.children.find((c) => c.type === 'img').props.src, 'https://img.example/timeline-1.jpg');
  const opened = full.onOpen.called.find((c) => c.fn === 'setSayuModalState').arg;
  assert.deepEqual(opened.images, ['https://img.example/timeline-1.jpg', 'https://img.example/timeline-2.jpg', 'https://img.example/timeline-3.jpg']);
  assert.equal(opened.timelineItems.length, 4);
  assert.deepEqual(full.extra.props.onClick, full.onOpen);
  assert.equal(entries.find((e) => e.id === 'tl-same-period_growthTimeline').subtitle, '2026-10-05 · 1장');
  assert.equal(entries.some((e) => e.id.startsWith('tl-formats-text') || e.id.startsWith('tl-empty')), false);
});

// 정보 지적(PR #247 독립 검토 2): openFormatSayu 의 판정 순서와 안내 문구를 호출 기록으로 고정한다.
test('구조화 뷰 상세 열기: 소유자 → 기록 존재 → 동의 순서와 안내 문구', async () => {
  const lastOpen = async (env, recordId, formatKey) => (await run(env)).opens.find((o) => o.recordId === recordId && o.formatKey === formatKey).log;
  assert.deepEqual(await lastOpen({ recordsOwnerUid: 'other-user', healthReadConsent: false }, 'diary-1', 'voiding'), []);
  assert.deepEqual(await lastOpen({ healthReadConsent: false }, 'diary-1', 'voiding'), [{ fn: 'toast.info', arg: '선택한 기록에 해당 형식이 없습니다.' }]);
  assert.deepEqual(await lastOpen({ healthReadConsent: false }, 'voiding-1', 'voiding'), [{ fn: 'toast.info', arg: '건강 기록 화면에서 민감정보 열람 동의를 확인해 주세요.' }]);
  assert.equal((await lastOpen({ healthReadConsent: false }, 'english-1', 'english_diary')).at(-1).fn, 'setStructuredRecord');
});

// 낮음 지적(PR #247 독립 검토 1): 경로 진입 시 동의 대기 대상이 이동 전 한글 라벨 목록과 같다.
test('경로 진입 동의 대기 대상은 이동 전 라벨 목록과 같다', () => {
  const ALL_FORMAT_PREFIXES = evalComponentConst(source, 'ALL_FORMAT_PREFIXES', { SNS_GALMURI_LABEL: adapter.SNS_GALMURI_LABEL });
  const labels = [...Object.keys(ALL_FORMAT_PREFIXES), '하루LAW', '', '없는형식', 'constructor', 'toString', '__proto__'];
  assert.equal(labels.includes('성장기록') && labels.includes('배뇨일지'), true);
  for (const label of labels) {
    const original = ['성장기록', '배뇨일지'].includes(label);
    assert.equal(adapter.structuredViewNeedsHealthConsent(ALL_FORMAT_PREFIXES[label] || ''), original, label);
  }
});

test('육아일기 측정 필드 제외 조건은 이동 전 조건과 같다', () => {
  const keys = ['child_measuredate', 'child_height', 'child_weight', 'child_headcircum', 'child_content', 'child_name', 'growth_height'];
  for (const record of fixtureRecords) {
    for (const prefix of ['child', 'child_measure', 'diary', 'growthTimeline']) {
      for (const key of keys) {
        const original = prefix === 'child' && hasStructuredAssistantRecord(record, 'child_measure') && isGrowthMeasurementField(key);
        assert.equal(adapter.isStructuredMeasurementFieldOfFormat(record, prefix, key), original, `${record.id} ${prefix} ${key}`);
      }
    }
  }
});
