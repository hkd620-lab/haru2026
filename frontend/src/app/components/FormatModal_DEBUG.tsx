import { X, TestTube2, Wand2, Upload, ImageIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getTestData } from '../data/testData';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '텃밭일지' | '애완동물관찰일지' | '육아일기';

interface FormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: RecordFormat;
  recordId: string;
  initialData?: Record<string, any>;
  onSave: (formatData: Record<string, any>) => Promise<void>;
}

interface PolishResult {
  text: string;
}

// 형식별 입력 필드 정의 (9개 형식 모두!)
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
  // 🆕 추가 형식 3개
  텃밭일지: [
    { key: 'garden_date', label: '날짜/시간', placeholder: '2026년 3월 4일 오전 8시, 맑음', rows: 2 },
    { key: 'garden_crop', label: '작물', placeholder: '상추, 토마토, 오이', rows: 2 },
    { key: 'garden_work', label: '작업 내용', placeholder: '상추 씨앗 파종, 토마토 지주 설치, 오이 순지르기 작업', rows: 3 },
    { key: 'garden_observation', label: '관찰 사항', placeholder: '상추 발아율 양호, 토마토 첫 꽃 개화, 오이 잎에 흰가루병 초기 증상 발견', rows: 4 },
    { key: 'garden_plan', label: '다음 계획', placeholder: '내일 오이 친환경 살균제 살포 예정, 주말에 퇴비 추가', rows: 3 },
  ],
  애완동물관찰일지: [
    { key: 'pet_name', label: '반려동물', placeholder: '이름: 몽이 / 종류: 웰시코기 / 나이: 2살', rows: 2 },
    { key: 'pet_behavior', label: '행동 관찰', placeholder: '오늘 아침 산책 시 평소보다 활발함. 다른 강아지들과 잘 어울려 놀았음.', rows: 3 },
    { key: 'pet_health', label: '건강 상태', placeholder: '식욕 정상, 배변 정상, 코 촉촉함. 오른쪽 앞발을 약간 절뚝이는 모습 관찰됨.', rows: 3 },
    { key: 'pet_special', label: '특이 사항', placeholder: '새로운 장난감(공)에 큰 관심을 보임. 30분 이상 혼자 놀았음.', rows: 3 },
    { key: 'pet_plan', label: '조치 계획', placeholder: '앞발 절뚝임 증상 지속 관찰 예정. 2일 후에도 계속되면 병원 방문 예정.', rows: 3 },
  ],
  육아일기: [
    { key: 'child_date', label: '날짜/개월 수', placeholder: '2026년 3월 4일 / 생후 18개월', rows: 2 },
    { key: 'child_development', label: '발달 사항', placeholder: '오늘 처음으로 "엄마" 소리를 명확하게 발음함. 혼자서 5걸음 걸었음.', rows: 3 },
    { key: 'child_activity', label: '주요 활동', placeholder: '아침: 블록 쌓기 놀이 / 오후: 놀이터에서 그네 타기 / 저녁: 그림책 읽기', rows: 3 },
    { key: 'child_meal', label: '식사/수면', placeholder: '식사: 아침 잘 먹음, 점심 반 정도, 저녁 완식 / 수면: 낮잠 2시간, 밤 10시 취침', rows: 3 },
    { key: 'child_note', label: '특이 사항', placeholder: '저녁 식사 때 스스로 숟가락 사용 시도. 서툴지만 격려해주니 계속 도전함.', rows: 3 },
    { key: 'child_parent', label: '부모 소감', placeholder: '아이의 성장 속도에 놀랍고 감사함. 인내심을 가지고 지켜봐야겠다고 다짐.', rows: 3 },
  ],
};

// 형식별 prefix 매핑 (9개 모두!)
const FORMAT_PREFIX: Record<RecordFormat, string> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel',
  '텃밭일지': 'garden',
  '애완동물관찰일지': 'pet',
  '육아일기': 'child',
};

export function FormatModal({ isOpen, onClose, format, recordId, initialData = {}, onSave }: FormatModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishedContent, setPolishedContent] = useState('');
  const [showPolishModal, setShowPolishModal] = useState(false);
  
  // 이미지 state
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setPolishedContent('');
      setShowPolishModal(false);
      
      // 기존 이미지 불러오기 (모든 형식에 적용!)
      const prefix = FORMAT_PREFIX[format];
      const imagesKey = `${prefix}_images`;
      setImages(initialData[imagesKey] || []);
    }
  }, [isOpen, initialData, format]);

  if (!isOpen) return null;

  const fields = FORMAT_FIELDS[format];
  const prefix = FORMAT_PREFIX[format];
  const sayuKey = `${prefix}_sayu`;
  const existingSayu = initialData[sayuKey];

  // 이미지 압축 함수
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          const originalSize = (file.size / 1024).toFixed(0);
          const compressedSize = ((compressedDataUrl.length * 3) / 4 / 1024).toFixed(0);
          console.log(`📸 이미지 압축: ${originalSize}KB → ${compressedSize}KB (${((1 - Number(compressedSize) / Number(originalSize)) * 100).toFixed(0)}% 절감)`);
          
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const maxImages = 3;
    const remainingSlots = maxImages - images.length;
    
    if (remainingSlots <= 0) {
      toast.error('사진은 최대 3장까지만 추가할 수 있습니다.');
      return;
    }
    
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    const filePromises = filesToProcess.map((file) => {
      return new Promise<string | null>((resolve) => {
        if (!file.type.startsWith('image/')) {
          toast.error('이미지 파일만 업로드할 수 있습니다.');
          resolve(null);
          return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
          toast.error('이미지 크기는 5MB 이하로 제한됩니다.');
          resolve(null);
          return;
        }
        
        compressImage(file)
          .then((compressedUrl) => {
            resolve(compressedUrl);
          })
          .catch((error) => {
            console.error('이미지 압축 실패:', error);
            toast.error('이미지 압축에 실패했습니다.');
            resolve(null);
          });
      });
    });
    
    Promise.all(filePromises).then((results) => {
      const validImages = results.filter((img): img is string => img !== null);
      if (validImages.length > 0) {
        setImages((prev) => [...prev, ...validImages]);
        toast.success(`${validImages.length}장의 사진이 추가되었습니다!`);
      }
    });
    
    e.target.value = '';
  };

  // 이미지 삭제
  const handleDeleteImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    toast.success('사진이 삭제되었습니다.');
  };

  // 이미지 갤러리 렌더링
  const renderImageGallery = () => {
    if (images.length === 0) return null;
    
    const goldenRatio = 1.618;
    
    if (images.length === 1) {
      return (
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <img src={images[0]} alt="사진 1" style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: `${goldenRatio} / 1`, objectFit: 'cover' }} />
            <button
              onClick={() => handleDeleteImage(0)}
              style={{ position: 'absolute', top: '8px', right: '8px', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.9)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; }}
            >
              <X style={{ width: 18, height: 18, color: '#fff' }} />
            </button>
          </div>
        </div>
      );
    } else if (images.length === 2) {
      return (
        <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {images.map((img, index) => (
            <div key={index} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <img src={img} alt={`사진 ${index + 1}`} style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '1 / 1', objectFit: 'cover' }} />
              <button
                onClick={() => handleDeleteImage(index)}
                style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.9)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; }}
              >
                <X style={{ width: 16, height: 16, color: '#fff' }} />
              </button>
            </div>
          ))}
        </div>
      );
    } else if (images.length === 3) {
      return (
        <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', minHeight: '300px' }}>
          <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', gridRow: '1 / 3' }}>
            <img src={images[0]} alt="사진 1" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
            <button
              onClick={() => handleDeleteImage(0)}
              style={{ position: 'absolute', top: '8px', right: '8px', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.9)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; }}
            >
              <X style={{ width: 18, height: 18, color: '#fff' }} />
            </button>
          </div>
          {images.slice(1).map((img, index) => (
            <div key={index + 1} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minHeight: '143px' }}>
              <img src={img} alt={`사진 ${index + 2}`} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
              <button
                onClick={() => handleDeleteImage(index + 1)}
                style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.9)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; }}
              >
                <X style={{ width: 16, height: 16, color: '#fff' }} />
              </button>
            </div>
          ))}
        </div>
      );
    }
    
    return null;
  };

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
      // 이미지도 함께 저장
      const imagesKey = `${prefix}_images`;
      const dataToSave = {
        ...formData,
        [imagesKey]: images
      };
      
      await onSave(dataToSave);
      toast.success('저장되었습니다!');
      onClose();
    } catch (error) {
      console.error('저장 중 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePolishThisFormat = async () => {
    setIsPolishing(true);
    toast.info(`${format} AI 다듬기를 시작합니다...`);

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const polishContentFunc = httpsCallable(functions, 'polishContent');

      const contentValues = fields
        .map(field => formData[field.key])
        .filter(v => v && v.trim())
        .join('\n\n');

      if (!contentValues.trim()) {
        toast.error('다듬을 내용이 없습니다. 먼저 작성해주세요.');
        setIsPolishing(false);
        return;
      }

      const result = await polishContentFunc({
        text: `다음은 "${format}" 형식으로 작성된 기록입니다. 이 내용을 자연스럽고 읽기 좋게 다듬어주세요.\n\n${contentValues}`,
        format: prefix
      });

      const polished = (result.data as PolishResult).text;
      setPolishedContent(polished);
      setShowPolishModal(true);
      toast.success('AI 다듬기 완료!');
    } catch (error: any) {
      console.error('AI 처리 실패:', error);
      toast.error('AI 연결에 실패했습니다.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleSaveSayu = async () => {
    const imagesKey = `${prefix}_images`;
    const updateData = {
      ...formData,
      [sayuKey]: polishedContent,
      [`${prefix}_polished`]: true,
      [`${prefix}_polishedAt`]: new Date().toISOString(),
      [imagesKey]: images
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
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
        onClick={onClose}
      >
        <div
          style={{ backgroundColor: '#FAF9F6', borderRadius: 12, maxWidth: 600, width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' }}>
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X style={{ width: 20, height: 20, color: '#666' }} />
            </button>
          </div>

          {/* Test Data Button */}
          <div style={{ padding: '16px 24px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e5e5' }}>
            <button
              onClick={handleFillTestData}
              style={{ width: '100%', padding: '10px 16px', fontSize: 13, border: '1px solid #1A3C6E', borderRadius: 8, backgroundColor: '#fff', color: '#1A3C6E', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 500 }}
            >
              <TestTube2 style={{ width: 16, height: 16 }} />
              📋 테스트 데이터 채우기
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {/* 이미지 갤러리 */}
            {renderImageGallery()}
            
            {/* 이미지 업로드 버튼 (모든 형식에 표시!) */}
            {images.length < 3 && (
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="image-upload"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    fontSize: 14,
                    border: '2px dashed #1A3C6E',
                    borderRadius: 8,
                    backgroundColor: '#F0F7FF',
                    color: '#1A3C6E',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#E0EFFF';
                    e.currentTarget.style.borderColor = '#0A2C5E';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#F0F7FF';
                    e.currentTarget.style.borderColor = '#1A3C6E';
                  }}
                >
                  <ImageIcon style={{ width: 18, height: 18 }} />
                  📸 사진 추가 ({images.length}/3)
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {fields.map((field) => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 500 }}>
                    {field.label}
                  </label>
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows || 4}
                    style={{ width: '100%', padding: '12px 16px', fontSize: 14, border: '1px solid #e5e5e5', borderRadius: 8, backgroundColor: '#fff', color: '#333', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', backgroundColor: '#fff' }}>
            {hasContent && (
              <button
                onClick={handlePolishThisFormat}
                disabled={isPolishing}
                style={{ width: '100%', padding: '12px 20px', fontSize: 14, border: 'none', borderRadius: 8, backgroundColor: '#10b981', color: '#fff', cursor: isPolishing ? 'not-allowed' : 'pointer', opacity: isPolishing ? 0.7 : 1, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {isPolishing ? (
                  <>
                    <Wand2 className="animate-spin" style={{ width: 16, height: 16 }} />
                    AI 다듬는 중...
                  </>
                ) : (
                  <>
                    <Wand2 style={{ width: 16, height: 16 }} />
                    ✨ 이 형식만 AI 다듬기
                  </>
                )}
              </button>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={isSaving}
                style={{ padding: '10px 20px', fontSize: 14, border: '1px solid #e5e5e5', borderRadius: 8, backgroundColor: '#fff', color: '#666', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.5 : 1 }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                style={{ padding: '10px 20px', fontSize: 14, border: 'none', borderRadius: 8, backgroundColor: '#1A3C6E', color: '#FAF9F6', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, fontWeight: 500 }}
              >
                {isSaving ? '저장 중...' : '💾 원본 저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SAYU 미리보기 모달 */}
      {showPolishModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}
          onClick={() => setShowPolishModal(false)}
        >
          <div
            style={{ backgroundColor: '#FAF9F6', borderRadius: 12, maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e5e5', backgroundColor: '#fff' }}>
              <h2 style={{ fontSize: 20, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
                ✨ {format} SAYU
              </h2>
              <p style={{ fontSize: 13, color: '#999', marginTop: 8, marginBottom: 0 }}>
                AI가 다듬은 결과입니다
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: 8, border: '1px solid #e5e5e5', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8, color: '#333' }}>
                {polishedContent}
              </div>
            </div>

            <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e5e5', display: 'flex', gap: 12, justifyContent: 'flex-end', backgroundColor: '#fff' }}>
              <button
                onClick={() => setShowPolishModal(false)}
                style={{ padding: '12px 24px', fontSize: 14, border: '1px solid #e5e5e5', borderRadius: 8, backgroundColor: '#fff', color: '#666', cursor: 'pointer', fontWeight: 500 }}
              >
                취소
              </button>
              <button
                onClick={handleSaveSayu}
                disabled={isSaving}
                style={{ padding: '12px 32px', fontSize: 15, border: 'none', borderRadius: 8, backgroundColor: '#10b981', color: '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, fontWeight: 600, letterSpacing: '0.05em' }}
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
