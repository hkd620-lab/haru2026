import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Pill, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, type MedicationSaveInput, type UserMedication } from '../services/firestoreService';
import {
  type DoseStatus,
  type DrugSearchResult,
  extractDrugSearchTerm,
  searchOfficialDrugs,
} from '../services/drugService';
import { useSensitiveConsent } from '../hooks/useSensitiveConsent';
import { SensitiveConsentGate } from '../components/SensitiveConsentGate';

const SAFETY_TEXT = 'HARU의 약 정보는 참고용입니다. 복용, 중단, 변경은 반드시 의사 또는 약사와 상담하세요.';
const DOSING_TEXT = '복용법은 처방전과 약사의 안내를 따르세요.';

export function HealthMedicationPage() {
  const { user } = useAuth();
  const { hasConsent, isSaving: isSavingConsent, grantConsent } = useSensitiveConsent('sensitiveHealth');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [medications, setMedications] = useState<UserMedication[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMeds, setIsLoadingMeds] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const [pendingDoseResult, setPendingDoseResult] = useState<DrugSearchResult | null>(null);
  const [editingMedication, setEditingMedication] = useState<UserMedication | null>(null);

  const parsedQuery = useMemo(() => extractDrugSearchTerm(query), [query]);
  const doseOptions = pendingDoseResult?.doseOptions || editingMedication?.doseOptions || [];
  const isDoseModalOpen = Boolean(pendingDoseResult || editingMedication);

  useEffect(() => {
    loadMedications();
  }, [user?.uid]);

  const loadMedications = async () => {
    if (!user?.uid) {
      setMedications([]);
      return;
    }

    setIsLoadingMeds(true);
    try {
      const list = await firestoreService.getHealthMedications(user.uid);
      setMedications(list);
    } catch (err) {
      console.error('내 약 목록 불러오기 실패:', err);
      toast.error('내 약 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoadingMeds(false);
    }
  };

  const handleSearch = async () => {
    setError('');
    setNotice('');

    if (!parsedQuery.searchTerm) {
      setError('용량을 제외하고 약 이름만 입력해 보세요. 예: 텔미누보정');
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await searchOfficialDrugs(query);
      setResults(response.results);

      if (response.removedDoseLikeText) {
        setNotice('입력하신 내용에서 약 이름을 먼저 찾아볼게요. 용량은 추가 단계에서 다시 확인합니다.');
      }

      if (response.results.length === 0) {
        setError('검색 결과를 찾지 못했습니다. 용량을 제외하고 약 이름만 입력해 보세요. 예: 텔미누보정');
      }
    } catch (err) {
      console.error('약 검색 실패:', err);
      setResults([]);
      setError('공식 의약품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMedication = async (result: DrugSearchResult) => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (result.doseOptions.length > 1) {
      setPendingDoseResult(result);
      return;
    }

    const selectedDose = result.doseOptions[0];
    await saveMedication(result, selectedDose, selectedDose ? 'selected' : 'not_applicable');
  };

  const handleDoseChoice = async (selectedDose: string | null) => {
    if (pendingDoseResult) {
      await saveMedication(pendingDoseResult, selectedDose || undefined, selectedDose ? 'selected' : 'unknown');
      setPendingDoseResult(null);
      return;
    }

    if (editingMedication && user?.uid) {
      try {
        await firestoreService.updateHealthMedicationDose(
          user.uid,
          editingMedication.id,
          selectedDose || undefined,
          selectedDose ? 'selected' : 'unknown'
        );
        toast.success('용량 정보를 수정했습니다.');
        setEditingMedication(null);
        await loadMedications();
      } catch (err) {
        console.error('용량 수정 실패:', err);
        toast.error('용량 정보를 수정하지 못했습니다.');
      }
    }
  };

  const saveMedication = async (
    result: DrugSearchResult,
    selectedDose: string | undefined,
    doseStatus: DoseStatus
  ) => {
    if (!user?.uid) return;

    const displayName = selectedDose ? `${result.baseName} ${selectedDose}` : result.baseName;
    const payload: MedicationSaveInput = {
      drugName: result.baseName,
      displayName,
      selectedDose,
      doseStatus,
      ingredient: result.ingredient,
      category: result.category,
      prescriptionType: result.prescriptionType,
      efficacySummary: result.efficacySummary,
      sideEffectSummary: result.sideEffectSummary,
      source: 'official-drug-api',
      officialItemSeq: result.officialItemSeq,
      originalDrugData: result.originalDrugData,
      doseOptions: result.doseOptions,
    };

    try {
      await firestoreService.saveHealthMedication(user.uid, payload);
      toast.success('내 약에 추가했습니다.');
      await loadMedications();
    } catch (err) {
      console.error('내 약 추가 실패:', err);
      toast.error('내 약에 추가하지 못했습니다.');
    }
  };

  const handleDeleteMedication = async (medicationId: string) => {
    if (!user?.uid) return;

    try {
      await firestoreService.deleteHealthMedication(user.uid, medicationId);
      toast.success('내 약에서 삭제했습니다.');
      await loadMedications();
    } catch (err) {
      console.error('내 약 삭제 실패:', err);
      toast.error('내 약을 삭제하지 못했습니다.');
    }
  };

  if (hasConsent === false) {
    return <SensitiveConsentGate category="health" isSaving={isSavingConsent} onAgree={grantConsent} />;
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div style={styles.headerIcon}>
          <Pill size={22} strokeWidth={2.2} />
        </div>
        <div>
          <p style={styles.kicker}>HARU 건강관리</p>
          <h1 style={styles.title}>약 정보</h1>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.searchLabel}>약 이름만 먼저 입력해 주세요.</div>
        <p style={styles.searchHelp}>용량은 내 약에 추가할 때 선택할 수 있습니다.</p>
        <div style={styles.searchRow}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch();
            }}
            placeholder="약 이름 입력 예: 텔미누보정"
            style={styles.searchInput}
          />
          <button type="button" onClick={handleSearch} disabled={isSearching} style={styles.searchButton}>
            <Search size={18} />
            <span>{isSearching ? '검색 중' : '약 정보 검색'}</span>
          </button>
        </div>
        {parsedQuery.removedDoseLikeText && parsedQuery.searchTerm && (
          <p style={styles.inlineNotice}>검색어 정리: {parsedQuery.searchTerm}</p>
        )}
        {notice && <p style={styles.notice}>{notice}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>검색 결과</h2>
          <span style={styles.sectionMeta}>{results.length}개</span>
        </div>

        {results.length === 0 && !isSearching ? (
          <div style={styles.emptyBox}>약 이름을 검색하면 공식 의약품 정보가 여기에 표시됩니다.</div>
        ) : (
          <div style={styles.resultList}>
            {results.map((result) => {
              const isDetailOpen = openDetailId === result.id;
              return (
                <article key={result.id} style={styles.resultCard}>
                  <div style={styles.cardTop}>
                    <div>
                      <h3 style={styles.cardTitle}>{result.baseName}</h3>
                      <p style={styles.cardMeta}>
                        {prescriptionLabel(result.prescriptionType)} · {result.category}
                      </p>
                    </div>
                    <button type="button" onClick={() => handleAddMedication(result)} style={styles.addButton}>
                      <Plus size={17} />
                      <span>내 약에 추가</span>
                    </button>
                  </div>

                  <InfoBlock title="효능" text={result.efficacySummary} />
                  <InfoBlock title="주의할 부작용" text={`${result.sideEffectSummary.join(', ')} 등이 나타날 수 있습니다.`} />
                  <InfoBlock title="복용 안내" text={DOSING_TEXT} />

                  <button
                    type="button"
                    onClick={() => setOpenDetailId(isDetailOpen ? null : result.id)}
                    style={styles.detailToggle}
                  >
                    <span>상세정보 보기</span>
                    {isDetailOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {isDetailOpen && (
                    <div style={styles.detailBox}>
                      <DetailLine label="공식 효능·효과" text={result.detail.efficacyOriginal} />
                      <DetailLine label="공식 용법·용량" text={result.detail.useMethodOriginal} />
                      <DetailLine label="공식 사용상 주의사항" text={result.detail.cautionOriginal || result.detail.warningOriginal} />
                      <DetailLine label="공식 출처" text={result.detail.source} />
                      <DetailLine label="품목기준코드" text={result.officialItemSeq} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>내 약 목록</h2>
          <span style={styles.sectionMeta}>{medications.length}개</span>
        </div>

        {isLoadingMeds ? (
          <div style={styles.emptyBox}>내 약 목록을 불러오는 중입니다.</div>
        ) : medications.length === 0 ? (
          <div style={styles.emptyBox}>아직 추가한 약이 없습니다.</div>
        ) : (
          <div style={styles.medList}>
            {medications.map((medication) => (
              <article key={medication.id} style={styles.medCard}>
                <div style={styles.medHeader}>
                  <div>
                    <h3 style={styles.medTitle}>{medication.displayName}</h3>
                    {medication.doseStatus === 'unknown' && <p style={styles.doseUnknown}>용량 확인 필요</p>}
                  </div>
                  <button type="button" onClick={() => handleDeleteMedication(medication.id)} style={styles.iconButton} aria-label="삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
                <p style={styles.medMeta}>{medication.category || '분류 확인 필요'}</p>
                <p style={styles.medText}>효능: {medication.efficacySummary}</p>
                <p style={styles.medText}>주의: {medication.sideEffectSummary.join(', ')} 가능</p>
                {medication.doseStatus === 'unknown' && (
                  <button
                    type="button"
                    onClick={() => setEditingMedication(medication)}
                    disabled={!medication.doseOptions || medication.doseOptions.length === 0}
                    style={styles.editDoseButton}
                  >
                    용량 수정
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <div style={styles.safetyBox}>
        <AlertTriangle size={17} />
        <span>{SAFETY_TEXT}</span>
      </div>

      {isDoseModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>이 약은 여러 용량이 있습니다.</h2>
            <p style={styles.modalText}>처방전이나 약봉지에 적힌 용량을 선택하세요.</p>
            <div style={styles.doseGrid}>
              {doseOptions.map((dose) => (
                <button key={dose} type="button" onClick={() => handleDoseChoice(dose)} style={styles.doseOption}>
                  {dose}
                </button>
              ))}
              <button type="button" onClick={() => handleDoseChoice(null)} style={styles.unknownDoseOption}>
                잘 모르겠음
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingDoseResult(null);
                setEditingMedication(null);
              }}
              style={styles.modalCancel}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.infoBlock}>
      <div style={styles.infoTitle}>{title}</div>
      <p style={styles.infoText}>{text}</p>
    </div>
  );
}

function DetailLine({ label, text }: { label: string; text?: string }) {
  if (!text) return null;

  return (
    <div style={styles.detailLine}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailText}>{text}</div>
    </div>
  );
}

function prescriptionLabel(type: string) {
  if (type === '전문의약품' || type === '일반의약품') return type;
  return '구분 확인 필요';
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100dvh',
    padding: '18px 16px 96px',
    background: '#FEFBE8',
    color: '#1A3C6E',
  },
  header: {
    maxWidth: 820,
    margin: '0 auto 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#1A3C6E',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    margin: 0,
    fontSize: 11,
    color: '#6f7d8f',
    fontWeight: 700,
  },
  title: {
    margin: '2px 0 0',
    fontSize: 24,
    fontWeight: 800,
  },
  panel: {
    maxWidth: 820,
    margin: '0 auto 18px',
    padding: 16,
    border: '1px solid rgba(26,60,110,0.12)',
    borderRadius: 8,
    background: '#fff',
  },
  searchLabel: {
    fontSize: 15,
    fontWeight: 800,
    color: '#1A3C6E',
  },
  searchHelp: {
    margin: '4px 0 12px',
    fontSize: 13,
    color: '#6f7d8f',
  },
  searchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
  },
  searchInput: {
    minWidth: 0,
    height: 44,
    border: '1px solid #dce3ea',
    borderRadius: 8,
    padding: '0 12px',
    fontSize: 15,
    outline: 'none',
  },
  searchButton: {
    height: 44,
    border: 'none',
    borderRadius: 8,
    padding: '0 14px',
    background: '#1A3C6E',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  inlineNotice: {
    margin: '10px 0 0',
    fontSize: 12,
    color: '#496580',
  },
  notice: {
    margin: '10px 0 0',
    padding: '9px 10px',
    borderRadius: 8,
    background: '#F2F7FF',
    color: '#24537A',
    fontSize: 13,
  },
  error: {
    margin: '10px 0 0',
    padding: '9px 10px',
    borderRadius: 8,
    background: '#FFF1F0',
    color: '#9F2E2E',
    fontSize: 13,
  },
  section: {
    maxWidth: 820,
    margin: '0 auto 18px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
  },
  sectionMeta: {
    fontSize: 12,
    color: '#6f7d8f',
  },
  emptyBox: {
    padding: 18,
    border: '1px solid rgba(26,60,110,0.1)',
    borderRadius: 8,
    background: '#fff',
    color: '#7f8a96',
    fontSize: 14,
    textAlign: 'center',
  },
  resultList: {
    display: 'grid',
    gap: 10,
  },
  resultCard: {
    padding: 16,
    border: '1px solid rgba(26,60,110,0.12)',
    borderRadius: 8,
    background: '#fff',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 850,
    color: '#16365F',
  },
  cardMeta: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#6f7d8f',
  },
  addButton: {
    flexShrink: 0,
    minHeight: 38,
    border: '1px solid #1A3C6E',
    borderRadius: 8,
    padding: '0 11px',
    background: '#fff',
    color: '#1A3C6E',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  infoBlock: {
    marginTop: 10,
  },
  infoTitle: {
    marginBottom: 3,
    fontSize: 12,
    color: '#496580',
    fontWeight: 800,
  },
  infoText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: '#2d3748',
  },
  detailToggle: {
    marginTop: 12,
    border: 'none',
    background: 'transparent',
    color: '#1A3C6E',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  detailBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    background: '#F7FAFC',
    color: '#44546A',
  },
  detailLine: {
    marginBottom: 10,
  },
  detailLabel: {
    marginBottom: 3,
    fontSize: 12,
    color: '#1A3C6E',
    fontWeight: 800,
  },
  detailText: {
    fontSize: 12,
    lineHeight: 1.55,
    color: '#44546A',
  },
  medList: {
    display: 'grid',
    gap: 10,
  },
  medCard: {
    padding: 14,
    border: '1px solid rgba(26,60,110,0.12)',
    borderRadius: 8,
    background: '#fff',
  },
  medHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  medTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 850,
    color: '#16365F',
  },
  doseUnknown: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#B85C2E',
    fontWeight: 800,
  },
  iconButton: {
    width: 34,
    height: 34,
    border: '1px solid #e8edf2',
    borderRadius: 8,
    background: '#fff',
    color: '#8a95a3',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  medMeta: {
    margin: '6px 0 8px',
    fontSize: 13,
    color: '#6f7d8f',
  },
  medText: {
    margin: '3px 0',
    fontSize: 13,
    lineHeight: 1.45,
    color: '#2d3748',
  },
  editDoseButton: {
    marginTop: 10,
    height: 34,
    border: '1px solid #dce3ea',
    borderRadius: 8,
    padding: '0 12px',
    background: '#fff',
    color: '#1A3C6E',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  safetyBox: {
    maxWidth: 820,
    margin: '0 auto',
    padding: 12,
    borderRadius: 8,
    background: '#FFF8E6',
    color: '#7A4F00',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 13,
    lineHeight: 1.45,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    background: '#fff',
    padding: 18,
    boxShadow: '0 20px 60px -30px rgba(15,23,42,0.6)',
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 850,
    color: '#16365F',
  },
  modalText: {
    margin: '6px 0 14px',
    fontSize: 13,
    color: '#6f7d8f',
    lineHeight: 1.5,
  },
  doseGrid: {
    display: 'grid',
    gap: 8,
  },
  doseOption: {
    minHeight: 40,
    border: '1px solid #dce3ea',
    borderRadius: 8,
    background: '#fff',
    color: '#1A3C6E',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  unknownDoseOption: {
    minHeight: 40,
    border: '1px solid #F1C27D',
    borderRadius: 8,
    background: '#FFF8E6',
    color: '#7A4F00',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  modalCancel: {
    width: '100%',
    marginTop: 12,
    minHeight: 40,
    border: 'none',
    borderRadius: 8,
    background: '#F1F5F9',
    color: '#475569',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
