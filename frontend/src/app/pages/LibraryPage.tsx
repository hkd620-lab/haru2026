import { useState, useEffect } from 'react';
import { BookOpen, Info, Wand2 } from 'lucide-react';
import { FormatModal } from '../components/FormatModal';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, HaruRecord, RecordFormat } from '../services/firestoreService';
import { LibraryTitleAnimation } from '../components/LibraryTitleAnimation';
import { toast } from 'sonner';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface PolishResult {
  text: string;
}

export function LibraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<HaruRecord | null>(null);
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    format: RecordFormat | null;
  }>({ isOpen: false, format: null });
  const [polishModalOpen, setPolishModalOpen] = useState(false);
  const [polishedContent, setPolishedContent] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [showLibraryGuide, setShowLibraryGuide] = useState(() => {
    try {
      const saved = localStorage.getItem('haru_library_guide_visible');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    fetchRecords();
  }, [authUser?.uid, location]);

  useEffect(() => {
    if (!loading) {
      const todayStr = formatDateString(new Date());
      const todayRecord = records.find((r) => r.date === todayStr);
      setSelectedRecord(todayRecord || null);
    }
  }, [loading, records]);

  const toggleLibraryGuide = () => {
    const newValue = !showLibraryGuide;
    setShowLibraryGuide(newValue);
    try {
      localStorage.setItem('haru_library_guide_visible', String(newValue));
    } catch { /* ignore */ }
  };

  const fetchRecords = async () => {
    if (!authUser?.uid) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const uid = authUser.uid;
      const data = await firestoreService.getRecords(uid);
      setRecords(data);
    } catch (error) {
      console.error('기록 불러오기 실패:', error);
      toast.error('기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleFormatClick = (format: RecordFormat) => {
    setModalState({ isOpen: true, format });
  };

  const handleModalClose = () => {
    setModalState({ isOpen: false, format: null });
  };

  const handleSaveFormatData = async (formatData: Record<string, string>) => {
    if (!selectedRecord || !authUser?.uid) return;

    const filteredData: Record<string, string> = {};
    Object.entries(formatData).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        filteredData[key] = value;
      }
    });

    if (Object.keys(filteredData).length === 0) {
      toast.warning('최소 1개 이상의 필드를 작성해주세요.');
      return;
    }

    try {
      await firestoreService.updateRecord(authUser.uid, selectedRecord.id, filteredData);

      const updated = { ...selectedRecord, ...filteredData };
      setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? updated : r)));
      setSelectedRecord(updated);

      toast.success('저장되었습니다!');
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const getFormatData = (format: RecordFormat) => {
    if (!selectedRecord) return {};
    const prefix =
      format === '일기' ? 'diary_' :
      format === '에세이' ? 'essay_' :
      format === '선교보고' ? 'mission_' :
      format === '일반보고' ? 'report_' :
      format === '업무일지' ? 'work_' : 'travel_';

    const data: Record<string, string> = {};
    Object.keys(selectedRecord).forEach((key) => {
      if (key.startsWith(prefix)) {
        data[key] = selectedRecord[key];
      }
    });
    return data;
  };

  const checkAllFormatsCompleted = () => {
    if (!selectedRecord || !selectedRecord.formats || selectedRecord.formats.length === 0) {
      return false;
    }
    return selectedRecord.formats.every((format: RecordFormat) => {
      const formatData = getFormatData(format);
      const dataKeys = Object.keys(formatData);
      return dataKeys.length > 0 && dataKeys.some((key) => {
        const value = formatData[key];
        return value && typeof value === 'string' && value.trim().length > 0;
      });
    });
  };

  const allFormatsCompleted = selectedRecord ? checkAllFormatsCompleted() : false;

  const handlePolish = async () => {
    if (!selectedRecord) return;

    setIsPolishing(true);
    toast.info('AI가 글을 다듬고 있습니다. 잠시만 기다려주세요...');

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const polishContentFunc = httpsCallable(functions, 'polishContent');
      
      let allContent = '';
      selectedRecord.formats?.forEach((format: RecordFormat) => {
        const formatData = getFormatData(format);
        const contentValues = Object.values(formatData).filter(v => v && v.trim()).join('\n');
        if (contentValues) {
          allContent += `[${format}]\n${contentValues}\n\n`;
        }
      });

      if (!allContent.trim()) {
        toast.error('다듬을 내용이 충분하지 않습니다.');
        setIsPolishing(false);
        return;
      }

      const result = await polishContentFunc({ 
        text: `다음은 하루 동안 작성된 여러 형식의 기록들입니다. 이를 종합하여 하나의 자연스러운 글로 다듬어주세요.\n\n${allContent}`,
        format: 'diary'
      });

      const polished = (result.data as PolishResult).text;
      setPolishedContent(polished);
      setPolishModalOpen(true);
    } catch (error: any) {
      console.error('AI 처리 실패:', error);
      toast.error('AI 연결에 실패했습니다. 구글 서버 배포 상태를 확인해주세요.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handlePolishComplete = async () => {
    if (!selectedRecord || !authUser?.uid) return;

    try {
      const updateData = {
        polished: true,
        polishedAt: new Date().toISOString(),
        sayuContent: polishedContent,
      };
      await firestoreService.updateRecord(authUser.uid, selectedRecord.id, updateData);

      const updated = { ...selectedRecord, ...updateData };
      setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? updated : r)));
      setSelectedRecord(updated);

      setPolishModalOpen(false);
      toast.success('다듬기가 완료되었습니다!');
      setTimeout(() => {
        navigate('/sayu');
      }, 500);
    } catch (error) {
      console.error('다듬기 완료 처리 실패:', error);
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleResetPolish = async () => {
    if (!selectedRecord || !authUser?.uid) return;
    if (!confirm('다듬기를 초기화하시겠습니까?')) return;

    try {
      const updateData = {
        polished: false,
        polishedAt: null,
        sayuContent: null,
        sayuSavedAt: null,
      };
      await firestoreService.updateRecord(authUser.uid, selectedRecord.id, updateData);

      const updated = { ...selectedRecord, ...updateData };
      setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? updated : r)));
      setSelectedRecord(updated);

      toast.success('다듬기가 초기화되었습니다!');
    } catch (error) {
      console.error('초기화 실패:', error);
      toast.error('초기화에 실패했습니다.');
    }
  };

  const handleResetFormats = async () => {
    if (!selectedRecord || !authUser?.uid) return;
    if (!confirm('작성한 형식 내용을 모두 초기화하시겠습니까?\n\n예문만 남고 작성한 내용은 모두 삭제됩니다.')) return;

    try {
      const updateData: Record<string, any> = {};
      const formatPrefixes = ['diary_', 'essay_', 'mission_', 'report_', 'work_', 'travel_'];
      
      Object.keys(selectedRecord).forEach((key) => {
        if (formatPrefixes.some(prefix => key.startsWith(prefix))) {
          updateData[key] = null;
        }
      });

      await firestoreService.updateRecord(authUser.uid, selectedRecord.id, updateData);

      const updated = { ...selectedRecord, ...updateData };
      setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? updated : r)));
      setSelectedRecord(updated);

      toast.success('형식 내용이 초기화되었습니다!\n이제 각 형식을 클릭하면 예문만 표시됩니다.');
    } catch (error) {
      console.error('초기화 실패:', error);
      toast.error('초기화에 실패했습니다.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <LibraryTitleAnimation />
          <div className="flex gap-2 self-start mt-1 ml-auto">
            <button
              onClick={fetchRecords}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{
                backgroundColor: '#F0F7FF',
                color: '#1A3C6E',
                border: '1px solid #d0dff0',
              }}
            >
              🔄 새로고침
            </button>
          </div>
        </div>
        <p className="text-sm mb-2" style={{ color: '#666666' }}>
          오늘의 기록을 작성하세요
        </p>
        <div
          className="bg-blue-50 border-l-4 border-blue-600 rounded transition-all"
          style={{
            backgroundColor: '#F0F7FF',
            borderColor: '#1A3C6E',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-opacity-80 transition-colors"
            onClick={toggleLibraryGuide}
            style={{ backgroundColor: showLibraryGuide ? 'transparent' : 'rgba(26, 60, 110, 0.05)' }}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" style={{ color: '#1A3C6E' }} />
              <p className="text-xs font-semibold" style={{ color: '#1A3C6E', margin: 0 }}>
                사용 안내
              </p>
            </div>
            <div
              className="text-xs transition-transform"
              style={{
                color: '#1A3C6E',
                transform: showLibraryGuide ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </div>
          </div>
          {showLibraryGuide && (
            <div className="px-3 pb-3">
              <p className="text-xs leading-relaxed" style={{ color: '#1A3C6E' }}>
                💡 여기는 새 글 작성 공간입니다. 저장된 글 수정은{' '}
                <strong>사유(SAYU) 달력</strong>에서 합니다.
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#666' }}>
                과거 글도 SAYU에서 편집하세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center">
          <p style={{ color: '#999' }}>불러오는 중...</p>
        </div>
      ) : selectedRecord ? (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-base font-semibold" style={{ color: '#1A3C6E' }}>
              {new Date(selectedRecord.date + 'T00:00:00').toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </h3>
          </div>

          {(selectedRecord.weather || selectedRecord.temperature || selectedRecord.mood) && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs mb-2 font-medium" style={{ color: '#999' }}>
                오늘의 환경
              </p>
              <div className="flex gap-2 flex-wrap">
                {selectedRecord.weather && (
                  <span
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E', border: '1px solid #d0dff0' }}
                  >
                    날씨: {selectedRecord.weather}
                  </span>
                )}
                {selectedRecord.temperature && (
                  <span
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E', border: '1px solid #d0dff0' }}
                  >
                    기온: {selectedRecord.temperature}
                  </span>
                )}
                {selectedRecord.mood && (
                  <span
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E', border: '1px solid #d0dff0' }}
                  >
                    기분: {selectedRecord.mood}
                  </span>
                )}
              </div>
            </div>
          )}

          {selectedRecord.formats && selectedRecord.formats.length > 0 ? (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs mb-3 font-medium" style={{ color: '#999' }}>
                🎹 기록 형식을 클릭하면 작성 화면이 열립니다
              </p>
              <div className="flex gap-2 flex-wrap">
                {selectedRecord.formats.map((format: RecordFormat) => (
                  <button
                    key={format}
                    onClick={() => handleFormatClick(format)}
                    className="px-6 py-3 rounded-lg text-sm transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                    style={{
                      backgroundColor: '#1A3C6E',
                      color: '#FAF9F6',
                      border: '3px solid #2A4C7E',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                  >
                    🎹 {format}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-center" style={{ color: '#999' }}>
                선택된 형식이 없습니다
              </p>
            </div>
          )}

          {allFormatsCompleted && !selectedRecord.polished && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <button
                onClick={handlePolish}
                disabled={isPolishing}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-lg text-base transition-all hover:opacity-90 shadow-lg"
                style={{
                  backgroundColor: '#1A3C6E',
                  color: '#FAF9F6',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  opacity: isPolishing ? 0.7 : 1,
                }}
              >
                {isPolishing ? <Wand2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                <span>{isPolishing ? 'AI가 다듬는 중...' : '✨ AI로 다듬기'}</span>
              </button>
              <button
                onClick={handleResetFormats}
                className="w-full mt-3 px-6 py-3 rounded-lg text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: '#FFF8F0',
                  color: '#B8860B',
                  border: '1px solid #DAA520',
                  fontWeight: 500,
                }}
              >
                🔄 작성 내용 초기화
              </button>
              <p className="text-xs text-center mt-3" style={{ color: '#999' }}>
                모든 형식 작성이 완료되었습니다! AI가 내용을 다듬어드립니다.
              </p>
            </div>
          )}

          {selectedRecord.polished && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div
                className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-lg text-base"
                style={{
                  backgroundColor: '#F0F7F4',
                  color: '#1A3C6E',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  border: '2px solid #1A3C6E',
                }}
              >
                <span>✅ 다듬기 완료</span>
              </div>
              <p className="text-xs text-center mt-3" style={{ color: '#999' }}>
                이 날짜의 기록이 완성되었습니다! SAYU 페이지에서 확인하세요.
              </p>
              <button
                onClick={handleResetPolish}
                className="w-full mt-4 px-6 py-3 rounded-lg text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: '#f0f0f0',
                  color: '#666',
                  border: '1px solid #e5e5e5',
                  fontWeight: 500,
                }}
              >
                🔄 다듬기 초기화 (테스트용)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: '#1A3C6E', opacity: 0.3 }} />
            </div>
            <p className="text-base mb-2" style={{ color: '#333' }}>오늘 기록이 없습니다</p>
            <p className="text-xs mb-6" style={{ color: '#999' }}>
              기록 페이지에서 오늘의 환경과 형식을 선택하세요
            </p>
            <button
              onClick={() => navigate('/record')}
              className="px-8 py-3 rounded-lg text-sm transition-all hover:opacity-90 shadow-md"
              style={{
                backgroundColor: '#1A3C6E',
                color: '#FAF9F6',
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              📝 기록 시작하기
            </button>
          </div>
        </div>
      )}

      {modalState.isOpen && modalState.format && selectedRecord && (
        <FormatModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          format={modalState.format}
          recordId={selectedRecord.id}
          initialData={selectedRecord.polished ? {} : getFormatData(modalState.format)}
          onSave={handleSaveFormatData}
        />
      )}

      {polishModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setPolishModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FAF9F6',
              borderRadius: 12,
              maxWidth: 700,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '24px',
                borderBottom: '1px solid #e5e5e5',
                backgroundColor: '#fff',
              }}
            >
              <h2 style={{ fontSize: 20, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
                ✨ AI가 다듬은 글
              </h2>
              <p style={{ fontSize: 13, color: '#999', marginTop: 8, marginBottom: 0 }}>
                여러 형식의 내용이 자연스럽게 재구성되었습니다
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '20px',
                  borderRadius: 8,
                  border: '1px solid #e5e5e5',
                  whiteSpace: 'pre-wrap',
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: '#333',
                }}
              >
                {polishedContent}
              </div>
            </div>

            <div
              style={{
                padding: '20px 24px',
                borderTop: '1px solid #e5e5e5',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
                backgroundColor: '#fff',
              }}
            >
              <button
                onClick={() => setPolishModalOpen(false)}
                style={{
                  padding: '12px 24px',
                  fontSize: 14,
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  color: '#666',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                취소
              </button>
              <button
                onClick={handlePolishComplete}
                style={{
                  padding: '12px 32px',
                  fontSize: 15,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#1A3C6E',
                  color: '#FAF9F6',
                  cursor: 'pointer',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                💾 최종 저장 (SAYU로 이동)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
