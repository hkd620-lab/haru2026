import { Calendar, User, FileText, Sparkles } from 'lucide-react';

interface DigestData {
  title: string;
  author: string;
  date: string;
  level: 'level1' | 'level2' | 'level3' | 'level4';
  content: {
    summary: string;
    keyThemes: string[];
    spiritualInsights: string[];
    actionItems: string[];
    prayerPoints: string[];
  };
  records: {
    date: string;
    title: string;
    excerpt: string;
  }[];
}

interface PDFDigestProps {
  data: DigestData;
}

const levelLabels = {
  level1: 'Level 1: Summary',
  level2: 'Level 2: Structured Insight',
  level3: 'Level 3: Contextual Analysis',
  level4: 'Level 4: Deep Reflection',
};

export function PDFDigest({ data }: PDFDigestProps) {
  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div 
      className="pdf-digest bg-white"
      style={{
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '20mm',
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#1a1a1a',
        lineHeight: '1.8',
      }}
    >
      {/* Header */}
      <header className="pdf-header mb-12 pb-8 border-b-2" style={{ borderColor: '#003366' }}>
        <div className="text-center mb-6">
          <h1 
            className="text-4xl mb-3 tracking-wider"
            style={{ 
              color: '#003366',
              fontWeight: 400,
              letterSpacing: '0.1em',
            }}
          >
            HARU DIGEST
          </h1>
          <p 
            className="text-sm tracking-widest"
            style={{ 
              color: '#666666',
              letterSpacing: '0.15em',
            }}
          >
            {levelLabels[data.level]}
          </p>
        </div>

        <div className="border-t border-b py-6 my-6" style={{ borderColor: '#e5e5e5' }}>
          <h2 
            className="text-2xl text-center mb-4 tracking-wide"
            style={{ 
              color: '#1a1a1a',
              fontWeight: 400,
              lineHeight: '1.6',
            }}
          >
            {data.title}
          </h2>
          
          <div className="flex items-center justify-center gap-8 text-sm" style={{ color: '#666666' }}>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{data.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{data.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>{data.records.length}개 기록</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs" style={{ color: '#999999' }}>
          발행일: {currentDate}
        </div>
      </header>

      {/* Body - Main Summary */}
      <section className="pdf-body mb-12">
        <h3 
          className="text-xl mb-6 pb-3 border-b tracking-wide"
          style={{ 
            color: '#003366',
            borderColor: '#003366',
            fontWeight: 400,
            letterSpacing: '0.05em',
          }}
        >
          개요
        </h3>
        <p 
          className="text-base leading-loose mb-8"
          style={{ 
            color: '#333333',
            textAlign: 'justify',
            lineHeight: '2',
          }}
        >
          {data.content.summary}
        </p>

        {/* Key Themes */}
        <h3 
          className="text-xl mb-6 pb-3 border-b tracking-wide"
          style={{ 
            color: '#003366',
            borderColor: '#003366',
            fontWeight: 400,
            letterSpacing: '0.05em',
          }}
        >
          핵심 주제
        </h3>
        <div className="space-y-4 mb-8">
          {data.content.keyThemes.map((theme, index) => (
            <div key={index} className="flex items-start gap-4">
              <span 
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-sm"
                style={{ 
                  backgroundColor: '#003366',
                  color: '#F9F8F3',
                }}
              >
                {index + 1}
              </span>
              <p 
                className="flex-1 text-base leading-relaxed pt-1"
                style={{ color: '#333333', lineHeight: '1.8' }}
              >
                {theme}
              </p>
            </div>
          ))}
        </div>

        {/* Spiritual Insights */}
        <h3 
          className="text-xl mb-6 pb-3 border-b tracking-wide"
          style={{ 
            color: '#003366',
            borderColor: '#003366',
            fontWeight: 400,
            letterSpacing: '0.05em',
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            영적 통찰
          </span>
        </h3>
        <div className="space-y-4 mb-8">
          {data.content.spiritualInsights.map((insight, index) => (
            <div 
              key={index}
              className="pl-6 py-3 border-l-4"
              style={{ 
                borderColor: '#003366',
                backgroundColor: '#f9f9f9',
              }}
            >
              <p 
                className="text-base leading-relaxed italic"
                style={{ color: '#333333', lineHeight: '1.9' }}
              >
                {insight}
              </p>
            </div>
          ))}
        </div>

        {/* Action Items */}
        <h3 
          className="text-xl mb-6 pb-3 border-b tracking-wide"
          style={{ 
            color: '#003366',
            borderColor: '#003366',
            fontWeight: 400,
            letterSpacing: '0.05em',
          }}
        >
          실천 과제
        </h3>
        <ul className="space-y-3 mb-8 pl-6">
          {data.content.actionItems.map((item, index) => (
            <li 
              key={index}
              className="text-base leading-relaxed"
              style={{ 
                color: '#333333',
                listStyleType: 'disc',
                lineHeight: '1.8',
              }}
            >
              {item}
            </li>
          ))}
        </ul>

        {/* Prayer Points */}
        <h3 
          className="text-xl mb-6 pb-3 border-b tracking-wide"
          style={{ 
            color: '#003366',
            borderColor: '#003366',
            fontWeight: 400,
            letterSpacing: '0.05em',
          }}
        >
          기도 제목
        </h3>
        <ul className="space-y-3 mb-8 pl-6">
          {data.content.prayerPoints.map((point, index) => (
            <li 
              key={index}
              className="text-base leading-relaxed"
              style={{ 
                color: '#333333',
                listStyleType: 'circle',
                lineHeight: '1.8',
              }}
            >
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* Records Archive */}
      <section className="pdf-records mb-12 pb-8 border-t-2" style={{ borderColor: '#e5e5e5' }}>
        <h3 
          className="text-xl mt-8 mb-6 tracking-wide"
          style={{ 
            color: '#003366',
            fontWeight: 400,
            letterSpacing: '0.05em',
          }}
        >
          포함된 기록
        </h3>
        <div className="space-y-6">
          {data.records.map((record, index) => (
            <div 
              key={index}
              className="pb-4 border-b"
              style={{ borderColor: '#e5e5e5' }}
            >
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="text-base" style={{ color: '#1a1a1a', fontWeight: 500 }}>
                  {record.title}
                </h4>
                <span className="text-sm" style={{ color: '#999999' }}>
                  {record.date}
                </span>
              </div>
              <p 
                className="text-sm leading-relaxed"
                style={{ color: '#666666', lineHeight: '1.7' }}
              >
                {record.excerpt}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="pdf-footer pt-8 border-t-2 text-center"
        style={{ borderColor: '#003366' }}
      >
        <div className="mb-4">
          <p className="text-sm mb-2" style={{ color: '#666666' }}>
            이 문서는 HARU v1.0에서 생성되었습니다
          </p>
          <p className="text-xs" style={{ color: '#999999' }}>
            "간편하게 입력하고, 쓸모있게 남깁니다"
          </p>
        </div>
        <div className="text-xs" style={{ color: '#999999' }}>
          © 2026 HARU by JOYEL. All rights reserved.
        </div>
      </footer>

      {/* Page Break Styles for Print */}
      <style>{`
        @media print {
          .pdf-digest {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 20mm;
            page-break-after: always;
          }
          
          .pdf-header {
            page-break-after: avoid;
          }
          
          .pdf-body h3 {
            page-break-after: avoid;
          }
          
          .pdf-records > div {
            page-break-inside: avoid;
          }
        }
        
        @page {
          size: A4;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
