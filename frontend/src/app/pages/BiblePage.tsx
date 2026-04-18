import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import genesisData from '../../data/genesis_1.json';

interface Verse {
  verse: number;
  text: string;
}

export function BiblePage() {
  const navigate = useNavigate();
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 문법 팝업
  const [grammarPopup, setGrammarPopup] = useState<{
    verseText: string;
    sentenceStructure?: {
      subject: string;
      verb: string;
      object: string;
      complement: string;
      pattern: string;
    };
    details?: Array<{ word: string; role: string; explanation: string }>;
    keyPoints?: Array<{ title: string; explanation: string }>;
    loading: boolean;
  } | null>(null);

  const handleGrammarClick = useCallback(async (verse: Verse) => {
    setGrammarPopup({ verseText: verse.text, points: [], loading: true });
    try {
      const { getFunctions: gf, httpsCallable: hc } = await import('firebase/functions');
      const fns = gf(undefined, 'asia-northeast3');
      const fn = hc(fns, 'getGrammarExplain');
      const res: any = await fn({
        verseKey: `genesis_1_${verse.verse}`,
        verseText: verse.text,
      });
      setGrammarPopup({
        verseText: verse.text,
        sentenceStructure: res.data.sentenceStructure,
        details: res.data.details || [],
        keyPoints: res.data.keyPoints || [],
        loading: false,
      });
    } catch {
      setGrammarPopup({ verseText: verse.text, details: [], keyPoints: [], loading: false });
    }
  }, []);

  // 퀴즈 팝업
  const [quizPopup, setQuizPopup] = useState<{
    verseText: string;
    blankedText: string;
    blanks: Array<{ index: number; answer: string; hint: string }>;
    options: string[];
    selectedAnswers: string[];
    submitted: boolean;
    loading: boolean;
  } | null>(null);

  const handleQuizClick = useCallback(async (verse: Verse) => {
    setQuizPopup({
      verseText: verse.text,
      blankedText: '',
      blanks: [],
      options: [],
      selectedAnswers: [],
      submitted: false,
      loading: true,
    });
    try {
      const { getFunctions: gf, httpsCallable: hc } = await import('firebase/functions');
      const fns = gf(undefined, 'asia-northeast3');
      const fn = hc(fns, 'getVerseQuiz');
      const res: any = await fn({
        verseKey: `genesis_1_${verse.verse}`,
        verseText: verse.text,
      });
      setQuizPopup({
        verseText: verse.text,
        blankedText: res.data.blankedText || '',
        blanks: res.data.blanks || [],
        options: res.data.options || [],
        selectedAnswers: new Array(res.data.blanks?.length || 0).fill(''),
        submitted: false,
        loading: false,
      });
    } catch {
      setQuizPopup(null);
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

  const renderVerseWithWords = (text: string) => {
    const words = text.split(' ');
    return (
      <p style={{ fontSize: 13, color: '#333', lineHeight: 1.8, margin: 0, flexWrap: 'wrap', display: 'flex', gap: '4px' }}>
        {words.map((word, idx) => (
          <span
            key={idx}
            onClick={(e) => { e.stopPropagation(); handleWordClick(word); }}
            style={{
              cursor: 'pointer',
              borderRadius: 4,
              padding: '0 2px',
              transition: 'background 0.15s',
              backgroundColor: 'transparent',
            }}
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
          >
            {word}
          </span>
        ))}
      </p>
    );
  };

  const handleTTS = async (text: string, key: string) => {
    if (ttsPlaying === key) {
      audioRef.current?.pause();
      setTtsPlaying(null);
      return;
    }
    setTtsLoading(key);
    try {
      const cacheKey = `bible_genesis_1_${key}`.slice(0, 80);
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'generateTTS');
      const res: any = await fn({ text, cacheKey });
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
        audioRef.current = new Audio(audioSrc);
        audioRef.current.onended = () => { setTtsPlaying(null); };
        await audioRef.current.play();
        setTtsPlaying(key);
      }
    } catch (err) {
      console.error('TTS 오류:', err);
    } finally {
      setTtsLoading(null);
    }
  };

  const handleFullChapterTTS = () => {
    const fullText = genesisData.verses.map(v => v.text).join(' ');
    handleTTS(fullText, 'full_chapter');
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

      {/* 1장 전체 듣기 버튼 */}
      <div style={{ padding: '16px', backgroundColor: '#EDE9F5' }}>
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
          {ttsLoading === 'full_chapter' ? '⏳ 로딩 중...' : ttsPlaying === 'full_chapter' ? '⏸ 정지' : '🔊 1장 전체 듣기'}
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
                  renderVerseWithWords(verse.text)
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
              <div style={{ padding: '8px 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* 절 듣기 */}
                <button
                  onClick={() => handleTTS(verse.text, `verse_${verse.verse}`)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none',
                    backgroundColor: ttsPlaying === `verse_${verse.verse}` ? '#8B4789' : '#EDE9F5',
                    color: ttsPlaying === `verse_${verse.verse}` ? '#fff' : '#1A3C6E',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {ttsLoading === `verse_${verse.verse}` ? '⏳' : ttsPlaying === `verse_${verse.verse}` ? '⏸ 정지' : '🔊 듣기'}
                </button>
                {/* 단어 학습 (준비 중) */}
                <button style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: '1px solid #d0dff0', backgroundColor: '#f8faff',
                  color: '#1A3C6E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  📝 단어
                </button>
                {/* 문법 */}
                <button
                  onClick={() => handleGrammarClick(verse)}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: '1px solid #d0dff0', backgroundColor: '#f8faff',
                    color: '#1A3C6E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  📚 문법
                </button>
                {/* 퀴즈 */}
                <button
                  onClick={() => handleQuizClick(verse)}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: '1px solid #d0dff0', backgroundColor: '#f8faff',
                    color: '#1A3C6E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  🎯 퀴즈
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

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
              maxHeight: '75vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>
                📚 문법 해설
              </p>
              <button
                onClick={() => setGrammarPopup(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>
            <div style={{
              padding: '10px 14px', backgroundColor: '#f8faff',
              borderRadius: 8, marginBottom: 16, fontSize: 12,
              color: '#555', lineHeight: 1.6,
            }}>
              {grammarPopup.verseText}
            </div>
            {grammarPopup.loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: '#999', fontSize: 14 }}>문법 분석 중... ✨</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* 문장 구조 */}
                {grammarPopup.sentenceStructure && (
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#1A3C6E', marginBottom: 10 }}>
                      📐 문장 구조
                    </p>
                    <div style={{ backgroundColor: '#f8faff', borderRadius: 10, padding: 14, border: '1px solid #d0dff0' }}>
                      {grammarPopup.sentenceStructure.subject && (
                        <p style={{ fontSize: 13, margin: '0 0 6px' }}>
                          <span style={{ fontWeight: 700, color: '#1A3C6E' }}>• 주어(S): </span>
                          <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.subject}</span>
                        </p>
                      )}
                      {grammarPopup.sentenceStructure.verb && (
                        <p style={{ fontSize: 13, margin: '0 0 6px' }}>
                          <span style={{ fontWeight: 700, color: '#10b981' }}>• 동사(V): </span>
                          <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.verb}</span>
                        </p>
                      )}
                      {grammarPopup.sentenceStructure.object && (
                        <p style={{ fontSize: 13, margin: '0 0 6px' }}>
                          <span style={{ fontWeight: 700, color: '#8B4789' }}>• 목적어(O): </span>
                          <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.object}</span>
                        </p>
                      )}
                      {grammarPopup.sentenceStructure.complement && (
                        <p style={{ fontSize: 13, margin: '0 0 6px' }}>
                          <span style={{ fontWeight: 700, color: '#f59e0b' }}>• 보어/부사구: </span>
                          <span style={{ color: '#333' }}>{grammarPopup.sentenceStructure.complement}</span>
                        </p>
                      )}
                      {grammarPopup.sentenceStructure.pattern && (
                        <p style={{
                          fontSize: 12, color: '#1A3C6E', fontWeight: 700,
                          backgroundColor: '#EDE9F5', padding: '6px 10px',
                          borderRadius: 6, marginTop: 10, marginBottom: 0,
                        }}>
                          ➡️ {grammarPopup.sentenceStructure.pattern}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 세부 해설 */}
                {grammarPopup.details && grammarPopup.details.length > 0 && (
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#1A3C6E', marginBottom: 10 }}>
                      🔍 세부 해설
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {grammarPopup.details.map((detail, idx) => (
                        <div key={idx} style={{
                          backgroundColor: '#fafafa', borderRadius: 10,
                          padding: 14, border: '1px solid #e8e0f0',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{
                              backgroundColor: '#8B4789', color: '#fff',
                              borderRadius: 6, padding: '2px 8px',
                              fontSize: 12, fontWeight: 700,
                            }}>{detail.word}</span>
                            <span style={{ fontSize: 11, color: '#999' }}>{detail.role}</span>
                          </div>
                          <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, margin: 0 }}>
                            {detail.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 핵심 문법 포인트 */}
                {grammarPopup.keyPoints && grammarPopup.keyPoints.length > 0 && (
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#1A3C6E', marginBottom: 10 }}>
                      📌 핵심 문법 포인트
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {grammarPopup.keyPoints.map((kp, idx) => (
                        <div key={idx} style={{
                          backgroundColor: '#FDF6C3', borderRadius: 10,
                          padding: 14, border: '1px solid #f0e080',
                        }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', margin: '0 0 4px' }}>
                            • {kp.title}
                          </p>
                          <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, margin: 0 }}>
                            {kp.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
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
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', margin: 0 }}>
                🎯 빈칸 채우기 퀴즈
              </p>
              <button
                onClick={() => setQuizPopup(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>

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

                {/* 힌트 */}
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
