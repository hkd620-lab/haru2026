import type { ReactNode } from 'react';
import type { HaruRecord } from '../services/firestoreService';

// SAYU '비서' 탭 항목 어댑터 — SNS 갈무리·하루LAW·하루식물탐정(판독·성장일기·도감·공개) 목록 항목을 만든다.
// 3단계 설계 P2a: SayuPage.tsx 에서 동작 변경 없이 옮겨 왔다. 화면 상태에 묶인 헬퍼는 SayuPage 가 컨텍스트로 넘긴다.

export const SNS_GALMURI_LABEL = 'SNS 갈무리';
export type PlantSayuEntryType = 'detective' | 'diary' | 'library' | 'catalog';
export type PlantReadOnlyField = { label: string; value: string };

export const PLANT_SAYU_TYPE_LABEL: Record<PlantSayuEntryType, string> = {
  detective: '판독기록',
  diary: '성장일기',
  library: '도감기록',
  catalog: '공개기록',
};
export const PLANT_SAYU_SOURCE_LABEL: Record<string, string> = {
  user_confirmed: '사용자 확정',
  haru_plant_detective: '하루식물탐정',
  kindwise: 'Plant.id',
  plantnet: 'PlantNet',
  gemini: 'AI 분석',
};

export function isCompletedSnsStoryRecord(record: HaruRecord): boolean {
  return record.source === 'sns_story' && record.generationStatus === 'completed';
}

export interface PlantReadOnlyDetail {
  type: PlantSayuEntryType;
  title: string;
  date: string;
  subtitle?: string;
  imageUrl?: string;
  summary?: string;
  coreFields: PlantReadOnlyField[];
  detailSections: PlantReadOnlyField[];
  // 판독기록(detective) 항목에 한해 사진 추가가 가능하도록 record/idx 와 추가 사진 목록을 함께 전달한다.
  recordId?: string;
  entryIdx?: number;
  imageUrls?: string[];
  editSnapshot?: unknown;
}

export type FlatSayuEntry = {
  id: string;
  recordId?: string;
  entryIndex?: number;
  date: string;
  label: string;
  title: string;
  subtitle?: string;
  color: string;
  keywords?: string[];
  searchText?: string;
  plantType?: PlantSayuEntryType;
  plantMergeKey?: string;
  plantTypeBadges?: PlantSayuEntryType[];
  plantPreviewImageUrl?: string;
  plantPreviewLines?: string[];
  onOpen: () => void;
  extra?: ReactNode;
};

export type PlantDiaryTrace = {
  recordDate: string;
  recordLabel: string;
  updatedDate: string;
  editedLabel: string;
};

export interface SayuAssistantEntriesContext {
  records: HaruRecord[];
  plantLibraryItems: any[];
  plantCatalogItems: any[];
  FORMAT_COLORS: Record<string, string>;
  isSayuScopeDate: (dateStr: string) => boolean;
  isKnowledgeWarehouseRecord: (record: HaruRecord) => boolean;
  getRecordSourceText: (r: any, prefix: string) => string;
  getRecordPreviewKeywords: (r: any, prefix: string) => string[];
  buildSearchText: (...values: unknown[]) => string;
  compactPlantText: (value: any, max?: number) => string;
  compactPlantDetailText: (value: any, max?: number) => string;
  formatKoreanDate: (dateKey: string) => string;
  formatDaysAfterRecord: (days: number) => string;
  getPlantDiaryTrace: (entry: any, fallbackDate: string) => PlantDiaryTrace;
  getPlantItemDateKey: (item: any, fallback?: string) => string;
  getPlantImageUrl: (item: any) => string;
  getPlantDisplayName: (item: any) => string;
  getPlantScientificLine: (item: any) => string;
  getPlantAiSummary: (item: any) => string;
  getPlantMemoSummary: (item: any) => string;
  getPublicPlantLocation: (item: any) => string;
  getPlantMergeKey: (item: any, date: string, fallbackId: string, includeItemId?: boolean) => string;
  isPublicPlantItem: (item: any) => boolean;
  isOwnedCatalogItem: (item: any) => boolean;
  buildPlantDetectiveDetailSections: (item: any, sourceSummary?: string, extraSections?: PlantReadOnlyField[]) => PlantReadOnlyField[];
  openPlantReadOnlyDetail: (detail: PlantReadOnlyDetail) => void;
  openFormatSayu: (dateStr: string, formatKey: string, formatLabel: string, recordId?: string) => void;
  renderPlantReadOnlyPreview: (preview: { imageUrl?: string; badge: string; lines: string[]; onOpen: () => void }) => ReactNode;
}

export function buildSayuPlantDetectiveEntry(ctx: SayuAssistantEntriesContext, record: any, idx: number): FlatSayuEntry | null {
  const {
    getPlantImageUrl,
    getPlantDisplayName,
    getPlantScientificLine,
    getPlantAiSummary,
    getPlantMemoSummary,
    openPlantReadOnlyDetail,
    formatKoreanDate,
    buildPlantDetectiveDetailSections,
    getPlantMergeKey,
    buildSearchText,
    renderPlantReadOnlyPreview,
  } = ctx;
  const entry = Array.isArray(record.plantDetective) ? record.plantDetective[idx] : null;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const imageUrl = getPlantImageUrl(entry);
  const title = getPlantDisplayName(entry).slice(0, 48);
  const subtitle = getPlantScientificLine(entry);
  const aiSummary = getPlantAiSummary(entry);
  const memoSummary = getPlantMemoSummary(entry);
  const confirmedName = String(entry?.userConfirmedName || entry?.humanReportedName || entry?.title || '').trim();
  const aiName = String(entry?.aiKoName || entry?.aiPrediction || '').trim();
  const scientificName = String(entry?.scientificName || entry?.latinName || entry?.finalLatinName || '').trim();
  const locationLabel = String(entry?.locationLabel || entry?.publicLocation || '').trim();
  const sourceLabel = entry?.source
    ? (PLANT_SAYU_SOURCE_LABEL[String(entry.source)] || String(entry.source))
    : '';
  const sourceSummary = [
    sourceLabel,
    entry?.aiPrediction,
    entry?.englishName,
    entry?.confidence ? `PlantNet 신뢰도 ${entry.confidence}` : '',
  ].filter((value) => String(value || '').trim()).join(' · ');
  const detectiveImageUrls: string[] = (() => {
    const urls: string[] = [];
    const add = (value: any) => {
      const url = typeof value === 'string' ? value.trim() : '';
      if (url && url.startsWith('http') && !urls.includes(url)) urls.push(url);
    };
    add(imageUrl);
    if (Array.isArray(entry?.imageUrls)) entry.imageUrls.forEach(add);
    return urls;
  })();
  const onOpen = () => openPlantReadOnlyDetail({
    type: 'detective',
    title,
    date: record.date,
    subtitle,
    imageUrl,
    recordId: record.id,
    entryIdx: idx,
    editSnapshot: entry,
    imageUrls: detectiveImageUrls,
    summary: '이 기록은 식물탐정이 판독하고 사용자가 확정한 식물 기록입니다.',
    coreFields: [
      { label: '사용자 확정명', value: confirmedName || title },
      { label: 'PlantNet 판독명', value: aiName },
      { label: '학명', value: scientificName },
      { label: '기록일', value: formatKoreanDate(record.date) },
    ],
    detailSections: buildPlantDetectiveDetailSections(entry, sourceSummary, [
      { label: '촬영 지역', value: locationLabel },
      { label: '사용자 메모', value: memoSummary },
    ]),
  });
  return {
    id: `${record.id}_plant_detective_${idx}`,
    date: record.date,
    label: '하루식물탐정',
    title,
    subtitle,
    color: '#10b981',
    plantType: 'detective' as const,
    plantMergeKey: getPlantMergeKey(entry, record.date, `${record.id}_plant_detective_${idx}`),
    plantPreviewImageUrl: imageUrl,
    plantPreviewLines: [
      aiSummary ? `AI 요약: ${aiSummary}` : '',
      memoSummary ? `메모: ${memoSummary}` : '',
    ],
    searchText: buildSearchText('하루식물탐정', title, subtitle, aiSummary, memoSummary, sourceSummary, confirmedName, aiName, scientificName, locationLabel),
    onOpen,
    extra: renderPlantReadOnlyPreview({
      imageUrl,
      badge: PLANT_SAYU_TYPE_LABEL.detective,
      lines: [
        aiSummary ? `AI 요약: ${aiSummary}` : '',
        memoSummary ? `메모: ${memoSummary}` : '',
      ],
      onOpen,
    }),
  };
}

export function buildSayuAssistantEntries(ctx: SayuAssistantEntriesContext): FlatSayuEntry[] {
  const {
    records,
    plantLibraryItems,
    plantCatalogItems,
    FORMAT_COLORS,
    isSayuScopeDate,
    isKnowledgeWarehouseRecord,
    getRecordSourceText,
    getRecordPreviewKeywords,
    buildSearchText,
    compactPlantText,
    compactPlantDetailText,
    formatKoreanDate,
    formatDaysAfterRecord,
    getPlantDiaryTrace,
    getPlantItemDateKey,
    getPlantImageUrl,
    getPlantDisplayName,
    getPlantScientificLine,
    getPublicPlantLocation,
    getPlantMergeKey,
    isPublicPlantItem,
    isOwnedCatalogItem,
    openPlantReadOnlyDetail,
    openFormatSayu,
    renderPlantReadOnlyPreview,
  } = ctx;
  const buildPlantDetectiveEntry = (record: any, idx: number) => buildSayuPlantDetectiveEntry(ctx, record, idx);

  const plantDetectiveEntries: FlatSayuEntry[] = records
    .filter((record) => isSayuScopeDate(record.date) && !isKnowledgeWarehouseRecord(record))
    .flatMap((record: any) =>
      (Array.isArray(record.plantDetective) ? record.plantDetective : [])
        .map((_: unknown, idx: number) => buildPlantDetectiveEntry(record, idx))
        .filter((entry: FlatSayuEntry | null): entry is FlatSayuEntry => entry !== null),
    );

  const plantDiaryEntries: FlatSayuEntry[] = records
    .filter((record) => !isKnowledgeWarehouseRecord(record))
    .flatMap((record: any) =>
      (Array.isArray(record.plantObservation) ? record.plantObservation : []).map((entry: any, idx: number) => {
        const date = getPlantItemDateKey(entry, record.date);
        const imageUrl = getPlantImageUrl(entry);
        const title = getPlantDisplayName(entry).slice(0, 48);
        const subtitle = [entry?.growthStage || entry?.stage || entry?.condition, getPlantScientificLine(entry)]
          .filter((value) => String(value || '').trim())
          .join(' / ');
        const bodySummary = compactPlantText(entry?.observation || entry?.memo || entry?.content || entry?.note);
        const stageSummary = compactPlantText(entry?.growthStage || entry?.stage || '');
        const trace = getPlantDiaryTrace(entry, record.date);
        const elapsedLabel = typeof entry?.daysAfterRecord === 'number'
          ? formatDaysAfterRecord(entry.daysAfterRecord)
          : trace.editedLabel.replace(/^.* · /, '');
        const onOpen = () => openPlantReadOnlyDetail({
          type: 'diary',
          title,
          date,
          subtitle,
          imageUrl,
          summary: '이 기록은 사용자가 직접 남긴 식물 성장 관찰 기록입니다.',
          coreFields: [
            { label: '식물명', value: title },
            { label: '관찰일', value: formatKoreanDate(date) },
            { label: '성장 단계', value: stageSummary },
            { label: '경과일', value: elapsedLabel },
          ],
          detailSections: [
            { label: '본문/메모 요약', value: bodySummary },
            { label: 'AI 차이/관찰', value: compactPlantDetailText(entry?.aiDifference) },
            { label: '기록 기준일', value: trace.recordLabel },
            { label: '수정 이력', value: trace.editedLabel },
          ],
        });
        return {
          id: `${record.id}_plant_diary_${idx}`,
          date,
          label: '하루식물탐정',
          title,
          subtitle,
          color: '#34a853',
          plantType: 'diary' as const,
          plantMergeKey: getPlantMergeKey(entry, date, `${record.id}_plant_diary_${idx}`),
          plantPreviewImageUrl: imageUrl,
          plantPreviewLines: [
            bodySummary,
            stageSummary ? `성장 단계: ${stageSummary}` : '',
          ],
          searchText: buildSearchText('하루식물탐정', title, subtitle, bodySummary, stageSummary, entry?.aiDifference, trace.recordLabel, trace.editedLabel),
          onOpen,
          extra: renderPlantReadOnlyPreview({
            imageUrl,
            badge: PLANT_SAYU_TYPE_LABEL.diary,
            lines: [
              bodySummary,
              stageSummary ? `성장 단계: ${stageSummary}` : '',
            ],
            onOpen,
          }),
        };
      }),
    )
    .filter((entry) => isSayuScopeDate(entry.date));

  const plantLibraryEntries: FlatSayuEntry[] = plantLibraryItems
    .map((item) => {
      const date = getPlantItemDateKey(item);
      const imageUrl = getPlantImageUrl(item);
      const title = getPlantDisplayName(item).slice(0, 48);
      const subtitle = getPlantScientificLine(item);
      const featureSummary = compactPlantText(item.characteristics || item.features || item.featureSummary || item.description || item.geminiAnalysis?.analysis);
      const memoSummary = compactPlantText(item.cultivationMemo || item.careMemo || item.memo || item.note);
      const publicState = isPublicPlantItem(item) ? '공개 연결 있음' : '비공개/미공개';
      const onOpen = () => openPlantReadOnlyDetail({
        type: 'library',
        title,
        date,
        subtitle,
        imageUrl,
        summary: '이 기록은 사용자가 확정한 내 식물도감 기록입니다.',
        coreFields: [
          { label: '식물명', value: title },
          { label: '학명', value: String(item.scientificName || item.finalLatinName || '').trim() },
          { label: '최근 갱신일', value: formatKoreanDate(date) },
          { label: '공개 여부', value: publicState },
        ],
        detailSections: [
          { label: '학명/영문명', value: subtitle },
          { label: '특징 설명', value: featureSummary },
          { label: '재배 메모', value: memoSummary },
          { label: '도감 출처', value: '내 식물도감' },
        ],
      });
      return {
        id: `plant_library_${item.id}`,
        date,
        label: '하루식물탐정',
        title,
        subtitle,
        color: '#4A5A2C',
        plantType: 'library' as const,
        plantMergeKey: getPlantMergeKey(item, date, `plant_library_${item.id}`, true),
        plantPreviewImageUrl: imageUrl,
        plantPreviewLines: [
          featureSummary ? `특징: ${featureSummary}` : '',
          memoSummary ? `재배 메모: ${memoSummary}` : publicState,
        ],
        searchText: buildSearchText('하루식물탐정', title, subtitle, featureSummary, memoSummary, publicState),
        onOpen,
        extra: renderPlantReadOnlyPreview({
          imageUrl,
          badge: PLANT_SAYU_TYPE_LABEL.library,
          lines: [
            featureSummary ? `특징: ${featureSummary}` : '',
            memoSummary ? `재배 메모: ${memoSummary}` : publicState,
          ],
          onOpen,
        }),
      };
    })
    .filter((entry) => isSayuScopeDate(entry.date));

  const plantPublicEntriesFromLibrary: FlatSayuEntry[] = plantLibraryItems
    .filter(isPublicPlantItem)
    .map((item) => {
      const date = getPlantItemDateKey(item);
      const imageUrl = getPlantImageUrl(item);
      const title = getPlantDisplayName(item).slice(0, 48);
      const subtitle = getPublicPlantLocation(item) || getPlantScientificLine(item);
      const description = compactPlantText(item.description || item.featureSummary || item.characteristics || item.features || item.geminiAnalysis?.analysis);
      const publicLocation = getPublicPlantLocation(item);
      const onOpen = () => openPlantReadOnlyDetail({
        type: 'catalog',
        title,
        date,
        subtitle,
        imageUrl,
        summary: '이 기록은 공개 연결 정보가 확인된 식물 공개기록입니다.',
        coreFields: [
          { label: '공개 식물명', value: title },
          { label: '공개용 지역명', value: publicLocation },
          { label: '공개 상태', value: '공개 읽기 전용' },
          { label: '공개일', value: formatKoreanDate(date) },
        ],
        detailSections: [
          { label: '공개 제목/설명', value: description },
          { label: '학명/영문명', value: getPlantScientificLine(item) },
        ],
      });
      return {
        id: `plant_public_library_${item.id}`,
        date,
        label: '하루식물탐정',
        title,
        subtitle,
        color: '#0f766e',
        plantType: 'catalog' as const,
        plantMergeKey: getPlantMergeKey(item, date, `plant_public_library_${item.id}`, true),
        plantPreviewImageUrl: imageUrl,
        plantPreviewLines: [
          description,
          publicLocation ? `공개 지역: ${publicLocation}` : '공개 지역 미표시',
        ],
        searchText: buildSearchText('하루식물탐정', title, subtitle, description, publicLocation),
        onOpen,
        extra: renderPlantReadOnlyPreview({
          imageUrl,
          badge: PLANT_SAYU_TYPE_LABEL.catalog,
          lines: [
            description,
            publicLocation ? `공개 지역: ${publicLocation}` : '공개 지역 미표시',
          ],
          onOpen,
        }),
      };
    })
    .filter((entry) => isSayuScopeDate(entry.date));

  const plantPublicEntriesFromCatalog: FlatSayuEntry[] = plantCatalogItems
    .filter(isOwnedCatalogItem)
    .map((item) => {
      const date = getPlantItemDateKey(item);
      const imageUrl = getPlantImageUrl(item);
      const title = getPlantDisplayName(item).slice(0, 48);
      const subtitle = getPublicPlantLocation(item) || getPlantScientificLine(item);
      const description = compactPlantText(item.description || item.featureSummary || item.characteristics || item.features || item.geminiAnalysis?.analysis);
      const publicLocation = getPublicPlantLocation(item);
      const onOpen = () => openPlantReadOnlyDetail({
        type: 'catalog',
        title,
        date,
        subtitle,
        imageUrl,
        summary: '이 기록은 공개 연결 정보가 확인된 식물 공개기록입니다.',
        coreFields: [
          { label: '공개 식물명', value: title },
          { label: '공개용 지역명', value: publicLocation },
          { label: '공개 상태', value: '공개 읽기 전용' },
          { label: '공개일', value: formatKoreanDate(date) },
        ],
        detailSections: [
          { label: '공개 제목/설명', value: description },
          { label: '학명/영문명', value: getPlantScientificLine(item) },
        ],
      });
      return {
        id: `plant_public_catalog_${item.id}`,
        date,
        label: '하루식물탐정',
        title,
        subtitle,
        color: '#0f766e',
        plantType: 'catalog' as const,
        plantMergeKey: getPlantMergeKey(item, date, `plant_public_catalog_${item.id}`),
        plantPreviewImageUrl: imageUrl,
        plantPreviewLines: [
          description,
          publicLocation ? `공개 지역: ${publicLocation}` : '공개 지역 미표시',
        ],
        searchText: buildSearchText('하루식물탐정', title, subtitle, description, publicLocation),
        onOpen,
        extra: renderPlantReadOnlyPreview({
          imageUrl,
          badge: PLANT_SAYU_TYPE_LABEL.catalog,
          lines: [
            description,
            publicLocation ? `공개 지역: ${publicLocation}` : '공개 지역 미표시',
          ],
          onOpen,
        }),
      };
    })
    .filter((entry) => isSayuScopeDate(entry.date));

  const plantPublicEntries = [...plantPublicEntriesFromLibrary, ...plantPublicEntriesFromCatalog];

  const assistantEntries: FlatSayuEntry[] = [
    ...records
      .filter((record) => isSayuScopeDate(record.date) && isCompletedSnsStoryRecord(record))
      .map((record) => {
        const title = String((record as any).essay_title || (record as any).essay_ai_title || 'SNS 갈무리 이야기').slice(0, 48);
        const content = String((record as any).essay_sayu || (record as any).content || '').trim();
        const sourceCount = Array.isArray((record as any).sourceRecordIds) ? (record as any).sourceRecordIds.length : 0;
        const subtitle = [
          sourceCount > 0 ? `SNS 기록 ${sourceCount}건` : 'SNS 갈무리 작품',
          compactPlantText(content, 80),
        ].filter(Boolean).join(' · ');
        const keywords = getRecordPreviewKeywords(record, 'essay');
        return {
          id: `${record.id}_sns_galmuri`,
          recordId: record.id,
          date: record.date,
          label: SNS_GALMURI_LABEL,
          title,
          subtitle,
          color: '#10b981',
          keywords,
          searchText: buildSearchText(SNS_GALMURI_LABEL, title, subtitle, keywords, content),
          onOpen: () => openFormatSayu(record.date, 'essay', SNS_GALMURI_LABEL, record.id),
        };
      }),
    ...records
      .filter((record) => (
        isSayuScopeDate(record.date) &&
        !isKnowledgeWarehouseRecord(record) &&
        Array.isArray(record.formats) &&
        record.formats.includes('HARUraw' as any) &&
        getRecordSourceText(record, 'haruraw').trim().length > 0
      ))
      .map((record) => {
        const keywords = getRecordPreviewKeywords(record, 'haruraw');
        const title = String((record as any).haruraw_query || '(질문 없음)').slice(0, 48);
        const subtitle = keywords.slice(0, 4).join(' · ');
        return {
          id: `${record.id}_haruraw`,
          date: record.date,
          label: '하루LAW',
          title,
          subtitle,
          color: FORMAT_COLORS.haruraw,
          keywords,
          searchText: buildSearchText('하루LAW', title, subtitle, keywords, getRecordSourceText(record, 'haruraw'), (record as any).haruraw_summary, (record as any).haruraw_articles),
          onOpen: () => openFormatSayu(record.date, 'haruraw', 'HARUraw', record.id),
        };
      }),
    ...plantDetectiveEntries,
    ...plantDiaryEntries,
    ...plantLibraryEntries,
    ...plantPublicEntries,
  ].sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));

  return assistantEntries;
}
