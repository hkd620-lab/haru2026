import { useState, useEffect } from 'react';
import { BookOpen, Info, Wand2 } from 'lucide-react';
import { FormatModal } from '../components/FormatModal';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, HaruRecord, RecordFormat } from '../services/firestoreService';
import { LibraryTitleAnimation } from '../components/LibraryTitleAnimation';
import { toast } from 'sonner';

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

  const [showLibraryGuide, setShowLibraryGuide] = useState(() => {
    try {
      const saved = localStorage.getItem('haru_library_guide_visible');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  // 데이터 가져오기
  useEffect(() => {
    fetchRecords();
  }, [authUser?.uid, location]);

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

  // 84번째 줄 근처 수정된 함수
  const handleSaveFormatData = async (formatData: Record<string, string>) => {
    if (!selectedRecord || !authUser?.uid) return;

    const filteredData: Record<string, any> = {};
    Object.entries(formatData).forEach(([key, value]) => {
      // string 타입만 trim 체크
      if (typeof value === 'string' && value.trim().length > 0) {
        filteredData[key] = value;
      } else if (typeof value === 'boolean' || (typeof value === 'string' && value.length > 0)) {
        // boolean이나 빈 문자열이 아닌 경우(공백 포함 등) 그대로 저장
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
      
      await fetchRecords();
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
        data[key] = (selectedRecord as any)[key];
      }
    });
    return data;
  };

  // 다듬기 완료 여부 확인
  const isFormatPolished = (format: RecordFormat) => {
    if (!selectedRecord) return false;
    const prefix =
      format === '일기' ? 'diary' :
      format === '에세이' ? 'essay' :
      format === '선교보고' ? 'mission' :
      format === '일반보고' ? 'report' :
      format === '업무일지' ? 'work' : 'travel';
    
    const sayuKey = `${prefix}_sayu`;
    const value = (selectedRecord as any)[sayuKey];
    return value && typeof value === 'string' && value.trim().length > 0;
  };

  // 원본만 작성 여부 확인 (다듬기는 안 함)
  const hasFormatContent = (format: RecordFormat) => {
    if (!selectedRecord) return false;
    const prefix =
      format === '일기' ? 'diary_' :
      format === '에세이' ? 'essay_' :
      format === '선교보고' ? 'mission_' :
      format === '일반보고' ? 'report_' :
      format === '업무일지' ? 'work_' : 'travel_';

    return Object.keys(selectedRecord).some(key => {
      if (key.startsWith(prefix)) {
        const value = (selectedRecord as any)[key];
        return value && typeof value === 'string' && value.trim().length > 0;
      }
      return false;
    });
  };

  // 버튼 스타일 결정 함수
  const getButtonStyle = (format: RecordFormat) => {
    const polished = isFormatPolished(format);
    const hasContent = hasFormatContent(format);

    if (polished) {
      // 다듬기 완료 - 초록색
      return {
        backgroundColor: '#10b981',
        color: '#FAF9F6',
        border: '3px solid #059669',
      };
    } else if (hasContent) {
      // 원본만 작성 - 파란색
      return {
        backgroundColor: '#1A3C6E',
        color: '#FAF9F6',
        border: '3px solid #2A4C7E',
      };
    } else {
      // 미작성 - 골드색
      return {
        backgroundColor: '#DAA520',
        color: '#FAF9F6',
        border: '3px solid #B8860B',
      };
    }
  };

  const handleResetFormats = async () => {
    if (!selectedRecord || !authUser?.uid) return;
    if (!confirm('작성한 형식 내용을 모두 초기화하시겠습니까?\n\n원본과 다듬기가 모두 삭제됩니다.')) return;

    try {
      const updateData: Record<string, any> = {};
      const formatPrefixes = ['diary_', 'essay_', 'mission_', 'report_', 'work_', 'travel_', 'diary_sayu', 'essay_sayu', 'mission_sayu', 'report_sayu', 'work_sayu', 'travel_sayu'];
      
      Object.keys(selectedRecord).forEach((key) => {
        if (formatPrefixes.some(prefix => key.startsWith(prefix))) {
          updateData[key] = null;
        }
      });

      await firestoreService.updateRecord(authUser.uid, selectedRecord.id, updateData);

      const updated = { ...selectedRecord, ...updateData };
      setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? updated : r)));
      setSelectedRecord(updated);

      toast.success('형식 내용이 초기화되었습니다!');
    } catch (error) {
      console.error('초기화 실패:', error);
      toast.error('초기화에 실패했습니다.');
    }
  };

  // 오늘 날짜 기록 자동 선택
  useEffect(() => {
    if (!loading) {
      const todayStr = formatDateString(new Date());
      const todayRecord = records.find((r) => r.date === todayStr);
      setSelectedRecord(todayRecord || null);
    }
  }, [loading, records]);

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
                💡 형식별로 작성하고, 형식별로 AI 다듬기를 할 수 있습니다.
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#666' }}>
                각 형식의 원본과 다듬기 결과가 따로 저장됩니다.
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
                {selectedRecord.formats.map((format: RecordFormat) => {
                  const hasPolished = isFormatPolished(format);
                  const buttonStyle = getButtonStyle(format);
                  
                  return (
                    <button
                      key={format}
                      onClick={() => handleFormatClick(format)}
                      className="px-6 py-3 rounded-lg text-sm transition-all hover:opacity-90 hover:shadow-lg shadow-md relative"
                      style={{
                        ...buttonStyle,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {hasPolished && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            fontSize: 16,
                          }}
                        >
                          ✨
                        </span>
                      )}
                      🎹 {format}
                      {hasPolished && (
                        <span style={{ marginLeft: 4, fontSize: 11 }}>
                          (다듬기 ✓)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-xs" style={{ color: '#DAA520' }}>
                  🟡 = 미작성 (골드)
                </p>
                <p className="text-xs" style={{ color: '#1A3C6E' }}>
                  🔵 = 원본 작성 완료 (파란)
                </p>
                <p className="text-xs" style={{ color: '#10b981' }}>
                  ✨ = 다듬기 완료 (초록)
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-center" style={{ color: '#999' }}>
                선택된 형식이 없습니다
              </p>
            </div>
          )}

          {selectedRecord.formats && selectedRecord.formats.length > 0 && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <button
                onClick={handleResetFormats}
                className="w-full px-6 py-3 rounded-lg text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: '#FFF8F0',
                  color: '#B8860B',
                  border: '1px solid #DAA520',
                  fontWeight: 500,
                }}
              >
                🔄 전체 초기화 (원본 + 다듬기)
              </button>
              <p className="text-xs text-center mt-3" style={{ color: '#999' }}>
                테스트용: 모든 형식의 원본과 다듬기를 삭제합니다
              </p>
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
          initialData={getFormatData(modalState.format)}
          onSave={handleSaveFormatData}
        />
      )}
    </div>
  );
}