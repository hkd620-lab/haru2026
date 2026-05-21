import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { functions, db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const ELDER_BOOK_ID = 'book_haru2026_ai_platform';
const BOOK_TITLE = '65세 할아버지, AI와 HARU2026 플랫폼을 만들다';

const NAVY = '#1A3C6E';
const OFFWHITE = '#FAF9F6';

interface OutlineChapter { id: string; title: string; intent?: string }
interface OutlinePart { partTitle: string; chapters: OutlineChapter[] }
interface BookDoc {
  stage?: string;
  sourceStats?: { totalCards: number; totalPassages: number; accepted: number; excluded: number; threshold: number };
  outline?: { concept?: string; preface?: string; parts?: OutlinePart[]; epilogue?: string };
  assignmentStats?: { perChapter?: Record<string, number>; unassigned?: number };
}

export function ElderBookPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  const [book, setBook] = useState<BookDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  const loadBook = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'books', ELDER_BOOK_ID));
      setBook(snap.exists() ? (snap.data() as BookDoc) : null);
    } catch (e) {
      console.error('책 진행상태 로드 실패:', e);
    }
  }, []);

  useEffect(() => {
    if (isDeveloper) loadBook();
  }, [isDeveloper, loadBook]);

  if (!user || !isDeveloper) return null;

  const run = async (fnName: string, key: string, okMsg: string) => {
    setBusy(key);
    try {
      const fn = httpsCallable(functions, fnName);
      await fn({});
      await loadBook();
      toast.success(okMsg);
    } catch (e: any) {
      toast.error(e?.message || '작업 실패');
    } finally {
      setBusy(null);
    }
  };

  const stats = book?.sourceStats;
  const outline = book?.outline;
  const aStats = book?.assignmentStats;
  const hasSources = !!stats && stats.accepted > 0;
  const hasOutline = !!outline?.parts?.length;

  return (
    <div style={{ minHeight: '100vh', background: OFFWHITE, color: NAVY, paddingBottom: 80 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: OFFWHITE, borderBottom: '1px solid #e5e5e5', padding: '14px 16px' }}>
        <PageHeaderActions onClose={() => navigate('/admin/console')} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '8px 0 2px' }}>📖 65노인 책 출간</h1>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{BOOK_TITLE}</p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 1단계 — 소재 모으기 */}
        <StageCard
          step="①"
          title="소재 모으기"
          desc="AI지식창고 책소재 중 원문보존 70% 이상 인용문단만 채택 (AI 재창작 제외)"
          buttonLabel={hasSources ? '다시 모으기' : '소재 모을까요?'}
          busy={busy === 'gather'}
          disabled={!!busy}
          onClick={() => run('gatherElderBookSources', 'gather', '소재를 모았습니다.')}
        >
          {stats && (
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <Row label="책소재 카드" value={`${stats.totalCards}개`} />
              <Row label="채택 문단 (70%+)" value={`${stats.accepted}개`} strong />
              <Row label="제외 문단" value={`${stats.excluded}개`} muted />
            </div>
          )}
        </StageCard>

        {/* 2단계 — 차례 구성 */}
        <StageCard
          step="②"
          title="차례 구성"
          desc="모인 소재로 표준 논픽션 구성(머리말·부·장·맺음말)에 맞는 목차 자동 생성"
          buttonLabel={hasOutline ? '차례 다시 구성' : '차례와 책을 구성하시오'}
          busy={busy === 'outline'}
          disabled={!!busy || !hasSources}
          onClick={() => run('buildElderBookOutline', 'outline', '차례를 구성했습니다.')}
        >
          {outline?.parts?.length ? (
            <div style={{ fontSize: 13 }}>
              {outline.concept && <p style={{ margin: '0 0 8px', fontStyle: 'italic', color: '#374151' }}>“{outline.concept}”</p>}
              {outline.preface && <p style={{ margin: '0 0 6px', color: '#6B7280' }}>· 머리말: {outline.preface}</p>}
              {outline.parts.map((p, pi) => (
                <div key={pi} style={{ marginBottom: 8 }}>
                  <p style={{ margin: '6px 0 2px', fontWeight: 700 }}>{p.partTitle}</p>
                  {p.chapters?.map((c) => (
                    <p key={c.id} style={{ margin: '1px 0 1px 12px', color: '#374151' }}>
                      {c.title}{c.intent ? <span style={{ color: '#9CA3AF' }}> — {c.intent}</span> : null}
                    </p>
                  ))}
                </div>
              ))}
              {outline.epilogue && <p style={{ margin: '6px 0 0', color: '#6B7280' }}>· 맺음말: {outline.epilogue}</p>}
            </div>
          ) : null}
        </StageCard>

        {/* 3단계 — 소재 배분 */}
        <StageCard
          step="③"
          title="소재 배분"
          desc="각 인용문단을 알맞은 장에 자동 배치 (안 맞으면 미배치로 분리)"
          buttonLabel={aStats ? '다시 배분' : '소재를 장에 배분'}
          busy={busy === 'assign'}
          disabled={!!busy || !hasOutline}
          onClick={() => run('assignElderBookSources', 'assign', '소재를 배분했습니다.')}
        >
          {aStats && (
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              {Object.entries(aStats.perChapter || {}).map(([chId, n]) => {
                const ch = outline?.parts?.flatMap((p) => p.chapters || []).find((c) => c.id === chId);
                return <Row key={chId} label={ch?.title || chId} value={`${n}개`} />;
              })}
              <Row label="미배치" value={`${aStats.unassigned ?? 0}개`} muted />
            </div>
          )}
        </StageCard>

        <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>
          Phase 1 — 소재·차례·배분 / 가편·검토·출력은 다음 단계에서 추가됩니다.
        </p>
      </div>
    </div>
  );
}

function StageCard({ step, title, desc, buttonLabel, busy, disabled, onClick, children }: {
  step: string; title: string; desc: string; buttonLabel: string;
  busy: boolean; disabled: boolean; onClick: () => void; children?: React.ReactNode;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{step}</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
      </div>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 12px' }}>{desc}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: '100%', padding: '11px 12px', borderRadius: 8, border: 'none',
          fontSize: 14, fontWeight: 700,
          background: disabled ? '#D1D5DB' : NAVY, color: '#fff',
          cursor: busy ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        }}
      >{busy ? '작업 중…' : buttonLabel}</button>
      {children ? <div style={{ marginTop: 12, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>{children}</div> : null}
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: muted ? '#9CA3AF' : '#374151' }}>
      <span>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600, color: strong ? NAVY : undefined }}>{value}</span>
    </div>
  );
}
