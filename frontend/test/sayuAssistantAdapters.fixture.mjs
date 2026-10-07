// SAYU 비서 탭 어댑터 고정 데이터 — sayuAssistantAdapters.test.mjs 와 원본 대조 검증이 함께 쓴다.
// 헬퍼는 결정적 대역(stub)이고, 열기(onOpen) 호출은 calls 로그로 남겨 비교한다.

export const fixtureRecords = [
  {
    id: 'sns-done', date: '2026-10-03', source: 'sns_story', generationStatus: 'completed',
    essay_title: '가을 산책 이야기', essay_sayu: '  오늘은   단풍길을 걸었다. '.repeat(8),
    sourceRecordIds: ['s1', 's2'], essay_keywords: ['산책', '단풍'],
  },
  { id: 'sns-legacy', date: '2026-10-01', source: 'sns_story', generationStatus: 'completed', content: '제목 없는 옛 작품' },
  { id: 'sns-pending', date: '2026-10-02', source: 'sns_story', generationStatus: 'generating', essay_title: '생성 중' },
  {
    // sourceAgent 가 없는 옛 하루LAW 기록
    id: 'law-legacy', date: '2026-10-05', formats: ['HARUraw'],
    haruraw_query: '전세 보증금을 돌려받지 못하면 어떻게 하나요', haruraw_sayu: '임대차보호법 검토',
    haruraw_keywords: ['전세', '보증금', '임대차', '반환', '소송'], haruraw_summary: '요약', haruraw_articles: '제3조',
  },
  { id: 'law-new', date: '2026-10-05', formats: ['HARUraw'], sourceAgent: 'haruraw', haruraw_content: '법령 본문' },
  { id: 'law-empty', date: '2026-10-06', formats: ['HARUraw'], haruraw_query: '본문 없음' },
  { id: 'law-out', date: '2026-09-01', formats: ['HARUraw'], haruraw_sayu: '범위 밖' },
  {
    id: 'plant-rec', date: '2026-10-04',
    plantDetective: [
      {
        title: '산국', userConfirmedName: '산국', aiKoName: '감국', scientificName: 'Chrysanthemum boreale',
        englishName: 'Wild chrysanthemum', imageUrl: 'https://img/1.jpg', imageUrls: ['https://img/1.jpg', 'https://img/2.jpg', 'ftp://x', ''],
        condition: '건강함', memo: '길가에서 발견', source: 'plantnet', confidence: '0.91', locationLabel: '북한산', plantId: 'p-1',
      },
      null,
      ['배열은 무시'],
      { title: '이름만 있는 판독', source: 'unknown_source' },
    ],
    plantObservation: [
      { title: '방울토마토', recordDate: '2026-10-06', growthStage: '개화', observation: '꽃이 피었다', aiDifference: '어제보다 꽃 2개 증가', imageUrl: 'https://img/3.jpg' },
      { title: '바질', daysAfterRecord: 3, memo: '잎이 커짐', updatedDate: '2026-10-07' },
      { title: '범위 밖 관찰', recordDate: '2026-09-20' },
    ],
  },
  {
    id: 'plant-old', date: '2026-09-15',
    plantDetective: [{ title: '범위 밖 판독' }],
    plantObservation: [{ title: '10월로 옮긴 관찰', recordDate: '2026-10-01', stage: '발아' }],
  },
  {
    id: 'kw', date: '2026-10-05', knowledgeWarehouse: true, formats: ['HARUraw'], haruraw_sayu: '지식창고',
    plantDetective: [{ title: '지식창고 판독' }], plantObservation: [{ title: '지식창고 관찰' }],
  },
];

export const fixtureLibraryItems = [
  { id: 'lib-pub', recordDate: '2026-10-02', title: '공개 장미', visibility: 'public', publicLocation: '서울 종로구', description: '붉은 장미', scientificName: 'Rosa', plantId: 'p-2' },
  { id: 'lib-priv', recordDate: '2026-10-02', title: '비공개 국화', characteristics: '노란 꽃', cultivationMemo: '물 주기 주 2회', finalLatinName: 'Chrysanthemum' },
  { id: 'lib-nomemo', date: '2026-10-08', title: '메모 없는 식물', geminiAnalysis: { analysis: '제미나이 분석문' } },
  // 공개 위치가 없는 공개 도감 — 공개 항목 미리보기의 '공개 지역 미표시' 대체 문구 회귀 확인용(P2a 독립 검토 지적 1)
  { id: 'lib-pub-noloc', recordDate: '2026-10-09', title: '위치 없는 공개 식물', visibility: 'public', description: '공개 설명만 있음' },
  { id: 'lib-out', recordDate: '2026-08-01', title: '범위 밖 도감', visibility: 'public' },
];

export const fixtureCatalogItems = [
  { id: 'cat-own', recordDate: '2026-10-03', title: '내 공개 소나무', ownerUid: 'u1', features: '바늘잎' },
  { id: 'cat-other', recordDate: '2026-10-03', title: '남의 공개 식물', ownerUid: 'u2' },
];

const compactPlantText = (value, max = 90) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export function createFixtureContext() {
  const calls = [];
  const ctx = {
    records: fixtureRecords,
    plantLibraryItems: fixtureLibraryItems,
    plantCatalogItems: fixtureCatalogItems,
    FORMAT_COLORS: { haruraw: '#3B5BDB' },
    isSayuScopeDate: (dateStr) => String(dateStr).startsWith('2026-10'),
    isKnowledgeWarehouseRecord: (record) => record.knowledgeWarehouse === true,
    getRecordSourceText: (r, prefix) => String(r?.[`${prefix}_sayu`] || r?.[`${prefix}_content`] || ''),
    getRecordPreviewKeywords: (r, prefix) => (Array.isArray(r?.[`${prefix}_keywords`]) ? r[`${prefix}_keywords`] : []),
    buildSearchText: (...values) => values
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    compactPlantText,
    compactPlantDetailText: (value, max = 220) => compactPlantText(value, max),
    formatKoreanDate: (dateKey) => `K(${dateKey})`,
    formatDaysAfterRecord: (days) => (days > 0 ? `${days}일 지나서 기록` : '기록 당일'),
    getPlantDiaryTrace: (entry, fallbackDate) => {
      const recordDate = entry?.recordDate || fallbackDate;
      const updatedDate = entry?.updatedDate || '';
      return {
        recordDate,
        recordLabel: `K(${recordDate}) 기록`,
        updatedDate,
        editedLabel: updatedDate ? `K(${updatedDate}) 수정 · 2일 지나서 기록` : '',
      };
    },
    getPlantItemDateKey: (item, fallback = '') => String(item?.recordDate || item?.date || fallback).slice(0, 10),
    getPlantImageUrl: (item) => String(item?.imageUrl || ''),
    getPlantDisplayName: (item) => String(item?.title || item?.displayName || '식물 이름 불확실'),
    getPlantScientificLine: (item) => [item?.englishName, item?.scientificName || item?.finalLatinName].filter(Boolean).join(' / '),
    getPlantAiSummary: (item) => compactPlantText(item?.condition),
    getPlantMemoSummary: (item) => compactPlantText(item?.memo || item?.observation),
    getPublicPlantLocation: (item) => String(item?.publicLocation || ''),
    getPlantMergeKey: (item, date, fallbackId, includeItemId = false) => `${item?.plantId || '-'}|${date}|${fallbackId}|${includeItemId}`,
    isPublicPlantItem: (item) => item?.visibility === 'public',
    isOwnedCatalogItem: (item) => item?.ownerUid === 'u1',
    buildPlantDetectiveDetailSections: (item, sourceSummary = '', extraSections = []) => [{ label: '출처', value: sourceSummary }, ...extraSections],
    openPlantReadOnlyDetail: (detail) => { calls.push({ fn: 'openPlantReadOnlyDetail', detail }); },
    openFormatSayu: (...args) => { calls.push({ fn: 'openFormatSayu', args }); },
    renderPlantReadOnlyPreview: (preview) => ({ preview }),
  };
  return { ctx, calls };
}

// 비교 가능한 평문으로 바꾼다: onOpen 을 실제로 호출해 기록하고, 미리보기의 onOpen 이 같은 함수인지도 남긴다.
export function serializeEntries(entries, calls) {
  return entries.map((entry) => {
    const { onOpen, extra, ...rest } = entry;
    calls.length = 0;
    onOpen();
    const opened = JSON.parse(JSON.stringify(calls));
    let preview;
    if (extra) {
      const { onOpen: previewOpen, ...previewRest } = extra.preview;
      preview = { ...previewRest, sameOnOpen: previewOpen === onOpen };
    }
    return JSON.parse(JSON.stringify({ ...rest, opened, preview }));
  });
}
