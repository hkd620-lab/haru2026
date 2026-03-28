import { useState, useEffect } from 'react';
import { BookOpen, Info } from 'lucide-react';
import { FormatModal } from '../components/FormatModal';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { RecordFormat } from '../types/haruTypes';
import { LibraryTitleAnimation } from '../components/LibraryTitleAnimation';
import HaruLogo from '../../components/HaruLogo';
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

  // formats가 누락/불완전할 때 record 내용을 보고 보완 (서재에서 버튼이 안 뜨는 문제 해결)
  const getFormatsForDisplay = (record: HaruRecord): RecordFormat[] => {
    const base = (record.formats && record.formats.length > 0) ? [...record.formats] : [];
    const hasPrefix = (p: string) => Object.keys(record).some((k) => k.startsWith(p));
    const ensure = (fmt: RecordFormat, prefix: string) => {
      if (!base.includes(fmt) && hasPrefix(prefix)) base.push(fmt);
    };

    ensure('일기', 'diary_');
    ensure('에세이', 'essay_');
    ensure('선교보고', 'mission_');
    ensure('일반보고', 'report_');
    ensure('업무일지', 'work_');
    ensure('여행기록', 'travel_');
    ensure('텃밭일지', 'garden_');
    ensure('애완동물관찰일지', 'pet_');
    ensure('육아일기', 'child_');

    // ✅ 제한 없이 모든 형식 표시
    return base;
  };

  // 데이터 가져오기
  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSaveFormatData = async (formatData: Record<string, string>) => {
    if (!selectedRecord || !authUser?.uid) return;

    console.log('💾 ===== 형식 데이터 저장 시작 =====');
    console.log('현재 선택된 형식:', modalState.format);
    console.log('기존 formats 배열:', selectedRecord.formats);
    console.log('전달받은 formatData:', formatData);
    
    // ✅ 수정: 빈 값은 null로 저장 (삭제 가능하게)
    const updateData: Record<string, any> = {};
    const fieldsToDelete: string[] = [];  // 삭제할 필드 목록
    let hasContent = false;  // 최소 1개 이상의 내용이 있는지 체크
    
    Object.entries(formatData).forEach(([key, value]) => {
      if (typeof value === 'string') {
        if (value.trim().length > 0) {
          updateData[key] = value;
          hasContent = true;
        } else {
          // 빈 값은 null로 저장 (Firestore에서 필드 삭제)
          updateData[key] = null;
          fieldsToDelete.push(key);  // 삭제할 필드로 표시
        }
      }
    });

    if (!hasContent) {
      toast.warning('최소 1개 이상의 필드를 작성해주세요.');
      return;
    }

    try {
      // ✅ formats 배열 업데이트 로직
      const currentFormats = selectedRecord.formats || [];
      const formatToAdd = modalState.format!;
      
      // 이미 formats 배열에 있는지 확인
      const updatedFormats = currentFormats.includes(formatToAdd)
        ? currentFormats
        : [...currentFormats, formatToAdd];
      
      console.log('업데이트될 formats 배열:', updatedFormats);
      console.log('추가된 형식:', formatToAdd);
      console.log('삭제할 필드:', fieldsToDelete);
      
      // formats 배열도 함께 저장
      updateData.formats = updatedFormats;
      
      console.log('저장할 전체 데이터:', updateData);

      await firestoreService.updateRecord(authUser.uid, selectedRecord.id, updateData);

      // ✅ 로컬 state 업데이트: null 필드는 완전히 제거!
      const updated = { ...selectedRecord };
      
      // 값이 있는 필드만 업데이트
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== null) {
          updated[key] = value;
        }
      });
      
      // null로 표시된 필드는 완전히 삭제
      fieldsToDelete.forEach(key => {
        delete updated[key];
      });
      
      setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? updated : r)));
      setSelectedRecord(updated);

      toast.success('저장되었습니다!');
      
      console.log('✅ 저장 완료! 새로운 formats:', updated.formats);
      console.log('삭제된 필드:', fieldsToDelete);
      console.log('최종 updated 객체:', updated);
      console.log('=====================================\n');
      
      await fetchRecords();
    } catch (error) {
      console.error('❌ 저장 실패:', error);
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
      format === '업무일지' ? 'work_' :
      format === '여행기록' ? 'travel_' :
      format === '텃밭일지' ? 'garden_' :
      format === '애완동물관찰일지' ? 'pet_' : 'child_';

    const data: Record<string, string> = {};
    Object.keys(selectedRecord).forEach((key) => {
      if (key.startsWith(prefix)) {
        // @ts-ignore
        data[key] = selectedRecord[key];
      }
    });
    return data;
  };

  const isFormatPolished = (format: RecordFormat) => {
    if (!selectedRecord) return false;
    const prefix =
      format === '일기' ? 'diary' :
      format === '에세이' ? 'essay' :
      format === '선교보고' ? 'mission' :
      format === '일반보고' ? 'report' :
      format === '업무일지' ? 'work' :
      format === '여행기록' ? 'travel' :
      format === '텃밭일지' ? 'garden' :
      format === '애완동물관찰일지' ? 'pet' : 'child';
    
    const sayuKey = `${prefix}_sayu`;
    // @ts-ignore
    const sayuValue = selectedRecord[sayuKey];
    return typeof sayuValue === 'string' && sayuValue.trim().length > 0;
  };

  const handleResetFormats = async () => {
    if (!selectedRecord || !authUser?.uid) return;
    if (!confirm('작성한 형식 내용을 모두 초기화하시겠습니까?\n\n원본과 SAYU가 모두 삭제됩니다.')) return;

    try {
      const updateData: Record<string, any> = {
        formats: []  // 👈 formats 배열도 초기화!
      };
      const formatPrefixes = ['diary_', 'essay_', 'mission_', 'report_', 'work_', 'travel_', 'garden_', 'pet_', 'child_'];
      
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

  // 오늘 레코드 선택 (date OR id 로 잡기)
  useEffect(() => {
    if (!loading) {
      const todayStr = formatDateString(new Date());
      const todayRecord = records.find((r) => r.date === todayStr || r.id === todayStr);
      setSelectedRecord(todayRecord || null);

      console.log('=== 디버깅 ===');
      console.log('오늘 날짜:', todayStr);
      console.log('찾은 기록:', todayRecord);
      console.log('형식 배열:', todayRecord?.formats);
      console.log('전체 기록:', records);
    }
  }, [loading, records]);

  const formatsForDisplay = selectedRecord ? getFormatsForDisplay(selectedRecord) : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <HaruLogo />
          <LibraryTitleAnimation />
          <div className="flex gap-2 self-start mt-1 ml-auto">
            <button
              onClick={fetchRecords}
              className="text-xs px-3 py-2.5 rounded-lg transition-all hover:opacity-80"
              style={{
                backgroundColor: '#FDF6C3',
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
            backgroundColor: '#FDF6C3',
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
                각 형식의 원본과 SAYU(다듬은 결과)가 따로 저장됩니다.
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
              {new Date((selectedRecord.date || selectedRecord.id) + 'T00:00:00').toLocaleDateString('ko-KR', {
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
                    style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E', border: '1px solid #d0dff0' }}
                  >
                    날씨: {selectedRecord.weather}
                  </span>
                )}
                {selectedRecord.temperature && (
                  <span
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E', border: '1px solid #d0dff0' }}
                  >
                    기온: {selectedRecord.temperature}
                  </span>
                )}
                {selectedRecord.mood && (
                  <span
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E', border: '1px solid #d0dff0' }}
                  >
                    기분: {selectedRecord.mood}
                  </span>
                )}
              </div>
            </div>
          )}

          {formatsForDisplay.length > 0 ? (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs mb-3 font-medium" style={{ color: '#999' }}>
                🎹 기록 형식을 클릭하면 작성 화면이 열립니다
              </p>
              <div className="flex gap-2 flex-wrap">
                {formatsForDisplay.map((format: RecordFormat) => {
                  const hasPolished = isFormatPolished(format);
                  
                  return (
                    <button
                      key={format}
                      onClick={() => handleFormatClick(format)}
                      className="px-6 py-3 rounded-lg text-sm transition-all hover:opacity-90 hover:shadow-lg shadow-md relative"
                      style={{
                        backgroundColor: hasPolished ? '#10b981' : '#1A3C6E',
                        color: '#FAF9F6',
                        border: hasPolished ? '3px solid #059669' : '3px solid #2A4C7E',
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
                          (SAYU ✓)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mt-3" style={{ color: '#10b981' }}>
                ✨ = SAYU 완료된 형식
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-center" style={{ color: '#999' }}>
                선택된 형식이 없습니다
              </p>
            </div>
          )}

          {formatsForDisplay.length > 0 && (
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
                🔄 전체 초기화 (원본 + SAYU)
              </button>
              <p className="text-xs text-center mt-3" style={{ color: '#999' }}>
                테스트용: 모든 형식의 원본과 SAYU를 삭제합니다
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
