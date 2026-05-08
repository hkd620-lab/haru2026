import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

// 구글 site:ebs.co.kr 검색으로 EBS 공식 명의 콘텐츠 안내 (EBS 사이트 장애·개편 무관)
const buildEbsSearchUrl = (kw: string) => {
  const k = kw.trim();
  const q = k ? `site:ebs.co.kr 명의 ${k}` : 'site:ebs.co.kr 명의';
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
};

export function SayuHealthEbsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [keyword, setKeyword] = useState('');

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleOpen = () => {
    const k = keyword.trim();
    if (k) {
      toast.success(`"${k}" 검색 결과 페이지를 새 창에서 엽니다.`);
    } else {
      toast.info('EBS 명의 검색 결과 페이지를 새 창에서 엽니다.');
    }
    window.open(buildEbsSearchUrl(k), '_blank', 'noopener,noreferrer');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleOpen();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 16, // 모바일 줌 방지 (CLAUDE.md 실패이력)
    border: '1px solid #d8d3c4',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: '#2C2C2A',
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
            background: '#1A3C6E',
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
          SAYU · CARE
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🌟 EBS명의찾기
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          증상·질병 키워드를 입력하면 EBS 명의 검색 결과 페이지로 이동합니다.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl p-4 md:p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, #E0E8B8 0%, #ffffff 70%)',
          border: '1px solid #D4DEA0',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#4A5A2C',
            marginBottom: 6,
          }}
        >
          증상 또는 질병 키워드
        </div>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예) 당뇨, 갑상선, 허리디스크"
          style={inputStyle}
        />

        <div className="flex justify-end mt-4">
          <button
            type="submit"
            className="rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              backgroundColor: '#4A5A2C',
              color: '#fff',
              boxShadow: '0 4px 10px -6px rgba(74,90,44,0.6)',
            }}
          >
            🔍 EBS 명의 검색 결과 열기
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: '#4A5A2C',
            marginTop: 12,
            lineHeight: 1.6,
            background: '#F1F5DC',
            border: '1px solid #D4DEA0',
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          입력하신 키워드와 함께 EBS 공식 사이트(ebs.co.kr) 안에서<br />
          관련 명의 콘텐츠를 찾아드립니다.<br />
          검색 결과에서 보고 싶은 영상·자료를 직접 선택해 주세요.
        </div>
      </form>

      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: '#F5F0E8',
          border: '1px solid #E5DFD0',
          fontSize: 11,
          color: '#7A6F5A',
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#4A5A2C' }}>
          출처: EBS 명의 (공식 사이트)
        </div>
        본 페이지는 EBS와 무관한 정보 안내 서비스입니다.
        구글 검색(site:ebs.co.kr)을 통해 EBS 명의 콘텐츠를 안내합니다.
        HARU2026은 EBS 콘텐츠를 자체 저장·재배포하지 않으며,
        실제 영상·자료는 위 외부 링크에서 직접 확인하세요.
        의학적 판단은 반드시 의료진과 상의하시기 바랍니다.
      </div>
    </div>
  );
}

export default SayuHealthEbsPage;
