import type { CSSProperties } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { getOrigin } from '../services/v2Origin';

// 모든 v2 진입 가능 페이지 우상단에 배치하는 ← 뒤로가기 + X 닫기 버튼.
// onClose: 페이지 고유 closeToOrigin 함수가 있으면 넘겨준다. 없으면 origin || '/'.
export function PageHeaderActions({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const baseStyle: CSSProperties = {
    background: 'var(--haru-surface, #fff)',
    border: '1px solid var(--haru-border, #e5e5e5)',
    borderRadius: '50%',
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(getOrigin() || '/');
    }
  };
  const handleClose = onClose ?? (() => navigate(getOrigin() || '/'));
  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top, 0px))',
        right: 'max(12px, env(safe-area-inset-right, 0px))',
        zIndex: 100,
        display: 'flex',
        gap: 6,
      }}
    >
      <button
        type="button"
        aria-label="뒤로가기"
        title="뒤로가기"
        onClick={handleBack}
        style={baseStyle}
      >
        <ChevronLeft style={{ width: 18, height: 18, color: 'var(--haru-link, #1A3C6E)' }} />
      </button>
      <button
        type="button"
        aria-label="닫기"
        title="닫기"
        onClick={handleClose}
        style={baseStyle}
      >
        <X style={{ width: 18, height: 18, color: 'var(--haru-link, #1A3C6E)' }} />
      </button>
    </div>
  );
}
