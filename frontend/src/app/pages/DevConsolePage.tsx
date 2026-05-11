import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface DevTool {
  icon: string;
  label: string;
  description: string;
  path: string;
  color: string;
}

const DEV_TOOLS: DevTool[] = [
  {
    icon: '📖',
    label: '새 책 만들기',
    description: 'AI로 챕터 자동 생성 (사람속으로)',
    path: '/book-create',
    color: '#1A3C6E',
  },
  {
    icon: '📰',
    label: 'K뉴스 발행',
    description: 'AI 자동 분석 카드뉴스 발행',
    path: '/admin/k-news-publisher',
    color: '#B85C2E',
  },
  {
    icon: '🗂️',
    label: '관리자 체크리스트',
    description: '운영 체크리스트',
    path: '/admin/checklist',
    color: '#10b981',
  },
];

export function DevConsolePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  if (!user || !isDeveloper) return null;

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
      <PageHeaderActions onClose={() => navigate('/v2')} />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <h1 className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
          🛠 개발자 콘솔
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          관리자 전용 도구 모음
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEV_TOOLS.map((tool) => (
            <button
              key={tool.path}
              onClick={() => navigate(tool.path)}
              className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-3">{tool.icon}</div>
              <h3 className="font-bold text-base mb-1" style={{ color: tool.color }}>
                {tool.label}
              </h3>
              <p className="text-sm text-gray-600">
                {tool.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
