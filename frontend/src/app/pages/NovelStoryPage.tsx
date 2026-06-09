import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ChevronLeft, Printer, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';

export function NovelStoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const story: string = location.state?.story || '';
  const fromRecord: boolean = location.state?.fromRecord || false;
  const protagonistName: string = location.state?.protagonistName || '';
  const timeOption: string = location.state?.timeOption || '';
  const recordDate: string = location.state?.recordDate || '';
  const recordTitle: string = location.state?.recordTitle || '';
  const recordFormat: string = location.state?.recordFormat || '';
  const [reaction, setReaction] = useState<'touched' | 'wow' | 'retry' | null>(null);
  const [savingToRecord, setSavingToRecord] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [publishingShared, setPublishingShared] = useState(false);

  const storyLabel = timeOption ? `${timeOption} 이야기` : '이야기';
  const shareTitle = protagonistName
    ? `${protagonistName}의 ${storyLabel} — HARU미래전망`
    : `나의 ${storyLabel} — HARU미래전망`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(story);
      toast.success('📋 이야기를 복사했습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  };

  const handlePrint = () => {
    document.title = `HARU미래전망_이야기_${new Date().toISOString().slice(0, 10)}.pdf`;
    window.print();
  };

  const handleShare = async () => {
    const shareText = `${story.trim()}\n\n나도 내 이야기를 만들어보세요 👉 https://haru2026.com`;

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText });
      } catch {
        // 사용자가 취소한 경우 무시
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareTitle}\n\n${shareText}`);
        toast.success('📋 이야기를 클립보드에 복사했습니다. 가족에게 붙여넣기 해보세요!');
      } catch {
        toast.error('공유에 실패했습니다.');
      }
    }
  };

  const buildStoryRecord = () => {
    const today = new Date().toISOString().slice(0, 10);
    const publishDate = recordDate || today;
    const storyTitle = shareTitle.replace(' — HARU미래전망', '');
    return {
      date: publishDate,
      formats: ['에세이'],
      content: story,
      essay_title: storyTitle,
      essay_ai_title: storyTitle,
      essay_sayu: story,
      future_story_source: {
        type: 'HARU미래전망',
        protagonistName,
        timeOption,
        fromRecord,
        recordTitle,
        recordDate,
        recordFormat,
      },
    };
  };

  const handleSaveToMyRecord = async () => {
    if (!user?.uid) {
      toast.error('로그인 후 나의 기록에 저장할 수 있습니다.');
      return;
    }
    if (savedRecordId) {
      toast('이미 나의 기록에 저장되어 있습니다.');
      return;
    }
    setSavingToRecord(true);
    try {
      const id = await firestoreService.saveRecord(user.uid, buildStoryRecord());
      setSavedRecordId(id);
      toast.success('나의 기록에 저장했습니다. 기록 페이지에서 확인할 수 있어요.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSavingToRecord(false);
    }
  };

  const handlePublishTogether = async () => {
    if (!user?.uid) {
      toast.error('로그인 후 SAYU-함께보기에 공개할 수 있습니다.');
      return;
    }

    const confirmed = window.confirm(
      '최종 이야기를 SAYU-함께보기에 공개합니다.\n이야기 본문과 제목만 공개되며 이메일, UID, 원문 기록 위치는 공개되지 않습니다.',
    );
    if (!confirmed) return;

    setPublishingShared(true);
    try {
      const profile = await firestoreService.getUserProfile(user.uid);
      if (!String(profile.nickname || '').trim()) {
        toast.error('공개하려면 먼저 설정에서 닉네임을 입력해 주세요.');
        return;
      }

      // 이미 나의 기록에 저장된 경우 재사용, 아니면 새로 저장
      const recordId = savedRecordId ?? await firestoreService.saveRecord(user.uid, buildStoryRecord());
      if (!savedRecordId) setSavedRecordId(recordId);

      await firestoreService.publishRecordToShared(user.uid, recordId);
      toast.success('최종 이야기를 SAYU-함께보기에 공개했습니다.');
      navigate('/sayu-together');
    } catch (error: any) {
      console.error('미래전망 이야기 공개 실패:', error);
      const message = String(error?.message || '');
      if (message.includes('PUBLIC_NICKNAME_REQUIRED')) {
        toast.error('공개하려면 먼저 설정에서 닉네임을 입력해 주세요.');
      } else {
        toast.error('SAYU-함께보기 공개에 실패했습니다.');
      }
    } finally {
      setPublishingShared(false);
    }
  };

  if (!story) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF9F6', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔮</div>
        <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
          이야기 정보가 없습니다.
        </p>
        <button
          onClick={() => navigate('/novel-synopsis')}
          style={{
            padding: '10px 20px', borderRadius: 10, border: '1px solid #1A3C6E',
            background: '#fff', color: '#1A3C6E', fontSize: 13, cursor: 'pointer',
          }}
        >시놉시스로 이동</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6', paddingBottom: 100 }}>
      <PageHeaderActions />
      {/* 헤더 — 한 단계 뒤로(설정으로) + 액션 */}
      <div
        className="no-print"
        style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: '#FAF9F6', borderBottom: '0.5px solid #e5e5e5',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <button
          onClick={() => navigate(fromRecord ? '/record-prophecy' : '/novel-synopsis')}
          aria-label="이전 단계"
          title="이전 단계"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ChevronLeft size={22} color="#1A3C6E" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3C6E', flex: 1 }}>
          🔮 HARU미래전망 단편 이야기
        </span>
        <button
          onClick={handleCopy}
          title="복사"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
        ><Copy size={18} color="#6B7280" /></button>
        <button
          onClick={handlePrint}
          title="PDF 저장"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
        ><Printer size={18} color="#6B7280" /></button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{
          background: '#fff', border: '1.5px solid #C7D2FE',
          borderRadius: 14, padding: '28px 22px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🔮</div>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, marginBottom: 0 }}>
              {protagonistName ? `${protagonistName}의 이야기` : '나의 이야기'} · {timeOption || ''}
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              사주는 태어난 날을 봅니다.<br />
              HARU미래전망은 당신이 살아온 날을 봅니다.
            </p>
          </div>
          <p
            style={{
              fontSize: 15, color: '#1f2937', lineHeight: 2,
              whiteSpace: 'pre-wrap', margin: 0,
              fontFamily: '"Nanum Myeongjo", "Noto Serif KR", serif',
            }}
          >{story}</p>
        </div>

        {/* 감정 반응 버튼 */}
        <div className="no-print" style={{ marginTop: 24, marginBottom: 8 }}>
          <p style={{
            fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 12,
          }}>
            이 이야기가 마음에 닿으셨나요?
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {([
              { key: 'touched', emoji: '😢', label: '울컥했어요' },
              { key: 'wow',     emoji: '✨', label: '소름돋았어요' },
              { key: 'retry',   emoji: '🤔', label: '다시 써볼게요' },
            ] as const).map(({ key, emoji, label }) => (
              <button
                key={key}
                onClick={() => {
                  setReaction(key);
                  if (key === 'retry') {
                    navigate('/novel-synopsis', { state: location.state });
                  } else {
                    toast.success(
                      key === 'touched'
                        ? '이 이야기가 당신 마음에 닿았군요 🤍'
                        : '당신의 인생이 그만큼 특별합니다 ✨'
                    );
                  }
                }}
                style={{
                  padding: '10px 18px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                  border: reaction === key ? '2px solid #1A3C6E' : '1.5px solid #e5e7eb',
                  background: reaction === key ? '#1A3C6E' : '#fff',
                  color: reaction === key ? '#fff' : '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </div>

        {/* 가족에게 보내기 */}
        <div className="no-print" style={{ marginBottom: 8 }}>
          <button
            onClick={handleShare}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: '#10b981', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            📤 가족에게 보내기
          </button>
        </div>

        {/* 나의 기록에 저장 */}
        <div className="no-print" style={{ marginBottom: 8 }}>
          <button
            onClick={handleSaveToMyRecord}
            disabled={savingToRecord || !!savedRecordId}
            style={{
              width: '100%', padding: '13px', borderRadius: 12,
              border: '1.5px solid #1A3C6E',
              background: savedRecordId ? '#EEF2FF' : '#fff',
              color: savedRecordId ? '#1A3C6E' : '#1A3C6E',
              fontSize: 14, fontWeight: 700,
              cursor: (savingToRecord || !!savedRecordId) ? 'default' : 'pointer',
            }}
          >
            {savingToRecord ? '저장 중...' : savedRecordId ? '✅ 나의 기록에 저장됨' : '📚 나의 기록에 저장'}
          </button>
        </div>

        <div className="no-print" style={{ marginBottom: 8 }}>
          <button
            onClick={handlePublishTogether}
            disabled={publishingShared}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: publishingShared ? '#94a3b8' : '#0F766E',
              color: '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: publishingShared ? 'wait' : 'pointer',
            }}
          >
            {publishingShared ? '공개 중...' : '🌿 SAYU·함께보기에 공개'}
          </button>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={() => navigate('/novel-synopsis', { state: location.state })}
            style={{
              flex: 1, padding: '13px', borderRadius: 10,
              border: '1.5px solid #1A3C6E', background: '#fff',
              color: '#1A3C6E', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >← 시놉시스로</button>
          <button
            onClick={handlePrint}
            style={{
              flex: 1, padding: '13px', borderRadius: 10, border: 'none',
              background: '#1A3C6E', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >📄 PDF 저장</button>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
