import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

export function ChildHealthVaccinePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/child-health');
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2">
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          HARU · 아이건강 &gt; 예방접종 일정
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#0F766E' }}>💉 예방접종 일정</h1>
      </div>

      <div
        style={{
          padding: 32,
          border: '1px dashed #5EEAD4',
          borderRadius: 16,
          backgroundColor: '#F0FDFA',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F766E', marginBottom: 8 }}>
          준비 중입니다
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
          아이 생년월일을 입력하면 월령별 예방접종 일정과<br />
          다음 접종 시기를 안내드릴 예정입니다.
        </div>
        <button
          type="button"
          onClick={() => navigate('/child-health')}
          style={{
            marginTop: 20,
            padding: '10px 24px',
            borderRadius: 8,
            border: '1px solid #5EEAD4',
            backgroundColor: '#fff',
            color: '#0F766E',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← 돌아가기
        </button>
      </div>
    </div>
  );
}

export default ChildHealthVaccinePage;
