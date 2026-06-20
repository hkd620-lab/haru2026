import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Plus, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const HANCOM_DOCS_URL = 'https://www.hancomdocs.com/ko/mydrive/all';

export function HangulWordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'idle' | 'success' | 'error'>('idle');
  const isDeveloper = user?.uid === DEVELOPER_UID;

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  if (!user || !isDeveloper) return null;

  const handleFile = (file: File) => {
    const name = file.name.toLowerCase();

    if (name.endsWith('.hwp') || name.endsWith('.hwpx')) {
      setMessage(`${file.name} - 한컴독스로 이동합니다.`);
      setMessageTone('success');
      window.location.href = HANCOM_DOCS_URL;
      return;
    }

    setMessage('.hwp 또는 .hwpx 파일만 가능합니다.');
    setMessageTone('error');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = '';
  };

  const handleNewDoc = () => {
    window.location.href = HANCOM_DOCS_URL;
  };

  const messageColor =
    messageTone === 'success' ? '#047857' : messageTone === 'error' ? '#B45309' : '#64748B';

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
      <PageHeaderActions onClose={() => navigate('/admin/console')} />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div
          className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full mb-3"
          style={{ backgroundColor: '#EAF3FF', color: '#1A3C6E' }}
        >
          <FileText size={14} />
          개발자 전용
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
          한글워드
        </h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          HWP/HWPX 문서를 한컴독스에서 바로 열기 위한 이동 도구입니다.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <section
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="bg-white border p-6 sm:p-8 text-center transition-colors"
          style={{
            borderColor: dragOver ? '#4A90D9' : '#B8D4F0',
            borderStyle: 'dashed',
            borderWidth: 3,
            borderRadius: 8,
            backgroundColor: dragOver ? '#EAF3FF' : '#FFFFFF',
          }}
        >
          <div
            className="mx-auto mb-4 flex items-center justify-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: dragOver ? '#D7EAFE' : '#F1F5F9',
              color: '#1A3C6E',
            }}
          >
            <UploadCloud size={30} />
          </div>

          <h2 className="text-lg font-bold" style={{ color: '#1A3C6E' }}>
            .hwp 또는 .hwpx 파일
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            여기에 파일을 끌어다 놓으면 한컴독스로 이동합니다.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: '#1A3C6E', borderRadius: 8 }}
            >
              <FileText size={16} />
              파일 선택
            </button>
            <button
              type="button"
              onClick={handleNewDoc}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: '#2BA86E', borderRadius: 8 }}
            >
              <Plus size={16} />
              + 새 한글 문서
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 leading-relaxed">
            새 문서 버튼을 누르면 한컴독스로 이동합니다.<br />
            거기서 "새 문서 만들기"를 눌러주세요.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".hwp,.hwpx"
            onChange={handleFileChange}
            className="hidden"
          />

          {message && (
            <p
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: messageColor }}
            >
              {messageTone === 'error' ? <AlertCircle size={16} /> : <ExternalLink size={16} />}
              {message}
            </p>
          )}
        </section>

        <section className="bg-white border border-gray-200 p-5" style={{ borderRadius: 8 }}>
          <h3 className="font-bold text-base" style={{ color: '#1A3C6E' }}>
            한컴독스 이동 후
          </h3>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            같은 파일을 한컴독스 화면에 한 번 더 놓아 문서를 업로드합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
