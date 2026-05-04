import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebase';
import { firestoreService } from '../services/firestoreService';

interface DiaryItem {
  id: string;
  date: string;
  title: string;
  content: string;
}

interface GrammarPopup {
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
}

interface QuizPopup {
  verseText: string;
  loading: boolean;
  blankedText?: string;
  blanks?: Array<{ index: number; answer: string; hint: string }>;
  options?: string[];
  selectedAnswers?: string[];
  submitted?: boolean;
  level?: 'basic' | 'intermediate' | 'advanced';
  koreanText?: string;
}

export function DiaryLearnPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fns = getFunctions(undefined, 'asia-northeast3');

  const [step, setStep] = useState<'list' | 'detail' | 'learn'>('list');
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DiaryItem | null>(null);
  const [translatedSentences, setTranslatedSentences] = useState<string[]>([]);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [showGrammarDetails, setShowGrammarDetails] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [activeTab, setActiveTab] = useState<'korean' | 'english'>('korean');
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [highlightedWord, setHighlightedWord] = useState<{ key: string; index: number } | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [wordPopup, setWordPopup] = useState<{
    word: string;
    meaning: string;
    partOfSpeech: string;
    phonetic: string;
    koreanPronunciation: string;
    loading: boolean;
  } | null>(null);
  const [grammarPopup, setGrammarPopup] = useState<GrammarPopup | null>(null);
  const [quizPopup, setQuizPopup] = useState<QuizPopup | null>(null);

  // 오디오 잠금 해제 (안드로이드)
  useEffect(() => {
    const unlock = () => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        ctx.resume().then(() => ctx.close());
      }
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  // 일기 목록 불러오기
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const records = await firestoreService.getRecords(user.uid);
        const items: DiaryItem[] = records
          .filter((record: any) =>
            Array.isArray(record.formats) &&
            (record.formats.includes('일기') || record.formats.includes('에세이'))
          )
          .map((record: any) => {
            const format = record.formats?.find((f: string) => f === '일기' || f === '에세이');
            const prefix = format === '일기' ? 'diary' : 'essay';

            const title = record[`${prefix}_title`] || record.title || '제목 없음';

            // 메타 필드 + simple 필드는 한글 본문 추출에서 제외
            const excludeKeys = ['_title', '_ai_title', '_sayu', '_simple', '_mode', '_rating', '_style', '_polishedAt', '_images'];
            // 1순위: 한글 본문 필드들 (diary_오늘한일 등)
            let contentFields = Object.entries(record)
              .filter(([key]) =>
                key.startsWith(`${prefix}_`) &&
                !excludeKeys.some(ex => key.endsWith(ex)) &&
                !key.includes('image') &&
                !key.includes('url')
              )
              .filter(([, val]) =>
                typeof val === 'string' &&
                !(val as string).startsWith('http') &&
                !(val as string).startsWith('PREMIUM') &&
                !(val as string).startsWith('[')
              )
              .map(([, val]) => (val as string).trim())
              .filter(v => v.length > 0)
              .join('\n\n');
            // 2순위: 한글 필드가 비었으면 diary_simple 사용 (단, URL로 시작하지 않을 때만)
            if (!contentFields) {
              const simpleVal = record[`${prefix}_simple`];
              if (typeof simpleVal === 'string' && simpleVal.trim().length > 0 && !simpleVal.startsWith('http')) {
                contentFields = simpleVal.trim();
              }
            }

            return {
              id: record.id,
              date: record.date || record.id.split('_')[0],
              title,
              content: contentFields,
            };
          });
        setDiaries(items.filter(item => item.content && item.content.trim().length > 0));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // 영어 번역
  const handleTranslate = async () => {
    if (!selected) return;
    setTranslating(true);
    try {
      const fn = httpsCallable(fns, 'translateToEnglish');
      const res: any = await fn({ text: selected.content });
      const sentences: string[] = res.data.sentences || [res.data.translated];
      setTranslatedSentences(sentences);
      setActiveTab('english');
      setStep('learn');
    } catch (e) {
      console.error(e);
    } finally {
      setTranslating(false);
    }
  };

  // TTS
  const handleTTS = async (text: string, key: string) => {
    if (ttsPlaying === key) {
      audioRef.current?.pause();
      setTtsPlaying(null);
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      setHighlightedWord(null);
      return;
    }
    try {
      setTtsLoading(key);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio();
      audio.play().catch(() => {});
      audioRef.current = audio;
      const fn = httpsCallable(fns, 'generateTTS');
      const cacheKey = `diary_${key}_${text.slice(0, 20)}`;
      const res: any = await fn({ text, cacheKey });
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
        audio.src = audioSrc;
        audio.load();
        await audio.play();
        setTtsPlaying(key);
        // 단어 하이라이트 시작
        const words = text.trim().split(/\s+/);
        let wordIndex = 0;
        if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
        const startLoop = () => {
          const duration = audio.duration || words.length * 0.45;
          const interval = (duration * 1000) / words.length;
          highlightTimerRef.current = setInterval(() => {
            if (wordIndex >= words.length) {
              if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
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
        audio.onended = () => {
          if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
          setHighlightedWord(null);
          setTtsPlaying(null);
        };
      }
    } catch (e) {
      console.error('TTS 오류:', e);
    } finally {
      setTtsLoading(null);
    }
  };

  // 문법
  const handleGrammarClick = useCallback(async (text: string) => {
    setGrammarPopup({ verseText: text, loading: true });
    try {
      const fn = httpsCallable(fns, 'getGrammarExplain');
      const verseKey = `diary_grammar_${text.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
      const res: any = await fn({ verseText: text, verseKey });
      setGrammarPopup({
        verseText: text,
        loading: false,
        verb: res.data.verb,
        verb_example_en: res.data.verb_example_en,
        verb_example_ko: res.data.verb_example_ko,
        preposition: res.data.preposition,
        preposition_example_en: res.data.preposition_example_en,
        preposition_example_ko: res.data.preposition_example_ko,
        phrasal: res.data.phrasal,
        phrasal_example_en: res.data.phrasal_example_en,
        phrasal_example_ko: res.data.phrasal_example_ko,
        relative: res.data.relative,
        relative_example_en: res.data.relative_example_en,
        relative_example_ko: res.data.relative_example_ko,
        question: res.data.question,
        question_example_en: res.data.question_example_en,
        question_example_ko: res.data.question_example_ko,
        exclamation: res.data.exclamation,
        exclamation_example_en: res.data.exclamation_example_en,
        exclamation_example_ko: res.data.exclamation_example_ko,
        mysentence: res.data.mysentence,
        korean: res.data.korean,
      });
    } catch {
      setGrammarPopup({ verseText: text, loading: false });
    }
  }, [fns]);

  // 문법 팝업 닫을 때 토글 초기화
  const closeGrammarPopup = useCallback(() => {
    setGrammarPopup(null);
    setShowOriginalText(false);
    setShowGrammarDetails(false);
  }, []);

  // 퀴즈
  const handleQuizClick = useCallback(async (text: string, level: 'basic' | 'intermediate' | 'advanced' = 'basic') => {
    setQuizPopup({ verseText: text, loading: true, level });
    try {
      const fn = httpsCallable(fns, 'getVerseQuiz');
      const verseKey = `diary_quiz_${level}_${text.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
      const res: any = await fn({ verseText: text, verseKey, level });
      setQuizPopup({
        verseText: text,
        loading: false,
        blankedText: res.data.blankedText,
        blanks: res.data.blanks,
        options: res.data.options,
        selectedAnswers: new Array(res.data.blanks?.length || 0).fill(''),
        submitted: false,
        level,
        koreanText: res.data.koreanText,
      });
    } catch {
      setQuizPopup(null);
    }
  }, [fns]);

  // 단어 클릭
  const handleWordClick = useCallback(async (word: string) => {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (!cleanWord) return;
    setWordPopup({ word: cleanWord, meaning: '', partOfSpeech: '', phonetic: '', koreanPronunciation: '', loading: true });
    try {
      const fn = httpsCallable(fns, 'getWordMeaning');
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
  }, [fns]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF9F6' }}>
      {/* 상단 헤더 */}
      <div style={{
        backgroundColor: '#1A3C6E', color: '#fff',
        padding: '16px 20px', display: 'flex',
        alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => {
            if (step === 'learn') { setStep('detail'); setActiveTab('korean'); }
            else if (step === 'detail') setStep('list');
            else navigate(-1);
          }}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}
        >←</button>
        <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          {step === 'list' ? '✍️ 영어 일기 학습' : step === 'detail' ? selected?.title : '🇺🇸 영어 번역 학습'}
        </p>
      </div>

      <div style={{ padding: '20px 20px 40px' }}>

        {/* 일기 목록 */}
        {step === 'list' && (
          <div>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>일기 불러오는 중...</p>
            ) : diaries.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>작성한 일기/에세이가 없습니다</p>
            ) : (
              <>
                {diaries.slice(0, visibleCount).map(diary => (
                  <div
                    key={diary.id}
                    onClick={() => { setSelected(diary); setStep('detail'); }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px 0', borderBottom: '0.5px solid #e0e0e0', cursor: 'pointer',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{diary.date}</p>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#1A3C6E' }}>{diary.title}</p>
                    </div>
                    <span style={{ color: '#999', fontSize: 20 }}>›</span>
                  </div>
                ))}
                {visibleCount < diaries.length && (
                  <button
                    onClick={() => setVisibleCount(visibleCount + 10)}
                    style={{
                      width: '100%', padding: '14px',
                      marginTop: 16,
                      backgroundColor: '#EDE9F5', color: '#1A3C6E',
                      border: 'none', borderRadius: 12,
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    📖 더 보기 ({diaries.length - visibleCount}개 더 있음)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* 일기 원문 */}
        {step === 'detail' && selected && (
          <div>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{selected.date}</p>
            <div style={{
              backgroundColor: '#f8faff', borderRadius: 12,
              padding: 16, border: '1.5px solid #d0dff0',
              fontSize: 15, lineHeight: 1.9, color: '#333', marginBottom: 20,
            }}>
              {selected.content}
            </div>
            <button
              onClick={handleTranslate}
              disabled={translating}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: '#10b981', color: '#fff',
                border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {translating ? '번역 중... 🌐' : '🌐 영어로 번역하여 학습하기'}
            </button>
          </div>
        )}

        {/* 학습 화면 */}
        {step === 'learn' && selected && (
          <div>
            {/* 한국어/영어 탭 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['korean', 'english'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 20px', borderRadius: 20, border: 'none',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    backgroundColor: activeTab === tab ? '#1A3C6E' : '#eee',
                    color: activeTab === tab ? '#fff' : '#666',
                  }}
                >{tab === 'korean' ? '한국어 원문' : '영어 번역'}</button>
              ))}
            </div>

            {/* 한국어 원문 */}
            {activeTab === 'korean' && (
              <div style={{
                backgroundColor: '#f8faff', borderRadius: 12,
                padding: 16, border: '1.5px solid #d0dff0',
                fontSize: 15, lineHeight: 1.9, color: '#333',
              }}>
                {selected.content}
              </div>
            )}

            {/* 영어 번역 — 문장별 구조 */}
            {activeTab === 'english' && (
              <div>
                {/* 전체 듣기 */}
                <button
                  onClick={() => handleTTS(translatedSentences.join(' '), 'full')}
                  style={{
                    marginBottom: 16, padding: '10px 20px',
                    backgroundColor: ttsPlaying === 'full' ? '#8B4789' : '#1A3C6E',
                    color: '#fff', border: 'none', borderRadius: 20,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {ttsLoading === 'full' ? '⏳ 로딩 중...' : ttsPlaying === 'full' ? '⏸ 정지' : '🔊 전체 듣기'}
                </button>

                {/* 문장별 */}
                {translatedSentences.map((sentence, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#f8faff', borderRadius: 12,
                      padding: 14, marginBottom: 12,
                      border: '1.5px solid #d0dff0',
                    }}
                  >
                    <p style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>문장 {idx + 1}</p>
                    <p style={{ fontSize: 15, lineHeight: 1.9, color: '#333', marginBottom: 10 }}>
                      {sentence.split(' ').map((word, wIdx) => {
                        const isHighlighted = highlightedWord?.key === `s_${idx}` && highlightedWord?.index === wIdx;
                        return (
                          <span
                            key={wIdx}
                            onClick={() => handleWordClick(word)}
                            onMouseEnter={e => {
                              if (isHighlighted) return;
                              e.currentTarget.style.backgroundColor = '#1A3C6E';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.borderRadius = '4px';
                            }}
                            onMouseLeave={e => {
                              if (isHighlighted) return;
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#333';
                            }}
                            onTouchStart={e => {
                              if (isHighlighted) return;
                              e.currentTarget.style.backgroundColor = '#1A3C6E';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.borderRadius = '4px';
                            }}
                            onTouchEnd={e => {
                              if (isHighlighted) return;
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#333';
                            }}
                            style={{
                              cursor: 'pointer',
                              padding: '0 2px',
                              backgroundColor: isHighlighted ? '#dc2626' : 'transparent',
                              color: isHighlighted ? '#fff' : '#333',
                              borderRadius: isHighlighted ? '4px' : '0',
                              transition: 'background-color 0.15s, color 0.15s',
                            }}
                          >{word} </span>
                        );
                      })}
                    </p>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleTTS(sentence, `s_${idx}`)}
                        style={{
                          flex: 1, padding: '7px 4px',
                          backgroundColor: ttsPlaying === `s_${idx}` ? '#8B4789' : '#EDE9F5',
                          color: ttsPlaying === `s_${idx}` ? '#fff' : '#1A3C6E',
                          border: 'none', borderRadius: 8,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >{ttsLoading === `s_${idx}` ? '⏳' : ttsPlaying === `s_${idx}` ? '⏸ 정지' : '🔊 듣기'}</button>
                      <button
                        onClick={() => handleGrammarClick(sentence)}
                        style={{
                          flex: 1, padding: '7px 4px',
                          backgroundColor: '#EDE9F5', color: '#1A3C6E',
                          border: 'none', borderRadius: 8,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >✏️ 문법</button>
                      <button
                        onClick={() => handleQuizClick(sentence)}
                        style={{
                          flex: 1, padding: '7px 4px',
                          backgroundColor: '#EDE9F5', color: '#1A3C6E',
                          border: 'none', borderRadius: 8,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >🎯 퀴즈</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 단어 팝업 — 성경과 완전 동일 */}
      {wordPopup && (
        <div onClick={() => setWordPopup(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: '20px', margin: '0 16px', padding: '24px 24px 40px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>{wordPopup.word}</p>
              <button onClick={() => setWordPopup(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
            {wordPopup.loading ? (
              <p style={{ color: '#999', fontSize: 14 }}>뜻을 찾는 중...</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {wordPopup.partOfSpeech && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8B4789', backgroundColor: '#f0e6f6', padding: '3px 8px', borderRadius: 10 }}>
                      {wordPopup.partOfSpeech}
                    </span>
                  )}
                  {wordPopup.phonetic && (
                    <span style={{ fontSize: 13, color: '#666', backgroundColor: '#f5f5f5', padding: '3px 8px', borderRadius: 10 }}>
                      {wordPopup.phonetic}
                    </span>
                  )}
                  {wordPopup.koreanPronunciation && (
                    <span style={{ fontSize: 13, color: '#1A3C6E', backgroundColor: '#EDE9F5', padding: '3px 8px', borderRadius: 10 }}>
                      [{wordPopup.koreanPronunciation}]
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 18, color: '#333', fontWeight: 600, margin: '8px 0 16px' }}>{wordPopup.meaning}</p>
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

      {/* 문법 팝업 */}
      {grammarPopup && (
        <div
          onClick={closeGrammarPopup}
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
                onClick={closeGrammarPopup}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>

            <div style={{
              padding: '12px 14px', backgroundColor: '#f8faff',
              borderRadius: 8, marginBottom: 12, fontSize: 14,
              color: '#1A3C6E', lineHeight: 1.6, fontWeight: 600,
            }}>
              {grammarPopup.verseText.split(' ').map((word, wIdx) => (
                <span
                  key={wIdx}
                  onClick={() => handleWordClick(word)}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = '#1A3C6E';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderRadius = '4px';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#1A3C6E';
                  }}
                  onTouchStart={e => {
                    e.currentTarget.style.backgroundColor = '#1A3C6E';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderRadius = '4px';
                  }}
                  onTouchEnd={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#1A3C6E';
                  }}
                  style={{ cursor: 'pointer', padding: '0 2px' }}
                >{word} </span>
              ))}
            </div>

            {grammarPopup.loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: '#999', fontSize: 14 }}>분석 중... ✨</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                <button
                  onClick={() => setShowOriginalText(!showOriginalText)}
                  style={{
                    width: '100%', padding: '12px 14px',
                    backgroundColor: '#FEF3C7',
                    color: '#92400e',
                    border: '1px solid #FDE68A',
                    borderRadius: 10,
                    fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>📖 한국어 원문 보기</span>
                  <span>{showOriginalText ? '▲' : '▼'}</span>
                </button>
                {showOriginalText && selected && (
                  <div style={{
                    padding: '12px 14px', backgroundColor: '#FFFBEB',
                    borderRadius: 8, fontSize: 13,
                    color: '#333', lineHeight: 1.7,
                    border: '1px solid #FDE68A',
                  }}>
                    {selected.content}
                  </div>
                )}

                <button
                  onClick={() => setShowGrammarDetails(!showGrammarDetails)}
                  style={{
                    width: '100%', padding: '12px 14px',
                    backgroundColor: '#EFF6FF',
                    color: '#1e40af',
                    border: '1px solid #BFDBFE',
                    borderRadius: 10,
                    fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>✏️ 문법 보기</span>
                  <span>{showGrammarDetails ? '▲' : '▼'}</span>
                </button>

                {showGrammarDetails && (
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
            )}
          </div>
        </div>
      )}

      {/* 퀴즈 팝업 */}
      {quizPopup && (
        <div onClick={() => setQuizPopup(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: '20px', margin: '0 16px', padding: '24px 24px 40px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>🎯 빈칸 채우기 퀴즈</p>
              <button onClick={() => setQuizPopup(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
            {/* 난이도 선택 버튼 (loading 여부 관계없이 항상 표시) */}
            {!quizPopup.loading && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(['basic', 'intermediate', 'advanced'] as const).map(lv => (
                  <button
                    key={lv}
                    onClick={() => handleQuizClick(quizPopup.verseText, lv)}
                    style={{
                      flex: 1, padding: '8px 4px',
                      backgroundColor: quizPopup.level === lv ? '#1A3C6E' : '#f3f4f6',
                      color: quizPopup.level === lv ? '#fff' : '#555',
                      border: 'none', borderRadius: 8,
                      fontSize: 12, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {lv === 'basic' ? '🟢 초급' : lv === 'intermediate' ? '🟡 중급' : '🔴 고급'}
                  </button>
                ))}
              </div>
            )}
            {quizPopup.loading ? (
              <p style={{ textAlign: 'center', color: '#999', fontSize: 14, padding: '20px 0' }}>퀴즈 생성 중... 🎯</p>
            ) : (
              <div>
                <div style={{ backgroundColor: '#f8faff', borderRadius: 12, padding: 16, marginBottom: 20, border: '1.5px solid #d0dff0', lineHeight: 2, fontSize: 14, color: '#333' }}>
                  {quizPopup.blankedText?.split('_____').map((part, idx) => (
                    <span key={idx}>
                      {part}
                      {idx < (quizPopup.blanks?.length || 0) && (
                        <span style={{ display: 'inline-block', minWidth: 80, borderBottom: '2px solid #1A3C6E', textAlign: 'center', color: '#1A3C6E', fontWeight: 700, backgroundColor: quizPopup.selectedAnswers?.[idx] ? '#EDE9F5' : 'transparent', padding: '0 8px', marginBottom: -4 }}>
                          {quizPopup.selectedAnswers?.[idx] || ' '}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {quizPopup.blanks?.map((blank, idx) => (
                    <span key={idx} style={{ fontSize: 11, color: '#8B4789', backgroundColor: '#f0e6f6', padding: '3px 8px', borderRadius: 10 }}>
                      빈칸{idx + 1}: {blank.hint}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', marginBottom: 10 }}>보기에서 선택하세요:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {quizPopup.options?.map((option, idx) => {
                    const isUsed = quizPopup.selectedAnswers?.includes(option);
                    return (
                      <button
                        key={idx}
                        disabled={isUsed || quizPopup.submitted}
                        onClick={() => {
                          const emptyIdx = quizPopup.selectedAnswers?.findIndex(a => a === '') ?? -1;
                          if (emptyIdx === -1) return;
                          const newAnswers = [...(quizPopup.selectedAnswers || [])];
                          newAnswers[emptyIdx] = option;
                          setQuizPopup(prev => prev ? { ...prev, selectedAnswers: newAnswers } : null);
                        }}
                        style={{
                          padding: '8px 16px', borderRadius: 20,
                          border: '1.5px solid #d0dff0',
                          backgroundColor: isUsed ? '#eee' : '#f8faff',
                          color: isUsed ? '#bbb' : '#1A3C6E',
                          fontSize: 13, fontWeight: 600, cursor: isUsed ? 'default' : 'pointer',
                        }}
                      >{option}</button>
                    );
                  })}
                </div>
                {quizPopup.selectedAnswers?.every(a => a !== '') && !quizPopup.submitted && (
                  <button
                    onClick={() => setQuizPopup(prev => prev ? { ...prev, submitted: true } : null)}
                    style={{ width: '100%', padding: 14, backgroundColor: '#1A3C6E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                  >정답 확인</button>
                )}
                {quizPopup.submitted && (
                  <div style={{ marginTop: 16 }}>
                    {quizPopup.blanks?.map((blank, idx) => {
                      const correct = quizPopup.selectedAnswers?.[idx] === blank.answer;
                      return (
                        <p key={idx} style={{ fontSize: 14, marginBottom: 6, color: correct ? '#10b981' : '#e53e3e' }}>
                          빈칸{idx + 1}: {correct ? '✅ 정답!' : `❌ 오답 (정답: ${blank.answer})`}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
