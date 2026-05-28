import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

export function SayuTogetherPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2 flex items-center gap-2">
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: '#0F766E',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          BETA
        </span>
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          SAYU · TOGETHER
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🌿 SAYU·함께보기
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          HARU 회원들이 공개한 기록을 함께 읽고 댓글로 마음을 나누는 공간입니다.
        </p>
      </div>

      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, #ECFDF5 0%, #ffffff 70%)',
          border: '1px solid #D1FAE5',
        }}
      >
        <p className="text-sm" style={{ color: '#0F766E', lineHeight: 1.7 }}>
          공개된 기록을 준비하고 있습니다.<br />
          곧 이곳에서 다른 회원들의 SAYU 기록을 만나보실 수 있어요.
        </p>
      </div>
    </div>
  );
}
