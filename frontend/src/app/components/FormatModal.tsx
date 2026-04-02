import { X, TestTube2, Wand2, Upload, Trash2, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getTestData } from '../data/testData';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { compressImage } from '../services/imageService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import heic2any from 'heic2any';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '텃밭일지' | '애완동물관찰일지' | '육아일기' | '메모';
type SayuMode = 'BASIC' | 'PREMIUM';

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
    { key: 'essay_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  선교보고: [
    { key: 'mission_place', label: 'Place', placeholder: '오전 10시, ○○마을 입구 우물가에서 현지 주민 5명과 인사를 나누었습니다.', rows: 2 },
    { key: 'mission_action', label: 'Action', placeholder: '어린이 10명을 대상으로 성경 동화 구연 및 기초 위생 교육을 실시했습니다.', rows: 4 },
    { key: 'mission_grace', label: 'Grace', placeholder: '서먹했던 추장님께서 먼저 다가와 차를 대접해 주시고 다음 주 방문을 환영해 주셨습니다.', rows: 3 },
    { key: 'mission_heart', label: 'Heart', placeholder: '언어의 장벽으로 인해 어려움이 있었지만, 웃음이 최고의 언어임을 다시 한번 확인했습니다.', rows: 3 },
    { key: 'mission_prayer', label: 'Prayer', placeholder: '마을 내 깨끗한 식수원 확보를 위한 우물 파기 사역이 순조롭게 진행되기를 기원합니다.', rows: 3 },
    { key: 'mission_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  일반보고: [
    { key: 'report_activity', label: '활동 명칭', placeholder: '본관 2층 인문학 코너 신간 도서 분류 및 배가 작업을 수행했습니다.', rows: 2 },
    { key: 'report_progress', label: '진행 상황', placeholder: '전체 500권 중 350권 분류 및 배가 완료되었으며, 현재 공정률은 약 70%입니다.', rows: 3 },
    { key: 'report_achievement', label: '핵심 성과', placeholder: '철학 및 역사 분야 도서 정리를 완료하여 이용객들의 도서 검색 효율성을 크게 향상시켰습니다.', rows: 3 },
    { key: 'report_notes', label: '특이 사항', placeholder: '서가 공간 부족 현상이 발생하고 있습니다. 대출 빈도가 낮은 구권 서적의 재배치를 검토하여 공간 활용도를 개선할 필요가 있습니다.', rows: 4 },
    { key: 'report_future', label: '향후 계획', placeholder: '내일 오전 중 남은 150권의 도서 정리를 마무리하고 서가 재배치 기획안을 작성할 예정입니다.', rows: 3 },
    { key: 'report_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  업무일지: [
    { key: 'work_schedule', label: 'Schedule', placeholder: '09:00 주간 회의 주관\n13:00 신입 사원 직무 교육', rows: 3 },
    { key: 'work_result', label: 'Result', placeholder: '회의록 배포 완료\n교육 만족도 조사 결과 \'매우 만족\' 90% 이상 기록', rows: 3 },
    { key: 'work_pending', label: 'Pending', placeholder: '예산 결산 보고서 초안 작성 (자료 보완 후 내일 오전 중 완료 예정)', rows: 3 },
    { key: 'work_metric', label: 'Key Metric', placeholder: '오늘 걸음 수: 8,500보\n지출: 점심 식대 12,000원', rows: 2 },
    { key: 'work_rating', label: 'Rating', placeholder: '★★★★☆ (일정이 빡빡했지만 핵심 업무 대부분 완수)', rows: 2 },
    { key: 'work_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  여행기록: [
    { key: 'travel_journey', label: '여정', placeholder: '오전 10시 산사 도착\n일주문에서 대웅전까지 이어지는 숲길 산책', rows: 3 },
    { key: 'travel_scenery', label: '풍경', placeholder: '처마 끝 풍경(風磬)이 바람에 흔들리며 맑은 소리를 냄\n색이 바랜 단청의 편안함', rows: 3 },
    { key: 'travel_food', label: '미식', placeholder: '사찰 인근 식당에서 산채비빔밥 섭취\n양념이 과하지 않아 나물 향이 입안에 오래 남음', rows: 3 },
    { key: 'travel_thought', label: '단상', placeholder: '빠르게 걷느라 놓쳤던 것들을 멈춰 서니 비로소 볼 수 있었습니다. 삶의 속도를 늦추는 것은 곧 깊어짐을 의미합니다.', rows: 4 },
    { key: 'travel_gratitude', label: '감사', placeholder: '길을 안내해 주신 노스님의 미소에 감사드립니다.\n비를 피할 수 있도록 해 준 쉼터 지붕에 감사드립니다.', rows: 3 },
    { key: 'travel_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  텃밭일지: [
    { key: 'garden_crop', label: '작물', placeholder: '토마토, 상추, 고추를 심었습니다.', rows: 2 },
    { key: 'garden_work', label: '오늘 한 일', placeholder: '잡초를 제거하고 물을 주었습니다.', rows: 3 },
    { key: 'garden_observation', label: '관찰', placeholder: '토마토에 꽃이 피기 시작했습니다.', rows: 3 },
    { key: 'garden_issue', label: '문제점', placeholder: '고추 잎에 벌레가 보여서 친환경 살충제를 뿌렸습니다.', rows: 3 },
    { key: 'garden_plan', label: '다음 계획', placeholder: '내일은 지주대를 세워야겠습니다.', rows: 2 },
    { key: 'garden_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  애완동물관찰일지: [
    { key: 'pet_name', label: '반려동물 이름', placeholder: '우리 강아지 \'뭉치\'', rows: 1 },
    { key: 'pet_health', label: '건강 상태', placeholder: '식욕이 좋고 활발합니다.', rows: 2 },
    { key: 'pet_behavior', label: '행동 관찰', placeholder: '오늘 처음으로 \'앉아\'를 성공했습니다!', rows: 3 },
    { key: 'pet_care', label: '돌봄 기록', placeholder: '산책 30분, 간식 2회, 목욕', rows: 3 },
    { key: 'pet_special', label: '특별한 일', placeholder: '동네 친구 강아지와 사이좋게 놀았습니다.', rows: 3 },
    { key: 'pet_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  육아일기: [
    { key: 'child_name', label: '아이 이름', placeholder: '우리 아이 \'하은\'', rows: 1 },
    { key: 'child_growth', label: '성장 기록', placeholder: '오늘 처음으로 \'엄마\'라고 불렀습니다!', rows: 3 },
    { key: 'child_meal', label: '식사', placeholder: '아침: 미역국, 점심: 야채죽, 저녁: 소고기볶음밥', rows: 2 },
    { key: 'child_activity', label: '활동', placeholder: '놀이터에서 친구들과 그네를 탔습니다.', rows: 3 },
    { key: 'child_emotion', label: '부모의 마음', placeholder: '아이가 자라는 모습을 보니 뿌듯하고 감사합니다.', rows: 3 },
    { key: 'child_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
  메모: [
    { key: 'memo_title', label: '제목', placeholder: '오늘의 메모 제목을 입력하세요.', rows: 1 },
    { key: 'memo_content', label: '내용', placeholder: '메모할 내용을 자유롭게 작성하세요.', rows: 6 },
    { key: 'memo_action', label: '다음 행동', placeholder: '이 메모와 관련된 다음 할 일이 있다면 적어두세요.', rows: 2 },
    { key: 'memo_space', label: '여백', placeholder: '자유롭게 작성하세요.', rows: 2 },
  ],
};

// 형식별 prefix 매핑
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
  '메모': 'memo',
};

// 기록 스타일 타입
type RecordStyle = 'simple' | 'premium';

const DIARY_PREMIUM_FIELDS = [
  { key: 'diary_action', label: '행동' },
  { key: 'diary_good', label: '좋았던 일' },
  { key: 'diary_conflict', label: '갈등' },
  { key: 'diary_regret', label: '아쉬움' },
  { key: 'diary_learning', label: '배움' },
  { key: 'diary_space', label: '여백' },
];

export function FormatModal({ isOpen, onClose, format, recordId, initialData = {}, onSave }: FormatModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Record<string, string>>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishedContent, setPolishedContent] = useState('');
  const [showPolishModal, setShowPolishModal] = useState(false);
  const [sayuMode, setSayuMode] = useState<SayuMode>('BASIC');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [polishStats, setPolishStats] = useState<any>(null);
  
  // 사진 관련 state
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 📝 메모 형식 안내 메시지
  const [showMemoGuide, setShowMemoGuide] = useState(true);

  // 기록 스타일 선택
  const [recordStyle, setRecordStyle] = useState<RecordStyle>('simple');
  const [recordStep, setRecordStep] = useState<'select' | 'input'>('select');

  // 🌱 텃밭일지 전용: 작물 목록 관리
  const [crops, setCrops] = useState<string[]>([]);
  const [newCropName, setNewCropName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setPolishedContent('');
      setShowPolishModal(false);
      setShowModeSelect(false);

      setRecordStyle('simple');
      setRecordStep('select');

      // 기존 이미지 불러오기
      const prefix = FORMAT_PREFIX[format];
      const imagesKey = `${prefix}_images`;
      if (initialData[imagesKey]) {
        try {
          const parsedImages = JSON.parse(initialData[imagesKey]);
          const arr = Array.isArray(parsedImages) ? parsedImages : [];
          setUploadedImages(arr.filter((v: any) => typeof v === 'string' && v.startsWith('http')));
        } catch {
          setUploadedImages([]);
        }
      } else {
        setUploadedImages([]);
      }

      // 🌱 텃밭일지: localStorage에서 작물 목록 불러오기
      if (format === '텃밭일지') {
        try {
          const saved = localStorage.getItem('haru_garden_crops');
          if (saved) {
            setCrops(JSON.parse(saved));
          } else {
            setCrops([]);
          }
        } catch {
          setCrops([]);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && format === '메모') {
      setShowMemoGuide(true);
    }
  }, [isOpen, format]);

  if (!isOpen) return null;

  const fields = FORMAT_FIELDS[format];
  const prefix = FORMAT_PREFIX[format];
  const sayuKey = `${prefix}_sayu`;
  const imagesKey = `${prefix}_images`;
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

  // 🌱 작물 추가
  const handleAddCrop = () => {
    if (!newCropName.trim()) {
      toast.warning('작물 이름을 입력해주세요.');
      return;
    }
    if (crops.length >= 10) {
      toast.warning('최대 10개까지만 추가할 수 있습니다.');
      return;
    }
    if (crops.includes(newCropName.trim())) {
      toast.warning('이미 추가된 작물입니다.');
      return;
    }

    const updated = [...crops, newCropName.trim()];
    setCrops(updated);
    setNewCropName('');

    try {
      localStorage.setItem('haru_garden_crops', JSON.stringify(updated));
      toast.success(`${newCropName} 추가!`);
    } catch {
      toast.error('저장 실패');
    }
  };

  // 🌱 작물 삭제
  const handleRemoveCrop = (cropToRemove: string) => {
    const updated = crops.filter(c => c !== cropToRemove);
    setCrops(updated);

    try {
      localStorage.setItem('haru_garden_crops', JSON.stringify(updated));
      toast.success(`${cropToRemove} 삭제!`);
    } catch {
      toast.error('저장 실패');
    }
  };

  const handleSubmit = async () => {
    if (recordStep === 'select') return;
    setIsSaving(true);
    try {
      const dataToSave = { ...formData };
      if (format === '텃밭일지' && crops.length > 0) {
        dataToSave.garden_crop = crops.join(', ');
      }

      dataToSave[`${prefix}_style`] = recordStyle;
      dataToSave[imagesKey] = JSON.stringify(uploadedImages);

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

  const handlePolishClick = () => {
    handlePolishWithMode('PREMIUM');
  };

  const handlePolishWithMode = async (mode: SayuMode) => {
    setSayuMode(mode);
    setShowModeSelect(false);
    setIsPolishing(true);
    toast.info(`${format} AI 다듬기를 시작합니다... (${mode} 모드)`);

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const polishContentFunc = httpsCallable(functions, 'polishContent');

      let contentValues: string;
      if (recordStyle === 'simple') {
        contentValues = formData[`${prefix}_simple`] || '';
      } else if (format === '일기') {
        contentValues = DIARY_PREMIUM_FIELDS
          .map(field => formData[field.key])
          .filter(v => typeof v === "string" && v.trim())
          .join('\n\n');
      } else {
        contentValues = fields
          .map(field => formData[field.key])
          .filter(v => typeof v === "string" && v.trim())
          .join('\n\n');
        if (format === '텃밭일지' && crops.length > 0) {
          contentValues = `작물: ${crops.join(', ')}\n\n${contentValues}`;
        }
      }

      if (!contentValues.trim()) {
        toast.error('다듬을 내용이 없습니다. 먼저 작성해주세요.');
        setIsPolishing(false);
        return;
      }

      const result = await polishContentFunc({
        text: `다음은 "${format}" 형식으로 작성된 기록입니다. 이 내용을 자연스럽고 읽기 좋게 교정해주세요.

**제목 생성:**
1. 먼저 내용을 읽고 핵심을 파악하세요.
2. 내용을 대표하는 짧고 인상적인 제목을 만드세요 (10자 이내 권장).
3. 제목은 **제목내용** 형식으로 첫 줄에 작성하세요.
4. 제목 다음 줄은 비우고, 그 다음부터 본문을 시작하세요.

**절대 준수 사항:**
1. 말투는 무조건 "~다", "~했다", "~이다" 체로만 작성하세요.
   - "했습니다" → "했다"
   - "있었습니다" → "있었다"
   - "되었습니다" → "되었다"
   - "느꼈습니다" → "느꼈다"
   - "생각합니다" → "생각한다"
   - 절대 존댓말(~습니다, ~세요)을 사용하지 마세요.
2. 원문에 없는 사실, 감정, 배경, 원인, 결과를 절대 추가하지 마세요.
   - 원문에 없는 장소, 인물, 날씨, 느낌, 이유, 결과를 임의로 삽입하지 마세요.
   - 교정은 원문의 내용을 그대로 유지하면서 문법·맞춤법·어색한 표현만 수정합니다.

**사실 보존 자기검증 (내부 단계 — 출력하지 말 것):**
교정 완료 후 출력 전, 결과물에 원문에 없는 내용이 추가되었는지 확인하고 있다면 제거하세요.

**중요: PDF 1페이지 출력을 위해 다듬은 결과는 반드시 공백 제외 2500자 이내로 작성해주세요.**

**응답 형식 예시:**
**제목 (10자 이내)**

본문 내용...

${contentValues}`,
        format: prefix,
        mode: mode,
      });

      const responseData = result.data as any;
      const polished = responseData.text;
      const stats = responseData.stats;
      
      setPolishedContent(polished);
      setPolishStats(stats);
      setShowPolishModal(true);
      toast.success('AI 다듬기 완료!');
    } catch (error: any) {
      console.error('AI 처리 실패:', error);
      toast.error('AI 연결에 실패했습니다.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const remainingSlots = 3 - uploadedImages.length;
    if (remainingSlots <= 0) {
      toast.warning('최대 3장까지만 업로드할 수 있습니다.');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    setIsUploading(true);
    try {
      const storage = getStorage();
      const newImageUrls: string[] = [];

      for (const file of filesToUpload) {
        if (file.size > 20 * 1024 * 1024) {
          toast.warning(`${file.name}은 20MB를 초과하여 건너뜁니다.`);
          continue;
        }

        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
          file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

        if (!file.type.startsWith('image/') && !isHeic) {
          toast.warning(`${file.name}은 이미지 파일이 아닙니다.`);
          continue;
        }

        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 9);
        const fileName = `${timestamp}_${randomId}.jpg`;

        if (!user?.uid) {
          toast.error('로그인이 필요합니다.');
          continue;
        }

        // HEIC → JPG 변환 (Cloudinary, Firebase Functions 경유)
        let fileToProcess: File | Blob = file;
        if (isHeic) {
          try {
            toast.info('HEIC 파일을 변환 중...');

            // arrayBuffer로 읽기 (FileReader 미사용)
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            const imageBase64 = btoa(binary);

            // convertHeic Function 호출 → Cloudinary JPG URL 반환
            const functionsInstance = getFunctions(undefined, 'asia-northeast3');
            const convertHeicFunc = httpsCallable(functionsInstance, 'convertHeic');
            const result = await convertHeicFunc({ imageBase64 });
            const { url } = result.data as { url: string };

            // Cloudinary JPG URL → Blob
            const response = await fetch(url);
            if (!response.ok) throw new Error('JPG 다운로드 실패');
            fileToProcess = await response.blob();
          } catch (err) {
            console.error('HEIC 변환 실패:', err);
            toast.error('HEIC 변환에 실패했습니다.');
            continue;
          }
        }

        // 이미지 압축 및 업로드
        try {
          console.log('🖼️ [이미지 압축 시작]');
          const originalSizeMB = (fileToProcess.size / 1024 / 1024).toFixed(2);
          console.log(`📥 원본 크기: ${originalSizeMB}MB`);

          const compressed = await compressImage(fileToProcess as File, 800, 0.85);

          const compressedSizeMB = (compressed.size / 1024 / 1024).toFixed(2);
          const compressionRate = ((1 - compressed.size / file.size) * 100).toFixed(1);
          console.log(`📤 압축 후 크기: ${compressedSizeMB}MB`);
          console.log(`✅ 압축률: ${compressionRate}%`);
          console.log('🎉 [이미지 압축 완료]\n');

          const imagePath = `users/${user.uid}/format_photos/${recordId}_${prefix}_${fileName}`;
          const storageRef = ref(storage, imagePath);
          await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
          const downloadUrl = await getDownloadURL(storageRef);
          newImageUrls.push(downloadUrl);
        } catch (fileError: any) {
          if (fileError?.message === 'FILE_READER_ERROR') {
            toast.error(
              '각종 클라우드에 있는 사진은 직접 업로드가 안 됩니다. 스마트폰에서 직접 업로드하거나 클라우드의 사진을 다운받은 후 추가해주세요.'
            );
            continue;
          }
          throw fileError;
        }
      }

      setUploadedImages(prev => [...prev, ...newImageUrls]);
      toast.success(`${newImageUrls.length}장의 사진이 업로드되었습니다!`);
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      toast.error('이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Firebase Storage URL에서 경로 추출
  function getStoragePathFromDownloadUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const idx = u.pathname.indexOf("/o/");
      if (idx === -1) return null;
      const encodedPath = u.pathname.substring(idx + 3);
      return decodeURIComponent(encodedPath);
    } catch {
      return null;
    }
  }

  const handleDeleteImage = async (imageUrl: string, index: number) => {
    try {
      const storage = getStorage();
      const path = imageUrl.startsWith("http") ? getStoragePathFromDownloadUrl(imageUrl) : imageUrl;
      
      console.log('🗑️ 이미지 삭제 시도');
      console.log('원본 URL:', imageUrl);
      console.log('추출된 경로:', path);
      
      if (!path) throw new Error("Invalid image URL");
      
      const imageRef = ref(storage, path);
      await deleteObject(imageRef);
      
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
      toast.success('사진이 삭제되었습니다.');
    } catch (error: any) {
      console.error('이미지 삭제 실패:', error);
      
      // ✅ object-not-found 에러면 이미 삭제된 것으로 간주
      if (error?.code === 'storage/object-not-found') {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
        toast.success('사진이 제거되었습니다.');
      } else {
        toast.error('사진 삭제에 실패했습니다.');
      }
    }
  };

  const handleSaveOriginalAsSayu = async () => {
    let originalContent: string;
    if (recordStyle === 'simple') {
      originalContent = formData[`${prefix}_simple`] || '';
    } else if (format === '일기') {
      originalContent = DIARY_PREMIUM_FIELDS
        .map(field => formData[field.key])
        .filter(v => typeof v === 'string' && v.trim())
        .join('\n\n');
    } else {
      originalContent = fields
        .map(field => formData[field.key])
        .filter(v => typeof v === 'string' && v.trim())
        .join('\n\n');
      if (format === '텃밭일지' && crops.length > 0) {
        originalContent = `작물: ${crops.join(', ')}\n\n${originalContent}`;
      }
    }

    if (!originalContent.trim()) {
      toast.error('저장할 내용이 없습니다. 먼저 작성해주세요.');
      return;
    }

    const dataToSave: Record<string, any> = {
      ...formData,
      [sayuKey]: originalContent,
      [imagesKey]: JSON.stringify(uploadedImages),
      [`${prefix}_style`]: recordStyle,
    };

    if (format === '텃밭일지' && crops.length > 0) {
      dataToSave.garden_crop = crops.join(', ');
    }

    setIsSaving(true);
    try {
      await onSave(dataToSave);
      toast.success('SAYU에 저장되었습니다!');
      onClose();
    } catch (error) {
      console.error('저장 중 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSayu = async () => {
    const updateData: Record<string, any> = {
      ...formData,
      [sayuKey]: polishedContent,
      [imagesKey]: JSON.stringify(uploadedImages),
      [`${prefix}_polished`]: true,
      [`${prefix}_polishedAt`]: new Date().toISOString(),
      [`${prefix}_mode`]: sayuMode,
    };

    if (polishStats) {
      updateData[`${prefix}_stats`] = polishStats;
    }

    if (format === '텃밭일지' && crops.length > 0) {
      updateData.garden_crop = crops.join(', ');
    }

    updateData[`${prefix}_style`] = recordStyle;

    // SAYU 다듬기 결과에서 AI 제목 추출 (모든 형식)
    // .trim()으로 앞뒤 공백·줄바꿈 제거 후 매칭 (Gemini 응답에 앞 공백이 붙는 경우 대비)
    const titleMatch = polishedContent.trim().match(/^\*\*(.+?)\*\*/);
    if (titleMatch && titleMatch[1]) {
      updateData[`${prefix}_title`] = titleMatch[1].trim();
    }
    // 메모 형식은 memo_title 필드도 함께 업데이트
    if (format === '메모' && titleMatch?.[1] && !formData['memo_title']?.trim()) {
      updateData['memo_title'] = titleMatch[1].trim();
    }

    setIsSaving(true);
    try {
      await onSave(updateData);
      toast.success(`${format} SAYU가 저장되었습니다! (${sayuMode} 모드)`);
      setShowPolishModal(false);
      onClose();
    } catch (error) {
      console.error('SAYU 저장 실패:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasContent = (() => {
    if (recordStyle === 'simple') {
      return typeof formData[`${prefix}_simple`] === "string" && formData[`${prefix}_simple`].trim().length > 0;
    }
    if (format === '일기') {
      return DIARY_PREMIUM_FIELDS.some(f => typeof formData[f.key] === "string" && formData[f.key].trim().length > 0);
    }
    return fields.some(field => {
      const value = formData[field.key];
      return typeof value === "string" && value.trim().length > 0;
    }) || (format === '텃밭일지' && crops.length > 0);
  })();

  return (
    <>
      {/* 메인 모달 */}
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

          {/* Test Data Button — 선택 화면에서 숨김 */}
          {recordStep === 'input' && (
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
          )}

          {/* Content */}
          {/* Step 1 — 공통 선택 화면 */}
          {recordStep === 'select' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
              <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                기록 방식을 선택하세요
              </p>
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                선택하면 바로 입력 화면으로 이동합니다
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* 간편 기록 카드 */}
                <div
                  onClick={() => { setRecordStyle('simple'); setRecordStep('input'); }}
                  style={{
                    border: '0.5px solid #10b981',
                    borderRadius: '12px',
                    padding: '20px 14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#f0fdf8',
                  }}
                >
                  <div style={{ display: 'inline-block', fontSize: '10px', padding: '2px 10px', borderRadius: '20px', background: '#dcfce7', color: '#166534', fontWeight: 500, marginBottom: '8px' }}>
                    간편
                  </div>
                  <div style={{ fontSize: '26px', marginBottom: '8px' }}>✏️</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}>간편 기록</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>자유롭게 한 번에<br />부담 없이 기록</div>
                </div>
                {/* 프리미엄 기록 카드 */}
                <div
                  onClick={() => { setRecordStyle('premium'); setRecordStep('input'); }}
                  style={{
                    border: '0.5px solid #1A3C6E',
                    borderRadius: '12px',
                    padding: '20px 14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#EEF3FA',
                  }}
                >
                  <div style={{ display: 'inline-block', fontSize: '10px', padding: '2px 10px', borderRadius: '20px', background: '#dbeafe', color: '#1e3a8a', fontWeight: 500, marginBottom: '8px' }}>
                    프리미엄
                  </div>
                  <div style={{ fontSize: '26px', marginBottom: '8px' }}>📋</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}>프리미엄 기록</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>항목별로 꼼꼼하게<br />체계적으로 기록</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — 입력 화면 */}
          {recordStep === 'input' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 뒤로가기 + 모드 배지 */}
              <div>
                <button
                  onClick={() => setRecordStep('select')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', padding: 0 }}
                >
                  ← 방식 다시 선택
                </button>
                <span style={{
                  display: 'inline-block', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500,
                  background: recordStyle === 'simple' ? '#dcfce7' : '#dbeafe',
                  color: recordStyle === 'simple' ? '#166534' : '#1e3a8a',
                }}>
                  {recordStyle === 'simple' ? '✏️ 간편 기록' : '📋 프리미엄 기록'}
                </span>
              </div>

              {/* 🌱 텃밭일지: 작물 목록 UI */}
              {format === '텃밭일지' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 500 }}>
                    🌱 작물 목록
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={newCropName}
                      onChange={(e) => setNewCropName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCrop()}
                      placeholder="작물 이름 입력 (예: 토마토)"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: 13,
                        border: '1px solid #e5e5e5',
                        borderRadius: 6,
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleAddCrop}
                      style={{
                        padding: '8px 16px',
                        fontSize: 13,
                        border: 'none',
                        borderRadius: 6,
                        backgroundColor: '#10b981',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                      추가
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {crops.map((crop) => (
                      <div
                        key={crop}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          fontSize: 12,
                          backgroundColor: '#f0f9ff',
                          color: '#1A3C6E',
                          borderRadius: 6,
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        {crop}
                        <button
                          onClick={() => handleRemoveCrop(crop)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            color: '#ef4444',
                          }}
                        >
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 메모 형식 AI 제목 안내 */}
              {format === '메모' && showMemoGuide && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 8,
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #10b981',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>✨</span>
                    <p style={{ fontSize: 12, color: '#065f46', margin: 0, lineHeight: 1.6 }}>
                      <strong style={{ color: '#10b981' }}>AI 제목 자동 추출</strong> —
                      제목을 비워두면 저장 시 AI가 내용을 분석해 자동으로 제목을 달아드립니다.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowMemoGuide(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#10b981',
                      fontSize: 16,
                      padding: 0,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* 간편 스타일: 자유 텍스트 1개 */}
              {recordStyle === 'simple' && (
                <textarea
                  rows={8}
                  placeholder="자유롭게 기록해 주세요..."
                  value={formData[`${prefix}_simple`] || ''}
                  onChange={(e) => handleChange(`${prefix}_simple`, e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', fontSize: 16,
                    border: '1px solid #e5e5e5', borderRadius: 8,
                    backgroundColor: '#fff', color: '#333',
                    resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                  }}
                />
              )}

              {/* 프리미엄 스타일: FORMAT_FIELDS 그대로 */}
              {recordStyle === 'premium' && (
                <>
                  {format === '일기'
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {DIARY_PREMIUM_FIELDS.map((f) => (
                          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ fontWeight: 500, fontSize: '13px', color: '#444', letterSpacing: '0.3px' }}>
                              {f.label}
                            </label>
                            <div style={{ position: 'relative' }}>
                              <textarea
                                placeholder={FORMAT_FIELDS['일기'].find(ff => ff.key === f.key)?.placeholder || `${f.label}을(를) 입력하세요`}
                                value={formData[f.key] || ''}
                                onChange={(e) => handleChange(f.key, e.target.value)}
                                style={{
                                  width: '100%', boxSizing: 'border-box',
                                  padding: '17px', paddingRight: '46px',
                                  fontSize: '16px', lineHeight: '1.5',
                                  border: '1px solid #e4e4e4', borderRadius: '20px',
                                  backgroundColor: '#fff', color: '#333',
                                  resize: 'none', fontFamily: 'inherit', outline: 'none',
                                  minHeight: '56px',
                                }}
                              />
                              <div style={{
                                position: 'absolute', top: '17px', right: '17px',
                                width: '20px', height: '20px', borderRadius: '50%',
                                backgroundColor: '#999', pointerEvents: 'none',
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    : fields.map((field) => (
                        <div key={field.key}>
                          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 500 }}>
                            {field.label}
                          </label>
                          <textarea
                            value={formData[field.key] || ''}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={field.rows || 4}
                            style={{
                              width: '100%', padding: '12px 16px', fontSize: 14,
                              border: '1px solid #e5e5e5', borderRadius: 8,
                              backgroundColor: '#fff', color: '#333',
                              resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                            }}
                          />
                        </div>
                      ))
                  }
                </>
              )}

              {/* 📸 사진 업로드 섹션 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4, fontWeight: 500 }}>
                  📸 사진 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(선택사항)</span>
                </label>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, marginTop: 0 }}>
                  사진 없이도 저장할 수 있습니다 · 최대 3장 · PNG, JPG, JPEG, WEBP, HEIC
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                {format === '일기' ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || uploadedImages.length >= 3}
                    style={{
                      width: '100%',
                      padding: '17px',
                      border: '1px solid #e4e4e4',
                      borderRadius: '20px',
                      backgroundColor: '#f7f7f7',
                      cursor: isUploading || uploadedImages.length >= 3 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isUploading || uploadedImages.length >= 3 ? 0.5 : 1,
                    }}
                  >
                    {isUploading
                      ? <span style={{ fontSize: 13, color: '#999' }}>업로드 중...</span>
                      : <Plus style={{ width: 24, height: 24, color: '#999', strokeWidth: 1.5 }} />
                    }
                  </button>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || uploadedImages.length >= 3}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: 13,
                      border: '1px dashed #d1d5db',
                      borderRadius: 8,
                      backgroundColor: '#f9fafb',
                      color: '#6b7280',
                      cursor: isUploading || uploadedImages.length >= 3 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      opacity: isUploading || uploadedImages.length >= 3 ? 0.5 : 1,
                    }}
                  >
                    <Upload style={{ width: 16, height: 16 }} />
                    {isUploading ? '업로드 중...' : `사진 추가 (${uploadedImages.length}/3)`}
                  </button>
                )}

                {uploadedImages.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {/* 1장: 큰 사진 1개 */}
                    {uploadedImages.length === 1 && (
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                        <img
                          src={uploadedImages[0]}
                          alt="업로드된 사진 1"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid #e5e5e5',
                          }}
                        />
                        <button
                          onClick={() => handleDeleteImage(uploadedImages[0], 0)}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          <Trash2 style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    )}

                    {/* 2장: 균등 배치 */}
                    {uploadedImages.length === 2 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {uploadedImages.map((url, index) => (
                          <div key={index} style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
                            <img
                              src={url}
                              alt={`업로드된 사진 ${index + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: 8,
                                border: '1px solid #e5e5e5',
                              }}
                            />
                            <button
                              onClick={() => handleDeleteImage(url, index)}
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                backgroundColor: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                              }}
                            >
                              <Trash2 style={{ width: 16, height: 16 }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3장: 위 큰 1개 + 아래 작은 2개 */}
                    {uploadedImages.length === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                          <img
                            src={uploadedImages[0]}
                            alt="업로드된 사진 1"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: 8,
                              border: '1px solid #e5e5e5',
                            }}
                          />
                          <button
                            onClick={() => handleDeleteImage(uploadedImages[0], 0)}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                            }}
                          >
                            <Trash2 style={{ width: 16, height: 16 }} />
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {uploadedImages.slice(1).map((url, index) => (
                            <div key={index + 1} style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
                              <img
                                src={url}
                                alt={`업로드된 사진 ${index + 2}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  border: '1px solid #e5e5e5',
                                }}
                              />
                              <button
                                onClick={() => handleDeleteImage(url, index + 1)}
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  backgroundColor: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                }}
                              >
                                <Trash2 style={{ width: 16, height: 16 }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}{/* end input step */}

          {/* Footer — 선택 화면에서 숨김 */}
          {recordStep === 'input' && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e5e5',
              backgroundColor: '#fff',
            }}
          >
            {format === '일기' ? (
              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                <button
                  onClick={handlePolishClick}
                  disabled={isPolishing || isSaving}
                  style={{
                    flex: 1, height: '56px',
                    fontSize: '14px', fontWeight: 500,
                    letterSpacing: '0.45px',
                    border: 'none', borderRadius: '20px',
                    backgroundColor: '#bbe8ee', color: '#000',
                    cursor: (isPolishing || isSaving) ? 'not-allowed' : 'pointer',
                    opacity: (isPolishing || isSaving) ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {isPolishing ? (
                    <>
                      <Wand2 className="animate-spin" style={{ width: 15, height: 15 }} />
                      AI 다듬는 중...
                    </>
                  ) : 'AI 다듬은 글 저장'}
                </button>
                <button
                  onClick={handleSaveOriginalAsSayu}
                  disabled={isSaving || isPolishing}
                  style={{
                    flex: 1, height: '56px',
                    fontSize: '14px', fontWeight: 500,
                    letterSpacing: '0.45px',
                    border: 'none', borderRadius: '20px',
                    backgroundColor: '#fae385', color: '#000',
                    cursor: (isSaving || isPolishing) ? 'not-allowed' : 'pointer',
                    opacity: (isSaving || isPolishing) ? 0.7 : 1,
                  }}
                >
                  {isSaving ? '저장 중...' : '원본 저장'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button
                  onClick={handlePolishClick}
                  disabled={isPolishing || isSaving}
                  style={{
                    padding: '12px 16px',
                    fontSize: 14,
                    border: 'none',
                    borderRadius: 8,
                    backgroundColor: '#10b981',
                    color: '#fff',
                    cursor: (isPolishing || isSaving) ? 'not-allowed' : 'pointer',
                    opacity: (isPolishing || isSaving) ? 0.7 : 1,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {isPolishing ? (
                    <>
                      <Wand2 className="animate-spin" style={{ width: 15, height: 15 }} />
                      AI 다듬는 중...
                    </>
                  ) : (
                    <>
                      <Wand2 style={{ width: 15, height: 15 }} />
                      AI 다듬은 후 SAYU 저장
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveOriginalAsSayu}
                  disabled={isSaving || isPolishing}
                  style={{
                    padding: '12px 16px',
                    fontSize: 14,
                    border: 'none',
                    borderRadius: 8,
                    backgroundColor: '#1A3C6E',
                    color: '#FAF9F6',
                    cursor: (isSaving || isPolishing) ? 'not-allowed' : 'pointer',
                    opacity: (isSaving || isPolishing) ? 0.7 : 1,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSaving ? '저장 중...' : '다듬지 않고 SAYU 저장'}
                </button>
              </div>
            )}
          </div>
          )}{/* end footer conditional */}
        </div>
      </div>

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
                ✨ {format} SAYU ({sayuMode})
              </h2>
              <p style={{ fontSize: 13, color: '#999', marginTop: 8, marginBottom: 0 }}>
                AI가 다듬은 결과입니다
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <textarea
                value={polishedContent}
                onChange={(e) => setPolishedContent(e.target.value)}
                placeholder="AI가 다듬은 내용을 자유롭게 수정할 수 있습니다..."
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '20px',
                  fontSize: 14,
                  lineHeight: 1.8,
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  color: '#333',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                }}
              />
              <p style={{ fontSize: 12, color: '#999', marginTop: 12, marginBottom: 0 }}>
                💡 AI가 생성한 내용을 자유롭게 수정하세요. "장미" → "민들레" 같은 수정도 가능합니다!
              </p>
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
