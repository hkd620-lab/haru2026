import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { collection, doc, setDoc, getDocs, orderBy, query, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

const CHECKLIST_ITEMS = [
  { id: 'firestore_rw', category: 'Firebase', label: 'Firestore 읽기/쓰기 정상' },
  { id: 'login_3', category: 'Firebase', label: '로그인 3종 정상 (구글/카카오/네이버)' },
  { id: 'record_save', category: 'Firebase', label: '기록 저장/불러오기 정상' },
  { id: 'sayu_response', category: 'AI', label: 'SAYU(사유) 응답 정상' },
  { id: 'gemini_speed', category: 'AI', label: 'Gemini 응답 속도 정상' },
  { id: 'payment_btn', category: '결제/환경', label: '구독 결제 버튼 정상' },
  { id: 'domain_access', category: '결제/환경', label: 'haru2026.com 접속 정상' },
  { id: 'ssl_cert', category: '결제/환경', label: 'SSL 인증서 정상 (자물쇠)' },
  { id: 'fcm_mobile', category: '알림', label: 'FCM 알림 수신 정상 (iOS/Android)' },
  { id: 'fcm_mac', category: '알림', label: 'FCM 알림 수신 정상 (Mac)' },
];

const CATEGORIES = ['Firebase', 'AI', '결제/환경', '알림'];

function getTodayStr() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function AdminChecklistPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastCheckDate, setLastCheckDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid || user.uid !== DEVELOPER_UID) {
      navigate('/');
      return;
    }
    loadTodayData();
    loadLastCheckDate();
  }, [user?.uid]);

  async function loadTodayData() {
    if (!user?.uid) return;
    try {
      const todayRef = doc(db, 'users', user.uid, 'checklist', getTodayStr());
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(todayRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.items) setChecked(new Set(data.items));
      }
    } catch (e) {
      // ignore
    }
  }

  async function loadLastCheckDate() {
    if (!user?.uid) return;
    try {
      const ref = collection(db, 'users', user.uid, 'checklist');
      const q = query(ref, orderBy('completedAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setLastCheckDate(snap.docs[0].id);
      }
    } catch (e) {
      // ignore
    }
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const todayStr = getTodayStr();
      const ref = doc(db, 'users', user.uid, 'checklist', todayStr);
      const items = Array.from(checked);
      await setDoc(ref, {
        completedAt: serverTimestamp(),
        count: checked.size,
        allPassed: checked.size === CHECKLIST_ITEMS.length,
        items,
      });
      setSaved(true);
      setLastCheckDate(todayStr);
    } catch (e) {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  }

  function formatLastCheckDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '오늘';
    return `${diffDays}일 전`;
  }

  const count = checked.size;
  const total = CHECKLIST_ITEMS.length;
  const progress = (count / total) * 100;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6' }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm mb-4 inline-block"
            style={{ color: '#1A3C6E' }}
          >
            ← 홈으로
          </button>
          <h1 className="text-xl font-bold" style={{ color: '#1A3C6E' }}>
            배포 점검 체크리스트
          </h1>
          {lastCheckDate && (
            <p className="text-xs mt-1" style={{ color: '#999' }}>
              마지막 점검: {lastCheckDate} ({formatLastCheckDate(lastCheckDate)})
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-1" style={{ color: '#1A3C6E' }}>
            <span>진행도</span>
            <span>{count} / {total}</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ backgroundColor: '#e5e7eb' }}>
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: '#10b981' }}
            />
          </div>
        </div>

        {/* Checklist by category */}
        {CATEGORIES.map((cat) => (
          <div key={cat} className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#1A3C6E' }}>
              {cat}
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
              {CHECKLIST_ITEMS.filter((item) => item.category === cat).map((item, idx, arr) => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    backgroundColor: checked.has(item.id) ? '#f0fdf4' : '#ffffff',
                    borderBottom: idx < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs"
                    style={{
                      backgroundColor: checked.has(item.id) ? '#10b981' : '#e5e7eb',
                      color: '#fff',
                    }}
                  >
                    {checked.has(item.id) ? '✓' : ''}
                  </span>
                  <span className="text-sm" style={{ color: checked.has(item.id) ? '#10b981' : '#374151' }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Save button */}
        <div className="text-center mt-4">
          {saved ? (
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>
              ✅ 점검 완료!
            </p>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: '#1A3C6E', color: '#fff' }}
            >
              {saving ? '저장 중...' : '점검 완료 저장'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
