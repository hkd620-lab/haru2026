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
  text: string;
  loading: boolean;
  sentenceStructure?: { subject?: string; verb?: string; object?: string; complement?: string; pattern?: string };
  details?: { title: string; explanation: string; example?: string }[];
  keyPoints?: { point: string; description: string }[];
}

interface QuizPopup {
  text: string;
  loading: boolean;
  blankedText?: string;
  blanks?: { hint: string; answer: string }[];
  options?: string[];
  selectedAnswers?: string[];
  submitted?: boolean;
}

export function DiaryLearnPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fns = getFunctions(undefined, 'asia-northeast3');

  const [step, setStep] = useState<'list' | 'detail' | 'learn'>('list');
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DiaryItem | null>(null);
  const [translatedSentences, setTranslatedSentences] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);
  const [activeTab, setActiveTab] = useState<'korean' | 'english'>('korean');
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [wordPopup, setWordPopup] = useState<{
    word: string;
    meaning: string;
    partOfSpeech: string;
    phonetic: string;
    koreanPronunciation: string;
    loading: boolean;
  } | null>(null);
  const [wordMode, setWordMode] = useState<number | null>(null);
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

            const excludeKeys = ['_title', '_sayu', '_mode', '_rating', '_style', '_polishedAt', '_images'];
            const contentFields = Object.entries(record)
              .filter(([key]) =>
                key.startsWith(`${prefix}_`) &&
                !excludeKeys.some(ex => key.endsWith(ex)) &&
                !key.includes('image')
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

            return {
              id: record.id,
              date: record.date || record.id.split('_')[0],
              title,
              content: contentFields || '내용 없음',
            };
          });
        setDiaries(items);
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
        audio.onended = () => setTtsPlaying(null);
      }
    } catch (e) {
      console.error('TTS 오류:', e);
    } finally {
      setTtsLoading(null);
    }
  };

  // 문법
  const handleGrammarClick = useCallback(async (text: string) => {
    setGrammarPopup({ text, loading: true });
    try {
      const fn = httpsCallable(fns, 'getGrammarExplain');
      const verseKey = `diary_grammar_${text.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
      const res: any = await fn({ verseText: text, verseKey });
      setGrammarPopup({
        text,
        loading: false,
        sentenceStructure: res.data.sentenceStructure,
        details: res.data.details,
        keyPoints: res.data.keyPoints,
      });
    } catch {
      setGrammarPopup({ text, loading: false, details: [], keyPoints: [] });
    }
  }, [fns]);

  // 퀴즈
  const handleQuizClick = useCallback(async (text: string) => {
    setQuizPopup({ text, loading: true });
    try {
      const fn = httpsCallable(fns, 'getVerseQuiz');
      const verseKey = `diary_quiz_${text.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
      const res: any = await fn({ verseText: text, verseKey });
      setQuizPopup({
        text,
        loading: false,
        blankedText: res.data.blankedText,
        blanks: res.data.blanks,
        options: res.data.options,
        selectedAnswers: new Array(res.data.blanks?.length || 0).fill(''),
        submitted: false,
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
              diaries.map(diary => (
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
              ))
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
                      {sentence.split(' ').map((word, wIdx) => (
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
                            e.currentTarget.style.color = '#333';
                          }}
                          onTouchStart={e => {
                            e.currentTarget.style.backgroundColor = '#1A3C6E';
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.borderRadius = '4px';
                          }}
                          onTouchEnd={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#333';
                          }}
                          style={{ cursor: 'pointer', padding: '0 2px' }}
                        >{word} </span>
                      ))}
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
                        onClick={() => setWordMode(wordMode === idx ? null : idx)}
                        style={{
                          flex: 1, padding: '7px 4px',
                          backgroundColor: wordMode === idx ? '#1A3C6E' : '#EDE9F5',
                          color: wordMode === idx ? '#fff' : '#1A3C6E',
                          border: 'none', borderRadius: 8,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >📖 단어</button>
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
                    {wordMode === idx && (
                      <div style={{ marginTop: 8, lineHeight: 2.2, fontSize: 15, color: '#333' }}>
                        {sentence.split(' ').map((word, wIdx) => (
                          <span
                            key={wIdx}
                            onClick={() => handleWordClick(word.replace(/[^a-zA-Z]/g, ''))}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#1A3C6E';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.borderRadius = '4px';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#333';
                            }}
                            onTouchStart={e => {
                              e.currentTarget.style.backgroundColor = '#1A3C6E';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.borderRadius = '4px';
                            }}
                            onTouchEnd={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#333';
                            }}
                            style={{ cursor: 'pointer', padding: '0 3px' }}
                          >{word} </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 단어 팝업 — 성경과 완전 동일 */}
      {wordPopup && (
        <div onClick={() => setWordPopup(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div onClick={() => setGrammarPopup(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: '20px', margin: '0 16px', padding: '24px 24px 40px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>✏️ 문법 설명</p>
              <button onClick={() => setGrammarPopup(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
            <div style={{ backgroundColor: '#f8faff', borderRadius: 12, padding: 14, marginBottom: 16, border: '1.5px solid #d0dff0', fontSize: 14, color: '#333', lineHeight: 1.8 }}>
              {grammarPopup.text}
            </div>
            {grammarPopup.loading ? (
              <p style={{ textAlign: 'center', color: '#999', fontSize: 14 }}>문법 분석 중... ✏️</p>
            ) : (
              <div>
                {grammarPopup.sentenceStructure && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>문장 구조</p>
                    {grammarPopup.sentenceStructure.subject && <p style={{ fontSize: 13, marginBottom: 4 }}>주어: <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.subject}</span></p>}
                    {grammarPopup.sentenceStructure.verb && <p style={{ fontSize: 13, marginBottom: 4 }}>동사: <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.verb}</span></p>}
                    {grammarPopup.sentenceStructure.object && <p style={{ fontSize: 13, marginBottom: 4 }}>목적어: <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.object}</span></p>}
                    {grammarPopup.sentenceStructure.complement && <p style={{ fontSize: 13, marginBottom: 4 }}>보어: <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.complement}</span></p>}
                    {grammarPopup.sentenceStructure.pattern && <p style={{ fontSize: 13, color: '#8B4789', marginTop: 6 }}>➡️ {grammarPopup.sentenceStructure.pattern}</p>}
                  </div>
                )}
                {grammarPopup.details && grammarPopup.details.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>상세 설명</p>
                    {grammarPopup.details.map((d: any, i: number) => (
                      <div key={i} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: '3px solid #EDE9F5' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 2 }}>
                          {d.title || d.word || ''}
                        </p>
                        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
                          {d.explanation || ''}
                        </p>
                        {d.role && <p style={{ fontSize: 12, color: '#8B4789', marginTop: 4 }}>역할: {d.role}</p>}
                        {d.example && <p style={{ fontSize: 12, color: '#8B4789', marginTop: 4 }}>예: {d.example}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {grammarPopup.keyPoints && grammarPopup.keyPoints.length > 0 && (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>핵심 포인트</p>
                    {grammarPopup.keyPoints.map((kp: any, i: number) => (
                      <div key={i} style={{ marginBottom: 8, backgroundColor: '#f0e6f6', borderRadius: 8, padding: '10px 14px', border: '1px solid #d9c2f0' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#5a1e8c', marginBottom: 4 }}>
                          {kp.point || kp.title || ''}
                        </p>
                        <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
                          {kp.description || kp.explanation || ''}
                        </p>
                      </div>
                    ))}
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
