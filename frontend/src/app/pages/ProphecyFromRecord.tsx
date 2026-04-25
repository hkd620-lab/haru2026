import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import { ChevronLeft } from 'lucide-react';

const FORMAT_PREFIX: Record<string, string> = {
  '일기': 'diary', '에세이': 'essay', '여행기록': 'travel',
  '텃밭일지': 'garden', '애완동물관찰일지': 'pet', '육아일기': 'parenting',
  '선교보고': 'mission', '일반보고': 'report', '업무일지': 'work', '메모': 'memo',
};

type TrackType = 'single' | 'merge';
type Step = 'track' | 'list' | 'formatList' | 'preview' | 'items';

interface RecordItem {
  date: string;
  format: string;
  title: string;
  content: string;
  rawData: any;
}

const PROPHECY_TYPES = ['나의 미래', '자식의 미래', '과거를 바꿨다면'];
const TIME_OPTIONS = ['1년 후', '3년 후', '5년 후', '10년 후'];

export function RecordProphecyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [track, setTrack] = useState<TrackType>('single');
  const [step, setStep] = useState<Step>('track');

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');

  const [mergeFormat, setMergeFormat] = useState('일기');
  const [mergeStartDate, setMergeStartDate] = useState('');
  const [mergeEndDate, setMergeEndDate] = useState('');
  const [mergeRecords, setMergeRecords] = useState<RecordItem[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);

  const [prophecyType, setProphecyType] = useState('나의 미래');
  const [timeOption, setTimeOption] = useState('3년 후');
  const [question, setQuestion] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    firestoreService.getRecords(user.uid).then(all => {
      const items: RecordItem[] = [];
      all.forEach((rec: any) => {
        Object.entries(FORMAT_PREFIX).forEach(([fmt, prefix]) => {
          const titleKey = `${prefix}_ai_title`;
          // _content 키 또는 해당 prefix로 시작하는 아무 텍스트 필드 수집
          const contentKey = `${prefix}_content`;
          const recKeys = Object.keys(rec);
          const prefixKeys = recKeys.filter(k =>
            k.startsWith(`${prefix}_`) &&
            !k.endsWith('_sayu') &&
            !k.endsWith('_rating') &&
            !k.endsWith('_images') &&
            !k.endsWith('_ai_title') &&
            typeof rec[k] === 'string' &&
            (rec[k] as string).trim().length > 0
          );
          if (prefixKeys.length === 0) return;
          const content = rec[contentKey] ||
            prefixKeys.map(k => rec[k]).join('\n\n');
          items.push({
            date: rec.date,
            format: fmt,
            title: rec[titleKey] || `${fmt} — ${rec.date}`,
            content,
            rawData: rec,
          });
        });
      });
      items.sort((a, b) => b.date.localeCompare(a.date));
      setRecords(items);
      setLoading(false);
    });
  }, [user?.uid, track]);

  const loadMergeRecords = async () => {
    if (!user?.uid || !mergeStartDate || !mergeEndDate) return;
    setMergeLoading(true);
    const all = await firestoreService.getRecords(user.uid);
    const prefix = FORMAT_PREFIX[mergeFormat];
    const sayuKey = `${prefix}_sayu`;
    const filtered = all.filter((r: any) =>
      r.date >= mergeStartDate && r.date <= mergeEndDate && r[sayuKey]
    );
    const items: RecordItem[] = filtered.map((rec: any) => ({
      date: rec.date,
      format: mergeFormat,
      title: rec[`${prefix}_ai_title`] || `${mergeFormat} — ${rec.date}`,
      content: rec[sayuKey] || rec[`${prefix}_content`] || '',
      rawData: rec,
    }));
    items.sort((a, b) => a.date.localeCompare(b.date));
    setMergeRecords(items);
    setMergeLoading(false);
    if (items.length > 0) {
      setSelectedRecord({
        date: `${mergeStartDate} ~ ${mergeEndDate}`,
        format: `${mergeFormat} 합본 ${items.length}편`,
        title: `${mergeFormat} 합본 (${mergeStartDate} ~ ${mergeEndDate})`,
        content: items.map(i => `[${i.date}]\n${i.content}`).join('\n\n---\n\n'),
        rawData: items,
      });
    }
  };

  const goToSynopsis = () => {
    if (!selectedRecord) return;
    navigate('/novel-synopsis', {
      state: {
        fromRecord: true,
        recordContent: selectedRecord.content,
        recordTitle: selectedRecord.title,
        recordDate: selectedRecord.date,
        recordFormat: selectedRecord.format,
        prophecyType,
        timeOption,
        question,
      }
    });
  };

  const styles = {
    container: { minHeight: '100vh', background: '#FAF9F6', paddingBottom: 100 } as React.CSSProperties,
    header: {
      position: 'sticky' as const, top: 0, zIndex: 10,
      background: '#FAF9F6', borderBottom: '0.5px solid #e5e5e5',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
    },
    body: { maxWidth: 640, margin: '0 auto', padding: '16px' },
    card: {
      background: '#fff', border: '0.5px solid #e5e7eb',
      borderRadius: 12, padding: '14px 16px', marginBottom: 12,
    },
    trackCard: (active: boolean) => ({
      flex: 1, padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
      border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
      background: active ? '#EEF3FA' : '#fff',
      textAlign: 'center' as const,
    }),
    recordItem: (selected: boolean) => ({
      border: selected ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
      background: selected ? '#EEF3FA' : '#fff',
      borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
    }),
    pill: (active: boolean) => ({
      padding: '6px 14px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
      border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
      background: active ? '#1A3C6E' : '#fff',
      color: active ? '#fff' : '#374151',
    }),
    btnPrimary: {
      width: '100%', padding: '13px', borderRadius: 10, border: 'none',
      background: '#1A3C6E', color: '#fff', fontSize: 14,
      fontWeight: 500, cursor: 'pointer', marginTop: 8,
    } as React.CSSProperties,
    btnSecondary: {
      width: '100%', padding: '11px', borderRadius: 10,
      border: '0.5px solid #e5e7eb', background: '#fff',
      color: '#6b7280', fontSize: 13, cursor: 'pointer', marginTop: 6,
    } as React.CSSProperties,
    infoBox: {
      background: '#FFFBF0', border: '0.5px solid #F9CB42',
      borderRadius: 10, padding: '10px 12px', marginBottom: 12,
      fontSize: 12, color: '#633806', lineHeight: 1.7,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => step === 'track' ? navigate(-1) : setStep(
          step === 'items' ? 'preview' :
          step === 'preview' ? 'formatList' :
          step === 'formatList' ? 'list' :
          step === 'list' ? 'track' : 'track'
        )}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={22} color="#1A3C6E" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3C6E' }}>🔮 내 기록으로 창작</span>
      </div>

      <div style={styles.body}>

        {step === 'track' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>어떤 기록으로 창작할까요?</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={styles.trackCard(track === 'single')} onClick={() => { setTrack('single'); setStep('list'); }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E' }}>단일 기록</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>하루의 기록 한 편</div>
              </div>
              <div style={styles.trackCard(track === 'merge')} onClick={() => { setTrack('merge'); setStep('list'); }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📚</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E' }}>기록 합치기</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>여러 날의 합본</div>
              </div>
            </div>
            {track === 'merge' && (
              <div style={styles.infoBox}>
                💡 기록합치기는 SAYU 페이지에서 합본이 있는 기록을 날짜 범위로 선택합니다. SAYU 다듬기가 완료된 기록만 포함됩니다.
              </div>
            )}
          </>
        )}

        {step === 'list' && track === 'single' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              형식을 선택하세요
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['일기', '에세이', '여행기록', '텃밭일지', '애완동물관찰일지', '육아일기', '선교보고', '일반보고', '업무일지', '메모'].map(fmt => (
                <div
                  key={fmt}
                  onClick={() => {
                    const fmtRecords = records.filter(r => r.format === fmt);
                    if (fmtRecords.length === 0) {
                      return;
                    }
                    setSelectedFormat(fmt);
                    setStep('formatList');
                  }}
                  style={{
                    border: '0.5px solid #e5e7eb',
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 14, color: '#1A3C6E', fontWeight: 500 }}>{fmt}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {records.filter(r => r.format === fmt).length}편
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'formatList' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              {selectedFormat} 기록을 선택하세요
            </p>
            {records.filter(r => r.format === selectedFormat).map((rec, i) => (
              <div key={i} style={styles.recordItem(false)}
                onClick={() => { setSelectedRecord(rec); setStep('preview'); }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{rec.date} · {rec.format}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E', margin: '3px 0' }}>{rec.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                  {rec.content.slice(0, 80)}...
                </div>
              </div>
            ))}
          </>
        )}

        {step === 'list' && track === 'merge' && (
          <>
            <div style={styles.infoBox}>
              💡 SAYU 다듬기가 완료된 기록만 합본에 포함됩니다.
            </div>
            <div style={styles.card}>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 10 }}>형식 선택</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {['일기', '에세이', '여행기록', '육아일기', '선교보고', '업무일지'].map(f => (
                  <button key={f} style={styles.pill(mergeFormat === f)} onClick={() => setMergeFormat(f)}>{f}</button>
                ))}
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 6 }}>날짜 범위</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <input type="date" value={mergeStartDate} onChange={e => setMergeStartDate(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#1A3C6E' }} />
                <span style={{ color: '#9ca3af' }}>~</span>
                <input type="date" value={mergeEndDate} onChange={e => setMergeEndDate(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#1A3C6E' }} />
              </div>
              <button style={styles.btnPrimary} onClick={loadMergeRecords} disabled={!mergeStartDate || !mergeEndDate}>
                {mergeLoading ? '불러오는 중...' : '합본 기록 불러오기'}
              </button>
            </div>
            {mergeRecords.length > 0 && (
              <div style={styles.card}>
                <p style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>✅ {mergeRecords.length}편 발견됨</p>
                {mergeRecords.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#6b7280', padding: '4px 0', borderBottom: '0.5px solid #f3f4f6' }}>
                    {r.date} · {r.title}
                  </div>
                ))}
                {mergeRecords.length > 5 && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>외 {mergeRecords.length - 5}편</p>}
                <button style={styles.btnPrimary} onClick={() => setStep('preview')}>
                  이 합본으로 미리보기
                </button>
              </div>
            )}
            {mergeRecords.length === 0 && mergeLoading === false && mergeStartDate && mergeEndDate && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                해당 기간에 SAYU 완료된 {mergeFormat} 기록이 없습니다.
              </p>
            )}
          </>
        )}

        {step === 'preview' && selectedRecord && (
          <>
            <div style={{ ...styles.card, border: '1.5px solid #1A3C6E' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{selectedRecord.date} · {selectedRecord.format}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3C6E', marginTop: 2 }}>{selectedRecord.title}</div>
                </div>
                <span style={{ fontSize: 10, background: '#B5D4F4', color: '#0C447C', padding: '2px 8px', borderRadius: 99 }}>선택됨</span>
              </div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8, maxHeight: 200, overflowY: 'auto', padding: '8px 0', borderTop: '0.5px solid #e5e7eb' }}>
                {selectedRecord.content.slice(0, 300)}
                {selectedRecord.content.length > 300 && '...'}
              </div>
            </div>
            <button style={styles.btnSecondary} onClick={() => setStep('list')}>
              ← 다른 기록 보기
            </button>
            <button style={styles.btnPrimary} onClick={() => setStep('items')}>
              🔮 시놉시스로 확정
            </button>
          </>
        )}

        {step === 'items' && (
          <>
            <div style={{ ...styles.card, background: '#EEF3FA', border: '0.5px solid #B5D4F4' }}>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>선택된 기록</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E' }}>{selectedRecord?.title}</p>
            </div>

            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E', marginBottom: 12 }}>① 예언 종류</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PROPHECY_TYPES.map(t => (
                  <button key={t} style={styles.pill(prophecyType === t)} onClick={() => setProphecyType(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E', marginBottom: 12 }}>② 시간 배경</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIME_OPTIONS.map(t => (
                  <button key={t} style={styles.pill(timeOption === t)} onClick={() => setTimeOption(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E', marginBottom: 8 }}>③ 지금 가장 넘고 싶은 한 가지는?</p>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="예: Flutter 앱 출시, 건강 회복, 관계 회복..."
                rows={3}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '10px 12px', fontSize: 14, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151',
                }}
              />
            </div>

            <button style={styles.btnPrimary} onClick={goToSynopsis} disabled={!question.trim()}>
              📖 시놉시스 생성하기
            </button>
          </>
        )}

      </div>
    </div>
  );
}
