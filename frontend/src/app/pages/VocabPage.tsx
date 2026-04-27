import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface VocabEntry {
  word: string;
  meaning: string;
  example?: string;
  memo?: string;
  savedAt: any;
}

export default function VocabPage() {
  const navigate = useNavigate();
  const [vocabList, setVocabList] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        await loadFromFirestore(user.uid);
      } else {
        setIsLoggedIn(false);
        loadFromLocal();
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loadFromFirestore = async (uid: string) => {
    const snap = await getDocs(collection(db, 'users', uid, 'vocabulary'));
    const list = snap.docs.map(d => ({ word: d.id, ...d.data() } as VocabEntry));
    list.sort((a, b) => {
      const aTime = a.savedAt?.toMillis?.() ?? new Date(a.savedAt).getTime();
      const bTime = b.savedAt?.toMillis?.() ?? new Date(b.savedAt).getTime();
      return bTime - aTime;
    });
    setVocabList(list);
  };

  const loadFromLocal = () => {
    const raw = localStorage.getItem('haru_vocab');
    if (!raw) return;
    const obj = JSON.parse(raw);
    const list = Object.values(obj) as VocabEntry[];
    list.sort((a, b) => (b.savedAt > a.savedAt ? 1 : -1));
    setVocabList(list);
  };

  const handleDelete = async (word: string) => {
    if (!confirm(`"${word}" 을 단어장에서 삭제할까요?`)) return;
    const user = auth.currentUser;
    if (user) {
      await deleteDoc(doc(db, 'users', user.uid, 'vocabulary', word));
      setVocabList(prev => prev.filter(v => v.word !== word));
    } else {
      const raw = localStorage.getItem('haru_vocab');
      if (!raw) return;
      const obj = JSON.parse(raw);
      delete obj[word];
      localStorage.setItem('haru_vocab', JSON.stringify(obj));
      setVocabList(prev => prev.filter(v => v.word !== word));
    }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
      불러오는 중...
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 80px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none',
            fontSize: 14, color: '#1A3C6E',
            cursor: 'pointer', padding: '4px 8px 4px 0',
          }}
        >
          ← 뒤로
        </button>
        <span style={{ fontSize: 22 }}>📚</span>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1A3C6E', margin: 0 }}>
          내 단어장
        </h1>
        <span style={{
          marginLeft: 'auto', fontSize: 13, color: '#888',
          background: '#f3f4f6', padding: '3px 10px', borderRadius: 20,
        }}>
          {vocabList.length}개
        </span>
      </div>

      {/* 비어있을 때 */}
      {vocabList.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          color: '#aaa', fontSize: 15,
        }}>
          저장된 단어가 없어요.<br />
          성경 본문에서 단어를 클릭해 저장해보세요!
        </div>
      )}

      {/* 단어 카드 목록 */}
      {vocabList.map((v) => (
        <div key={v.word} style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 14, padding: '16px', marginBottom: 12,
        }}>
          {/* 단어 + 삭제 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1A3C6E' }}>{v.word}</span>
            <button
              onClick={() => handleDelete(v.word)}
              style={{
                background: 'none', border: 'none',
                color: '#d1d5db', fontSize: 18, cursor: 'pointer', padding: 0,
              }}
            >✕</button>
          </div>

          {/* 뜻 */}
          <div style={{ fontSize: 15, color: '#333', marginBottom: 8 }}>
            {v.meaning}
          </div>

          {/* 예문 */}
          {v.example && (
            <div style={{
              fontSize: 13, color: '#555', fontStyle: 'italic',
              background: '#f9fafb', borderRadius: 8,
              padding: '8px 10px', marginBottom: 8,
              borderLeft: '3px solid #1A3C6E',
            }}>
              📖 {v.example}
            </div>
          )}

          {/* 메모 */}
          {v.memo && (
            <div style={{
              fontSize: 13, color: '#555',
              background: '#fefce8', borderRadius: 8,
              padding: '8px 10px',
              borderLeft: '3px solid #10b981',
            }}>
              📝 {v.memo}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
