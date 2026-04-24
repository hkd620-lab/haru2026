import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useLoading } from '../contexts/LoadingContext';
import { toast } from 'sonner';

export function NovelSynopsisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showLoading, hideLoading } = useLoading();
  const [synopsis, setSynopsis] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const settings = location.state?.settings || {};

  const handleGenerateSynopsis = async () => {
    setIsGenerating(true);
    showLoading('🔮 AI가 당신의 미래를 예언하고 있습니다...');
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(functions, 'generateHaruProphecy');
      const result: any = await fn({ ...settings, type: 'synopsis' });
      setSynopsis(result.data.text);
      toast.success('시놉시스가 생성되었습니다!');
    } catch (error: any) {
      const msg = error?.message || '생성에 실패했습니다. 다시 시도해주세요.';
      toast.error(msg);
    } finally {
      hideLoading();
      setIsGenerating(false);
    }
  };

  const handleGenerateStory = async () => {
    setIsGenerating(true);
    showLoading('🔮 AI가 당신의 이야기를 쓰고 있습니다... 잠시만 기다려주세요.');
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(functions, 'generateHaruProphecy');
      const result: any = await fn({ ...settings, type: 'story' });
      navigate('/novel-story', { state: { story: result.data.text, settings } });
    } catch (error: any) {
      const msg = error?.message || '생성에 실패했습니다. 다시 시도해주세요.';
      toast.error(msg);
    } finally {
      hideLoading();
      setIsGenerating(false);
    }
  };

  return (
    <div style={{
      maxWidth: 640, margin: '0 auto', padding: '24px 16px',
      minHeight: 'calc(100vh - 56px - 80px)',
      backgroundColor: '#FAF9F6',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🔮</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E', margin: 0 }}>HARU예언</h1>
        </div>
        <button
          onClick={() => navigate('/novel-studio')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#6B7280', padding: '6px 10px', borderRadius: 8,
          }}
        >← 설정으로</button>
      </div>

      {/* 안내 카드 (시놉시스 없을 때) */}
      {!synopsis && (
        <div style={{
          background: '#EEF2FF', border: '1px solid #C7D2FE',
          borderRadius: 14, padding: '24px', marginBottom: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔮</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
            AI가 당신의 미래를 예언합니다
          </h2>
          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.8, margin: 0 }}>
            설정하신 내용을 바탕으로<br />
            Gemini AI가 당신만의 미래 서사를 생성합니다.<br /><br />
            <strong>"사주는 태어난 날을 봅니다.<br />
            HARU예언은 당신이 살아온 날을 봅니다."</strong>
          </p>
        </div>
      )}

      {/* 시놉시스 결과 */}
      {synopsis && (
        <div style={{
          background: '#fff', border: '1.5px solid #C7D2FE',
          borderRadius: 14, padding: '20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🔮</span>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', margin: 0 }}>
              당신의 예언 시놉시스
            </h2>
          </div>
          <p style={{
            fontSize: 14, color: '#374151', lineHeight: 1.9,
            whiteSpace: 'pre-wrap', margin: 0,
          }}>{synopsis}</p>
        </div>
      )}

      {/* 버튼 영역 */}
      {!synopsis ? (
        <button
          onClick={handleGenerateSynopsis}
          disabled={isGenerating}
          style={{
            width: '100%', padding: '16px', borderRadius: 12, border: 'none',
            background: isGenerating ? '#9ca3af' : '#1A3C6E',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: isGenerating ? 'not-allowed' : 'pointer', marginBottom: 12,
          }}
        >🔮 시놉시스 생성하기</button>
      ) : (
        <>
          <button
            onClick={() => navigate('/novel-studio')}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              border: '2px solid #1A3C6E', background: '#fff', color: '#1A3C6E',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10,
            }}
          >✏️ 서사 수정하기</button>

          <button
            onClick={handleGenerateSynopsis}
            disabled={isGenerating}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              border: '1.5px solid #d1d5db', background: '#f9fafb', color: '#6B7280',
              fontSize: 13, fontWeight: 500,
              cursor: isGenerating ? 'not-allowed' : 'pointer', marginBottom: 10,
            }}
          >🔄 시놉시스 다시 생성</button>

          <button
            onClick={handleGenerateStory}
            disabled={isGenerating}
            style={{
              width: '100%', padding: '16px', borderRadius: 12, border: 'none',
              background: isGenerating ? '#9ca3af' : '#10b981',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer', marginBottom: 10,
            }}
          >📖 이야기 생성하기 (최종)</button>

          <button
            onClick={() => window.print()}
            style={{
              width: '100%', padding: '12px', borderRadius: 12,
              border: '1.5px solid #d1d5db', background: '#fff', color: '#6B7280',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >📄 PDF로 저장</button>
        </>
      )}
    </div>
  );
}
