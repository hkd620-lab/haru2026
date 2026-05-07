import { useNavigate, useLocation } from 'react-router';
import { ChevronLeft, X, Printer, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';

export function NovelStoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const story: string = location.state?.story || '';
  const fromRecord: boolean = location.state?.fromRecord || false;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(story);
      toast.success('📋 이야기를 복사했습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  };

  const handlePrint = () => {
    document.title = `HARU예언_이야기_${new Date().toISOString().slice(0, 10)}.pdf`;
    window.print();
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
      {/* 우상단 fixed X 닫기 — v2 origin 우선 */}
      <button
        type="button"
        aria-label="닫기"
        title="닫기"
        onClick={() => navigate(getOrigin() || '/')}
        className="no-print"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 100,
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <X style={{ width: 18, height: 18, color: '#1A3C6E' }} />
      </button>
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
          🔮 HARU예언 단편 이야기
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
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              사주는 태어난 날을 봅니다.<br />
              HARU예언은 당신이 살아온 날을 봅니다.
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
