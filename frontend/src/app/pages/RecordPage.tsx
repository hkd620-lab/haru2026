import { useState, useRef, useEffect } from 'react';
import { DiaryLearnModal } from '../components/DiaryLearnModal';
import { Calendar, Check, Pencil, X } from 'lucide-react';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { useLocation, useNavigate } from 'react-router';
import { firestoreService, buildTimelineMeta } from '../services/firestoreService';
import { getOrigin } from '../services/v2Origin';
import { useAuth } from '../contexts/AuthContext';
import { RecordTitleAnimation } from '../components/RecordTitleAnimation';
import { FormatModal } from '../components/FormatModal';
import { AssistantRecommendationCards } from '../components/AssistantRecommendationCards';
import { HaruLawPanel, useHaruLaw } from '../assistants/haruLaw/HaruLawPanel';
import { PetHealthAlert, detectPetAlertLevel, type PetAlertLevel } from '../components/PetHealthAlert';
import { toast } from 'sonner';
import { RecordFormat, Category, CATEGORY_FORMATS } from '../types/haruTypes';
import {
  buildRecommendationTextFromFields,
  getAssistantRecommendations,
  type AssistantRecommendation,
} from '../utils/assistantRecommendations';
import { db } from '../../firebase';
import { doc, getDoc, getDocs, query, where, setDoc, serverTimestamp, collection, arrayUnion } from 'firebase/firestore';
import { findSameNameGrowthSubject } from '../utils/growthSubject';
import { useSubscription } from '../hooks/useSubscription';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Mood = '기쁨' | '평온' | '무미' | '울적' | '번잡';
type Weather = '쾌청' | '흐림' | '비' | '눈';
type Temperature = '폭염' | '온난' | '쾌적' | '쌀쌀' | '혹한';
type GrowthSubjectType = 'child' | 'garden';
type EnvTagType = 'weather' | 'temperature' | 'mood';

// 같은 이름의 아이가 이미 등록돼 있는지 찾는다(없거나 확인에 실패하면 undefined). 이름이 같은 아이가 여럿이면 생년월일이 있는 쪽을 우선한다.
async function findSameNameChildSubject(uid: string, name: string) {
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'growthSubjects'), where('subjectType', '==', 'child')));
    const subjects = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: String(data.name || '').trim(),
          birthdate: String(data.birthdate || data.growthSubjectBirthdate || ''),
          gender: data.gender === 'M' || data.gender === 'F' ? (data.gender as 'M' | 'F') : undefined,
          latestRecordDate: String(data.latestRecordDate || ''),
        };
      })
      .filter((subject) => subject.name)
      .sort((a, b) => b.latestRecordDate.localeCompare(a.latestRecordDate)); // 최근 기록순 — 대상 목록과 같은 순서
    return findSameNameGrowthSubject(subjects, name);
  } catch (error) {
    console.warn('같은 이름의 아이 확인 실패(새 대상으로 저장):', error);
    return undefined;
  }
}

const DEFAULT_WEATHER = ['쾌청', '흐림', '비', '눈'];
const DEFAULT_TEMPERATURE = ['폭염', '온난', '쾌적', '쌀쌀', '혹한'];
const DEFAULT_MOOD = ['기쁨', '평온', '무미', '울적', '번잡'];
function SortableTagItem({
  id,
  isSelected,
  canEdit = false,
  isEditing = false,
  editValue = '',
  onClick,
  onStartEdit,
  onEditValueChange,
  onConfirmEdit,
  onCancelEdit,
}: {
  id: string;
  isSelected: boolean;
  canEdit?: boolean;
  isEditing?: boolean;
  editValue?: string;
  onClick: () => void;
  onStartEdit?: () => void;
  onEditValueChange?: (value: string) => void;
  onConfirmEdit?: () => void;
  onCancelEdit?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
        zIndex: isDragging ? 999 : 'auto',
      }}
    >
      {isEditing ? (
        <div
          className="flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            value={editValue}
            onChange={(e) => onEditValueChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmEdit?.();
              if (e.key === 'Escape') onCancelEdit?.();
            }}
            className="w-16 px-2 py-1 border rounded-lg text-xs text-center"
            style={{ fontSize: 16 }}
            autoFocus
          />
          <button
            type="button"
            aria-label="태그 이름 저장"
            onClick={onConfirmEdit}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#1A3C6E', color: '#FAF9F6' }}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="태그 이름 수정 취소"
            onClick={onCancelEdit}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#e5e7eb', color: '#555' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClick}
            {...attributes}
            {...listeners}
            className="px-2.5 py-1 rounded-lg text-xs transition-all select-none"
            style={{
              backgroundColor: isSelected ? '#1A3C6E' : '#FEFBE8',
              color: isSelected ? '#FAF9F6' : '#333333',
              border: isSelected ? 'none' : '1px solid #e5e5e5',
              cursor: 'grab',
            }}
          >
            {id}
          </button>
          {canEdit && (
            <button
              type="button"
              aria-label={`${id} 태그 이름 수정`}
              onClick={onStartEdit}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#eef2f7', color: '#555' }}
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function RecordPage() {
  const [diaryLearnOpen, setDiaryLearnOpen] = useState(false);
  const [showNovelIntro, setShowNovelIntro] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const isLawPaidUser = subscription.status === 'active' && subscription.plan !== 'free';
  const [fromPath, setFromPath] = useState<string | null>(() => (location.state as any)?.from ?? null);
  const closeToOrigin = () => {
    if (lawSaveRef.current) {
      toast.info('저장 중입니다. 완료 후 닫을 수 있습니다.');
      return;
    }
    if (fromPath) {
      navigate(fromPath);
      return;
    }
    // sessionStorage에 v2 origin이 남아 있으면 그쪽으로 (통계/합본 거치며 state 유실된 경우)
    const origin = getOrigin();
    if (origin) {
      navigate(origin);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };
  const [currentDate] = useState(new Date());
  const [mood, setMood] = useState<Mood>('평온');
  const [showEnvToast, setShowEnvToast] = useState(false);
  const [weatherTags, setWeatherTags] = useState<string[]>(DEFAULT_WEATHER);
  const [temperatureTags, setTemperatureTags] = useState<string[]>(DEFAULT_TEMPERATURE);
  const [moodTags, setMoodTags] = useState<string[]>(DEFAULT_MOOD);
  const [showInput, setShowInput] = useState<{ weather: boolean; temperature: boolean; mood: boolean }>({ weather: false, temperature: false, mood: false });
  const [editingTag, setEditingTag] = useState<{ type: EnvTagType; original: string; value: string } | null>(null);

  // 항상 최신 태그값 참조용 ref
  const weatherTagsRef = useRef<string[]>([]);
  const temperatureTagsRef = useRef<string[]>([]);
  const moodTagsRef = useRef<string[]>([]);

  // ref 동기화
  useEffect(() => { weatherTagsRef.current = weatherTags; }, [weatherTags]);
  useEffect(() => { temperatureTagsRef.current = temperatureTags; }, [temperatureTags]);
  useEffect(() => { moodTagsRef.current = moodTags; }, [moodTags]);

  const [weather, setWeather] = useState<Weather>('쾌청');
  const [temperature, setTemperature] = useState<Temperature>('쾌적');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>('생활' as Category);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<RecordFormat[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [petAlertLevel, setPetAlertLevel] = useState<PetAlertLevel>(null);
  const [savedDateStr, setSavedDateStr] = useState('');
  const [savedFormat, setSavedFormat] = useState<RecordFormat | null>(null);
  const [savedAssistantRecommendations, setSavedAssistantRecommendations] = useState<AssistantRecommendation[]>([]);
  const lawEntrySectionRef = useRef<HTMLElement>(null);
  // 하루LAW 상태·처리는 assistants/haruLaw/HaruLawPanel.tsx 의 useHaruLaw 에 있다(탭을 바꿔도 상태가 유지되도록 이 컴포넌트에서 부른다).
  const haruLaw = useHaruLaw({ lawEntrySectionRef, isLawPaidUser, weather, temperature, mood });
  const { setLawGuideConfirmed, lawSaveRef } = haruLaw;
  const petAlertTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (petAlertTimerRef.current) {
        window.clearTimeout(petAlertTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const count = parseInt(localStorage.getItem('envToastCount') || '0');
    if (count < 3) {
      setShowEnvToast(true);
      localStorage.setItem('envToastCount', String(count + 1));
      const timer = setTimeout(() => setShowEnvToast(false), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const loadTags = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'settings', 'customTags');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();

          // 기본 태그가 없으면 앞에 추가하여 병합
          const mergeWithDefaults = (saved: string[], defaults: string[]) => {
            const missing = defaults.filter(d => !saved.includes(d));
            return [...missing, ...saved];
          };

          const mergedWeather = mergeWithDefaults(
            Array.isArray(data.weather) ? data.weather : [],
            DEFAULT_WEATHER
          );
          const mergedTemperature = mergeWithDefaults(
            Array.isArray(data.temperature) ? data.temperature : [],
            DEFAULT_TEMPERATURE
          );
          const mergedMood = mergeWithDefaults(
            Array.isArray(data.mood) ? data.mood : [],
            DEFAULT_MOOD
          );

          setWeatherTags(mergedWeather);
          setTemperatureTags(mergedTemperature);
          setMoodTags(mergedMood);

          // 병합된 데이터 Firestore에 다시 저장
          await setDoc(docRef, {
            weather: mergedWeather,
            temperature: mergedTemperature,
            mood: mergedMood,
          }, { merge: true });

        }
      } catch (e) {
        console.error('태그 로드 실패:', e);
      }
    };
    loadTags();
  }, [user?.uid]);

  const saveTags = async (weather: string[], temperature: string[], mood: string[]) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'settings', 'customTags'), { weather, temperature, mood }, { merge: true });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const handleDragEnd = async (event: DragEndEvent, type: EnvTagType) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // ref에서 항상 최신값 읽기 (stale closure 방지)
    const tags = type === 'weather' ? weatherTagsRef.current
      : type === 'temperature' ? temperatureTagsRef.current
      : moodTagsRef.current;

    const setArr = type === 'weather' ? setWeatherTags
      : type === 'temperature' ? setTemperatureTags
      : setMoodTags;

    const oldIndex = tags.indexOf(active.id as string);
    const newIndex = tags.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...tags], oldIndex, newIndex);
    setArr(reordered);

    const newWeather = type === 'weather' ? reordered : weatherTagsRef.current;
    const newTemperature = type === 'temperature' ? reordered : temperatureTagsRef.current;
    const newMood = type === 'mood' ? reordered : moodTagsRef.current;
    await saveTags(newWeather, newTemperature, newMood);
  };

  const handleMoveTag = async (type: EnvTagType, index: number, direction: 'left' | 'right') => {
    const arr = type === 'weather' ? weatherTags : type === 'temperature' ? temperatureTags : moodTags;
    const setArr = type === 'weather' ? setWeatherTags : type === 'temperature' ? setTemperatureTags : setMoodTags;
    const tags = [...arr];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tags.length) return;
    [tags[index], tags[targetIndex]] = [tags[targetIndex], tags[index]];
    setArr(tags);
    await saveTags(
      type === 'weather' ? tags : weatherTags,
      type === 'temperature' ? tags : temperatureTags,
      type === 'mood' ? tags : moodTags,
    );
  };

  const getEnvTagConfig = (type: EnvTagType) => {
    if (type === 'weather') {
      return { tags: weatherTags, setTags: setWeatherTags, defaults: DEFAULT_WEATHER };
    }
    if (type === 'temperature') {
      return { tags: temperatureTags, setTags: setTemperatureTags, defaults: DEFAULT_TEMPERATURE };
    }
    return { tags: moodTags, setTags: setMoodTags, defaults: DEFAULT_MOOD };
  };

  const getSelectedEnvValue = (type: EnvTagType) => {
    if (type === 'weather') return weather;
    if (type === 'temperature') return temperature;
    return mood;
  };

  const setSelectedEnvValue = (type: EnvTagType, value: string) => {
    if (type === 'weather') setWeather(value as Weather);
    else if (type === 'temperature') setTemperature(value as Temperature);
    else setMood(value as Mood);
  };

  const handleRenameCustomTag = async () => {
    if (!editingTag) return;

    const { type, original, value } = editingTag;
    const nextTag = value.trim();
    if (!nextTag) {
      toast.error('태그 이름을 입력해주세요');
      return;
    }
    if ([...nextTag].length > 4) {
      toast.error('4글자 이하로 입력해주세요');
      return;
    }

    const { tags, setTags, defaults } = getEnvTagConfig(type);
    if (defaults.includes(original)) {
      setEditingTag(null);
      return;
    }
    if (nextTag !== original && tags.includes(nextTag)) {
      toast.error('이미 추가된 태그입니다');
      return;
    }

    const updated = tags.map((tag) => (tag === original ? nextTag : tag));
    setTags(updated);
    if (getSelectedEnvValue(type) === original) {
      setSelectedEnvValue(type, nextTag);
    }
    await saveTags(
      type === 'weather' ? updated : weatherTags,
      type === 'temperature' ? updated : temperatureTags,
      type === 'mood' ? updated : moodTags,
    );
    setEditingTag(null);
  };

  const handleAddCustomTag = async (type: EnvTagType) => {
    const inputEl = document.getElementById(`custom-input-${type}`) as HTMLInputElement;
    const trimmed = inputEl?.value?.trim() || '';
    if (!trimmed) return;
    if ([...trimmed].length > 4) { toast.error('4글자 이하로 입력해주세요'); return; }
    const arr = type === 'weather' ? weatherTags : type === 'temperature' ? temperatureTags : moodTags;
    const setArr = type === 'weather' ? setWeatherTags : type === 'temperature' ? setTemperatureTags : setMoodTags;
    const defaultArr = type === 'weather' ? DEFAULT_WEATHER : type === 'temperature' ? DEFAULT_TEMPERATURE : DEFAULT_MOOD;
    if (arr.filter((tag) => !defaultArr.includes(tag)).length >= 4) { toast.error('최대 4개까지 추가 가능합니다'); return; }
    if (arr.includes(trimmed)) { toast.error('이미 추가된 태그입니다'); return; }
    const updated = [...arr, trimmed];
    setArr(updated);
    await saveTags(
      type === 'weather' ? updated : weatherTags,
      type === 'temperature' ? updated : temperatureTags,
      type === 'mood' ? updated : moodTags,
    );
    if (inputEl) inputEl.value = '';
    setShowInput({ ...showInput, [type]: false });
  };

  const renderCustomTags = (type: EnvTagType) => {
    const tags = type === 'weather' ? weatherTags
      : type === 'temperature' ? temperatureTags : moodTags;
    const defaultArr = type === 'weather' ? DEFAULT_WEATHER : type === 'temperature' ? DEFAULT_TEMPERATURE : DEFAULT_MOOD;
    const customCount = tags.filter((tag) => !defaultArr.includes(tag)).length;

    return (
      <>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, type)}
        >
          <SortableContext
            items={tags}
            strategy={horizontalListSortingStrategy}
          >
            {tags.map((tag) => {
              const isSelected =
                (type === 'weather' && weather === tag) ||
                (type === 'temperature' && temperature === tag) ||
                (type === 'mood' && mood === tag);
              const isEditing = editingTag?.type === type && editingTag.original === tag;
              return (
                <SortableTagItem
                  key={tag}
                  id={tag}
                  isSelected={isSelected}
                  canEdit={!defaultArr.includes(tag)}
                  isEditing={isEditing}
                  editValue={isEditing ? editingTag.value : tag}
                  onClick={() => {
                    if (type === 'weather') setWeather(tag as Weather);
                    else if (type === 'temperature') setTemperature(tag as Temperature);
                    else setMood(tag as Mood);
                  }}
                  onStartEdit={() => setEditingTag({ type, original: tag, value: tag })}
                  onEditValueChange={(value) =>
                    setEditingTag((prev) =>
                      prev?.type === type && prev.original === tag ? { ...prev, value } : prev,
                    )
                  }
                  onConfirmEdit={handleRenameCustomTag}
                  onCancelEdit={() => setEditingTag(null)}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {showInput[type] ? (
          <div className="flex items-center gap-1">
            <input
              id={`custom-input-${type}`}
              type="text"
              placeholder="최대 4자"
              style={{ fontSize: 16 }}
              className="w-16 px-2 py-1 border rounded-lg text-xs text-center"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustomTag(type);
                if (e.key === 'Escape') setShowInput({ ...showInput, [type]: false });
              }}
            />
            <button onClick={() => handleAddCustomTag(type)}
              className="text-xs font-bold" style={{ color: '#1A3C6E' }}>확인</button>
            <button onClick={() => setShowInput({ ...showInput, [type]: false })}
              className="text-xs" style={{ color: '#999' }}>취소</button>
          </div>
        ) : customCount < 4 ? (
          <button
            onClick={() => setShowInput({ ...showInput, [type]: true })}
            className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold"
            style={{ backgroundColor: '#e5e7eb', color: '#555' }}
          >+</button>
        ) : null}
      </>
    );
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${year}.${month}.${day} ${dayOfWeek}요일`;
  };

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const openFormatDirectly = (format: RecordFormat) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    const dateStr = getLocalDateString(currentDate);
    setSavedDateStr(dateStr);
    setSavedAssistantRecommendations([]);
    setSavedFormat(format);
    setSelectedFormats([format]);
    setFormatModalOpen(true);
  };

  // RecordHubPage에서 format을 state로 전달받아 들어왔다면 자동으로 형식 모달 열기
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!user) return;
    const incomingFormat = (location.state as any)?.format as string | undefined;
    const incomingFrom = (location.state as any)?.from as string | undefined;
    if (incomingFrom) setFromPath(incomingFrom);
    if (!incomingFormat) return;
    autoOpenedRef.current = true;
    openFormatDirectly(incomingFormat as RecordFormat);
    // state 소비 후 history에서 제거 — 새로고침/뒤로가기 시 재열림 방지
    navigate(location.pathname, { replace: true, state: null });
  }, [user, location.state]);

  // RecordHubPage에서 category를 state로 전달받아 들어왔다면 해당 탭 자동 활성화
  useEffect(() => {
    const incomingCategory = (location.state as any)?.category as string | undefined;
    if (incomingCategory) {
      setSelectedCategory(incomingCategory as any);
    }
  }, [location.state]);

  const handleSave = async () => {
    if (!selectedFormats || selectedFormats.length === 0) {
      toast.error('형식을 선택해 주세요.');
      return;
    }
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    // Firestore 저장 없이 FormatModal만 열기
    const dateStr = getLocalDateString(currentDate);
    setSavedDateStr(dateStr);
    setSavedFormat(selectedFormats[0]);
    setFormatModalOpen(true);
  };

  const handleAssistantRecommendationSelect = (recommendation: AssistantRecommendation) => {
    if (recommendation.targetPath) {
      navigate(recommendation.targetPath);
      return;
    }

  };

  const handleSaveFormatData = async (formatData: Record<string, string>) => {
    if (!user) return;
    const typedGrowthSubjectName =
      typeof (formatData as any)._growthSubjectName === 'string'
        ? ((formatData as any)._growthSubjectName as string).trim()
        : '';
    const growthSubjectType =
      (formatData as any)._growthSubjectType === 'child' || (formatData as any)._growthSubjectType === 'garden'
        ? ((formatData as any)._growthSubjectType as GrowthSubjectType)
        : undefined;
    const formGrowthSubjectId =
      typeof (formatData as any)._growthSubjectId === 'string' && (formatData as any)._growthSubjectId
        ? ((formatData as any)._growthSubjectId as string)
        : undefined;
    // 아이를 이름만 써서 새로 추가하는 경우, 저장 직전에 같은 이름의 아이가 이미 있는지 다시 확인한다 —
    // 대상 목록을 불러오기 전에 저장했거나 다른 기기에서 막 등록한 경우에도 같은 아이가 둘로 갈라지지 않게 한다
    const sameNameChild =
      typedGrowthSubjectName && growthSubjectType === 'child' && !formGrowthSubjectId
        ? await findSameNameChildSubject(user.uid, typedGrowthSubjectName)
        : undefined;
    const growthSubjectName = sameNameChild?.name || typedGrowthSubjectName;
    const existingGrowthSubjectId = formGrowthSubjectId || sameNameChild?.id;
    // 이미 있는 아이에 이어서 기록할 때는 그 아이의 생년월일·성별을 우선한다(새로 입력한 값으로 덮어쓰지 않는다)
    const growthSubjectBirthdate =
      sameNameChild?.birthdate ||
      (typeof (formatData as any)._growthSubjectBirthdate === 'string' && (formatData as any)._growthSubjectBirthdate
        ? ((formatData as any)._growthSubjectBirthdate as string)
        : undefined);
    const growthSubjectGender =
      sameNameChild?.gender ||
      ((formatData as any)._growthSubjectGender === 'M' || (formatData as any)._growthSubjectGender === 'F'
        ? ((formatData as any)._growthSubjectGender as 'M' | 'F')
        : undefined);
    const shouldSaveGrowthEntry = Boolean(growthSubjectName && growthSubjectType);
    const growthSubjectId = shouldSaveGrowthEntry
      ? existingGrowthSubjectId || doc(collection(db, 'users', user.uid, 'growthSubjects')).id
      : undefined;
    const customRecordId =
      typeof (formatData as any)._recordId === 'string' && (formatData as any)._recordId
        ? ((formatData as any)._recordId as string)
        : undefined;
    const customRecordDate =
      typeof (formatData as any)._recordDate === 'string' && (formatData as any)._recordDate
        ? ((formatData as any)._recordDate as string)
        : undefined;
    const targetRecordDate = customRecordDate || savedDateStr;
    const formatsOverride = Array.isArray((formatData as any).formats)
      ? ((formatData as any).formats as string[])
      : undefined;
    const updateData: Record<string, any> = {};
    let hasContent = false;
    Object.entries(formatData).forEach(([key, value]) => {
      if (key === '_recordId' || key === '_recordDate' || key === 'formats' || key.startsWith('_growth')) return;
      if (typeof value === 'string' && value.trim().length > 0) {
        updateData[key] = value;
        hasContent = true;
      }
    });
    if (!hasContent) {
      toast.warning('최소 1개 이상의 필드를 작성해주세요.');
      return;
    }
    try {
      const recordId = await firestoreService.saveRecord(user.uid, {
        ...(customRecordId ? { id: customRecordId } : {}),
        date: targetRecordDate,
        weather,
        temperature,
        mood,
        formats: formatsOverride ?? selectedFormats,
        content: '',
        ...(shouldSaveGrowthEntry && growthSubjectId ? {
          growthSubjectId,
          growthSubjectType,
          growthSubjectName,
          ...(growthSubjectBirthdate ? { growthSubjectBirthdate } : {}),
          ...(growthSubjectGender ? { growthSubjectGender } : {}),
        } : {}),
        ...updateData,
      });
      const recommendationFormats = formatsOverride ?? selectedFormats;
      const recommendationText = buildRecommendationTextFromFields(updateData);
      const nextRecommendations = getAssistantRecommendations(
        recommendationText,
        recommendationFormats.map((format) => String(format)),
      );
      if (shouldSaveGrowthEntry && growthSubjectId && growthSubjectType) {
        const sourceFormat =
          typeof (formatData as any)._sourceFormat === 'string' && (formatData as any)._sourceFormat
            ? ((formatData as any)._sourceFormat as string)
            : growthSubjectType === 'child' ? '육아일기' : '텃밭일지';
        const prefix = growthSubjectType === 'child' ? 'child' : 'garden';
        const memo =
          String(updateData[`${prefix}_simple`] || '').trim() ||
          Object.entries(updateData)
            .filter(([key, value]) =>
              key.startsWith(`${prefix}_`) &&
              typeof value === 'string' &&
              value.trim().length > 0 &&
              !key.endsWith('_images') &&
              !key.endsWith('_style') &&
              !key.endsWith('_mode')
            )
            .map(([, value]) => String(value).trim())
            .join('\n\n');
        const photoUrls = (() => {
          const raw = updateData[`${prefix}_images`];
          if (typeof raw !== 'string') return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((url) => typeof url === 'string') : [];
          } catch {
            return [];
          }
        })();
        await setDoc(
          doc(db, 'users', user.uid, 'growthSubjects', growthSubjectId),
          {
            subjectType: growthSubjectType,
            name: growthSubjectName,
            ...(growthSubjectBirthdate ? { birthdate: growthSubjectBirthdate } : {}),
            ...(growthSubjectGender ? { gender: growthSubjectGender } : {}),
            ...(existingGrowthSubjectId ? {} : { createdAt: serverTimestamp() }),
            updatedAt: serverTimestamp(),
            latestRecordDate: targetRecordDate,
            ...(photoUrls[0] ? { latestPhotoUrl: photoUrls[0] } : {}),
            linkedRecordDates: arrayUnion(targetRecordDate),
          },
          { merge: true },
        );
        try {
          const gsSnap = await getDoc(doc(db, 'users', user.uid, 'growthSubjects', growthSubjectId));
          await firestoreService.upsertLibraryEntry(user.uid, {
            category: '비서',
            type: 'timeline',
            title: growthSubjectName,
            date: targetRecordDate,
            summary: `${growthSubjectType === 'child' ? '육아' : '텃밭'} 성장타임라인`,
            refPath: `users/${user.uid}/growthSubjects/${growthSubjectId}`,
            meta: buildTimelineMeta(gsSnap.data() || {}),
          });
        } catch (libraryError) {
          console.warn('타임라인 library 인덱싱 실패:', libraryError);
        }
        await setDoc(
          doc(db, 'users', user.uid, 'growthSubjects', growthSubjectId, 'entries', recordId),
          {
            recordDate: targetRecordDate,
            recordId,
            subjectType: growthSubjectType,
            subjectName: growthSubjectName,
            ...(growthSubjectBirthdate ? { subjectBirthdate: growthSubjectBirthdate } : {}),
            ...(growthSubjectGender ? { subjectGender: growthSubjectGender } : {}),
            memo,
            ...(photoUrls.length > 0 ? { photoUrls } : {}),
            createdAt: serverTimestamp(),
            sourceFormat,
          },
          { merge: true },
        );
      }
      if (
        savedFormat === '애완동물관찰일지' ||
        recommendationFormats.map((format) => String(format)).includes('애완동물관찰일지') ||
        recommendationFormats.map((format) => String(format)).includes('pet')
      ) {
        const level = detectPetAlertLevel(updateData as Record<string, string>);
        if (level) {
          setPetAlertLevel(level);
          if (petAlertTimerRef.current) {
            window.clearTimeout(petAlertTimerRef.current);
          }
          petAlertTimerRef.current = window.setTimeout(() => {
            setPetAlertLevel(null);
            petAlertTimerRef.current = null;
          }, 8000);
        }
      }
      setSavedAssistantRecommendations(nextRecommendations);
      toast.success('내용이 저장되었습니다!');
      return recordId;
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('내용 저장에 실패했습니다.');
      throw error;
    }
  };

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-3" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      <PageHeaderActions onClose={closeToOrigin} />
      <div className="space-y-3">
        {/* Title Animation */}
        <section className="flex items-center justify-center py-1">
          <RecordTitleAnimation />
        </section>

        {/* Date */}
        <section className="flex items-center justify-center gap-2 py-1">
          <Calendar className="w-4 h-4" style={{ color: '#1A3C6E' }} />
          <span className="text-sm tracking-wide" style={{ color: '#333333' }}>
            {formatDate(currentDate)}
          </span>
        </section>

        {/* Context Section */}
        <section className="bg-white rounded-lg p-3 shadow-sm">
          <h2 className="text-xs mb-2 tracking-wider" style={{ color: '#666666' }}>
            오늘의 환경
          </h2>
          <div
            className={`transition-all duration-500 overflow-hidden ${showEnvToast ? 'max-h-10 opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0'}`}
          >
            <p className="text-xs flex items-center gap-1" style={{ color: '#10b981' }}>
              💡 + 버튼으로 나만의 태그를 추가할 수 있어요
            </p>
          </div>
          <div className="space-y-2">
            {/* Weather */}
            <div>
              <p className="text-xs mb-1.5 tracking-wide" style={{ color: '#999999' }}>
                날씨
              </p>
              <div className="flex flex-wrap gap-1.5">
                {renderCustomTags('weather')}
              </div>
            </div>

            {/* Temperature */}
            <div>
              <p className="text-xs mb-1.5 tracking-wide" style={{ color: '#999999' }}>
                체감기온
              </p>
              <div className="flex flex-wrap gap-1.5">
                {renderCustomTags('temperature')}
              </div>
            </div>

            {/* Mood */}
            <div>
              <p className="text-xs mb-1.5 tracking-wide" style={{ color: '#999999' }}>
                기분
              </p>
              <div className="flex flex-wrap gap-1.5">
                {renderCustomTags('mood')}
              </div>
            </div>
          </div>
        </section>

        {/* Format Selection */}
        <section ref={lawEntrySectionRef} className="bg-white rounded-lg p-3 shadow-sm">
          <div className="mb-2">
            <h2 className="text-xs tracking-wider" style={{ color: '#666666' }}>
              형식 선택
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#999999' }}>
              형식을 선택하면 바로 글쓰기
            </p>
          </div>

          {/* 카테고리 선택 */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {(['생활', '업무', '하루LAW'] as (Category | 'HARUraw' | '하루학습' | '하루LAW')[]).map((category) => (
              <button
                key={category}
                onMouseEnter={() => setHoveredCategory(category)}
                onMouseLeave={() => setHoveredCategory(null)}
                onClick={() => {
                  // 📈 HARU주식관리 클릭 시 바로 모달 열기
                  if (category === 'HARU주식관리') {
                    const dateStr = getLocalDateString(currentDate);
                    setSavedDateStr(dateStr);
                    setSavedFormat('HARU주식관리');
                    setSelectedFormats(['HARU주식관리']);
                    setFormatModalOpen(true);
                    return;
                  }
                  // 🔮 HARU예언 클릭 시 노벨 인트로 모달 열기
                  if (category === 'HARU예언') {
                    setShowNovelIntro(true);
                    return;
                  }
                  if (selectedCategory === category) {
                    setSelectedCategory(null);
                    setLawGuideConfirmed(false);
                  } else {
                    setSelectedCategory(category as any);
                    setLawGuideConfirmed(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-xs transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  backgroundColor: selectedCategory === category ? '#1A3C6E' : hoveredCategory === category ? '#1A3C6E' : '#FDF6C3',
                  color: selectedCategory === category ? '#FAF9F6' : hoveredCategory === category ? '#FAF9F6' : '#1A3C6E',
                  border: selectedCategory === category ? 'none' : hoveredCategory === category ? 'none' : '1px solid #d0dff0',
                  fontWeight: selectedCategory === category ? 600 : 500,
                  transition: 'background-color 0.2s, color 0.2s, border 0.2s',
                }}
              >
                {category === 'HARU주식관리' ? '📈 HARU주식관리' :
                 category === 'HARU예언' ? '🔮 HARU미래전망' :
                 category}
              </button>
            ))}
          </div>

          {/* 형식 버튼 */}
          {selectedCategory === '하루학습' ? (
            <div style={{ padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 16, textAlign: 'center' }}>
                학습할 형식을 선택하세요
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 영어성경학습 */}
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '20px', borderRadius: 12,
                    border: '1.5px solid #d0dff0',
                    backgroundColor: '#f8faff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onClick={() => navigate('/bible')}
                >
                  <span style={{ fontSize: 32 }}>📖</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 4 }}>
                      영어성경학습
                    </p>
                    <p style={{ fontSize: 12, color: '#999' }}>
                      영어 성경 읽기 · TTS 듣기 · AI 번역/해설
                    </p>
                  </div>
                </button>
                {/* 영어일기작성 */}
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '20px', borderRadius: 12,
                    border: '1.5px solid #d0dff0',
                    backgroundColor: '#f8faff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onClick={() => navigate('/diary-learn')}
                >
                  <span style={{ fontSize: 32 }}>✍️</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 4 }}>
                      영어일기작성
                    </p>
                    <p style={{ fontSize: 12, color: '#999' }}>
                      영어로 일기 작성 · AI 교정/피드백
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ) : selectedCategory === '하루LAW' ? (
            <HaruLawPanel law={haruLaw} />
          ) : selectedCategory ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CATEGORY_FORMATS[selectedCategory]
                .map((format) => {
                return (
                  <button
                    key={format}
                    onClick={() => openFormatDirectly(format)}
                    className="p-2.5 rounded-lg text-center transition-all text-xs"
                    style={{
                      backgroundColor: '#FEFBE8',
                      border: '1px solid #e5e5e5',
                      color: '#333333',
                    }}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs" style={{ color: '#999' }}>
                카테고리를 선택하세요
              </p>
            </div>
          )}

        </section>

      </div>
    </div>

    {diaryLearnOpen && <DiaryLearnModal onClose={() => setDiaryLearnOpen(false)} />}
    {savedFormat && (
      <FormatModal
        isOpen={formatModalOpen}
        onClose={() => {
          setFormatModalOpen(false);
          closeToOrigin();
        }}
        format={savedFormat}
        recordId={savedDateStr}
        onSave={handleSaveFormatData}
      />
    )}
    {savedAssistantRecommendations.length > 0 && !formatModalOpen && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="기록 속 비서 연결"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.42)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            maxHeight: '86vh',
            overflowY: 'auto',
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            padding: 16,
            boxShadow: '0 20px 44px rgba(15, 23, 42, 0.24)',
          }}
        >
          <AssistantRecommendationCards
            recommendations={savedAssistantRecommendations}
            title="이 기록에서 도움받을 수 있는 AI 비서를 찾았습니다."
            description="기록 속 고민 키워드를 바탕으로 필요한 비서와 연결할 수 있습니다."
            privacyNote="선택한 경우에만 해당 기록 내용을 비서에게 전달합니다."
            onSelect={handleAssistantRecommendationSelect}
          />
          <button
            type="button"
            onClick={() => setSavedAssistantRecommendations([])}
            style={{
              width: '100%',
              minHeight: 40,
              marginTop: 12,
              borderRadius: 8,
              border: '1px solid #D7D2E8',
              backgroundColor: '#FFFFFF',
              color: '#1A3C6E',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    )}
    <PetHealthAlert
      level={petAlertLevel}
      onDismiss={() => {
        setPetAlertLevel(null);
        if (petAlertTimerRef.current) {
          window.clearTimeout(petAlertTimerRef.current);
          petAlertTimerRef.current = null;
        }
      }}
    />
      {/* 나도작가 안내 모달 */}
      {showNovelIntro && (
        <div
          onClick={() => setShowNovelIntro(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#fff', borderRadius: 20,
              padding: '24px 22px 28px', width: '100%', maxWidth: 440,
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            {/* 핸들 */}
            <div style={{ width: 36, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, margin: '0 auto 20px' }} />

            {/* 타이틀 */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8, lineHeight: 1 }}>🔮</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#1A3C6E', marginBottom: 6 }}>HARU미래전망</div>
              <div style={{ display: 'inline-block', background: '#E6F1FB', borderRadius: 99, padding: '3px 14px', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#0C447C', fontWeight: 500 }}>사주보다 과학적인 접근</span>
              </div>
              <div style={{ fontSize: 12, color: '#999', lineHeight: 1.7 }}>내 기록과 내 선택이 미래를 말합니다</div>
            </div>

            {/* 트랙 1 — 내 기록으로 창작 */}
            <div
              onClick={() => { setShowNovelIntro(false); navigate('/record-prophecy'); }}
              style={{ borderRadius: 14, border: '2px solid #185FA5', backgroundColor: '#1A3C6E', padding: '14px 16px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#0C447C'; (e.currentTarget as HTMLDivElement).style.borderColor = '#378ADD'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#1A3C6E'; (e.currentTarget as HTMLDivElement).style.borderColor = '#185FA5'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                <span style={{ fontSize: 13 }}>🔵</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>내 기록으로 창작</span>
              </div>
              <p style={{ fontSize: 11, color: '#B5D4F4', lineHeight: 1.9, marginBottom: 7 }}>
                일기, 에세이, 육아일기 ···<br />
                한 기록을 선택하거나 합친 기록을 선택하여
              </p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
                <span style={{ fontSize: 10, background: '#fff', color: '#1A3C6E', borderRadius: 99, padding: '3px 10px', fontWeight: 500 }}>전망서</span>
                <span style={{ fontSize: 10, background: 'transparent', color: '#B5D4F4', border: '0.5px solid #378ADD', borderRadius: 99, padding: '3px 10px' }}>나의 미래</span>
                <span style={{ fontSize: 10, background: 'transparent', color: '#B5D4F4', border: '0.5px solid #378ADD', borderRadius: 99, padding: '3px 10px' }}>자녀의 미래</span>
                <span style={{ fontSize: 10, background: '#fff', color: '#1A3C6E', borderRadius: 99, padding: '3px 10px', fontWeight: 500 }}>나의 회고록</span>
              </div>
              <p style={{ fontSize: 11, color: '#B5D4F4' }}>으로 확장합니다.</p>
            </div>

            {/* 트랙 2 — 순수 창작 */}
            <div
              onClick={() => { setShowNovelIntro(false); navigate('/novel-studio'); }}
              style={{ borderRadius: 14, border: '2px solid #0F6E56', backgroundColor: '#065f46', padding: '14px 16px', marginBottom: 14, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#085041'; (e.currentTarget as HTMLDivElement).style.borderColor = '#1D9E75'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#065f46'; (e.currentTarget as HTMLDivElement).style.borderColor = '#0F6E56'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                <span style={{ fontSize: 13 }}>🟢</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>순수 창작</span>
              </div>
              <p style={{ fontSize: 11, color: '#9FE1CB', lineHeight: 1.9, marginBottom: 7 }}>
                9가지 나만의 선택으로
              </p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
                <span style={{ fontSize: 10, background: '#fff', color: '#065f46', borderRadius: 99, padding: '3px 10px', fontWeight: 500 }}>전망서</span>
                <span style={{ fontSize: 10, background: 'transparent', color: '#9FE1CB', border: '0.5px solid #5DCAA5', borderRadius: 99, padding: '3px 10px' }}>나의 미래</span>
                <span style={{ fontSize: 10, background: 'transparent', color: '#9FE1CB', border: '0.5px solid #5DCAA5', borderRadius: 99, padding: '3px 10px' }}>자식의 미래</span>
                <span style={{ fontSize: 10, background: '#fff', color: '#065f46', borderRadius: 99, padding: '3px 10px', fontWeight: 500 }}>창작소설</span>
              </div>
              <p style={{ fontSize: 11, color: '#9FE1CB' }}>나만의 소설가가 되어보세요.</p>
            </div>

            {/* 소개 박스 — 하단 */}
            <div style={{ border: '0.5px solid #B5D4F4', borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: '#f8fbff' }}>
              <div style={{ fontSize: 12, color: '#1A3C6E', lineHeight: 2.0, textAlign: 'center', marginBottom: 12 }}>
                <div>내 과거의 선택을 <strong>다시</strong> 하고 싶나요?</div>
                <div>내 인생을 <strong>다시 시작</strong>하고 싶나요?</div>
                <div>내 자식의 <strong>미래</strong>가 궁금하나요?</div>
                <div>소설가가 되어 <strong>이야기를 창작</strong>하고 싶나요?</div>
              </div>
              <div style={{ borderTop: '0.5px solid #B5D4F4', paddingTop: 12 }}>
                <p style={{ fontSize: 10, color: '#185FA5', textAlign: 'center', marginBottom: 8, fontWeight: 500, letterSpacing: '0.5px' }}>9 가 지 설 정</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 10 }}>
                  {[['01','모티브'],['02','인물'],['03','탄생'],['04','욕망'],['05','족쇄'],['06','사건'],['07','운'],['08','불운'],['09','서사']].map(([num, label]) => (
                    <div key={num} style={{ background: num === '09' ? '#E1F5EE' : '#E6F1FB', borderRadius: 6, padding: '4px 2px', textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: num === '09' ? '#1D9E75' : '#378ADD', marginBottom: 1 }}>{num}</div>
                      <div style={{ fontSize: 10, color: num === '09' ? '#085041' : '#185FA5', fontWeight: 500 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: '#185FA5', textAlign: 'center', lineHeight: 1.7 }}>
                  9가지 설정으로 <strong>미래를 예측</strong>하고<br /><strong>소설가</strong>도 되어 보세요
                </p>
              </div>
            </div>

            {/* 닫기 */}
            <button
              onClick={() => setShowNovelIntro(false)}
              style={{ width: '100%', padding: '12px', borderRadius: 10, backgroundColor: 'transparent', color: '#999', fontSize: 13, border: '0.5px solid #e5e5e5', cursor: 'pointer' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
