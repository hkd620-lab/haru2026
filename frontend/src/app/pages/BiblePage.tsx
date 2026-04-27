import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import genesisData from '../../data/genesis_1.json';

interface Verse {
  verse: number;
  text: string;
}

const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

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
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [highlightedWord, setHighlightedWord] = useState<{ key: string; index: number } | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // 창세기 1장 전체 자동 사전생성
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const verseTexts: Record<string, string> = {};
        const verses: string[] = [];

        genesisData.verses.forEach((verse: Verse) => {
          const verseKey = `genesis_1_${verse.verse}`;
          verses.push(verseKey);
          verseTexts[verseKey] = verse.text;
        });

        const fns = getFunctions(undefined, 'asia-northeast3');
        const fn = httpsCallable(fns, 'preloadChapterGrammar');
        await fn({ book: '창세기', chapter: 1, verses, verseTexts });
      } catch (e) {
        // 백그라운드 작업 — 실패 무시
      }
    });
    return () => unsubscribe();
  }, []);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
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

  const handleGrammarClick = useCallback(async (verse: Verse) => {
    setGrammarPopup({ verseText: verse.text, loading: true });
    try {
      const { getFunctions: gf, httpsCallable: hc } = await import('firebase/functions');
      const fns = gf(undefined, 'asia-northeast3');
      const fn = hc(fns, 'getGrammarExplain');
      const res: any = await fn({
        verseKey: `genesis_1_${verse.verse}`,
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
        verseKey: `genesis_1_${verse.verse}`,
        text: verse.text,
      }) as { data: { translation: string } };
      setTranslationPopup({ verse: verse.verse, text: verse.text, translation: result.data.translation, loading: false });
    } catch {
      setTranslationPopup({ verse: verse.verse, text: verse.text, translation: '번역을 불러오지 못했습니다.', loading: false });
    }
  };

  // 한국어 TTS 듣기
  const handleKoreanTTS = async (verse: { verse: number; text: string }) => {
    const key = `verse_ko_${verse.verse}`;
    if (ttsPlaying === key) {
      if (audioRef.current) audioRef.current.pause();
      setTtsPlaying(null);
      return;
    }
    setTtsLoading(key);
    try {
      // 번역 먼저 가져오기 (캐시 우선)
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const transResult = await transFn({
        verseKey: `genesis_1_${verse.verse}`,
        text: verse.text,
      }) as { data: { translation: string } };
      const translation = transResult.data.translation;

      // 한국어 TTS 호출
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const cacheKey = `bible_genesis_1_ko_${verse.verse}_${koVoice}`.slice(0, 80);
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
        audioRef.current.onended = () => { setTtsPlaying(null); setHighlightedEnWords([]); };
        await audioRef.current.play();
        setTtsPlaying(key);
      }
    } catch {
      setTtsLoading(null);
    }
  };

  // 한→영 하이라이트 듣기 (세계최초)
  const handleKoEnHighlightTTS = async (verse: { verse: number; text: string }) => {
    const key = `verse_koen_${verse.verse}`;
    if (ttsPlaying === key) {
      if (audioRef.current) audioRef.current.pause();
      setTtsPlaying(null);
      setHighlightedEnWords([]);
      return;
    }
    setTtsLoading(key);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const mappingFn = httpsCallable(fns, 'getVerseWordMapping');
      const ttsFn = httpsCallable(fns, 'generateTTS');

      const transResult = await transFn({
        verseKey: `genesis_1_${verse.verse}`,
        text: verse.text,
      }) as { data: { translation: string } };
      const translation = transResult.data.translation;

      const [mappingResult, ttsResult] = await Promise.all([
        mappingFn({ verseKey: `genesis_1_${verse.verse}`, enText: verse.text, koText: translation }) as Promise<{ data: { mapping: Array<{ ko: string; enWords: string[] }> } }>,
        ttsFn({ text: translation, cacheKey: `bible_genesis_1_ko_${verse.verse}_${koVoice}`.slice(0, 80), voice: koVoice }) as Promise<{ data: { audioUrl?: string; audioBase64?: string } }>,
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
    } catch {
      setTtsLoading(null);
      setHighlightedEnWords([]);
    }
  };

  // 영어 → 한국어 연속 듣기
  const handleSequentialTTS = async (verse: { verse: number; text: string }) => {
    const key = `verse_${verse.verse}`;
    if (isSequentialPlaying === verse.verse) {
      if (audioRef.current) audioRef.current.pause();
      setIsSequentialPlaying(null);
      setTtsPlaying(null);
      return;
    }
    setIsSequentialPlaying(verse.verse);
    setTtsLoading(`seq_${verse.verse}`);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');

      // ① 영어 TTS
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const enCacheKey = `bible_genesis_1_${verse.verse}_${enVoice}`.slice(0, 80);
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
          audioRef.current = new Audio(enAudioSrc);
          audioRef.current.playbackRate = ttsSpeed;
          setTtsPlaying(key);
          audioRef.current.onended = () => {
            if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
            setHighlightedWord(null);
            resolve();
          };
          // 영어 재생 시 단어 하이라이트
          const words = verse.text.trim().split(/\s+/);
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
          audioRef.current.play();
        }),
        transFn({ verseKey: `genesis_1_${verse.verse}`, text: verse.text }) as Promise<{ data: { translation: string } }>,
      ]);

      // (중간 정지 체크 제거 — React state 비동기 문제로 항상 null로 읽힘)

      // ③ 한국어 TTS
      const koCacheKey = `bible_genesis_1_ko_${verse.verse}_${koVoice}`.slice(0, 80);
      const koRes: any = await ttsFn({ text: transResult.data.translation, cacheKey: koCacheKey, voice: koVoice });

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

      if (koAudioSrc) {
        audioRef.current = new Audio(koAudioSrc);
        audioRef.current.playbackRate = ttsSpeed;
        setTtsPlaying(`verse_ko_${verse.verse}`);
        audioRef.current.onended = () => {
          setTtsPlaying(null);
          setIsSequentialPlaying(null);
        };
        await audioRef.current.play();
      } else {
        setIsSequentialPlaying(null);
        setTtsPlaying(null);
      }
    } catch {
      setTtsLoading(null);
      setIsSequentialPlaying(null);
      setTtsPlaying(null);
    }
  };

  // 퀴즈 팝업
  const [quizPopup, setQuizPopup] = useState<{
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
  const [enVoice, setEnVoice] = useState<'nova' | 'onyx'>('nova');
  const [koVoice, setKoVoice] = useState<'nova' | 'onyx'>('onyx');
  const [showQuizHint, setShowQuizHint] = useState(false);

  const handleQuizClick = useCallback(async (verse: Verse, level: 'basic' | 'intermediate' | 'advanced' = quizLevel) => {
    setQuizPopup({
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
        verseKey: `genesis_1_${verse.verse}`,
        verseText: verse.text,
        level,
      });
      setQuizPopup({
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
      const verseKey = `genesis_1_${verse.verse}`;
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
  } | null>(null);

  const handleWordClick = useCallback(async (word: string) => {
    // 특수문자 제거
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (!cleanWord) return;

    setWordPopup({ word: cleanWord, meaning: '', partOfSpeech: '', phonetic: '', koreanPronunciation: '', loading: true });

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
              onClick={(e) => { e.stopPropagation(); handleWordClick(word); }}
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
    if (ttsPlaying === key) {
      audioRef.current?.pause();
      setHighlightedWord(null);
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      setTtsPlaying(null);
      return;
    }

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
      const cacheKey = `bible_genesis_1_${key}_${voiceParam}`.slice(0, 80);
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
    } catch (err) {
      console.error('TTS 오류:', err);
      setTtsPlaying(null);
    } finally {
      setTtsLoading(null);
    }
  };

  const handleFullChapterTTS = async () => {
    if (ttsPlaying === 'full_chapter') {
      audioRef.current?.pause();
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      setHighlightedWord(null);
      setSelectedVerse(null);
      setTtsPlaying(null);
      return;
    }
    setTtsLoading('full_chapter');
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      setTtsLoading(null);
      setTtsPlaying('full_chapter');
      for (const verse of genesisData.verses) {
        // 현재 절 자동 펼치기
        setSelectedVerse(verse.verse);
        const enCacheKey = `bible_genesis_1_${verse.verse}_${enVoice}`.slice(0, 80);
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
    } catch {
      setTtsLoading(null);
      setTtsPlaying(null);
    }
  };

  const handleFullChapterKoreanTTS = async () => {
    if (ttsPlaying === 'full_chapter_ko') {
      audioRef.current?.pause();
      setTtsPlaying(null);
      return;
    }
    setTtsLoading('full_chapter_ko');
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const ttsFn = httpsCallable(fns, 'generateTTS');

      // 전체 절 번역 순서대로 가져오기
      const translations: string[] = [];
      for (const verse of genesisData.verses) {
        const res = await transFn({
          verseKey: `genesis_1_${verse.verse}`,
          text: verse.text,
        }) as { data: { translation: string } };
        translations.push(res.data.translation);
      }
      const fullKoText = translations.join(' ');
      const cacheKey = `bible_genesis_1_full_ko_${koVoice}`;
      const ttsRes: any = await ttsFn({ text: fullKoText, cacheKey, voice: koVoice });
      setTtsLoading(null);

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
        audioRef.current.onended = () => setTtsPlaying(null);
        await audioRef.current.play();
        setTtsPlaying('full_chapter_ko');
      }
    } catch {
      setTtsLoading(null);
    }
  };

  const handleFullChapterSequentialTTS = async () => {
    if (ttsPlaying === 'full_chapter_seq') {
      audioRef.current?.pause();
      setTtsPlaying(null);
      return;
    }
    setTtsLoading('full_chapter_seq');
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      setTtsLoading(null);
      setTtsPlaying('full_chapter_seq');

      for (const verse of genesisData.verses) {
        // 영어 TTS
        const enCacheKey = `bible_genesis_1_${verse.verse}_${enVoice}`.slice(0, 80);
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

        // 번역 가져오기
        const transRes = await transFn({
          verseKey: `genesis_1_${verse.verse}`,
          text: verse.text,
        }) as { data: { translation: string } };

        // 현재 절 자동 펼치기
        setSelectedVerse(verse.verse);
        // 영어 재생 + 하이라이트
        if (enSrc) {
          await new Promise<void>((resolve) => {
            audioRef.current = new Audio(enSrc);
            audioRef.current.playbackRate = ttsSpeed;
            audioRef.current.onended = () => {
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
              setHighlightedWord(null);
              resolve();
            };
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

        // 한국어 TTS
        const koCacheKey = `bible_genesis_1_ko_${verse.verse}_${koVoice}`.slice(0, 80);
        const koRes: any = await ttsFn({ text: transRes.data.translation, cacheKey: koCacheKey, voice: koVoice });
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

        // 한국어 재생
        if (koSrc) {
          await new Promise<void>((resolve) => {
            audioRef.current = new Audio(koSrc);
            audioRef.current.playbackRate = ttsSpeed;
            audioRef.current.onended = () => resolve();
            audioRef.current.play();
          });
        }
      }
      setTtsPlaying(null);
    } catch {
      setTtsLoading(null);
      setTtsPlaying(null);
    }
  };

  const handleFullChapterKoEnTTS = async () => {
    if (ttsPlaying === 'full_chapter_ko_en') {
      audioRef.current?.pause();
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      setHighlightedEnWords([]);
      setTtsPlaying(null);
      setSelectedVerse(null);
      return;
    }
    setTtsLoading('full_chapter_ko_en');
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const transFn = httpsCallable(fns, 'getVerseTranslation');
      const ttsFn = httpsCallable(fns, 'generateTTS');
      const mappingFn = httpsCallable(fns, 'getVerseWordMapping');
      setTtsLoading(null);
      setTtsPlaying('full_chapter_ko_en');

      for (const verse of genesisData.verses) {
        setSelectedVerse(verse.verse);
        const transRes = await transFn({
          verseKey: `genesis_1_${verse.verse}`,
          text: verse.text,
        }) as { data: { translation: string } };
        const translation = transRes.data.translation;

        const koCacheKey = `bible_genesis_1_ko_${verse.verse}_${koVoice}`.slice(0, 80);
        const [ttsRes, mappingRes] = await Promise.all([
          ttsFn({ text: translation, cacheKey: koCacheKey, voice: koVoice }),
          mappingFn({
            verseKey: `genesis_1_${verse.verse}`,
            enText: verse.text,
            koText: translation,
          }),
        ]) as any[];

        const mapping = (mappingRes.data as any).mapping || [];

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
          await new Promise<void>((resolve) => {
            audioRef.current = new Audio(audioSrc);
            audioRef.current.playbackRate = ttsSpeed;
            audioRef.current.onended = () => {
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
              setHighlightedEnWords([]);
              resolve();
            };
            const audio = audioRef.current!;
            const startKoHighlight = () => {
              const duration = audio.duration || mapping.length * 0.6;
              const interval = (duration * 1000) / mapping.length;
              let idx = 0;
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
              highlightTimerRef.current = setInterval(() => {
                if (idx >= mapping.length) {
                  clearInterval(highlightTimerRef.current!);
                  setHighlightedEnWords([]);
                  return;
                }
                setHighlightedEnWords(mapping[idx].enWords);
                idx++;
              }, interval);
            };
            if (audio.duration) {
              startKoHighlight();
            } else {
              audio.addEventListener('loadedmetadata', startKoHighlight, { once: true });
            }
            audioRef.current.play();
          });
        }
      }
      setTtsPlaying(null);
      setSelectedVerse(null);
      setHighlightedEnWords([]);
    } catch {
      setTtsLoading(null);
      setTtsPlaying(null);
      setHighlightedEnWords([]);
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
        <div>
          <p style={{ color: '#1A3C6E', fontSize: 16, fontWeight: 700, margin: 0 }}>📖 창세기 1장</p>
          <p style={{ color: '#999', fontSize: 11, margin: 0 }}>Genesis Chapter 1 · KJV</p>
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
      {/* 보이스 선택 */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 16px 0', justifyContent: 'flex-end', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#555' }}>🇺🇸</span>
          {(['nova', 'onyx'] as const).map(v => (
            <button
              key={v}
              onClick={() => setEnVoice(v)}
              style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 11,
                fontWeight: enVoice === v ? 700 : 400,
                backgroundColor: enVoice === v ? '#534AB7' : '#f3f4f6',
                color: enVoice === v ? '#fff' : '#555',
                border: 'none', cursor: 'pointer',
              }}
            >{v === 'nova' ? '여성' : '남성'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#555' }}>🇰🇷</span>
          {(['nova', 'onyx'] as const).map(v => (
            <button
              key={v}
              onClick={() => setKoVoice(v)}
              style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 11,
                fontWeight: koVoice === v ? 700 : 400,
                backgroundColor: koVoice === v ? '#0F6E56' : '#f3f4f6',
                color: koVoice === v ? '#fff' : '#555',
                border: 'none', cursor: 'pointer',
              }}
            >{v === 'nova' ? '여성' : '남성'}</button>
          ))}
        </div>
      </div>

      {/* 1장 전체 듣기 버튼 3종 */}
      <div style={{ padding: '16px', backgroundColor: '#EDE9F5', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 영어 전체 */}
        <button
          onClick={handleFullChapterTTS}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 12, border: 'none',
            backgroundColor: ttsPlaying === 'full_chapter' ? '#8B4789' : '#1A3C6E',
            color: '#FAF9F6', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {ttsLoading === 'full_chapter' ? '⏳ 로딩 중...' : ttsPlaying === 'full_chapter' ? '⏸ 정지' : '🇺🇸 1장 영어 전체 듣기'}
        </button>
        {/* 한국어 전체 */}
        <button
          onClick={handleFullChapterKoreanTTS}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 12, border: 'none',
            backgroundColor: ttsPlaying === 'full_chapter_ko' ? '#1A7A4A' : '#10b981',
            color: '#FAF9F6', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {ttsLoading === 'full_chapter_ko' ? '⏳ 로딩 중...' : ttsPlaying === 'full_chapter_ko' ? '⏸ 정지' : '🇰🇷 1장 한국어 전체 듣기'}
        </button>
        {/* 영→한 전체 */}
        <button
          onClick={handleFullChapterSequentialTTS}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 12, border: 'none',
            backgroundColor: ttsPlaying === 'full_chapter_seq' ? '#B45309' : '#F59E0B',
            color: '#FAF9F6', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {ttsLoading === 'full_chapter_seq' ? '⏳ 로딩 중...' : ttsPlaying === 'full_chapter_seq' ? '⏸ 정지' : '🔄 1장 영→한 전체 듣기'}
        </button>
        {/* 한→영 전체 */}
        <button
          onClick={handleFullChapterKoEnTTS}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 12, border: 'none',
            backgroundColor: ttsPlaying === 'full_chapter_ko_en' ? '#185FA5' : '#378ADD',
            color: '#FAF9F6', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {ttsLoading === 'full_chapter_ko_en' ? '⏳ 로딩 중...' : ttsPlaying === 'full_chapter_ko_en' ? '⏸ 정지' : '✨ 1장 한→영 전체 듣기'}
        </button>
      </div>

      {/* 절 목록 */}
      <div style={{ padding: '0 16px 16px' }}>
        {genesisData.verses.map((verse: Verse) => (
          <div
            key={verse.verse}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            </div>

            {/* 절 펼쳤을 때 버튼들 */}
            {selectedVerse === verse.verse && (
              <div style={{ padding: '4px 12px 14px' }}>
                {/* 🔊 듣기 그룹 */}
                <div style={{ backgroundColor: '#EDE9F5', borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>
                  <p style={{ fontSize: 10, color: '#8B4789', fontWeight: 700, margin: '0 0 6px' }}>🔊 듣기</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleTTS(verse.text, `verse_${verse.verse}`)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, border: 'none',
                        backgroundColor: ttsPlaying === `verse_${verse.verse}` ? '#8B4789' : '#fff',
                        color: ttsPlaying === `verse_${verse.verse}` ? '#fff' : '#1A3C6E',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {ttsLoading === `verse_${verse.verse}` ? '⏳' : ttsPlaying === `verse_${verse.verse}` ? '⏸ 정지' : '🇺🇸 영어'}
                    </button>
                    <button
                      onClick={() => handleKoreanTTS(verse)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, border: 'none',
                        backgroundColor: ttsPlaying === `verse_ko_${verse.verse}` ? '#1A7A4A' : '#fff',
                        color: ttsPlaying === `verse_ko_${verse.verse}` ? '#fff' : '#1A3C6E',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {ttsLoading === `verse_ko_${verse.verse}` ? '⏳' : ttsPlaying === `verse_ko_${verse.verse}` ? '⏸ 정지' : '🇰🇷 한국어'}
                    </button>
                    <button
                      onClick={() => handleSequentialTTS(verse)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, border: 'none',
                        backgroundColor: isSequentialPlaying === verse.verse ? '#B45309' : '#fff',
                        color: isSequentialPlaying === verse.verse ? '#fff' : '#1A3C6E',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {ttsLoading === `seq_${verse.verse}` ? '⏳' : isSequentialPlaying === verse.verse ? '⏸ 정지' : '🔄 영→한'}
                    </button>
                    <button
                      onClick={() => handleKoEnHighlightTTS(verse)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, border: 'none',
                        backgroundColor: ttsPlaying === `verse_koen_${verse.verse}` ? '#065F46' : '#fff',
                        color: ttsPlaying === `verse_koen_${verse.verse}` ? '#fff' : '#10b981',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {ttsLoading === `verse_koen_${verse.verse}` ? '⏳' : ttsPlaying === `verse_koen_${verse.verse}` ? '⏸ 정지' : '✨ 한→영'}
                    </button>
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
        ))}
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
                🇰🇷 창세기 1:{translationPopup.verse} 번역
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
          onClick={() => setWordPopup(null)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 100, display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              backgroundColor: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '24px 24px 40px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>
                {wordPopup.word}
              </p>
              <button
                onClick={() => setWordPopup(null)}
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
                    onClick={() => setQuizPopup(prev => prev ? { ...prev, submitted: true } : null)}
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
