import { X, Download, Printer } from 'lucide-react';
import { PDFDigest } from './PDFDigest';

interface PDFPreviewModalProps {
  open: boolean;
  onClose: () => void;
  data: {
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
  };
}

export function PDFPreviewModal({ open, onClose, data }: PDFPreviewModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Open print dialog which allows saving as PDF
    window.print();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="pdf-preview-header px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: '#e5e5e5' }}
        >
          <h2 className="text-lg tracking-wide" style={{ color: '#003366' }}>
            PDF 미리보기
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all hover:opacity-80"
              style={{ backgroundColor: '#F9F8F3', color: '#003366' }}
            >
              <Printer className="w-4 h-4" />
              인쇄
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all hover:opacity-90"
              style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
            >
              <Download className="w-4 h-4" />
              PDF 저장
            </button>
            <button
              onClick={onClose}
              className="p-3 rounded hover:bg-gray-50 transition-all"
              style={{ color: '#999999' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Preview Content */}
        <div 
          className="pdf-preview-content flex-1 overflow-y-auto"
          style={{ backgroundColor: '#f5f5f5' }}
        >
          <div className="py-8">
            <PDFDigest data={data} />
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .pdf-digest,
          .pdf-digest * {
            visibility: visible;
          }
          
          .pdf-digest {
            position: absolute;
            left: 0;
            top: 0;
          }
          
          .pdf-preview-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
