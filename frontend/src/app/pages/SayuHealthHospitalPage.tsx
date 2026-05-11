import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { INFOGRAPHICS, type Infographic } from '../data/infographicsData';

type AnalyzeResponse = {
  recommendedSpecialties: string[];
  searchKeyword: string;
  ebsKeyword: string;
  disclaimer: string;
};

export function SayuHealthHospitalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [neighborhood, setNeighborhood] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [lastSymptomsText, setLastSymptomsText] = useState('');

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const canAnalyze = symptoms.trim().length >= 5 && !loading;

  const runAnalyze = async (override?: { symptomsText?: string }) => {
    const effectiveSymptoms = (override?.symptomsText ?? symptoms).trim();
    if (effectiveSymptoms.length < 5 || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable<{ symptoms: string; age?: number }, AnalyzeResponse>(
        functions,
        'analyzeSymptomsForSpecialty'
      );
      const payload: { symptoms: string; age?: number } = { symptoms: effectiveSymptoms };
      const ageNum = parseInt(age, 10);
      if (Number.isFinite(ageNum) && ageNum > 0 && ageNum < 150) payload.age = ageNum;
      const res = await fn(payload);
      setResult(res.data);
      setLastSymptomsText(effectiveSymptoms);
      setShowResultModal(true);
    } catch (e: any) {
      console.error('[SymptomAnalysis] failed', e);
      toast.error(e?.message || '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ⭐ B안: 6대 관심병 빠른 진입 버튼 데이터
  const QUICK_SEARCH_BUTTONS: Array<{
    id: string;
    gender: 'male' | 'female';
    label: string;
    subLabel: string;
    keyword: string;
    fullWidth: boolean;
  }> = [
    { id: 'prostate', gender: 'male', label: '전립선', subLabel: '비대증·전립선암', keyword: '전립선 비대증, 소변 자주 마려움, 야간뇨', fullWidth: false },
    { id: 'cardiovascular', gender: 'male', label: '심혈관', subLabel: '고혈압·심부전', keyword: '고혈압, 가슴 통증, 부정맥', fullWidth: false },
    { id: 'spine', gender: 'male', label: '척추·디스크', subLabel: '허리·목 통증', keyword: '허리 통증, 다리 저림, 디스크', fullWidth: true },
    { id: 'joint', gender: 'female', label: '관절', subLabel: '무릎·고관절', keyword: '무릎 통증, 관절염, 계단 오르기 힘듦', fullWidth: false },
    { id: 'menopause', gender: 'female', label: '갱년기', subLabel: '골다공증·폐경', keyword: '갱년기 증상, 골다공증, 폐경', fullWidth: false },
    { id: 'female_cancer', gender: 'female', label: '여성암', subLabel: '유방암·자궁암 검진', keyword: '유방암 검진, 자궁암 검진', fullWidth: true },
  ];

  const handleQuickButtonClick = (keyword: string) => {
    setSymptoms(keyword);
    // state 비동기 업데이트 우회: override로 직접 키워드 전달
    runAnalyze({ symptomsText: keyword });
    // 결과 영역으로 부드러운 스크롤
    setTimeout(() => {
      document.getElementById('search-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  const buildNaverUrl = (keyword: string) => {
    const q = neighborhood.trim() ? `${neighborhood.trim()} ${keyword}` : keyword;
    return `https://map.naver.com/v5/search/${encodeURIComponent(q)}`;
  };
  const buildEbsSearchUrl = (keyword: string) =>
    `https://www.ebs.co.kr/search?query=${encodeURIComponent(keyword)}&collection=community`;

  // 인포그래픽 자동 매칭: Gemini 결과 + 사용자 입력 증상에서 키워드 추출
  const matchedInfographic: Infographic | null = useMemo(() => {
    if (!result) return null;
    const rawKeywords = [
      result.searchKeyword,
      result.ebsKeyword,
      ...(result.recommendedSpecialties || []),
      lastSymptomsText,
    ].filter(Boolean) as string[];
    const keywords = rawKeywords
      .flatMap((s) => s.split(/[,\s]+/))
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (keywords.length === 0) return null;
    return (
      INFOGRAPHICS.find((info) => {
        const haystack = [...info.tags, ...info.relatedSymptoms];
        return haystack.some((needle) =>
          keywords.some((kw) => kw.includes(needle) || needle.includes(kw))
        );
      }) ?? null
    );
  }, [result, lastSymptomsText]);

  const styles = {
    container: { minHeight: '100vh', background: '#FAF9F6', paddingBottom: 80 } as React.CSSProperties,
    header: {
      position: 'sticky' as const, top: 0, zIndex: 10,
      background: '#FAF9F6', borderBottom: '0.5px solid #e5e5e5',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
    },
    body: { maxWidth: 640, margin: '0 auto', padding: '16px' } as React.CSSProperties,
    card: {
      background: '#fff', border: '0.5px solid #e5e7eb',
      borderRadius: 16, padding: '16px 18px', marginBottom: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    } as React.CSSProperties,
    label: { fontSize: 14, fontWeight: 600, color: '#1A3C6E', marginBottom: 6 } as React.CSSProperties,
    sublabel: { fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 } as React.CSSProperties,
    input: {
      width: '100%', border: '1px solid #E5E7EB', borderRadius: 10,
      padding: '10px 12px', fontSize: 16, outline: 'none',
      fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
    } as React.CSSProperties,
    textarea: {
      width: '100%', border: '1px solid #E5E7EB', borderRadius: 10,
      padding: '10px 12px', fontSize: 16, outline: 'none',
      fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
      resize: 'none' as const, lineHeight: 1.6,
    } as React.CSSProperties,
    btnPrimary: (disabled: boolean) => ({
      width: '100%', padding: '13px', borderRadius: 12, border: 'none',
      background: disabled ? '#D1D5DB' : '#1A3C6E',
      color: '#fff', fontSize: 15, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 8,
    } as React.CSSProperties),
    serviceCard: {
      background: '#fff', border: '0.5px solid #e5e7eb',
      borderRadius: 16, padding: '16px 18px', marginBottom: 10,
      display: 'flex', flexDirection: 'column' as const, gap: 8,
    } as React.CSSProperties,
    serviceTitle: { fontSize: 15, fontWeight: 600, color: '#1A3C6E', display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
    serviceDesc: { fontSize: 13, color: '#6b7280', lineHeight: 1.6 } as React.CSSProperties,
    serviceBtn: {
      display: 'inline-block', textAlign: 'center' as const,
      padding: '10px 12px', borderRadius: 10,
      background: '#1A3C6E', color: '#fff', fontSize: 14, fontWeight: 500,
      textDecoration: 'none', marginTop: 4,
    } as React.CSSProperties,
    disclaimer: {
      background: '#FFFBF0', border: '0.5px solid #F9CB42',
      borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#633806', lineHeight: 1.8,
      marginTop: 16,
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      <PageHeaderActions />
      <div style={styles.header}>
        <button
          onClick={closeToOrigin}
          aria-label="닫기"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 20, color: '#1A3C6E' }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A3C6E' }}>🩺 증상별 병원 찾기</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            증상을 입력하면 어울리는 진료과와 동네 병원을 찾아드립니다
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {/* 입력 카드 */}
        <div style={styles.card}>
          <div style={{ marginBottom: 14 }}>
            <p style={styles.label}>어떤 증상이 있으신가요? <span style={{ color: '#ef4444' }}>*</span></p>
            <p style={styles.sublabel}>5자 이상 자유롭게 입력해 주세요.</p>
            <textarea
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              placeholder="예) 요즘 가슴이 답답하고 숨이 차요"
              rows={3}
              maxLength={1000}
              style={styles.textarea}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={styles.label}>나이 (선택)</p>
            <p style={styles.sublabel}>나이를 알려주시면 더 정확한 진료과 추천이 가능합니다.</p>
            <input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={e => setAge(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="예) 64"
              min={1}
              max={120}
              style={styles.input}
            />
          </div>

          <div style={{ marginBottom: 4 }}>
            <p style={styles.label}>동네 (선택)</p>
            <p style={styles.sublabel}>동네를 알려주시면 동네 병원을 바로 찾아드립니다.</p>
            <input
              type="text"
              value={neighborhood}
              onChange={e => setNeighborhood(e.target.value.slice(0, 50))}
              placeholder="예) 서울 강남구, 수원 영통구"
              style={styles.input}
            />
          </div>

          <button
            onClick={() => runAnalyze()}
            disabled={!canAnalyze}
            style={styles.btnPrimary(!canAnalyze)}
          >
            {loading ? '⏳ 분석 중...' : '진료과 분석하기'}
          </button>
        </div>

        {/* ⭐ B안 신규: 6대 관심병 빠른 진입 카드 */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-amber-500">⚡</span>
            <h3 className="text-base font-medium text-gray-900">시니어 관심 질환</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">버튼 한 번으로 빠른 검색</p>

          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">🚹 남성</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_SEARCH_BUTTONS.filter((b) => b.gender === 'male').map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleQuickButtonClick(btn.keyword)}
                  disabled={loading}
                  className={`${btn.fullWidth ? 'col-span-2' : ''} bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-900 rounded-lg px-2 py-3 text-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="text-sm font-medium">{btn.label}</div>
                  <div className="text-[11px] text-blue-700 mt-0.5">{btn.subLabel}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">🚺 여성</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_SEARCH_BUTTONS.filter((b) => b.gender === 'female').map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleQuickButtonClick(btn.keyword)}
                  disabled={loading}
                  className={`${btn.fullWidth ? 'col-span-2' : ''} bg-pink-50 hover:bg-pink-100 active:bg-pink-200 border border-pink-200 text-pink-900 rounded-lg px-2 py-3 text-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="text-sm font-medium">{btn.label}</div>
                  <div className="text-[11px] text-pink-700 mt-0.5">{btn.subLabel}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              ℹ️ 버튼을 누르면 자동으로 검색됩니다. 결과는 네이버지도·EBS 명의에서 가져옵니다.
            </p>
          </div>
        </div>

        {/* 페이지 하단 면책 */}
        <div style={styles.disclaimer}>
          ⚠️ <strong>안내</strong>
          <br />· 이 서비스는 진료과 안내를 돕는 참고용 도구입니다.
          <br />· 진료 효과를 보장하지 않으며, 정확한 진단은 의료진과 상담하세요.
          <br />· 응급 상황(가슴 통증, 호흡 곤란, 의식 저하 등)에는 즉시 <strong>119</strong>에 신고하세요.
        </div>
      </div>

      {/* 진료과 분석 결과 — 풀스크린 모달 */}
      {showResultModal && result && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setShowResultModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full my-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-5 py-3 flex justify-between items-center rounded-t-2xl z-10">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E' }}>
                🩺 진료과 분석 결과
              </h3>
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                aria-label="닫기"
                className="text-2xl leading-none w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100"
                style={{ color: '#666' }}
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4">
              {/* 진료과 + 의심 키워드 */}
              <div
                style={{
                  ...styles.card,
                  background: '#EEF3FA',
                  border: '0.5px solid #B5D4F4',
                  marginBottom: 14,
                }}
              >
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>추천 진료과</p>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1A3C6E',
                    marginBottom: 10,
                  }}
                >
                  {result.recommendedSpecialties.join(', ')}
                </p>
                {result.ebsKeyword && (
                  <>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                      관련 키워드
                    </p>
                    <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
                      {result.ebsKeyword}
                    </p>
                  </>
                )}
                <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
                  {result.disclaimer}
                </p>
              </div>

              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1A3C6E',
                  margin: '8px 0 10px',
                }}
              >
                📍 동네 병원·명의 정보 찾기
              </p>

              {/* 카드 1: 네이버 지도 */}
              <div style={styles.serviceCard}>
                <div style={styles.serviceTitle}>🗺️ 네이버 지도에서 동네 병원 찾기</div>
                <div style={styles.serviceDesc}>
                  네이버 지도로{' '}
                  <strong>
                    {neighborhood.trim() ? `${neighborhood.trim()} ` : ''}
                    {result.searchKeyword}
                  </strong>{' '}
                  검색
                </div>
                <a
                  href={buildNaverUrl(result.searchKeyword)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.serviceBtn}
                >
                  네이버 지도 열기
                </a>
              </div>

              {/* 카드 2: EBS 명의 — 사용법 안내 + 자동 검색 URL */}
              <div style={styles.serviceCard}>
                <div style={styles.serviceTitle}>📺 EBS 명의 다시보기</div>
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '0.5px solid #E5E7EB',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 12,
                    color: '#374151',
                    lineHeight: 1.8,
                  }}
                >
                  <div>① 아래 버튼을 누르면</div>
                  <div>
                    ② EBS 사이트에서 <strong>'{result.ebsKeyword}'</strong> 관련 영상이
                    자동으로 검색됩니다
                  </div>
                  <div>③ 보고 싶은 의사 영상을 클릭하여 시청하세요</div>
                </div>
                <a
                  href={buildEbsSearchUrl(result.ebsKeyword)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.serviceBtn}
                >
                  EBS에서 '{result.ebsKeyword}' 검색하기 →
                </a>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  ※ EBS 회원가입·로그인이 필요할 수 있습니다.
                </p>
              </div>

              {/* 카드 3: 인포그래픽 매칭 (있을 때만) */}
              {matchedInfographic && (
                <div
                  style={{
                    ...styles.serviceCard,
                    background:
                      'linear-gradient(135deg, #FFF7E0 0%, #ffffff 70%)',
                    border: '1px solid #F4D78D',
                  }}
                >
                  <div style={styles.serviceTitle}>
                    📊 관련 인포그래픽 <span style={{ color: '#D97706' }}>⭐</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2A' }}>
                    {matchedInfographic.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#4A5A2C' }}>
                    {matchedInfographic.subtitle}
                  </div>
                  <div style={{ fontSize: 11, color: '#888780' }}>
                    {matchedInfographic.curator} 큐레이션 · 시니어 친화 건강 정보
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResultModal(false);
                      navigate('/sayu-health/library', {
                        state: { from: '/sayu-health/hospital' },
                      });
                    }}
                    style={{
                      ...styles.serviceBtn,
                      background: '#D97706',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    인포그래픽 자세히 보기 →
                  </button>
                </div>
              )}

              <p
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: '0.5px solid #E5E7EB',
                  lineHeight: 1.7,
                }}
              >
                ※ 본 정보는 일반적인 건강 정보이며 진료를 대체할 수 없습니다.
                증상이 있으시면 반드시 의료진과 상의하세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
