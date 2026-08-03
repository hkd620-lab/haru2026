import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { EcourtPracticeShell } from '../components/ecourt-practice/EcourtPracticeShell';

const SEARCH_TABS = ['전체', '서류명', '카테고리', '양식', '절차안내', '기타'];
const OTHER_TABS = ['공지사항', '상담사례', '자주하는질문', '문제해결안내', '사용자매뉴얼'];

export function EcourtPracticeSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setMessage('검색어를 입력해 주세요.');
      return;
    }
    setMessage(`“${trimmedQuery}”의 연습 검색 결과입니다.\n실제 서류와 절차는 전자소송포털에서 확인해야 합니다.`);
  };

  return (
    <EcourtPracticeShell>
      <div className="mx-auto max-w-[980px]">
        <div className="mb-8 text-center">
          <p className="text-sm font-extrabold text-[#58708f]">전자소송 절차 익히기</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#162f55] sm:text-4xl">통합검색</h1>
        </div>

        <form onSubmit={handleSearch} className="mx-auto max-w-[720px]">
          <div className="flex flex-col gap-2 border-2 border-[#183c73] bg-white p-2 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색어를 입력하세요."
              className="min-h-12 flex-1 px-3 text-base outline-none"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded bg-[#183c73] px-6 text-sm font-extrabold text-white"
            >
              <Search className="h-4 w-4" />
              검색
            </button>
          </div>
        </form>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {SEARCH_TABS.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`min-h-10 rounded border px-4 text-sm font-extrabold ${
                index === 0
                  ? 'border-[#183c73] bg-[#183c73] text-white'
                  : 'border-[#cbd5e1] bg-white text-[#334155]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-8 border border-[#d7dde5]">
          <div className="grid grid-cols-2 border-b border-[#d7dde5] bg-[#f7f9fc] sm:grid-cols-5">
            {SEARCH_TABS.slice(1).map((tab) => (
              <div
                key={tab}
                className="border-b border-r border-[#d7dde5] px-3 py-3 text-center text-sm font-extrabold text-[#183c73] sm:border-b-0"
              >
                {tab}
              </div>
            ))}
          </div>
          <div className="min-h-[210px] px-4 py-6">
            {message ? (
              <div
                className={`whitespace-pre-line rounded border px-4 py-4 text-sm font-bold leading-7 ${
                  message === '검색어를 입력해 주세요.'
                    ? 'border-[#f5b5b5] bg-[#fff6f6] text-[#9f1f1f]'
                    : 'border-[#bfd1e8] bg-[#f5f9ff] text-[#183c73]'
                }`}
              >
                {message}
              </div>
            ) : (
              <div className="rounded border border-dashed border-[#cbd5e1] bg-[#fafafa] px-4 py-12 text-center text-sm font-bold text-[#64748b]">
                검색어를 입력하고 검색 버튼을 눌러 연습 결과 안내를 확인하세요.
              </div>
            )}
            <div className="mt-6 border border-[#d7dde5]">
              <div className="border-b border-[#d7dde5] bg-[#f7f9fc] px-4 py-3 text-sm font-extrabold text-[#334155]">
                기타
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {OTHER_TABS.map((tab) => (
                  <span
                    key={tab}
                    className="rounded border border-[#d7dde5] px-3 py-2 text-xs font-bold text-[#475569]"
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/lawsuit-practice/portal/login')}
            className="min-h-11 rounded bg-[#183c73] px-5 text-sm font-extrabold text-white"
          >
            로그인 연습으로 이동
          </button>
        </div>
      </div>
    </EcourtPracticeShell>
  );
}
