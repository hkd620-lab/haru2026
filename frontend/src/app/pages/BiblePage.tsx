import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { BIBLE_BOOKS } from '../../data/bibleBooks';

interface Verse {
  verse: number;
  text: string;
}

const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

const showTTSLimitAlert = (err: any) => {
  const msg = err?.message || '';
  const code = err?.code || '';
  if (msg.includes('한도') || code === 'functions/resource-exhausted' || code === 'resource-exhausted') {
    alert('오늘 TTS 사용 한도(500회)를 초과했습니다. 내일 다시 이용해주세요 😊');
  }
};

export function BiblePage() {
  const navigate = useNavigate();
  const currentUid = getAuth().currentUser?.uid ?? '';
  const isDev = currentUid === DEV_UID;
  const [errorPopup, setErrorPopup] = useState<{
    verseText: string;
    loading: boolean;
    changes?: string[];
  } | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [ttsPaused, setTtsPaused] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [highlightedWord, setHighlightedWord] = useState<{ key: string; index: number } | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingNavRef = useRef<{
    prefix: string;
    chapter: number;
    verse: number;
    mode?: 'en' | 'ko' | 'seq' | 'quiz';
  } | null>(null);
  const progressMapRef = useRef<Record<string, { heardVerses: number[]; quizVerses: number[]; lastVerse: number; lastMode: string }>>({});

  // 안드로이드 오디오 잠금 해제
  useEffect(() => {
    const unlock = () => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx && !audioCtxRef.current) {
        const ctx = new AudioCtx();
        ctx.resume();
        audioCtxRef.current = ctx;
      }
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [isFullPlaying, setIsFullPlaying] = useState(false);
  const [isBookPlaying, setIsBookPlaying] = useState<boolean>(false);
  const [bookPlayingChapter, setBookPlayingChapter] = useState<number | null>(null);
  const [playMode, setPlayMode] = useState<'en' | 'seq' | 'ko'>('en');
  const [playRange, setPlayRange] = useState<'chapter' | 'book'>('chapter');
  // 진도 기록
  const [progressMap, setProgressMap] = useState<Record<string, {
    heardVerses: number[];
    quizVerses: number[];
    lastVerse: number;
    lastMode: string;
  }>>({});
  const [recentHistory, setRecentHistory] = useState<Array<{
    bookKo: string;
    bookPrefix: string;
    chapter: number;
    lastVerse: number;
    lastMode: string;
    lastHeardAt: any;
  }>>([]);
  const [resumeCardClosed, setResumeCardClosed] = useState<boolean>(false);
  // saveProgress가 매 호출마다 최신 progressMap을 읽도록 ref와 state를 동기화
  // (장/권 전체 듣기 for-loop에서 stale closure로 이전 절이 덮어써지는 버그 방지)
  progressMapRef.current = progressMap;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 문법 팝업
  const [grammarPopup, setGrammarPopup] = useState<{
    verseText: string;
    loading: boolean;
    verb?: string;
    verb_example_en?: string;
    verb_example_ko?: string;
    preposition?: string;
    preposition_example_en?: string;
    preposition_example_ko?: string;
    phrasal?: string;
    phrasal_example_en?: string;
    phrasal_example_ko?: string;
    relative?: string;
    relative_example_en?: string;
    relative_example_ko?: string;
    question?: string;
    question_example_en?: string;
    question_example_ko?: string;
    exclamation?: string;
    exclamation_example_en?: string;
    exclamation_example_ko?: string;
    mysentence?: string;
    korean?: string;
  } | null>(null);

  // 번역 팝업
  const [translationPopup, setTranslationPopup] = useState<{
    verse: number;
    text: string;
    translation: string;
    loading: boolean;
  } | null>(null);

  // 한→영 하이라이트 매핑
  const [koEnMapping, setKoEnMapping] = useState<Array<{ ko: string; enWords: string[] }>>([]);
  const [highlightedEnWords, setHighlightedEnWords] = useState<string[]>([]);

  // 영→한 연속 듣기 상태
  const [isSequentialPlaying, setIsSequentialPlaying] = useState<number | null>(null);

  const BOOKS = BIBLE_BOOKS;
  const [currentTestament, setCurrentTestament] = useState<'구약' | '신약'>('구약');
  const [currentBook, setCurrentBook] = useState(BOOKS[0]);
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [genesisData, setGenesisData] = useState<{ book: string; bookKo: string; chapter: number; verses: Verse[] } | null>(null);

  useEffect(() => {
    import(`../../data/${currentBook.prefix}_${currentChapter}.json`)
      .then((mod) => setGenesisData(mod.default))
      .catch(() => console.error(`${currentBook.prefix}_${currentChapter}.json 로드 실패`));
  }, [currentBook, currentChapter]);

  // 현재 장 전체 자동 사전생성 (책/장 변경 시마다 실행)
  useEffect(() => {
    if (!genesisData?.verses?.length) return;
    const user = getAuth().currentUser;
    if (!user) return;
    const verseTexts: Record<string, string> = {};
    const verses: string[] = [];
    genesisData.verses.forEach((verse: Verse) => {
      const verseKey = `${currentBook.prefix}_${currentChapter}_${verse.verse}`;
      verses.push(verseKey);
      verseTexts[verseKey] = verse.text;
    });
    const fns = getFunctions(undefined, 'asia-northeast3');
    const fn = httpsCallable(fns, 'preloadChapterGrammar', { timeout: 540000 });
    fn({ book: currentBook.ko, chapter: currentChapter, verses, verseTexts }).catch(() => {});
  }, [genesisData, currentBook.prefix, currentChapter]);

  useEffect(() => {
    setSelectedVerse(null);
    setTtsPlaying(null);
    setIsFullPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    setCurrentChapter(1);
  }, [currentBook]);

  // 신구약 탭 변경 시 해당 첫 번째 책 자동 선택
  useEffect(() => {
    const first = BOOKS.find((b) => b.testament === currentTestament);
    if (first && currentBook.testament !== currentTestament) {
      setCurrentBook(first);
      setCurrentChapter(1);
    }
  }, [currentTestament]);

  useEffect(() => {
    if (isBookPlaying) return;
    setSelectedVerse(null);
    setTtsPlaying(null);
    setIsFullPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter]);

  // 현재 책의 모든 장 진도 불러오기 — 새로고침 시 auth 비동기 복원 대응
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (!user || cancelled) return;
      try {
        const colRef = collection(db, 'users', user.uid, 'bibleProgress');
        const snap = await getDocs(colRef);
        const map: Record<string, { heardVerses: number[]; quizVerses: number[]; lastVerse: number; lastMode: string }> = {};
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data.lastBookPrefix === currentBook.prefix) {
            map[d.id] = {
              heardVerses: data.heardVerses || [],
              quizVerses: data.quizVerses || [],
              lastVerse: data.lastVerse || 0,
              lastMode: data.lastMode || '',
            };
          }
        });
        if (!cancelled) setProgressMap((p) => ({ ...p, ...map }));
      } catch (e) {
        console.warn('progressMap 로드 실패:', e);
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [currentBook.prefix]);

  // 최근 학습 3개 (전체 책 기준) — 새로고침 시 auth 비동기 복원 대응
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (!user || cancelled) return;
      try {
        const colRef = collection(db, 'users', user.uid, 'bibleProgress');
        const q = query(colRef, orderBy('lastHeardAt', 'desc'), limit(3));
        const snap = await getDocs(q);
        const list: Array<{ bookKo: string; bookPrefix: string; chapter: number; lastVerse: number; lastMode: string; lastHeardAt: any }> = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data.lastBookPrefix && data.lastChapter) {
            list.push({
              bookKo: data.lastBook || '',
              bookPrefix: data.lastBookPrefix,
              chapter: data.lastChapter,
              lastVerse: data.lastVerse || 0,
              lastMode: data.lastMode || '',
              lastHeardAt: data.lastHeardAt || null,
            });
          }
        });
        if (!cancelled) setRecentHistory(list);
      } catch (e) {
        console.warn('recentHistory 로드 실패:', e);
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // 이어듣기 — 책 변경 후 chapter=1로 리셋되는 useEffect를 보정해 pending chapter로 복원
  // (currentChapter 도 dep에 포함 — [currentBook] effect가 chapter=1로 덮어쓴 후속 렌더에서도 보정)
  useEffect(() => {
    const pn = pendingNavRef.current;
    if (pn && pn.prefix === currentBook.prefix && currentChapter !== pn.chapter) {
      setCurrentChapter(pn.chapter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBook.prefix, currentChapter]);

  // 이어듣기 — chapter 데이터 로드 후 절 펼치기 + 스크롤 + 모드 자동 재생
  // genesisData 신선도(chapter/bookKo) 체크 — 이전 책/장의 stale 데이터로 잘못 트리거되는 것 방지
  useEffect(() => {
    const pn = pendingNavRef.current;
    if (
      pn &&
      pn.prefix === currentBook.prefix &&
      pn.chapter === currentChapter &&
      genesisData?.verses?.length &&
      genesisData?.chapter === currentChapter &&
      genesisData?.bookKo === currentBook.ko
    ) {
      if (pn.verse) setSelectedVerse(pn.verse);
      const targetVerse = pn.verse;
      const playMode = pn.mode;
      pendingNavRef.current = null;
      requestAnimationFrame(() => {
        const el = document.getElementById(`bible-verse-${targetVerse}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      if (playMode) {
        if (playMode === 'en') handleFullChapterTTS(targetVerse);
        else if (playMode === 'ko') handleFullChapterKoreanTTS(targetVerse);
        else if (playMode === 'seq') handleFullChapterSequentialTTS(targetVerse);
        else if (playMode === 'quiz') {
          const v = genesisData?.verses?.find((vs: Verse) => vs.verse === targetVerse);
          if (v) handleQuizClick(v);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genesisData, currentChapter, currentBook.prefix]);

  const handleGrammarClick = useCallback(async (verse: Verse) => {
    setGrammarPopup({ verseText: verse.text, loading: true });
    try {
      const { getFunctions: gf, httpsCallable: hc } = await import('firebase/functions');
      const fns = gf(undefined, 'asia-northeast3');
      const fn = hc(fns, 'getGrammarExplain');
      const res: any = await fn({
        verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
        verseText: verse.text,
      });
      const result = res.data;
      setGrammarPopup(prev => prev && ({
        ...prev,
        loading: false,
        verb: result.verb || '',
        verb_example_en: result.verb_example_en || '',
        verb_example_ko: result.verb_example_ko || '',
        preposition: result.preposition || '',
        preposition_example_en: result.preposition_example_en || '',
        preposition_example_ko: result.preposition_example_ko || '',
        phrasal: result.phrasal || '',
        phrasal_example_en: result.phrasal_example_en || '',
        phrasal_example_ko: result.phrasal_example_ko || '',
        relative: result.relative || '',
        relative_example_en: result.relative_example_en || '',
        relative_example_ko: result.relative_example_ko || '',
        question: result.question || '',
        question_example_en: result.question_example_en || '',
        question_example_ko: result.question_example_ko || '',
        exclamation: result.exclamation || '',
        exclamation_example_en: result.exclamation_example_en || '',
        exclamation_example_ko: result.exclamation_example_ko || '',
        mysentence: result.mysentence || '',
        korean: result.korean || '',
      }));
    } catch {
      setGrammarPopup({ verseText: verse.text, loading: false });
    }
  }, []);

  const handleTranslationClick = async (verse: { verse: number; text: string }) => {
    setTranslationPopup({ verse: verse.verse, text: verse.text, translation: '', loading: true });
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'getVerseTranslation');
      const result = await fn({
        verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
        text: verse.text,
      }) as { data: { translation: string } };
      setTranslationPopup({ verse: verse.verse, text: verse.text, translation: result.data.translation, loading: false });
    } catch {
      setTranslationPopup({ verse: verse.verse, text: verse.text, translation: '번역을 불러오지 못했습니다.', loading: false });
    }
  };

  // 모든 TTS 완전 정지 헬퍼
  const stopAllTTS = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
    setTtsPlaying(null);
    setTtsPaused(null);
    setHighlightedWord(null);
    setHighlightedEnWords([]);
    setSelectedVerse(null);
    setIsFullPlaying(false);
    setIsSequentialPlaying(null);
    setIsBookPlaying(false);
    setBookPlayingChapter(null);
  };

  // 한국어 TTS 듣기
  const handleKoreanTTS = async (verse: { verse: number; text: string }) => {
    const key = `verse_ko_${verse.verse}`;
    // 현재 재생 중 → 일시정지
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    // 일시정지 중 → 이어서 재생
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    // 새로운 재생 시작 시 → 기존 일시정지 초기화
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setTtsLoading(key);
    try {
      // 번역 먼저 가져오기 (캐시 우선)
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const transResult = await transFn({
        verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
        text: verse.text,
      }) as { data: { translation: string } };
      const translation = transResult.data.translation;

      // 한국어 TTS 호출
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const cacheKey = `bible_${currentBook.prefix}_${currentChapter}_ko_${verse.verse}_${koVoice}`.slice(0, 80);
      const res: any = await ttsFn({ text: translation, cacheKey, voice: koVoice });
      setTtsLoading(null);
      if (audioRef.current) audioRef.current.pause();
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      setHighlightedWord(null);
      let audioSrc = '';
      if (res.data.audioUrl) {
        audioSrc = res.data.audioUrl;
      } else if (res.data.audioBase64) {
        const binary = atob(res.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        audioSrc = URL.createObjectURL(blob);
      }
      if (audioSrc) {
        audioRef.current = new Audio(audioSrc);
        audioRef.current.playbackRate = ttsSpeed;
        audioRef.current.onended = () => {
          setTtsPlaying(null);
          setHighlightedEnWords([]);
          saveProgress(verse.verse, 'ko');
        };
        await audioRef.current.play();
        setTtsPlaying(key);
      }
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
    }
  };

  // 한→영 하이라이트 듣기 (세계최초)
  const handleKoEnHighlightTTS = async (verse: { verse: number; text: string }) => {
    const key = `verse_koen_${verse.verse}`;
    // 현재 재생 중 → 일시정지
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    // 일시정지 중 → 이어서 재생
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    // 새로운 재생 시작 시 → 기존 일시정지 초기화
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setTtsLoading(key);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const mappingFn = httpsCallable(fns, 'getVerseWordMapping');
      const ttsFn = httpsCallable(fns, 'generateTTS');

      const transResult = await transFn({
        verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
        text: verse.text,
      }) as { data: { translation: string } };
      const translation = transResult.data.translation;

      const [mappingResult, ttsResult] = await Promise.all([
        mappingFn({ verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`, enText: verse.text, koText: translation }) as Promise<{ data: { mapping: Array<{ ko: string; enWords: string[] }> } }>,
        ttsFn({ text: translation, cacheKey: `bible_${currentBook.prefix}_${currentChapter}_ko_${verse.verse}_${koVoice}`.slice(0, 80), voice: koVoice }) as Promise<{ data: { audioUrl?: string; audioBase64?: string } }>,
      ]);

      const mapping = mappingResult.data.mapping || [];
      setKoEnMapping(mapping);

      let audioSrc = '';
      if (ttsResult.data.audioUrl) {
        audioSrc = ttsResult.data.audioUrl;
      } else if (ttsResult.data.audioBase64) {
        const binary = atob(ttsResult.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        audioSrc = URL.createObjectURL(blob);
      }

      if (audioSrc) {
        if (audioRef.current) audioRef.current.pause();
        if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
        setHighlightedWord(null);

        audioRef.current = new Audio(audioSrc);
        audioRef.current.playbackRate = ttsSpeed;
        audioRef.current.onended = () => {
          setTtsPlaying(null);
          setHighlightedEnWords([]);
          if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
        };
        setTtsLoading(null);
        await audioRef.current.play();
        setTtsPlaying(key);

        // 한국어 어절마다 대응 영어 단어 그린 하이라이트
        let segIdx = 0;
        const startKoLoop = () => {
          const audio = audioRef.current!;
          const duration = audio.duration || mapping.length * 0.6;
          const interval = (duration * 1000) / (mapping.length || 1);
          highlightTimerRef.current = setInterval(() => {
            if (segIdx >= mapping.length) {
              clearInterval(highlightTimerRef.current!);
              setHighlightedEnWords([]);
              return;
            }
            setHighlightedEnWords(mapping[segIdx].enWords);
            segIdx++;
          }, interval);
        };
        const audio = audioRef.current!;
        if (audio.duration) {
          startKoLoop();
        } else {
          audio.addEventListener('loadedmetadata', startKoLoop, { once: true });
        }
      }
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setHighlightedEnWords([]);
    }
  };

  // 영어 → 한국어 연속 듣기
  const handleSequentialTTS = async (verse: { verse: number; text: string }) => {
    const key = `verse_${verse.verse}`;
    const pauseKey = `seq_${verse.verse}`;
    // 현재 재생 중 → 일시정지
    if (isSequentialPlaying === verse.verse && ttsPaused !== pauseKey) {
      audioRef.current?.pause();
      setTtsPaused(pauseKey);
      setIsSequentialPlaying(null);
      setTtsPlaying(null);
      return;
    }
    // 일시정지 중 → 이어서 재생
    if (ttsPaused === pauseKey) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setIsSequentialPlaying(verse.verse);
      return;
    }
    // 새로운 재생 시작 시 → 기존 일시정지 초기화
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setIsSequentialPlaying(verse.verse);
    setTtsLoading(`seq_${verse.verse}`);

    // iOS Safari 자동재생 정책 회피:
    // 매번 new Audio()를 만들면 iOS는 사용자 제스처와 무관한 새 인스턴스로 보고 두 번째(한국어) 재생을 차단함.
    // 단일 Audio 인스턴스를 사용자 제스처(클릭) 컨텍스트 안에서 확보하고, 영→한 모두 같은 인스턴스의 src만 교체해 재생.
    if (!audioRef.current) {
      audioRef.current = new Audio();
    } else {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    const audio = audioRef.current;

    try {
      const fns = getFunctions(undefined, 'asia-northeast3');

      // ① 영어 TTS
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const enCacheKey = `bible_${currentBook.prefix}_${currentChapter}_${verse.verse}_${enVoice}`.slice(0, 80);
      const enRes: any = await ttsFn({ text: verse.text, cacheKey: enCacheKey, voice: enVoice });
      setTtsLoading(null);

      let enAudioSrc = '';
      if (enRes.data.audioUrl) {
        enAudioSrc = enRes.data.audioUrl;
      } else if (enRes.data.audioBase64) {
        const binary = atob(enRes.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        enAudioSrc = URL.createObjectURL(blob);
      }

      if (!enAudioSrc) { setIsSequentialPlaying(null); return; }

      // ② 번역 미리 가져오기 (영어 듣는 동안 준비)
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const [_, transResult] = await Promise.all([
        new Promise<void>((resolve) => {
          audio.src = enAudioSrc;
          audio.playbackRate = ttsSpeed;
          setTtsPlaying(key);
          audio.onended = () => {
            if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
            setHighlightedWord(null);
            resolve();
          };
          // 영어 재생 시 단어 하이라이트
          const words = verse.text.trim().split(/\s+/);
          let wordIndex = 0;
          if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
          const startLoop = () => {
            const duration = audio.duration || words.length * 0.45;
            const interval = (duration * 1000) / words.length;
            highlightTimerRef.current = setInterval(() => {
              if (wordIndex >= words.length) {
                clearInterval(highlightTimerRef.current!);
                setHighlightedWord(null);
                return;
              }
              setHighlightedWord({ key, index: wordIndex });
              wordIndex++;
            }, interval);
          };
          if (audio.duration && !isNaN(audio.duration)) {
            startLoop();
          } else {
            audio.addEventListener('loadedmetadata', startLoop, { once: true });
          }
          audio.play().catch(() => resolve());
        }),
        transFn({ verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`, text: verse.text }) as Promise<{ data: { translation: string } }>,
      ]);

      // (중간 정지 체크 제거 — React state 비동기 문제로 항상 null로 읽힘)

      // ③ 한국어 TTS + 한↔영 매핑 병렬
      const mappingFn = httpsCallable(fns, 'getVerseWordMapping');
      const koCacheKey = `bible_${currentBook.prefix}_${currentChapter}_ko_${verse.verse}_${koVoice}`.slice(0, 80);
      const [koRes, mappingRes] = await Promise.all([
        ttsFn({ text: transResult.data.translation, cacheKey: koCacheKey, voice: koVoice }) as Promise<{ data: { audioUrl?: string; audioBase64?: string } }>,
        mappingFn({
          verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
          enText: verse.text,
          koText: transResult.data.translation,
        }) as Promise<{ data: { mapping: Array<{ ko: string; enWords: string[] }> } }>,
      ]);

      let koAudioSrc = '';
      if (koRes.data.audioUrl) {
        koAudioSrc = koRes.data.audioUrl;
      } else if (koRes.data.audioBase64) {
        const binary = atob(koRes.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        koAudioSrc = URL.createObjectURL(blob);
      }
      const mapping = mappingRes.data.mapping || [];

      if (koAudioSrc) {
        // 같은 Audio 인스턴스 재사용 — iOS unlock 유지로 차단 회피
        audio.src = koAudioSrc;
        audio.playbackRate = ttsSpeed;
        setTtsPlaying(`verse_ko_${verse.verse}`);
        audio.onended = () => {
          if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
          setHighlightedEnWords([]);
          setTtsPlaying(null);
          setIsSequentialPlaying(null);
          saveProgress(verse.verse, 'seq');
        };
        // 한국어 발음 중 영어 단어 하이라이트
        if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
        let segIdx = 0;
        const startKoHighlight = () => {
          if (!mapping.length) return;
          const duration = audio.duration || mapping.length * 0.6;
          const interval = (duration * 1000) / mapping.length;
          highlightTimerRef.current = setInterval(() => {
            if (segIdx >= mapping.length) {
              clearInterval(highlightTimerRef.current!);
              setHighlightedEnWords([]);
              return;
            }
            setHighlightedEnWords(mapping[segIdx].enWords);
            segIdx++;
          }, interval);
        };
        if (audio.duration && !isNaN(audio.duration)) {
          startKoHighlight();
        } else {
          audio.addEventListener('loadedmetadata', startKoHighlight, { once: true });
        }
        await audio.play();
      } else {
        setIsSequentialPlaying(null);
        setTtsPlaying(null);
      }
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setIsSequentialPlaying(null);
      setTtsPlaying(null);
      setHighlightedEnWords([]);
    }
  };

  // 진도 저장 헬퍼 — 권 전체 듣기처럼 currentChapter와 다른 장을 재생할 때는 chapterOverride로 명시 전달
  const saveProgress = useCallback(async (
    verseNum: number,
    mode: 'en' | 'ko' | 'seq' | 'quiz',
    chapterOverride?: number,
  ) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const chapter = chapterOverride ?? currentChapter;
      const docKey = `${currentBook.prefix}_${chapter}`;
      const isQuiz = mode === 'quiz';
      // ref에서 최신 progressMap 읽기 (장/권 for-loop의 연속 호출에서도 누적 정확)
      const prev = progressMapRef.current[docKey] || { heardVerses: [], quizVerses: [], lastVerse: 0, lastMode: '' };
      const heardVerses = isQuiz
        ? (prev.heardVerses || [])
        : Array.from(new Set([...(prev.heardVerses || []), verseNum])).sort((a, b) => a - b);
      const quizVerses = isQuiz
        ? Array.from(new Set([...(prev.quizVerses || []), verseNum])).sort((a, b) => a - b)
        : (prev.quizVerses || []);
      const nextLastMode = isQuiz ? (prev.lastMode || '') : mode;
      const newEntry = { heardVerses, quizVerses, lastVerse: verseNum, lastMode: nextLastMode };
      // 동기적으로 ref 갱신 — await 이전에 다음 호출이 즉시 누적된 값을 보도록
      progressMapRef.current = { ...progressMapRef.current, [docKey]: newEntry };
      const ref = doc(db, 'users', user.uid, 'bibleProgress', docKey);
      await setDoc(ref, {
        heardVerses,
        quizVerses,
        lastVerse: verseNum,
        lastMode: nextLastMode,
        lastBook: currentBook.ko,
        lastBookPrefix: currentBook.prefix,
        lastChapter: chapter,
        lastHeardAt: serverTimestamp(),
      }, { merge: true });
      setProgressMap((p) => ({ ...p, [docKey]: newEntry }));
      // 이어듣기 카드 실시간 표시 — recentHistory 즉시 갱신
      setRecentHistory((prev) => {
        const histEntry = {
          bookKo: currentBook.ko,
          bookPrefix: currentBook.prefix,
          chapter,
          lastVerse: verseNum,
          lastMode: nextLastMode,
          lastHeardAt: new Date(),
        };
        const filtered = prev.filter(
          (h) => !(h.bookPrefix === currentBook.prefix && h.chapter === chapter)
        );
        return [histEntry, ...filtered].slice(0, 3);
      });
    } catch (e) {
      console.warn('saveProgress 실패:', e);
    }
  }, [currentBook.prefix, currentBook.ko, currentChapter]);

  // 퀴즈 팝업
  const [quizPopup, setQuizPopup] = useState<{
    verse: number;
    verseText: string;
    blankedText: string;
    blanks: Array<{ index: number; answer: string; hint: string }>;
    options: string[];
    selectedAnswers: string[];
    submitted: boolean;
    loading: boolean;
    level: 'basic' | 'intermediate' | 'advanced';
    koreanText?: string;
  } | null>(null);
  const [quizLevel, setQuizLevel] = useState<'basic' | 'intermediate' | 'advanced'>('basic');
  type TTSVoice = 'nova' | 'shimmer' | 'alloy' | 'onyx' | 'echo' | 'fable';
  const [enVoice, setEnVoice] = useState<TTSVoice>('onyx');
  const [koVoice, setKoVoice] = useState<TTSVoice>('nova');
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const [showEnVoice, setShowEnVoice] = useState<boolean>(false);
  const [showKoVoice, setShowKoVoice] = useState<boolean>(false);
  const [showQuizHint, setShowQuizHint] = useState(false);
  const [vocabMemo, setVocabMemo] = useState<string>('');
  const [vocabExample, setVocabExample] = useState<string>('');
  const [vocabSaved, setVocabSaved] = useState<boolean>(false);

  const handleVoicePreview = async (voice: TTSVoice, lang: 'en' | 'ko') => {
    const key = `preview_${lang}_${voice}`;
    if (previewPlaying === key) {
      audioRef.current?.pause();
      setPreviewPlaying(null);
      return;
    }
    setPreviewPlaying(key);
    try {
      const sampleText = lang === 'en'
        ? 'In the beginning God created the heavens and the earth.'
        : '태초에 하나님이 천지를 창조하시니라.';
      const cacheKey = `bible_preview_${lang}_${voice}`;
      const fns = getFunctions(undefined, 'asia-northeast3');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const res: any = await ttsFn({ text: sampleText, cacheKey, voice });
      let audioSrc = '';
      if (res.data.audioUrl) {
        audioSrc = res.data.audioUrl;
      } else if (res.data.audioBase64) {
        const binary = atob(res.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        audioSrc = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      }
      if (audioSrc && audioRef.current) {
        audioRef.current.src = audioSrc;
        await audioRef.current.play();
        audioRef.current.onended = () => setPreviewPlaying(null);
      }
    } catch (e) {
      console.error('미리듣기 오류:', e);
      setPreviewPlaying(null);
    }
  };

  const handleSaveVocab = async () => {
    if (!wordPopup) return;
    const entry = {
      word: wordPopup.word,
      meaning: wordPopup.meaning,
      example: vocabExample.trim(),
      memo: vocabMemo.trim(),
      savedAt: new Date().toISOString(),
    };
    const user = auth.currentUser;
    if (user) {
      await setDoc(
        doc(db, 'users', user.uid, 'vocabulary', wordPopup.word),
        { ...entry, savedAt: serverTimestamp() }
      );
    } else {
      const existing = JSON.parse(localStorage.getItem('haru_vocab') || '{}');
      existing[wordPopup.word] = entry;
      localStorage.setItem('haru_vocab', JSON.stringify(existing));
    }
    setVocabSaved(true);
  };

  const handleQuizClick = useCallback(async (verse: Verse, level: 'basic' | 'intermediate' | 'advanced' = quizLevel) => {
    setQuizPopup({
      verse: verse.verse,
      verseText: verse.text,
      blankedText: '',
      blanks: [],
      options: [],
      selectedAnswers: [],
      submitted: false,
      loading: true,
      level,
    });
    try {
      const { getFunctions: gf, httpsCallable: hc } = await import('firebase/functions');
      const fns = gf(undefined, 'asia-northeast3');
      const fn = hc(fns, 'getVerseQuiz');
      const res: any = await fn({
        verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
        verseText: verse.text,
        level,
      });
      setQuizPopup({
        verse: verse.verse,
        verseText: verse.text,
        blankedText: res.data.blankedText || '',
        blanks: res.data.blanks || [],
        options: res.data.options || [],
        selectedAnswers: new Array(res.data.blanks?.length || 0).fill(''),
        submitted: false,
        loading: false,
        level,
        koreanText: res.data.koreanText || '',
      });
    } catch {
      setQuizPopup(null);
    }
  }, [quizLevel]);

  const handleErrorClick = useCallback(async (verse: Verse) => {
    setErrorPopup({ verseText: verse.text, loading: true });
    try {
      const db = (await import('firebase/firestore')).getFirestore();
      const { doc, getDoc } = await import('firebase/firestore');
      const verseKey = `${currentBook.prefix}_${currentChapter}_${verse.verse}`;
      const cacheRef = doc(db, 'grammarCache', verseKey);
      const snap = await getDoc(cacheRef);
      if (snap.exists()) {
        const data = snap.data();
        setErrorPopup({
          verseText: verse.text,
          loading: false,
          changes: data.gptChanges ?? [],
        });
      } else {
        setErrorPopup({
          verseText: verse.text,
          loading: false,
          changes: [],
        });
      }
    } catch (e) {
      setErrorPopup({ verseText: verse.text, loading: false, changes: [] });
    }
  }, []);

  // 단어 팝업
  const [wordPopup, setWordPopup] = useState<{
    word: string;
    meaning: string;
    partOfSpeech: string;
    phonetic: string;
    koreanPronunciation: string;
    loading: boolean;
    example?: string;
    exampleKo?: string;
    phrasalVerb?: string;
    phrasalVerbMeaning?: string;
    phrasalVerbExample?: string;
    phrasalVerbExampleKo?: string;
  } | null>(null);

  const handleWordClick = useCallback(async (word: string, verseText?: string) => {
    // 특수문자 제거
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (!cleanWord) return;

    setWordPopup({ word: cleanWord, meaning: '', partOfSpeech: '', phonetic: '', koreanPronunciation: '', loading: true });
    if (verseText) setVocabExample(verseText);

    try {
      const { getFunctions: gf, httpsCallable: hc } = await import('firebase/functions');
      const fns = gf(undefined, 'asia-northeast3');
      const fn = hc(fns, 'getWordMeaning');
      const res: any = await fn({ word: cleanWord });
      setWordPopup({
        word: cleanWord,
        meaning: res.data.meaning || '뜻을 찾을 수 없습니다.',
        partOfSpeech: res.data.partOfSpeech || '',
        phonetic: res.data.phonetic || '',
        koreanPronunciation: res.data.koreanPronunciation || '',
        loading: false,
        example: res.data.example || '',
        exampleKo: res.data.exampleKo || '',
        phrasalVerb: res.data.phrasalVerb || '',
        phrasalVerbMeaning: res.data.phrasalVerbMeaning || '',
        phrasalVerbExample: res.data.phrasalVerbExample || '',
        phrasalVerbExampleKo: res.data.phrasalVerbExampleKo || '',
      });
    } catch {
      setWordPopup({ word: cleanWord, meaning: '오류가 발생했습니다.', partOfSpeech: '', phonetic: '', koreanPronunciation: '', loading: false });
    }
  }, []);

  const renderVerseWithWords = (text: string, verseKey?: string) => {
    const words = text.trim().split(/\s+/);
    return (
      <p style={{ fontSize: 13, color: '#333', lineHeight: 1.8, margin: 0, flexWrap: 'wrap', display: 'flex', gap: '4px' }}>
        {words.map((word, idx) => {
          const isHighlighted = verseKey && highlightedWord?.key === verseKey && highlightedWord?.index === idx;
          const cleanWord = word.replace(/[^a-zA-Z]/g, '');
          const isEnHighlighted = highlightedEnWords.length > 0 && highlightedEnWords.some(w => w.toLowerCase() === cleanWord.toLowerCase());
          return (
            <span
              key={idx}
              onClick={(e) => { e.stopPropagation(); handleWordClick(word, text); }}
              style={{
                cursor: 'pointer',
                borderRadius: 4,
                padding: '0 2px',
                transition: 'all 0.1s ease',
                backgroundColor: isEnHighlighted ? '#10b981' : isHighlighted ? '#D1FAE5' : 'transparent',
                color: isEnHighlighted ? '#fff' : isHighlighted ? '#065F46' : '#333',
                fontWeight: isHighlighted || isEnHighlighted ? 700 : 400,
              }}
              onMouseEnter={e => {
                if (!isHighlighted) {
                  e.currentTarget.style.backgroundColor = '#1A3C6E';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                if (!isHighlighted) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#333';
                }
              }}
              onTouchStart={e => {
                if (!isHighlighted) {
                  e.currentTarget.style.backgroundColor = '#1A3C6E';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onTouchEnd={e => {
                if (!isHighlighted) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#333';
                }
              }}
            >
              {word}
            </span>
          );
        })}
      </p>
    );
  };

  const handleTTS = async (text: string, key: string) => {
    // 현재 재생 중 → 일시정지
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    // 일시정지 중 → 이어서 재생
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    // 새로운 재생 시작 시 → 기존 일시정지 초기화
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();

    setTtsLoading(key);

    try {
      // ① 버튼 클릭 직후 즉시 무음 재생 — 안드로이드 제스처 잠금해제
      const silentAudio = new Audio(
        'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA'
      );
      silentAudio.volume = 0.01;
      try { await silentAudio.play(); } catch(_) {}

      // ② Firebase Function 호출
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'generateTTS');
      const voiceParam = key.startsWith('verse_ko') ? koVoice : enVoice;
      const cacheKey = `bible_${currentBook.prefix}_${currentChapter}_${key}_${voiceParam}`.slice(0, 80);
      const res: any = await fn({ text, cacheKey, voice: voiceParam });

      if (audioRef.current) audioRef.current.pause();

      let audioSrc = '';
      if (res.data.audioUrl) {
        audioSrc = res.data.audioUrl;
      } else if (res.data.audioBase64) {
        const binary = atob(res.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        audioSrc = URL.createObjectURL(blob);
      }

      if (audioSrc) {
        // ③ AudioContext 잠금해제 재시도
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            if (!audioCtxRef.current) {
              audioCtxRef.current = new AudioCtx();
            }
            if (audioCtxRef.current.state === 'suspended') {
              await audioCtxRef.current.resume();
            }
          }
        } catch(_) {}

        audioRef.current = new Audio(audioSrc);
        audioRef.current.playbackRate = ttsSpeed;
        audioRef.current.onended = () => {
          setTtsPlaying(null);
          setHighlightedWord(null);
          if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
          // 영어 절 재생 완료 시 진도 저장
          if (key.startsWith('verse_') && !key.startsWith('verse_ko_')) {
            const num = parseInt(key.replace('verse_', ''), 10);
            if (!isNaN(num)) saveProgress(num, 'en');
          }
        };

        // ④ play 실패 시 재시도 1회
        try {
          await audioRef.current.play();
          setTtsPlaying(key);

          // 단어 하이라이트 (절별만, 전체 듣기 제외)
          if (key.startsWith('verse_') && !key.startsWith('verse_ko_')) {
            const words = text.trim().split(/\s+/);
            let wordIndex = 0;
            if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
            const audio = audioRef.current!;
            const startLoop = () => {
              const duration = audio.duration || words.length * 0.45;
              const interval = (duration * 1000) / words.length;
              highlightTimerRef.current = setInterval(() => {
                if (wordIndex >= words.length) {
                  clearInterval(highlightTimerRef.current!);
                  setHighlightedWord(null);
                  return;
                }
                setHighlightedWord({ key, index: wordIndex });
                wordIndex++;
              }, interval);
            };
            if (audio.duration) {
              startLoop();
            } else {
              audio.addEventListener('loadedmetadata', startLoop, { once: true });
            }
          }
        } catch (playErr) {
          console.warn('TTS play 재시도:', playErr);
          setTimeout(async () => {
            try {
              await audioRef.current?.play();
              setTtsPlaying(key);
            } catch(e) {
              console.error('TTS play 최종 실패:', e);
              setTtsPlaying(null);
            }
          }, 300);
        }
      }
    } catch (err: any) {
      showTTSLimitAlert(err);
      console.error('TTS 오류:', err);
      setTtsPlaying(null);
    } finally {
      setTtsLoading(null);
    }
  };

  const handleFullChapterTTS = async (startVerse?: number) => {
    const key = 'full_chapter';
    // 현재 재생 중 → 일시정지
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    // 일시정지 중 → 이어서 재생
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    // 새로운 재생 시작 시 → 기존 일시정지 초기화
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setTtsLoading('full_chapter');
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      setTtsLoading(null);
      setIsFullPlaying(true);
      setTtsPlaying('full_chapter');
      for (const verse of (genesisData?.verses ?? [])) {
        if (startVerse && verse.verse < startVerse) continue;
        // 현재 절 자동 펼치기
        setSelectedVerse(verse.verse);
        const enCacheKey = `bible_${currentBook.prefix}_${currentChapter}_${verse.verse}_${enVoice}`.slice(0, 80);
        const enRes: any = await ttsFn({ text: verse.text, cacheKey: enCacheKey, voice: enVoice });
        let enSrc = '';
        if (enRes.data.audioUrl) {
          enSrc = enRes.data.audioUrl;
        } else if (enRes.data.audioBase64) {
          const binary = atob(enRes.data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          enSrc = URL.createObjectURL(blob);
        }
        if (enSrc) {
          await new Promise<void>((resolve) => {
            audioRef.current = new Audio(enSrc);
            audioRef.current.playbackRate = ttsSpeed;
            audioRef.current.onended = () => {
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
              setHighlightedWord(null);
              saveProgress(verse.verse, 'en');
              resolve();
            };
            // 단어 하이라이트
            const words = verse.text.trim().split(/\s+/);
            let wordIndex = 0;
            if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
            const audio = audioRef.current!;
            const key = `verse_${verse.verse}`;
            const startLoop = () => {
              const duration = audio.duration || words.length * 0.45;
              const interval = (duration * 1000) / words.length;
              highlightTimerRef.current = setInterval(() => {
                if (wordIndex >= words.length) {
                  clearInterval(highlightTimerRef.current!);
                  setHighlightedWord(null);
                  return;
                }
                setHighlightedWord({ key, index: wordIndex });
                wordIndex++;
              }, interval);
            };
            if (audio.duration) {
              startLoop();
            } else {
              audio.addEventListener('loadedmetadata', startLoop, { once: true });
            }
            audioRef.current.play();
          });
        }
      }
      setTtsPlaying(null);
      setSelectedVerse(null);
      setIsFullPlaying(false);
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setTtsPlaying(null);
      setIsFullPlaying(false);
    }
  };

  const handleFullChapterKoreanTTS = async (startVerse?: number) => {
    if (ttsPlaying === 'full_chapter_ko') {
      audioRef.current?.pause();
      setTtsPlaying(null);
      setIsFullPlaying(false);
      return;
    }
    setTtsLoading('full_chapter_ko');
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const ttsFn = httpsCallable(fns, 'generateTTS');

      // 전체 절 번역 순서대로 가져오기 (startVerse 미만 절 제외)
      const translations: string[] = [];
      for (const verse of (genesisData?.verses ?? [])) {
        if (startVerse && verse.verse < startVerse) continue;
        const res = await transFn({
          verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
          text: verse.text,
        }) as { data: { translation: string } };
        translations.push(res.data.translation);
      }
      const fullKoText = translations.join(' ');
      const cacheKey = startVerse
        ? `bible_${currentBook.prefix}_${currentChapter}_full_ko_${koVoice}_from${startVerse}`
        : `bible_${currentBook.prefix}_${currentChapter}_full_ko_${koVoice}`;
      const ttsRes: any = await ttsFn({ text: fullKoText, cacheKey, voice: koVoice });
      setTtsLoading(null);
      setIsFullPlaying(true);
      setTtsPlaying('full_chapter_ko');

      let audioSrc = '';
      if (ttsRes.data.audioUrl) {
        audioSrc = ttsRes.data.audioUrl;
      } else if (ttsRes.data.audioBase64) {
        const binary = atob(ttsRes.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        audioSrc = URL.createObjectURL(blob);
      }
      if (audioSrc) {
        audioRef.current = new Audio(audioSrc);
        audioRef.current.playbackRate = ttsSpeed;
        audioRef.current.onended = async () => {
          setTtsPlaying(null);
          setIsFullPlaying(false);
          // 재생 완료 — 재생된 절들만 진도 순차 저장(누적 보장)
          for (const v of (genesisData?.verses ?? [])) {
            if (startVerse && v.verse < startVerse) continue;
            await saveProgress(v.verse, 'ko');
          }
        };
        await audioRef.current.play();
      }
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setIsFullPlaying(false);
      setTtsPlaying(null);
    }
  };

  const handleFullChapterSequentialTTS = async (startVerse?: number) => {
    const key = 'full_chapter_seq';
    // 현재 재생 중 → 일시정지
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    // 일시정지 중 → 이어서 재생
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    // 새로운 재생 시작 시 → 기존 일시정지 초기화
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setTtsLoading('full_chapter_seq');

    // iOS Safari 자동재생 정책 회피:
    // 33절 × 영/한 = 66회 new Audio()를 만들면 iOS는 두 번째 인스턴스부터 사용자 제스처와 무관한 것으로 보고 차단함.
    // 사용자 제스처(클릭) 컨텍스트 안에서 단일 Audio 인스턴스를 확보한 뒤, 모든 절의 영→한 재생을 src 교체로 처리.
    if (!audioRef.current) {
      audioRef.current = new Audio();
    } else {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    const audio = audioRef.current;

    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const mappingFn = httpsCallable(fns, 'getVerseWordMapping');
      setTtsLoading(null);
      setIsFullPlaying(true);
      setTtsPlaying('full_chapter_seq');

      for (const verse of (genesisData?.verses ?? [])) {
        if (startVerse && verse.verse < startVerse) continue;
        // 영어 TTS + 번역 병렬
        const enCacheKey = `bible_${currentBook.prefix}_${currentChapter}_${verse.verse}_${enVoice}`.slice(0, 80);
        const [enRes, transRes] = await Promise.all([
          ttsFn({ text: verse.text, cacheKey: enCacheKey, voice: enVoice }) as Promise<{ data: { audioUrl?: string; audioBase64?: string } }>,
          transFn({
            verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
            text: verse.text,
          }) as Promise<{ data: { translation: string } }>,
        ]);
        let enSrc = '';
        if (enRes.data.audioUrl) {
          enSrc = enRes.data.audioUrl;
        } else if (enRes.data.audioBase64) {
          const binary = atob(enRes.data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          enSrc = URL.createObjectURL(blob);
        }

        // 현재 절 자동 펼치기
        setSelectedVerse(verse.verse);
        // 영어 재생 + 하이라이트
        if (enSrc) {
          await new Promise<void>((resolve) => {
            audio.src = enSrc;
            audio.playbackRate = ttsSpeed;
            audio.onended = () => {
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
              setHighlightedWord(null);
              resolve();
            };
            const words = verse.text.trim().split(/\s+/);
            let wordIndex = 0;
            if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
            const key = `verse_${verse.verse}`;
            const startLoop = () => {
              const duration = audio.duration || words.length * 0.45;
              const interval = (duration * 1000) / words.length;
              highlightTimerRef.current = setInterval(() => {
                if (wordIndex >= words.length) {
                  clearInterval(highlightTimerRef.current!);
                  setHighlightedWord(null);
                  return;
                }
                setHighlightedWord({ key, index: wordIndex });
                wordIndex++;
              }, interval);
            };
            if (audio.duration && !isNaN(audio.duration)) {
              startLoop();
            } else {
              audio.addEventListener('loadedmetadata', startLoop, { once: true });
            }
            audio.play().catch(() => resolve());
          });
        }

        // 한국어 TTS + 한↔영 매핑 병렬
        const koCacheKey = `bible_${currentBook.prefix}_${currentChapter}_ko_${verse.verse}_${koVoice}`.slice(0, 80);
        const [koRes, mappingRes] = await Promise.all([
          ttsFn({ text: transRes.data.translation, cacheKey: koCacheKey, voice: koVoice }) as Promise<{ data: { audioUrl?: string; audioBase64?: string } }>,
          mappingFn({
            verseKey: `${currentBook.prefix}_${currentChapter}_${verse.verse}`,
            enText: verse.text,
            koText: transRes.data.translation,
          }) as Promise<{ data: { mapping: Array<{ ko: string; enWords: string[] }> } }>,
        ]);
        let koSrc = '';
        if (koRes.data.audioUrl) {
          koSrc = koRes.data.audioUrl;
        } else if (koRes.data.audioBase64) {
          const binary = atob(koRes.data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          koSrc = URL.createObjectURL(blob);
        }
        const mapping = mappingRes.data.mapping || [];

        // 한국어 재생 — 같은 Audio 인스턴스 재사용으로 iOS unlock 유지 + 영어 단어 하이라이트
        if (koSrc) {
          await new Promise<void>((resolve) => {
            audio.src = koSrc;
            audio.playbackRate = ttsSpeed;
            audio.onended = () => {
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
              setHighlightedEnWords([]);
              saveProgress(verse.verse, 'seq');
              resolve();
            };
            if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
            let segIdx = 0;
            const startKoHighlight = () => {
              if (!mapping.length) return;
              const duration = audio.duration || mapping.length * 0.6;
              const interval = (duration * 1000) / mapping.length;
              highlightTimerRef.current = setInterval(() => {
                if (segIdx >= mapping.length) {
                  clearInterval(highlightTimerRef.current!);
                  setHighlightedEnWords([]);
                  return;
                }
                setHighlightedEnWords(mapping[segIdx].enWords);
                segIdx++;
              }, interval);
            };
            if (audio.duration && !isNaN(audio.duration)) {
              startKoHighlight();
            } else {
              audio.addEventListener('loadedmetadata', startKoHighlight, { once: true });
            }
            audio.play().catch(() => resolve());
          });
        }
      }
      setTtsPlaying(null);
      setIsFullPlaying(false);
      setHighlightedEnWords([]);
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setTtsPlaying(null);
      setIsFullPlaying(false);
      setHighlightedEnWords([]);
    }
  };

  // 권 전체 — 영어
  const handleFullBookTTS = async () => {
    const key = 'full_book_en';
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    if (!window.confirm('권 전체를 듣습니다. 처음 듣는 경우 시간이 걸릴 수 있습니다. 계속하시겠습니까?')) {
      return;
    }
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setTtsLoading(key);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    } else {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    const audio = audioRef.current;

    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      setTtsLoading(null);
      setIsBookPlaying(true);
      setTtsPlaying(key);

      const totalChapters = currentBook.chapters;
      for (let chapterNum = 1; chapterNum <= totalChapters; chapterNum++) {
        setBookPlayingChapter(chapterNum);
        let chapterData: { verses: Verse[] } | null = null;
        try {
          const mod = await import(`../../data/${currentBook.prefix}_${chapterNum}.json`);
          chapterData = mod.default;
        } catch {
          continue;
        }
        for (const verse of (chapterData?.verses ?? [])) {
          const enCacheKey = `bible_${currentBook.prefix}_${chapterNum}_${verse.verse}_${enVoice}`.slice(0, 80);
          const enRes: any = await ttsFn({ text: verse.text, cacheKey: enCacheKey, voice: enVoice });
          let enSrc = '';
          if (enRes.data.audioUrl) {
            enSrc = enRes.data.audioUrl;
          } else if (enRes.data.audioBase64) {
            const binary = atob(enRes.data.audioBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'audio/mp3' });
            enSrc = URL.createObjectURL(blob);
          }
          if (enSrc) {
            await new Promise<void>((resolve) => {
              audio.src = enSrc;
              audio.playbackRate = ttsSpeed;
              audio.onended = () => {
                saveProgress(verse.verse, 'en', chapterNum);
                resolve();
              };
              audio.play().catch(() => resolve());
            });
          }
        }
      }
      setTtsPlaying(null);
      setIsBookPlaying(false);
      setBookPlayingChapter(null);
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setTtsPlaying(null);
      setIsBookPlaying(false);
      setBookPlayingChapter(null);
    }
  };

  // 권 전체 — 영→한
  const handleFullBookSequentialTTS = async () => {
    const key = 'full_book_seq';
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    if (!window.confirm('권 전체를 듣습니다. 처음 듣는 경우 시간이 걸릴 수 있습니다. 계속하시겠습니까?')) {
      return;
    }
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setTtsLoading(key);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    } else {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    const audio = audioRef.current;

    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const mappingFn = httpsCallable(fns, 'getVerseWordMapping');
      setTtsLoading(null);
      setIsBookPlaying(true);
      setTtsPlaying(key);

      const totalChapters = currentBook.chapters;
      for (let chapterNum = 1; chapterNum <= totalChapters; chapterNum++) {
        setBookPlayingChapter(chapterNum);
        setCurrentChapter(chapterNum);
        let chapterData: { verses: Verse[] } | null = null;
        try {
          const mod = await import(`../../data/${currentBook.prefix}_${chapterNum}.json`);
          chapterData = mod.default;
        } catch {
          continue;
        }
        for (const verse of (chapterData?.verses ?? [])) {
          // 영어 TTS + 번역 병렬
          const enCacheKey = `bible_${currentBook.prefix}_${chapterNum}_${verse.verse}_${enVoice}`.slice(0, 80);
          const [enRes, transRes] = await Promise.all([
            ttsFn({ text: verse.text, cacheKey: enCacheKey, voice: enVoice }) as Promise<{ data: { audioUrl?: string; audioBase64?: string } }>,
            transFn({
              verseKey: `${currentBook.prefix}_${chapterNum}_${verse.verse}`,
              text: verse.text,
            }) as Promise<{ data: { translation: string } }>,
          ]);
          let enSrc = '';
          if (enRes.data.audioUrl) {
            enSrc = enRes.data.audioUrl;
          } else if (enRes.data.audioBase64) {
            const binary = atob(enRes.data.audioBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'audio/mp3' });
            enSrc = URL.createObjectURL(blob);
          }
          if (enSrc) {
            await new Promise<void>((resolve) => {
              audio.src = enSrc;
              audio.playbackRate = ttsSpeed;
              audio.onended = () => resolve();
              audio.play().catch(() => resolve());
            });
          }
          // 한국어 TTS + 한↔영 매핑 병렬
          const koCacheKey = `bible_${currentBook.prefix}_${chapterNum}_ko_${verse.verse}_${koVoice}`.slice(0, 80);
          const [koRes, mappingRes] = await Promise.all([
            ttsFn({ text: transRes.data.translation, cacheKey: koCacheKey, voice: koVoice }) as Promise<{ data: { audioUrl?: string; audioBase64?: string } }>,
            mappingFn({
              verseKey: `${currentBook.prefix}_${chapterNum}_${verse.verse}`,
              enText: verse.text,
              koText: transRes.data.translation,
            }) as Promise<{ data: { mapping: Array<{ ko: string; enWords: string[] }> } }>,
          ]);
          let koSrc = '';
          if (koRes.data.audioUrl) {
            koSrc = koRes.data.audioUrl;
          } else if (koRes.data.audioBase64) {
            const binary = atob(koRes.data.audioBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'audio/mp3' });
            koSrc = URL.createObjectURL(blob);
          }
          const mapping = mappingRes.data.mapping || [];
          // 한국어 재생 + 영어 단어 하이라이트
          if (koSrc) {
            await new Promise<void>((resolve) => {
              audio.src = koSrc;
              audio.playbackRate = ttsSpeed;
              audio.onended = () => {
                if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
                setHighlightedEnWords([]);
                saveProgress(verse.verse, 'seq', chapterNum);
                resolve();
              };
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
              let segIdx = 0;
              const startKoHighlight = () => {
                if (!mapping.length) return;
                const duration = audio.duration || mapping.length * 0.6;
                const interval = (duration * 1000) / mapping.length;
                highlightTimerRef.current = setInterval(() => {
                  if (segIdx >= mapping.length) {
                    clearInterval(highlightTimerRef.current!);
                    setHighlightedEnWords([]);
                    return;
                  }
                  setHighlightedEnWords(mapping[segIdx].enWords);
                  segIdx++;
                }, interval);
              };
              if (audio.duration && !isNaN(audio.duration)) {
                startKoHighlight();
              } else {
                audio.addEventListener('loadedmetadata', startKoHighlight, { once: true });
              }
              audio.play().catch(() => resolve());
            });
          }
        }
      }
      setTtsPlaying(null);
      setIsBookPlaying(false);
      setBookPlayingChapter(null);
      setHighlightedEnWords([]);
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setTtsPlaying(null);
      setIsBookPlaying(false);
      setBookPlayingChapter(null);
      setHighlightedEnWords([]);
    }
  };

  // 권 전체 — 한국어
  const handleFullBookKoreanTTS = async () => {
    const key = 'full_book_ko';
    if (ttsPlaying === key && ttsPaused !== key) {
      audioRef.current?.pause();
      setTtsPaused(key);
      setTtsPlaying(null);
      return;
    }
    if (ttsPaused === key) {
      await audioRef.current?.play();
      setTtsPaused(null);
      setTtsPlaying(key);
      return;
    }
    if (!window.confirm('권 전체를 듣습니다. 처음 듣는 경우 시간이 걸릴 수 있습니다. 계속하시겠습니까?')) {
      return;
    }
    setTtsPaused(null);
    if (audioRef.current) audioRef.current.pause();
    setTtsLoading(key);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    } else {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    const audio = audioRef.current;

    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      setTtsLoading(null);
      setIsBookPlaying(true);
      setTtsPlaying(key);

      const totalChapters = currentBook.chapters;
      for (let chapterNum = 1; chapterNum <= totalChapters; chapterNum++) {
        setBookPlayingChapter(chapterNum);
        let chapterData: { verses: Verse[] } | null = null;
        try {
          const mod = await import(`../../data/${currentBook.prefix}_${chapterNum}.json`);
          chapterData = mod.default;
        } catch {
          continue;
        }
        // 장 단위로 번역 모아서 1번 TTS 호출
        const translations: string[] = [];
        for (const verse of (chapterData?.verses ?? [])) {
          const res = await transFn({
            verseKey: `${currentBook.prefix}_${chapterNum}_${verse.verse}`,
            text: verse.text,
          }) as { data: { translation: string } };
          translations.push(res.data.translation);
        }
        if (!translations.length) continue;
        const fullKoText = translations.join(' ');
        const cacheKey = `bible_${currentBook.prefix}_${chapterNum}_full_ko_${koVoice}`;
        const ttsRes: any = await ttsFn({ text: fullKoText, cacheKey, voice: koVoice });
        let koSrc = '';
        if (ttsRes.data.audioUrl) {
          koSrc = ttsRes.data.audioUrl;
        } else if (ttsRes.data.audioBase64) {
          const binary = atob(ttsRes.data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          koSrc = URL.createObjectURL(blob);
        }
        if (koSrc) {
          await new Promise<void>((resolve) => {
            audio.src = koSrc;
            audio.playbackRate = ttsSpeed;
            audio.onended = async () => {
              // 장 합본 재생 완료 — 해당 장 모든 절 진도 순차 저장(누적 보장)
              for (const v of (chapterData?.verses ?? [])) {
                await saveProgress(v.verse, 'ko', chapterNum);
              }
              resolve();
            };
            audio.play().catch(() => resolve());
          });
        }
      }
      setTtsPlaying(null);
      setIsBookPlaying(false);
      setBookPlayingChapter(null);
    } catch (err: any) {
      showTTSLimitAlert(err);
      setTtsLoading(null);
      setTtsPlaying(null);
      setIsBookPlaying(false);
      setBookPlayingChapter(null);
    }
  };

  return (
    <>
    <div style={{ backgroundColor: '#FAF9F6', minHeight: '100vh', paddingBottom: 80 }}>
      {/* 페이지 제목 */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => navigate('/record')} style={{ color: '#1A3C6E', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', padding: 0 }}>
          ← 뒤로
        </button>
        <button
          onClick={() => navigate('/vocab')}
          style={{
            marginLeft: 'auto', background: 'none', border: '1px solid #1A3C6E',
            borderRadius: 20, padding: '4px 12px',
            fontSize: 13, color: '#1A3C6E', cursor: 'pointer',
          }}
        >
          📚 단어장
        </button>
        <div>
          {/* 1단계: 구약 / 신약 탭 */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', margin: '20px 12px 0 12px' }}>
            {(['구약', '신약'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setCurrentTestament(t);
                  const first = BOOKS.find((b) => b.testament === t);
                  if (first) {
                    setCurrentBook(first);
                    setCurrentChapter(1);
                  }
                }}
                style={{
                  padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 700,
                  color: currentTestament === t ? '#1A3C6E' : '#999',
                  borderBottom: currentTestament === t ? '2px solid #1A3C6E' : '2px solid transparent',
                  marginBottom: '-2px',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {/* 이어듣기 카드 */}
          {!resumeCardClosed && recentHistory.length > 0 && (() => {
            const top = recentHistory[0];
            const formatTime = (ts: any) => {
              if (!ts) return '';
              try {
                const d = ts.toDate ? ts.toDate() : new Date(ts);
                const diff = (Date.now() - d.getTime()) / 1000;
                if (diff < 60) return '방금 전';
                if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
                const today = new Date();
                const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                const hh = d.getHours();
                const mm = d.getMinutes().toString().padStart(2, '0');
                const ampm = hh < 12 ? '오전' : '오후';
                const h12 = hh % 12 === 0 ? 12 : hh % 12;
                if (isToday) return `오늘 ${ampm} ${h12}시 ${mm}분`;
                return `${d.getMonth() + 1}월 ${d.getDate()}일 ${ampm} ${h12}시`;
              } catch { return ''; }
            };
            const modeLabel = (m: string) => m === 'en' ? '영어' : m === 'ko' ? '한국어' : m === 'seq' ? '영→한' : '';
            // lastVerse + 1 (다음 절) 계산 — 장 끝이면 다음 장 1절로 롤오버
            const computeStart = (h: typeof top) => {
              const target = BOOKS.find((b) => b.prefix === h.bookPrefix);
              const baseLast = h.lastVerse || 0;
              let chapter = h.chapter;
              let startVerse = baseLast + 1;
              const total = target?.verseCount?.[chapter] || 0;
              if (total > 0 && startVerse > total) {
                chapter += 1;
                startVerse = 1;
                if (chapter > (target?.chapters || 0)) {
                  // 권 끝 — 마지막 절 그대로 (재생 없이 위치만)
                  chapter = h.chapter;
                  startVerse = baseLast || 1;
                  return { chapter, startVerse, atBookEnd: true };
                }
              }
              return { chapter, startVerse, atBookEnd: false };
            };
            const topStart = computeStart(top);
            const goTo = (h: typeof top) => {
              const target = BOOKS.find((b) => b.prefix === h.bookPrefix);
              if (!target) return;
              const { chapter: targetChapter, startVerse, atBookEnd } = computeStart(h);
              const mode = atBookEnd ? undefined : (h.lastMode as 'en' | 'ko' | 'seq' | 'quiz' | undefined);
              pendingNavRef.current = {
                prefix: h.bookPrefix,
                chapter: targetChapter,
                verse: startVerse,
                mode,
              };
              // 클릭 즉시 상단 이어듣기 카드로 승격 — 재생 시작 시 ⏸/⏹ 큰 버튼이 곧바로 보이도록
              setRecentHistory((prev) => {
                const filtered = prev.filter(
                  (x) => !(x.bookPrefix === h.bookPrefix && x.chapter === h.chapter)
                );
                return [{ ...h, lastHeardAt: new Date() }, ...filtered].slice(0, 3);
              });
              setCurrentTestament(target.testament as '구약' | '신약');
              const sameBook = currentBook.prefix === target.prefix;
              if (!sameBook) setCurrentBook(target);
              setCurrentChapter(targetChapter);
              setSelectedVerse(startVerse);
              if (sameBook && genesisData?.verses?.length && targetChapter === currentChapter) {
                // 같은 책·같은 장 — 데이터 useEffect 안 거치므로 즉시 처리
                pendingNavRef.current = null;
                requestAnimationFrame(() => {
                  const el = document.getElementById(`bible-verse-${startVerse}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                if (mode === 'en') handleFullChapterTTS(startVerse);
                else if (mode === 'ko') handleFullChapterKoreanTTS(startVerse);
                else if (mode === 'seq') handleFullChapterSequentialTTS(startVerse);
                else if (mode === 'quiz') {
                  const v = genesisData.verses.find((vs: Verse) => vs.verse === startVerse);
                  if (v) handleQuizClick(v);
                }
              }
            };
            const curKey = `${currentBook.prefix}_${currentChapter}`;
            const curProg = progressMap[curKey];
            const verseTotal = genesisData?.verses?.length || 0;
            const heardSet = new Set(curProg?.heardVerses || []);
            const quizSet = new Set(curProg?.quizVerses || []);
            const bookChapters = currentBook.chapters;
            let completedChapters = 0;
            for (let c = 1; c <= bookChapters; c++) {
              const k = `${currentBook.prefix}_${c}`;
              const p = progressMap[k];
              const total = currentBook.verseCount?.[c] || 0;
              if (p && p.heardVerses && total > 0 && p.heardVerses.length / total >= 0.8) {
                completedChapters++;
              }
            }
            const bookProgressPct = bookChapters > 0 ? Math.round((completedChapters / bookChapters) * 100) : 0;
            return (
              <div style={{
                margin: '12px',
                padding: '14px',
                background: '#EEF3FB',
                border: '1px solid #B5D4F4',
                borderRadius: 14,
                position: 'relative',
              }}>
                <button
                  onClick={() => setResumeCardClosed(true)}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, color: '#6B7280', lineHeight: 1,
                  }}
                  aria-label="닫기"
                >×</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                    animation: 'haru-pulse 1.4s ease-in-out infinite',
                  }} />
                  <style>{`@keyframes haru-pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.4;transform:scale(0.7);} }`}</style>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E' }}>최근 학습 — 이어듣기</span>
                </div>
                <div style={{ fontSize: 14, color: '#1A3C6E', fontWeight: 600, marginBottom: 2 }}>
                  📖 {top.bookKo} {top.chapter}장 {top.lastVerse}절
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                  마지막 모드: {modeLabel(top.lastMode) || '—'} · {formatTime(top.lastHeardAt)}
                </div>
                {(() => {
                  const chapterPlayKeys = ['full_chapter', 'full_chapter_ko', 'full_chapter_seq'];
                  const isOnTopChapter =
                    currentBook.prefix === top.bookPrefix && currentChapter === top.chapter;
                  const playingKey = isOnTopChapter && chapterPlayKeys.includes(ttsPlaying || '')
                    ? ttsPlaying
                    : null;
                  const pausedKey = isOnTopChapter && chapterPlayKeys.includes(ttsPaused || '')
                    ? ttsPaused
                    : null;
                  const activeKey = playingKey || pausedKey;
                  const handler =
                    activeKey === 'full_chapter' ? handleFullChapterTTS
                    : activeKey === 'full_chapter_ko' ? handleFullChapterKoreanTTS
                    : activeKey === 'full_chapter_seq' ? handleFullChapterSequentialTTS
                    : null;
                  if (activeKey && handler) {
                    return (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        <button
                          onClick={() => handler()}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                            background: '#1A3C6E', color: '#FAF9F6',
                            fontSize: 14, fontWeight: 700, cursor: 'pointer',
                          }}
                        >{playingKey ? '⏸ 일시정지' : '▶ 계속 듣기'}</button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                            background: '#ef4444', color: '#FAF9F6',
                            fontSize: 14, fontWeight: 700, cursor: 'pointer',
                          }}
                        >⏹ 정지</button>
                      </div>
                    );
                  }
                  return (
                    <button
                      onClick={() => goTo(top)}
                      style={{
                        width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                        background: '#1A3C6E', color: '#FAF9F6',
                        fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
                      }}
                    >▶ 이어듣기 ({topStart.chapter}장 {topStart.startVerse}절부터)</button>
                  );
                })()}

                {/* 현재 장 절별 진도 바 */}
                {verseTotal > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                      현재 장 진도 ({currentBook.ko} {currentChapter}장)
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {Array.from({ length: verseTotal }, (_, i) => i + 1).map((vn) => {
                        const isHeard = heardSet.has(vn);
                        const isQuiz = quizSet.has(vn);
                        let bg = '#e5e7eb';
                        if (isQuiz) bg = '#10b981';
                        else if (isHeard) bg = '#378ADD';
                        return (
                          <div key={vn} style={{
                            flex: '1 1 auto', minWidth: 6, maxWidth: 14, height: 8,
                            borderRadius: 2, background: bg,
                          }} />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 권 전체 진도 바 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{currentBook.ko} 전체 진도</span>
                    <span>{bookProgressPct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${bookProgressPct}%`, height: '100%', background: '#1A3C6E' }} />
                  </div>
                </div>

                {/* 최근 학습 다른 곳 2개 */}
                {recentHistory.length > 1 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>
                      📋 최근 학습한 다른 곳 (최대 3개)
                    </div>
                    {(() => {
                      const chapterPlayKeys = ['full_chapter', 'full_chapter_ko', 'full_chapter_seq'];
                      const deleteHistoryItem = async (h: typeof top) => {
                        setRecentHistory((prev) =>
                          prev.filter((x) => !(x.bookPrefix === h.bookPrefix && x.chapter === h.chapter))
                        );
                        const user = auth.currentUser;
                        if (!user) return;
                        try {
                          const docKey = `${h.bookPrefix}_${h.chapter}`;
                          const ref = doc(db, 'users', user.uid, 'bibleProgress', docKey);
                          await setDoc(ref, { lastHeardAt: null }, { merge: true });
                        } catch (e) {
                          console.warn('항목 삭제 실패:', e);
                        }
                      };
                      return recentHistory.slice(1, 3).map((h, idx) => {
                        const isOnThisChapter =
                          currentBook.prefix === h.bookPrefix && currentChapter === h.chapter;
                        const playingKey = isOnThisChapter && chapterPlayKeys.includes(ttsPlaying || '')
                          ? ttsPlaying
                          : null;
                        const pausedKey = isOnThisChapter && chapterPlayKeys.includes(ttsPaused || '')
                          ? ttsPaused
                          : null;
                        const activeKey = playingKey || pausedKey;
                        const handler =
                          activeKey === 'full_chapter' ? handleFullChapterTTS
                          : activeKey === 'full_chapter_ko' ? handleFullChapterKoreanTTS
                          : activeKey === 'full_chapter_seq' ? handleFullChapterSequentialTTS
                          : null;
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '8px 10px', marginBottom: 4,
                              background: '#fff', border: '1px solid #d1d5db',
                              borderRadius: 8,
                            }}
                          >
                            <button
                              onClick={() => goTo(h)}
                              style={{
                                flex: 1, textAlign: 'left',
                                background: 'none', border: 'none', cursor: 'pointer',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: 0,
                              }}
                            >
                              <span style={{ fontSize: 12, color: '#1A3C6E', fontWeight: 600 }}>
                                {h.bookKo} {h.chapter}장 {h.lastVerse}절
                              </span>
                              <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 8 }}>
                                {modeLabel(h.lastMode)} · {formatTime(h.lastHeardAt)}
                              </span>
                            </button>
                            {activeKey && handler && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handler(); }}
                                  style={{
                                    background: '#1A3C6E', color: '#FAF9F6',
                                    border: 'none', borderRadius: 6,
                                    padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                                  }}
                                  aria-label={playingKey ? '일시정지' : '계속 듣기'}
                                >{playingKey ? '⏸' : '▶'}</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); stopAllTTS(); }}
                                  style={{
                                    background: '#ef4444', color: '#FAF9F6',
                                    border: 'none', borderRadius: 6,
                                    padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                                  }}
                                  aria-label="정지"
                                >⏹</button>
                              </>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteHistoryItem(h); }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#9CA3AF', fontSize: 16, lineHeight: 1, padding: '0 4px',
                              }}
                              aria-label="삭제"
                            >×</button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* 전체 학습 기록 초기화 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    onClick={async () => {
                      if (!window.confirm('모든 학습 기록을 초기화할까요?\n진도 데이터(들은 절, 퀴즈)는 유지됩니다.')) return;
                      setRecentHistory([]);
                      setResumeCardClosed(true);
                      const user = auth.currentUser;
                      if (!user) return;
                      try {
                        const colRef = collection(db, 'users', user.uid, 'bibleProgress');
                        const snap = await getDocs(colRef);
                        await Promise.all(
                          snap.docs.map((d) => setDoc(d.ref, { lastHeardAt: null }, { merge: true }))
                        );
                      } catch (e) {
                        console.warn('전체 기록 초기화 실패:', e);
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ef4444', fontSize: 11, padding: '4px 6px',
                    }}
                  >🗑️ 학습 기록 초기화</button>
                </div>
              </div>
            );
          })()}
          {/* 보이스 선택 UI — TTS 비용 안정화로 비활성화 (영어 onyx, 한국어 nova 고정) */}
          {false && (
          <div style={{ padding: '8px 16px 0' }}>
            {(() => {
              const voices: { v: TTSVoice; label: string; desc: string }[] = [
                { v: 'nova',    label: '여성1', desc: '밝고 친근함' },
                { v: 'shimmer', label: '여성2', desc: '부드럽고 따뜻함' },
                { v: 'alloy',   label: '여성3', desc: '명료하고 깔끔함' },
                { v: 'onyx',    label: '남성1', desc: '중후한 저음' },
                { v: 'echo',    label: '남성2', desc: '또렷한 고음' },
                { v: 'fable',   label: '남성3', desc: '따뜻한 내레이션' },
              ];
              const voiceLabel: Record<TTSVoice, string> = {
                nova: '여성1', shimmer: '여성2', alloy: '여성3',
                onyx: '남성1', echo: '남성2', fable: '남성3',
              };
              return (
                <>
                  {/* 영어 음성 */}
                  <div style={{ marginBottom: 10 }}>
                    <button
                      onClick={() => setShowEnVoice(v => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', background: '#f3f4f6', border: '1px solid #e5e7eb',
                        borderRadius: 10, padding: '8px 12px', cursor: 'pointer', marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 13, color: '#444' }}>
                        🇺🇸 영어 음성
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#1A3C6E', fontWeight: 500 }}>
                          ({voiceLabel[enVoice]} 선택됨)
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: '#888' }}>{showEnVoice ? '▲ 접기' : '▼ 펼치기'}</span>
                    </button>
                    {showEnVoice && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                        {voices.map(({ v, label, desc }) => (
                          <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button
                              onClick={() => setEnVoice(v)}
                              style={{
                                borderRadius: 10, border: '1px solid',
                                borderColor: enVoice === v ? '#1A3C6E' : '#d1d5db',
                                backgroundColor: enVoice === v ? '#1A3C6E' : '#fff',
                                color: enVoice === v ? '#fff' : '#444',
                                padding: '7px 4px', cursor: 'pointer', textAlign: 'center',
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2, lineHeight: 1.3 }}>{desc}</div>
                            </button>
                            <button
                              onClick={() => handleVoicePreview(v, 'en')}
                              style={{
                                borderRadius: 8, border: '1px solid #d1d5db',
                                backgroundColor: previewPlaying === `preview_en_${v}` ? '#8B4789' : '#f9fafb',
                                color: previewPlaying === `preview_en_${v}` ? '#fff' : '#666',
                                fontSize: 10, padding: '4px 2px', cursor: 'pointer',
                              }}
                            >
                              {previewPlaying === `preview_en_${v}` ? '⏸ 정지' : '▶ 미리듣기'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 한국어 음성 */}
                  <div>
                    <button
                      onClick={() => setShowKoVoice(v => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', background: '#f3f4f6', border: '1px solid #e5e7eb',
                        borderRadius: 10, padding: '8px 12px', cursor: 'pointer', marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 13, color: '#444' }}>
                        🇰🇷 한국어 음성
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#10b981', fontWeight: 500 }}>
                          ({voiceLabel[koVoice]} 선택됨)
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: '#888' }}>{showKoVoice ? '▲ 접기' : '▼ 펼치기'}</span>
                    </button>
                    {showKoVoice && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                        {voices.map(({ v, label, desc }) => (
                          <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button
                              onClick={() => setKoVoice(v)}
                              style={{
                                borderRadius: 10, border: '1px solid',
                                borderColor: koVoice === v ? '#10b981' : '#d1d5db',
                                backgroundColor: koVoice === v ? '#10b981' : '#fff',
                                color: koVoice === v ? '#fff' : '#444',
                                padding: '7px 4px', cursor: 'pointer', textAlign: 'center',
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2, lineHeight: 1.3 }}>{desc}</div>
                            </button>
                            <button
                              onClick={() => handleVoicePreview(v, 'ko')}
                              style={{
                                borderRadius: 8, border: '1px solid #d1d5db',
                                backgroundColor: previewPlaying === `preview_ko_${v}` ? '#8B4789' : '#f9fafb',
                                color: previewPlaying === `preview_ko_${v}` ? '#fff' : '#666',
                                fontSize: 10, padding: '4px 2px', cursor: 'pointer',
                              }}
                            >
                              {previewPlaying === `preview_ko_${v}` ? '⏸ 정지' : '▶ 미리듣기'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          )}
          {/* 2단계: 책 선택 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 12px 4px' }}>
            {BOOKS.filter((b) => b.testament === currentTestament).map((b) => (
              <button
                key={b.prefix}
                onClick={() => setCurrentBook(b)}
                style={{
                  padding: '4px 12px', borderRadius: '6px', border: 'none',
                  background: currentBook.prefix === b.prefix ? '#1A3C6E' : '#e5e7eb',
                  color: currentBook.prefix === b.prefix ? '#FAF9F6' : '#374151',
                  fontWeight: currentBook.prefix === b.prefix ? 700 : 400,
                  cursor: 'pointer', fontSize: '13px',
                }}
              >
                {b.ko}
              </button>
            ))}
          </div>
          <p style={{ color: '#1A3C6E', fontSize: 16, fontWeight: 700, margin: '4px 0 0 12px' }}>📖 {currentBook.ko} {currentChapter}장</p>
          <p style={{ color: '#999', fontSize: 11, margin: '0 0 0 12px' }}>{currentBook.en} Chapter {currentChapter} · KJV</p>
          <p style={{ color: '#6B7280', fontSize: 11, margin: '6px 0 0', textAlign: 'center' }}>
            🤖 AI 학습용 번역 · 공식 성경 번역본과 다를 수 있습니다
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px' }}>
            {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map((ch) => {
              const p = progressMap[`${currentBook.prefix}_${ch}`];
              let dotColor: string | null = null;
              if (p && p.heardVerses && p.heardVerses.length > 0) {
                const total = currentBook.verseCount?.[ch] || 0;
                const ratio = total > 0 ? p.heardVerses.length / total : 0;
                dotColor = ratio >= 0.8 ? '#10b981' : '#f59e0b';
              }
              return (
                <button
                  key={ch}
                  onClick={() => setCurrentChapter(ch)}
                  onMouseEnter={(e) => {
                    if (currentChapter !== ch) {
                      e.currentTarget.style.background = '#1A3C6E';
                      e.currentTarget.style.color = '#FAF9F6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentChapter !== ch) {
                      e.currentTarget.style.background = '#e5e7eb';
                      e.currentTarget.style.color = '#374151';
                    }
                  }}
                  onTouchStart={(e) => {
                    if (currentChapter !== ch) {
                      e.currentTarget.style.background = '#1A3C6E';
                      e.currentTarget.style.color = '#FAF9F6';
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (currentChapter !== ch) {
                      e.currentTarget.style.background = '#e5e7eb';
                      e.currentTarget.style.color = '#374151';
                    }
                  }}
                  style={{
                    position: 'relative',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: currentChapter === ch ? '#1A3C6E' : '#e5e7eb',
                    color: currentChapter === ch ? '#FAF9F6' : '#374151',
                    fontWeight: currentChapter === ch ? 700 : 400,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {ch}장
                  {dotColor && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 6, height: 6, borderRadius: '50%',
                      background: dotColor,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 듣기 속도 선택 */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px 0', justifyContent: 'flex-end' }}>
        {[0.75, 1.0, 1.25, 1.5].map(s => (
          <button
            key={s}
            onClick={() => setTtsSpeed(s)}
            style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11,
              fontWeight: ttsSpeed === s ? 700 : 400,
              backgroundColor: ttsSpeed === s ? '#1A3C6E' : '#f3f4f6',
              color: ttsSpeed === s ? '#fff' : '#555',
              border: 'none', cursor: 'pointer',
            }}
          >{s}x</button>
        ))}
      </div>
      {/* 3단계 재생 UI */}
      <div style={{ padding: '16px', backgroundColor: '#EDE9F5', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(() => {
          const handlerMap = {
            'chapter-en':  { key: 'full_chapter',     handler: handleFullChapterTTS,           color: '#1A3C6E' },
            'chapter-seq': { key: 'full_chapter_seq', handler: handleFullChapterSequentialTTS, color: '#F59E0B' },
            'chapter-ko':  { key: 'full_chapter_ko',  handler: handleFullChapterKoreanTTS,     color: '#10b981' },
            'book-en':     { key: 'full_book_en',     handler: handleFullBookTTS,              color: '#1A3C6E' },
            'book-seq':    { key: 'full_book_seq',    handler: handleFullBookSequentialTTS,    color: '#F59E0B' },
            'book-ko':     { key: 'full_book_ko',     handler: handleFullBookKoreanTTS,        color: '#10b981' },
          } as const;
          const conf = handlerMap[`${playRange}-${playMode}` as keyof typeof handlerMap];
          const modeLabel = playMode === 'en' ? '영어' : playMode === 'seq' ? '영→한' : '한국어';
          const rangeLabel = playRange === 'book'
            ? `${currentBook.ko} 전체`
            : `${currentChapter}장`;
          const playingThis = ttsPlaying === conf.key;
          const pausedThis = ttsPaused === conf.key;
          const loadingThis = ttsLoading === conf.key;
          const anyOtherActive =
            (isFullPlaying || isBookPlaying) && !playingThis && !pausedThis;
          const lockSelectors = isFullPlaying || isBookPlaying;

          return (
            <>
              {/* ① 모드 탭 */}
              <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid #d1d5db', background: '#fff' }}>
                {([
                  { v: 'en',  label: '🇺🇸 영어' },
                  { v: 'seq', label: '🔄 영→한' },
                  { v: 'ko',  label: '🇰🇷 한국어' },
                ] as const).map((m) => (
                  <button
                    key={m.v}
                    onClick={() => setPlayMode(m.v)}
                    disabled={lockSelectors}
                    style={{
                      flex: 1, padding: '12px 8px', border: 'none',
                      cursor: lockSelectors ? 'not-allowed' : 'pointer',
                      backgroundColor: playMode === m.v ? '#1A3C6E' : 'transparent',
                      color: playMode === m.v ? '#FAF9F6' : '#1A3C6E',
                      fontSize: 14, fontWeight: 600,
                      opacity: lockSelectors && playMode !== m.v ? 0.5 : 1,
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* ② 범위 카드 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPlayRange('book')}
                  disabled={lockSelectors}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 12,
                    border: playRange === 'book' ? '2px solid #1A3C6E' : '1px solid #d1d5db',
                    backgroundColor: playRange === 'book' ? '#1A3C6E' : '#fff',
                    color: playRange === 'book' ? '#FAF9F6' : '#1A3C6E',
                    cursor: lockSelectors ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                    opacity: lockSelectors && playRange !== 'book' ? 0.5 : 1,
                  }}
                >
                  📖 {currentBook.ko} 전체
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>(1~{currentBook.chapters}장)</div>
                </button>
                <button
                  onClick={() => setPlayRange('chapter')}
                  disabled={lockSelectors}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 12,
                    border: playRange === 'chapter' ? '2px solid #1A3C6E' : '1px solid #d1d5db',
                    backgroundColor: playRange === 'chapter' ? '#1A3C6E' : '#fff',
                    color: playRange === 'chapter' ? '#FAF9F6' : '#1A3C6E',
                    cursor: lockSelectors ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                    opacity: lockSelectors && playRange !== 'chapter' ? 0.5 : 1,
                  }}
                >
                  🎵 현재 장만
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>({currentChapter}장)</div>
                </button>
              </div>

              {/* ③ 재생 / 상태 / 컨트롤 */}
              {(playingThis || pausedThis) ? (
                <>
                  <div style={{
                    textAlign: 'center', fontSize: 13, color: '#1A3C6E', fontWeight: 600,
                    background: '#fff', borderRadius: 10, padding: '10px',
                  }}>
                    {playRange === 'book' && bookPlayingChapter
                      ? `📖 ${bookPlayingChapter}장${selectedVerse ? ` ${selectedVerse}절` : ''} ${playingThis ? '재생 중...' : '일시정지'}`
                      : selectedVerse
                        ? `${selectedVerse}절 ${playingThis ? '재생 중...' : '일시정지'}`
                        : playingThis ? '재생 중...' : '일시정지'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={conf.handler}
                      style={{
                        flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                        backgroundColor: conf.color, color: '#FAF9F6',
                        fontSize: 15, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {playingThis ? '⏸ 일시정지' : '▶ 계속 듣기'}
                    </button>
                    <button
                      onClick={stopAllTTS}
                      style={{
                        flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                        backgroundColor: '#ef4444', color: '#FAF9F6',
                        fontSize: 15, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      ⏹ 정지
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={conf.handler}
                  disabled={anyOtherActive}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 12, border: 'none',
                    backgroundColor: anyOtherActive ? '#d1d5db' : conf.color,
                    color: anyOtherActive ? '#9ca3af' : '#FAF9F6',
                    fontSize: 16, fontWeight: 700,
                    cursor: anyOtherActive ? 'not-allowed' : 'pointer',
                    opacity: anyOtherActive ? 0.45 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {loadingThis ? '⏳ 로딩 중...' : `▶ ${rangeLabel} ${modeLabel} 듣기 시작`}
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* 절 목록 */}
      <div style={{ padding: '0 16px 16px' }}>
        {(genesisData?.verses ?? []).map((verse: Verse) => {
          const curProg = progressMap[`${currentBook.prefix}_${currentChapter}`];
          const isHeard = curProg?.heardVerses?.includes(verse.verse) || false;
          const isQuiz = curProg?.quizVerses?.includes(verse.verse) || false;
          return (
          <div
            key={verse.verse}
            id={`bible-verse-${verse.verse}`}
            style={{
              backgroundColor: selectedVerse === verse.verse ? '#EDE9F5' : '#fff',
              borderRadius: 12, marginBottom: 10,
              border: selectedVerse === verse.verse ? '1.5px solid #1A3C6E' : '1px solid #e5e5e5',
              overflow: 'hidden',
            }}
          >
            {/* 절 헤더 */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', cursor: 'pointer',
              }}
              onClick={() => setSelectedVerse(selectedVerse === verse.verse ? null : verse.verse)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{
                  backgroundColor: '#1A3C6E', color: '#FAF9F6',
                  borderRadius: '50%', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {verse.verse}
                </span>
                {selectedVerse === verse.verse ? (
                  renderVerseWithWords(verse.text, `verse_${verse.verse}`)
                ) : (
                  <p style={{
                    fontSize: 13, color: '#333', lineHeight: 1.6, margin: 0,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {verse.text}
                  </p>
                )}
              </div>
              {(isHeard || isQuiz) && (
                <div style={{ flexShrink: 0, marginLeft: 8, fontSize: 13, letterSpacing: 1 }}>
                  {isHeard && '🔊'}{isQuiz && '🎯'}
                </div>
              )}
            </div>

            {/* 절 펼쳤을 때 버튼들 */}
            {selectedVerse === verse.verse && !isFullPlaying && (
              <div style={{ padding: '4px 12px 14px' }}>
                {/* 🔊 듣기 그룹 */}
                <div style={{ backgroundColor: '#EDE9F5', borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>
                  <p style={{ fontSize: 10, color: '#8B4789', fontWeight: 700, margin: '0 0 6px' }}>🔊 듣기</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ttsPlaying === `verse_${verse.verse}` ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleTTS(verse.text, `verse_${verse.verse}`)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#8B4789', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏸ 일시정지
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : ttsPaused === `verse_${verse.verse}` ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleTTS(verse.text, `verse_${verse.verse}`)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#8B4789', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ▶ 계속 듣기
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleTTS(verse.text, `verse_${verse.verse}`)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, border: 'none',
                          backgroundColor: '#fff', color: '#1A3C6E',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {ttsLoading === `verse_${verse.verse}` ? '⏳' : '🇺🇸 영어'}
                      </button>
                    )}
                    {ttsPlaying === `verse_ko_${verse.verse}` ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleKoreanTTS(verse)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#1A7A4A', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏸ 일시정지
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : ttsPaused === `verse_ko_${verse.verse}` ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleKoreanTTS(verse)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#1A7A4A', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ▶ 계속 듣기
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleKoreanTTS(verse)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, border: 'none',
                          backgroundColor: '#fff', color: '#1A3C6E',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {ttsLoading === `verse_ko_${verse.verse}` ? '⏳' : '🇰🇷 한국어'}
                      </button>
                    )}
                    {isSequentialPlaying === verse.verse ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleSequentialTTS(verse)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#B45309', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏸ 일시정지
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : ttsPaused === `seq_${verse.verse}` ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleSequentialTTS(verse)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#B45309', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ▶ 계속 듣기
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSequentialTTS(verse)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, border: 'none',
                          backgroundColor: '#fff', color: '#1A3C6E',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {ttsLoading === `seq_${verse.verse}` ? '⏳' : '🔄 영→한'}
                      </button>
                    )}
                    {ttsPlaying === `verse_koen_${verse.verse}` ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleKoEnHighlightTTS(verse)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#065F46', color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          ⏸ 일시정지
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : ttsPaused === `verse_koen_${verse.verse}` ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleKoEnHighlightTTS(verse)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#065F46', color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          ▶ 계속 듣기
                        </button>
                        <button
                          onClick={stopAllTTS}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none',
                            backgroundColor: '#ef4444', color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          ⏹ 정지
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleKoEnHighlightTTS(verse)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, border: 'none',
                          backgroundColor: '#fff', color: '#10b981',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {ttsLoading === `verse_koen_${verse.verse}` ? '⏳' : '✨ 한→영'}
                      </button>
                    )}
                  </div>
                </div>
                {/* 📖 학습 그룹 */}
                <div style={{ backgroundColor: '#f3f4f6', borderRadius: 10, padding: '8px 10px' }}>
                  <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, margin: '0 0 6px' }}>📖 학습</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleTranslationClick(verse)}
                      style={{
                        padding: '5px 12px', borderRadius: 20,
                        border: '1px solid #d0dff0', backgroundColor: '#fff',
                        color: '#1A3C6E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      🇰🇷 번역
                    </button>
                    <button
                      onClick={() => handleGrammarClick(verse)}
                      style={{
                        padding: '5px 12px', borderRadius: 20,
                        border: '1px solid #d0dff0', backgroundColor: '#fff',
                        color: '#1A3C6E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      📚 문법
                    </button>
                    <button
                      onClick={() => handleQuizClick(verse, quizLevel)}
                      style={{
                        padding: '5px 12px', borderRadius: 20,
                        border: '1px solid #d0dff0', backgroundColor: '#fff',
                        color: '#1A3C6E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      🎯 퀴즈
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>

      {/* 번역 팝업 */}
      {translationPopup && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 24,
            maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E' }}>
                🇰🇷 창세기 {currentChapter}:{translationPopup.verse} 번역
              </span>
              <button onClick={() => setTranslationPopup(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
              {translationPopup.text}
            </p>
            <hr style={{ margin: '12px 0', borderColor: '#eee' }} />
            {translationPopup.loading ? (
              <p style={{ color: '#999', fontSize: 14 }}>번역 불러오는 중... 🇰🇷</p>
            ) : (
              <p style={{ fontSize: 15, color: '#1A3C6E', lineHeight: 1.8, fontWeight: 500 }}>
                {translationPopup.translation}
              </p>
            )}
            <hr style={{ margin: '16px 0 10px', borderColor: '#eee' }} />
            <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, margin: 0 }}>
              📌 이 번역은 영어 학습을 위해 AI가 재구성한 학습용 번역입니다.
              예배·신앙 목적의 공식 성경 번역본과 다를 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 오류수정 팝업 — 개발자 전용 */}
      {errorPopup && (
        <div
          onClick={() => setErrorPopup(null)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#fff', borderRadius: 20,
              padding: 16, width: '90%', maxWidth: 400,
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3C6E' }}>GPT 오류수정 내역</span>
                <span style={{
                  fontSize: 11, background: '#EEEDFE', color: '#3C3489',
                  padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                }}>개발자 전용</span>
              </div>
              <button onClick={() => setErrorPopup(null)} style={{
                background: 'none', border: 'none', fontSize: 20,
                color: '#999', cursor: 'pointer',
              }}>×</button>
            </div>

            <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              {errorPopup.verseText.slice(0, 40)}...
            </p>

            {errorPopup.loading ? (
              <p style={{ color: '#999', fontSize: 14, textAlign: 'center' }}>불러오는 중... 🔍</p>
            ) : errorPopup.changes && errorPopup.changes.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {errorPopup.changes.map((change, idx) => {
                    const isPass = change.includes('수정 없음');
                    return (
                      <div key={idx} style={{
                        background: '#f8f8f8', borderRadius: 8, padding: 12,
                        borderLeft: `3px solid ${isPass ? '#1D9E75' : '#534AB7'}`,
                      }}>
                        <p style={{ fontSize: 13, color: '#333', margin: 0 }}>{change}</p>
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  marginTop: 16, padding: 10,
                  background: '#EAF3DE', borderRadius: 8,
                }}>
                  <p style={{ fontSize: 12, color: '#3B6D11', margin: 0 }}>
                    총 {errorPopup.changes.filter(c => !c.includes('수정 없음')).length}개 수정 ·{' '}
                    {errorPopup.changes.filter(c => c.includes('수정 없음')).length}개 통과
                  </p>
                </div>
              </>
            ) : (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: '#888' }}>수정 내역이 없습니다.</p>
                <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  아직 GPT 검증이 실행되지 않았거나 수정 사항이 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 단어 뜻 팝업 */}
      {wordPopup && (
        <div
          onClick={() => { setWordPopup(null); setVocabMemo(''); setVocabExample(''); setVocabSaved(false); }}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 100, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%', maxWidth: 360,
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: '24px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>
                {wordPopup.word}
              </p>
              <button
                onClick={() => { setWordPopup(null); setVocabMemo(''); setVocabExample(''); setVocabSaved(false); }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>
            {wordPopup.loading ? (
              <p style={{ color: '#999', fontSize: 14 }}>뜻을 찾는 중...</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {wordPopup.partOfSpeech && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: '#8B4789',
                      backgroundColor: '#f0e6f6', padding: '3px 8px', borderRadius: 10,
                    }}>
                      {wordPopup.partOfSpeech}
                    </span>
                  )}
                  {wordPopup.phonetic && (
                    <span style={{
                      fontSize: 13, color: '#666',
                      backgroundColor: '#f5f5f5', padding: '3px 8px', borderRadius: 10,
                    }}>
                      {wordPopup.phonetic}
                    </span>
                  )}
                  {wordPopup.koreanPronunciation && (
                    <span style={{
                      fontSize: 13, color: '#1A3C6E',
                      backgroundColor: '#EDE9F5', padding: '3px 8px', borderRadius: 10,
                    }}>
                      [{wordPopup.koreanPronunciation}]
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 18, color: '#333', fontWeight: 600, margin: '8px 0 16px' }}>
                  {wordPopup.meaning}
                </p>
                <button
                  onClick={() => handleTTS(wordPopup.word, `word_${wordPopup.word}`)}
                  style={{
                    padding: '8px 20px', borderRadius: 20, border: 'none',
                    backgroundColor: ttsPlaying === `word_${wordPopup.word}` ? '#8B4789' : '#1A3C6E',
                    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {ttsLoading === `word_${wordPopup.word}` ? '⏳' : '🔊 발음 듣기'}
                </button>

                {/* 생활 예문 */}
                {wordPopup.example && (
                  <div style={{
                    background: '#f0fdf4', borderRadius: 10,
                    padding: '10px 12px', marginTop: 12, marginBottom: 8,
                    borderLeft: '3px solid #10b981',
                  }}>
                    <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 4 }}>
                      💬 생활 예문
                    </div>
                    <div style={{ fontSize: 13, color: '#1A3C6E', fontWeight: 500 }}>
                      {wordPopup.example}
                    </div>
                    {wordPopup.exampleKo && (
                      <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
                        → {wordPopup.exampleKo}
                      </div>
                    )}
                  </div>
                )}

                {/* 구동사 */}
                {wordPopup.phrasalVerb && (
                  <div style={{
                    background: '#fff7ed', borderRadius: 10,
                    padding: '10px 12px', marginBottom: 8,
                    borderLeft: '3px solid #f97316',
                  }}>
                    <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600, marginBottom: 4 }}>
                      🔗 구동사
                    </div>
                    <div style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
                      {wordPopup.phrasalVerb}
                      {wordPopup.phrasalVerbMeaning && (
                        <span style={{ fontSize: 13, fontWeight: 400, color: '#666', marginLeft: 8 }}>
                          — {wordPopup.phrasalVerbMeaning}
                        </span>
                      )}
                    </div>
                    {wordPopup.phrasalVerbExample && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#1A3C6E', fontStyle: 'italic' }}>
                        {wordPopup.phrasalVerbExample}
                      </div>
                    )}
                    {wordPopup.phrasalVerbExampleKo && (
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        → {wordPopup.phrasalVerbExampleKo}
                      </div>
                    )}
                  </div>
                )}

                {/* 구분선 */}
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '14px 0' }} />

                {/* 예문 입력 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                    📖 예문 (성경 절 자동입력 · 수정 가능)
                  </div>
                  <textarea
                    value={vocabExample}
                    onChange={e => setVocabExample(e.target.value)}
                    placeholder="예문을 입력하세요..."
                    rows={2}
                    style={{
                      width: '100%', fontSize: 13,
                      padding: '8px 10px', borderRadius: 8,
                      border: '1px solid #d1d5db',
                      resize: 'none', boxSizing: 'border-box',
                      outline: 'none', color: '#333',
                      backgroundColor: '#f9fafb',
                    }}
                  />
                </div>

                {/* 메모 입력 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                    📝 나만의 메모 (선택)
                  </div>
                  <textarea
                    value={vocabMemo}
                    onChange={e => setVocabMemo(e.target.value)}
                    placeholder="이 단어에 대한 메모를 입력하세요..."
                    rows={2}
                    style={{
                      width: '100%', fontSize: 14,
                      padding: '8px 10px', borderRadius: 8,
                      border: '1px solid #d1d5db',
                      resize: 'none', boxSizing: 'border-box',
                      outline: 'none', color: '#333',
                    }}
                  />
                </div>

                {/* 저장 버튼 */}
                {vocabSaved ? (
                  <div style={{
                    textAlign: 'center', fontSize: 14,
                    color: '#10b981', fontWeight: 500, padding: '8px 0',
                  }}>
                    ✅ 단어장에 저장되었습니다!
                  </div>
                ) : (
                  <button
                    onClick={handleSaveVocab}
                    style={{
                      width: '100%', padding: '10px 0',
                      backgroundColor: '#1A3C6E', color: '#fff',
                      border: 'none', borderRadius: 10,
                      fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    📚 단어장에 저장
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 문법 해설 팝업 */}
      {grammarPopup && (
        <div
          onClick={() => setGrammarPopup(null)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 100, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              backgroundColor: '#fff',
              borderRadius: '20px',
              padding: '24px 24px 32px',
              maxHeight: '85vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>
                ✏️ 오늘의 표현
              </p>
              <button
                onClick={() => setGrammarPopup(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>

            {/* 구절 원문 */}
            <div style={{
              padding: '10px 14px', backgroundColor: '#f8faff',
              borderRadius: 8, marginBottom: 16, fontSize: 12,
              color: '#555', lineHeight: 1.6,
            }}>
              {grammarPopup.verseText}
            </div>

            {grammarPopup.loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: '#999', fontSize: 14 }}>분석 중... ✨</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {[
                  { key: 'verb',        exKey: 'verb_example',        icon: '🔵', label: '핵심 동사',   color: '#EFF6FF', border: '#BFDBFE', text: '#1e40af' },
                  { key: 'preposition', exKey: 'preposition_example',  icon: '🟡', label: '전치사',      color: '#FFFBEB', border: '#FDE68A', text: '#92400e' },
                  { key: 'phrasal',     exKey: 'phrasal_example',      icon: '🟠', label: '구동사',      color: '#FFF7ED', border: '#FDBA74', text: '#9a3412' },
                  { key: 'relative',    exKey: 'relative_example',     icon: '🟣', label: '관계사',      color: '#F5F3FF', border: '#C4B5FD', text: '#6d28d9' },
                  { key: 'question',    exKey: 'question_example',     icon: '🔴', label: '의문사',      color: '#FFF1F2', border: '#FECDD3', text: '#9f1239' },
                  { key: 'exclamation', exKey: 'exclamation_example',  icon: '🟢', label: '감탄사/명령', color: '#F0FDF4', border: '#86EFAC', text: '#166534' },
                ].map(({ key, exKey, icon, label, color, border, text }) => {
                  const val = grammarPopup[key as keyof typeof grammarPopup] as string | undefined;
                  if (!val) return null;
                  const exEn = grammarPopup[`${exKey}_en` as keyof typeof grammarPopup] as string | undefined;
                  const exKo = grammarPopup[`${exKey}_ko` as keyof typeof grammarPopup] as string | undefined;
                  return (
                    <div key={key} style={{
                      backgroundColor: color, borderRadius: 10,
                      padding: '12px 14px', border: `1px solid ${border}`,
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 4 }}>
                        {icon} {label}
                      </p>
                      <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, margin: '0 0 8px' }}>
                        {val}
                      </p>
                      {exEn && (
                        <div style={{
                          backgroundColor: 'rgba(255,255,255,0.7)',
                          borderRadius: 8, padding: '8px 10px',
                          borderLeft: `3px solid ${border}`,
                        }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: text, margin: '0 0 2px' }}>
                            📝 예문
                          </p>
                          <p style={{ fontSize: 12, color: '#1A3C6E', fontWeight: 600, margin: '0 0 2px' }}>
                            {exEn}
                          </p>
                          {exKo && (
                            <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
                              → {exKo}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 내 문장 만들기 */}
                {grammarPopup.mysentence && (
                  <div style={{
                    backgroundColor: '#D1FAE5', borderRadius: 10,
                    padding: '12px 14px', border: '1px solid #6EE7B7',
                    marginTop: 4,
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>
                      ✏️ 나도 써볼게요
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#333', margin: '0 0 4px' }}>
                      {grammarPopup.mysentence}
                    </p>
                    {grammarPopup.korean && (
                      <p style={{ fontSize: 12, color: '#555', margin: 0 }}>
                        → {grammarPopup.korean}
                      </p>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* 퀴즈 팝업 */}
      {quizPopup && (
        <div
          onClick={() => setQuizPopup(null)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 100, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: '24px 24px 32px',
              maxHeight: '85vh', overflowY: 'auto',
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>
                🎯 빈칸 채우기 퀴즈
              </p>
              <button
                onClick={() => setQuizPopup(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>
            {/* 난이도 선택 */}
            {!quizPopup.loading && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(['basic', 'intermediate', 'advanced'] as const).map((lv) => (
                  <button
                    key={lv}
                    onClick={() => {
                      const currentVerse = { verse: 0, text: quizPopup.verseText };
                      handleQuizClick(currentVerse as any, lv);
                    }}
                    style={{
                      flex: 1, padding: '6px 4px', borderRadius: 10, border: 'none',
                      backgroundColor: quizPopup.level === lv ? '#1A3C6E' : '#f3f4f6',
                      color: quizPopup.level === lv ? '#fff' : '#555',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {lv === 'basic' ? '🟢 초급' : lv === 'intermediate' ? '🟡 중급' : '🔴 고급'}
                  </button>
                ))}
              </div>
            )}
            {/* 고급 모드: 한국어 문장 표시 */}
            {!quizPopup.loading && quizPopup.level === 'advanced' && quizPopup.koreanText && (
              <div style={{
                backgroundColor: '#FEF3E2', borderRadius: 12,
                padding: 14, marginBottom: 16,
                border: '1.5px solid #F59E0B',
                fontSize: 14, color: '#92400E', lineHeight: 1.8,
              }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#B45309' }}>🇰🇷 한국어 번역</p>
                {quizPopup.koreanText}
              </div>
            )}

            {quizPopup.loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: '#999', fontSize: 14 }}>퀴즈 생성 중... 🎯</p>
              </div>
            ) : (
              <div>
                {/* 빈칸 구절 */}
                <div style={{
                  backgroundColor: '#f8faff', borderRadius: 12,
                  padding: 16, marginBottom: 20,
                  border: '1.5px solid #d0dff0', lineHeight: 2,
                  fontSize: 14, color: '#333',
                }}>
                  {quizPopup.blankedText.split('_____').map((part, idx) => (
                    <span key={idx}>
                      {part}
                      {idx < quizPopup.blanks.length && (
                        <span style={{
                          display: 'inline-block',
                          minWidth: 80, borderBottom: '2px solid #1A3C6E',
                          textAlign: 'center', color: '#1A3C6E', fontWeight: 700,
                          backgroundColor: quizPopup.selectedAnswers[idx] ? '#EDE9F5' : 'transparent',
                          padding: '0 8px', marginBottom: -4,
                        }}>
                          {quizPopup.selectedAnswers[idx] || ' '}
                        </span>
                      )}
                    </span>
                  ))}
                </div>

                {/* 힌트 토글 버튼 */}
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => setShowQuizHint(prev => !prev)}
                    style={{
                      padding: '5px 14px', borderRadius: 20,
                      border: '1.5px solid #8B4789',
                      backgroundColor: showQuizHint ? '#8B4789' : '#fff',
                      color: showQuizHint ? '#fff' : '#8B4789',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    💡 힌트 {showQuizHint ? '접기 ▲' : '보기 ▼'}
                  </button>
                </div>
                {/* 힌트 내용 — 토글 시에만 표시 */}
                {showQuizHint && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {quizPopup.blanks.map((blank, idx) => (
                      <span key={idx} style={{
                        fontSize: 11, color: '#8B4789',
                        backgroundColor: '#f0e6f6', padding: '3px 8px', borderRadius: 10,
                      }}>
                        빈칸{idx + 1}: {blank.hint}
                      </span>
                    ))}
                  </div>
                )}

                {/* 보기 */}
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', marginBottom: 10 }}>
                  보기에서 선택하세요:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {quizPopup.options.map((option, idx) => {
                    const isUsed = quizPopup.selectedAnswers.includes(option);
                    const isCorrect = quizPopup.submitted && quizPopup.blanks.some(b => b.answer === option);
                    const isWrong = quizPopup.submitted && isUsed && !isCorrect;
                    return (
                      <button
                        key={idx}
                        disabled={isUsed || quizPopup.submitted}
                        onClick={() => {
                          const emptyIdx = quizPopup.selectedAnswers.findIndex(a => a === '');
                          if (emptyIdx === -1) return;
                          const newAnswers = [...quizPopup.selectedAnswers];
                          newAnswers[emptyIdx] = option;
                          setQuizPopup(prev => prev ? { ...prev, selectedAnswers: newAnswers } : null);
                        }}
                        style={{
                          padding: '8px 16px', borderRadius: 20,
                          border: '1.5px solid',
                          borderColor: isCorrect ? '#10b981' : isWrong ? '#ef4444' : '#d0dff0',
                          backgroundColor: isCorrect ? '#d1fae5' : isWrong ? '#fee2e2' : isUsed ? '#f3f4f6' : '#f8faff',
                          color: isCorrect ? '#10b981' : isWrong ? '#ef4444' : isUsed ? '#999' : '#1A3C6E',
                          fontSize: 13, fontWeight: 600,
                          cursor: isUsed || quizPopup.submitted ? 'default' : 'pointer',
                          opacity: isUsed ? 0.5 : 1,
                        }}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {/* 선택 취소 버튼 */}
                {!quizPopup.submitted && quizPopup.selectedAnswers.some(a => a !== '') && (
                  <button
                    onClick={() => setQuizPopup(prev => prev ? {
                      ...prev,
                      selectedAnswers: new Array(prev.blanks.length).fill('')
                    } : null)}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      border: '1px solid #d0dff0', backgroundColor: '#f8faff',
                      color: '#999', fontSize: 12, cursor: 'pointer', marginBottom: 12,
                    }}
                  >
                    🔄 다시 선택
                  </button>
                )}

                {/* 제출 버튼 */}
                {!quizPopup.submitted && (
                  <button
                    disabled={quizPopup.selectedAnswers.some(a => a === '')}
                    onClick={() => {
                      setQuizPopup(prev => prev ? { ...prev, submitted: true } : null);
                      if (quizPopup.verse) saveProgress(quizPopup.verse, 'quiz');
                    }}
                    style={{
                      width: '100%', padding: '12px',
                      borderRadius: 12, border: 'none',
                      backgroundColor: quizPopup.selectedAnswers.some(a => a === '') ? '#d1d5db' : '#1A3C6E',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                      cursor: quizPopup.selectedAnswers.some(a => a === '') ? 'not-allowed' : 'pointer',
                    }}
                  >
                    정답 확인
                  </button>
                )}

                {/* 결과 */}
                {quizPopup.submitted && (() => {
                  const correct = quizPopup.blanks.filter(
                    (b, idx) => b.answer === quizPopup.selectedAnswers[idx]
                  ).length;
                  const total = quizPopup.blanks.length;
                  const allCorrect = correct === total;
                  return (
                    <div style={{
                      textAlign: 'center', padding: '16px',
                      backgroundColor: allCorrect ? '#d1fae5' : '#FDF6C3',
                      borderRadius: 12, marginTop: 8,
                    }}>
                      <p style={{ fontSize: 22, margin: '0 0 8px' }}>
                        {allCorrect ? '🎉' : '💪'}
                      </p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: allCorrect ? '#10b981' : '#f59e0b', margin: '0 0 4px' }}>
                        {correct}/{total} 정답!
                      </p>
                      <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
                        {allCorrect ? '완벽합니다!' : '정답: ' + quizPopup.blanks.map(b => b.answer).join(', ')}
                      </p>
                      <button
                        onClick={() => setQuizPopup(prev => prev ? {
                          ...prev,
                          selectedAnswers: new Array(prev.blanks.length).fill(''),
                          submitted: false,
                        } : null)}
                        style={{
                          padding: '8px 20px', borderRadius: 20,
                          border: 'none', backgroundColor: '#1A3C6E',
                          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        🔄 다시 풀기
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
