import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PREFIX_TO_FORMAT } from '../types/haruTypes';

// 메타 필드 제외 suffix 목록
const META_SUFFIXES = ['_sayu', '_polished', '_polishedAt', '_mode', '_stats', '_images', '_rating'];

// 필드 키 → 한국어 라벨 매핑
const FIELD_LABELS: Record<string, string> = {
  // 일기
  diary_action: '행동',
  diary_good: '좋았던 일',
  diary_conflict: '갈등',
  diary_regret: '아쉬움',
  diary_learning: '배움',
  diary_space: '여백',
  // 에세이
  essay_observation: '관찰',
  essay_impression: '첫인상',
  essay_comparison: '비교',
  essay_essence: '핵심',
  essay_closing: '끝인사',
  essay_space: '여백',
  // 선교보고
  mission_place: 'Place',
  mission_action: 'Action',
  mission_grace: 'Grace',
  mission_heart: 'Heart',
  mission_prayer: 'Prayer',
  mission_space: '여백',
  // 일반보고
  report_activity: '활동 명칭',
  report_progress: '진행 상황',
  report_achievement: '핵심 성과',
  report_notes: '특이 사항',
  report_future: '향후 계획',
  report_space: '여백',
  // 업무일지
  work_schedule: 'Schedule',
  work_result: 'Result',
  work_pending: 'Pending',
  work_metric: 'Key Metric',
  work_rating: 'Rating',
  work_space: '여백',
  // 여행기록
  travel_journey: '여정',
  travel_scenery: '풍경',
  travel_food: '미식',
  travel_thought: '단상',
  travel_gratitude: '감사',
  travel_space: '여백',
  // 텃밭일지
  garden_crop: '작물',
  garden_work: '오늘 한 일',
  garden_observation: '관찰',
  garden_issue: '문제점',
  garden_plan: '다음 계획',
  garden_space: '여백',
  // 애완동물관찰일지
  pet_name: '반려동물 이름',
  pet_health: '건강 상태',
  pet_behavior: '행동 관찰',
  pet_care: '돌봄 기록',
  pet_special: '특별한 일',
  pet_space: '여백',
  // 육아일기
  child_name: '아이 이름',
  child_growth: '성장 기록',
  child_meal: '식사',
  child_activity: '활동',
  child_emotion: '부모의 마음',
  child_space: '여백',
  // 메모
  memo_title: '제목',
  memo_content: '내용',
  memo_action: '다음 행동',
  memo_space: '여백',
};

// 필드 표시 순서 (형식별)
const FIELD_ORDER: Record<string, string[]> = {
  diary: ['diary_action', 'diary_good', 'diary_conflict', 'diary_regret', 'diary_learning', 'diary_space'],
  essay: ['essay_observation', 'essay_impression', 'essay_comparison', 'essay_essence', 'essay_closing', 'essay_space'],
  mission: ['mission_place', 'mission_action', 'mission_grace', 'mission_heart', 'mission_prayer', 'mission_space'],
  report: ['report_activity', 'report_progress', 'report_achievement', 'report_notes', 'report_future', 'report_space'],
  work: ['work_schedule', 'work_result', 'work_pending', 'work_metric', 'work_rating', 'work_space'],
  travel: ['travel_journey', 'travel_scenery', 'travel_food', 'travel_thought', 'travel_gratitude', 'travel_space'],
  garden: ['garden_crop', 'garden_work', 'garden_observation', 'garden_issue', 'garden_plan', 'garden_space'],
  pet: ['pet_name', 'pet_health', 'pet_behavior', 'pet_care', 'pet_special', 'pet_space'],
  child: ['child_name', 'child_growth', 'child_meal', 'child_activity', 'child_emotion', 'child_space'],
  memo: ['memo_title', 'memo_content', 'memo_action', 'memo_space'],
};

export function RecordDetailPage() {
  const { date, formatKey } = useParams<{ date: string; formatKey: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recordData, setRecordData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatLabel = formatKey ? (PREFIX_TO_FORMAT[formatKey] ?? formatKey) : '';

  // 날짜 표시용
  const formatDateKorean = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
  };

  useEffect(() => {
    if (!user?.uid || !date || !formatKey) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'records', date);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setRecordData(snap.data());
        } else {
          setRecordData(null);
        }
      } catch (err) {
        console.error('기록 불러오기 실패:', err);
        setRecordData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.uid, date, formatKey]);

  // 내용 비어있는지 판단
  const isEmpty = !recordData || !Object.keys(recordData).some(
    k =>
      k.startsWith(`${formatKey}_`) &&
      !META_SUFFIXES.some(s => k.endsWith(s)) &&
      typeof recordData[k] === 'string' &&
      recordData[k].trim().length > 0
  );

  // 표시할 필드 목록 (내용 있는 것만)
  const visibleFields = formatKey
    ? (FIELD_ORDER[formatKey] ?? []).filter(
        k => recordData && typeof recordData[k] === 'string' && recordData[k].trim().length > 0
      )
    : [];

  // 삭제 처리
  const handleDeleteFormat = async () => {
    if (!user?.uid || !date || !formatKey) return;
    setIsDeleting(true);
    try {
      // 1. Storage 이미지 삭제 (없으면 오류 무시)
      try {
        const storageRef = ref(storage, `users/${user.uid}/format_photos`);
        const list = await listAll(storageRef);
        const targets = list.items.filter(item =>
          item.name.startsWith(`${date}_${formatKey}_`)
        );
        await Promise.allSettled(targets.map(item => deleteObject(item)));
      } catch {
        // 이미지 없는 경우 무시
      }

      // 2. Firestore 필드 삭제
      const docRef = doc(db, 'users', user.uid, 'records', date);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data() ?? {};
      const currentFormat = PREFIX_TO_FORMAT[formatKey];
      const newFormats = ((data.formats ?? []) as string[]).filter(f => f !== currentFormat);

      if (newFormats.length === 0) {
        await deleteDoc(docRef);
      } else {
        const updateData: Record<string, any> = {
          formats: newFormats,
          [`${formatKey}`]: deleteField(),
          [`${formatKey}_sayu`]: deleteField(),
          [`${formatKey}_polished`]: deleteField(),
          [`${formatKey}_polishedAt`]: deleteField(),
          [`${formatKey}_mode`]: deleteField(),
          [`${formatKey}_stats`]: deleteField(),
          [`${formatKey}_tags`]: deleteField(),
          [`${formatKey}_images`]: deleteField(),
          [`${formatKey}_rating`]: deleteField(),
        };
        // 해당 prefix로 시작하는 모든 필드 삭제
        Object.keys(data).forEach(k => {
          if (k.startsWith(`${formatKey}_`)) {
            updateData[k] = deleteField();
          }
        });
        await updateDoc(docRef, updateData);
      }

      // 3. 이전 페이지로 이동
      navigate(-1);
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 56px - 80px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAF9F6',
        }}
      >
        <p style={{ color: '#999', fontSize: 14 }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 56px - 80px)', backgroundColor: '#EDE9F5' }}>
      {/* 헤더 */}
      <div
        style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e5e5',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {/* 왼쪽: 뒤로가기 + 제목 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: '#1A3C6E',
              flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 22, height: 22 }} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#1A3C6E',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {formatLabel}
            </h1>
            {date && (
              <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0 0' }}>
                {formatDateKorean(date)}
              </p>
            )}
          </div>
        </div>

        {/* 오른쪽: 삭제 버튼 */}
        <button
          onClick={() => setShowDeleteDialog(true)}
          style={{
            background: 'rgba(220,50,50,0.18)',
            border: '1px solid rgba(220,80,80,0.45)',
            color: '#f87171',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          🗑 삭제
        </button>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
        {isEmpty ? (
          /* 빈 기록 안내 */
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
            }}
          >
            <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 16 }}>📄</div>
            <p style={{ color: 'var(--color-text-secondary, #888)', fontSize: 15, marginBottom: 8 }}>
              내용이 없는 기록입니다.
            </p>
            <p style={{ color: '#f87171', fontSize: 13 }}>
              삭제 버튼을 눌러 정리하세요.
            </p>
          </div>
        ) : (
          /* 기록 내용 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {visibleFields.map(fieldKey => (
              <div
                key={fieldKey}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  border: '1px solid #e5e5e5',
                  padding: '16px 20px',
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: '#1A3C6E',
                    fontWeight: 600,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {FIELD_LABELS[fieldKey] ?? fieldKey}
                </p>
                <p
                  style={{
                    fontSize: 14,
                    color: '#333',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}
                >
                  {recordData?.[fieldKey]}
                </p>
              </div>
            ))}

            {/* SAYU 내용 (있으면 표시) */}
            {recordData?.[`${formatKey}_sayu`] && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  borderRadius: 10,
                  border: '1px solid #bbf7d0',
                  padding: '16px 20px',
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: '#10b981',
                    fontWeight: 600,
                    marginBottom: 8,
                    letterSpacing: '0.05em',
                  }}
                >
                  ✅ SAYU(사유)
                </p>
                <p
                  style={{
                    fontSize: 14,
                    color: '#333',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}
                >
                  {recordData[`${formatKey}_sayu`]}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => !isDeleting && setShowDeleteDialog(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: '28px 24px',
              maxWidth: 360,
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p
              style={{
                fontSize: 15,
                color: '#1A3C6E',
                fontWeight: 600,
                marginBottom: 10,
                textAlign: 'center',
              }}
            >
              정말로 이 기록을 삭제하시겠습니까?
            </p>
            <p
              style={{
                fontSize: 13,
                color: '#f87171',
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              삭제 후 복구가 불가능합니다.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: '1px solid #e5e5e5',
                  background: '#f9fafb',
                  color: '#666',
                  fontSize: 14,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteFormat}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: isDeleting ? '#fca5a5' : '#ef4444',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isDeleting ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.7s linear infinite',
                      }}
                    />
                    삭제 중...
                  </>
                ) : (
                  '삭제 확인'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스피너 애니메이션 */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
