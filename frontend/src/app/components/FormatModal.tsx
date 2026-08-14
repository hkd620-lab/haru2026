import { X, TestTube2, Wand2, Upload, Trash2, Plus, Camera, FileText, Pencil } from 'lucide-react';
import { useState, useEffect, useRef, Fragment } from 'react';
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
import { findGrowthLMS, type GrowthGender } from '../../data/growthLMS';
import { calcAgeInMonths, calcPercentile } from '../../utils/growthCalc';
import { GrowthChart } from '../../components/GrowthChart';
import {
  LEDGER_ASSET_TREATMENT_LABELS,
  LEDGER_EXPENSE_DEDUCTION_LABELS,
  LEDGER_XLSX_PROOF,
  LEDGER_HOMETAX_CHECK_LABELS,
  LEDGER_VAT_DEDUCTION_LABELS,
  LEDGER_VAT_TAX_TYPE_LABELS,
  adjustLedgerTaxFieldsForUsage,
  calculateVatIncludedAmounts,
  classifyLedgerPreviewRows,
  createLedgerEntry as newLedgerEntry,
  defaultLedgerAssetTreatment,
  defaultLedgerExpenseDeduction,
  defaultLedgerVatDeduction,
  hashLedgerImportKey,
  ledgerEntryAmount,
  normalizeLedgerAmount,
  normalizeLedgerDate,
  parseLedgerWorkbook,
  type LedgerAssetTreatment,
  type LedgerExpenseDeduction,
  type LedgerHometaxCheck,
  type LedgerEntry,
  type LedgerPeriodPreviewRow,
  type LedgerVatDeduction,
  type LedgerVatTaxType,
} from '../services/ledgerPeriodImport';
import {
  saveLedgerPeriodEntriesBatch,
} from '../services/ledgerPeriodSaveService';
import {
  parseKakaoBankWorkbook,
  groupKakaoRowsByMonth,
  getEarliestEntryDate,
  type KakaoXlsxMonthGroup,
  type KakaoXlsxPreviewRow,
} from '../services/householdKakaoImport';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '독서사유' | '텃밭일지' | '애완동물관찰일지' | '육아일기' | '성장기록' | 'HARU주식관리' | '주식거래일지' | '메모' | 'HARU보조장부' | 'HARU가계부' | '배뇨일지';
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

interface LedgerOcrFields {
  transactionAt?: string | null;
  type?: string | null;
  category?: string | null;
  partner?: string | null;
  amount?: string | number | null;
  paymentMethod?: string | null;
  proofType?: string | null;
  memo?: string | null;
}

interface LedgerOcrResult {
  rawText?: string;
  transactions?: LedgerOcrFields[];
  fields?: LedgerOcrFields;
  warnings?: string[];
}


// ===== HARU가계부 =====
const HOUSEHOLD_CATEGORIES = ['식비', '교통비', '통신비', '주거비', '공과금', '의료비', '교육비', '문화생활', '쇼핑', '구독료', '기타'] as const;
const INCOME_CATEGORIES = ['월급', '부수입', '용돈', '환급', '투자수익', '기타수입'] as const;
const HOUSEHOLD_PAYMENT_METHODS = ['현금', '체크카드', '신용카드', '계좌이체', '카카오페이', '네이버페이', '기타'] as const;

export interface HouseholdEntry {
  id: string;
  transactionType: '수입' | '지출' | '이체';
  category: string;
  date: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
  ocrSourceFile?: string;
  balanceAfter?: string; // 거래 후 잔액(카카오뱅크 임포트 전용) — 손입력 기록엔 없음
}

function newHouseholdEntry(overrides?: Partial<HouseholdEntry>): HouseholdEntry {
  return {
    id: Math.random().toString(36).slice(2, 9),
    transactionType: '지출',
    category: '',
    date: '',
    vendor: '',
    amount: '',
    paymentMethod: '',
    memo: '',
    ...overrides,
  };
}

function parseHouseholdAmount(value: string): number {
  const n = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

type GrowthSubjectType = 'child' | 'garden';

type GrowthSubject = {
  id: string;
  subjectType: GrowthSubjectType;
  name: string;
  birthdate?: string;
  gender?: GrowthGender;
  latestRecordDate?: string;
};

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

const toPositiveNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
  성장기록: [
    { key: 'growth_note', label: '기록 메모 (선택)', placeholder: '예: 건강검진에서 측정한 기록입니다.', rows: 2 },
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
    { key: 'ledger_type', label: '거래종류', placeholder: '', rows: 1 },
    { key: 'ledger_usageType', label: '사용구분', placeholder: '', rows: 1 },
    { key: 'ledger_category', label: '분류', placeholder: '', rows: 1 },
    { key: 'ledger_item', label: '항목', placeholder: '예: 컨설팅 매출 / 사무실 임대료 / 식대', rows: 1 },
    { key: 'ledger_partner', label: '거래처', placeholder: '예: (주)민들레 / 김철수님', rows: 1 },
    { key: 'ledger_amount', label: '금액', placeholder: '예: 1,200,000원', rows: 1 },
    { key: 'ledger_payment', label: '결제수단', placeholder: '예: 계좌이체 / 신용카드 / 현금', rows: 1 },
    { key: 'ledger_proof', label: '증빙', placeholder: '예: 세금계산서 / 현금영수증 / 카드매출전표', rows: 1 },
    { key: 'ledger_memo', label: '업무 메모', placeholder: '관련 업무 흐름·특이사항을 자유롭게 작성하세요 (보조장부 — 세무 신고용 정식 장부 아님)', rows: 4 },
  ],
  'HARU가계부': [],
  '배뇨일지': [],
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

// 형식별 제목 입력 예시 (placeholder) — 형식 성격에 맞게 차별화
const TITLE_EXAMPLE: Partial<Record<RecordFormat, string>> = {
  '일기': '예: 오늘 하루',
  '에세이': '예: 나이 든다는 것',
  '여행기록': '예: 제주 3일차, 성산일출봉',
  '텃밭일지': '예: 상추 모종 옮겨심기',
  '애완동물관찰일지': '예: 초코, 예방접종 맞은 날',
  '육아일기': '예: 첫 걸음마 뗀 날',
  '성장기록': '예: 백일 사진',
  '선교보고': '예: 3월 넷째 주 사역 보고',
  '일반보고': '예: 3월 매출 현황 보고',
  '업무일지': '예: 오늘 처리한 업무',
  '메모': '예: 장보기 목록',
  '주식거래일지': '예: 삼성전자 10주 매수',
  'HARU보조장부': '예: 3월 거래처 입출금 정리',
  'HARU가계부': '예: 3월 생활비 정리',
  '배뇨일지': '예: 2026-08-13 배뇨일지',
};

// 기록 스타일 타입
type RecordStyle = 'simple' | 'premium';
type LedgerInputMode = 'single' | 'period';
type LedgerBulkFields = Pick<LedgerEntry, 'transactionType' | 'businessTrack' | 'usageType' | 'category' | 'proofType' | 'vatTaxType' | 'vatDeduction' | 'hometaxCheck' | 'expenseDeduction' | 'assetTreatment'>;

interface LedgerPeriodResultState {
  totalCount: number;
  savedCount: number;
  excludedCount: number;
  alreadySavedCount: number;
  savedDateCount: number;
  failureCount: number;
  message?: string;
}

// ===== HARU보조장부 XLSX 작업 중 상태 자동 저장(sessionStorage draft) =====
const LEDGER_DRAFT_STORAGE_KEY = 'haru2026_ledger_draft';
const LEDGER_DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

interface LedgerDraftPayload {
  rows: LedgerPeriodPreviewRow[];
  year: number;
  savedAt: number;
}

function loadLedgerXlsxDraft(): LedgerDraftPayload | null {
  try {
    const raw = sessionStorage.getItem(LEDGER_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LedgerDraftPayload;
    if (!parsed || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    if (Date.now() - (parsed.savedAt || 0) > LEDGER_DRAFT_TTL_MS) {
      sessionStorage.removeItem(LEDGER_DRAFT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveLedgerXlsxDraft(rows: LedgerPeriodPreviewRow[], year: number) {
  try {
    if (rows.length === 0) {
      sessionStorage.removeItem(LEDGER_DRAFT_STORAGE_KEY);
      return;
    }
    const payload: LedgerDraftPayload = { rows, year, savedAt: Date.now() };
    sessionStorage.setItem(LEDGER_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage 용량 초과 등은 무시한다 — draft는 편의 기능이므로 저장 흐름을 막지 않는다.
  }
}

function clearLedgerXlsxDraft() {
  try {
    sessionStorage.removeItem(LEDGER_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const DIARY_PREMIUM_FIELDS = [
  { key: 'diary_오늘한일', label: '오늘한일' },
  { key: 'diary_좋았던일', label: '좋았던일' },
  { key: 'diary_아쉬웠던일', label: '아쉬웠던일' },
  { key: 'diary_여백', label: '여백' },
];

const DEVELOPER_UIDS = ['naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8'];
const READING_BOOK_OCR_LIMIT = 20;
const LEDGER_OCR_PREVIEW_FIELDS: { key: keyof LedgerOcrFields; label: string }[] = [
  { key: 'transactionAt', label: '거래일시' },
  { key: 'type', label: '거래종류' },
  { key: 'category', label: '항목' },
  { key: 'partner', label: '거래처' },
  { key: 'amount', label: '금액' },
  { key: 'paymentMethod', label: '결제수단' },
  { key: 'proofType', label: '증빙' },
  { key: 'memo', label: '메모' },
];

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
  const readingJournalRef = useRef<HTMLTextAreaElement>(null);
  const [selectedStockOcrFiles, setSelectedStockOcrFiles] = useState<File[]>([]);
  const [isExtractingStockText, setIsExtractingStockText] = useState(false);
  const stockOcrInputRef = useRef<HTMLInputElement>(null);
  const [selectedLedgerOcrFiles, setSelectedLedgerOcrFiles] = useState<File[]>([]);
  const [isExtractingLedgerText, setIsExtractingLedgerText] = useState(false);
  const [ledgerOcrResult, setLedgerOcrResult] = useState<LedgerOcrResult | null>(null);
  const [ledgerOcrPerFileResults, setLedgerOcrPerFileResults] = useState<{ fileName: string; rawText?: string; fields?: LedgerOcrFields; warnings?: string[] }[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([newLedgerEntry()]);
  const [ledgerInputMode, setLedgerInputMode] = useState<LedgerInputMode>('single');
  const ledgerOcrInputRef = useRef<HTMLInputElement>(null);
  const [ledgerXlsxPreviewRows, setLedgerXlsxPreviewRows] = useState<LedgerPeriodPreviewRow[]>([]);
  const [ledgerXlsxYear, setLedgerXlsxYear] = useState(new Date().getFullYear());
  const [isReadingLedgerXlsx, setIsReadingLedgerXlsx] = useState(false);
  const [isSavingLedgerXlsx, setIsSavingLedgerXlsx] = useState(false);
  const [expandedLedgerXlsxRowId, setExpandedLedgerXlsxRowId] = useState('');
  const [ledgerPeriodResult, setLedgerPeriodResult] = useState<LedgerPeriodResultState | null>(null);
  const [ledgerBulkFields, setLedgerBulkFields] = useState<LedgerBulkFields>({
    transactionType: '',
    businessTrack: '',
    usageType: '',
    category: '',
    proofType: '',
    vatTaxType: undefined,
    vatDeduction: undefined,
    hometaxCheck: undefined,
    expenseDeduction: undefined,
    assetTreatment: undefined,
  });
  const ledgerXlsxInputRef = useRef<HTMLInputElement>(null);
  const ledgerDraftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 📒 HARU가계부
  const [householdEntries, setHouseholdEntries] = useState<HouseholdEntry[]>([newHouseholdEntry()]);
  const [selectedHouseholdOcrFiles, setSelectedHouseholdOcrFiles] = useState<File[]>([]);
  const [isExtractingHouseholdText, setIsExtractingHouseholdText] = useState(false);
  const householdOcrInputRef = useRef<HTMLInputElement>(null);
  // 📒 HARU가계부 — 카카오뱅크 XLSX 불러오기
  const kakaoXlsxInputRef = useRef<HTMLInputElement>(null);
  const [selectedKakaoXlsxFile, setSelectedKakaoXlsxFile] = useState<File | null>(null);
  const [showKakaoPasswordPrompt, setShowKakaoPasswordPrompt] = useState(false);
  const [kakaoXlsxPassword, setKakaoXlsxPassword] = useState('');
  const [isDecryptingKakaoXlsx, setIsDecryptingKakaoXlsx] = useState(false);
  const [kakaoXlsxMonthGroups, setKakaoXlsxMonthGroups] = useState<KakaoXlsxMonthGroup[]>([]);
  const [isSavingKakaoXlsx, setIsSavingKakaoXlsx] = useState(false);

  // 🚿 배뇨일지
  const [voidingEntries, setVoidingEntries] = useState<import('../utils/voidingStats').VoidingEntry[]>([]);
  const [voidingBedtime, setVoidingBedtime] = useState('22:30');
  const [voidingWaketime, setVoidingWaketime] = useState('06:30');
  const [voidingAmountInput, setVoidingAmountInput] = useState('');
  const [editingVoidingId, setEditingVoidingId] = useState<string | null>(null);
  const [editingVoidingEntry, setEditingVoidingEntry] = useState<{ time: string; amountMl: string; symptom: string; note: string }>({ time: '', amountMl: '', symptom: '', note: '' });

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
  const [recordStyle, setRecordStyle] = useState<RecordStyle>(
    format === '독서사유' || format === 'HARU보조장부' ? 'premium' : 'simple',
  );
  const [recordStep, setRecordStep] = useState<'select' | 'input'>(
    format === 'HARU보조장부' ? 'input' : 'select',
  );

  // 🌱 텃밭일지 전용: 작물 목록 관리
  const [crops, setCrops] = useState<string[]>([]);
  const [newCropName, setNewCropName] = useState('');
  const [growthSubjects, setGrowthSubjects] = useState<GrowthSubject[]>([]);
  const [selectedGrowthSubjectId, setSelectedGrowthSubjectId] = useState('');
  const [newGrowthSubjectName, setNewGrowthSubjectName] = useState('');
  const [growthSubjectBirthdate, setGrowthSubjectBirthdate] = useState('');
  const [growthSubjectGender, setGrowthSubjectGender] = useState<GrowthGender | ''>('');
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
  type KnownReadingEntry = {
    id: string;
    date: string;
    noteCreatedAt: string;
    readingBookText: string;
    readingJournal: string;
    readingSayu: string;
  };
  const [knownReadingBooks, setKnownReadingBooks] = useState<KnownReadingBook[]>([]);
  const [readingEntriesByBook, setReadingEntriesByBook] = useState<Record<string, KnownReadingEntry[]>>({});
  const [selectedExistingBookId, setSelectedExistingBookId] = useState<string>(''); // '' = 새 책
  const [editingReadingEntryId, setEditingReadingEntryId] = useState<string>('');
  const [editingReadingEntryDate, setEditingReadingEntryDate] = useState<string>('');
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
      setFormData((format === '육아일기' || format === '성장기록') ? { ...initialData, child_measuredate: initialData.child_measuredate || getTodayInputValue() } : initialData);
      setGrowthSubjectBirthdate('');
      setGrowthSubjectGender('');
      setPolishedContent('');
      setShowPolishModal(false);
      setShowReadingFinishModal(false);
      setReadingAnalysis('');
      setReadingReflectionAnswers({});
      setReadingEntriesSnapshot('');
      setReadingBookTextMode('photo');
      setShowModeSelect(false);
      setReadingOcrUsedCount(null);
      setSelectedLedgerOcrFiles([]);
      setIsExtractingLedgerText(false);
      setLedgerOcrResult(null);
      setLedgerOcrPerFileResults([]);
      setLedgerInputMode('single');
      setLedgerXlsxPreviewRows([]);
      setLedgerXlsxYear(new Date().getFullYear());
      setIsReadingLedgerXlsx(false);
      setIsSavingLedgerXlsx(false);
      setExpandedLedgerXlsxRowId('');
      setLedgerPeriodResult(null);
      setLedgerBulkFields({
        transactionType: '',
        businessTrack: '',
        usageType: '',
        category: '',
        proofType: '',
        vatTaxType: undefined,
        vatDeduction: undefined,
        hometaxCheck: undefined,
        expenseDeduction: undefined,
        assetTreatment: undefined,
      });
      setSelectedHouseholdOcrFiles([]);
      setIsExtractingHouseholdText(false);
      setSelectedKakaoXlsxFile(null);
      setShowKakaoPasswordPrompt(false);
      setKakaoXlsxPassword('');
      setIsDecryptingKakaoXlsx(false);
      setKakaoXlsxMonthGroups([]);
      setIsSavingKakaoXlsx(false);

      const isStockFormat = format === 'HARU주식관리' || format === '주식거래일지';
      const isLedgerFormat = format === 'HARU보조장부';
      const isHouseholdFormat = format === 'HARU가계부';

      if (isLedgerFormat) {
        const stored = (initialData as any).ledger_entries;
        if (stored && typeof stored === 'string') {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setLedgerEntries(parsed.map((e: any) => newLedgerEntry({
                ...e,
                id: Math.random().toString(36).slice(2, 9),
              })));
            } else {
              setLedgerEntries([newLedgerEntry()]);
            }
          } catch {
            setLedgerEntries([newLedgerEntry()]);
          }
        } else if ((initialData as any).ledger_type || (initialData as any).ledger_amount) {
          setLedgerEntries([newLedgerEntry({
            transactionType: String((initialData as any).ledger_type || ''),
            usageType: String((initialData as any).ledger_usageType || '사업용'),
            category: String((initialData as any).ledger_category || (initialData as any).ledger_item || ''),
            date: String((initialData as any).ledger_date || ''),
            vendor: String((initialData as any).ledger_partner || ''),
            amount: String((initialData as any).ledger_amount || ''),
            paymentMethod: String((initialData as any).ledger_paymentMethod || (initialData as any).ledger_payment || ''),
            memo: String((initialData as any).ledger_memo || ''),
          })]);
        } else {
          setLedgerEntries([newLedgerEntry()]);
        }
      } else {
        setLedgerEntries([newLedgerEntry()]);
      }
      // HARU보조장부 XLSX 작업 중 상태(sessionStorage draft) 이어하기 확인
      if (isLedgerFormat) {
        const draft = loadLedgerXlsxDraft();
        if (draft) {
          const doneCount = draft.rows.filter((row) => row.entry.category).length;
          const resume = window.confirm(
            `이전에 작업하던 카드 명세서가 있습니다.\n이어서 작업하시겠습니까? (${draft.rows.length}건, 분류 지정 ${doneCount}건 완료)`,
          );
          if (resume) {
            setLedgerXlsxPreviewRows(draft.rows);
            setLedgerXlsxYear(draft.year);
            setLedgerInputMode('period');
          } else {
            clearLedgerXlsxDraft();
          }
        }
      }
      // 가계부 초기화
      if (isHouseholdFormat) {
        const stored = (initialData as any).household_entries;
        if (stored && typeof stored === 'string') {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHouseholdEntries(parsed.map((e: any) => newHouseholdEntry({ ...e })));
            } else {
              setHouseholdEntries([newHouseholdEntry()]);
            }
          } catch {
            setHouseholdEntries([newHouseholdEntry()]);
          }
        } else {
          setHouseholdEntries([newHouseholdEntry()]);
        }
      } else {
        setHouseholdEntries([newHouseholdEntry()]);
      }
      // 배뇨일지 초기화
      const isVoidingFormatInit = format === '배뇨일지';
      if (isVoidingFormatInit) {
        const storedEntries = (initialData as any).voiding_entries;
        if (storedEntries && typeof storedEntries === 'string') {
          try {
            const parsed = JSON.parse(storedEntries);
            setVoidingEntries(Array.isArray(parsed) ? parsed : []);
          } catch { setVoidingEntries([]); }
        } else {
          setVoidingEntries([]);
        }
        setVoidingBedtime(String((initialData as any).voiding_bedtime || '22:30'));
        setVoidingWaketime(String((initialData as any).voiding_waketime || '06:30'));
        setVoidingForm({ time: '', type: 'void', amountMl: '', symptom: '', note: '' });
      } else {
        setVoidingEntries([]);
      }
      setRecordStyle(format === '독서사유' || isStockFormat || isLedgerFormat || isHouseholdFormat || isVoidingFormatInit ? 'premium' : 'simple');
      // 독서사유는 select 단계에서 "이어작성 / 새작성" 분기. 주식/보조장부/가계부/배뇨일지 형식은 input 직진.
      setRecordStep(isStockFormat || isLedgerFormat || isHouseholdFormat || isVoidingFormatInit ? 'input' : 'select');
      setStockCandidates([]);
      setShowCandidates(false);
      // 📚 독서사유 — 책 묶음 state 초기화 + 사용자 records 에서 책 목록 로드
      setKnownReadingBooks([]);
      setReadingEntriesByBook({});
      setSelectedExistingBookId('');
      setEditingReadingEntryId('');
      setEditingReadingEntryDate('');
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
            const entriesByBookId = new Map<string, KnownReadingEntry[]>();
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
              if (!isFinal) {
                const entry: KnownReadingEntry = {
                  id: docSnap.id,
                  date,
                  noteCreatedAt: String(data.reading_note_createdAt || data.updatedAt || data.createdAt || ''),
                  readingBookText: String(data.reading_book_text || ''),
                  readingJournal: String(data.reading_journal || ''),
                  readingSayu: String(data.reading_sayu || ''),
                };
                if (entry.readingBookText.trim() || entry.readingJournal.trim() || entry.readingSayu.trim()) {
                  const entries = entriesByBookId.get(bookId) || [];
                  entries.push(entry);
                  entriesByBookId.set(bookId, entries);
                }
              }
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
            const entriesRecord: Record<string, KnownReadingEntry[]> = {};
            entriesByBookId.forEach((entries, bookId) => {
              entriesRecord[bookId] = entries.sort((a, b) =>
                a.date.localeCompare(b.date) ||
                a.noteCreatedAt.localeCompare(b.noteCreatedAt) ||
                a.id.localeCompare(b.id),
              );
            });
            setKnownReadingBooks(list);
            setReadingEntriesByBook(entriesRecord);
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
            setReadingEntriesByBook({});
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

      if ((format === '육아일기' || format === '텃밭일지' || format === '성장기록') && user?.uid) {
        (async () => {
          try {
            const subjectType: GrowthSubjectType = format === '텃밭일지' ? 'garden' : 'child';
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
                  birthdate: String(data.birthdate || data.growthSubjectBirthdate || ''),
                  gender: data.gender === 'M' || data.gender === 'F' ? data.gender : undefined,
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

  // HARU보조장부 XLSX 작업 중 상태 자동 저장 (분류/구분 변경마다 500ms debounce)
  useEffect(() => {
    if (!isOpen || format !== 'HARU보조장부') return;
    if (ledgerDraftSaveTimerRef.current) clearTimeout(ledgerDraftSaveTimerRef.current);
    ledgerDraftSaveTimerRef.current = setTimeout(() => {
      saveLedgerXlsxDraft(ledgerXlsxPreviewRows, ledgerXlsxYear);
    }, 500);
    return () => {
      if (ledgerDraftSaveTimerRef.current) clearTimeout(ledgerDraftSaveTimerRef.current);
    };
  }, [ledgerXlsxPreviewRows, ledgerXlsxYear, isOpen, format]);

  if (!isOpen) return null;

  const fields = FORMAT_FIELDS[format];
  const prefix = FORMAT_PREFIX[format];
  const sayuKey = `${prefix}_sayu`;
  const imagesKey = `${prefix}_images`;
  const imageMetaKey = `${prefix}_imageMeta`;
  const existingSayu = initialData[sayuKey];
  const isStockFormat = format === 'HARU주식관리' || format === '주식거래일지';
  const isLedgerFormat = format === 'HARU보조장부';
  const isHouseholdFormat = format === 'HARU가계부';
  const isVoidingFormat = format === '배뇨일지';
  const selectedGrowthSubject = growthSubjects.find((subject) => subject.id === selectedGrowthSubjectId);
  const effectiveGrowthSubjectBirthdate = selectedGrowthSubject?.birthdate || growthSubjectBirthdate;
  const effectiveGrowthSubjectGender = selectedGrowthSubject?.gender || growthSubjectGender;
  const childMeasuredate = formData.child_measuredate || getTodayInputValue();
  const childAgeMonths = effectiveGrowthSubjectBirthdate ? calcAgeInMonths(effectiveGrowthSubjectBirthdate, childMeasuredate) : null;
  const childHeightValue = toPositiveNumber(formData.child_height);
  const childWeightValue = toPositiveNumber(formData.child_weight);
  const childHeightLms = effectiveGrowthSubjectGender && childAgeMonths !== null && childHeightValue !== null
    ? findGrowthLMS('height', effectiveGrowthSubjectGender, childAgeMonths)
    : undefined;
  const childWeightLms = effectiveGrowthSubjectGender && childAgeMonths !== null && childWeightValue !== null
    ? findGrowthLMS('weight', effectiveGrowthSubjectGender, childAgeMonths)
    : undefined;
  const childHeightPercentile = childHeightValue !== null && childHeightLms
    ? calcPercentile(childHeightValue, childHeightLms.L, childHeightLms.M, childHeightLms.S)
    : null;
  const childWeightPercentile = childWeightValue !== null && childWeightLms
    ? calcPercentile(childWeightValue, childWeightLms.L, childWeightLms.M, childWeightLms.S)
    : null;
  const shouldShowGrowthResult = format === '성장기록' && childHeightPercentile !== null && childWeightPercentile !== null;
  const growthResultNeedsConsultation = [childHeightPercentile, childWeightPercentile]
    .filter((value): value is number => value !== null)
    .some((value) => value < 3 || value > 97);
  const growthStatusMessage = growthResultNeedsConsultation
    ? "전문의 상담을 권장합니다"
    : "또래 평균 범위에서 건강하게 자라고 있어요 👶";
  const formatGrowthPercentileMessage = (percentile: number) => {
    if (percentile === 50) {
      return { main: "또래 평균이에요", sub: "(딱 중간 수준)" };
    }
    if (percentile > 50) {
      return { main: "또래보다 큰 편이에요", sub: "(100명 중 상위 " + (100 - percentile) + "% 수준)" };
    }
    return { main: "또래보다 작은 편이에요", sub: "(100명 중 하위 " + percentile + "% 수준)" };
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const getUploadedImageMetaForSave = (urls = uploadedImages) => JSON.stringify(
    uploadedImageMeta.filter((meta) => urls.includes(meta.url))
  );

  const getGrowthSaveFields = () => {
    if (format !== '육아일기' && format !== '텃밭일지' && format !== '성장기록') return {};

    const subjectType: GrowthSubjectType = format === '텃밭일지' ? 'garden' : 'child';
    const selectedSubject = selectedGrowthSubject;
    const newName = newGrowthSubjectName.trim();
    const subjectName = newName || selectedSubject?.name || '';

    if (!subjectName) return {};

    return {
      _growthSubjectId: newName ? '' : selectedGrowthSubjectId,
      _growthSubjectType: subjectType,
      _growthSubjectName: subjectName,
      _sourceFormat: format,
      ...(format !== '텃밭일지' && effectiveGrowthSubjectBirthdate ? { _growthSubjectBirthdate: effectiveGrowthSubjectBirthdate } : {}),
      ...(format !== '텃밭일지' && effectiveGrowthSubjectGender ? { _growthSubjectGender: effectiveGrowthSubjectGender } : {}),
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
      if (format === '육아일기') {
        setSelectedGrowthSubjectId('');
        setNewGrowthSubjectName(String(testData.child_name || '').trim());
        setGrowthSubjectBirthdate(testData._growthSubjectBirthdate || '');
        setGrowthSubjectGender(testData._growthSubjectGender === 'M' || testData._growthSubjectGender === 'F' ? testData._growthSubjectGender : '');
      }
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

  // xlsx 등 non-image 파일용 — data URL prefix 파싱 없이 바이트를 직접 base64로 변환
  const arrayBufferToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
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

  const clearLedgerOcrInput = () => {
    if (ledgerOcrInputRef.current) {
      ledgerOcrInputRef.current.value = '';
    }
  };

  const handleLedgerOcrPhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!isLedgerFormat) {
      clearLedgerOcrInput();
      return;
    }

    const allFiles = Array.from(files);
    if (allFiles.length > 10) {
      toast.warning('HARU보조장부는 한 번에 최대 10장까지 첨부할 수 있습니다. 카드 사용내역이 많으면 여러 번 나누어 기록해 주세요.');
    }
    const selected: File[] = [];
    for (const file of allFiles.slice(0, 10)) {
      const lowerName = file.name.toLowerCase();
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
        lowerName.endsWith('.heic') || lowerName.endsWith('.heif');
      if (!file.type.startsWith('image/') && !isHeic) {
        toast.warning(`${file.name}은 이미지 파일이 아닙니다.`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.warning(`${file.name}은 20MB를 초과하여 건너뜁니다.`);
        continue;
      }
      selected.push(file);
    }

    setSelectedLedgerOcrFiles(selected);
    setLedgerOcrResult(null);
    if (selected.length > 0) {
      toast.success(`${selected.length}장의 장부 자료 사진을 추가했습니다. 텍스트 추출을 눌러주세요.`);
    }
    clearLedgerOcrInput();
  };

  const handleExtractSelectedLedgerText = async () => {
    if (!isLedgerFormat) return;
    if (selectedLedgerOcrFiles.length === 0) {
      toast.warning('먼저 영수증·통장 캡처 사진을 추가해 주세요.');
      return;
    }
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsExtractingLedgerText(true);
    try {
      const functionsInstance = getFunctions(undefined, 'asia-northeast3');
      const extractLedgerTextFunc = httpsCallable(functionsInstance, 'extractLedgerTextFromImage');
      const perFileResults: { fileName: string; rawText?: string; transactions?: LedgerOcrFields[]; fields?: LedgerOcrFields; warnings?: string[] }[] = [];

      for (const file of selectedLedgerOcrFiles) {
        let dataBase64: string;
        try {
          const compressed = await prepareBookOcrImage(file);
          dataBase64 = await blobToBase64String(compressed);
        } catch (imageError: any) {
          console.error('보조장부 OCR 이미지 준비 실패:', file.name, imageError);
          toast.warning(`${file.name} 사진을 읽지 못해 건너뜁니다.`);
          continue;
        }
        try {
          const result = await extractLedgerTextFunc({ images: [{ mimeType: 'image/jpeg', dataBase64 }] });
          const data = result.data as LedgerOcrResult;
          console.log(`[보조장부 OCR] ${file.name}:`, data);
          perFileResults.push({ fileName: file.name, rawText: data.rawText, transactions: data.transactions, fields: data.fields, warnings: data.warnings });
        } catch (callError: any) {
          console.error('보조장부 OCR 호출 실패:', file.name, callError);
          perFileResults.push({ fileName: file.name, warnings: ['추출에 실패했습니다.'] });
        }
      }

      if (perFileResults.length === 0) {
        toast.warning('추출할 수 있는 이미지가 없습니다.');
        return;
      }

      setLedgerOcrPerFileResults(perFileResults);

      // OCR 결과에서 ledgerEntries 자동 생성 — 파일 1장에서 다건 거래 분리 지원
      const generatedEntries: LedgerEntry[] = [];
      let totalDetected = 0;
      for (const item of perFileResults) {
        const txList = item.transactions && item.transactions.length > 0
          ? item.transactions
          : item.fields ? [item.fields] : [];
        totalDetected += txList.length;
        for (const tx of txList) {
          generatedEntries.push(newLedgerEntry({
            transactionType: tx.type === '수입' ? '수입' : '지출',
            usageType: '사업용',
            category: '기타',
            date: String(tx.transactionAt || '').trim(),
            vendor: String(tx.partner || '').trim(),
            amount: String(tx.amount || '').trim(),
            paymentMethod: String(tx.paymentMethod || '').trim(),
            memo: '',
            ocrSourceFile: item.fileName,
            ocrRawText: item.rawText,
            customCategory: '',
          }));
        }
      }
      if (generatedEntries.length > 0) {
        setLedgerEntries(generatedEntries);
      }

      // applyLedgerOcrResult 가 사용하는 combined result — 파일별 첫 non-null 값 우선
      const combinedFields: LedgerOcrFields = {};
      const fieldKeys: (keyof LedgerOcrFields)[] = ['transactionAt', 'type', 'category', 'partner', 'amount', 'paymentMethod', 'proofType', 'memo'];
      for (const key of fieldKeys) {
        for (const r of perFileResults) {
          const v = r.fields?.[key];
          if (v !== undefined && v !== null && String(v).trim()) {
            (combinedFields as any)[key] = v;
            break;
          }
        }
      }
      setLedgerOcrResult({ fields: combinedFields });

      if (totalDetected > 1) {
        toast.success(`거래 ${totalDetected}건이 감지되었습니다. 분류를 확인해 주세요.`);
      } else {
        toast.success('추출 결과가 준비되었습니다. 확인 후 입력칸에 반영해 주세요.');
      }
    } catch (error: any) {
      console.error('보조장부 OCR 실패:', error);
      toast.error(String(error?.message || '영수증·통장 캡처 텍스트 추출에 실패했습니다.'));
    } finally {
      setIsExtractingLedgerText(false);
    }
  };

  const applyLedgerOcrResult = () => {
    const fields = ledgerOcrResult?.fields || {};
    const pick = (value: unknown) => String(value ?? '').trim();
    const transactionAt = pick(fields.transactionAt);
    const type = pick(fields.type);
    const category = pick(fields.category);
    const partner = pick(fields.partner);
    const amount = pick(fields.amount);
    const paymentMethod = pick(fields.paymentMethod);
    const proofType = pick(fields.proofType);
    const memo = pick(fields.memo);

    if (![transactionAt, type, category, partner, amount, paymentMethod, proofType, memo].some(Boolean)) {
      toast.warning('반영할 추출 필드가 없습니다. 직접 입력해 주세요.');
      return;
    }

    setFormData((prev) => {
      const next: Record<string, string> = { ...prev };
      if (transactionAt) {
        next.ledger_transactionAt = transactionAt;
        next.ledger_date = transactionAt;
      }
      if (type) next.ledger_type = type;
      if (category) {
        next.ledger_category = category;
        next.ledger_item = category;
      }
      if (partner) next.ledger_partner = partner;
      if (amount) next.ledger_amount = amount;
      if (paymentMethod) {
        next.ledger_paymentMethod = paymentMethod;
        next.ledger_payment = paymentMethod;
      }
      if (proofType) {
        next.ledger_proofType = proofType;
        next.ledger_proof = proofType;
      }
      if (memo) next.ledger_memo = memo;
      return next;
    });
    setSelectedLedgerOcrFiles([]);
    setLedgerOcrResult(null);
    setLedgerOcrPerFileResults([]);
    toast.success('추출 결과를 보조장부 입력칸에 반영했습니다.');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const periodRow = ledgerInputMode === 'period'
      ? ledgerXlsxPreviewRows.find((row) => row.id === expandedLedgerXlsxRowId)
      : undefined;
    const currentImageUrls = periodRow?.entry.imageUrls || uploadedImages;
    const maxPhotos = format === 'HARU보조장부' ? 10 : 3;
    const remainingSlots = maxPhotos - currentImageUrls.length;
    if (remainingSlots <= 0) {
      toast.warning(`최대 ${maxPhotos}장까지만 업로드할 수 있습니다.`);
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

      if (periodRow) {
        updateLedgerPeriodEntry(periodRow.id, {
          ...periodRow.entry,
          imageUrls: [...currentImageUrls, ...newImageUrls],
          imageMeta: [...(periodRow.entry.imageMeta || []), ...newImageMeta],
        });
      } else {
        setUploadedImages(prev => [...prev, ...newImageUrls]);
        setUploadedImageMeta(prev => [...prev, ...newImageMeta]);
      }
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
    const periodRow = ledgerInputMode === 'period'
      ? ledgerXlsxPreviewRows.find((row) => row.id === expandedLedgerXlsxRowId)
      : undefined;
    const removeFromState = () => {
      if (periodRow) {
        updateLedgerPeriodEntry(periodRow.id, {
          ...periodRow.entry,
          imageUrls: (periodRow.entry.imageUrls || []).filter((_, imageIndex) => imageIndex !== index),
          imageMeta: (periodRow.entry.imageMeta || []).filter((meta) => meta.url !== imageUrl),
        });
      } else {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
        setUploadedImageMeta(prev => prev.filter((meta) => meta.url !== imageUrl));
      }
    };
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

      removeFromState();
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
        removeFromState();
        toast.success('사진이 제거되었습니다.');
      } else {
        toast.error('사진 삭제에 실패했습니다.');
      }
    }
  };

  const handleSaveLedgerEntries = async () => {
    if (ledgerEntries.length === 0) {
      toast.warning('거래 내역이 없습니다. 거래를 최소 1건 입력해 주세요.');
      return;
    }
    const emptyBusinessTrack = ledgerEntries.filter(e => !e.businessTrack).length;
    if (emptyBusinessTrack > 0) {
      toast.error('사업구분을 선택해주세요. (HARU2026 / 외부용역)');
      return;
    }
    const emptyAmounts = ledgerEntries.filter(e => !e.amount.trim()).length;
    const emptyVendors = ledgerEntries.filter(e => !e.vendor.trim()).length;
    if (emptyAmounts > 0 || emptyVendors > 0) {
      const parts: string[] = [];
      if (emptyAmounts > 0) parts.push(`금액 미입력 ${emptyAmounts}건`);
      if (emptyVendors > 0) parts.push(`거래처 미입력 ${emptyVendors}건`);
      const ok = window.confirm(`${parts.join(', ')}이 있습니다. 그래도 저장하시겠습니까?`);
      if (!ok) return;
    }
    const first = ledgerEntries[0];
    const autoTitle = [first.date, first.transactionType, first.vendor || 'HARU보조장부']
      .filter(Boolean).join(' · ') || 'HARU보조장부';
    const originalContent = ledgerEntries.map((e, i) => {
      const parts = [e.date, e.transactionType, e.usageType, e.category, e.vendor, e.amount, e.paymentMethod].filter(Boolean);
      const memoWithPrefix = e.category === '기타' && e.customCategory.trim()
        ? `[${e.customCategory.trim()}] ${e.memo}`
        : e.memo;
      const businessContextMemo = String(e.businessContextMemo || '').trim();
      return `[거래 ${i + 1}] ${parts.join(' · ')}${memoWithPrefix ? '\n메모: ' + memoWithPrefix : ''}${businessContextMemo ? '\n업무 관련성 메모: ' + businessContextMemo : ''}`;
    }).join('\n\n');
    const firstMemoWithPrefix = first.category === '기타' && first.customCategory.trim()
      ? `[${first.customCategory.trim()}] ${first.memo}`
      : first.memo;
    const dataToSave: Record<string, any> = {
      ...formData,
      [sayuKey]: originalContent,
      [imagesKey]: JSON.stringify(uploadedImages),
      [imageMetaKey]: getUploadedImageMetaForSave(),
      [`${prefix}_style`]: recordStyle,
      [`${prefix}_mode`]: 'ORIGINAL',
      [`${prefix}_title`]: autoTitle,
      ledger_type: first.transactionType,
      ledger_businessTrack: first.businessTrack,
      ledger_usageType: first.usageType,
      ledger_category: first.category,
      ledger_item: first.category,
      ledger_date: first.date,
      ledger_partner: first.vendor,
      ledger_amount: first.amount,
      ledger_payment: first.paymentMethod,
      ledger_paymentMethod: first.paymentMethod,
      ledger_proof: first.proofType || '',
      ledger_proofType: first.proofType || '',
      ledger_approvalNumber: first.approvalNumber || '',
      ledger_memo: firstMemoWithPrefix,
      ledger_entries: JSON.stringify(ledgerEntries),
    };
    setIsSaving(true);
    try {
      await onSave(dataToSave);
      toast.success(`보조장부 ${ledgerEntries.length}건이 저장되었습니다!`);

      // 허 대표님 계정만 구글 드라이브 자동 업로드 (비동기, 실패해도 저장은 완료)
      if (isDeveloper && uploadedImages.length > 0) {
        const functionsInstance = getFunctions(undefined, 'asia-northeast3');
        const uploadReceiptFn = httpsCallable(functionsInstance, 'uploadReceiptToDrive');
        uploadReceiptFn({
          imageUrls: uploadedImages,
          date: first.date || new Date().toISOString().substring(0, 10),
          merchant: first.vendor || '',
          category: first.category === '기타' && first.customCategory?.trim()
            ? first.customCategory.trim()
            : (first.category || ''),
          amount: first.amount || '',
        }).catch((e) => {
          console.error('구글 드라이브 업로드 실패:', e);
        });
      }

      onClose();
    } catch (error) {
      console.error('저장 중 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLedgerXlsxYearChange = (value: number) => {
    setLedgerXlsxYear(value);
    setLedgerPeriodResult(null);
    setLedgerXlsxPreviewRows((rows) => classifyLedgerPreviewRows(rows, value));
  };

  const handleLedgerXlsxSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const lowerFileName = file.name.toLowerCase();
    if (!lowerFileName.endsWith('.xlsx') && !lowerFileName.endsWith('.xls')) {
      setLedgerXlsxPreviewRows([]);
      toast.warning('현재는 XLS/XLSX 카드 명세서 파일만 가져올 수 있습니다.');
      return;
    }
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsReadingLedgerXlsx(true);
    setLedgerXlsxPreviewRows([]);
    setLedgerPeriodResult(null);
    setExpandedLedgerXlsxRowId('');
    try {
      const XLSX = await import('xlsx');
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      if (fileBytes.byteLength === 0) throw new Error('파일 내용이 비어 있습니다. iCloud에서 파일 다운로드를 완료한 뒤 다시 선택해 주세요');
      const workbook = XLSX.read(fileBytes, {
        type: 'array',
        cellDates: false,
        cellNF: false,
        cellStyles: false,
        cellText: false,
        dense: false,
        WTF: false,
      });
      const parseResult = parseLedgerWorkbook(workbook, XLSX, ledgerXlsxYear);
      if (parseResult.rows.length === 0) {
        toast.error(`거래 헤더 또는 거래 내역을 찾지 못했습니다. 시트 ${parseResult.scannedSheetCount}개·${parseResult.scannedRowCount}행에서 핵심 열 ${parseResult.maxHeaderScore}/4개를 찾았습니다. 국민카드 XLS/XLSX 형식인지 확인해 주세요.`);
        return;
      }
      const previewRows = classifyLedgerPreviewRows(parseResult.rows, ledgerXlsxYear);
      setLedgerXlsxPreviewRows(previewRows);
      toast.success(`${previewRows.length}건의 거래를 찾았습니다.`);
    } catch (error) {
      console.error('HARU보조장부 XLSX 가져오기 실패:', error);
      const reason = error instanceof Error && error.message ? error.message : '알 수 없는 분석 오류';
      toast.error(`파일을 읽지 못했습니다: ${reason}. 국민카드 XLS/XLSX 형식인지 확인해 주세요.`);
    } finally {
      setIsReadingLedgerXlsx(false);
    }
  };

  const updateLedgerPeriodEntry = (rowId: string, nextEntry: LedgerEntry) => {
    setLedgerPeriodResult(null);
    setLedgerXlsxPreviewRows((rows) => rows.map((row) => {
      if (row.id !== rowId) return row;
      const dateResult = normalizeLedgerDate(nextEntry.date, ledgerXlsxYear);
      const amountResult = normalizeLedgerAmount(nextEntry.amount);
      return {
        ...row,
        rawDate: nextEntry.date,
        selected: row.selected,
        duplicateStatus: row.duplicateStatus,
        edited: true,
        canImport: Boolean(dateResult.valid && nextEntry.vendor.trim() && amountResult.valid && nextEntry.paymentMethod.trim()),
        warning: dateResult.valid && amountResult.valid ? '' : '수정한 거래일 또는 금액 형식을 확인해 주세요.',
        entry: {
          ...nextEntry,
          date: dateResult.valid ? dateResult.value : nextEntry.date,
          amount: amountResult.valid ? amountResult.value : nextEntry.amount,
        },
      };
    }));
  };

  const applyLedgerBulkFields = () => {
    const selectedCount = ledgerXlsxPreviewRows.filter((row) => row.selected && row.canImport).length;
    if (selectedCount === 0) {
      toast.warning('일괄 적용할 거래를 먼저 선택해 주세요.');
      return;
    }
    const hasValue = Object.values(ledgerBulkFields).some(Boolean);
    if (!hasValue) {
      toast.warning('일괄 적용할 항목을 하나 이상 선택해 주세요.');
      return;
    }
    setLedgerPeriodResult(null);
    setLedgerXlsxPreviewRows((rows) => rows.map((row) => {
      if (!row.selected || !row.canImport) return row;
      const nextEntry = { ...row.entry };
      if (ledgerBulkFields.transactionType) {
        nextEntry.transactionType = ledgerBulkFields.transactionType;
        if (nextEntry.category) nextEntry.category = '';
        nextEntry.vatDeduction = defaultLedgerVatDeduction(nextEntry);
        nextEntry.expenseDeduction = defaultLedgerExpenseDeduction(nextEntry);
        nextEntry.assetTreatment = defaultLedgerAssetTreatment(nextEntry);
      }
      if (ledgerBulkFields.businessTrack) nextEntry.businessTrack = ledgerBulkFields.businessTrack;
      if (ledgerBulkFields.usageType) {
        nextEntry.usageType = ledgerBulkFields.usageType;
        nextEntry.vatDeduction = defaultLedgerVatDeduction(nextEntry);
        nextEntry.expenseDeduction = defaultLedgerExpenseDeduction(nextEntry);
      }
      if (ledgerBulkFields.category) nextEntry.category = ledgerBulkFields.category;
      if (ledgerBulkFields.proofType) nextEntry.proofType = ledgerBulkFields.proofType;
      if (ledgerBulkFields.vatTaxType) nextEntry.vatTaxType = ledgerBulkFields.vatTaxType;
      if (ledgerBulkFields.vatDeduction) nextEntry.vatDeduction = ledgerBulkFields.vatDeduction;
      if (ledgerBulkFields.hometaxCheck) nextEntry.hometaxCheck = ledgerBulkFields.hometaxCheck;
      if (ledgerBulkFields.expenseDeduction) nextEntry.expenseDeduction = ledgerBulkFields.expenseDeduction;
      if (ledgerBulkFields.assetTreatment) nextEntry.assetTreatment = ledgerBulkFields.assetTreatment;
      return { ...row, entry: adjustLedgerTaxFieldsForUsage(nextEntry), edited: true };
    }));
    toast.success(`선택 거래 ${selectedCount}건에 공통 항목을 적용했습니다.`);
  };

  const handleSaveLedgerXlsxRows = async () => {
    const selectedRows = ledgerXlsxPreviewRows.filter((row) => row.selected && row.canImport);
    if (selectedRows.length === 0) {
      toast.warning('보조장부에 반영할 거래를 선택해 주세요.');
      return;
    }
    const missingBusinessTrackCount = selectedRows.filter((row) => !row.entry.businessTrack).length;
    if (missingBusinessTrackCount > 0) {
      toast.error(`선택 거래 중 사업 구분을 확인하지 않은 거래가 ${missingBusinessTrackCount}건 있습니다.`);
      return;
    }
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    const selectedDates = selectedRows.map((row) => row.entry.date.slice(0, 10)).sort();
    const periodStart = selectedDates[0];
    const periodEnd = selectedDates[selectedDates.length - 1];
    const displayDate = (date: string) => date.replace(/-/g, '.');
    const confirmed = window.confirm(
      `선택한 ${selectedRows.length}건을 ${displayDate(periodStart)}~${displayDate(periodEnd)}의 각 거래일에 나누어 저장합니다. 계속하시겠습니까?`,
    );
    if (!confirmed) return;

    // '이미 저장됨'은 이번 편집 세션에서 방금 저장에 성공한 거래에만 붙는 표시다.
    // 같은 날짜·거래처·금액이라도 별개의 정상 거래로 보고 항상 저장 대상에 포함하므로,
    // Firestore 과거 이력과 대조해 자동으로 걸러내는 절차는 없다.
    const alreadySavedCount = ledgerXlsxPreviewRows
      .filter((row) => !row.selected && row.duplicateStatus === 'saved').length;
    const manuallyExcludedCount = ledgerXlsxPreviewRows
      .filter((row) => !row.selected && row.duplicateStatus !== 'saved').length;
    setIsSavingLedgerXlsx(true);
    try {
      const saveEntries: LedgerEntry[] = selectedRows.map((row) => ({
        ...row.entry,
        id: `xlsx-${hashLedgerImportKey([
          row.entry.date,
          row.entry.vendor,
          row.entry.amount,
          row.entry.paymentMethod,
          row.entry.approvalNumber || '',
        ].join('|'))}`,
      }));
      const result = await saveLedgerPeriodEntriesBatch(user.uid, saveEntries);
      setLedgerPeriodResult({
        totalCount: ledgerXlsxPreviewRows.length,
        savedCount: result.savedCount,
        excludedCount: manuallyExcludedCount,
        alreadySavedCount,
        savedDateCount: result.savedDates.length,
        failureCount: 0,
      });
      const savedRowIds = new Set(selectedRows.map((row) => row.id));
      setLedgerXlsxPreviewRows((rows) => rows.map((row) => savedRowIds.has(row.id)
        ? { ...row, selected: false, duplicateStatus: 'saved' }
        : row));
      // 저장 성공 시에만 작업 중 상태(draft)를 지운다. 남은 미저장 거래가 있으면
      // 위 debounce 효과가 곧바로 새 draft를 다시 저장한다.
      clearLedgerXlsxDraft();
      toast.success(`저장 완료: ${result.savedCount}건이 각 거래일에 저장되었습니다.`);
    } catch (error) {
      console.error('HARU보조장부 XLSX 선택 거래 저장 실패:', error);
      const reason = error instanceof Error ? error.message : '선택한 거래 저장에 실패했습니다.';
      setLedgerPeriodResult({
        totalCount: ledgerXlsxPreviewRows.length,
        savedCount: 0,
        excludedCount: manuallyExcludedCount,
        alreadySavedCount,
        savedDateCount: 0,
        failureCount: selectedRows.length,
        message: reason,
      });
      // 실패 시에는 창을 닫지 않고 분류 지정 상태(ledgerXlsxPreviewRows)를 그대로 유지한다.
      toast.error(`기간 저장에 실패했습니다. 저장된 거래는 없습니다: ${reason}`);
    } finally {
      setIsSavingLedgerXlsx(false);
    }
  };

  // ===== 📒 HARU가계부 OCR 핸들러 =====
  const handleHouseholdOcrPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setSelectedHouseholdOcrFiles((prev) => [...prev, ...selected].slice(0, 5));
    if (householdOcrInputRef.current) householdOcrInputRef.current.value = '';
  };

  const handleExtractHouseholdText = async () => {
    if (!isHouseholdFormat || selectedHouseholdOcrFiles.length === 0) return;
    if (!user?.uid) { toast.error('로그인이 필요합니다.'); return; }

    setIsExtractingHouseholdText(true);
    try {
      const functionsInstance = getFunctions(undefined, 'asia-northeast3');
      const extractFunc = httpsCallable(functionsInstance, 'extractHouseholdTextFromImage');
      const perFileResults: { fileName: string; transactions?: any[]; fields?: any }[] = [];

      for (const file of selectedHouseholdOcrFiles) {
        let dataBase64: string;
        try {
          const compressed = await prepareBookOcrImage(file);
          dataBase64 = await blobToBase64String(compressed);
        } catch {
          toast.warning(`${file.name} 사진을 읽지 못해 건너뜁니다.`);
          continue;
        }
        try {
          const result = await extractFunc({ images: [{ mimeType: 'image/jpeg', dataBase64 }] });
          const data = result.data as any;
          perFileResults.push({ fileName: file.name, transactions: data.transactions, fields: data.fields });
        } catch {
          perFileResults.push({ fileName: file.name });
        }
      }

      if (perFileResults.length === 0) { toast.warning('추출할 수 있는 이미지가 없습니다.'); return; }

      const generated: HouseholdEntry[] = [];
      let total = 0;
      for (const item of perFileResults) {
        const txList = item.transactions?.length ? item.transactions : item.fields ? [item.fields] : [];
        total += txList.length;
        for (const tx of txList) {
          generated.push(newHouseholdEntry({
            transactionType: tx.type === '수입' ? '수입' : tx.type === '이체' ? '이체' : '지출',
            category: String(tx.category || '').trim() || '기타',
            date: String(tx.transactionAt || '').trim(),
            vendor: String(tx.partner || '').trim(),
            amount: String(tx.amount || '').trim(),
            paymentMethod: String(tx.paymentMethod || '').trim(),
            memo: String(tx.memo || '').trim(),
            ocrSourceFile: item.fileName,
          }));
        }
      }
      if (generated.length > 0) setHouseholdEntries(generated);

      if (total > 1) toast.success(`거래 ${total}건이 감지되었습니다. 분류를 확인해 주세요.`);
      else toast.success('추출 완료. 입력 내용을 확인해 주세요.');
    } catch (error: any) {
      toast.error(String(error?.message || '영수증 텍스트 추출에 실패했습니다.'));
    } finally {
      setIsExtractingHouseholdText(false);
    }
  };

  // ===== 📒 HARU가계부 저장 핸들러 =====
  // household_* 필드 매핑 + onSave 호출 — 수동 저장·카카오뱅크 일괄 저장이 공유하는 핵심 로직.
  // recordDate를 넘기면 그 날짜로 레코드가 저장되고(_recordDate), 생략하면 기존 동작(세션 날짜)과 동일하다.
  const saveHouseholdEntriesBatch = async (entries: HouseholdEntry[], recordDate?: string) => {
    const first = entries[0];
    const autoTitle = [first.date, first.transactionType, first.vendor || 'HARU가계부'].filter(Boolean).join(' · ') || 'HARU가계부';
    const originalContent = entries.map((e) => {
      const amount = parseHouseholdAmount(e.amount).toLocaleString();
      if (e.transactionType === '수입') {
        return `[수입] ${e.date} ${amount}원${e.vendor ? ` (${e.vendor})` : ''}${e.memo ? '\n메모: ' + e.memo : ''}`;
      }
      if (e.transactionType === '이체') {
        return `[이체] ${e.date} ${amount}원${e.paymentMethod ? ` → ${e.paymentMethod}` : ''}${e.memo ? '\n메모: ' + e.memo : ''}`;
      }
      const details = [e.vendor, e.category, e.paymentMethod].filter(Boolean).join(' / ');
      return `[지출] ${e.date} ${amount}원${details ? ` ${details}` : ''}${e.memo ? '\n메모: ' + e.memo : ''}`;
    }).join('\n\n');

    const prefix = 'household';
    const dataToSave: Record<string, any> = {
      ...formData,
      ...(recordDate ? { _recordDate: recordDate } : {}),
      household_sayu: originalContent,
      [`${prefix}_style`]: 'premium',
      [`${prefix}_mode`]: 'ORIGINAL',
      [`${prefix}_title`]: autoTitle,
      household_type: first.transactionType,
      household_category: first.category,
      household_date: first.date,
      household_vendor: first.vendor,
      household_amount: first.amount,
      household_payment: first.paymentMethod,
      household_memo: first.memo,
      household_entries: JSON.stringify(entries),
    };

    await onSave(dataToSave);
  };

  const handleSaveHouseholdEntries = async () => {
    if (householdEntries.length === 0) { toast.warning('거래 내역을 입력해 주세요.'); return; }
    const emptyAmounts = householdEntries.filter(e => !e.amount.trim()).length;
    // 수입·이체는 사용처가 없어도 됨 — 지출만 체크
    const emptyVendors = householdEntries.filter(e => e.transactionType === '지출' && !e.vendor.trim()).length;
    if (emptyAmounts > 0) { toast.warning(`금액이 비어 있는 거래(${emptyAmounts}건)를 확인해 주세요.`); return; }
    if (emptyVendors > 0) { toast.warning(`사용처가 비어 있는 지출 거래(${emptyVendors}건)를 확인해 주세요.`); return; }

    setIsSaving(true);
    try {
      await saveHouseholdEntriesBatch(householdEntries);
      toast.success(`가계부 ${householdEntries.length}건이 저장되었습니다!`);
      onClose();
    } catch (error) {
      console.error('저장 중 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // ===== 🚿 배뇨일지 저장 =====
  const handleSaveVoidingEntries = async () => {
    if (voidingEntries.length === 0) { toast.warning('기록 항목을 하나 이상 추가해 주세요.'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const dataToSave: Record<string, unknown> = {
      formats: ['배뇨일지'],
      date: today,
      title: formData.title || `${today} 배뇨일지`,
      voiding_bedtime: voidingBedtime,
      voiding_waketime: voidingWaketime,
      voiding_entries: JSON.stringify(voidingEntries),
    };
    setIsSaving(true);
    try {
      await onSave(dataToSave as any);
      toast.success(`배뇨일지 ${voidingEntries.length}건이 저장되었습니다!`);
      onClose();
    } catch (error) {
      console.error('저장 중 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // ===== 📒 HARU가계부 — 카카오뱅크 XLSX 불러오기 =====
  const handleKakaoXlsxFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.warning('현재는 XLSX 파일만 가져올 수 있습니다.');
      return;
    }
    setKakaoXlsxMonthGroups([]);
    setSelectedKakaoXlsxFile(file);
    setKakaoXlsxPassword('');
    setShowKakaoPasswordPrompt(true);
  };

  const handleCancelKakaoXlsxPassword = () => {
    setShowKakaoPasswordPrompt(false);
    setSelectedKakaoXlsxFile(null);
    setKakaoXlsxPassword('');
  };

  const handleKakaoXlsxDecryptAndParse = async () => {
    if (!selectedKakaoXlsxFile) return;
    if (!user?.uid) { toast.error('로그인이 필요합니다.'); return; }
    if (!kakaoXlsxPassword.trim()) { toast.warning('비밀번호를 입력해 주세요.'); return; }

    setIsDecryptingKakaoXlsx(true);
    try {
      const fileBytes = new Uint8Array(await selectedKakaoXlsxFile.arrayBuffer());
      if (fileBytes.byteLength === 0) {
        throw new Error('파일 내용이 비어 있습니다. 다운로드가 끝난 뒤 다시 선택해 주세요.');
      }
      const fileBase64 = arrayBufferToBase64(fileBytes);

      const functionsInstance = getFunctions(undefined, 'asia-northeast3');
      const decryptFunc = httpsCallable(functionsInstance, 'decryptKakaoXlsx');
      const result = await decryptFunc({ fileBase64, password: kakaoXlsxPassword });
      const { xlsxBase64 } = result.data as { xlsxBase64: string };

      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBase64, { type: 'base64' });
      const parseResult = parseKakaoBankWorkbook(workbook, XLSX, selectedKakaoXlsxFile.name);
      if (parseResult.rows.length === 0) {
        toast.error(`거래 내역을 찾지 못했습니다. 총 ${parseResult.scannedRowCount}행을 확인했습니다. 카카오뱅크 거래내역 XLSX 형식인지 확인해 주세요.`);
        return;
      }
      setKakaoXlsxMonthGroups(groupKakaoRowsByMonth(parseResult.rows));
      setShowKakaoPasswordPrompt(false);
      setSelectedKakaoXlsxFile(null);
      setKakaoXlsxPassword('');
      toast.success(`${parseResult.rows.length}건의 거래를 찾았습니다. 확인 후 저장해 주세요.`);
    } catch (error: any) {
      const code = String(error?.code || '');
      if (code.includes('invalid-argument') || code.includes('unauthenticated')) {
        toast.error(String(error?.message || '비밀번호가 올바르지 않습니다.'));
      } else {
        console.error('카카오뱅크 XLSX 가져오기 실패:', error);
        toast.error(`파일을 읽지 못했습니다: ${error?.message || '알 수 없는 오류'}`);
      }
    } finally {
      setIsDecryptingKakaoXlsx(false);
    }
  };

  const recomputeKakaoRowWarning = (entry: HouseholdEntry): string => {
    const warnings: string[] = [];
    if (!entry.amount.trim()) warnings.push('금액을 확인해 주세요');
    if (entry.transactionType === '지출' && !entry.vendor.trim()) warnings.push('사용처를 확인해 주세요');
    return warnings.join(' · ');
  };

  const updateKakaoRow = (month: string, rowId: string, patch: Partial<HouseholdEntry>) => {
    setKakaoXlsxMonthGroups((groups) => groups.map((g) => {
      if (g.month !== month) return g;
      return {
        ...g,
        rows: g.rows.map((r) => {
          if (r.id !== rowId) return r;
          const nextEntry: HouseholdEntry = { ...r.entry, ...patch };
          return { ...r, entry: nextEntry, warning: recomputeKakaoRowWarning(nextEntry) };
        }),
      };
    }));
  };

  const toggleKakaoRowSelected = (month: string, rowId: string) => {
    setKakaoXlsxMonthGroups((groups) => groups.map((g) => {
      if (g.month !== month) return g;
      return { ...g, rows: g.rows.map((r) => r.id === rowId ? { ...r, selected: !r.selected } : r) };
    }));
  };

  const toggleKakaoMonthSelectAll = (month: string, selected: boolean) => {
    setKakaoXlsxMonthGroups((groups) => groups.map((g) => {
      if (g.month !== month) return g;
      return { ...g, rows: g.rows.map((r) => ({ ...r, selected })) };
    }));
  };

  const handleSaveKakaoXlsxImport = async () => {
    const candidateGroups = kakaoXlsxMonthGroups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => r.selected) }))
      .filter((g) => g.rows.length > 0);
    if (candidateGroups.length === 0) { toast.warning('저장할 거래를 선택해 주세요.'); return; }

    const validGroups: typeof candidateGroups = [];
    const blockedMonths: string[] = [];
    for (const group of candidateGroups) {
      const entries = group.rows.map((r) => r.entry);
      const emptyAmounts = entries.filter((e) => !e.amount.trim()).length;
      const emptyVendors = entries.filter((e) => e.transactionType === '지출' && !e.vendor.trim()).length;
      if (emptyAmounts > 0 || emptyVendors > 0) {
        blockedMonths.push(group.month);
      } else {
        validGroups.push(group);
      }
    }
    if (blockedMonths.length > 0) {
      toast.warning(`${blockedMonths.join(', ')} 거래에 금액·사용처 확인이 필요한 행이 있어 저장하지 않았습니다. 미리보기에서 수정 후 다시 저장해 주세요.`);
    }
    if (validGroups.length === 0) return;

    setIsSavingKakaoXlsx(true);
    try {
      let totalCount = 0;
      for (const group of validGroups) {
        const entries = group.rows.map((r) => r.entry);
        const recordDate = getEarliestEntryDate(group.rows);
        await saveHouseholdEntriesBatch(entries, recordDate);
        totalCount += entries.length;
      }
      toast.success(`카카오뱅크 거래 ${totalCount}건(${validGroups.length}개월)이 가계부에 저장되었습니다!`);
      // 저장 완료된 달은 목록에서 제거 — 검증 실패로 막힌 달만 남겨 재수정할 수 있게 한다.
      const savedMonths = new Set(validGroups.map((g) => g.month));
      setKakaoXlsxMonthGroups((groups) => groups.filter((g) => !savedMonths.has(g.month)));
      if (blockedMonths.length === 0) onClose();
    } catch (error) {
      console.error('카카오뱅크 가져오기 저장 실패:', error);
      toast.error('저장 중 오류가 발생했습니다. 가계부에서 반영 여부를 확인해 주세요.');
    } finally {
      setIsSavingKakaoXlsx(false);
    }
  };

  const handleSaveOriginalAsSayu = async () => {
    if (isLedgerFormat) {
      return handleSaveLedgerEntries();
    }
    if (isHouseholdFormat) {
      return handleSaveHouseholdEntries();
    }
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
      toast.success('SAYU-나의기록에 저장되었습니다.');
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
      toast.success('SAYU-나의기록에 저장되었습니다.');
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
    setEditingReadingEntryId('');
    setEditingReadingEntryDate('');
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
    setEditingReadingEntryId('');
    setEditingReadingEntryDate('');
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

  const prepareReadingAppend = (bookId: string) => {
    onSelectExistingBook(bookId);
    setEditingReadingEntryId('');
    setEditingReadingEntryDate('');
    setReadingBookTextMode('manual');
    setFormData((prev) => ({
      ...prev,
      reading_book_text: '',
      reading_journal: '',
    }));
    window.setTimeout(() => {
      readingJournalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      readingJournalRef.current?.focus();
    }, 0);
    toast.info('독서장 칸에 오늘 소감을 쓰면 새 회차로 추가됩니다.');
  };

  const prepareReadingEdit = (bookId: string, entry: KnownReadingEntry, entryIndex: number) => {
    const book = knownReadingBooks.find((b) => b.readingBookId === bookId);
    if (!book || book.hasFinalReflection) return;

    onSelectExistingBook(bookId);
    setEditingReadingEntryId(entry.id);
    setEditingReadingEntryDate(entry.date);
    setReadingBookTextMode('photo');
    setFormData((prev) => ({
      ...prev,
      reading_book_title: book.bookTitle,
      reading_author: book.author,
      reading_started_at: prev.reading_started_at || entry.date || book.lastDate || '',
      reading_book_text: entry.readingBookText,
      reading_journal: entry.readingJournal,
      reading_sayu: entry.readingSayu,
      reading_note_createdAt: entry.noteCreatedAt || prev.reading_note_createdAt || '',
    }));
    setRecordStep('input');
    window.setTimeout(() => {
      readingJournalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      readingJournalRef.current?.focus();
    }, 0);
    toast.info(`${entryIndex + 1}회차를 수정 중입니다. 사진 추출 또는 직접 입력 후 저장하세요.`);
  };

  const cancelReadingEdit = () => {
    setEditingReadingEntryId('');
    setEditingReadingEntryDate('');
    setReadingBookTextMode('manual');
    setFormData((prev) => ({
      ...prev,
      reading_book_text: '',
      reading_journal: '',
      reading_sayu: '',
    }));
    toast.info('회차 수정을 취소했습니다.');
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
      const now = new Date().toISOString();
      const targetRecordId = editingReadingEntryId || `reading_note_${currentBookId}_${Date.now()}`;

      const updateData: Record<string, any> = {
        ...formData,
        _recordId: targetRecordId,
        ...(editingReadingEntryDate ? { _recordDate: editingReadingEntryDate } : {}),
        reading_started_at: formData.reading_started_at || startedAt,
        [imagesKey]: JSON.stringify(uploadedImages),
        [imageMetaKey]: getUploadedImageMetaForSave(),
        [`${prefix}_style`]: 'premium',
        [`${prefix}_mode`]: 'PREMIUM',
        [`${prefix}_sayu`]: polished,
        [`${prefix}_polished`]: true,
        [`${prefix}_polishedAt`]: now,
        [`${prefix}_note_createdAt`]: editingReadingEntryId
          ? (formData.reading_note_createdAt || now)
          : now,
        [`${prefix}_note_updatedAt`]: now,
        [`${prefix}_accumulation_mode`]: editingReadingEntryId ? 'edit' : 'append',
        ...buildReadingMeta('chapter_note'),
      };
      if (stats) updateData[`${prefix}_stats`] = stats;
      if (bookTitle) updateData[`${prefix}_title`] = bookTitle;

      setIsSaving(true);
      await onSave(updateData);
      toast.success(editingReadingEntryId ? '📖 독서장 회차가 수정되었습니다.' : '📖 독서장이 누적 저장되었습니다.');
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
      toast.success('SAYU-나의기록에 저장되었습니다.');
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

  const visibleLedgerEntries = ledgerInputMode === 'single'
    ? ledgerEntries
    : ledgerXlsxPreviewRows
      .filter((row) => row.id === expandedLedgerXlsxRowId)
      .map((row) => row.entry);
  const activeUploadedImages = ledgerInputMode === 'period'
    ? visibleLedgerEntries[0]?.imageUrls || []
    : uploadedImages;
  const setVisibleLedgerEntries = (updater: (entries: LedgerEntry[]) => LedgerEntry[]) => {
    if (ledgerInputMode === 'single') {
      setLedgerEntries(updater);
      return;
    }
    const row = ledgerXlsxPreviewRows.find((item) => item.id === expandedLedgerXlsxRowId);
    if (!row) return;
    const nextEntries = updater([row.entry]);
    if (nextEntries.length === 0) {
      setExpandedLedgerXlsxRowId('');
      return;
    }
    updateLedgerPeriodEntry(row.id, nextEntries[0]);
  };
  const ledgerPeriodDates = ledgerXlsxPreviewRows
    .filter((row) => /^\d{4}-\d{2}-\d{2}/.test(row.entry.date))
    .map((row) => row.entry.date.slice(0, 10))
    .sort();
  const ledgerPeriodStart = ledgerPeriodDates[0] || '';
  const ledgerPeriodEnd = ledgerPeriodDates[ledgerPeriodDates.length - 1] || '';
  const ledgerPeriodSelectedRows = ledgerXlsxPreviewRows.filter((row) => row.selected && row.canImport);
  const ledgerPeriodTotalAmount = ledgerXlsxPreviewRows.reduce((sum, row) => sum + ledgerEntryAmount(row.entry), 0);
  const ledgerPeriodSelectedAmount = ledgerPeriodSelectedRows.reduce((sum, row) => sum + ledgerEntryAmount(row.entry), 0);
  const formatLedgerPeriodDate = (date: string) => date ? date.replace(/-/g, '.') : '-';
  const formatLedgerPeriodAmount = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

  const selectedReadingEntries = format === '독서사유' && selectedExistingBookId
    ? readingEntriesByBook[selectedExistingBookId] || []
    : [];
  const editingReadingEntryIndex = editingReadingEntryId
    ? selectedReadingEntries.findIndex((entry) => entry.id === editingReadingEntryId)
    : -1;
  const editingReadingEntryLabel = editingReadingEntryIndex >= 0
    ? `${editingReadingEntryIndex + 1}회차${editingReadingEntryDate ? ` · ${editingReadingEntryDate}` : ''}`
    : '';

  const getReadingEntryPreview = (entry: KnownReadingEntry) => {
    const preview = entry.readingJournal || entry.readingSayu || entry.readingBookText;
    return preview.trim().replace(/\s+/g, ' ').slice(0, 180);
  };

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
            maxWidth: isLedgerFormat && ledgerInputMode === 'period' ? 1240 : 600,
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
                {format === '독서사유' ? (isEditingReadingEntry ? '독서장 회차 수정' : '독서장 작성') : `${format} 작성`}
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
          {recordStep === 'input' && !(isLedgerFormat && ledgerInputMode === 'period') && (
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
                              {` · 누적 ${readingEntriesByBook[b.readingBookId]?.length || 0}회`}
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
              {/* 입력 방식 + 모드 배지 */}
              <div>
                {isLedgerFormat ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([
                      { value: 'single', label: '단건 작성', description: '기존 방식 그대로 직접 입력' },
                      { value: 'period', label: '기간 일괄 작성', description: 'XLSX 거래를 날짜별로 일괄 저장' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setLedgerInputMode(option.value);
                          setExpandedLedgerXlsxRowId('');
                          setLedgerPeriodResult(null);
                        }}
                        style={{
                          padding: '12px 10px',
                          border: ledgerInputMode === option.value ? '2px solid #1A3C6E' : '1px solid #d1d5db',
                          borderRadius: 9,
                          backgroundColor: ledgerInputMode === option.value ? '#EEF3FA' : '#fff',
                          color: '#1A3C6E',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>{option.label}</strong>
                        <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: '#6b7280' }}>{option.description}</span>
                      </button>
                    ))}
                  </div>
                ) : format !== '독서사유' ? (
                  <button
                    onClick={() => setRecordStep('select')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', padding: 0 }}
                  >
                    ← 방식 다시 선택
                  </button>
                ) : null}
                {!isLedgerFormat && <span style={{
                  display: 'inline-block', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500,
                  background: recordStyle === 'simple' ? '#dcfce7' : '#dbeafe',
                  color: recordStyle === 'simple' ? '#166534' : '#1e3a8a',
                }}>
                  {format === '독서사유' ? '📚 진행형 독서 기록' : recordStyle === 'simple' ? '✏️ 간편 기록' : '📋 프리미엄 기록'}
                </span>}
              </div>

              {/* 제목 입력 필드 — 독서사유는 reading_book_title 이 제목 역할이므로 숨김 */}
              {format !== 'HARU주식관리' && format !== '독서사유' && !(isLedgerFormat && ledgerInputMode === 'period') && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6, fontWeight: 600 }}>
                    📌 제목 <span style={{ color: '#ef4444', fontSize: 11 }}>*필수</span>
                  </label>
                  <input
                    type="text"
                    value={formData[`${prefix}_title`] || ''}
                    onChange={(e) => handleChange(`${prefix}_title`, e.target.value)}
                    placeholder={`제목을 입력해 주세요 (${TITLE_EXAMPLE[format] ?? '예: 오늘의 산책'})`}
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
                          {` (${readingEntriesByBook[b.readingBookId]?.length || 0}회)`}
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
                  {selectedExistingBookId && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        border: '1px solid #d0dff0',
                        borderRadius: 10,
                        backgroundColor: '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, color: '#1A3C6E', fontWeight: 800 }}>
                            {isEditingReadingEntry ? `${editingReadingEntryLabel} 수정 중` : `누적 독서장 ${selectedReadingEntries.length}회`}
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                            {isEditingReadingEntry
                              ? '책 본문 사진 추출이나 직접 입력으로 기존 회차 내용을 보강할 수 있습니다.'
                              : '이전 내용은 보존하고 오늘 내용은 새 회차로 추가됩니다.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => prepareReadingAppend(selectedExistingBookId)}
                          style={{
                            flexShrink: 0,
                            padding: '8px 10px',
                            border: '1px solid #10b981',
                            borderRadius: 8,
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          + 오늘 소감 쓰기
                        </button>
                      </div>
                      {selectedReadingEntries.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedReadingEntries.map((entry, index) => (
                            <div
                              key={entry.id}
                              style={{
                                padding: '10px 12px',
                                border: editingReadingEntryId === entry.id ? '1.5px solid #1A3C6E' : '1px solid #e5edf5',
                                borderRadius: 8,
                                backgroundColor: editingReadingEntryId === entry.id ? '#EEF3FA' : '#f8fbff',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontSize: 12, color: '#1A3C6E', fontWeight: 800 }}>
                                  {index + 1}회차{entry.date ? ` · ${entry.date}` : ''}
                                  {editingReadingEntryId === entry.id ? ' · 수정 중' : ''}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => prepareReadingEdit(selectedExistingBookId, entry, index)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#1A3C6E',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      padding: 0,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    <Pencil style={{ width: 12, height: 12 }} />
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => prepareReadingAppend(selectedExistingBookId)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#10b981',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      padding: 0,
                                    }}
                                  >
                                    + 다음 회차
                                  </button>
                                </div>
                              </div>
                              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                                {getReadingEntryPreview(entry) || '내용 미리보기 없음'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                          아직 표시할 회차가 없습니다. 오늘 내용을 추가하면 이 책의 첫 회차로 쌓입니다.
                        </p>
                      )}
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

              {(format === '육아일기' || format === '텃밭일지' || format === '성장기록') && (
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
                      const nextId = e.target.value;
                      const nextSubject = growthSubjects.find((subject) => subject.id === nextId);
                      setSelectedGrowthSubjectId(nextId);
                      if (nextId) setNewGrowthSubjectName('');
                      if (format !== '텃밭일지') {
                        setGrowthSubjectBirthdate(nextSubject?.birthdate || '');
                        setGrowthSubjectGender(nextSubject?.gender || '');
                      }
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
                      if (e.target.value.trim()) {
                        if (selectedGrowthSubjectId && format !== '텃밭일지') {
                          setGrowthSubjectBirthdate('');
                          setGrowthSubjectGender('');
                        }
                        setSelectedGrowthSubjectId('');
                      }
                    }}
                    placeholder={format === '텃밭일지' ? '새 대상 추가: 작물명 또는 식물명' : '새 대상 추가: 아이 이름 또는 별칭'}
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
                  {format !== '텃밭일지' && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                      <label style={{ display: 'block', fontSize: 13, color: '#1A3C6E', fontWeight: 700 }}>
                        생년월일
                      </label>
                      <input
                        type="date"
                        value={effectiveGrowthSubjectBirthdate}
                        onChange={(e) => setGrowthSubjectBirthdate(e.target.value)}
                        disabled={Boolean(selectedGrowthSubject?.birthdate)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          fontSize: 14,
                          border: '1px solid #d0dff0',
                          borderRadius: 8,
                          backgroundColor: selectedGrowthSubject?.birthdate ? '#f3f4f6' : '#fff',
                          color: '#333',
                          outline: 'none',
                        }}
                      />
                      <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#1A3C6E', marginBottom: 8, fontWeight: 700 }}>
                          성별
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['M', 'F'] as GrowthGender[]).map((gender) => (
                            <button
                              key={gender}
                              type="button"
                              onClick={() => setGrowthSubjectGender(gender)}
                              disabled={Boolean(selectedGrowthSubject?.gender)}
                              style={{
                                flex: 1,
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: effectiveGrowthSubjectGender === gender ? '1px solid #10b981' : '1px solid #d0dff0',
                                backgroundColor: effectiveGrowthSubjectGender === gender ? '#ecfdf5' : '#fff',
                                color: effectiveGrowthSubjectGender === gender ? '#047857' : '#374151',
                                fontWeight: 700,
                                cursor: selectedGrowthSubject?.gender ? 'default' : 'pointer',
                              }}
                            >
                              {gender === 'M' ? '남아' : '여아'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    {format === '텃밭일지'
                      ? '작물의 성장과정으로 함께 저장됩니다.'
                      : '아이의 성장기록으로 함께 저장됩니다.'}
                  </p>
                </div>
              )}

              {format === '성장기록' && (
                <div
                  style={{
                    padding: 12,
                    border: '1px solid #d1fae5',
                    borderRadius: 10,
                    backgroundColor: '#f0fdf4',
                  }}
                >
                  <label style={{ display: 'block', fontSize: 13, color: '#047857', marginBottom: 8, fontWeight: 700 }}>
                    오늘 성장 기록 (선택)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    {[
                      { key: 'child_height', label: '키 (cm)', placeholder: '예: 85.4' },
                      { key: 'child_weight', label: '몸무게 (kg)', placeholder: '예: 12.3' },
                      { key: 'child_headcircum', label: '머리둘레 (cm, 선택사항)', placeholder: '예: 48.1' },
                    ].map((field) => (
                      <div key={field.key}>
                        <span style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 5 }}>
                          {field.label}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          value={formData[field.key] || ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px 12px',
                            fontSize: 14,
                            border: '1px solid #a7f3d0',
                            borderRadius: 8,
                            backgroundColor: '#fff',
                            color: '#111827',
                            outline: 'none',
                          }}
                        />
                      </div>
                    ))}
                    <div>
                      <span style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 5 }}>측정일</span>
                      <input
                        type="date"
                        value={childMeasuredate}
                        onChange={(e) => handleChange('child_measuredate', e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          fontSize: 14,
                          border: '1px solid #a7f3d0',
                          borderRadius: 8,
                          backgroundColor: '#fff',
                          color: '#111827',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {shouldShowGrowthResult && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #a7f3d0' }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 15, color: '#064e3b', fontWeight: 800 }}>👶 성장 분석 결과</div>
                        {childHeightPercentile !== null && (() => {
                          const message = formatGrowthPercentileMessage(childHeightPercentile);
                          return (
                            <div style={{ display: "grid", gap: 3 }}>
                              <div style={{ fontSize: 14, color: "#064e3b", fontWeight: 700 }}>키: {message.main}</div>
                              <div style={{ fontSize: 12, color: "#047857" }}>{message.sub}</div>
                            </div>
                          );
                        })()}
                        {childWeightPercentile !== null && (() => {
                          const message = formatGrowthPercentileMessage(childWeightPercentile);
                          return (
                            <div style={{ display: "grid", gap: 3 }}>
                              <div style={{ fontSize: 14, color: "#064e3b", fontWeight: 700 }}>몸무게: {message.main}</div>
                              <div style={{ fontSize: 12, color: "#047857" }}>{message.sub}</div>
                            </div>
                          );
                        })()}
                        <div style={{ fontSize: 13, color: '#047857', lineHeight: 1.5 }}>
                          {growthStatusMessage}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                          {'※ 이 결과는 공식 성장도표 기반 참고 정보입니다.\n정확한 평가는 소아과 전문의와 상담하세요.'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <GrowthChart userId={user?.uid} />
                  </div>
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

              {isLedgerFormat && ledgerInputMode === 'period' && (
                <div
                  style={{
                    padding: 12,
                    border: '1px solid #c7d2fe',
                    borderRadius: 10,
                    backgroundColor: '#f7f7ff',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3730a3', marginBottom: 8, fontWeight: 700 }}>
                    <FileText style={{ width: 15, height: 15 }} />
                    XLS/XLSX 카드 명세서 가져오기
                  </label>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    원본 파일은 업로드하지 않으며, 선택하여 확정한 거래만 보조장부에 저장합니다.
                  </p>
                  <input
                    ref={ledgerXlsxInputRef}
                    type="file"
                    accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleLedgerXlsxSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => ledgerXlsxInputRef.current?.click()}
                    disabled={isReadingLedgerXlsx || isSavingLedgerXlsx}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px dashed #4f46e5',
                      borderRadius: 8,
                      backgroundColor: '#fff',
                      color: '#3730a3',
                      cursor: isReadingLedgerXlsx || isSavingLedgerXlsx ? 'wait' : 'pointer',
                      opacity: isReadingLedgerXlsx || isSavingLedgerXlsx ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <Upload style={{ width: 16, height: 16 }} />
                    {isReadingLedgerXlsx ? 'XLS/XLSX 읽는 중...' : 'XLS/XLSX 파일 선택'}
                  </button>

                  {ledgerXlsxPreviewRows.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: 13, color: '#312e81' }}>기간 거래표</strong>
                          <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: '#4b5563' }}>
                            {formatLedgerPeriodDate(ledgerPeriodStart)}~{formatLedgerPeriodDate(ledgerPeriodEnd)} · 전체 {ledgerXlsxPreviewRows.length}건 · 전체 {formatLedgerPeriodAmount(ledgerPeriodTotalAmount)} · 선택 {ledgerPeriodSelectedRows.length}건 · 선택 {formatLedgerPeriodAmount(ledgerPeriodSelectedAmount)}
                          </span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4b5563', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={ledgerXlsxPreviewRows.some((row) => row.canImport && !row.duplicateStatus) && ledgerXlsxPreviewRows.filter((row) => row.canImport && !row.duplicateStatus).every((row) => row.selected)}
                            onChange={(e) => setLedgerXlsxPreviewRows((prev) => prev.map((row) => row.canImport && !row.duplicateStatus ? { ...row, selected: e.target.checked } : row))}
                            style={{ accentColor: '#4f46e5' }}
                          />
                          신규 거래 전체 선택
                        </label>
                      </div>
                      {ledgerPeriodResult && (
                        <div style={{ marginBottom: 10, padding: '11px 12px', borderRadius: 8, border: `1px solid ${ledgerPeriodResult.failureCount ? '#fecaca' : '#86efac'}`, backgroundColor: ledgerPeriodResult.failureCount ? '#fef2f2' : '#f0fdf4', color: ledgerPeriodResult.failureCount ? '#991b1b' : '#166534', fontSize: 12, lineHeight: 1.6 }}>
                          <strong style={{ display: 'block' }}>
                            총 {ledgerPeriodResult.totalCount}건 중 {ledgerPeriodResult.savedCount}건을 {ledgerPeriodResult.savedDateCount}개 날짜에 저장했습니다.
                          </strong>
                          <span>제외 {ledgerPeriodResult.excludedCount}건 · 이미 저장됨 {ledgerPeriodResult.alreadySavedCount}건 · 실패 {ledgerPeriodResult.failureCount}건</span>
                          {ledgerPeriodResult.message && <span style={{ display: 'block' }}>{ledgerPeriodResult.message}</span>}
                        </div>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#374151' }}>
                        거래 기준 연도
                        <select
                          value={ledgerXlsxYear}
                          onChange={(event) => handleLedgerXlsxYearChange(Number(event.target.value))}
                          disabled={isSavingLedgerXlsx}
                          style={{ padding: '6px 28px 6px 8px', border: '1px solid #c7d2fe', borderRadius: 6, backgroundColor: '#fff', color: '#312e81', fontSize: 12 }}
                        >
                          {Array.from({ length: 11 }, (_, index) => new Date().getFullYear() + 1 - index).map((year) => (
                            <option key={year} value={year}>{year}년</option>
                          ))}
                        </select>
                        <span style={{ color: '#6b7280' }}>연도가 없는 0617 같은 날짜에 적용됩니다.</span>
                      </label>
                      <div style={{ marginBottom: 10, padding: 10, border: '1px solid #ddd6fe', borderRadius: 8, backgroundColor: '#fff' }}>
                        <strong style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#4c1d95' }}>선택 거래 일괄 적용</strong>
                        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                          카드명세서 거래는 기본 사용구분이 사업용으로 표시되지만, 사업 관련 여부와 VAT 처리는 저장 전 직접 확인해 주세요.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 7 }}>
                          <select value={ledgerBulkFields.transactionType} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, transactionType: e.target.value }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">수입/지출 유지</option>
                            <option value="수입">수입</option>
                            <option value="지출">지출</option>
                          </select>
                          <select value={ledgerBulkFields.businessTrack} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, businessTrack: e.target.value as LedgerEntry['businessTrack'] }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">사업 구분 유지</option>
                            <option value="haru2026">HARU2026</option>
                            <option value="external">외부용역</option>
                          </select>
                          <select value={ledgerBulkFields.usageType} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, usageType: e.target.value }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">사용 구분 유지</option>
                            <option value="사업용">사업용</option>
                            <option value="개인용">개인용</option>
                          </select>
                          <select value={ledgerBulkFields.category || ''} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, category: e.target.value }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">분류 유지</option>
                            {['매출', '기타수입', '식비', '교통비', '통신비', '소프트웨어', '광고비', '교육비', '사무용품', '복리후생비', '접대비', '지급수수료', '기타'].map((category) => <option key={category} value={category}>{category}</option>)}
                          </select>
                          <select value={ledgerBulkFields.proofType || ''} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, proofType: e.target.value }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">증빙유형 유지</option>
                            <option value="카드매출전표">카드매출전표</option>
                            <option value="현금영수증">현금영수증</option>
                            <option value="현금영수증(지출증빙)">현금영수증(지출증빙)</option>
                            <option value="세금계산서">세금계산서</option>
                            <option value="전자세금계산서">전자세금계산서</option>
                            <option value="계산서">계산서</option>
                            <option value="전자계산서">전자계산서</option>
                            <option value={LEDGER_XLSX_PROOF}>{LEDGER_XLSX_PROOF}</option>
                            <option value="증빙없음">증빙없음</option>
                            <option value="기타">기타</option>
                          </select>
                          <select value={ledgerBulkFields.vatTaxType || ''} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, vatTaxType: (e.target.value || undefined) as LedgerVatTaxType | undefined }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">과세유형 유지</option>
                            {Object.entries(LEDGER_VAT_TAX_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <select value={ledgerBulkFields.vatDeduction || ''} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, vatDeduction: (e.target.value || undefined) as LedgerVatDeduction | undefined }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">공제 여부 유지</option>
                            {Object.entries(LEDGER_VAT_DEDUCTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <select value={ledgerBulkFields.hometaxCheck || ''} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, hometaxCheck: (e.target.value || undefined) as LedgerHometaxCheck | undefined }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">홈택스 상태 유지</option>
                            {Object.entries(LEDGER_HOMETAX_CHECK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <select value={ledgerBulkFields.expenseDeduction || ''} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, expenseDeduction: (e.target.value || undefined) as LedgerExpenseDeduction | undefined }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">필요경비 여부 유지</option>
                            {Object.entries(LEDGER_EXPENSE_DEDUCTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <select value={ledgerBulkFields.assetTreatment || ''} onChange={(e) => setLedgerBulkFields((prev) => ({ ...prev, assetTreatment: (e.target.value || undefined) as LedgerAssetTreatment | undefined }))} style={{ padding: '7px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11 }}>
                            <option value="">비용 처리 방식 유지</option>
                            {Object.entries(LEDGER_ASSET_TREATMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <button type="button" onClick={applyLedgerBulkFields} disabled={isSavingLedgerXlsx} style={{ padding: '7px 10px', border: 'none', borderRadius: 6, backgroundColor: '#6d28d9', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            선택 거래에 적용
                          </button>
                        </div>
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, backgroundColor: '#fff' }}>
                        <table style={{ width: '100%', minWidth: 1740, borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ backgroundColor: '#eef2ff', color: '#3730a3', textAlign: 'left' }}>
                              {['선택', '거래일', '거래처', '금액', '수입/지출', '사업 구분', '사용 구분', '분류', '과세유형', '홈택스', '필요경비', '비용처리', '결제수단', '상태', '상세 수정'].map((label) => (
                                <th key={label} style={{ padding: '8px 7px', borderBottom: '1px solid #c7d2fe', whiteSpace: 'nowrap' }}>{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerXlsxPreviewRows.map((row) => (
                              <tr key={row.id} style={{ backgroundColor: row.duplicateStatus ? '#fffbeb' : expandedLedgerXlsxRowId === row.id ? '#eef2ff' : '#fff', color: '#374151' }}>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={row.selected}
                                    disabled={!row.canImport || isSavingLedgerXlsx || row.duplicateStatus === 'saved'}
                                    onChange={(e) => setLedgerXlsxPreviewRows((prev) => prev.map((item) => item.id === row.id ? { ...item, selected: e.target.checked } : item))}
                                    aria-label={`${row.entry.vendor || '거래'} 선택`}
                                    style={{ accentColor: '#4f46e5' }}
                                  />
                                </td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{row.entry.date || '-'}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{row.entry.vendor || '-'}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', textAlign: 'right' }}>{row.entry.amount || '-'}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{row.entry.transactionType}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{row.entry.businessTrack === 'haru2026' ? 'HARU2026' : row.entry.businessTrack === 'external' ? '외부용역' : '확인 필요'}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{row.entry.usageType || '-'}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{row.entry.category || '미분류'}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{LEDGER_VAT_TAX_TYPE_LABELS[row.entry.vatTaxType || 'review']}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{LEDGER_HOMETAX_CHECK_LABELS[row.entry.hometaxCheck || 'unchecked']}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{LEDGER_EXPENSE_DEDUCTION_LABELS[row.entry.expenseDeduction || defaultLedgerExpenseDeduction(row.entry)]}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{LEDGER_ASSET_TREATMENT_LABELS[row.entry.assetTreatment || defaultLedgerAssetTreatment(row.entry)]}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>{row.entry.paymentMethod || '-'}</td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6', color: row.duplicateStatus || row.warning || !row.entry.businessTrack ? '#b45309' : '#047857' }}>
                                  <strong>{row.duplicateStatus === 'saved' ? '이미 저장됨' : !row.canImport ? '형식 확인 필요' : !row.entry.businessTrack ? '분류 확인 필요' : row.edited ? '수정됨' : '저장 준비'}</strong>
                                  {row.warning && <span style={{ display: 'block', marginTop: 3, fontWeight: 400 }}>{row.warning}</span>}
                                </td>
                                <td style={{ padding: '8px 7px', borderBottom: '1px solid #f3f4f6' }}>
                                  <button type="button" onClick={() => setExpandedLedgerXlsxRowId((current) => current === row.id ? '' : row.id)} style={{ padding: '5px 8px', border: '1px solid #a5b4fc', borderRadius: 6, backgroundColor: '#fff', color: '#3730a3', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {expandedLedgerXlsxRowId === row.id ? '닫기' : '상세 수정'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => { setLedgerXlsxPreviewRows([]); setExpandedLedgerXlsxRowId(''); setLedgerPeriodResult(null); }}
                          disabled={isSavingLedgerXlsx}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, backgroundColor: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: isSavingLedgerXlsx ? 'not-allowed' : 'pointer' }}
                        >
                          현재 파일 초기화
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isLedgerFormat && ledgerInputMode === 'single' && (
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
                    영수증·통장캡처에서 텍스트 추출
                  </label>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    사진은 저장하지 않고 추출 결과를 확인한 뒤, 입력칸에 반영할 때만 장부 값으로 들어갑니다.
                  </p>
                  <input
                    ref={ledgerOcrInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    onChange={handleLedgerOcrPhotoSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: selectedLedgerOcrFiles.length > 0 ? '1fr 1fr' : '1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => ledgerOcrInputRef.current?.click()}
                      disabled={isExtractingLedgerText}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px dashed #1A3C6E',
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        color: '#1A3C6E',
                        cursor: isExtractingLedgerText ? 'wait' : 'pointer',
                        opacity: isExtractingLedgerText ? 0.55 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      <Upload style={{ width: 16, height: 16 }} />
                      사진 선택
                      {selectedLedgerOcrFiles.length > 0 ? ` (${selectedLedgerOcrFiles.length}장)` : ''}
                    </button>
                    {selectedLedgerOcrFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExtractSelectedLedgerText}
                        disabled={isExtractingLedgerText}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          borderRadius: 8,
                          backgroundColor: '#1A3C6E',
                          color: '#fff',
                          cursor: isExtractingLedgerText ? 'wait' : 'pointer',
                          opacity: isExtractingLedgerText ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        <FileText style={{ width: 16, height: 16 }} />
                        {isExtractingLedgerText ? '텍스트 추출 중...' : '텍스트 추출'}
                      </button>
                    )}
                  </div>

                  {selectedLedgerOcrFiles.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedLedgerOcrFiles.map((file) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '7px 9px',
                            borderRadius: 8,
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#374151' }}>
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLedgerOcrFiles((prev) => prev.filter((item) => item !== file));
                              setLedgerOcrResult(null);
                            }}
                            disabled={isExtractingLedgerText}
                            style={{
                              width: 24,
                              height: 24,
                              border: 'none',
                              borderRadius: 8,
                              backgroundColor: '#f3f4f6',
                              color: '#6b7280',
                              cursor: isExtractingLedgerText ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <X style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {ledgerOcrPerFileResults.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: '#fff',
                        border: '1px solid #dbeafe',
                      }}
                    >
                      <div style={{ fontSize: 13, color: '#1A3C6E', fontWeight: 800, marginBottom: 10 }}>
                        사진별 추출 결과
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {ledgerOcrPerFileResults.map((item, idx) => {
                          const f = item.fields || {};
                          const extractedParts = [
                            String(f.transactionAt ?? '').trim(),
                            String(f.partner ?? '').trim(),
                            String(f.amount ?? '').trim(),
                            String(f.type ?? '').trim(),
                            String(f.category ?? '').trim(),
                            String(f.paymentMethod ?? '').trim(),
                            String(f.proofType ?? '').trim(),
                          ].filter(Boolean);
                          const extractedText = extractedParts.length > 0
                            ? extractedParts.join(', ')
                            : '추출된 내용이 없습니다.';
                          const confirmMsg = Array.isArray(item.warnings) && item.warnings.length > 0
                            ? item.warnings[0]
                            : '날짜, 금액, 거래처가 맞는지 확인하세요.';
                          return (
                            <div
                              key={idx}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                backgroundColor: '#f8fbff',
                                border: '1px solid #e5e7eb',
                              }}
                            >
                              <div style={{ fontSize: 12, color: '#1A3C6E', fontWeight: 700, marginBottom: 6 }}>
                                [{item.fileName}]
                              </div>
                              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                                <span style={{ color: '#6b7280', fontWeight: 600 }}>추출 내용: </span>
                                {extractedText}
                              </div>
                              <div style={{ fontSize: 11, color: '#92400e', marginTop: 4, lineHeight: 1.5 }}>
                                <span style={{ fontWeight: 600 }}>확인 필요: </span>
                                {confirmMsg}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                        <button
                          type="button"
                          onClick={applyLedgerOcrResult}
                          style={{
                            padding: '10px 12px',
                            border: 'none',
                            borderRadius: 8,
                            backgroundColor: '#10b981',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          입력칸에 반영
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerOcrResult(null);
                            setLedgerOcrPerFileResults([]);
                            ledgerOcrInputRef.current?.click();
                          }}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: 8,
                            backgroundColor: '#fff',
                            color: '#374151',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          다시 추출
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLedgerOcrFiles([]);
                          setLedgerOcrResult(null);
                          setLedgerOcrPerFileResults([]);
                          clearLedgerOcrInput();
                        }}
                        style={{
                          width: '100%',
                          marginTop: 8,
                          padding: '9px 12px',
                          border: 'none',
                          borderRadius: 8,
                          backgroundColor: '#f3f4f6',
                          color: '#4b5563',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        직접 입력하기
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 📒 HARU가계부 OCR 섹션 */}
              {isHouseholdFormat && (
                <div style={{ padding: 12, border: '1px solid #d0f0d0', borderRadius: 10, backgroundColor: '#f6fff6' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A6E1A', marginBottom: 8, fontWeight: 700 }}>
                    <Camera style={{ width: 15, height: 15 }} />
                    영수증에서 자동 입력
                  </label>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    사진은 저장하지 않고 추출 결과를 입력칸에 자동 반영합니다.
                  </p>
                  <input
                    ref={householdOcrInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    onChange={handleHouseholdOcrPhotoSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: selectedHouseholdOcrFiles.length > 0 ? '1fr 1fr' : '1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => householdOcrInputRef.current?.click()}
                      disabled={isExtractingHouseholdText}
                      style={{ width: '100%', padding: '10px 14px', border: '1px dashed #1A6E1A', borderRadius: 8, backgroundColor: '#fff', color: '#1A6E1A', cursor: isExtractingHouseholdText ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}
                    >
                      <Upload style={{ width: 16, height: 16 }} />
                      사진 선택{selectedHouseholdOcrFiles.length > 0 ? ` (${selectedHouseholdOcrFiles.length}장)` : ''}
                    </button>
                    {selectedHouseholdOcrFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExtractHouseholdText}
                        disabled={isExtractingHouseholdText}
                        style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 8, backgroundColor: '#1A6E1A', color: '#fff', cursor: isExtractingHouseholdText ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 800 }}
                      >
                        <FileText style={{ width: 16, height: 16 }} />
                        {isExtractingHouseholdText ? '추출 중...' : '텍스트 추출'}
                      </button>
                    )}
                  </div>
                  {selectedHouseholdOcrFiles.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {selectedHouseholdOcrFiles.map((file) => (
                        <span key={`${file.name}-${file.size}`} style={{ fontSize: 11, padding: '3px 8px', backgroundColor: '#e0f7e0', borderRadius: 10, color: '#1A6E1A' }}>
                          {file.name}
                          <button type="button" onClick={() => setSelectedHouseholdOcrFiles(prev => prev.filter(f => f !== file))} style={{ marginLeft: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#666', fontSize: 11 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 📒 HARU가계부 — 카카오뱅크 XLSX 불러오기 */}
              {isHouseholdFormat && (
                <div style={{ padding: 12, border: '1px solid #c7d2fe', borderRadius: 10, backgroundColor: '#eef2ff' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A3C6E', marginBottom: 8, fontWeight: 700 }}>
                    <FileText style={{ width: 15, height: 15 }} />
                    카카오뱅크 파일 불러오기
                  </label>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    카카오뱅크 거래내역 XLSX(암호 잠김) 파일을 올리면 자동으로 읽어 미리보기로 보여줍니다.
                  </p>
                  <input
                    ref={kakaoXlsxInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleKakaoXlsxFileSelect}
                    style={{ display: 'none' }}
                  />
                  {!showKakaoPasswordPrompt && (
                    <button
                      type="button"
                      onClick={() => kakaoXlsxInputRef.current?.click()}
                      style={{ width: '100%', padding: '10px 14px', border: '1px dashed #1A3C6E', borderRadius: 8, backgroundColor: '#fff', color: '#1A3C6E', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}
                    >
                      <Upload style={{ width: 16, height: 16 }} />
                      카카오뱅크 XLSX 파일 선택
                    </button>
                  )}
                  {showKakaoPasswordPrompt && selectedKakaoXlsxFile && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                        📄 {selectedKakaoXlsxFile.name}
                      </div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 5 }}>
                        파일 비밀번호
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={kakaoXlsxPassword}
                        onChange={(e) => setKakaoXlsxPassword(e.target.value)}
                        placeholder="생년월일 6자리 (예: 620310)"
                        disabled={isDecryptingKakaoXlsx}
                        style={{ width: '100%', padding: '9px 12px', fontSize: 16, border: '1px solid #c7d2fe', borderRadius: 8, backgroundColor: '#fff', color: '#333', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          onClick={handleCancelKakaoXlsxPassword}
                          disabled={isDecryptingKakaoXlsx}
                          style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 8, backgroundColor: '#f3f4f6', color: '#4b5563', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleKakaoXlsxDecryptAndParse}
                          disabled={isDecryptingKakaoXlsx || !kakaoXlsxPassword.trim()}
                          style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: 8, backgroundColor: '#1A3C6E', color: '#fff', cursor: isDecryptingKakaoXlsx ? 'wait' : 'pointer', fontSize: 13, fontWeight: 800 }}
                        >
                          {isDecryptingKakaoXlsx ? '해제 중...' : '잠금 해제'}
                        </button>
                      </div>
                    </div>
                  )}

                  {kakaoXlsxMonthGroups.length > 0 && (
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 700 }}>불러온 거래 미리보기 — 확인 후 저장하세요</span>
                        <button type="button" onClick={() => setKakaoXlsxMonthGroups([])} disabled={isSavingKakaoXlsx}
                          style={{ padding: '4px 10px', border: 'none', borderRadius: 6, backgroundColor: 'transparent', color: '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          목록 지우기
                        </button>
                      </div>
                      {kakaoXlsxMonthGroups.map((group) => {
                        const selectedCount = group.rows.filter((r) => r.selected).length;
                        const allSelected = selectedCount === group.rows.length;
                        return (
                          <div key={group.month} style={{ border: '1px solid #e5e7eb', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#f8faff', borderBottom: '1px solid #e5e7eb' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A3C6E' }}>
                                {group.month.replace('-', '년 ')}월 · {group.rows.length}건 (선택 {selectedCount}건)
                              </span>
                              <button type="button" onClick={() => toggleKakaoMonthSelectAll(group.month, !allSelected)}
                                style={{ padding: '3px 9px', border: '1px solid #c7d2fe', borderRadius: 6, backgroundColor: '#fff', color: '#3730a3', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                {allSelected ? '전체 해제' : '전체 선택'}
                              </button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#fafafa', color: '#6b7280', textAlign: 'left' }}>
                                    {['', '날짜', '구분', '거래처', '금액', '카테고리', '결제수단'].map((label) => (
                                      <th key={label} style={{ padding: '6px 6px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rows.map((row) => {
                                    const categoryOptions = row.entry.transactionType === '수입' ? INCOME_CATEGORIES : HOUSEHOLD_CATEGORIES;
                                    return (
                                      <Fragment key={row.id}>
                                        <tr style={{ backgroundColor: row.warning ? '#fffbeb' : '#fff' }}>
                                          <td style={{ padding: '6px 6px', borderBottom: row.warning ? 'none' : '1px solid #f3f4f6', textAlign: 'center' }}>
                                            <input type="checkbox" checked={row.selected} disabled={isSavingKakaoXlsx}
                                              onChange={() => toggleKakaoRowSelected(group.month, row.id)}
                                              aria-label={`${row.entry.vendor || '거래'} 선택`}
                                              style={{ accentColor: '#1A3C6E' }} />
                                          </td>
                                          <td style={{ padding: '6px 6px', borderBottom: row.warning ? 'none' : '1px solid #f3f4f6', whiteSpace: 'nowrap', color: '#374151' }}>{row.entry.date}</td>
                                          <td style={{ padding: '6px 6px', borderBottom: row.warning ? 'none' : '1px solid #f3f4f6' }}>
                                            <select value={row.entry.transactionType} disabled={isSavingKakaoXlsx}
                                              onChange={(e) => {
                                                const transactionType = e.target.value as HouseholdEntry['transactionType'];
                                                const nextCategoryOptions = transactionType === '수입' ? INCOME_CATEGORIES : HOUSEHOLD_CATEGORIES;
                                                updateKakaoRow(group.month, row.id, {
                                                  transactionType,
                                                  category: (nextCategoryOptions as readonly string[]).includes(row.entry.category) ? row.entry.category : nextCategoryOptions[0],
                                                });
                                              }}
                                              style={{ padding: '4px 5px', border: '1px solid #e5e5e5', borderRadius: 5, fontSize: 11, backgroundColor: '#fff' }}>
                                              <option value="수입">수입</option>
                                              <option value="지출">지출</option>
                                            </select>
                                          </td>
                                          <td style={{ padding: '6px 6px', borderBottom: row.warning ? 'none' : '1px solid #f3f4f6' }}>
                                            <input type="text" value={row.entry.vendor} disabled={isSavingKakaoXlsx}
                                              onChange={(e) => updateKakaoRow(group.month, row.id, { vendor: e.target.value })}
                                              style={{ width: 110, padding: '4px 6px', border: '1px solid #e5e5e5', borderRadius: 5, fontSize: 11, backgroundColor: '#fff', boxSizing: 'border-box' }} />
                                          </td>
                                          <td style={{ padding: '6px 6px', borderBottom: row.warning ? 'none' : '1px solid #f3f4f6' }}>
                                            <input type="text" inputMode="numeric" value={row.entry.amount} disabled={isSavingKakaoXlsx}
                                              onChange={(e) => updateKakaoRow(group.month, row.id, { amount: e.target.value })}
                                              style={{ width: 80, padding: '4px 6px', border: '1px solid #e5e5e5', borderRadius: 5, fontSize: 11, backgroundColor: '#fff', textAlign: 'right', boxSizing: 'border-box' }} />
                                          </td>
                                          <td style={{ padding: '6px 6px', borderBottom: row.warning ? 'none' : '1px solid #f3f4f6' }}>
                                            <select value={row.entry.category} disabled={isSavingKakaoXlsx}
                                              onChange={(e) => updateKakaoRow(group.month, row.id, { category: e.target.value })}
                                              style={{ padding: '4px 5px', border: '1px solid #e5e5e5', borderRadius: 5, fontSize: 11, backgroundColor: '#fff' }}>
                                              {categoryOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                          </td>
                                          <td style={{ padding: '6px 6px', borderBottom: row.warning ? 'none' : '1px solid #f3f4f6' }}>
                                            <select value={row.entry.paymentMethod} disabled={isSavingKakaoXlsx}
                                              onChange={(e) => updateKakaoRow(group.month, row.id, { paymentMethod: e.target.value })}
                                              style={{ padding: '4px 5px', border: '1px solid #e5e5e5', borderRadius: 5, fontSize: 11, backgroundColor: '#fff' }}>
                                              {HOUSEHOLD_PAYMENT_METHODS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                          </td>
                                        </tr>
                                        {row.warning && (
                                          <tr style={{ backgroundColor: '#fffbeb' }}>
                                            <td></td>
                                            <td colSpan={6} style={{ padding: '0 6px 6px', borderBottom: '1px solid #f3f4f6', color: '#b45309', fontSize: 10.5 }}>
                                              ⚠ {row.warning}
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={handleSaveKakaoXlsxImport}
                        disabled={isSavingKakaoXlsx}
                        style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, backgroundColor: '#1A3C6E', color: '#fff', fontSize: 14, fontWeight: 800, cursor: isSavingKakaoXlsx ? 'wait' : 'pointer' }}
                      >
                        {isSavingKakaoXlsx ? '가계부에 저장 중...' : '가계부에 저장'}
                      </button>
                    </div>
                  )}
                </div>
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
                    : isLedgerFormat ? (
                      /* 🧾 HARU보조장부 — 다건 거래 입력 카드 */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {ledgerInputMode === 'period' && expandedLedgerXlsxRowId && (
                          <div style={{ padding: '9px 12px', border: '1px solid #a5b4fc', borderRadius: 8, backgroundColor: '#eef2ff', color: '#3730a3', fontSize: 12, fontWeight: 700 }}>
                            선택한 거래 상세 수정 · 단건 작성과 같은 입력 항목을 사용합니다.
                          </div>
                        )}
                        {visibleLedgerEntries.some(e => e.ocrSourceFile) && (
                          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                            AI가 사진에서 거래 후보를 자동 입력했습니다.<br />
                            저장 전 날짜·금액·거래처를 반드시 확인하세요.
                          </div>
                        )}
                        {visibleLedgerEntries.map((entry, idx) => {
                          const incomeCategories = ['매출', '기타수입'];
                          const expenseCategories = ['식비', '교통비', '통신비', '소프트웨어', '광고비', '교육비', '사무용품', '복리후생비', '접대비', '지급수수료', '기타'];
                          const categoryOptions = entry.transactionType === '수입' ? incomeCategories : entry.transactionType === '지출' ? expenseCategories : [];
                          const fieldLabelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 5, fontWeight: 500 };
                          const fieldInputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e5e5', borderRadius: 7, backgroundColor: '#fff', color: '#333', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
                          return (
                            <div key={entry.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' }}>
                              {/* 카드 헤더 */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E' }}>
                                  거래 {idx + 1}
                                  {entry.ocrSourceFile && (
                                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6, fontWeight: 400 }}>
                                      📷 {entry.ocrSourceFile}
                                    </span>
                                  )}
                                </div>
                                {visibleLedgerEntries.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setVisibleLedgerEntries(prev => prev.filter(e => e.id !== entry.id))}
                                    style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, backgroundColor: '#fff', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    삭제
                                  </button>
                                )}
                              </div>
                              {/* 거래종류 + 사용구분 */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                                <div>
                                  <label style={fieldLabelStyle}>거래종류</label>
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    {(['수입', '지출'] as const).map(opt => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setVisibleLedgerEntries(prev => prev.map(e => e.id === entry.id ? adjustLedgerTaxFieldsForUsage({ ...e, transactionType: opt, category: '' }) : e))}
                                        style={{
                                          flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12, fontWeight: entry.transactionType === opt ? 700 : 400, cursor: 'pointer',
                                          border: entry.transactionType === opt ? 'none' : '1px solid #e5e7eb',
                                          backgroundColor: entry.transactionType === opt ? (opt === '수입' ? '#10b981' : '#ef4444') : '#fff',
                                          color: entry.transactionType === opt ? '#fff' : '#374151',
                                        }}
                                      >
                                        {opt === '수입' ? '💰 수입' : '📤 지출'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>사업구분 *</label>
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    {(['haru2026', 'external'] as const).map(opt => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setVisibleLedgerEntries(prev => prev.map(e => e.id === entry.id ? { ...e, businessTrack: opt } : e))}
                                        style={{
                                          flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12, fontWeight: entry.businessTrack === opt ? 700 : 400, cursor: 'pointer',
                                          border: entry.businessTrack === opt ? 'none' : '1px solid #d0dff0',
                                          backgroundColor: entry.businessTrack === opt ? '#1A3C6E' : '#FEFBE8',
                                          color: entry.businessTrack === opt ? '#fff' : '#1A3C6E',
                                        }}
                                      >
                                        {opt === 'haru2026' ? 'HARU2026' : '외부용역'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>사용구분</label>
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    {(['사업용', '개인용'] as const).map(opt => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setVisibleLedgerEntries(prev => prev.map(e => e.id === entry.id ? adjustLedgerTaxFieldsForUsage({ ...e, usageType: opt }) : e))}
                                        style={{
                                          flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12, fontWeight: entry.usageType === opt ? 700 : 400, cursor: 'pointer',
                                          border: entry.usageType === opt ? 'none' : '1px solid #e5e7eb',
                                          backgroundColor: entry.usageType === opt ? '#1A3C6E' : '#fff',
                                          color: entry.usageType === opt ? '#fff' : '#374151',
                                        }}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {/* 분류 chips */}
                              {categoryOptions.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                  <label style={fieldLabelStyle}>분류</label>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {categoryOptions.map(opt => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setVisibleLedgerEntries(prev => prev.map(e => e.id === entry.id ? { ...e, category: opt } : e))}
                                        style={{
                                          padding: '5px 11px', borderRadius: 18, fontSize: 12, cursor: 'pointer',
                                          border: entry.category === opt ? 'none' : '1px solid #e5e7eb',
                                          backgroundColor: entry.category === opt ? '#7A6F5A' : '#fff',
                                          color: entry.category === opt ? '#fff' : '#374151',
                                          fontWeight: entry.category === opt ? 700 : 400,
                                        }}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                  {/* 기타 선택 시 계정과목 직접입력 */}
                                  {entry.category === '기타' && (
                                    <div style={{ marginTop: 6 }}>
                                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
                                        계정과목 직접입력
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="예: 복리후생비"
                                        value={entry.customCategory ?? ''}
                                        onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, customCategory: e.target.value } : en))}
                                        style={{
                                          width: '100%',
                                          padding: '8px 10px',
                                          border: '1px solid #ddd',
                                          borderRadius: 8,
                                          fontSize: 14,
                                          boxSizing: 'border-box',
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* 날짜 / 거래처 / 금액 / 결제수단 */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                <div>
                                  <label style={fieldLabelStyle}>거래일시</label>
                                  <input
                                    type="text"
                                    value={entry.date}
                                    placeholder="예: 2026.05.18"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, date: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>
                                    거래처
                                    {!entry.vendor.trim() && entry.ocrSourceFile && (
                                      <span style={{ color: '#f59e0b', marginLeft: 4, fontSize: 10 }}>확인필요</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    value={entry.vendor}
                                    placeholder="예: (주)민들레"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, vendor: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>
                                    금액
                                    {!entry.amount.trim() && entry.ocrSourceFile && (
                                      <span style={{ color: '#f59e0b', marginLeft: 4, fontSize: 10 }}>확인필요</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    value={entry.amount}
                                    placeholder="예: 15,000원"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, amount: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>결제수단</label>
                                  <input
                                    type="text"
                                    value={entry.paymentMethod}
                                    placeholder="예: 신용카드"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, paymentMethod: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>증빙유형</label>
                                  <select
                                    value={entry.proofType || ''}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, proofType: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  >
                                    <option value="">선택 안 함</option>
                                    <option value="카드매출전표">카드매출전표</option>
                                    <option value="현금영수증">현금영수증</option>
                                    <option value="현금영수증(지출증빙)">현금영수증(지출증빙)</option>
                                    <option value="세금계산서">세금계산서</option>
                                    <option value="전자세금계산서">전자세금계산서</option>
                                    <option value="계산서">계산서</option>
                                    <option value="전자계산서">전자계산서</option>
                                    <option value={LEDGER_XLSX_PROOF}>{LEDGER_XLSX_PROOF}</option>
                                    <option value="증빙없음">증빙없음</option>
                                    <option value="기타">기타</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>승인번호</label>
                                  <input
                                    type="text"
                                    value={entry.approvalNumber || ''}
                                    placeholder="카드 승인번호 (선택사항)"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, approvalNumber: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div style={{ gridColumn: '1 / -1', marginTop: 4, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                                  <strong style={{ display: 'block', fontSize: 12, color: '#1A3C6E', marginBottom: 3 }}>[부가세]</strong>
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>과세유형, 공급가액, 부가세액, VAT 공제여부, 홈택스 확인을 별도로 관리합니다.</span>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>과세유형</label>
                                  <select
                                    value={entry.vatTaxType || 'review'}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, vatTaxType: e.target.value as LedgerVatTaxType } : en))}
                                    style={fieldInputStyle}
                                  >
                                    {Object.entries(LEDGER_VAT_TAX_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>매입세액 공제 여부</label>
                                  <select
                                    value={entry.vatDeduction || defaultLedgerVatDeduction(entry)}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, vatDeduction: e.target.value as LedgerVatDeduction } : en))}
                                    style={fieldInputStyle}
                                  >
                                    {Object.entries(LEDGER_VAT_DEDUCTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>공급가액</label>
                                  <input
                                    type="text"
                                    value={entry.supplyAmount || ''}
                                    placeholder="예: 100,000원"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, supplyAmount: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>부가세액</label>
                                  <input
                                    type="text"
                                    value={entry.vatAmount || ''}
                                    placeholder="예: 10,000원"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, vatAmount: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>홈택스 확인상태</label>
                                  <select
                                    value={entry.hometaxCheck || 'unchecked'}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, hometaxCheck: e.target.value as LedgerHometaxCheck } : en))}
                                    style={fieldInputStyle}
                                  >
                                    {Object.entries(LEDGER_HOMETAX_CHECK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>공제/확인 사유</label>
                                  <input
                                    type="text"
                                    value={entry.vatDeductionReason || ''}
                                    placeholder="예: 홈택스 자료 대조 필요"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, vatDeductionReason: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                </div>
                                <div style={{ gridColumn: '1 / -1', marginTop: 4, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                                  <strong style={{ display: 'block', fontSize: 12, color: '#166534', marginBottom: 3 }}>[종합소득세]</strong>
                                  <span style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                                    사업 운영에 직접 사용한 구독료는 필요경비로 검토할 수 있습니다. 식사·접대비와 장비·고가 자산은 요건, 한도, 감가상각 여부 확인이 필요합니다.
                                  </span>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>필요경비 여부</label>
                                  <select
                                    value={entry.expenseDeduction || defaultLedgerExpenseDeduction(entry)}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, expenseDeduction: e.target.value as LedgerExpenseDeduction } : en))}
                                    style={fieldInputStyle}
                                  >
                                    {Object.entries(LEDGER_EXPENSE_DEDUCTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>필요경비 사유</label>
                                  <input
                                    type="text"
                                    list={`ledger-expense-reason-${entry.id}`}
                                    value={entry.expenseDeductionReason || ''}
                                    placeholder="예: 앱 운영 구독료"
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, expenseDeductionReason: e.target.value } : en))}
                                    style={fieldInputStyle}
                                  />
                                  <datalist id={`ledger-expense-reason-${entry.id}`}>
                                    {['앱 운영 구독료', '클라우드 서버비', '소프트웨어 사용료', '광고비', '외주비', '사업 관련 식사', '접대비', '장비 구입', '개인사용', '기타'].map((reason) => (
                                      <option key={reason} value={reason} />
                                    ))}
                                  </datalist>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label style={fieldLabelStyle}>업무 관련성 메모</label>
                                  <textarea
                                    value={entry.businessContextMemo || ''}
                                    placeholder="예: HARU2026 베타테스트 참가자 5명과 UX·기능 피드백 회의 후 식사 제공"
                                    rows={3}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, businessContextMemo: e.target.value } : en))}
                                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e5e5', borderRadius: 7, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                  <p style={{ margin: '5px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                                    사업 관련 지출인 이유를 간단히 기록하세요. 참석자, 회의 목적, 테스트 내용 등을 적어두면 추후 증빙 확인에 도움이 됩니다.
                                  </p>
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>비용 처리 방식</label>
                                  <select
                                    value={entry.assetTreatment || defaultLedgerAssetTreatment(entry)}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, assetTreatment: e.target.value as LedgerAssetTreatment } : en))}
                                    style={fieldInputStyle}
                                  >
                                    {Object.entries(LEDGER_ASSET_TREATMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                                </div>
                              </div>
                              {entry.vatTaxType === 'taxable' && !entry.foreignCurrency && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const result = calculateVatIncludedAmounts(entry.amount);
                                    if (!result) {
                                      toast.warning('금액을 먼저 입력해 주세요.');
                                      return;
                                    }
                                    setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, ...result } : en));
                                  }}
                                  style={{ width: '100%', marginBottom: 8, padding: '8px 10px', border: '1px solid #a7f3d0', borderRadius: 7, backgroundColor: '#ecfdf5', color: '#047857', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  부가세 포함 총액에서 공급가액/부가세액 계산
                                </button>
                              )}
                              {/* 외화 거래 (선택) */}
                              <div style={{ marginBottom: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
                                  <input
                                    type="checkbox"
                                    checked={entry.foreignCurrency !== ''}
                                    onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id
                                      ? {
                                          ...en,
                                          foreignCurrency: e.target.checked ? 'USD' : '',
                                          foreignAmount: e.target.checked ? en.foreignAmount : '',
                                          exchangeRate: e.target.checked ? en.exchangeRate : '',
                                          vatTaxType: e.target.checked ? 'review' : en.vatTaxType,
                                          vatDeduction: e.target.checked && en.transactionType === '지출' && en.usageType === '사업용' ? 'review' : en.vatDeduction,
                                        }
                                      : en))}
                                    style={{ width: 14, height: 14, accentColor: '#1A3C6E' }}
                                  />
                                  외화 거래 (해외결제·외화입금)
                                </label>
                                {entry.foreignCurrency !== '' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 6, marginTop: 6 }}>
                                    <div>
                                      <label style={{ ...fieldLabelStyle, fontSize: 11 }}>외화금액</label>
                                      <input
                                        type="text"
                                        value={entry.foreignAmount}
                                        placeholder="예: 5.00"
                                        onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, foreignAmount: e.target.value } : en))}
                                        style={{ ...fieldInputStyle, fontSize: 12 }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ ...fieldLabelStyle, fontSize: 11 }}>통화</label>
                                      <select
                                        value={entry.foreignCurrency}
                                        onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, foreignCurrency: e.target.value } : en))}
                                        style={{ width: '100%', padding: '8px 4px', fontSize: 12, border: '1px solid #e5e5e5', borderRadius: 7, outline: 'none', boxSizing: 'border-box' }}
                                      >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="JPY">JPY</option>
                                        <option value="GBP">GBP</option>
                                        <option value="CNY">CNY</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ ...fieldLabelStyle, fontSize: 11 }}>적용환율</label>
                                      <input
                                        type="text"
                                        value={entry.exchangeRate}
                                        placeholder="예: 1,349"
                                        onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, exchangeRate: e.target.value } : en))}
                                        style={{ ...fieldInputStyle, fontSize: 12 }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* 메모 */}
                              <div>
                                <label style={fieldLabelStyle}>메모</label>
                                <textarea
                                  value={entry.memo}
                                  placeholder="관련 메모 (선택사항)"
                                  rows={2}
                                  onChange={e => setVisibleLedgerEntries(prev => prev.map(en => en.id === entry.id ? { ...en, memo: e.target.value } : en))}
                                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e5e5', borderRadius: 7, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {/* 거래 추가 버튼 */}
                        {ledgerInputMode === 'single' && <button
                          type="button"
                          onClick={() => setLedgerEntries(prev => [...prev, newLedgerEntry()])}
                          style={{ width: '100%', padding: '10px', border: '1px dashed #d1d5db', borderRadius: 8, backgroundColor: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          + 거래 추가
                        </button>}
                        {/* 면책 문구 */}
                        {ledgerInputMode === 'single' && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                          이 기능은 개인 및 사업자의 수입·지출 기록을 돕기 위한 보조장부입니다.<br />
                          세무 신고나 회계 자문을 대체하지 않습니다.
                        </p>}
                      </div>
                    ) : isHouseholdFormat ? (
                      /* 📒 HARU가계부 — 다건 거래 입력 카드 */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {householdEntries.some(e => e.ocrSourceFile) && (
                          <div style={{ backgroundColor: '#f0fff4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
                            AI가 사진에서 거래 후보를 자동 입력했습니다.<br />
                            저장 전 날짜·금액·사용처를 반드시 확인하세요.
                          </div>
                        )}
                        {householdEntries.map((entry, idx) => {
                          const categoryOptions = entry.transactionType === '수입' ? INCOME_CATEGORIES : HOUSEHOLD_CATEGORIES;
                          const fieldLabelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 5, fontWeight: 500 };
                          const fieldInputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e5e5', borderRadius: 7, backgroundColor: '#fff', color: '#333', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
                          const updateTransactionType = (transactionType: HouseholdEntry['transactionType']) => {
                            setHouseholdEntries(prev => prev.map(e => e.id === entry.id ? {
                              ...e,
                              transactionType,
                              category: transactionType === '이체' ? '이체' : '',
                              vendor: transactionType === '이체' ? '' : e.vendor,
                              paymentMethod: transactionType === '이체' ? (e.paymentMethod || '계좌이체') : e.paymentMethod,
                            } : e));
                          };
                          return (
                            <div key={entry.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                                  거래 {idx + 1}
                                  {entry.ocrSourceFile && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6, fontWeight: 400 }}>📷 {entry.ocrSourceFile}</span>}
                                </div>
                                {householdEntries.length > 1 && (
                                  <button type="button" onClick={() => setHouseholdEntries(prev => prev.filter(e => e.id !== entry.id))}
                                    style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, backgroundColor: '#fff', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                    삭제
                                  </button>
                                )}
                              </div>
                              {/* 거래종류 */}
                              <div style={{ marginBottom: 10 }}>
                                <label style={fieldLabelStyle}>거래종류</label>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  {(['수입', '지출', '이체'] as const).map(opt => (
                                    <button key={opt} type="button"
                                      onClick={() => updateTransactionType(opt)}
                                      style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12, fontWeight: entry.transactionType === opt ? 700 : 400, cursor: 'pointer', border: entry.transactionType === opt ? 'none' : '1px solid #e5e7eb', backgroundColor: entry.transactionType === opt ? (opt === '수입' ? '#10b981' : opt === '이체' ? '#3b82f6' : '#ef4444') : '#fff', color: entry.transactionType === opt ? '#fff' : '#374151' }}>
                                      {opt === '수입' ? '💰 수입' : opt === '이체' ? '🔄 이체' : '📤 지출'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* 카테고리 */}
                              {entry.transactionType !== '이체' && (
                                <div style={{ marginBottom: 10 }}>
                                  <label style={fieldLabelStyle}>카테고리</label>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {categoryOptions.map(opt => (
                                      <button key={opt} type="button"
                                        onClick={() => setHouseholdEntries(prev => prev.map(e => e.id === entry.id ? { ...e, category: opt } : e))}
                                        style={{ padding: '5px 11px', borderRadius: 18, fontSize: 12, cursor: 'pointer', border: entry.category === opt ? 'none' : '1px solid #e5e7eb', backgroundColor: entry.category === opt ? '#166534' : '#fff', color: entry.category === opt ? '#fff' : '#374151', fontWeight: entry.category === opt ? 700 : 400 }}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* 날짜·금액 */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                                <div>
                                  <label style={fieldLabelStyle}>날짜</label>
                                  <input type="text" placeholder="2026.06.25" value={entry.date} style={{ ...fieldInputStyle, fontSize: 16 }}
                                    onChange={e => setHouseholdEntries(prev => prev.map(en => en.id === entry.id ? { ...en, date: e.target.value } : en))} />
                                </div>
                                <div>
                                  <label style={fieldLabelStyle}>금액</label>
                                  <input type="text" inputMode="numeric" placeholder="50000" value={entry.amount} style={{ ...fieldInputStyle, fontSize: 16 }}
                                    onChange={e => setHouseholdEntries(prev => prev.map(en => en.id === entry.id ? { ...en, amount: e.target.value } : en))} />
                                </div>
                              </div>
                              {/* 사용처/출처 */}
                              {entry.transactionType !== '이체' && (
                                <div style={{ marginBottom: 10 }}>
                                  <label style={fieldLabelStyle}>{entry.transactionType === '수입' ? '출처/내역 (선택)' : '사용처'}</label>
                                  <input type="text" placeholder={entry.transactionType === '수입' ? '회사명, 거래처, 출처 등' : '마트, 편의점, 카페 등'} value={entry.vendor} style={{ ...fieldInputStyle, fontSize: 16 }}
                                    onChange={e => setHouseholdEntries(prev => prev.map(en => en.id === entry.id ? { ...en, vendor: e.target.value } : en))} />
                                </div>
                              )}
                              {/* 결제수단 */}
                              {entry.transactionType !== '이체' && (
                                <div style={{ marginBottom: 10 }}>
                                  <label style={fieldLabelStyle}>결제수단</label>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {HOUSEHOLD_PAYMENT_METHODS.map(opt => (
                                      <button key={opt} type="button"
                                        onClick={() => setHouseholdEntries(prev => prev.map(e => e.id === entry.id ? { ...e, paymentMethod: opt } : e))}
                                        style={{ padding: '5px 11px', borderRadius: 18, fontSize: 12, cursor: 'pointer', border: entry.paymentMethod === opt ? 'none' : '1px solid #e5e7eb', backgroundColor: entry.paymentMethod === opt ? '#1A3C6E' : '#fff', color: entry.paymentMethod === opt ? '#fff' : '#374151', fontWeight: entry.paymentMethod === opt ? 700 : 400 }}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* 메모 */}
                              <div>
                                <label style={fieldLabelStyle}>메모 (선택)</label>
                                <input type="text" placeholder={entry.transactionType === '이체' ? '어디서 → 어디로 (예: 급여통장 → 생활비통장)' : '참고사항'} value={entry.memo} style={{ ...fieldInputStyle, fontSize: 16 }}
                                  onChange={e => setHouseholdEntries(prev => prev.map(en => en.id === entry.id ? { ...en, memo: e.target.value } : en))} />
                              </div>
                            </div>
                          );
                        })}
                        {/* 거래 추가 버튼 */}
                        <button type="button" onClick={() => setHouseholdEntries(prev => [...prev, newHouseholdEntry()])}
                          style={{ width: '100%', padding: '10px', border: '1px dashed #86efac', borderRadius: 8, backgroundColor: '#f0fff4', color: '#166534', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          + 거래 추가
                        </button>
                      </div>
                    ) : isVoidingFormat ? (
                      /* 🚿 배뇨일지 — 원버튼 입력 */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* 취침·기상 시각 */}
                        <div style={{ border: '1px solid #e0e7ff', borderRadius: 10, padding: 14, backgroundColor: '#f5f3ff' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6', marginBottom: 10 }}>취침·기상 시각</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[{ label: '취침', val: voidingBedtime, set: setVoidingBedtime }, { label: '기상', val: voidingWaketime, set: setVoidingWaketime }].map(({ label, val, set }) => (
                              <div key={label}>
                                <label style={{ display: 'block', fontSize: 12, color: '#7c3aed', marginBottom: 4, fontWeight: 500 }}>{label}</label>
                                <input type="text" inputMode="numeric" placeholder="22:30" value={val} onChange={e => set(e.target.value)}
                                  style={{ width: '100%', padding: '8px 10px', fontSize: 16, border: '1px solid #c4b5fd', borderRadius: 7, backgroundColor: '#fff', color: '#333', outline: 'none', boxSizing: 'border-box' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* 원버튼 기록 */}
                        {(() => {
                          const now = new Date();
                          const h = now.getHours(); const m = String(now.getMinutes()).padStart(2, '0');
                          const label = `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h || 12}:${m}`;
                          const totalMl = voidingEntries.reduce((s, e) => s + e.amountMl, 0);
                          return (
                            <div style={{ border: '1px solid #bae6fd', borderRadius: 10, padding: 14, backgroundColor: '#f0f9ff' }}>
                              <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
                                지금 시각: <strong>{label}</strong>
                                {voidingEntries.length > 0 && <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}>({voidingEntries.length}건 · {totalMl}ml)</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="양 (ml)"
                                  value={voidingAmountInput}
                                  onChange={e => setVoidingAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                                  onKeyDown={e => {
                                    if (e.key !== 'Enter') return;
                                    const n = new Date();
                                    const t = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
                                    const ml = parseInt(voidingAmountInput || '0', 10);
                                    const entry: import('../utils/voidingStats').VoidingEntry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), time: t, type: 'void', amountMl: isNaN(ml) ? 0 : ml };
                                    setVoidingEntries(prev => [...prev, entry].sort((a,b) => a.time.localeCompare(b.time)));
                                    setVoidingAmountInput('');
                                  }}
                                  style={{ flex: 1, padding: '12px', fontSize: 20, border: '2px solid #bae6fd', borderRadius: 8, backgroundColor: '#fff', color: '#333', outline: 'none', textAlign: 'center', fontWeight: 700 }} />
                                <button type="button"
                                  onClick={() => {
                                    const n = new Date();
                                    const t = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
                                    const ml = parseInt(voidingAmountInput || '0', 10);
                                    const entry: import('../utils/voidingStats').VoidingEntry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), time: t, type: 'void', amountMl: isNaN(ml) ? 0 : ml };
                                    setVoidingEntries(prev => [...prev, entry].sort((a,b) => a.time.localeCompare(b.time)));
                                    setVoidingAmountInput('');
                                  }}
                                  style={{ padding: '12px 20px', border: 'none', borderRadius: 8, backgroundColor: '#0369a1', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>기록</button>
                              </div>
                              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>양을 모르면 비워도 됩니다</div>
                            </div>
                          );
                        })()}
                        {/* 오늘 기록 리스트 */}
                        {voidingEntries.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 2 }}>
                              오늘 기록 ({voidingEntries.length}건 · {voidingEntries.reduce((s,e) => s + e.amountMl, 0)}ml)
                            </div>
                            {voidingEntries.map(e => (
                              editingVoidingId === e.id ? (
                                <div key={e.id} style={{ border: '1px solid #0369a1', borderRadius: 8, padding: '10px 12px', backgroundColor: '#eff6ff', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input type="text" inputMode="numeric" placeholder="HH:MM" value={editingVoidingEntry.time}
                                      onChange={ex => setEditingVoidingEntry(v => ({ ...v, time: ex.target.value }))}
                                      style={{ flex: 1, padding: '6px 8px', fontSize: 14, border: '1px solid #bae6fd', borderRadius: 6, backgroundColor: '#fff', color: '#333', outline: 'none' }} />
                                    <input type="text" inputMode="numeric" placeholder="ml" value={editingVoidingEntry.amountMl}
                                      onChange={ex => setEditingVoidingEntry(v => ({ ...v, amountMl: ex.target.value.replace(/[^0-9]/g, '') }))}
                                      style={{ flex: 1, padding: '6px 8px', fontSize: 14, border: '1px solid #bae6fd', borderRadius: 6, backgroundColor: '#fff', color: '#333', outline: 'none' }} />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {(['절박감', '통증', '유실', '요의로 깸', '없음'] as const).map(sym => (
                                      <button key={sym} type="button"
                                        onClick={() => setEditingVoidingEntry(v => ({ ...v, symptom: v.symptom === sym ? '' : sym }))}
                                        style={{ padding: '4px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer', border: editingVoidingEntry.symptom === sym ? 'none' : '1px solid #e5e7eb', backgroundColor: editingVoidingEntry.symptom === sym ? '#0369a1' : '#fff', color: editingVoidingEntry.symptom === sym ? '#fff' : '#374151', fontWeight: editingVoidingEntry.symptom === sym ? 700 : 400 }}>
                                        {sym}
                                      </button>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button type="button"
                                      onClick={() => {
                                        const ml = parseInt(editingVoidingEntry.amountMl || '0', 10);
                                        const sym = (editingVoidingEntry.symptom as import('../utils/voidingStats').VoidingSymptom) || undefined;
                                        setVoidingEntries(prev => prev.map(x => x.id !== e.id ? x : ({ ...x, time: editingVoidingEntry.time || x.time, amountMl: isNaN(ml) ? x.amountMl : ml, symptom: sym })).sort((a,b) => a.time.localeCompare(b.time)));
                                        setEditingVoidingId(null);
                                      }}
                                      style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 6, backgroundColor: '#0369a1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                                    <button type="button"
                                      onClick={() => { setVoidingEntries(prev => prev.filter(x => x.id !== e.id)); setEditingVoidingId(null); }}
                                      style={{ padding: '7px 12px', border: '1px solid #fca5a5', borderRadius: 6, backgroundColor: '#fff', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>삭제</button>
                                    <button type="button"
                                      onClick={() => setEditingVoidingId(null)}
                                      style={{ padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 6, backgroundColor: '#fff', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>취소</button>
                                  </div>
                                </div>
                              ) : (
                                <button key={e.id} type="button"
                                  onClick={() => { setEditingVoidingId(e.id); setEditingVoidingEntry({ time: e.time, amountMl: String(e.amountMl), symptom: e.symptom || '', note: e.note || '' }); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, backgroundColor: '#eff6ff', fontSize: 13, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                                  <span style={{ fontWeight: 700, color: '#374151', minWidth: 42 }}>{e.time}</span>
                                  <span style={{ color: '#0369a1', fontWeight: 600 }}>🚽</span>
                                  <span style={{ color: '#374151' }}>{e.amountMl > 0 ? `${e.amountMl}ml` : '—'}</span>
                                  {e.symptom && <span style={{ color: '#9ca3af' }}>· {e.symptom}</span>}
                                  <span style={{ marginLeft: 'auto', color: '#c4b5fd', fontSize: 11 }}>탭하여 수정</span>
                                </button>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    ) : fields
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
                              ref={field.key === 'reading_journal' ? readingJournalRef : undefined}
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

              {/* 📸 사진 업로드 섹션 — 독서사유/주식 OCR 사진은 저장하지 않음. 보조장부는 OCR(비저장)과 사진첨부(저장) 둘 다 제공 */}
              {format !== '독서사유' && !isStockFormat && !isVoidingFormat && (!(isLedgerFormat && ledgerInputMode === 'period') || Boolean(expandedLedgerXlsxRowId)) && (
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4, fontWeight: 500 }}>
                  📸 {isLedgerFormat ? '증빙사진' : '사진'} <span style={{ fontWeight: 400, color: '#9ca3af' }}>(선택사항)</span>
                </label>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, marginTop: 0 }}>
                  {isLedgerFormat
                    ? '사진 없이도 저장할 수 있습니다 · 최대 10장 · PNG, JPG, JPEG, WEBP, HEIC'
                    : '사진 없이도 저장할 수 있습니다 · 최대 3장 · PNG, JPG, JPEG, WEBP, HEIC'}
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
                    disabled={isUploading || activeUploadedImages.length >= 3}
                    style={{
                      width: '100%',
                      padding: '17px',
                      border: '1px solid #e4e4e4',
                      borderRadius: '20px',
                      backgroundColor: '#f7f7f7',
                      cursor: isUploading || activeUploadedImages.length >= 3 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isUploading || activeUploadedImages.length >= 3 ? 0.5 : 1,
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
                    disabled={isUploading || activeUploadedImages.length >= (isLedgerFormat ? 10 : 3)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: 13,
                      border: '1px dashed #d1d5db',
                      borderRadius: 8,
                      backgroundColor: '#f9fafb',
                      color: '#6b7280',
                      cursor: isUploading || activeUploadedImages.length >= (isLedgerFormat ? 10 : 3) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      opacity: isUploading || activeUploadedImages.length >= (isLedgerFormat ? 10 : 3) ? 0.5 : 1,
                    }}
                  >
                    <Upload style={{ width: 16, height: 16 }} />
                    {isUploading ? '업로드 중...' : isLedgerFormat
                      ? `증빙사진 선택 (${activeUploadedImages.length}/10)`
                      : `사진 추가 (${activeUploadedImages.length}/3)`}
                  </button>
                )}

                {activeUploadedImages.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {/* 4장 이상: 보조장부 전용 — 3열 그리드 */}
                    {activeUploadedImages.length >= 4 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {activeUploadedImages.map((url, index) => (
                          <div key={index} style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
                            <img
                              src={url}
                              alt={`증빙사진 ${index + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e5e5' }}
                            />
                            <button
                              onClick={() => handleDeleteImage(url, index)}
                              style={{
                                position: 'absolute', top: 4, right: 4,
                                width: 24, height: 24, borderRadius: '50%',
                                backgroundColor: '#ef4444', color: '#fff',
                                border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                              }}
                            >
                              <Trash2 style={{ width: 13, height: 13 }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 1장: 큰 사진 1개 */}
                    {activeUploadedImages.length === 1 && (
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                        <img
                          src={activeUploadedImages[0]}
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
                          onClick={() => handleDeleteImage(activeUploadedImages[0], 0)}
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
                    {activeUploadedImages.length === 2 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {activeUploadedImages.map((url, index) => (
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
                    {activeUploadedImages.length === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                          <img
                            src={activeUploadedImages[0]}
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
                            onClick={() => handleDeleteImage(activeUploadedImages[0], 0)}
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
                          {activeUploadedImages.slice(1).map((url, index) => (
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
                    <>{isEditingReadingEntry ? '📖 회차 수정 저장하기' : '📖 독서장 추가하기'}</>
                  )}
                </button>
                <button
                  onClick={isEditingReadingEntry ? cancelReadingEdit : handleReadingFinishClick}
                  disabled={isReadingFinishing || isSaving || isPolishing}
                  style={{
                    padding: '12px 16px',
                    fontSize: 14,
                    border: '1px solid #1A3C6E',
                    borderRadius: 8,
                    backgroundColor: isEditingReadingEntry ? '#fff' : '#1A3C6E',
                    color: isEditingReadingEntry ? '#1A3C6E' : '#FAF9F6',
                    cursor: (isReadingFinishing || isSaving || isPolishing) ? 'not-allowed' : 'pointer',
                    opacity: (isReadingFinishing || isSaving || isPolishing) ? 0.7 : 1,
                    fontWeight: 700,
                  }}
                  title={isEditingReadingEntry ? '수정 중인 회차를 닫고 새 회차 입력으로 돌아가기' : '같은 책의 모든 chapter_note 를 모아 final_reflection 으로 마무리'}
                >
                  {isEditingReadingEntry ? '수정 취소' : isReadingFinishing ? '분석 중...' : '✨ 독서마무리하기'}
                </button>
              </div>
            ) : isLedgerFormat ? (
              /* 🧾 HARU보조장부 전용 저장 버튼 */
              <button
                onClick={ledgerInputMode === 'period' ? handleSaveLedgerXlsxRows : handleSaveOriginalAsSayu}
                disabled={ledgerInputMode === 'period'
                  ? isSavingLedgerXlsx || ledgerPeriodSelectedRows.length === 0
                  : isSaving}
                style={{ width: '100%', padding: '14px', fontSize: 15, border: 'none', borderRadius: 8, backgroundColor: '#1A3C6E', color: '#fff', cursor: isSaving || isSavingLedgerXlsx ? 'not-allowed' : 'pointer', opacity: isSaving || isSavingLedgerXlsx || (ledgerInputMode === 'period' && ledgerPeriodSelectedRows.length === 0) ? 0.7 : 1, fontWeight: 700 }}
              >
                {ledgerInputMode === 'period'
                  ? isSavingLedgerXlsx ? '기간별 저장 중...' : `선택 거래 기간별 저장하기 (${ledgerPeriodSelectedRows.length}건)`
                  : isSaving ? '저장 중...' : `거래 저장하기 (${ledgerEntries.length}건)`}
              </button>
            ) : isHouseholdFormat ? (
              /* 📒 HARU가계부 전용 저장 버튼 */
              <button
                onClick={handleSaveHouseholdEntries}
                disabled={isSaving}
                style={{ width: '100%', padding: '14px', fontSize: 15, border: 'none', borderRadius: 8, backgroundColor: '#166534', color: '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, fontWeight: 700 }}
              >
                {isSaving ? '저장 중...' : `거래 저장하기 (${householdEntries.length}건)`}
              </button>
            ) : isVoidingFormat ? (
              /* 🚿 배뇨일지 전용 저장 버튼 */
              <button
                onClick={handleSaveVoidingEntries}
                disabled={isSaving}
                style={{ width: '100%', padding: '14px', fontSize: 15, border: 'none', borderRadius: 8, backgroundColor: '#0369a1', color: '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, fontWeight: 700 }}
              >
                {isSaving ? '저장 중...' : `배뇨일지 저장 (${voidingEntries.length}건)`}
              </button>
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
                      AI 다듬은 후 SAYU-나의기록 저장
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
                  {isSaving ? '저장 중...' : '다듬지 않고 SAYU-나의기록 저장'}
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
                {isSaving ? '저장 중...' : '💾 SAYU-나의기록 저장'}
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
