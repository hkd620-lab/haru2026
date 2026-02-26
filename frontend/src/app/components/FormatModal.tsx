import { X, TestTube2, Wand2, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getTestData } from '../data/testData';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '애완동물관찰일지' | '육아일기' | '텃밭일지';

interface FormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: RecordFormat;
  recordId: string;
  initialData?: Record<string, string>;
  onSave: (formatData: Record<string, string>) => Promise<void>;
}

interface PolishResult {
  text: string;
  success: boolean;
  mode: string;
}

// 형식별 입력 필드 정의
const FORMAT_FIELDS: Record<RecordFormat, { key: string; label: string; placeholder: string; rows?: number }[]> = {
  일기: [
    { key: 'diary_action', label: '행동', placeholder: '점심 식사 후 학교 뒷산 산책로를 끝까지 완주했습니다.', rows: 2 },
    { key: 'diary_good', label: '좋았던 일', placeholder: '바스락거리는 낙엽 소리가 마치 음악처럼 들려 기분 전환에 도움이 되었습니다.', rows: 3 },
    { key: 'diary_conflict', label: '갈등', placeholder: '산책을 더 즐기고 싶었으나, 회의 시간이 임박하여 부득이하게 귀가해야 했습니다.', rows: 3 },
    { key: 'diary_regret', label: '아쉬움', placeholder: '서두르는 바람에 산책길에서 만난 이웃에게 정중하게 인사를 건네지 못한 점이 아쉽습니다.', rows: 3 },
    { key: 'diary_learning', label: '배움', placeholder: '10분의 짧은 휴식 시간이 오후 업무 효율성을 크게 향상시킨다는 것을 경험했습니다.', rows: 3 },
    { key: 'diary_space', label: '여백', placeholder: '내일은 여유로운 마음으로 풍경을 감상하며 천천히 걷고 싶습니다.', rows: 2 },
  ],
  에세이: [
    { key: 'essay_observation', label: '관찰', placeholder: '보도블록 틈새에 피어 있는 노란 민들레를 관찰했습니다.', rows: 2 },
    { key: 'essay_impression', label: '첫인상', placeholder: '"와, 정말 작다!"라는 생각이 들었습니다. 그럼에도 불구하고 색상이 매우 진하고 아름다웠습니다.', rows: 3 },
    { key: 'essay_comparison', label: '비교', placeholder: '딱딱한 돌 사이에 피어 있는 모습이 마치 \'작은 영웅\'과 같았습니다.', rows: 3 },
    { key: 'essay_essence', label: '핵심', placeholder: '아무리 좁고 힘든 환경에서도 꽃은 피어날 수 있다는 중요한 사실을 깨달았습니다.', rows: 3 },
    { key: 'essay_closing', label: '끝인사', placeholder: '어려움에 처하더라도 포기하지 마십시오. 여러분도 민들레처럼 멋진 꽃을 피울 수 있을 것입니다.', rows: 3 },
  ],
  선교보고: [
    { key: 'mission_place', label: 'Place', placeholder: '오전 10시, ○○마을 입구 우물가에서 현지 주민 5명과 인사를 나누었습니다.', rows: 2 },
    { key: 'mission_action', label: 'Action', placeholder: '어린이 10명을 대상으로 성경 동화 구연 및 기초 위생 교육을 실시했습니다.', rows: 4 },
    { key: 'mission_grace', label: 'Grace', placeholder: '서먹했던 추장님께서 먼저 다가와 차를 대접해 주시고 다음 주 방문을 환영해 주셨습니다.', rows: 3 },
    { key: 'mission_heart', label: 'Heart', placeholder: '언어의 장벽으로 인해 어려움이 있었지만, 웃음이 최고의 언어임을 다시 한번 확인했습니다.', rows: 3 },
    { key: 'mission_prayer', label: 'Prayer', placeholder: '마을 내 깨끗한 식수원 확보를 위한 우물 파기 사역이 순조롭게 진행되기를 기원합니다.', rows: 3 },
  ],
  일반보고: [
    { key: 'report_activity', label: '활동 명칭', placeholder: '본관 2층 인문학 코너 신간 도서 분류 및 배가 작업을 수행했습니다.', rows: 2 },
    { key: 'report_progress', label: '진행 상황', placeholder: '전체 500권 중 350권 분류 및 배가 완료되었으며, 현재 공정률은 약 70%입니다.', rows: 3 },
    { key: 'report_achievement', label: '핵심 성과', placeholder: '철학 및 역사 분야 도서 정리를 완료하여 이용객들의 도서 검색 효율성을 크게 향상시켰습니다.', rows: 3 },
    { key: 'report_notes', label: '특이 사항', placeholder: '서가 공간 부족 현상이 발생하고 있습니다. 대출 빈도가 낮은 구권 서적의 재배치를 검토하여 공간 활용도를 개선할 필요가 있습니다.', rows: 4 },
    { key: 'report_future', label: '향후 계획', placeholder: '내일 오전 중 남은 150권의 도서 정리를 마무리하고 서가 재배치 기획안을 작성할 예정입니다.', rows: 3 },
  ],
  업무일지: [
    { key: 'work_schedule', label: 'Schedule', placeholder: '09:00 주간 회의 주관\n13:00 신입 사원 직무 교육', rows: 3 },
    { key: 'work_result', label: 'Result', placeholder: '회의록 배포 완료\n교육 만족도 조사 결과 \'매우 만족\' 90% 이상 기록', rows: 3 },
    { key: 'work_pending', label: 'Pending', placeholder: '예산 결산 보고서 초안 작성 (자료 보완 후 내일 오전 중 완료 예정)', rows: 3 },
    { key: 'work_metric', label: 'Key Metric', placeholder: '오늘 걸음 수: 8,500보\n지출: 점심 식대 12,000원', rows: 2 },
    { key: 'work_rating', label: 'Rating', placeholder: '★★★★☆ (일정이 빡빡했지만 핵심 업무 대부분 완수)', rows: 2 },
  ],
  여행기록: [
    { key: 'travel_journey', label: '여정', placeholder: '오전 10시 산사 도착\n일주문에서 대웅전까지 이어지는 숲길 산책', rows: 3 },
    { key: 'travel_scenery', label: '풍경', placeholder: '처마 끝 풍경(風磬)이 바람에 흔들리며 맑은 소리를 냄\n색이 바랜 단청의 편안함', rows: 3 },
    { key: 'travel_food', label: '미식', placeholder: '사찰 인근 식당에서 산채비빔밥 섭취\n양념이 과하지 않아 나물 향이 입안에 오래 남음', rows: 3 },
    { key: 'travel_thought', label: '단상', placeholder: '빠르게 걷느라 놓쳤던 것들을 멈춰 서니 비로소 볼 수 있었습니다. 삶의 속도를 늦추는 것은 곧 깊어짐을 의미합니다.', rows: 4 },
    { key: 'travel_gratitude', label: '감사', placeholder: '길을 안내해 주신 노스님의 미소에 감사드립니다.\n비를 피할 수 있도록 해 준 쉼터 지붕에 감사드립니다.', rows: 3 },
  ],
  애완동물관찰일지: [
    { key: 'pet_name', label: '이름', placeholder: '(협업AI 작업 후 정식 필드로 교체 예정)', rows: 2 },
    { key: 'pet_observation', label: '관찰 내용', placeholder: '(협업AI 작업 후 정식 필드로 교체 예정)', rows: 3 },
  ],
  육아일기: [
    { key: 'parenting_child', label: '아이', placeholder: '(협업AI 작업 후 정식 필드로 교체 예정)', rows: 2 },
    { key: 'parenting_activity', label: '활동', placeholder: '(협업AI 작업 후 정식 필드로 교체 예정)', rows: 3 },
  ],
  텃밭일지: [
    { key: 'garden_crop', label: '작물', placeholder: '(협업AI 작업 후 정식 필드로 교체 예정)', rows: 2 },
    { key: 'garden_work', label: '작업 내용', placeholder: '(협업AI 작업 후 정식 필드로 교체 예정)', rows: 3 },
  ],
};

const FORMAT_PREFIX: Record<RecordFormat, string> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel',
  '애완동물관찰일지': 'pet',
  '육아일기': 'parenting',
  '텃밭일지': 'garden',
};

export function FormatModal({ isOpen, onClose, format, recordId, initialData = {}, onSave }: FormatModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishedContent, setPolishedContent] = useState('');
  const [showPolishModal, setShowPolishModal] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false); // 모드 선택 모달
  const [selectedMode, setSelectedMode] = useState<'basic' | 'premium'>('basic');

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setPolishedContent('');
      setShowPolishModal(false);
      setShowModeSelection(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const fields = FORMAT_FIELDS[format];
  const prefix = FORMAT_PREFIX[format];
  const sayuKey = `${prefix}_sayu`;
  const existingSayu = initialData[sayuKey];

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFillTestData = () => {
    const testData = getTestData(format);
    if (testData) {
      setFormData(testData);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success('저장되었습니다!');
      onClose();
    } catch (error) {
      console.error('저장 중 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 🌟 AI 다듬기 버튼 클릭 → 모드 선택 모달 표시
  const handlePolishClick = () => {
    const contentValues = fields
      .map(field => formData[field.key])
      .filter(v => v && v.trim())
      .join('\n\n');

    if (!contentValues.trim()) {
      toast.error('다듬을 내용이 없습니다. 먼저 작성해주세요.');
      return;
    }

    setShowModeSelection(true);
  };

  // 🎯 모드 선택 후 AI 다듬기 실행
  const handlePolishWithMode = async (mode: 'basic' | 'premium') => {
    setShowModeSelection(false);
    setIsPolishing(true);
    setSelectedMode(mode);
    
    const modeLabel = mode === 'basic' ? 'BASIC' : 'PREMIUM';
    toast.info(`${format} AI 다듬기 (${modeLabel})를 시작합니다...`);

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const polishContentFunc = httpsCallable(functions, 'polishContent');

      const contentValues = fields
        .map(field => formData[field.key])
        .filter(v => v && v.trim())
        .join('\n\n');

      const result = await polishContentFunc({
        text: contentValues,
        format: prefix,
        mode: mode
      });

      const polished = (result.data as PolishResult).text;
      setPolishedContent(polished);
      setShowPolishModal(true);
      toast.success(`AI 다듬기 (${modeLabel}) 완료!`);
    } catch (error: any) {
      console.error('AI 처리 실패:', error);
      toast.error(`AI 연결 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsPolishing(false);
    }
  };

  const handleSaveSayu = async () => {
    const updateData = {
      ...formData,
      [sayuKey]: polishedContent,
      [`${prefix}_polished`]: true,
      [`${prefix}_polishedAt`]: new Date().toISOString(),
      [`${prefix}_mode`]: selectedMode,
    };

    setIsSaving(true);
    try {
      await onSave(updateData);
      toast.success(`${format} SAYU가 저장되었습니다!`);
      setShowPolishModal(false);
      onClose();
    } catch (error) {
      console.error('SAYU 저장 실패:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasContent = fields.some(field => {
    const value = formData[field.key];
    return value && value.trim().length > 0;
  });

  return (
    <>
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
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#FAF9F6',
            borderRadius: 12,
            maxWidth: 600,
            width: '100%',
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e5e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff',
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
                {format} 작성
              </h2>
              {existingSayu && (
                <p style={{ fontSize: 12, color: '#10b981', margin: '4px 0 0 0' }}>
                  ✅ SAYU 완료
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X style={{ width: 20, height: 20, color: '#666' }} />
            </button>
          </div>

          {/* Test Data Button */}
          <div style={{ padding: '16px 24px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e5e5' }}>
            <button
              onClick={handleFillTestData}
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: 13,
                border: '1px solid #1A3C6E',
                borderRadius: 8,
                backgroundColor: '#fff',
                color: '#1A3C6E',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 500,
              }}
            >
              <TestTube2 style={{ width: 16, height: 16 }} />
              📋 테스트 데이터 채우기
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {fields.map((field) => (
                <div key={field.key}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: '#666',
                      marginBottom: 8,
                      fontWeight: 500,
                    }}
                  >
                    {field.label}
                  </label>
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows || 4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 14,
                      border: '1px solid #e5e5e5',
                      borderRadius: 8,
                      backgroundColor: '#fff',
                      color: '#333',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e5e5',
              backgroundColor: '#fff',
            }}
          >
            {/* AI 다듬기 버튼 */}
            {hasContent && (
              <button
                onClick={handlePolishClick}
                disabled={isPolishing}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#10b981',
                  color: '#fff',
                  cursor: isPolishing ? 'not-allowed' : 'pointer',
                  opacity: isPolishing ? 0.7 : 1,
                  fontWeight: 600,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Wand2 style={{ width: 16, height: 16 }} />
                ✨ AI 다듬기 (모드 선택)
              </button>
            )}

            {/* 저장/취소 버튼 */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  color: '#666',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.5 : 1,
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#1A3C6E',
                  color: '#FAF9F6',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                  fontWeight: 500,
                }}
              >
                {isSaving ? '저장 중...' : '💾 원본 저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 모드 선택 모달 */}
      {showModeSelection && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
          onClick={() => setShowModeSelection(false)}
        >
          <div
            style={{
              backgroundColor: '#FAF9F6',
              borderRadius: 12,
              maxWidth: 500,
              width: '100%',
              padding: '32px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, color: '#1A3C6E', fontWeight: 600, margin: '0 0 12px 0', textAlign: 'center' }}>
              AI 다듬기 모드 선택
            </h2>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 24px 0', textAlign: 'center' }}>
              원하는 다듬기 수준을 선택하세요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* BASIC 버튼 */}
              <button
                onClick={() => handlePolishWithMode('basic')}
                style={{
                  padding: '20px',
                  border: '2px solid #10b981',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0fdf4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Wand2 style={{ width: 20, height: 20, color: '#10b981' }} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>BASIC</span>
                </div>
                <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.6 }}>
                  오탈자 수정, 자연스러운 문장 연결<br />
                  원본 구조와 내용 유지
                </p>
              </button>

              {/* PREMIUM 버튼 */}
              <button
                onClick={() => handlePolishWithMode('premium')}
                style={{
                  padding: '20px',
                  border: '2px solid #8b5cf6',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#faf5ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Sparkles style={{ width: 20, height: 20, color: '#8b5cf6' }} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#8b5cf6' }}>PREMIUM</span>
                </div>
                <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.6 }}>
                  문장 구조 재배치, 흐름 재구성<br />
                  감정 표현 선명하게, 의미 밀도 향상
                </p>
              </button>
            </div>

            <button
              onClick={() => setShowModeSelection(false)}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '12px',
                border: '1px solid #e5e5e5',
                borderRadius: 8,
                backgroundColor: '#fff',
                color: '#666',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* SAYU 미리보기 모달 */}
      {showPolishModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
          onClick={() => setShowPolishModal(false)}
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
                ✨ {format} SAYU {selectedMode === 'premium' && '(PREMIUM)'}
              </h2>
              <p style={{ fontSize: 13, color: '#999', marginTop: 8, marginBottom: 0 }}>
                AI가 다듬은 결과입니다
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
                onClick={() => setShowPolishModal(false)}
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
                onClick={handleSaveSayu}
                disabled={isSaving}
                style={{
                  padding: '12px 32px',
                  fontSize: 15,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#10b981',
                  color: '#fff',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                {isSaving ? '저장 중...' : '💾 SAYU 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
