import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Camera, Leaf, Loader2, Search, X, Save, AlertTriangle, ChevronDown, ChevronUp, BookOpen, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, arrayUnion, collection, getDocs, query, where, limit, serverTimestamp, increment, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../services/imageService';
import type { PlantAsset, PlantAssetSourceType } from '../types/haruTypes';

// ===========================================
// 응답 타입 — functions/src/index.ts detectPlantAdvanced 와 동기
// ===========================================
type PlantIdSection = {
  name: string;
  latinName: string;
  confidence: number;          // 0~1
  isPlantProbability: number | null;
  family?: string;
  genus?: string;
  alternatives: { name: string; latinName: string; probability: number }[];
  url: string | null;
};

type PlantNetSection = {
  name: string;
  scientificName: string;
  confidence: number;          // 0~1
  koName?: string | null;            // Functions plant_dictionary 검정 결과
  scientificKey?: string | null;     // plant_dictionary 문서 ID (binomial 정규화)
  family?: string;
  genus?: string;
  alternatives: { name: string; scientificName: string; score: number }[];
};

type GeminiSection = {
  finalGuess: string;
  finalLatinName: string;
  analysis: string;
  warning: string;
  edible: 'unknown' | 'yes' | 'no';
  poisonousRisk: boolean;
  similarSpecies: string[];
  needMorePhotos: string[];
  confidence: 'high' | 'medium' | 'low';
};

type AdvancedResult = {
  plantId: PlantIdSection | null;
  plantNet: PlantNetSection | null;
  gemini: GeminiSection | null;
  meta: { imageCount: number; plantNetAvailable: boolean; geminiError: string | null };
};

// 🌿 NIBR 국내 생물종 보강 정보 (functions: getKoreanPlantInfo 응답)
type KoreanPlantInfoResponse = {
  koreanName: string | null;
  scientificName: string | null;
  phylumName: string | null;
  className: string | null;
  orderName: string | null;
  familyName: string | null;
  genusName: string | null;
  speciesKoreanName: string | null;
  source: 'NIBR';
  rawMatched: boolean;
  status: 'matched' | 'not_found' | 'api_unavailable' | 'not_configured';
};

const emptyKoreanPlantInfo = (
  status: KoreanPlantInfoResponse['status'],
): KoreanPlantInfoResponse => ({
  koreanName: null,
  scientificName: null,
  phylumName: null,
  className: null,
  orderName: null,
  familyName: null,
  genusName: null,
  speciesKoreanName: null,
  source: 'NIBR',
  rawMatched: false,
  status,
});

type PhotoItem = {
  id: string;
  previewUrl: string;
  base64: string;
  mimeType: string;
};

const MAX_PHOTOS = 5;

// 📚 내 도감 매칭 — 이름 후보 정규화
function normName(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}

type LibraryMatch = {
  id: string;
  userConfirmedName?: string;
  finalGuess?: string;
  englishName?: string;
  scientificName?: string;
  photo: string | null;
  date?: string;
  source?: 'user_confirmed' | 'ai' | string;
  matchedOn: string;
};

type PlantLibraryItem = {
  id: string;
  displayName?: string;
  finalGuess?: string;
  finalLatinName?: string;
  englishName?: string;
  scientificName?: string;
  userConfirmedName?: string;
  date?: string;
  photos?: string[];
  imageUrl?: string;
  updatedAt?: any;
  createdAt?: any;
  observationCount?: number;
};

const PHOTO_GUIDE_ITEMS = [
  { icon: '🌿', label: '잎 앞면', hint: '광택·잎맥 확인용' },
  { icon: '🍃', label: '잎 뒷면', hint: '잎털·색감 확인용' },
  { icon: '🪴', label: '줄기', hint: '굵기·가시·털 확인용' },
  { icon: '🌸', label: '꽃', hint: '핀 상태가 있다면 필수' },
  { icon: '🌳', label: '전체 모습', hint: '키·형태 확인용' },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = typeof reader.result === 'string' ? reader.result : '';
      resolve(r.split(',')[1] || r);
    };
    reader.onerror = () => reject(new Error('FILE_READER_ERROR'));
    reader.readAsDataURL(blob);
  });
}

function pctText(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

// 🇰🇷 NIBR 보강은 관리자 전용 — 기존 프로젝트 관리자 판별 방식(UID 상수)과 동일
const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function PlantDetectivePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.uid === ADMIN_UID;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AdvancedResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToToday, setSavedToToday] = useState(false);
  const [activeTab, setActiveTab] = useState<'detect' | 'recent' | 'library'>('detect');
  const [plantLibrary, setPlantLibrary] = useState<PlantLibraryItem[]>([]);
  const [communityCorrectionKnown, setCommunityCorrectionKnown] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  // 📚 내 도감 매칭
  const [libraryMatches, setLibraryMatches] = useState<LibraryMatch[]>([]);
  // ✍️ 사용자 직접 이름 확정
  const [userConfirmedName, setUserConfirmedName] = useState('');
  const [userConfirmedEnglishName, setUserConfirmedEnglishName] = useState('');
  const [userConfirmedScientificName, setUserConfirmedScientificName] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmedSavedDocId, setConfirmedSavedDocId] = useState<string | null>(null);
  // 현재 결과를 plants/ 컬렉션에 한 번 저장했다면 그 plantId를 기억 — 재저장 시 update
  const [activePlantDocId, setActivePlantDocId] = useState<string | null>(null);
  const [activePlantImageUrls, setActivePlantImageUrls] = useState<string[]>([]);
  const [activePlantCreatedAt, setActivePlantCreatedAt] = useState<number | null>(null);
  // 🌿 NIBR 국내 생물종 보강 정보 — 분석 후 비동기로 조회 (실패해도 기존 흐름 무영향)
  const [koreanInfo, setKoreanInfo] = useState<KoreanPlantInfoResponse | null>(null);

  // 🌱 v1 사용자입력 기반 식물 자산 저장 — AI 흐름과 독립
  const [showV1Form, setShowV1Form] = useState(false);
  const [showV1Advanced, setShowV1Advanced] = useState(false);
  const [v1PlantName, setV1PlantName] = useState('');
  const [v1AiGuess, setV1AiGuess] = useState('');
  const [v1Confidence, setV1Confidence] = useState<string>('1');
  const [v1SourceType, setV1SourceType] = useState<PlantAssetSourceType>('real_photo');
  const [v1Memo, setV1Memo] = useState('');
  const [v1ImageUrlsText, setV1ImageUrlsText] = useState('');
  const [v1UserConfirmed, setV1UserConfirmed] = useState(false);
  const [v1Saving, setV1Saving] = useState(false);
  const [v1LastSavedId, setV1LastSavedId] = useState<string | null>(null);

  // 📔 오늘의 관찰 — records/{date}.plantObservation[] 저장용
  const [obsObservation, setObsObservation] = useState('');
  const [obsAiDifference, setObsAiDifference] = useState('');
  const [obsMemo, setObsMemo] = useState('');
  const [obsSaving, setObsSaving] = useState(false);
  const [obsSavedAt, setObsSavedAt] = useState<string | null>(null);

  const buildAiUserTitle = (aiKoName?: string | null, aiPrediction?: string | null, userName?: string | null) => {
    const aiName = (aiKoName || aiPrediction || '').trim();
    const reportedName = (userName || '').trim();
    if (reportedName && aiName && reportedName !== aiName) {
      return `AI 판독: ${aiName} / 사용자 보고: ${reportedName}`;
    }
    return reportedName || aiName || '식물 이름 불확실';
  };

  const loadPlantLibrary = async () => {
    if (!user) {
      setPlantLibrary([]);
      return;
    }
    try {
      const q = query(
        collection(db, 'users', user.uid, 'plants'),
        orderBy('updatedAt', 'desc'),
        limit(30),
      );
      const snap = await getDocs(q);
      setPlantLibrary(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.warn('내 식물도감 조회 실패:', e);
    }
  };

  useEffect(() => {
    loadPlantLibrary();
  }, [user?.uid]);

  const resetSessionState = () => {
    setResult(null);
    setSavedToToday(false);
    setLibraryMatches([]);
    setCommunityCorrectionKnown(false);
    setUserConfirmedName('');
    setUserConfirmedEnglishName('');
    setUserConfirmedScientificName('');
    setConfirmedSavedDocId(null);
    setActivePlantDocId(null);
    setActivePlantImageUrls([]);
    setActivePlantCreatedAt(null);
    setKoreanInfo(null);
    setObsObservation('');
    setObsAiDifference('');
    setObsMemo('');
    setObsSavedAt(null);
  };

  // 🎯 최종 식물명 확정 state object — 향후 도감 저장 시 그대로 직렬화 가능한 형태로 유지
  const finalConfirmation = useMemo(() => {
    if (!result) return null;
    const aiPrediction = result.plantNet?.name || result.plantId?.name || result.gemini?.finalGuess || '';
    const aiKoName = result.plantNet?.koName || result.gemini?.finalGuess || null;
    const aiScientificName =
      result.plantNet?.scientificName || result.gemini?.finalLatinName || result.plantId?.latinName || '';
    const aiEnglishName = result.plantNet?.name || result.plantId?.name || '';
    const userInput = userConfirmedName.trim();
    const userEnglish = userConfirmedEnglishName.trim();
    const userScientific = userConfirmedScientificName.trim();
    const hasUserConfirmation = userInput.length > 0;
    const correctedByUser =
      userInput.length > 0 && userInput !== (aiKoName || aiPrediction);
    return {
      aiPrediction,
      aiKoName,
      aiScientificName,
      aiEnglishName,
      scientificName: userScientific || (hasUserConfirmation ? '' : aiScientificName),
      englishName: userEnglish || (hasUserConfirmation ? '' : aiEnglishName),
      userConfirmedName: userInput,
      userConfirmedEnglishName: userEnglish,
      userConfirmedScientificName: userScientific,
      displayName: buildAiUserTitle(aiKoName, aiPrediction, userInput),
      correctedByUser,
    };
  }, [result, userConfirmedName, userConfirmedEnglishName, userConfirmedScientificName]);

  const getDisplayIdentity = () => {
    if (!result) {
      return {
        title: '식물 이름 불확실',
        englishName: '',
        scientificName: '',
        aiPrediction: '',
        aiKoName: '',
        confidence: null as number | null,
      };
    }
    const aiPrediction = result.plantNet?.name || result.plantId?.name || result.gemini?.finalGuess || '';
    const aiKoName = result.plantNet?.koName || result.gemini?.finalGuess || '';
    const title = buildAiUserTitle(aiKoName, aiPrediction, userConfirmedName);
    const hasUserConfirmation = userConfirmedName.trim().length > 0;
    return {
      title,
      englishName:
        userConfirmedEnglishName.trim() ||
        (hasUserConfirmation ? '' : result.plantNet?.name || result.plantId?.name || ''),
      scientificName:
        userConfirmedScientificName.trim() ||
        (hasUserConfirmation
          ? ''
          : result.plantNet?.scientificName || result.gemini?.finalLatinName || result.plantId?.latinName || ''),
      aiPrediction,
      aiKoName,
      confidence: (result.plantId?.confidence ?? result.plantNet?.confidence ?? null) as number | null,
    };
  };

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    resetSessionState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    resetSessionState();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const slotsLeft = MAX_PHOTOS - photos.length;
    if (slotsLeft <= 0) {
      toast.warning(`사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있어요.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const incoming = Array.from(fileList).slice(0, slotsLeft);

    setIsPreparing(true);
    const next: PhotoItem[] = [];
    try {
      for (const file of incoming) {
        if (!file.type.startsWith('image/')) {
          toast.error(`'${file.name}' 은 사진 파일이 아니에요.`);
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`'${file.name}' 은 20MB를 초과해요.`);
          continue;
        }
        const compressed = await compressImage(file, 1024, 0.82);
        const base64 = await blobToBase64(compressed);
        next.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          previewUrl: URL.createObjectURL(compressed),
          base64,
          mimeType: compressed.type || file.type || 'image/jpeg',
        });
      }
      if (next.length > 0) {
        setPhotos((prev) => [...prev, ...next]);
        setResult(null);
        setSavedToToday(false);
      }
    } catch (e) {
      console.error('사진 처리 실패:', e);
      toast.error('사진을 처리하지 못했습니다.');
    } finally {
      setIsPreparing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 🌿 NIBR 국내 생물종 보강 실행 — 관리자(허대표) 전용.
  //   실제 NIBR 호출은 고정 egress IP 인프라 준비 전까지 빈 결과일 수 있으나, 기존 흐름엔 영향 없음.
  const runNibrEnrichment = (data: AdvancedResult) => {
    const nibrSci =
      data.plantNet?.scientificName ||
      data.plantId?.latinName ||
      data.gemini?.finalLatinName ||
      '';
    if (!nibrSci) {
      toast('학명 정보가 없어 NIBR 보강을 건너뜁니다.');
      return;
    }
    const callKoreanInfo = httpsCallable<
      { scientificName: string },
      KoreanPlantInfoResponse
    >(functions, 'getKoreanPlantInfo');
    callKoreanInfo({ scientificName: nibrSci })
      .then((res) => {
        setKoreanInfo(res.data || null);
      })
      .catch((e) => {
        console.warn('NIBR 보강 조회 실패 — 기존 결과 유지:', e);
        setKoreanInfo(emptyKoreanPlantInfo('api_unavailable'));
      });
  };

  const analyzePlant = async () => {
    if (photos.length === 0) {
      toast.info('사진을 1장 이상 선택해 주세요.');
      return;
    }
    setIsAnalyzing(true);
    // 새 분석 — 이전 세션 잔여 상태 정리 (도감 매칭/사용자 확정 초기화)
    resetSessionState();
    try {
      const detect = httpsCallable<
        { images: { imageBase64: string; mimeType: string }[] },
        AdvancedResult
      >(functions, 'detectPlantAdvanced');
      const response = await detect({
        images: photos.map((p) => ({ imageBase64: p.base64, mimeType: p.mimeType })),
      });
      const data = response.data;
      setResult(data);
      if (data.meta && !data.meta.plantNetAvailable) {
        toast.info('PlantNet 키가 설정되지 않아 Plant.id + Gemini 결과만 표시됩니다.');
      }
      // 분석 결과에 등장한 이름들을 사용자 도감에서 매칭 검색 (비동기, 실패해도 무시)
      if (user) {
        findLibraryMatches(data).then((matches) => {
          setLibraryMatches(matches);
        }).catch((e) => {
          console.warn('내 도감 매칭 조회 실패:', e);
        });
      }
      findCommunityCorrection(data).then(setCommunityCorrectionKnown).catch((e) => {
        console.warn('공용 검증 기록 조회 실패:', e);
      });
      // 🌿 NIBR 보강 — 관리자(허대표) 계정에서만 호출. 구독자/일반 사용자는 NIBR 호출이 발생하지 않음.
      if (isAdmin) {
        runNibrEnrichment(data);
      }
    } catch (error: any) {
      console.error('식물 분석 실패:', error);
      toast.error(error?.message || '식물 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const findCommunityCorrection = async (data: AdvancedResult): Promise<boolean> => {
    const scientificName =
      data.plantNet?.scientificName || data.gemini?.finalLatinName || data.plantId?.latinName || '';
    const aiPrediction = data.plantNet?.name || data.plantId?.name || data.gemini?.finalGuess || '';
    const checks = [];
    if (scientificName) {
      checks.push(getDocs(query(
        collection(db, 'community_plant_corrections'),
        where('aiScientificName', '==', scientificName),
        limit(1),
      )));
    }
    if (aiPrediction) {
      checks.push(getDocs(query(
        collection(db, 'community_plant_corrections'),
        where('aiPrediction', '==', aiPrediction),
        limit(1),
      )));
    }
    if (checks.length === 0) return false;
    const snaps = await Promise.all(checks);
    return snaps.some((snap) => !snap.empty);
  };

  // 📚 사용자 도감에서 이름 매칭 검색
  const findLibraryMatches = async (data: AdvancedResult): Promise<LibraryMatch[]> => {
    if (!user) return [];
    // 분석 결과에서 모든 이름 후보 수집 (Gemini final / Plant.id / PlantNet · 한국명·학명 모두)
    const candidates = new Map<string, string>(); // normalized → 원본
    const add = (s?: string | null) => {
      const k = normName(s || '');
      if (k && k.length >= 2) candidates.set(k, String(s));
    };
    add(data.gemini?.finalGuess);
    add(data.gemini?.finalLatinName);
    add(data.plantId?.name);
    add(data.plantId?.latinName);
    add(data.plantNet?.name);
    add(data.plantNet?.scientificName);
    if (candidates.size === 0) return [];

    const snap = await getDocs(collection(db, 'users', user.uid, 'plants'));
    const matches: LibraryMatch[] = [];
    snap.forEach((d) => {
      const v = d.data() as any;
      // 도감 도큐먼트의 이름 후보들 (사용자 확정 우선)
      const docNames: { value: string; field: string }[] = [];
      if (v.userConfirmedName) docNames.push({ value: v.userConfirmedName, field: 'userConfirmedName' });
      if (v.displayName) docNames.push({ value: v.displayName, field: 'displayName' });
      if (v.englishName) docNames.push({ value: v.englishName, field: 'englishName' });
      if (v.scientificName) docNames.push({ value: v.scientificName, field: 'scientificName' });
      if (v.finalGuess) docNames.push({ value: v.finalGuess, field: 'finalGuess' });
      if (v.finalLatinName) docNames.push({ value: v.finalLatinName, field: 'finalLatinName' });
      if (v.originalPlantIdResult?.name) docNames.push({ value: v.originalPlantIdResult.name, field: 'plantId.name' });
      if (v.originalPlantIdResult?.latinName) docNames.push({ value: v.originalPlantIdResult.latinName, field: 'plantId.latinName' });
      if (v.originalPlantNetResult?.name) docNames.push({ value: v.originalPlantNetResult.name, field: 'plantNet.name' });
      if (v.originalPlantNetResult?.scientificName) docNames.push({ value: v.originalPlantNetResult.scientificName, field: 'plantNet.sci' });

      const photos = Array.isArray(v.photos) ? v.photos : Array.isArray(v.imageUrls) ? v.imageUrls : [];
      for (const dn of docNames) {
        const key = normName(dn.value);
        if (candidates.has(key)) {
          matches.push({
            id: d.id,
            userConfirmedName: v.userConfirmedName,
            finalGuess: v.displayName || v.finalGuess,
            englishName: v.englishName,
            scientificName: v.scientificName || v.finalLatinName,
            photo: photos[0] || null,
            date: v.date,
            source: v.source,
            matchedOn: dn.value,
          });
          break;
        }
      }
    });
    // 최근 저장 우선 (createdAt desc 가까운 구현 — id에 timestamp 포함됨)
    matches.sort((a, b) => (b.id > a.id ? 1 : -1));
    // 사용자 확정본을 우선 노출
    matches.sort((a, b) => {
      const aw = a.source === 'user_confirmed' ? 1 : 0;
      const bw = b.source === 'user_confirmed' ? 1 : 0;
      return bw - aw;
    });
    return matches.slice(0, 3);
  };

  // 사진 업로드 — 이미 한 번 업로드했다면 재사용
  const ensurePlantDocAssets = async (): Promise<{
    plantId: string;
    today: string;
    createdAt: number;
    imageUrls: string[];
  }> => {
    if (!user) throw new Error('UNAUTH');
    if (activePlantDocId && activePlantImageUrls.length > 0 && activePlantCreatedAt) {
      const d = new Date(activePlantCreatedAt);
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        plantId: activePlantDocId,
        today,
        createdAt: activePlantCreatedAt,
        imageUrls: activePlantImageUrls,
      };
    }
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;
    const ts = Date.now();
    const plantId = `plant_${today}_${ts}_${Math.random().toString(36).slice(2, 8)}`;

    const storage = getStorage();
    const imageUrls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const fileName = `${plantId}_${i + 1}.jpg`;
      const path = `users/${user.uid}/format_photos/${fileName}`;
      const storageRef = ref(storage, path);
      const blob = await fetch(p.previewUrl).then((r) => r.blob());
      await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }
    setActivePlantDocId(plantId);
    setActivePlantImageUrls(imageUrls);
    setActivePlantCreatedAt(ts);
    return { plantId, today, createdAt: ts, imageUrls };
  };

  const buildDisplayName = () => {
    if (!result) return { name: '식물 이름 불확실', latin: '', englishName: '', scientificName: '', confidence: null as number | null };
    const identity = getDisplayIdentity();
    return {
      name: identity.title,
      latin: identity.scientificName,
      englishName: identity.englishName,
      scientificName: identity.scientificName,
      confidence: identity.confidence,
    };
  };

  // 오늘 기록 저장 — records/{date}.plantDetective[] 유지. AI 단독 결과는 plants 도감에 저장하지 않음.
  const saveToToday = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!result || photos.length === 0) {
      toast.info('먼저 분석을 완료해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const { plantId, today, createdAt, imageUrls } = await ensurePlantDocAssets();
      const { name: displayName, latin: displayLatin, englishName, scientificName } = buildDisplayName();

      // 기존 호환 — records/{today}.plantDetective[]
      const recordRef = doc(db, 'users', user.uid, 'records', today);
      const legacyEntry = {
        createdAt,
        plantId,
        imageUrl: imageUrls[0] || '',
        imageUrls,
        title: displayName,
        plantName: displayName,
        latinName: displayLatin,
        englishName,
        scientificName,
        userConfirmedName: userConfirmedName.trim() || '',
        aiKoName: result.plantNet?.koName || result.gemini?.finalGuess || '',
        aiPrediction: result.plantNet?.name || result.plantId?.name || result.gemini?.finalGuess || '',
        identificationConfidence:
          typeof result.plantId?.confidence === 'number' ? result.plantId.confidence : null,
        isPlantProbability:
          typeof result.plantId?.isPlantProbability === 'number'
            ? result.plantId.isPlantProbability
            : null,
        alternativeCandidates: Array.isArray(result.plantId?.alternatives)
          ? result.plantId!.alternatives
          : [],
        taxonomy:
          result.plantId?.family || result.plantId?.genus
            ? { family: result.plantId.family, genus: result.plantId.genus }
            : null,
        identifiedBy: result.plantId ? 'kindwise' : result.plantNet ? 'plantnet' : 'gemini',
        condition: result.gemini?.analysis || '',
        confidence: result.gemini?.confidence || 'low',
        findings: [],
        actions: [],
        warningSigns: result.gemini?.warning ? [result.gemini.warning] : [],
        note: result.gemini?.warning || '',
      };
      await setDoc(
        recordRef,
        { date: today, plantDetective: arrayUnion(legacyEntry) },
        { merge: true },
      );

      setSavedToToday(true);
      toast.success(`오늘 기록(${today})에 저장되었습니다.`);
    } catch (error: any) {
      console.error('식물탐정 저장 실패:', error);
      toast.error(error?.message || '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // ✍️ 사용자 직접 이름 확정 — plants/{plantId}만 user_confirmed로 저장 (records 경로는 무수정)
  const saveAsUserConfirmed = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!result || photos.length === 0) {
      toast.info('먼저 분석을 완료해 주세요.');
      return;
    }
    const name = userConfirmedName.trim();
    if (name.length === 0) {
      toast.warning('직접 입력한 식물 이름을 적어 주세요.');
      return;
    }
    if (name.length > 60) {
      toast.warning('식물 이름은 60자 이내로 입력해 주세요.');
      return;
    }
    setIsConfirming(true);
    try {
      const { plantId, today, createdAt, imageUrls } = await ensurePlantDocAssets();
      const { name: displayName, latin: displayLatin, englishName, scientificName, confidence: topConfidence } = buildDisplayName();
      const aiPrediction = result.plantNet?.name || result.plantId?.name || result.gemini?.finalGuess || '';
      const aiKoName = result.plantNet?.koName || result.gemini?.finalGuess || '';
      const correctedByUser = Boolean(name && name !== (aiKoName || aiPrediction));
      let targetPlantId = plantId;
      if (scientificName) {
        const existing = await getDocs(query(
          collection(db, 'users', user.uid, 'plants'),
          where('scientificName', '==', scientificName),
          limit(1),
        ));
        if (!existing.empty) targetPlantId = existing.docs[0].id;
      }

      const plantDocRef = doc(db, 'users', user.uid, 'plants', targetPlantId);
      // 🌿 NIBR 보강 정보 — matched일 때만 필드 set (기존 scientificName 보존 위해 NIBR 학명은 koreanTaxonomyScientificName으로 분리)
      const nibrMatched =
        koreanInfo?.status === 'matched' && Boolean(koreanInfo?.rawMatched);
      const koreanTaxonomyPayload = nibrMatched
        ? {
            koreanName: koreanInfo!.koreanName,
            koreanTaxonomyScientificName: koreanInfo!.scientificName,
            familyName: koreanInfo!.familyName,
            genusName: koreanInfo!.genusName,
            orderName: koreanInfo!.orderName,
            className: koreanInfo!.className,
            phylumName: koreanInfo!.phylumName,
            speciesKoreanName: koreanInfo!.speciesKoreanName,
            koreanTaxonomySource: 'NIBR' as const,
            koreanTaxonomyMatched: true as const,
            koreanTaxonomyMatchedAt: serverTimestamp(),
          }
        : {};
      await setDoc(
        plantDocRef,
        {
          plantId: targetPlantId,
          date: today,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          photos: imageUrls,
          imageUrl: imageUrls[0] || '',
          // 제목은 AI 판독명과 사용자 보고명을 함께 보존 — 기존 API 결과는 original* 로 그대로 보존
          displayName,
          englishName,
          scientificName,
          aiPrediction,
          aiKoName,
          userConfirmedName: name,
          humanReportedName: name,
          correctedByUser,
          observationCount: increment(1),
          finalGuess: displayName,
          finalLatinName: displayLatin,
          confidence: topConfidence,
          originalPlantIdResult: result.plantId,
          originalPlantNetResult: result.plantNet,
          geminiAnalysis: result.gemini,
          meta: result.meta,
          source: 'user_confirmed',
          ...koreanTaxonomyPayload,
        },
        { merge: true },
      );

      if (correctedByUser) {
        const correctionRef = doc(collection(db, 'community_plant_corrections'));
        await setDoc(correctionRef, {
          aiPrediction,
          aiScientificName: result.plantNet?.scientificName || result.plantId?.latinName || result.gemini?.finalLatinName || '',
          userConfirmedName: name,
          userConfirmedScientificName: scientificName,
          confidenceLabel: '사용자 경험 기반 수정 기록 있음',
          createdAt: serverTimestamp(),
        });
        setCommunityCorrectionKnown(true);
      }

      setConfirmedSavedDocId(targetPlantId);
      await loadPlantLibrary();
      toast.success(`📚 '${name}' 으로 내 도감에 저장했어요.`);
    } catch (error: any) {
      console.error('사용자 확정 저장 실패:', error);
      toast.error(error?.message || '저장에 실패했습니다.');
    } finally {
      setIsConfirming(false);
    }
  };

  // 🌱 v1 사용자입력 식물 자산 저장 — users/{uid}/plants/{plantId} (PlantAsset 스키마)
  const saveV1PlantAsset = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    const plantName = v1PlantName.trim();
    if (plantName.length === 0) {
      toast.warning('식물 이름을 입력해 주세요.');
      return;
    }
    if (plantName.length > 60) {
      toast.warning('식물 이름은 60자 이내로 입력해 주세요.');
      return;
    }
    const confParsed = Number(v1Confidence);
    const confidence =
      Number.isFinite(confParsed) ? Math.max(0, Math.min(1, confParsed)) : 1;
    const imageUrls = v1ImageUrlsText
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setV1Saving(true);
    try {
      const ts = Date.now();
      const plantId = `plant_v1_${ts}_${Math.random().toString(36).slice(2, 8)}`;
      const nowIso = new Date(ts).toISOString();
      const asset: PlantAsset = {
        id: plantId,
        plantName,
        aiGuess: v1AiGuess.trim(),
        confidence,
        userConfirmed: v1UserConfirmed,
        sourceType: v1SourceType,
        memo: v1Memo.trim(),
        imageUrls,
        tags: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const plantDocRef = doc(db, 'users', user.uid, 'plants', plantId);
      await setDoc(plantDocRef, asset);
      setV1LastSavedId(plantId);
      toast.success(`🌱 '${plantName}' 식물 자산이 저장되었습니다.`);
      // 입력 초기화 (sourceType은 사용자가 선택한 값 유지)
      setV1PlantName('');
      setV1AiGuess('');
      setV1Confidence('1');
      setV1Memo('');
      setV1ImageUrlsText('');
      setV1UserConfirmed(false);
    } catch (error: any) {
      console.error('v1 식물 자산 저장 실패:', error);
      toast.error(error?.message || '저장에 실패했습니다.');
    } finally {
      setV1Saving(false);
    }
  };

  // 📔 오늘의 관찰 — records/{date}.plantObservation[] 신규 필드에 저장
  //   기존 records.plantDetective[] 와 별도 배열 → 구조 충돌 없음
  //   AI 단독 결과는 plants 도감에 저장하지 않음
  const saveTodayObservation = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!result || photos.length === 0) {
      toast.info('먼저 사진 분석을 완료해 주세요.');
      return;
    }
    const observation = obsObservation.trim();
    const aiDifference = obsAiDifference.trim();
    const memo = obsMemo.trim();
    if (observation.length === 0 && aiDifference.length === 0 && memo.length === 0) {
      toast.warning('관찰 내용을 한 가지 이상 입력해 주세요.');
      return;
    }
    setObsSaving(true);
    try {
      const { plantId, today, createdAt, imageUrls } = await ensurePlantDocAssets();
      const { name: displayName, latin: displayLatin, englishName, scientificName } = buildDisplayName();
      const now = Date.now();

      // records/{today}.plantObservation[] — 신규 별도 필드 (기존 plantDetective[] 무수정)
      const recordRef = doc(db, 'users', user.uid, 'records', today);
      const obsEntry = {
        format: 'plantObservation',
        plantId,
        linkedPlantId: plantId,
        plantName: displayName,
        latinName: displayLatin,
        imageUrl: imageUrls[0] || '',
        imageUrls,
        title: displayName,
        englishName,
        scientificName,
        userConfirmedName: userConfirmedName.trim() || '',
        aiKoName: result.plantNet?.koName || result.gemini?.finalGuess || '',
        aiPrediction: result.plantNet?.name || result.plantId?.name || result.gemini?.finalGuess || '',
        observation,
        aiDifference,
        memo,
        createdAt,
      };
      await setDoc(
        recordRef,
        { date: today, plantObservation: arrayUnion(obsEntry) },
        { merge: true },
      );

      const savedTs = new Date(now);
      const hh = String(savedTs.getHours()).padStart(2, '0');
      const mm = String(savedTs.getMinutes()).padStart(2, '0');
      setObsSavedAt(`${today} ${hh}:${mm}`);
      setObsObservation('');
      setObsAiDifference('');
      setObsMemo('');
      toast.success('📔 오늘의 관찰이 저장되었습니다.');
    } catch (error: any) {
      console.error('오늘의 관찰 저장 실패:', error);
      toast.error(error?.message || '저장에 실패했습니다.');
    } finally {
      setObsSaving(false);
    }
  };

  // 🪴 통합 저장 — 메인 "📔 오늘 기록 저장" 버튼 단일 핸들러
  //   1) records/{today}.plantDetective[] arrayUnion (legacy 호환)
  //   2) 관찰 textarea 입력이 있으면 records/{today}.plantObservation[] arrayUnion 도 함께
  //   AI 단독 결과는 plants 도감에 저장하지 않음
  //   토스트는 1회만 — 지시서 6: '오늘의 식물 기록과 관찰 내용을 저장했습니다.'
  const saveTodayAllRecord = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!result || photos.length === 0) {
      toast.info('먼저 분석을 완료해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const { plantId, today, createdAt, imageUrls } = await ensurePlantDocAssets();
      const { name: displayName, latin: displayLatin, englishName, scientificName } = buildDisplayName();
      const now = Date.now();

      // 1) records/{today}.plantDetective[] (legacy 호환 — saveToToday 와 동일)
      const recordRef = doc(db, 'users', user.uid, 'records', today);
      const legacyEntry = {
        createdAt,
        plantId,
        imageUrl: imageUrls[0] || '',
        imageUrls,
        title: displayName,
        plantName: displayName,
        latinName: displayLatin,
        englishName,
        scientificName,
        userConfirmedName: userConfirmedName.trim() || '',
        aiKoName: result.plantNet?.koName || result.gemini?.finalGuess || '',
        aiPrediction: result.plantNet?.name || result.plantId?.name || result.gemini?.finalGuess || '',
        identificationConfidence:
          typeof result.plantId?.confidence === 'number' ? result.plantId.confidence : null,
        isPlantProbability:
          typeof result.plantId?.isPlantProbability === 'number'
            ? result.plantId.isPlantProbability
            : null,
        alternativeCandidates: Array.isArray(result.plantId?.alternatives)
          ? result.plantId!.alternatives
          : [],
        taxonomy:
          result.plantId?.family || result.plantId?.genus
            ? { family: result.plantId.family, genus: result.plantId.genus }
            : null,
        identifiedBy: result.plantId ? 'kindwise' : result.plantNet ? 'plantnet' : 'gemini',
        condition: result.gemini?.analysis || '',
        confidence: result.gemini?.confidence || 'low',
        findings: [],
        actions: [],
        warningSigns: result.gemini?.warning ? [result.gemini.warning] : [],
        note: result.gemini?.warning || '',
      };

      // 2) records/{today}.plantObservation[] (관찰 입력이 있을 때만)
      const observation = obsObservation.trim();
      const aiDifference = obsAiDifference.trim();
      const memo = obsMemo.trim();
      const hasObsInput =
        observation.length > 0 || aiDifference.length > 0 || memo.length > 0;
      const updatePayload: Record<string, any> = {
        date: today,
        plantDetective: arrayUnion(legacyEntry),
      };
      if (hasObsInput) {
        const obsEntry = {
          format: 'plantObservation',
          plantId,
          linkedPlantId: plantId,
          plantName: displayName,
          latinName: displayLatin,
          imageUrl: imageUrls[0] || '',
          imageUrls,
          title: displayName,
          englishName,
          scientificName,
          userConfirmedName: userConfirmedName.trim() || '',
          aiKoName: result.plantNet?.koName || result.gemini?.finalGuess || '',
          aiPrediction: result.plantNet?.name || result.plantId?.name || result.gemini?.finalGuess || '',
          observation,
          aiDifference,
          memo,
          createdAt,
        };
        updatePayload.plantObservation = arrayUnion(obsEntry);
      }
      await setDoc(recordRef, updatePayload, { merge: true });

      setSavedToToday(true);
      if (hasObsInput) {
        setObsObservation('');
        setObsAiDifference('');
        setObsMemo('');
        const savedTs = new Date(now);
        const hh = String(savedTs.getHours()).padStart(2, '0');
        const mm = String(savedTs.getMinutes()).padStart(2, '0');
        setObsSavedAt(`${today} ${hh}:${mm}`);
      }
      toast.success('오늘의 식물 기록과 관찰 내용을 저장했습니다.');
    } catch (error: any) {
      console.error('통합 저장 실패:', error);
      toast.error(error?.message || '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const gemini = result?.gemini;
  const showPoisonAlert = Boolean(gemini?.poisonousRisk || gemini?.warning);

  return (
    <div style={{ minHeight: '100vh', background: '#FEFBE8', color: '#24301f' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(254, 251, 232, 0.94)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e6dfc7',
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: '1px solid #d7cfb5',
              background: '#fffdf4',
              color: '#4A5A2C',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <div style={{ fontSize: 13, color: '#6b7654', fontWeight: 700 }}>GARDEN · 교차검증</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>하루식물탐정</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7654', lineHeight: 1.5 }}>
              AI 판독 + 관찰일기 + 나만의 식물도감
            </p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '18px 16px 96px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            marginBottom: 14,
            background: '#ece4c8',
            padding: 4,
            borderRadius: 10,
          }}
        >
          {[
            ['detect', '판독'],
            ['recent', '최근 판독'],
            ['library', '📚 내 식물도감'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as 'detect' | 'recent' | 'library')}
              style={{
                minHeight: 38,
                border: 'none',
                borderRadius: 8,
                background: activeTab === key ? '#fffdf4' : 'transparent',
                color: activeTab === key ? '#3d4734' : '#7a725d',
                fontWeight: 900,
                fontSize: 13,
                boxShadow: activeTab === key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'library' ? (
          <PlantLibraryPanel plants={plantLibrary} />
        ) : activeTab === 'recent' ? (
          <RecentDetectPanel plants={plantLibrary} />
        ) : (
          <>
        {/* ========== 🛠 고급 사용자 직접 등록 ========== */}
        <section
          style={{
            border: '1px solid #d8d0b8',
            background: '#fffdf4',
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setShowV1Form((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#5c5a48',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            <span>🛠 고급 사용자 직접 등록</span>
            {showV1Form ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#7a725d', lineHeight: 1.5 }}>
            AI 분석 없이 직접 식물 정보를 등록할 수 있는 고급 기능입니다.
          </p>
          {showV1Form && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  border: '1px solid #e1dbc4',
                  background: '#f8f4dd',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#4A5A2C',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>🌱 언제 사용하나요?</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.65 }}>
                  <li>AI가 식물을 잘못 식별했을 때</li>
                  <li>책/웹에서 본 식물을 기록하고 싶을 때</li>
                  <li>이름만 먼저 저장하고 싶을 때</li>
                </ul>
                <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.55 }}>
                  식물 이름과 메모만 입력해도 저장할 수 있습니다.
                </p>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3f5316' }}>식물 이름 *</span>
                <input
                  type="text"
                  value={v1PlantName}
                  onChange={(e) => setV1PlantName(e.target.value)}
                  maxLength={60}
                  placeholder="예: 호접란"
                  style={{
                    height: 36,
                    borderRadius: 6,
                    border: '1px solid #c9d8a6',
                    padding: '0 10px',
                    background: '#fff',
                    fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3f5316' }}>sourceType</span>
                <select
                  value={v1SourceType}
                  onChange={(e) => setV1SourceType(e.target.value as PlantAssetSourceType)}
                  style={{
                    height: 36,
                    borderRadius: 6,
                    border: '1px solid #c9d8a6',
                    padding: '0 10px',
                    background: '#fff',
                    fontSize: 13,
                  }}
                >
                  <option value="real_photo">실사진 (real_photo)</option>
                  <option value="book_photo">도감사진 (book_photo)</option>
                  <option value="web_reference">웹참고 (web_reference)</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3f5316' }}>사용자 메모</span>
                <textarea
                  value={v1Memo}
                  onChange={(e) => setV1Memo(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="이 식물에 대한 메모를 남기세요."
                  style={{
                    borderRadius: 6,
                    border: '1px solid #c9d8a6',
                    padding: '8px 10px',
                    background: '#fff',
                    fontSize: 13,
                    resize: 'vertical',
                  }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3f5316' }}>
                <input
                  type="checkbox"
                  checked={v1UserConfirmed}
                  onChange={(e) => setV1UserConfirmed(e.target.checked)}
                />
                <span>식별 확정 (userConfirmed)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowV1Advanced((v) => !v)}
                style={{
                  height: 34,
                  borderRadius: 7,
                  border: '1px solid #d8d0b8',
                  background: '#fff',
                  color: '#5c5a48',
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                {showV1Advanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                고급 설정
              </button>
              {showV1Advanced && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3f5316' }}>AI 추정명</span>
                    <input
                      type="text"
                      value={v1AiGuess}
                      onChange={(e) => setV1AiGuess(e.target.value)}
                      maxLength={120}
                      placeholder="예: Phalaenopsis aphrodite"
                      style={{
                        height: 36,
                        borderRadius: 6,
                        border: '1px solid #c9d8a6',
                        padding: '0 10px',
                        background: '#fff',
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3f5316' }}>confidence (0~1)</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={v1Confidence}
                      onChange={(e) => setV1Confidence(e.target.value)}
                      style={{
                        height: 36,
                        borderRadius: 6,
                        border: '1px solid #c9d8a6',
                        padding: '0 10px',
                        background: '#fff',
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3f5316' }}>
                      이미지 URL (한 줄에 하나 또는 쉼표 구분)
                    </span>
                    <textarea
                      value={v1ImageUrlsText}
                      onChange={(e) => setV1ImageUrlsText(e.target.value)}
                      rows={2}
                      placeholder="https://example.com/photo1.jpg"
                      style={{
                        borderRadius: 6,
                        border: '1px solid #c9d8a6',
                        padding: '8px 10px',
                        background: '#fff',
                        fontSize: 13,
                        resize: 'vertical',
                      }}
                    />
                  </label>
                </div>
              )}
              <button
                type="button"
                onClick={saveV1PlantAsset}
                disabled={v1Saving || v1PlantName.trim().length === 0}
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid #b8c28c',
                  background:
                    v1Saving || v1PlantName.trim().length === 0 ? '#f1f4e6' : '#fff',
                  color:
                    v1Saving || v1PlantName.trim().length === 0 ? '#a7b886' : '#4A5A2C',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor:
                    v1Saving || v1PlantName.trim().length === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {v1Saving ? <Loader2 size={16} className="animate-spin" /> : <Leaf size={16} />}
                🌱 식물만 저장
              </button>
              {v1LastSavedId && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#166534',
                    background: '#DCFCE7',
                    padding: '6px 10px',
                    borderRadius: 6,
                  }}
                >
                  ✅ 저장됨 — plantId: {v1LastSavedId}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ========== 촬영 가이드 ========== */}
        <section
          style={{
            border: '1px solid #ded5b8',
            background: '#fffdf4',
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#4A5A2C',
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            <span>📸 더 정확한 식별을 위한 촬영 가이드</span>
            {showGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showGuide && (
            <>
              <ul
                style={{
                  marginTop: 10,
                  paddingLeft: 0,
                  listStyle: 'none',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 8,
                }}
              >
                {PHOTO_GUIDE_ITEMS.map((g) => (
                  <li
                    key={g.label}
                    style={{
                      border: '1px dashed #cfc69a',
                      borderRadius: 8,
                      padding: '8px 10px',
                      background: '#f8f4dd',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#3d4734' }}>
                      <span style={{ marginRight: 6 }}>{g.icon}</span>
                      {g.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7654', marginTop: 2 }}>{g.hint}</div>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 11, color: '#7a725d', marginTop: 8, lineHeight: 1.55 }}>
                여러 각도에서 최대 {MAX_PHOTOS}장까지 올릴 수 있어요. 부위가 다양할수록 교차검증 정확도가 올라갑니다.
              </p>
            </>
          )}
        </section>

        {/* ========== 사진 업로드 ========== */}
        <section
          style={{
            border: '1px solid #ded5b8',
            background: '#fffdf4',
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            {photos.map((p) => (
              <div
                key={p.id}
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #cfc69a',
                  background: '#f6f4df',
                }}
              >
                <img
                  src={p.previewUrl}
                  alt="식물 사진"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  aria-label="사진 제거"
                  disabled={isAnalyzing}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(123, 63, 40, 0.92)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPreparing || isAnalyzing}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 8,
                  border: '1px dashed #b8c28c',
                  background: '#f6f4df',
                  color: '#71805a',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: 8,
                }}
              >
                <div>
                  {isPreparing ? <Loader2 size={22} className="animate-spin" style={{ margin: '0 auto 4px' }} /> : <Camera size={22} style={{ margin: '0 auto 4px' }} />}
                  <div style={{ fontSize: 12, fontWeight: 800 }}>사진 추가</div>
                  <div style={{ fontSize: 10, color: '#92996f', marginTop: 2 }}>
                    {photos.length}/{MAX_PHOTOS}
                  </div>
                </div>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={analyzePlant}
              disabled={photos.length === 0 || isPreparing || isAnalyzing}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 8,
                border: '1px solid #B85C2E',
                background:
                  photos.length === 0 || isPreparing || isAnalyzing ? '#e7dfc8' : '#B85C2E',
                color: '#fff',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {isAnalyzing ? '교차검증 중...' : '식물 탐정 시작'}
            </button>
            {photos.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                disabled={isAnalyzing}
                aria-label="모두 지우기"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  border: '1px solid #d7cfb5',
                  background: '#fff',
                  color: '#7b3f28',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </section>

        {/* ========== 결과 영역 ========== */}
        {!result ? (
          <div
            style={{
              border: '1px solid #ded5b8',
              background: '#fffdf4',
              borderRadius: 10,
              padding: 28,
              textAlign: 'center',
              color: '#6f775b',
            }}
          >
            <Leaf size={36} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 900 }}>분석 결과가 여기에 표시됩니다</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Plant.id · PlantNet · HARU AI가 함께 분석합니다.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* ========== 📚 내 도감 참고 결과 (가장 먼저 노출) ========== */}
            {libraryMatches.length > 0 && (
              <ResultCard title="📚 내 도감 참고 결과" accent="#7C5E10" bg="#FFF8DB">
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b5b22', lineHeight: 1.55 }}>
                  같은 이름의 식물을 이전에 기록하신 적이 있어요. 참고하세요.
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                  {libraryMatches.map((m) => {
                    const showName = m.userConfirmedName || m.finalGuess || m.matchedOn;
                    return (
                      <li
                        key={m.id}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          background: '#fff',
                          border: '1px solid #f1e3a8',
                          borderRadius: 8,
                          padding: 8,
                        }}
                      >
                        {m.photo ? (
                          <img
                            src={m.photo}
                            alt="이전 도감 사진"
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: 'cover',
                              borderRadius: 6,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 6,
                              background: '#f3eccd',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              color: '#a88f30',
                            }}
                          >
                            <BookOpen size={20} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ fontWeight: 800, fontSize: 14, color: '#3d3414' }}>
                              {showName}
                            </span>
                            {m.source === 'user_confirmed' && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: '#DCFCE7',
                                  color: '#166534',
                                }}
                              >
                                내가 확정
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#7a6a2c', marginTop: 2 }}>
                            {m.date ? `${m.date} 기록` : '이전 기록'}
                            {m.matchedOn && m.matchedOn !== showName && (
                              <span style={{ marginLeft: 6, color: '#a88f30' }}>
                                · 이번 결과의 "{m.matchedOn}"와 일치
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ResultCard>
            )}

            {/* ========== 독초 경고 ========== */}
            {showPoisonAlert && (
              <div
                style={{
                  border: '2px solid #B91C1C',
                  background: '#FEF2F2',
                  borderRadius: 10,
                  padding: 14,
                  color: '#7F1D1D',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>
                    ⚠️ 독초·섭취 주의
                  </div>
                  {gemini?.warning && (
                    <div style={{ fontSize: 13, marginBottom: 6 }}>{gemini.warning}</div>
                  )}
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    <li>⚠ AI 결과만으로 섭취 금지</li>
                    <li>⚠ 유사 독초 가능성 존재 — 전문가 확인 필수</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ========== HARU AI 최종 분석 ========== */}
            {gemini && (
              <ResultCard
                title="🌿 HARU AI 최종 분석"
                accent="#4A5A2C"
                bg="#F1F4DC"
              >
                <div style={{ fontSize: 13, color: '#6b7654', fontWeight: 800, marginBottom: 4 }}>
                  최종 추정 · 신뢰도 {gemini.confidence === 'high' ? '높음' : gemini.confidence === 'medium' ? '보통' : '낮음'}
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 950 }}>
                  {gemini.finalGuess}
                </h3>
                {gemini.finalLatinName && (
                  <div style={{ fontSize: 13, fontStyle: 'italic', color: '#6b7654', marginBottom: 8 }}>
                    {gemini.finalLatinName}
                  </div>
                )}
                {gemini.analysis && (
                  <p style={{ margin: '6px 0 0', fontSize: 14, color: '#3d4734', lineHeight: 1.6 }}>
                    {gemini.analysis}
                  </p>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge
                    text={
                      gemini.edible === 'yes'
                        ? '식용 가능성 있음'
                        : gemini.edible === 'no'
                        ? '식용 불가 가능성'
                        : '식용 여부 불확실'
                    }
                    color={
                      gemini.edible === 'yes'
                        ? '#166534'
                        : gemini.edible === 'no'
                        ? '#7F1D1D'
                        : '#6b7654'
                    }
                    bg={
                      gemini.edible === 'yes'
                        ? '#DCFCE7'
                        : gemini.edible === 'no'
                        ? '#FEE2E2'
                        : '#EDF0DA'
                    }
                  />
                  {gemini.poisonousRisk && (
                    <Badge text="독성 위험 있음" color="#7F1D1D" bg="#FEE2E2" />
                  )}
                </div>
              </ResultCard>
            )}

            {/* ========== Plant.id 결과 ========== */}
            <ResultCard title="🧪 Plant.id 결과" accent="#1A3C6E" bg="#EEF3FA">
              {result.plantId ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                      {result.plantId.name || '식물 이름 불확실'}
                    </h4>
                    <span style={{ fontSize: 12, color: '#6b7654', fontStyle: 'italic' }}>
                      {result.plantId.latinName}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#1A3C6E', fontWeight: 700 }}>
                    일치도 {pctText(result.plantId.confidence)}
                    {result.plantId.family && (
                      <span style={{ marginLeft: 8, color: '#6b7654', fontWeight: 500 }}>
                        · {result.plantId.family}
                        {result.plantId.genus ? ` / ${result.plantId.genus}` : ''}
                      </span>
                    )}
                  </div>
                  {result.plantId.alternatives.length > 0 && (
                    <CandList
                      label="다른 가능성"
                      items={result.plantId.alternatives.map((c) => ({
                        name: c.name,
                        sub: c.latinName,
                        score: c.probability,
                      }))}
                    />
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#6b7654' }}>Plant.id 결과를 가져오지 못했습니다.</div>
              )}
            </ResultCard>

            {/* ========== PlantNet 결과 ========== */}
            <ResultCard title="🌍 PlantNet 결과 (k-world-flora)" accent="#0F766E" bg="#ECFDF5">
              {result.plantNet ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                      {result.plantNet.koName || result.plantNet.name || '식물 이름 불확실'}
                    </h4>
                    {result.plantNet.koName && result.plantNet.name && (
                      <span style={{ fontSize: 12, color: '#6b7654' }}>
                        ({result.plantNet.name})
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#6b7654', fontStyle: 'italic' }}>
                      {result.plantNet.scientificName}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#0F766E', fontWeight: 700 }}>
                    일치도 {pctText(result.plantNet.confidence)}
                    {result.plantNet.family && (
                      <span style={{ marginLeft: 8, color: '#6b7654', fontWeight: 500 }}>
                        · {result.plantNet.family}
                        {result.plantNet.genus ? ` / ${result.plantNet.genus}` : ''}
                      </span>
                    )}
                  </div>
                  {result.plantNet.alternatives.length > 0 && (
                    <CandList
                      label="다른 가능성"
                      items={result.plantNet.alternatives.map((c) => ({
                        name: c.name,
                        sub: c.scientificName,
                        score: c.score,
                      }))}
                    />
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#6b7654' }}>
                  {result.meta?.plantNetAvailable === false
                    ? 'PlantNet API 키가 아직 설정되지 않았어요. Plant.id 결과만으로 분석했습니다.'
                    : 'PlantNet 결과를 가져오지 못했습니다 (식물 특징이 부족하거나 일시적 오류).'}
                </div>
              )}
            </ResultCard>

            {/* 🇰🇷 NIBR 한국식물 보강 — 관리자(허대표) 전용 버튼. 구독자/일반 사용자에게는 노출되지 않음 */}
            {isAdmin && result && (
              <button
                type="button"
                onClick={() => runNibrEnrichment(result)}
                style={{
                  width: '100%',
                  border: '1px solid #15803D',
                  borderRadius: 10,
                  background: '#F0FDF4',
                  color: '#15803D',
                  fontSize: 14,
                  fontWeight: 900,
                  padding: '12px 14px',
                  marginTop: 4,
                  cursor: 'pointer',
                }}
              >
                🇰🇷 NIBR 한국식물 보강
              </button>
            )}

            {/* 🌿 국내 생물종(NIBR) 보강 결과 — 관리자(허대표) 전용. AI 판독·사용자 정정 결과를 덮어쓰지 않음 */}
            {isAdmin && koreanInfo && (
              <ResultCard title="🇰🇷 국내 생물종 정보 (NIBR)" accent="#15803D" bg="#F0FDF4">
                {koreanInfo.status === 'matched' && (koreanInfo.koreanName || koreanInfo.familyName) ? (
                  <>
                    {koreanInfo.koreanName && (
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#15803D' }}>
                        {koreanInfo.koreanName}
                      </div>
                    )}
                    {koreanInfo.scientificName && (
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: '#6b7654', marginTop: 2 }}>
                        {koreanInfo.scientificName}
                      </div>
                    )}
                    {(koreanInfo.familyName || koreanInfo.genusName || koreanInfo.orderName) && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#3d4734' }}>
                        {[koreanInfo.orderName, koreanInfo.familyName, koreanInfo.genusName]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: '#3d4734', lineHeight: 1.7 }}>
                    {koreanInfo.status === 'not_found' && (
                      <>
                        NIBR 응답은 받았지만 현재 조회 범위에서 AI 학명과 일치하는 국가생물종 항목을 찾지 못했습니다.
                        <br />
                        학명이 더 넓은 품종·변종명이거나, API 검색 페이지네이션 범위 밖에 있을 수 있습니다.
                      </>
                    )}
                    {koreanInfo.status === 'api_unavailable' && (
                      <>
                        NIBR API가 현재 해당 요청을 처리하지 못했습니다.
                        <br />
                        키 승인 상태 또는 NIBR 서버 응답을 확인해야 합니다.
                      </>
                    )}
                    {koreanInfo.status === 'not_configured' && (
                      <>
                        NIBR API 키가 함수에 설정되지 않아 국가생물종 보강을 건너뛰었습니다.
                      </>
                    )}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: '#6b7654' }}>
                  출처: 국가생물종지식정보시스템 (NIBR)
                </div>
              </ResultCard>
            )}

            {communityCorrectionKnown && (
              <section
                style={{
                  border: '1px solid #BBF7D0',
                  background: '#F0FDF4',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#166534',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                🌿 사용자 경험 기반 수정 기록 있음
              </section>
            )}

            {/* ========== 🎯 최종 식물명 확정 ========== */}
            {finalConfirmation && (
              <ResultCard title="🎯 최종 식물명 확정" accent="#15803D" bg="#F0FDF4">
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#3d4734', lineHeight: 1.55 }}>
                  AI 추정은 후보일 뿐입니다. 맞는 후보를 클릭하거나, 직접 입력해 최종 식물명을 확정하세요.
                </p>

                <div style={{ fontSize: 12, fontWeight: 800, color: '#15803D', marginBottom: 6 }}>
                  AI 추정 결과
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                  <li
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      background: '#fff',
                      border: '1px solid #BBF7D0',
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#1f2a17' }}>
                        {finalConfirmation.aiKoName || finalConfirmation.aiPrediction || '(이름 없음)'}
                        {finalConfirmation.aiKoName && finalConfirmation.aiPrediction && (
                          <span style={{ marginLeft: 6, fontWeight: 500, color: '#6b7654', fontSize: 12 }}>
                            ({finalConfirmation.aiPrediction})
                          </span>
                        )}
                      </div>
                      {finalConfirmation.scientificName && (
                        <div style={{ fontSize: 11, fontStyle: 'italic', color: '#6b7654' }}>
                          {finalConfirmation.scientificName}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserConfirmedName(
                          finalConfirmation.aiKoName || finalConfirmation.aiPrediction || '',
                        );
                        setUserConfirmedEnglishName(finalConfirmation.aiEnglishName || '');
                        setUserConfirmedScientificName(finalConfirmation.aiScientificName || '');
                      }}
                      style={{
                        height: 32,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #15803D',
                        background: '#15803D',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      이 식물로 확정
                    </button>
                  </li>

                  {(result.plantNet?.alternatives || []).slice(0, 3).map((c, i) => (
                    <li
                      key={`alt-${i}`}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        background: '#fff',
                        border: '1px solid #BBF7D0',
                        borderRadius: 8,
                        padding: '8px 10px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2a17' }}>
                          {c.name || '(이름 없음)'}
                        </div>
                        {c.scientificName && (
                          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#6b7654' }}>
                            {c.scientificName}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUserConfirmedName(c.name || '');
                          setUserConfirmedEnglishName(c.name || '');
                          setUserConfirmedScientificName(c.scientificName || '');
                        }}
                        style={{
                          height: 30,
                          padding: '0 10px',
                          borderRadius: 6,
                          border: '1px solid #15803D',
                          background: '#fff',
                          color: '#15803D',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        이 식물로 확정
                      </button>
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: '#15803D', marginBottom: 6 }}>
                  또는 직접 입력
                </div>
                <input
                  type="text"
                  value={userConfirmedName}
                  onChange={(e) => setUserConfirmedName(e.target.value)}
                  placeholder="예: 수세미"
                  maxLength={60}
                  style={{
                    width: '100%',
                    height: 42,
                    borderRadius: 8,
                    border: '1px solid #BBF7D0',
                    background: '#fff',
                    padding: '0 12px',
                    fontSize: 16,
                    color: '#1f2a17',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <input
                    type="text"
                    value={userConfirmedEnglishName}
                    onChange={(e) => setUserConfirmedEnglishName(e.target.value)}
                    placeholder="영어명 예: Luffa"
                    maxLength={80}
                    style={{
                      height: 38,
                      borderRadius: 8,
                      border: '1px solid #BBF7D0',
                      background: '#fff',
                      padding: '0 10px',
                      fontSize: 13,
                      color: '#1f2a17',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="text"
                    value={userConfirmedScientificName}
                    onChange={(e) => setUserConfirmedScientificName(e.target.value)}
                    placeholder="학명 예: Luffa cylindrica"
                    maxLength={120}
                    style={{
                      height: 38,
                      borderRadius: 8,
                      border: '1px solid #BBF7D0',
                      background: '#fff',
                      padding: '0 10px',
                      fontSize: 13,
                      color: '#1f2a17',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {finalConfirmation.userConfirmedName && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: '#DCFCE7',
                      color: '#166534',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    <div>
                      제목: <strong>{finalConfirmation.displayName}</strong>
                    </div>
                    {(finalConfirmation.englishName || finalConfirmation.scientificName) && (
                      <div style={{ fontSize: 12, color: '#365e3a' }}>
                        {[finalConfirmation.englishName, finalConfirmation.scientificName].filter(Boolean).join(' / ')}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#365e3a' }}>
                      AI 추정: {finalConfirmation.aiKoName || finalConfirmation.aiPrediction || '—'}
                    </div>
                    {finalConfirmation.correctedByUser && (
                      <div style={{ fontSize: 12, color: '#365e3a' }}>
                        사용자 보고: {finalConfirmation.userConfirmedName}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#365e3a' }}>
                      상태: {finalConfirmation.correctedByUser ? 'AI 판독과 사용자 보고가 다름' : 'AI 추정 그대로 사용'}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={saveAsUserConfirmed}
                  disabled={isConfirming || userConfirmedName.trim().length === 0}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    height: 40,
                    borderRadius: 8,
                    border: '1px solid #15803D',
                    background:
                      isConfirming || userConfirmedName.trim().length === 0 ? '#DCFCE7' : '#15803D',
                    color:
                      isConfirming || userConfirmedName.trim().length === 0 ? '#86efac' : '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor:
                      isConfirming || userConfirmedName.trim().length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title="사용자 최종확정값을 내 식물도감에 저장합니다"
                >
                  {isConfirming ? '저장 중...' : '📚 내 식물도감 저장'}
                </button>
              </ResultCard>
            )}

            {/* ========== 유사종 ========== */}
            {gemini && gemini.similarSpecies.length > 0 && (
              <ResultCard title="🔍 유사종 비교" accent="#7C3AED" bg="#F5F0FF">
                <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.7 }}>
                  {gemini.similarSpecies.map((s, i) => (
                    <li key={`sim-${i}`}>{s}</li>
                  ))}
                </ul>
              </ResultCard>
            )}

            {/* ========== 추가 사진 요청 ========== */}
            {gemini && gemini.needMorePhotos.length > 0 && (
              <ResultCard title="📷 더 정확하게 알려면" accent="#B45309" bg="#FEF8E7">
                <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.7 }}>
                  {gemini.needMorePhotos.map((s, i) => (
                    <li key={`np-${i}`}>{s}</li>
                  ))}
                </ul>
              </ResultCard>
            )}

            {/* ========== ✍️ 직접 이름 수정·확정 ========== */}
            <ResultCard title="✍️ 직접 이름 수정·확정" accent="#15803D" bg="#F0FDF4">
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#3d4734', lineHeight: 1.55 }}>
                AI 결과가 틀렸다면 진짜 식물 이름을 직접 입력해 주세요.<br />
                내 도감에 정답으로 저장됩니다. 다음에 같은 식물을 찍으면 우선 보여드릴게요.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={userConfirmedName}
                  onChange={(e) => setUserConfirmedName(e.target.value)}
                  placeholder="예: 수세미"
                  maxLength={60}
                  disabled={isConfirming}
                  style={{
                    flex: 1,
                    minWidth: 160,
                    height: 42,
                    borderRadius: 8,
                    border: '1px solid #BBF7D0',
                    background: '#fff',
                    padding: '0 12px',
                    fontSize: 16, // 모바일 줌 방지
                    color: '#1f2a17',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={saveAsUserConfirmed}
                  disabled={isConfirming || userConfirmedName.trim().length === 0}
                  title="도감 정보만 빠르게 저장합니다"
                  style={{
                    height: 34,
                    borderRadius: 6,
                    border: '1px solid #BBF7D0',
                    background:
                      isConfirming || userConfirmedName.trim().length === 0
                        ? '#F0FDF4'
                        : '#fff',
                    color:
                      isConfirming || userConfirmedName.trim().length === 0
                        ? '#86efac'
                        : '#15803D',
                    fontWeight: 600,
                    fontSize: 12,
                    padding: '0 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor:
                      isConfirming || userConfirmedName.trim().length === 0
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {isConfirming ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <span style={{ fontSize: 13 }}>🌱</span>
                  )}
                  식물만 저장
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  value={userConfirmedEnglishName}
                  onChange={(e) => setUserConfirmedEnglishName(e.target.value)}
                  placeholder="영어명 예: Luffa"
                  maxLength={80}
                  disabled={isConfirming}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid #BBF7D0',
                    background: '#fff',
                    padding: '0 10px',
                    fontSize: 13,
                    color: '#1f2a17',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  value={userConfirmedScientificName}
                  onChange={(e) => setUserConfirmedScientificName(e.target.value)}
                  placeholder="학명 예: Luffa cylindrica"
                  maxLength={120}
                  disabled={isConfirming}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid #BBF7D0',
                    background: '#fff',
                    padding: '0 10px',
                    fontSize: 13,
                    color: '#1f2a17',
                    outline: 'none',
                  }}
                />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7654', lineHeight: 1.5 }}>
                도감 정보만 빠르게 저장합니다 (오늘 기록과 분리)
              </p>
              {confirmedSavedDocId && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#166534',
                    background: '#DCFCE7',
                    padding: '6px 10px',
                    borderRadius: 6,
                  }}
                >
                  ✅ 도감에 저장되었습니다. 기존 Plant.id · PlantNet · Gemini 결과도 함께 보관됩니다.
                </div>
              )}
            </ResultCard>

            {/* ========== 📔 오늘의 관찰 ========== */}
            <section
              style={{
                border: '1px solid #d8c98a',
                background: '#fffbe6',
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#4A5A2C' }}>
                  📔 오늘의 관찰
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7654', lineHeight: 1.55 }}>
                  오늘 관찰한 변화나 생각을 간단히 기록해보세요.
                </p>
              </div>
              <textarea
                value={obsObservation}
                onChange={(e) => setObsObservation(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={
                  '오늘 무엇을 관찰했나요?\n예: 꽃이 처음 피었어요 / 줄기가 갑자기 많이 자랐어요'
                }
                style={{
                  borderRadius: 8,
                  border: '1px solid #e6dcab',
                  padding: '10px 12px',
                  background: '#fff',
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: '#1f2a17',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <textarea
                value={obsAiDifference}
                onChange={(e) => setObsAiDifference(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={
                  'AI 결과와 다른 점이 있었나요?\n예: AI는 오이라고 했지만 줄기 모양은 수세미 같았어요'
                }
                style={{
                  borderRadius: 8,
                  border: '1px solid #e6dcab',
                  padding: '10px 12px',
                  background: '#fff',
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: '#1f2a17',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <textarea
                value={obsMemo}
                onChange={(e) => setObsMemo(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder={'자유 메모\n예: 비 온 뒤 성장 속도가 빨라졌어요'}
                style={{
                  borderRadius: 8,
                  border: '1px solid #e6dcab',
                  padding: '10px 12px',
                  background: '#fff',
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: '#1f2a17',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <p style={{ margin: 0, fontSize: 11, color: '#92996f', lineHeight: 1.55 }}>
                작성한 관찰은 아래 <strong>📔 오늘 기록 저장</strong> 버튼을 누를 때 함께 저장됩니다.
              </p>
            </section>

            {/* ========== 메인 저장 버튼 ========== */}
            <p
              style={{
                margin: '0 0 6px',
                fontSize: 12,
                color: '#6b7654',
                textAlign: 'center',
                lineHeight: 1.55,
              }}
            >
              오늘의 관찰과 식물 정보를 함께 저장합니다
            </p>
            <button
              type="button"
              onClick={saveTodayAllRecord}
              disabled={isSaving || savedToToday}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 10,
                border: '1px solid #4A5A2C',
                background: savedToToday ? '#e7dfc8' : isSaving ? '#7b8b4b' : '#4A5A2C',
                color: '#fff',
                fontWeight: 900,
                fontSize: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: isSaving || savedToToday ? 'not-allowed' : 'pointer',
              }}
              title="오늘의 식물 기록과 관찰 내용을 함께 저장합니다"
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <span style={{ fontSize: 18 }}>📔</span>
              )}
              {savedToToday ? '오늘 기록에 저장됨' : isSaving ? '저장 중...' : '오늘 기록 저장'}
            </button>

            <p style={{ fontSize: 11, color: '#7a725d', textAlign: 'center', lineHeight: 1.55 }}>
              본 결과는 AI 참고용이며, 섭취·약용은 반드시 전문가 확인 후 진행해 주세요.
            </p>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}

// ===========================================
// 작은 표시 컴포넌트들
// ===========================================
function tsToLabel(value: any): string {
  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : typeof value === 'number'
      ? new Date(value)
      : value
      ? new Date(value)
      : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function PlantLibraryPanel({ plants }: { plants: PlantLibraryItem[] }) {
  if (plants.length === 0) {
    return (
      <ResultCard title="📚 내 식물도감" accent="#4A5A2C" bg="#fffdf4">
        <div style={{ fontSize: 13, color: '#6b7654' }}>
          사용자가 최종 확정한 식물이 여기에 저장됩니다.
        </div>
      </ResultCard>
    );
  }
  return (
    <ResultCard title="📚 내 식물도감" accent="#4A5A2C" bg="#fffdf4">
      <div style={{ display: 'grid', gap: 10 }}>
        {plants.map((p) => {
          const photo = p.imageUrl || p.photos?.[0] || '';
          const displayName = p.displayName || p.userConfirmedName || '식물 이름 불확실';
          const recent = tsToLabel(p.updatedAt) || tsToLabel(p.createdAt);
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                border: '1px solid #e5ddbf',
                borderRadius: 8,
                background: '#fff',
                padding: 10,
              }}
            >
              {photo ? (
                <img src={photo} alt={displayName} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 6, background: '#eef0d8', display: 'grid', placeItems: 'center', color: '#4A5A2C' }}>
                  <BookOpen size={22} />
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#24301f' }}>{displayName}</div>
                {(p.englishName || p.scientificName) && (
                  <div style={{ fontSize: 12, color: '#6b7654', fontStyle: 'italic', marginTop: 2 }}>
                    {[p.englishName, p.scientificName].filter(Boolean).join(' / ')}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#92996f', marginTop: 4 }}>
                  최근 관찰일 {recent || '-'}
                  {typeof p.observationCount === 'number' ? ` · ${p.observationCount}회` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ResultCard>
  );
}

function RecentDetectPanel({ plants }: { plants: PlantLibraryItem[] }) {
  return (
    <ResultCard title="최근 판독" accent="#7C5E10" bg="#FFF8DB">
      <div style={{ fontSize: 13, color: '#6b5b22', lineHeight: 1.55 }}>
        사용자 확정 후 도감에 저장된 최근 식물 기준으로 표시합니다. AI 단독 판독은 오늘 기록에만 남고 도감에는 저장하지 않습니다.
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {plants.slice(0, 10).map((p) => (
          <div key={p.id} style={{ border: '1px solid #f1e3a8', borderRadius: 8, background: '#fff', padding: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#3d3414' }}>
              {p.displayName || p.userConfirmedName || '식물 이름 불확실'}
            </div>
            {(p.englishName || p.scientificName) && (
              <div style={{ fontSize: 12, color: '#7a6a2c', fontStyle: 'italic', marginTop: 2 }}>
                {[p.englishName, p.scientificName].filter(Boolean).join(' / ')}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#a88f30', marginTop: 4 }}>
              최근 관찰일 {tsToLabel(p.updatedAt) || tsToLabel(p.createdAt) || '-'}
            </div>
          </div>
        ))}
        {plants.length === 0 && (
          <div style={{ fontSize: 13, color: '#7a6a2c' }}>아직 사용자 확정 판독이 없습니다.</div>
        )}
      </div>
    </ResultCard>
  );
}

function ResultCard({
  title,
  accent,
  bg,
  children,
}: {
  title: string;
  accent: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${accent}33`,
        background: bg,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: accent,
          marginBottom: 8,
          letterSpacing: 0.2,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 999,
        color,
        background: bg,
      }}
    >
      {text}
    </span>
  );
}

function CandList({
  label,
  items,
}: {
  label: string;
  items: { name: string; sub?: string; score?: number }[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#3d4734', marginBottom: 4 }}>
        {label}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.6 }}>
        {items.slice(0, 3).map((c, i) => (
          <li key={`c-${i}`} style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{c.name}</span>
            {c.sub && (
              <span style={{ marginLeft: 6, fontStyle: 'italic', color: '#6b7654', fontSize: 12 }}>
                {c.sub}
              </span>
            )}
            {typeof c.score === 'number' && (
              <span style={{ marginLeft: 6, color: '#92996f', fontSize: 11 }}>
                ({pctText(c.score)})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
