import { X, TestTube2, Wand2, Upload, Trash2, Plus, Camera, FileText } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getTestData } from '../data/testData';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { compressImage } from '../services/imageService';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { toast } from 'sonner';
import heic2any from 'heic2any';
import { LoadingOverlay } from './LoadingOverlay';
import { readOriginalImageMeta, type UploadedImageMeta } from '../services/photoMetadataService';
import {
  makeReadingBookId,
  normalizeBookField,
  buildReadingMetaCombined,
  READING_ENTRY_TYPES,
  READING_STATUS,
} from '../types/haruTypes';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '독서사유' | '텃밭일지' | '애완동물관찰일지' | '육아일기' | 'HARU주식관리' | '주식거래일지' | '메모' | 'HARU보조장부';
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

interface BookOcrResult {
  text?: string;
  usedCount?: number | null;
  limit?: number | null;
  remainingCount?: number | null;
  isDeveloper?: boolean;
}

interface StockOcrResult {
  text?: string;
  trade?: Partial<{
    stock_type: string;
    stock_name: string;
    stock_price: string;
    stock_quantity: string;
    stock_total: string;
    stock_date: string;
  }>;
}

type GrowthSubjectType = 'child' | 'garden';

type GrowthSubject = {
  id: string;
  subjectType: GrowthSubjectType;
  name: string;
  latestRecordDate?: string;
};

// 형식별 입력 필드 정의
const FORMAT_FIELDS: Record<RecordFormat, { key: string; label: string; placeholder: string; rows?: number }[]> = {
  일기: [
    { key: 'diary_오늘한일', label: '오늘한일', placeholder: '뒷산 산책로 끝까지 완주했음', rows: 2 },
    { key: 'diary_좋았던일', label: '좋았던일', placeholder: '낙엽소리가 기분전환에 도움이 되었음', rows: 3 },
    { key: 'diary_아쉬웠던일', label: '아쉬웠던일', placeholder: '이웃에게 인사 못 건넨 점이 아쉬웠음', rows: 3 },
    { key: 'diary_여백', label: '여백', placeholder: '내일은 천천히 걷고 싶음', rows: 2 },
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
  독서사유: [
    { key: 'reading_book_title', label: '책 제목', placeholder: '예: 노인과 바다', rows: 1 },
    { key: 'reading_author', label: '저자', placeholder: '예: 어니스트 헤밍웨이', rows: 1 },
    { key: 'reading_book_text', label: '본문 내용', placeholder: '사진으로 텍스트를 추출하거나 직접 입력하세요.', rows: 5 },
    { key: 'reading_journal', label: '독서장', placeholder: '노인은 오늘도 바다로 나갔다.\n혼자였지만 포기하지 않았다.\n큰 물고기와 끝까지 겨루었다.\n나는 그의 끈기를 오래 생각했다.\n나도 쉽게 물러서지 않겠다.', rows: 5 },
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
  'HARU주식관리': [
    { key: 'stock_type', label: '거래유형', placeholder: '예: 매수 / 매도', rows: 1 },
    { key: 'stock_name', label: '종목명', placeholder: '예: 삼성전자', rows: 1 },
    { key: 'stock_price', label: '거래단가', placeholder: '예: 227,500원', rows: 1 },
    { key: 'stock_quantity', label: '수량', placeholder: '예: 3주', rows: 1 },
    { key: 'stock_total', label: '거래금액', placeholder: '단가×수량 자동계산', rows: 1 },
    { key: 'stock_date', label: '거래일시', placeholder: '예: 2026.04.23 10:23', rows: 1 },
    { key: 'stock_reason', label: '거래 판단', placeholder: '매수·매도 이유, 진입/청산 기준, 리스크 판단', rows: 3 },
    { key: 'stock_reflection', label: '거래소감', placeholder: '거래 후 느낀 점, 잘한 점, 다음에 보완할 점', rows: 4 },
    { key: 'stock_capture_text', label: '캡처 원문', placeholder: '거래 캡처 이미지에서 추출된 텍스트가 들어갑니다.', rows: 4 },
    { key: 'stock_memo', label: '메모', placeholder: '추가로 기록할 내용', rows: 3 },
  ],
  '주식거래일지': [
    { key: 'stock_type', label: '거래유형', placeholder: '예: 매수 / 매도', rows: 1 },
    { key: 'stock_name', label: '종목명', placeholder: '예: 삼성전자', rows: 1 },
    { key: 'stock_price', label: '거래단가', placeholder: '예: 227,500원', rows: 1 },
    { key: 'stock_quantity', label: '수량', placeholder: '예: 3주', rows: 1 },
    { key: 'stock_total', label: '거래금액', placeholder: '예: 682,500원', rows: 1 },
    { key: 'stock_date', label: '거래일시', placeholder: '예: 2026.05.25 10:23', rows: 1 },
    { key: 'stock_reason', label: '거래 판단', placeholder: '매수·매도 이유, 진입/청산 기준, 리스크 판단', rows: 3 },
    { key: 'stock_reflection', label: '거래소감', placeholder: '거래 후 느낀 점, 잘한 점, 다음에 보완할 점', rows: 4 },
    { key: 'stock_capture_text', label: '캡처 원문', placeholder: '거래 캡처 이미지에서 추출된 텍스트가 들어갑니다.', rows: 4 },
    { key: 'stock_memo', label: '메모', placeholder: '추가로 기록할 내용', rows: 3 },
  ],
  'HARU보조장부': [
    { key: 'ledger_date', label: '거래일시', placeholder: '예: 2026.05.18 14:30', rows: 1 },
    { key: 'ledger_type', label: '거래종류', placeholder: '예: 수입 / 지출', rows: 1 },
    { key: 'ledger_item', label: '항목', placeholder: '예: 컨설팅 매출 / 사무실 임대료 / 식대', rows: 1 },
    { key: 'ledger_partner', label: '거래처', placeholder: '예: (주)민들레 / 김철수님', rows: 1 },
    { key: 'ledger_amount', label: '금액', placeholder: '예: 1,200,000원', rows: 1 },
    { key: 'ledger_payment', label: '결제수단', placeholder: '예: 계좌이체 / 신용카드 / 현금', rows: 1 },
    { key: 'ledger_proof', label: '증빙', placeholder: '예: 세금계산서 / 현금영수증 / 카드매출전표', rows: 1 },
    { key: 'ledger_memo', label: '업무 메모', placeholder: '관련 업무 흐름·특이사항을 자유롭게 작성하세요 (보조장부 — 세무 신고용 정식 장부 아님)', rows: 4 },
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
  '독서사유': 'reading',
  '텃밭일지': 'garden',
  '애완동물관찰일지': 'pet',
  '육아일기': 'child',
  'HARU주식관리': 'stock',
  '주식거래일지': 'stock',
  '메모': 'memo',
  'HARU보조장부': 'ledger',
};

// 기록 스타일 타입
type RecordStyle = 'simple' | 'premium';

const DIARY_PREMIUM_FIELDS = [
  { key: 'diary_오늘한일', label: '오늘한일' },
  { key: 'diary_좋았던일', label: '좋았던일' },
  { key: 'diary_아쉬웠던일', label: '아쉬웠던일' },
  { key: 'diary_여백', label: '여백' },
];

const DEVELOPER_UIDS = ['naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8'];
const READING_BOOK_OCR_LIMIT = 20;

export function FormatModal({ isOpen, onClose, format, recordId, initialData = {}, onSave }: FormatModalProps) {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [formData, setFormData] = useState<Record<string, string>>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishedContent, setPolishedContent] = useState('');
  const [showPolishModal, setShowPolishModal] = useState(false);
  const [sayuMode, setSayuMode] = useState<SayuMode>('PREMIUM');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [polishStats, setPolishStats] = useState<any>(null);
  
  // 사진 관련 state
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedImageMeta, setUploadedImageMeta] = useState<UploadedImageMeta[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingBookText, setIsExtractingBookText] = useState(false);
  const [readingOcrUsedCount, setReadingOcrUsedCount] = useState<number | null>(null);
  const [readingBookTextMode, setReadingBookTextMode] = useState<'photo' | 'manual'>('photo');
  const [selectedBookOcrFiles, setSelectedBookOcrFiles] = useState<File[]>([]);
  const bookOcrInputRef = useRef<HTMLInputElement>(null);
  const [selectedStockOcrFiles, setSelectedStockOcrFiles] = useState<File[]>([]);
  const [isExtractingStockText, setIsExtractingStockText] = useState(false);
  const stockOcrInputRef = useRef<HTMLInputElement>(null);

  // 📈 HARU주식관리: 카톡 TXT 내보내기 파싱 state
  const [isCsvParsing, setIsCsvParsing] = useState(false);
  type StockTrade = {
    stock_type: string;
    stock_name: string;
    stock_price: string;
    stock_quantity: string;
    stock_total: string;
    stock_date: string;
  };
  const [stockCandidates, setStockCandidates] = useState<StockTrade[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);

  // 기록 스타일 선택
  const [recordStyle, setRecordStyle] = useState<RecordStyle>('simple');
  const [recordStep, setRecordStep] = useState<'select' | 'input'>('select');

  // 🌱 텃밭일지 전용: 작물 목록 관리
  const [crops, setCrops] = useState<string[]>([]);
  const [newCropName, setNewCropName] = useState('');
  const [growthSubjects, setGrowthSubjects] = useState<GrowthSubject[]>([]);
  const [selectedGrowthSubjectId, setSelectedGrowthSubjectId] = useState('');
  const [newGrowthSubjectName, setNewGrowthSubjectName] = useState('');
  const [isReadingFinishing, setIsReadingFinishing] = useState(false);
  const [showReadingFinishModal, setShowReadingFinishModal] = useState(false);
  const [readingAnalysis, setReadingAnalysis] = useState('');
  const [readingReflectionAnswers, setReadingReflectionAnswers] = useState<Record<string, string>>({});
  const [readingEntriesSnapshot, setReadingEntriesSnapshot] = useState<string>('');
  // 📚 독서사유 — 책 묶음(readingId canonical, readingBookId legacy compatibility) 관리
  type KnownReadingBook = {
    readingBookId: string;
    bookTitle: string;
    author: string;
    hasFinalReflection: boolean;
    lastDate: string;
  };
  const [knownReadingBooks, setKnownReadingBooks] = useState<KnownReadingBook[]>([]);
  const [selectedExistingBookId, setSelectedExistingBookId] = useState<string>(''); // '' = 새 책
  const [isReadingBookLocked, setIsReadingBookLocked] = useState(false);
  const [blockedBookMessage, setBlockedBookMessage] = useState<string>('');
  const isDeveloper = !!user?.uid && DEVELOPER_UIDS.includes(user.uid);

  const readingReflectionQuestions = [
    '이 책은 나를 어떻게 변화시켰는가?',
    '나는 무엇을 반성하게 되었는가?',
    '내 삶과 연결된 부분은 무엇인가?',
    '앞으로 무엇을 실천하고 싶은가?',
    '미래의 내가 다시 읽는다면 어떤 의미가 남기를 원하는가?',
  ];

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setPolishedContent('');
      setShowPolishModal(false);
      setShowReadingFinishModal(false);
      setReadingAnalysis('');
      setReadingReflectionAnswers({});
      setReadingEntriesSnapshot('');
      setReadingBookTextMode('photo');
      setShowModeSelect(false);
      setReadingOcrUsedCount(null);

      const isStockFormat = format === 'HARU주식관리' || format === '주식거래일지';
      setRecordStyle(format === '독서사유' || isStockFormat ? 'premium' : 'simple');
      // 독서사유는 select 단계에서 "이어작성 / 새작성" 분기. 주식 형식은 input 직진.
      setRecordStep(isStockFormat ? 'input' : 'select');
      setStockCandidates([]);
      setShowCandidates(false);
      // 📚 독서사유 — 책 묶음 state 초기화 + 사용자 records 에서 책 목록 로드
      setKnownReadingBooks([]);
      setSelectedExistingBookId('');
      setIsReadingBookLocked(false);
      setBlockedBookMessage('');
      if (format === '독서사유' && user?.uid) {
        (async () => {
          try {
            const db = getFirestore();
            const ref = collection(db, 'users', user.uid, 'records');
            const q = query(ref, where('formats', 'array-contains', '독서사유'));
            const snap = await getDocs(q);
            const byBookId = new Map<string, KnownReadingBook>();
            snap.forEach((docSnap) => {
              const data = docSnap.data() as any;
              const title = String(data.bookTitle || data.reading_book_title || data.reading_title || '').trim();
              const author = String(data.author || data.reading_author || '').trim();
              if (!title) return;
              // TODO(HARU-v3): legacy compatibility 제거 예정.
              // 신규 구조(entryType/readingStatus/readingId) 기준으로 migration 계획.
              const bookId: string = data.readingId || data.readingBookId || makeReadingBookId(title, author);
              if (!bookId) return;
              const isFinal =
                String(data.entryType || '') === READING_ENTRY_TYPES.FINAL ||
                String(data.readingStatus || '') === READING_STATUS.COMPLETED ||
                String(data.readingEntryType || '') === READING_ENTRY_TYPES.LEGACY_FINAL ||
                String(data.reading_status || '') === 'completed';
              const date = String(data.date || '');
              const existing = byBookId.get(bookId);
              if (existing) {
                existing.hasFinalReflection = existing.hasFinalReflection || isFinal;
                if (date > existing.lastDate) existing.lastDate = date;
                // 더 최근 데이터의 저자/제목으로 갱신
                if (date === existing.lastDate || !existing.author) {
                  existing.bookTitle = title || existing.bookTitle;
                  existing.author = author || existing.author;
                }
              } else {
                byBookId.set(bookId, {
                  readingBookId: bookId,
                  bookTitle: title,
                  author,
                  hasFinalReflection: isFinal,
                  lastDate: date,
                });
              }
            });
            const list = Array.from(byBookId.values()).sort((a, b) =>
              b.lastDate.localeCompare(a.lastDate),
            );
            setKnownReadingBooks(list);
            // initialData에 책 정보가 있으면 자동으로 이어쓰기 모드 인식
            const initTitle = String((initialData as any)?.reading_book_title || '').trim();
            const initAuthor = String((initialData as any)?.reading_author || '').trim();
            if (initTitle && initAuthor) {
              const initId = makeReadingBookId(initTitle, initAuthor);
              const matched = list.find((b) => b.readingBookId === initId);
              if (matched && !matched.hasFinalReflection) {
                setSelectedExistingBookId(initId);
                setIsReadingBookLocked(true);
              } else if (matched && matched.hasFinalReflection) {
                setBlockedBookMessage('이미 마무리한 책입니다. 다시 읽는 기록은 새 독서사유로 시작해 주세요.');
              }
            }
          } catch (e) {
            console.warn('독서사유 책 목록 로드 실패:', e);
            setKnownReadingBooks([]);
          }
        })();
      }

      // 기존 이미지 불러오기
      const prefix = FORMAT_PREFIX[format];
      const imagesKey = `${prefix}_images`;
      const imageMetaKey = `${prefix}_imageMeta`;
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
      if (initialData[imageMetaKey]) {
        try {
          const parsedMeta = JSON.parse(initialData[imageMetaKey]);
          const arr = Array.isArray(parsedMeta) ? parsedMeta : [];
          setUploadedImageMeta(arr.filter((v: any) => typeof v?.url === 'string' && v.url.startsWith('http')));
        } catch {
          setUploadedImageMeta([]);
        }
      } else {
        setUploadedImageMeta([]);
      }

      // 🌱 텃밭일지: Firestore에서 작물 목록 불러오기
      if (format === '텃밭일지' && user?.uid) {
        (async () => {
          try {
            const db = getFirestore();
            const gardenRef = doc(db, 'users', user.uid, 'settings', 'garden');
            const snap = await getDoc(gardenRef);
            if (snap.exists()) {
              const data = snap.data();
              setCrops(Array.isArray(data.crops) ? data.crops : []);
            } else {
              setCrops([]);
            }
          } catch {
            setCrops([]);
          }
        })();
      }

      if ((format === '육아일기' || format === '텃밭일지') && user?.uid) {
        (async () => {
          try {
            const subjectType: GrowthSubjectType = format === '육아일기' ? 'child' : 'garden';
            const db = getFirestore();
            const subjectsRef = collection(db, 'users', user.uid, 'growthSubjects');
            const q = query(subjectsRef, where('subjectType', '==', subjectType));
            const snap = await getDocs(q);
            const subjects = snap.docs
              .map((docSnap) => {
                const data = docSnap.data() as any;
                return {
                  id: docSnap.id,
                  subjectType,
                  name: String(data.name || '').trim(),
                  latestRecordDate: String(data.latestRecordDate || ''),
                };
              })
              .filter((subject) => subject.name)
              .sort((a, b) => (b.latestRecordDate || '').localeCompare(a.latestRecordDate || ''));
            setGrowthSubjects(subjects);
            setSelectedGrowthSubjectId('');
            setNewGrowthSubjectName('');
          } catch (e) {
            console.warn('성장대상 목록 로드 실패:', e);
            setGrowthSubjects([]);
            setSelectedGrowthSubjectId('');
            setNewGrowthSubjectName('');
          }
        })();
      } else {
        setGrowthSubjects([]);
        setSelectedGrowthSubjectId('');
        setNewGrowthSubjectName('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const fields = FORMAT_FIELDS[format];
  const prefix = FORMAT_PREFIX[format];
  const sayuKey = `${prefix}_sayu`;
  const imagesKey = `${prefix}_images`;
  const imageMetaKey = `${prefix}_imageMeta`;
  const existingSayu = initialData[sayuKey];
  const isStockFormat = format === 'HARU주식관리' || format === '주식거래일지';

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const getUploadedImageMetaForSave = (urls = uploadedImages) => JSON.stringify(
    uploadedImageMeta.filter((meta) => urls.includes(meta.url))
  );

  const getGrowthSaveFields = () => {
    if (format !== '육아일기' && format !== '텃밭일지') return {};

    const subjectType: GrowthSubjectType = format === '육아일기' ? 'child' : 'garden';
    const selectedSubject = growthSubjects.find((subject) => subject.id === selectedGrowthSubjectId);
    const newName = newGrowthSubjectName.trim();
    const subjectName = newName || selectedSubject?.name || '';

    if (!subjectName) return {};

    return {
      _growthSubjectId: newName ? '' : selectedGrowthSubjectId,
      _growthSubjectType: subjectType,
      _growthSubjectName: subjectName,
    };
  };

  // 📈 HARU주식관리: 카톡 내보내기 TXT 파싱 (키움증권 체결통보)
  const handleKakaoTxtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCsvParsing(true);
    try {
      const text = await file.text();
      const trades: StockTrade[] = [];
      const blocks = text.split('[키움]체결통보');
      for (let i = 1; i < blocks.length; i++) {
        const lines = blocks[i].trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) continue;
        const stock_name = lines[0];
        const typeAndQty = lines[1];
        const priceStr = lines[2];
        const typeMatch = typeAndQty.match(/^(매수|매도)/);
        const qtyMatch = typeAndQty.match(/(\d+)주/);
        const priceMatch = priceStr.match(/평균단가([\d,]+)원/);
        if (!typeMatch || !qtyMatch || !priceMatch) continue;
        const stock_type = typeMatch[1];
        const qty = parseInt(qtyMatch[1]);
        const price = parseInt(priceMatch[1].replace(/,/g, ''));
        const total = qty * price;
        const prevText = blocks[i - 1];
        const dateMatch = prevText.match(/(\d{4}[.\-]\d{1,2}[.\-]\d{1,2}[^\n]*\d{2}:\d{2})/g);
        const stock_date = dateMatch ? dateMatch[dateMatch.length - 1].trim() : '';
        trades.push({
          stock_type,
          stock_name,
          stock_price: price.toLocaleString() + '원',
          stock_quantity: qty + '주',
          stock_total: total.toLocaleString() + '원',
          stock_date,
        });
      }
      if (trades.length === 0) {
        toast.error('키움증권 거래 내역을 찾을 수 없습니다.');
        return;
      }
      setStockCandidates(trades);

      // AI 자동 제목 생성
      const dates = trades.map(t => t.stock_date).filter(Boolean).sort();
      const from = dates[0]?.slice(0, 10) ?? '';
      const to = dates[dates.length - 1]?.slice(0, 10) ?? '';
      const buyCount = trades.filter(t => t.stock_type === '매수').length;
      const sellCount = trades.filter(t => t.stock_type === '매도').length;
      const autoTitle = `${from}${from && to && from !== to ? ` ~ ${to}` : ''} 매수${buyCount}건·매도${sellCount}건`;
      handleChange(`${prefix}_title`, autoTitle);

      toast.success(`${trades.length}건의 거래 내역을 찾았습니다.`);
    } catch (err) {
      console.error('카톡 TXT 파싱 오류:', err);
      toast.error('파일 읽기에 실패했습니다.');
    } finally {
      setIsCsvParsing(false);
      e.target.value = '';
    }
  };

  // 📈 거래 1건 선택 → 필드 자동 채움
  const handleSelectTrade = (trade: StockTrade) => {
    setFormData((prev) => ({
      ...prev,
      stock_type: trade.stock_type || prev.stock_type || '',
      stock_name: trade.stock_name || prev.stock_name || '',
      stock_price: trade.stock_price || prev.stock_price || '',
      stock_quantity: trade.stock_quantity || prev.stock_quantity || '',
      stock_total: trade.stock_total || prev.stock_total || '',
      stock_date: trade.stock_date || prev.stock_date || '',
    }));
    setShowCandidates(false);
    toast.success('선택한 거래가 입력되었습니다. 내용을 확인해주세요.');
  };

  // 📈 HARU주식관리: 파싱된 거래를 각각 개별 레코드로 저장
  const handleSaveAllTrades = async () => {
    if (stockCandidates.length === 0) {
      toast.error('먼저 파일을 업로드해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      let savedCount = 0;
      for (let i = 0; i < stockCandidates.length; i++) {
        const t = stockCandidates[i];
        const rawDate = t.stock_date?.replace(/[^0-9]/g, '') ?? '';
        const recordId = `stock_${rawDate || Date.now()}_${i}`;

        const dataToSave: Record<string, any> = {
          formats: [format],
          [`${prefix}_title`]: `${t.stock_name} ${t.stock_type} ${t.stock_quantity}`,
          stock_type: t.stock_type,
          stock_name: t.stock_name,
          stock_price: t.stock_price,
          stock_quantity: t.stock_quantity,
          stock_total: t.stock_total,
          stock_date: t.stock_date,
          [`${prefix}_style`]: 'simple',
          [`${prefix}_mode`]: 'ORIGINAL',
          [imagesKey]: JSON.stringify([]),
          [imageMetaKey]: JSON.stringify([]),
        };

        await onSave({ ...dataToSave, _recordId: recordId });
        savedCount++;
      }
      toast.success(`${savedCount}건의 거래가 각각 저장되었습니다!`);
      onClose();
    } catch (error) {
      console.error('주식 거래 저장 실패:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFillTestData = () => {
    const testData = getTestData(format);
    if (testData) {
      setFormData(testData);
    }
  };

  // 🌱 작물 추가
  const handleAddCrop = async () => {
    if (!newCropName.trim()) {
      toast.warning('작물 이름을 입력해주세요.');
      return;
    }
    if (crops.length >= 50) {
      toast.warning('최대 50개까지만 추가할 수 있습니다.');
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
      const db = getFirestore();
      const gardenRef = doc(db, 'users', user!.uid, 'settings', 'garden');
      await setDoc(gardenRef, { crops: updated }, { merge: true });
      toast.success(`${newCropName} 추가!`);
    } catch {
      toast.error('저장 실패');
    }
  };

  // 🌱 작물 삭제
  const handleRemoveCrop = async (cropToRemove: string) => {
    const updated = crops.filter(c => c !== cropToRemove);
    setCrops(updated);

    try {
      const db = getFirestore();
      const gardenRef = doc(db, 'users', user!.uid, 'settings', 'garden');
      await setDoc(gardenRef, { crops: updated }, { merge: true });
      toast.success(`${cropToRemove} 삭제!`);
    } catch {
      toast.error('저장 실패');
    }
  };

  const handleSubmit = async () => {
    if (recordStep === 'select') return;
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, ...getGrowthSaveFields() };
      if (format === '텃밭일지' && crops.length > 0) {
        dataToSave.garden_crop = crops.join(', ');
      }

      dataToSave[`${prefix}_style`] = recordStyle;
      dataToSave[imagesKey] = JSON.stringify(uploadedImages);
      dataToSave[imageMetaKey] = getUploadedImageMetaForSave();

      await onSave(dataToSave);
      toast.success('저장되었습니다!');
      onClose();

      // 백그라운드 AI 제목 추출
      try {
        const textForTitle = recordStyle === 'simple'
          ? (formData[`${prefix}_simple`] || '')
          : Object.keys(formData)
              .filter(k => k.startsWith(`${prefix}_`) && typeof formData[k] === 'string' && (formData[k] as string).trim())
              .map(k => formData[k] as string)
              .join(' ');
        if (textForTitle.trim().length > 5) {
          const functions = getFunctions(undefined, 'asia-northeast3');
          const extractTitleFn = httpsCallable(functions, 'extractTitle');
          extractTitleFn({ text: textForTitle, format });
        }
      } catch (e) {
        console.warn('AI 제목 추출 실패:', e);
      }
    } catch (error) {
      console.error('저장 중 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePolishClick = () => {
    const currentTitle = (formData[`${prefix}_title`] || (format === '독서사유' ? formData.reading_book_title : '') || (isStockFormat ? formData.stock_name : '') || '').trim();
    if (!currentTitle) {
      toast.warning('제목을 입력해 주세요. 제목이 있어야 나중에 목록에서 내용을 확인하기 편합니다.');
      return;
    }

    if (!isPremium) {
      alert('PREMIUM 구독 후 이용 가능한 기능입니다.');
      return;
    }
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

  const blobToBase64String = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        resolve(dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''));
      };
      reader.onerror = () => reject(new Error('FILE_READER_ERROR'));
      reader.readAsDataURL(blob);
    });
  };

  const prepareBookOcrImage = async (file: File): Promise<Blob> => {
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    let fileToProcess: File | Blob = file;
    if (isHeic) {
      toast.info('HEIC 파일을 기기 안에서 JPG로 변환 중...');
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      fileToProcess = Array.isArray(converted) ? converted[0] : converted;
    }

    const imageFile = fileToProcess instanceof File
      ? fileToProcess
      : new File([fileToProcess], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    return compressImage(imageFile, 1600, 0.9);
  };

  const clearBookOcrInput = () => {
    if (bookOcrInputRef.current) {
      bookOcrInputRef.current.value = '';
    }
  };

  const handleBookTextOcrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (format !== '독서사유') {
      clearBookOcrInput();
      return;
    }
    setSelectedBookOcrFiles(Array.from(files));
    toast.success(`${files.length}장의 책 본문 사진을 추가했습니다. 텍스트추출 버튼을 눌러주세요.`);
    clearBookOcrInput();
  };

  const handleExtractSelectedBookText = async () => {
    if (selectedBookOcrFiles.length === 0) {
      toast.warning('먼저 책 본문 사진을 추가해 주세요.');
      return;
    }
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!isPremium) {
      alert('PREMIUM 구독 후 이용 가능한 기능입니다.');
      return;
    }

    const bookTitle = String(formData.reading_book_title || '').trim();
    const author = String(formData.reading_author || '').trim();
    if (!bookTitle) {
      toast.warning('책 제목을 먼저 입력해 주세요.');
      return;
    }
    if (!author) {
      toast.warning('저자를 먼저 입력해 주세요.');
      return;
    }

    const allFiles = selectedBookOcrFiles;
    const remainingSlots = isDeveloper
      ? allFiles.length
      : Math.max(READING_BOOK_OCR_LIMIT - (readingOcrUsedCount ?? 0), 0);
    if (remainingSlots <= 0) {
      toast.warning('책 한 권당 본문 사진은 총 20장까지 변환할 수 있습니다.');
      return;
    }

    const filesToProcess = isDeveloper ? allFiles : allFiles.slice(0, remainingSlots);
    if (!isDeveloper && allFiles.length > filesToProcess.length) {
      toast.warning(`남은 변환 가능 사진 ${filesToProcess.length}장만 처리합니다.`);
    }

    setIsExtractingBookText(true);
    try {
      const functionsInstance = getFunctions(undefined, 'asia-northeast3');
      const extractBookTextFunc = httpsCallable(functionsInstance, 'extractReadingBookTextFromPhoto');
      const extractedTexts: string[] = [];
      let successCount = 0;

      for (const file of filesToProcess) {
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
          file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
        if (!file.type.startsWith('image/') && !isHeic) {
          toast.warning(`${file.name}은 이미지 파일이 아닙니다.`);
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast.warning(`${file.name}은 20MB를 초과하여 건너뜁니다.`);
          continue;
        }

        try {
          const compressed = await prepareBookOcrImage(file);
          const imageBase64 = await blobToBase64String(compressed);
          const result = await extractBookTextFunc({
            imageBase64,
            mimeType: 'image/jpeg',
            bookTitle,
            author,
          });
          const data = result.data as BookOcrResult;
          const extracted = String(data.text || '').trim();
          if (extracted) extractedTexts.push(extracted);
          if (typeof data.usedCount === 'number') setReadingOcrUsedCount(data.usedCount);
          successCount++;
        } catch (error: any) {
          const code = String(error?.code || '');
          const message = String(error?.message || '책 본문 텍스트 변환에 실패했습니다.');
          if (code.includes('resource-exhausted')) {
            toast.warning(message);
            break;
          }
          console.error('책 본문 OCR 실패:', error);
          toast.error(message);
        }
      }

      if (extractedTexts.length > 0) {
        setFormData((prev) => {
          const current = String(prev.reading_book_text || '').trim();
          const nextText = extractedTexts.join('\n\n').trim();
          const previousCount = Number(prev.reading_ocr_photo_count || 0);
          return {
            ...prev,
            reading_book_text: current ? `${current}\n\n${nextText}` : nextText,
            reading_ocr_photo_count: String(previousCount + successCount),
          };
        });
        setSelectedBookOcrFiles([]);
        toast.success(`${successCount}장의 책 본문을 텍스트로 변환했습니다.`);
      } else if (successCount > 0) {
        toast.warning('사진에서 읽을 수 있는 책 본문을 찾지 못했습니다.');
      }
    } finally {
      setIsExtractingBookText(false);
    }
  };

  const applyStockOcrResult = (data: StockOcrResult) => {
    const trade = data.trade || {};
    const extractedText = String(data.text || '').trim();
    setFormData((prev) => {
      const next: Record<string, string> = { ...prev };
      (['stock_type', 'stock_name', 'stock_price', 'stock_quantity', 'stock_total', 'stock_date'] as const).forEach((key) => {
        const value = String(trade[key] || '').trim();
        if (value && !String(next[key] || '').trim()) {
          next[key] = value;
        }
      });
      if (extractedText) {
        const current = String(next.stock_capture_text || '').trim();
        next.stock_capture_text = current ? `${current}\n\n${extractedText}` : extractedText;
      }
      if (!String(next.stock_title || '').trim()) {
        const titleParts = [next.stock_name, next.stock_type, next.stock_quantity].filter(Boolean);
        if (titleParts.length > 0) next.stock_title = titleParts.join(' ');
      }
      return next;
    });
  };

  const extractStockTextFromImage = async (imageBlob: Blob) => {
    if (!isStockFormat) return;
    const imageBase64 = await blobToBase64String(imageBlob);
    const functionsInstance = getFunctions(undefined, 'asia-northeast3');
    const extractStockTextFunc = httpsCallable(functionsInstance, 'extractStockTradeTextFromPhoto');
    const result = await extractStockTextFunc({
      imageBase64,
      mimeType: 'image/jpeg',
    });
    applyStockOcrResult(result.data as StockOcrResult);
  };

  const clearStockOcrInput = () => {
    if (stockOcrInputRef.current) {
      stockOcrInputRef.current.value = '';
    }
  };

  const handleStockOcrPhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!isStockFormat) {
      clearStockOcrInput();
      return;
    }

    const selected = Array.from(files).slice(0, 3);
    setSelectedStockOcrFiles(selected);
    toast.success(`${selected.length}장의 거래 캡처 사진을 추가했습니다. 텍스트추출 버튼을 눌러주세요.`);
    clearStockOcrInput();
  };

  const handleExtractSelectedStockText = async () => {
    if (!isStockFormat) return;
    if (selectedStockOcrFiles.length === 0) {
      toast.warning('먼저 거래 캡처 사진을 추가해 주세요.');
      return;
    }
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsExtractingStockText(true);
    let successCount = 0;
    try {
      for (const file of selectedStockOcrFiles) {
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
          file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
        if (!file.type.startsWith('image/') && !isHeic) {
          toast.warning(`${file.name}은 이미지 파일이 아닙니다.`);
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast.warning(`${file.name}은 20MB를 초과하여 건너뜁니다.`);
          continue;
        }

        try {
          const compressed = await prepareBookOcrImage(file);
          await extractStockTextFromImage(compressed);
          successCount++;
        } catch (ocrError: any) {
          console.error('주식 거래 캡처 OCR 실패:', ocrError);
          toast.warning(String(ocrError?.message || '거래 캡처 텍스트 추출에 실패했습니다.'));
        }
      }

      if (successCount > 0) {
        setSelectedStockOcrFiles([]);
        toast.success(`${successCount}장의 거래 캡처에서 텍스트를 추출했습니다.`);
      }
    } finally {
      setIsExtractingStockText(false);
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
      const newImageMeta: UploadedImageMeta[] = [];
      const functionsInstance = getFunctions(undefined, 'asia-northeast3');

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

        const originalMeta = await readOriginalImageMeta(file);

        // HEIC → JPG 변환 (Cloudinary convertHeic 임시 변환만 사용)
        let fileToProcess: File | Blob = file;
        if (isHeic) {
          try {
            toast.info('HEIC 파일을 변환 중...');

            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            const imageBase64 = btoa(binary);

            const convertHeicFunc = httpsCallable(functionsInstance, 'convertHeic');
            const result = await convertHeicFunc({ imageBase64 });
            const { url } = result.data as { url: string };

            // Cloudinary 임시 JPG URL → Blob (이후 Firebase Storage에 영구 저장)
            const response = await fetch(url);
            if (!response.ok) throw new Error('JPG 다운로드 실패');
            fileToProcess = await response.blob();
          } catch (err) {
            console.error('HEIC 변환 실패:', err);
            toast.error('HEIC 변환에 실패했습니다.');
            continue;
          }
        }

        // 이미지 압축 및 Firebase Storage 업로드 (메인 저장소)
        try {
          const imageFile =
            fileToProcess instanceof File
              ? fileToProcess
              : new File([fileToProcess], fileName, { type: 'image/jpeg' });
          const compressed = await compressImage(imageFile, 800, 0.85);

          const imagePath = `users/${user.uid}/format_photos/${recordId}_${prefix}_${fileName}`;
          const storageRef = ref(storage, imagePath);
          await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
          const downloadUrl = await getDownloadURL(storageRef);
          newImageUrls.push(downloadUrl);
          newImageMeta.push({
            ...originalMeta,
            url: downloadUrl,
            uploadedAt: new Date().toISOString(),
          });
          if (isStockFormat) {
            try {
              await extractStockTextFromImage(compressed);
            } catch (ocrError: any) {
              console.error('주식 거래 캡처 OCR 실패:', ocrError);
              toast.warning(String(ocrError?.message || '거래 캡처 텍스트 추출에 실패했습니다.'));
            }
          }
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
      setUploadedImageMeta(prev => [...prev, ...newImageMeta]);
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

  // Firebase Storage URL → 내부 경로 추출 (deleteObject 용)
  function getStoragePathFromDownloadUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const idx = u.pathname.indexOf('/o/');
      if (idx === -1) return null;
      const encodedPath = u.pathname.substring(idx + 3);
      return decodeURIComponent(encodedPath);
    } catch {
      return null;
    }
  }

  const handleDeleteImage = async (imageUrl: string, index: number) => {
    try {
      const isCloudinary = typeof imageUrl === 'string' && imageUrl.includes('cloudinary.com');

      if (isCloudinary) {
        // 과거 Cloudinary 업로드 호환 — Functions로 원본도 삭제
        const functionsInstance = getFunctions(undefined, 'asia-northeast3');
        const deleteRecordImage = httpsCallable(functionsInstance, 'deleteRecordImage');
        await deleteRecordImage({ imageUrl });
      } else {
        // Firebase Storage 표준 삭제
        const storage = getStorage();
        const path = imageUrl.startsWith('http') ? getStoragePathFromDownloadUrl(imageUrl) : imageUrl;
        if (!path) throw new Error('Invalid image URL');
        const imageRef = ref(storage, path);
        await deleteObject(imageRef);
      }

      setUploadedImages(prev => prev.filter((_, i) => i !== index));
      setUploadedImageMeta(prev => prev.filter((meta) => meta.url !== imageUrl));
      toast.success('사진이 삭제되었습니다.');
    } catch (error: any) {
      console.error('이미지 삭제 실패:', error);

      // 이미 사라졌거나 URL 판별 실패한 경우 — 화면에서는 제거 (양쪽 무시 패턴 통합)
      const code = error?.code || '';
      const msg = error?.message || '';
      const ignorable =
        code === 'storage/object-not-found' ||
        code === 'functions/not-found' ||
        code === 'functions/invalid-argument' ||
        msg.includes('not found') ||
        msg.includes('object-not-found') ||
        msg.includes('invalid-argument') ||
        msg.includes('이미 삭제');

      if (ignorable) {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
        setUploadedImageMeta(prev => prev.filter((meta) => meta.url !== imageUrl));
        toast.success('사진이 제거되었습니다.');
      } else {
        toast.error('사진 삭제에 실패했습니다.');
      }
    }
  };

  const handleSaveOriginalAsSayu = async () => {
    const currentTitle = (formData[`${prefix}_title`] || (format === '독서사유' ? formData.reading_book_title : '') || (isStockFormat ? formData.stock_name : '') || '').trim();
    if (!currentTitle) {
      toast.warning('제목을 입력해 주세요. 제목이 있어야 나중에 목록에서 내용을 확인하기 편합니다.');
      return;
    }

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
      ...getGrowthSaveFields(),
      [sayuKey]: originalContent,
      [imagesKey]: JSON.stringify(uploadedImages),
      [imageMetaKey]: getUploadedImageMetaForSave(),
      [`${prefix}_style`]: recordStyle,
      [`${prefix}_mode`]: 'ORIGINAL',
    };
    if (format === '독서사유' && !dataToSave[`${prefix}_title`] && formData.reading_book_title?.trim()) {
      dataToSave[`${prefix}_title`] = formData.reading_book_title.trim();
    }
    if (isStockFormat && !dataToSave[`${prefix}_title`] && formData.stock_name?.trim()) {
      dataToSave[`${prefix}_title`] = [formData.stock_name, formData.stock_type, formData.stock_quantity]
        .filter(Boolean)
        .join(' ')
        .trim();
    }

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
      ...getGrowthSaveFields(),
      [sayuKey]: polishedContent,
      [imagesKey]: JSON.stringify(uploadedImages),
      [imageMetaKey]: getUploadedImageMetaForSave(),
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

    // 사용자 입력 제목 포함
    if (formData[`${prefix}_title`]?.trim()) {
      updateData[`${prefix}_title`] = formData[`${prefix}_title`].trim();
    } else if (format === '독서사유' && formData.reading_book_title?.trim()) {
      updateData[`${prefix}_title`] = formData.reading_book_title.trim();
    } else if (isStockFormat && formData.stock_name?.trim()) {
      updateData[`${prefix}_title`] = [formData.stock_name, formData.stock_type, formData.stock_quantity]
        .filter(Boolean)
        .join(' ')
        .trim();
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

  const buildCurrentReadingEntry = () => {
    const labels: Record<string, string> = {
      reading_book_title: '책 제목',
      reading_author: '저자',
      reading_book_text: '본문 내용',
      reading_journal: '독서장',
    };
    return Object.entries(labels)
      .map(([key, label]) => {
        const value = formData[key];
        return typeof value === 'string' && value.trim() ? `${label}: ${value.trim()}` : '';
      })
      .filter(Boolean)
      .join('\n');
  };

  // 📚 독서사유 — 책 묶음 메타
  // canonical write(v2 strict): readingId / readingStatus / entryType / bookTitle / author / reading_started_at
  // legacy compatibility(read only after migration): readingBookId / readingEntryType / bookTitleNormalized / authorNormalized
  // TODO(HARU-v3): legacy compatibility 제거 예정.
  // 신규 구조(entryType/readingStatus/readingId) 기준으로 migration 계획.
  const buildReadingMeta = (
    entryType: 'chapter_note' | 'final_reflection',
  ): Record<string, any> => {
    if (format !== '독서사유') return {};
    const title = String(formData.reading_book_title || '').trim();
    const author = String(formData.reading_author || '').trim();
    if (!title) return {};
    const startedAt = String(formData.reading_started_at || '').trim();
    return buildReadingMetaCombined({
      bookTitle: title,
      author,
      entryType,
      startedAt: startedAt || undefined,
    });
  };

  // 📚 기존 책 선택 핸들러 — 책 제목/저자 자동 채움 + readonly + 마무리 책 차단
  const onSelectExistingBook = (bookId: string) => {
    if (!bookId) {
      setSelectedExistingBookId('');
      setIsReadingBookLocked(false);
      setBlockedBookMessage('');
      return;
    }
    const book = knownReadingBooks.find((b) => b.readingBookId === bookId);
    if (!book) return;
    if (book.hasFinalReflection) {
      setBlockedBookMessage('이미 마무리한 책입니다. 다시 읽는 기록은 새 독서사유로 시작해 주세요.');
      setSelectedExistingBookId('');
      setIsReadingBookLocked(false);
      return;
    }
    setSelectedExistingBookId(bookId);
    setIsReadingBookLocked(true);
    setBlockedBookMessage('');
    setFormData((prev) => ({
      ...prev,
      reading_book_title: book.bookTitle,
      reading_author: book.author,
    }));
  };

  // 📚 "새 책 시작" — 잠금 해제 + 책 제목/저자 비우기
  const onStartNewBook = () => {
    setSelectedExistingBookId('');
    setIsReadingBookLocked(false);
    setBlockedBookMessage('');
    setReadingBookTextMode('photo');
    setFormData((prev) => ({
      ...prev,
      reading_book_title: '',
      reading_author: '',
      reading_book_text: '',
      reading_journal: '',
    }));
  };

  // 📚 책 제목/저자 직접 수정 시 final_reflection 차단 자동 체크
  const checkFinalReflectionBlock = (title: string, author: string) => {
    if (!title.trim()) {
      setBlockedBookMessage('');
      return;
    }
    const bookId = makeReadingBookId(title, author);
    const book = knownReadingBooks.find((b) => b.readingBookId === bookId);
    if (book?.hasFinalReflection) {
      setBlockedBookMessage('이미 마무리한 책입니다. 다시 읽는 기록은 새 독서사유로 시작해 주세요.');
    } else {
      setBlockedBookMessage('');
    }
  };

  const handleReadingFinishClick = async () => {
    if (format !== '독서사유') return;
    const bookTitle = (formData.reading_book_title || formData[`${prefix}_title`] || '').trim();
    const bookAuthor = String(formData.reading_author || '').trim();
    if (!bookTitle) {
      toast.warning('책 제목을 먼저 입력해 주세요.');
      return;
    }
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    // 이미 마무리한 책이면 차단
    const currentBookId = makeReadingBookId(bookTitle, bookAuthor);
    const matched = knownReadingBooks.find((b) => b.readingBookId === currentBookId);
    if (matched?.hasFinalReflection) {
      toast.warning('이미 마무리한 책입니다. 새 독서사유로 시작해 주세요.');
      setBlockedBookMessage('이미 마무리한 책입니다. 다시 읽는 기록은 새 독서사유로 시작해 주세요.');
      return;
    }

    setIsReadingFinishing(true);
    try {
      const db = getFirestore();
      const recordsRef = collection(db, 'users', user.uid, 'records');
      const q = query(recordsRef, where('formats', 'array-contains', '독서사유'));
      const snap = await getDocs(q);
      const entries: Array<{ date: string; text: string }> = [];
      snap.forEach((recordSnap) => {
        const data = recordSnap.data() as Record<string, any>;
        // readingId(v2) → readingBookId(legacy) → fallback 계산 순으로 식별자 결정
        // TODO(HARU-v3): legacy compatibility 제거 예정.
        // 신규 구조(entryType/readingStatus/readingId) 기준으로 migration 계획.
        const savedBookId: string =
          data.readingId ||
          data.readingBookId ||
          makeReadingBookId(
            String(data.bookTitle || data.reading_book_title || data.reading_title || ''),
            String(data.author || data.reading_author || ''),
          );
        if (savedBookId !== currentBookId) return;
        // 현재는 운영 안정성을 위해 legacy OR 호환을 유지한다.
        // TODO(HARU-v3): legacy compatibility 제거 예정.
        // 신규 구조(entryType/readingStatus/readingId) 기준으로 migration 계획.
        // 독서마무리 수집은 향후 entryType === "readingNote"
        // 또는 readingEntryType === "chapter_note" 만 수집하도록 전환 예정.
        if (data.entryType === READING_ENTRY_TYPES.FINAL) return;
        if (data.readingEntryType === READING_ENTRY_TYPES.LEGACY_FINAL) return;
        const text = [
          data.reading_today_part ? `오늘 읽은 챕터: ${data.reading_today_part}` : '',
          data.reading_book_text ? `본문 내용: ${data.reading_book_text}` : '',
          data.reading_journal ? `독서장: ${data.reading_journal}` : '',
          data.reading_sentence ? `기억 문장: ${data.reading_sentence}` : '',
          data.reading_thought ? `떠오른 생각: ${data.reading_thought}` : '',
          data.reading_life_link ? `내 삶과 연결: ${data.reading_life_link}` : '',
          data.reading_space ? `여백: ${data.reading_space}` : '',
          data.reading_simple ? `간편 기록: ${data.reading_simple}` : '',
        ].filter(Boolean).join('\n');
        if (text.trim()) entries.push({ date: String(data.date || ''), text });
      });
      const currentEntry = buildCurrentReadingEntry();
      if (currentEntry.trim()) {
        entries.push({ date: new Date().toISOString().slice(0, 10), text: currentEntry });
      }
      if (entries.length === 0) {
        toast.warning('분석할 독서 기록이 없습니다.');
        return;
      }
      entries.sort((a, b) => a.date.localeCompare(b.date));
      const entriesText = entries
        .map((entry, index) => `[${index + 1}] ${entry.date || '날짜 없음'}\n${entry.text}`)
        .join('\n\n')
        .slice(0, 4300);

      const functions = getFunctions(undefined, 'asia-northeast3');
      const polishContentFunc = httpsCallable(functions, 'polishContent');
      const result = await polishContentFunc({
        text: `다음은 한 권의 책 "${bookTitle}"을 읽는 동안 남긴 독서사유 누적 기록입니다.
사용자가 쓰지 않은 사건, 감정, 판단을 추가하지 말고, 기록에 드러난 흐름만 차분히 분석하세요.
문체는 HARU SAYU처럼 절제되고 사실 기반이어야 합니다.

포함할 내용:
1. 독서 흐름 요약
2. 반복해서 드러난 관심과 생각
3. 사용자의 삶과 연결된 지점
4. 기록에서 확인되는 자기성찰과 변화
5. 장기 자산으로 남길 최종 독서사유

누적 기록:
${entriesText}`,
        format: 'reading',
        mode: 'PREMIUM',
      });
      const responseData = result.data as any;
      setReadingEntriesSnapshot(entriesText);
      setReadingAnalysis(responseData.text || '');
      setShowReadingFinishModal(true);
      toast.success('독서사유 마무리 분석이 준비되었습니다.');
    } catch (error) {
      console.error('독서사유 마무리 실패:', error);
      toast.error('독서사유 마무리 분석에 실패했습니다.');
    } finally {
      setIsReadingFinishing(false);
    }
  };

  // 📚 독서사유 — 중간기록저장하기 (polishContent 강도 6 자동 다듬기 + chapter_note 자동 저장)
  // 미리보기 모달 없이 자동 저장. polishContent 시그니처에 strength 가 없으므로 prompt 안에서 "강도 6 수준"을 지시.
  const handleSaveChapterNote = async () => {
    if (format !== '독서사유') return;
    const bookTitle = (formData.reading_book_title || '').trim();
    const bookAuthor = (formData.reading_author || '').trim();
    const startedAt = (formData.reading_started_at || new Date().toISOString().slice(0, 10)).trim();
    if (!bookTitle) {
      toast.warning('책 제목을 먼저 입력해 주세요.');
      return;
    }
    if (!bookAuthor) {
      toast.warning('저자를 입력해 주세요.');
      return;
    }
    // 마무리한 책 차단
    const currentBookId = makeReadingBookId(bookTitle, bookAuthor);
    const matched = knownReadingBooks.find((b) => b.readingBookId === currentBookId);
    if (matched?.hasFinalReflection) {
      toast.warning('이미 마무리한 책입니다. 새 독서사유로 시작해 주세요.');
      setBlockedBookMessage('이미 마무리한 책입니다. 다시 읽는 기록은 새 독서사유로 시작해 주세요.');
      return;
    }

    const contentValues = [
      formData.reading_book_text ? `본문 내용:\n${formData.reading_book_text}` : '',
      formData.reading_journal ? `독서장:\n${formData.reading_journal}` : '',
    ].filter((v) => typeof v === 'string' && v.trim()).join('\n\n');
    if (!contentValues.trim()) {
      toast.error('본문 내용이나 독서장을 한 줄이라도 작성해 주세요.');
      return;
    }

    setIsPolishing(true);
    toast.info('AI가 중간기록을 다듬는 중...');
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const polishContentFunc = httpsCallable(fns, 'polishContent');
      const result = await polishContentFunc({
        text: `다음은 "독서장" 형식으로 작성된 중간 독서기록입니다.
AI 다듬기 강도 6 수준(10단계 중 6)으로 다듬어 주세요 — 사실·인용은 원문 보존, 표현은 자연스럽게 정돈.

**절대 준수 사항:**
1. 말투는 "~다", "~했다", "~이다" 체.
2. 원문에 없는 사실·감정·해석을 추가하지 마세요. 책 인용 문장은 원문 그대로 보존.
3. 짧은 글이어도 강제로 늘리지 말 것. 한 줄이면 한 줄로 정돈.
4. 공백 제외 2500자 이내.

책: ${bookTitle}${bookAuthor ? ` / 저자: ${bookAuthor}` : ''}

${contentValues}`,
        format: 'reading',
        mode: 'PREMIUM',
      });
      const responseData = result.data as any;
      const polished = String(responseData?.text || '');
      const stats = responseData?.stats;

      const updateData: Record<string, any> = {
        ...formData,
        _recordId: `reading_note_${currentBookId}_${Date.now()}`,
        reading_started_at: formData.reading_started_at || startedAt,
        [imagesKey]: JSON.stringify(uploadedImages),
        [imageMetaKey]: getUploadedImageMetaForSave(),
        [`${prefix}_style`]: 'premium',
        [`${prefix}_mode`]: 'PREMIUM',
        [`${prefix}_sayu`]: polished,
        [`${prefix}_polished`]: true,
        [`${prefix}_polishedAt`]: new Date().toISOString(),
        [`${prefix}_note_createdAt`]: new Date().toISOString(),
        [`${prefix}_accumulation_mode`]: 'append',
        ...buildReadingMeta('chapter_note'),
      };
      if (stats) updateData[`${prefix}_stats`] = stats;
      if (bookTitle) updateData[`${prefix}_title`] = bookTitle;

      setIsSaving(true);
      await onSave(updateData);
      toast.success('📖 독서장이 누적 저장되었습니다.');
      onClose();
    } catch (error: any) {
      console.error('중간기록 저장 실패:', error);
      toast.error('중간기록 저장에 실패했습니다.');
    } finally {
      setIsPolishing(false);
      setIsSaving(false);
    }
  };

  const handleSaveReadingFinal = async () => {
    const answers = readingReflectionQuestions
      .map((question) => `${question}\n${(readingReflectionAnswers[question] || '').trim()}`)
      .join('\n\n');
    const finalSayu = `${readingAnalysis.trim()}\n\n[자기성찰 답변]\n${answers}`.trim();
    const updateData: Record<string, any> = {
      ...formData,
      [imagesKey]: JSON.stringify(uploadedImages),
      [imageMetaKey]: getUploadedImageMetaForSave(),
      [`${prefix}_style`]: recordStyle,
      [`${prefix}_mode`]: 'READING_FINAL',
      [`${prefix}_sayu`]: readingAnalysis,
      [`${prefix}_final_sayu`]: finalSayu,
      [`${prefix}_reflection_questions`]: JSON.stringify(readingReflectionQuestions),
      [`${prefix}_reflection_answers`]: JSON.stringify(readingReflectionAnswers),
      [`${prefix}_entries_snapshot`]: readingEntriesSnapshot,
      [`${prefix}_status`]: 'completed',
      [`${prefix}_completedAt`]: new Date().toISOString(),
      // 📚 책 묶음 메타 — final_reflection (책 1회 1개, 재추가 차단 기준)
      ...buildReadingMeta('final_reflection'),
    };
    if (formData.reading_book_title?.trim()) {
      updateData[`${prefix}_title`] = formData.reading_book_title.trim();
    }
    setIsSaving(true);
    try {
      await onSave(updateData);
      toast.success('최종 독서사유가 저장되었습니다.');
      setShowReadingFinishModal(false);
      onClose();
    } catch (error) {
      console.error('최종 독서사유 저장 실패:', error);
      toast.error('최종 저장에 실패했습니다.');
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
                {format === '독서사유' ? '독서장 작성' : `${format} 작성`}
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
          {/* Step 1 — 공통 선택 화면 (독서사유는 이어작성/새작성 분기) */}
          {recordStep === 'select' && format === '독서사유' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#1A3C6E', marginBottom: '4px' }}>
                📚 독서장을 어떻게 시작할까요?
              </p>
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                여러 책을 동시에 작성중 상태로 둘 수 있어요
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 24 }}>
                {/* 이어작성 카드 */}
                <div
                  onClick={() => {
                    if (knownReadingBooks.filter((b) => !b.hasFinalReflection).length === 0) {
                      toast.info('아직 작성중인 책이 없어요. "새작성"으로 시작해 보세요.');
                      return;
                    }
                    // select 단계 유지 — 아래 책 리스트에서 선택
                  }}
                  style={{
                    border: '1px solid #1A3C6E',
                    borderRadius: '12px',
                    padding: '20px 14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#EEF3FA',
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📖</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A3C6E', marginBottom: '4px' }}>이어작성</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>
                    작성중인 책 {knownReadingBooks.filter((b) => !b.hasFinalReflection).length}권
                  </div>
                </div>
                {/* 새작성 카드 */}
                <div
                  onClick={() => {
                    // 빈 폼으로 input 단계 진입
                    setSelectedExistingBookId('');
                    setIsReadingBookLocked(false);
                    setBlockedBookMessage('');
                    setFormData((prev) => ({
                      ...prev,
                      reading_book_title: '',
                      reading_author: '',
                      reading_started_at: new Date().toISOString().slice(0, 10),
                      reading_book_text: '',
                      reading_journal: '',
                    }));
                    setRecordStep('input');
                  }}
                  style={{
                    border: '1px solid #10b981',
                    borderRadius: '12px',
                    padding: '20px 14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#f0fdf8',
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>✨</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#047857', marginBottom: '4px' }}>새작성</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>
                    새 책으로 시작
                  </div>
                </div>
              </div>

              {/* 작성중인 책 리스트 — 클릭 시 이어쓰기 모드로 input 진입 */}
              {knownReadingBooks.filter((b) => !b.hasFinalReflection).length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
                    📖 작성중인 책 — 클릭하면 이어 쓸 수 있어요
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {knownReadingBooks
                      .filter((b) => !b.hasFinalReflection)
                      .map((b) => (
                        <button
                          key={b.readingBookId}
                          type="button"
                          onClick={() => {
                            onSelectExistingBook(b.readingBookId);
                            // initialData에 시작일이 없으면 기존 가장 오래된 record 기준 — 단순화로 lastDate 사용
                            setFormData((prev) => ({
                              ...prev,
                              reading_started_at: prev.reading_started_at || b.lastDate || '',
                            }));
                            setRecordStep('input');
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                            padding: '12px 14px',
                            border: '1px solid #d0dff0', borderRadius: 10,
                            backgroundColor: '#fff', color: '#1A3C6E',
                            cursor: 'pointer', textAlign: 'left',
                            fontWeight: 600, fontSize: 13,
                          }}
                          title={b.author ? `${b.bookTitle} — ${b.author}` : b.bookTitle}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📖 {b.bookTitle}
                            </span>
                            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginTop: 2 }}>
                              {b.author || '(저자 미기재)'}{b.lastDate ? ` · 마지막 ${b.lastDate}` : ''}
                            </span>
                          </span>
                          <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700, flexShrink: 0 }}>작성중 ▶</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
              {knownReadingBooks.filter((b) => b.hasFinalReflection).length > 0 && (
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0', textAlign: 'center' }}>
                  ✅ 마무리한 책 {knownReadingBooks.filter((b) => b.hasFinalReflection).length}권은 SAYU → "내가 읽은 책"에서 볼 수 있어요.
                </p>
              )}
            </div>
          )}

          {/* Step 1 — 기존 형식 (간편/프리미엄) */}
          {recordStep === 'select' && format !== '독서사유' && (
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
                {format !== '독서사유' && (
                  <button
                    onClick={() => setRecordStep('select')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', padding: 0 }}
                  >
                    ← 방식 다시 선택
                  </button>
                )}
                <span style={{
                  display: 'inline-block', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500,
                  background: recordStyle === 'simple' ? '#dcfce7' : '#dbeafe',
                  color: recordStyle === 'simple' ? '#166534' : '#1e3a8a',
                }}>
                  {format === '독서사유' ? '📚 진행형 독서 기록' : recordStyle === 'simple' ? '✏️ 간편 기록' : '📋 프리미엄 기록'}
                </span>
              </div>

              {/* 제목 입력 필드 — 독서사유는 reading_book_title 이 제목 역할이므로 숨김 */}
              {format !== 'HARU주식관리' && format !== '독서사유' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6, fontWeight: 600 }}>
                    📌 제목 <span style={{ color: '#ef4444', fontSize: 11 }}>*필수</span>
                  </label>
                  <input
                    type="text"
                    value={formData[`${prefix}_title`] || ''}
                    onChange={(e) => handleChange(`${prefix}_title`, e.target.value)}
                    placeholder="제목을 입력해 주세요 (예: 오늘의 산책)"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 14px', fontSize: 16,
                      border: '1px solid #d0dff0', borderRadius: 8,
                      backgroundColor: '#fff', color: '#333',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* 📚 독서사유 — 새 책 / 기존 책 이어쓰기 선택 UI */}
              {format === '독서사유' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 600 }}>
                    📚 어떤 책의 기록인가요?
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={onStartNewBook}
                      style={{
                        padding: '8px 14px', fontSize: 13, fontWeight: 600,
                        border: selectedExistingBookId ? '1px solid #d0dff0' : '1.5px solid #10b981',
                        borderRadius: 8,
                        backgroundColor: selectedExistingBookId ? '#fff' : '#ecfdf5',
                        color: selectedExistingBookId ? '#1A3C6E' : '#047857',
                        cursor: 'pointer',
                      }}
                    >
                      + 새 책 시작
                    </button>
                    {knownReadingBooks
                      .filter((b) => !b.hasFinalReflection)
                      .slice(0, 8)
                      .map((b) => (
                        <button
                          key={b.readingBookId}
                          type="button"
                          onClick={() => onSelectExistingBook(b.readingBookId)}
                          title={b.author ? `${b.bookTitle} — ${b.author}` : b.bookTitle}
                          style={{
                            padding: '8px 14px', fontSize: 13, fontWeight: 500,
                            border: selectedExistingBookId === b.readingBookId ? '1.5px solid #1A3C6E' : '1px solid #d0dff0',
                            borderRadius: 8,
                            backgroundColor: selectedExistingBookId === b.readingBookId ? '#dbeafe' : '#fff',
                            color: '#1A3C6E',
                            cursor: 'pointer',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          📖 {b.bookTitle}
                        </button>
                      ))}
                  </div>
                  {knownReadingBooks.filter((b) => b.hasFinalReflection).length > 0 && (
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
                      ✅ 마무리한 책 {knownReadingBooks.filter((b) => b.hasFinalReflection).length}권은 SAYU → "내가 읽은 책"에서 볼 수 있습니다.
                    </p>
                  )}
                  {blockedBookMessage && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FCA5A5',
                        color: '#7F1D1D',
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      ⚠️ {blockedBookMessage}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      border: '1px solid #d0dff0',
                      borderRadius: 10,
                      backgroundColor: '#f8fbff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A3C6E', fontWeight: 700 }}>
                        <FileText style={{ width: 15, height: 15 }} />
                        본문 내용
                      </label>
                      <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {isDeveloper
                          ? '개발자 무제한'
                          : readingOcrUsedCount === null
                            ? `구독자 책 1권당 ${READING_BOOK_OCR_LIMIT}장`
                            : `${readingOcrUsedCount}/${READING_BOOK_OCR_LIMIT}장`}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={() => setReadingBookTextMode('photo')}
                        style={{
                          minHeight: 38,
                          borderRadius: 8,
                          border: readingBookTextMode === 'photo' ? '1.5px solid #1A3C6E' : '1px solid #d0dff0',
                          backgroundColor: readingBookTextMode === 'photo' ? '#dbeafe' : '#fff',
                          color: '#1A3C6E',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        사진으로 추출
                      </button>
                      <button
                        type="button"
                        onClick={() => setReadingBookTextMode('manual')}
                        style={{
                          minHeight: 38,
                          borderRadius: 8,
                          border: readingBookTextMode === 'manual' ? '1.5px solid #1A3C6E' : '1px solid #d0dff0',
                          backgroundColor: readingBookTextMode === 'manual' ? '#dbeafe' : '#fff',
                          color: '#1A3C6E',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        직접 입력
                      </button>
                    </div>
                    {readingBookTextMode === 'photo' && (
                      <>
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                          책 페이지를 촬영해 추가하면 텍스트만 남습니다. 사진 원본은 저장하지 않습니다.
                        </p>
                        <input
                          ref={bookOcrInputRef}
                          type="file"
                          accept="image/*,.heic,.heif"
                          multiple
                          onChange={handleBookTextOcrUpload}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!isPremium) {
                              alert('PREMIUM 구독 후 이용 가능한 기능입니다.');
                              return;
                            }
                            bookOcrInputRef.current?.click();
                          }}
                          disabled={isExtractingBookText || (!isDeveloper && readingOcrUsedCount !== null && readingOcrUsedCount >= READING_BOOK_OCR_LIMIT)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            border: '1px dashed #1A3C6E',
                            borderRadius: 8,
                            backgroundColor: '#fff',
                            color: '#1A3C6E',
                            cursor: isExtractingBookText ? 'wait' : 'pointer',
                            opacity: isExtractingBookText || (!isDeveloper && readingOcrUsedCount !== null && readingOcrUsedCount >= READING_BOOK_OCR_LIMIT) ? 0.55 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          <Camera style={{ width: 16, height: 16 }} />
                          책 본문 사진 추가
                          {selectedBookOcrFiles.length > 0 ? ` (${selectedBookOcrFiles.length}장)` : ''}
                        </button>
                        {selectedBookOcrFiles.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExtractSelectedBookText}
                            disabled={isExtractingBookText}
                            style={{
                              width: '100%',
                              marginTop: 8,
                              padding: '10px 14px',
                              border: 'none',
                              borderRadius: 8,
                              backgroundColor: '#1A3C6E',
                              color: '#fff',
                              cursor: isExtractingBookText ? 'wait' : 'pointer',
                              opacity: isExtractingBookText ? 0.6 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              fontSize: 13,
                              fontWeight: 800,
                            }}
                          >
                            <FileText style={{ width: 16, height: 16 }} />
                            {isExtractingBookText ? '텍스트추출 중...' : '텍스트추출'}
                          </button>
                        )}
                      </>
                    )}
                    <textarea
                      value={formData.reading_book_text || ''}
                      onChange={(e) => handleChange('reading_book_text', e.target.value)}
                      placeholder={readingBookTextMode === 'photo'
                        ? '사진에서 추출된 본문 텍스트가 여기에 들어옵니다.'
                        : '읽은 본문 내용을 직접 입력하세요.'}
                      rows={5}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        marginTop: 10,
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '1px solid #d0dff0',
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        color: '#333',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

              {(format === '육아일기' || format === '텃밭일지') && (
                <div
                  style={{
                    padding: 12,
                    border: '1px solid #d0dff0',
                    borderRadius: 10,
                    backgroundColor: '#f8fbff',
                  }}
                >
                  <label style={{ display: 'block', fontSize: 13, color: '#1A3C6E', marginBottom: 8, fontWeight: 700 }}>
                    성장대상
                  </label>
                  <select
                    value={selectedGrowthSubjectId}
                    onChange={(e) => {
                      setSelectedGrowthSubjectId(e.target.value);
                      if (e.target.value) setNewGrowthSubjectName('');
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      fontSize: 14,
                      border: '1px solid #d0dff0',
                      borderRadius: 8,
                      backgroundColor: '#fff',
                      color: '#333',
                      marginBottom: 8,
                      outline: 'none',
                    }}
                  >
                    <option value="">기존 대상 선택</option>
                    {growthSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newGrowthSubjectName}
                    onChange={(e) => {
                      setNewGrowthSubjectName(e.target.value);
                      if (e.target.value.trim()) setSelectedGrowthSubjectId('');
                    }}
                    placeholder={format === '육아일기' ? '새 대상 추가: 아이 이름 또는 별칭' : '새 대상 추가: 작물명 또는 식물명'}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      fontSize: 14,
                      border: '1px solid #d0dff0',
                      borderRadius: 8,
                      backgroundColor: '#fff',
                      color: '#333',
                      outline: 'none',
                    }}
                  />
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    {format === '육아일기'
                      ? '아이의 성장기록으로 함께 저장됩니다.'
                      : '작물의 성장과정으로 함께 저장됩니다.'}
                  </p>
                </div>
              )}

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

              {/* 간편 스타일: 자유 텍스트 1개 */}
              {recordStyle === 'simple' && !isStockFormat && (
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
              {recordStyle === 'premium' && !isStockFormat && (
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
                    : fields
                      .filter((field) => !(format === '독서사유' && field.key === 'reading_book_text'))
                      .map((field) => {
                        // 📚 독서사유 — 이어쓰기 모드면 책 제목·저자 readonly
                        const isReadingBookField =
                          format === '독서사유' &&
                          (field.key === 'reading_book_title' || field.key === 'reading_author');
                        const isLocked = isReadingBookField && isReadingBookLocked;
                        return (
                          <div key={field.key}>
                            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 500 }}>
                              {field.label}
                              {isLocked && (
                                <span style={{ marginLeft: 8, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                                  · 이어쓰기 모드 (잠금)
                                </span>
                              )}
                            </label>
                            <textarea
                              value={formData[field.key] || ''}
                              onChange={(e) => {
                                handleChange(field.key, e.target.value);
                                if (isReadingBookField) {
                                  checkFinalReflectionBlock(
                                    field.key === 'reading_book_title' ? e.target.value : (formData.reading_book_title || ''),
                                    field.key === 'reading_author' ? e.target.value : (formData.reading_author || ''),
                                  );
                                }
                              }}
                              placeholder={field.placeholder}
                              rows={field.rows || 4}
                              readOnly={isLocked}
                              style={{
                                width: '100%', padding: '12px 16px', fontSize: 14,
                                border: '1px solid #e5e5e5', borderRadius: 8,
                                backgroundColor: isLocked ? '#f3f4f6' : '#fff',
                                color: isLocked ? '#6b7280' : '#333',
                                resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                              }}
                            />
                          </div>
                        );
                      })
                  }
                </>
              )}

              {isStockFormat && (
                <>
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
                        style={{
                          width: '100%', padding: '12px 16px', fontSize: 14,
                          border: '1px solid #e5e5e5', borderRadius: 8,
                          backgroundColor: '#fff', color: '#333',
                          resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </>
              )}

              {/* 📈 주식 형식 전용: 카톡 내보내기 파일 업로드 */}
              {isStockFormat && (
                <div style={{ padding: '8px 0' }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: '#6B7280',
                      marginBottom: 12,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {'카카오톡 → 키움증권 채팅방 → 메뉴 →\n대화 내용 내보내기 → 파일 업로드'}
                  </p>
                  <label
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '14px',
                      background: '#1A3C6E',
                      color: '#fff',
                      borderRadius: 8,
                      fontSize: 15,
                      textAlign: 'center',
                      cursor: isCsvParsing ? 'not-allowed' : 'pointer',
                      opacity: isCsvParsing ? 0.6 : 1,
                      boxSizing: 'border-box',
                    }}
                  >
                    {isCsvParsing ? '⏳ 분석 중...' : '📂 카톡 내보내기 파일 업로드'}
                    <input
                      type="file"
                      accept=".txt,.csv"
                      style={{ display: 'none' }}
                      onChange={handleKakaoTxtUpload}
                      disabled={isCsvParsing}
                    />
                  </label>
                  {stockCandidates.length > 0 && (
                    <p
                      style={{
                        fontSize: 13,
                        color: '#10b981',
                        marginTop: 10,
                        textAlign: 'center',
                      }}
                    >
                      ✅ {stockCandidates.length}건 분석 완료 — 저장 버튼을 눌러주세요
                    </p>
                  )}
                </div>
              )}

              {/* 📈 주식 형식 전용: 거래 캡처 사진 OCR — 사진 원본은 저장하지 않음 */}
              {isStockFormat && (
                <div
                  style={{
                    padding: 12,
                    border: '1px solid #d0dff0',
                    borderRadius: 10,
                    backgroundColor: '#f8fbff',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A3C6E', marginBottom: 8, fontWeight: 700 }}>
                    <Camera style={{ width: 15, height: 15 }} />
                    거래 캡처 사진 텍스트추출
                  </label>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    사진은 서버에 저장하지 않고, 추출된 텍스트만 캡처 원문 칸에 남습니다.
                  </p>
                  <input
                    ref={stockOcrInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    onChange={handleStockOcrPhotoSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: selectedStockOcrFiles.length > 0 ? '1fr 1fr' : '1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => stockOcrInputRef.current?.click()}
                      disabled={isExtractingStockText}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px dashed #1A3C6E',
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        color: '#1A3C6E',
                        cursor: isExtractingStockText ? 'wait' : 'pointer',
                        opacity: isExtractingStockText ? 0.55 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      <Upload style={{ width: 16, height: 16 }} />
                      사진 추가
                      {selectedStockOcrFiles.length > 0 ? ` (${selectedStockOcrFiles.length}장)` : ''}
                    </button>
                    {selectedStockOcrFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExtractSelectedStockText}
                        disabled={isExtractingStockText}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          borderRadius: 8,
                          backgroundColor: '#1A3C6E',
                          color: '#fff',
                          cursor: isExtractingStockText ? 'wait' : 'pointer',
                          opacity: isExtractingStockText ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        <FileText style={{ width: 16, height: 16 }} />
                        {isExtractingStockText ? '텍스트추출 중...' : '텍스트추출'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 📸 사진 업로드 섹션 — 독서사유 책본문 사진은 OCR 후 저장하지 않음 */}
              {format !== '독서사유' && !isStockFormat && (
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
              )}
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
            ) : isStockFormat ? (
              <div style={{ display: 'grid', gridTemplateColumns: stockCandidates.length > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
                {stockCandidates.length > 0 && (
                  <button
                    onClick={handleSaveAllTrades}
                    disabled={isSaving}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#1A3C6E',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 'bold',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? '저장 중...' : `파일 거래 저장 (${stockCandidates.length}건)`}
                  </button>
                )}
                <button
                  onClick={handleSaveOriginalAsSayu}
                  disabled={isSaving || isPolishing}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 'bold',
                    cursor: isSaving || isPolishing ? 'not-allowed' : 'pointer',
                    opacity: isSaving || isPolishing ? 0.7 : 1,
                  }}
                >
                  {isSaving ? '저장 중...' : '거래소감 저장'}
                </button>
              </div>
            ) : format === '독서사유' ? (
              // 📚 독서사유 — 두 버튼만 (지시서 [5]): 중간기록저장하기 / 독서마무리하기
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button
                  onClick={handleSaveChapterNote}
                  disabled={isPolishing || isSaving || isReadingFinishing}
                  style={{
                    padding: '12px 16px',
                    fontSize: 14,
                    border: 'none',
                    borderRadius: 8,
                    backgroundColor: '#10b981',
                    color: '#fff',
                    cursor: (isPolishing || isSaving || isReadingFinishing) ? 'not-allowed' : 'pointer',
                    opacity: (isPolishing || isSaving || isReadingFinishing) ? 0.7 : 1,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  title="기존 polishContent(강도 6 수준) 자동 다듬기 → chapter_note 로 저장"
                >
                  {isPolishing ? (
                    <>
                      <Wand2 className="animate-spin" style={{ width: 15, height: 15 }} />
                      다듬는 중...
                    </>
                  ) : (
                    <>📖 독서장 추가하기</>
                  )}
                </button>
                <button
                  onClick={handleReadingFinishClick}
                  disabled={isReadingFinishing || isSaving || isPolishing}
                  style={{
                    padding: '12px 16px',
                    fontSize: 14,
                    border: '1px solid #1A3C6E',
                    borderRadius: 8,
                    backgroundColor: '#1A3C6E',
                    color: '#FAF9F6',
                    cursor: (isReadingFinishing || isSaving || isPolishing) ? 'not-allowed' : 'pointer',
                    opacity: (isReadingFinishing || isSaving || isPolishing) ? 0.7 : 1,
                    fontWeight: 700,
                  }}
                  title="같은 책의 모든 chapter_note 를 모아 final_reflection 으로 마무리"
                >
                  {isReadingFinishing ? '분석 중...' : '✨ 독서마무리하기'}
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

      {/* 독서사유 최종 완료 모달 */}
      {showReadingFinishModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 20,
          }}
          onClick={() => setShowReadingFinishModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FAF9F6',
              borderRadius: 12,
              maxWidth: 760,
              width: '100%',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e5', backgroundColor: '#fff' }}>
              <h2 style={{ fontSize: 19, color: '#1A3C6E', fontWeight: 700, margin: 0 }}>
                📚 독서사유 마무리
              </h2>
              <p style={{ fontSize: 12, color: '#777', margin: '6px 0 0 0' }}>
                누적 기록을 바탕으로 만든 SAYU 분석과 자기성찰 질문입니다.
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 8, fontWeight: 600 }}>
                SAYU 분석
              </label>
              <textarea
                value={readingAnalysis}
                onChange={(e) => setReadingAnalysis(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 240,
                  padding: 16,
                  fontSize: 14,
                  lineHeight: 1.7,
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
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {readingReflectionQuestions.map((question) => (
                  <div key={question}>
                    <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6, fontWeight: 600 }}>
                      {question}
                    </label>
                    <textarea
                      rows={3}
                      value={readingReflectionAnswers[question] || ''}
                      onChange={(e) => setReadingReflectionAnswers((prev) => ({ ...prev, [question]: e.target.value }))}
                      placeholder="짧게 적어도 충분합니다."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: 14,
                        lineHeight: 1.6,
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
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: 10, backgroundColor: '#fff' }}>
              <button
                onClick={() => setShowReadingFinishModal(false)}
                style={{ padding: '10px 18px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#555', cursor: 'pointer' }}
              >
                닫기
              </button>
              <button
                onClick={handleSaveReadingFinal}
                disabled={isSaving}
                style={{ padding: '10px 22px', fontSize: 14, border: 'none', borderRadius: 8, background: '#1A3C6E', color: '#FAF9F6', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, fontWeight: 700 }}
              >
                {isSaving ? '저장 중...' : '최종 독서사유 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📋 주식 거래 후보 선택 모달 */}
      {showCandidates && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              width: '90%',
              maxWidth: 400,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 16, color: '#1A3C6E' }}>
              📋 거래 선택 ({stockCandidates.length}건 발견)
            </h3>
            {stockCandidates.map((trade, i) => (
              <button
                key={i}
                onClick={() => handleSelectTrade(trade)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px',
                  marginBottom: 8,
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: '#F9FAFB',
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#1A3C6E' }}>
                  {trade.stock_name || '(종목명 없음)'}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                  {[
                    trade.stock_type,
                    trade.stock_quantity,
                    trade.stock_price,
                    trade.stock_total ? `총 ${trade.stock_total}` : '',
                    trade.stock_date,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            ))}
            <button
              onClick={() => setShowCandidates(false)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: 4,
                border: '1px solid #D1D5DB',
                borderRadius: 8,
                cursor: 'pointer',
                background: '#fff',
                color: '#6B7280',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 사진 업로드 중 포도송이 오버레이 */}
      <LoadingOverlay
        visible={isUploading || isExtractingBookText || isExtractingStockText}
        message={
          isExtractingBookText
            ? '책 본문 텍스트 변환 중...'
            : isExtractingStockText
              ? '거래 캡처 텍스트 추출 중...'
              : '사진 업로드 중...'
        }
      />
    </>
  );
}
