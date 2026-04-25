import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useLoading } from '../contexts/LoadingContext';

interface LawArticle {
  articleStr: string;
  title: string;
  content: string;
  lawName: string;
  isPrecLinked: boolean;
}

export function HaruRawPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<LawArticle[] | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [error, setError] = useState('');
  const { showLoading, hideLoading } = useLoading();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setResults(null);
    setAiSummary('');
    setError('');
    showLoading('AI가 법령을 검색 중입니다');

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const lawSearch = httpsCallable(functions, 'lawSearch');
      const res: any = await lawSearch({ query });
      const data = res.data;

      if (!data.success) {
        setError(data.message || '검색 결과가 없습니다.');
        return;
      }
      setResults(data.data);
      setAiSummary(data.aiSummary);
    } catch (err: any) {
      setError('법령 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C6E', marginBottom: 4 }}>
          ⚖️ HARUraw
        </h1>
        <p style={{ fontSize: 13, color: '#666' }}>AI 기반 실시간 법령 검색 도우미</p>
      </div>

      {/* 검색창 */}
      <form onSubmit={handleSearch} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 돈을 빌려줬는데 안 갚아요"
            style={{
              flex: 1, padding: '12px 14px', fontSize: 16,
              border: '1.5px solid #1A3C6E', borderRadius: 10,
              outline: 'none', backgroundColor: '#fff',
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '12px 18px', backgroundColor: '#1A3C6E',
              color: '#fff', border: 'none', borderRadius: 10,
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            검색
          </button>
        </div>
      </form>

      {/* 로딩 */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#1A3C6E' }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>⚖️ 법령을 분석 중입니다...</p>
          <p style={{ fontSize: 13, color: '#999', marginTop: 6 }}>잠시만 기다려주세요</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{
          padding: 16, backgroundColor: '#fff3f3',
          border: '1px solid #ffcccc', borderRadius: 10,
          color: '#cc0000', fontSize: 14, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* AI 분석 결과 */}
      {aiSummary && (
        <div style={{
          padding: 16, backgroundColor: '#EEF4FF',
          border: '1px solid #c7d9f8', borderRadius: 10, marginBottom: 16,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', marginBottom: 6 }}>
            💡 AI 분석 결과
          </p>
          <p style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{aiSummary}</p>
        </div>
      )}

      {/* 법령 카드 */}
      {results && results.map((article, idx) => (
        <div key={idx} style={{
          backgroundColor: '#fff', border: '1px solid #e0e0e0',
          borderRadius: 12, padding: 16, marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              backgroundColor: '#1A3C6E', color: '#fff',
              borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700,
            }}>
              {article.articleStr}
            </span>
            <span style={{ fontSize: 13, color: '#555' }}>{article.lawName}</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 6 }}>
            {article.title}
          </p>
          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>{article.content}</p>
        </div>
      ))}

      {/* 초기 안내 */}
      {!isLoading && !results && !error && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <p style={{ fontSize: 15 }}>일상어로 질문하시면</p>
          <p style={{ fontSize: 15 }}>관련 법령을 찾아드립니다</p>
        </div>
      )}

      {/* 면책 문구 */}
      <div style={{
        marginTop: 32, padding: 12, backgroundColor: '#f9f9f9',
        borderRadius: 8, fontSize: 11, color: '#999',
        textAlign: 'center', lineHeight: 1.6,
      }}>
        본 서비스는 법령 정보 제공을 목적으로 하며,<br />
        전문적인 법률 자문을 대체할 수 없습니다.
      </div>
    </div>
  );
}