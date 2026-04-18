import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';

interface DiaryLearnModalProps {
  onClose: () => void;
}

interface DiaryItem {
  id: string;
  date: string;
  title: string;
  content: string;
}

export function DiaryLearnModal({ onClose }: DiaryLearnModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'list' | 'detail'>('list');
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DiaryItem | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const ref = collection(db, 'users', user.uid, 'records');
        const snap = await getDocs(ref);
        const items: DiaryItem[] = [];
        snap.forEach(dateDoc => {
          const data = dateDoc.data();
          Object.entries(data).forEach(([key, val]: any) => {
            if (
              (key.startsWith('diary_') || key.startsWith('essay_')) &&
              !key.endsWith('_sayu') &&
              val?.content
            ) {
              items.push({
                id: `${dateDoc.id}_${key}`,
                date: dateDoc.id,
                title: val.title || '제목 없음',
                content: val.content,
              });
            }
          });
        });
        items.sort((a, b) => b.date.localeCompare(a.date));
        setDiaries(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 100, display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          backgroundColor: '#fff',
          borderRadius: '20px 20px 0 0',
          padding: '24px 24px 40px',
          maxHeight: '80vh', overflowY: 'auto',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          {step === 'detail' ? (
            <button
              onClick={() => setStep('list')}
              style={{ background: 'none', border: 'none', fontSize: 14, color: '#1A3C6E', cursor: 'pointer', fontWeight: 700 }}
            >← 목록으로</button>
          ) : (
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>✍️ 영어 일기 학습</p>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
          >✕</button>
        </div>

        {/* 일기 목록 */}
        {step === 'list' && (
          <div>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#999', fontSize: 14, padding: '20px 0' }}>일기 불러오는 중...</p>
            ) : diaries.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', fontSize: 14, padding: '20px 0' }}>작성한 일기가 없습니다</p>
            ) : (
              diaries.map(diary => (
                <div
                  key={diary.id}
                  onClick={() => { setSelected(diary); setStep('detail'); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0', borderBottom: '0.5px solid #eee', cursor: 'pointer',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>{diary.date}</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A3C6E' }}>{diary.title}</p>
                  </div>
                  <span style={{ color: '#999', fontSize: 18 }}>›</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 일기 상세 (다음 단계에서 기능 추가 예정) */}
        {step === 'detail' && selected && (
          <div>
            <p style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>{selected.date}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 16 }}>{selected.title}</p>
            <div style={{
              backgroundColor: '#f8faff', borderRadius: 12,
              padding: 16, border: '1.5px solid #d0dff0',
              fontSize: 14, lineHeight: 1.8, color: '#333',
            }}>
              {selected.content}
            </div>
            <p style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 20 }}>
              번역/학습 기능은 다음 업데이트에서 추가됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
