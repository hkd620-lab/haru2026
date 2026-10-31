import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReadingAiChat } from '../hooks/useReadingAiChat';
import { buildExternalReadingPrompt, importExternalReadingAnswer, mergeInAppReadingReference, parseReadingAiReference, READING_EXTERNAL_SOURCES } from '../services/readingAiCore';
import type { ReadingAiContext } from '../types/readingAi';

const button: CSSProperties = { padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#1a3c6e', cursor: 'pointer', fontSize: 13 };
const textarea: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', font: 'inherit', fontSize: 14, resize: 'vertical' };
const QUICK_QUESTIONS = ['쉽게 설명해줘', '이 부분의 핵심은?', '왜 이렇게 말했을까?', '앞에서 읽은 내용과 연결해줘', '반대 의견은?', '실제 사례를 들어줘', '내가 이해한 것이 맞는지 봐줘', '이 부분에 대해 질문해줘'];

export function ReadingAiChat({ uid, bookId, entryId, context, reference, disabled, onBusy, onApply, onClearReference, onAddThought }: {
  uid: string; bookId: string; entryId: string; context: ReadingAiContext; reference?: string; disabled: boolean;
  onBusy: (busy: boolean) => void;
  onApply: (selected: Array<{ question: string; answer: string }>, memo: string) => void;
  onClearReference: () => void; onAddThought: () => void;
}) {
  const chat = useReadingAiChat(uid, bookId, entryId, context);
  const [open, setOpen] = useState(chat.messages.length > 0 || !!chat.question || !!chat.externalAnswer);
  const [applied, setApplied] = useState(false);
  const [externalOpen, setExternalOpen] = useState(!!chat.externalAnswer);
  const [externalFeedback, setExternalFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [applyError, setApplyError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const savedReference = parseReadingAiReference(reference, bookId);
  useEffect(() => { onBusy(chat.busy); return () => onBusy(false); }, [chat.busy, onBusy]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat.messages.length, open]);
  const locked = disabled || chat.busy;
  async function copyExternalQuestion() {
    try {
      const prompt = buildExternalReadingPrompt(context, chat.question);
      await navigator.clipboard.writeText(prompt);
      setExternalFeedback({ error: false, text: '질문과 현재 작성 내용을 복사했습니다. 외부 AI에 붙여넣어 질문한 뒤 답변을 가져와 주세요.' });
    } catch (error) {
      setExternalFeedback({ error: true, text: error instanceof Error && !chat.question.trim() ? error.message : '복사하지 못했습니다. 질문을 직접 선택해 복사해 주세요.' });
    }
  }
  function importExternalAnswer() {
    try {
      if (!uid) throw new Error('로그인 후 답변을 가져와 주세요.');
      if (!context.bookTitle.trim()) throw new Error('책 제목을 먼저 입력해 주세요.');
      const imported = importExternalReadingAnswer(reference, bookId, chat.question, chat.externalAnswer, chat.externalSource);
      onApply(imported.selectedAnswers, imported.aiMemo);
      chat.setExternalAnswer('');
      setExternalFeedback({ error: false, text: '외부 AI 답변을 별도 참고자료로 반영했습니다. 독서장 추가하기로 저장해 주세요.' });
    } catch (error) {
      setExternalFeedback({ error: true, text: error instanceof Error ? error.message : '답변을 가져오지 못했습니다. 입력 내용은 유지됩니다.' });
    }
  }
  return <section aria-label="AI 독서대화" style={{ margin: '16px 0', padding: 16, border: '1px solid #d0dff0', borderRadius: 10, background: '#f5f8ff' }}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} style={{ ...button, fontWeight: 700 }}>💬 {open ? 'AI 독서대화 접기' : 'AI에게 물어보기'}</button>
    {open && <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 12, color: '#58677d', margin: '0 0 12px' }}>본문 없이도 독서 중 궁금한 점을 질문할 수 있습니다. 본문이 있으면 같은 책의 독서기록과 함께 참고합니다. 질문·참고 메모 제안은 각각 월간 AI 도움 1회를 사용합니다.</p>
      {context.currentBookText.length > 12000 && <p role="status" style={{ fontSize: 12 }}>본문이 길어 가장 최근 12,000자를 참고합니다.</p>}
      <div role="log" aria-label="독서대화 내용" aria-live="polite" style={{ maxHeight: 380, overflowY: 'auto' }}>
        {chat.messages.map((message) => <div key={message.id} style={{ background: message.role === 'user' ? '#e8efff' : '#fff', padding: 12, borderRadius: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 12 }}>{message.role === 'user' ? '내 질문' : 'AI 답변 · 참고'}</strong>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '6px 0', fontSize: 14 }}>{message.content}</p>
          {message.role === 'assistant' && <label style={{ fontSize: 12 }}><input type="checkbox" checked={chat.selectedIds.includes(message.id)} disabled={locked} onChange={() => { chat.toggleAnswer(message.id); setApplied(false); }} /> 독서장 참고자료로 선택</label>}
        </div>)}
        {chat.busy && <p role="status">AI가 독서기록을 살펴보고 있습니다…</p>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {QUICK_QUESTIONS.slice(0, 4).map((question) => <button type="button" key={question} style={{ ...button, padding: '6px 9px', fontSize: 12 }} disabled={locked} onClick={() => chat.setQuestion(question)}>{question}</button>)}
        <details style={{ width: '100%', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer' }}>다른 빠른 질문</summary>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {QUICK_QUESTIONS.slice(4).map((question) => <button type="button" key={question} style={{ ...button, padding: '6px 9px', fontSize: 12 }} disabled={locked} onClick={() => chat.setQuestion(question)}>{question}</button>)}
          </div>
        </details>
      </div>
      <label style={{ display: 'block', fontSize: 13 }}>자유롭게 질문하기
        <textarea aria-label="독서 AI 질문" style={{ ...textarea, marginTop: 6, lineHeight: '21px', resize: 'none' }} value={chat.question} maxLength={1000} rows={3} disabled={locked} onChange={(e) => chat.setQuestion(e.target.value)} placeholder="본문이 없어도 독서 중 궁금한 점을 질문해 주세요." />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" style={button} disabled={locked} onClick={() => void chat.send()}>질문 보내기</button>
        <button type="button" style={button} disabled={locked || !chat.selected.length} onClick={() => { setApplied(false); void chat.propose(); }}>선택한 답변을 독서장에 반영</button>
        <button type="button" style={button} disabled={locked} onClick={onAddThought}>내 생각 추가</button>
        <button type="button" style={button} disabled={locked || !chat.messages.length} onClick={() => {
          if (window.confirm('이 책의 임시 대화를 삭제할까요? 직접 작성한 독서장과 이미 저장한 기록은 유지됩니다.')) { chat.clear(); onClearReference(); setApplied(false); }
        }}>대화 삭제</button>
      </div>
      <details open={externalOpen} onToggle={(event) => setExternalOpen(event.currentTarget.open)} style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#1a3c6e' }}>외부 AI에 질문하고 답변 가져오기</summary>
        <p style={{ fontSize: 12 }}>위 질문과 현재 본문·독서장을 복사해 원하는 AI에 직접 전달할 수 있습니다. 가져온 답변은 내 생각과 구분한 참고자료로 반영하며, 가져오기 자체는 월간 AI 도움을 사용하지 않습니다.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button type="button" style={button} disabled={locked} onClick={() => void copyExternalQuestion()}>외부 AI용 질문 복사</button>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" style={button}>ChatGPT 열기</a>
          <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" style={button}>Gemini 열기</a>
          <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer" style={button}>Claude 열기</a>
        </div>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>답변 출처{' '}
          <select aria-label="외부 AI 답변 출처" value={chat.externalSource} disabled={locked} onChange={(e) => chat.setExternalSource(e.target.value)} style={button}>
            {READING_EXTERNAL_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
        </label>
        <label style={{ display: 'block', fontSize: 13 }}>외부 AI 답변 (최대 3,000자)
          <textarea aria-label="외부 AI 답변" rows={4} style={{ ...textarea, marginTop: 6 }} value={chat.externalAnswer} disabled={locked} onChange={(e) => { chat.setExternalAnswer(e.target.value); setExternalFeedback(null); }} placeholder="외부 AI 답변을 여기에 붙여넣으세요." />
        </label>
        <p style={{ fontSize: 12 }}>위 질문도 함께 반영됩니다. 답변만 가져오려면 질문 칸을 비워 두세요. 반영 후 ‘독서장 추가하기’를 눌러야 저장됩니다.</p>
        <button type="button" style={button} disabled={locked} onClick={importExternalAnswer}>외부 AI 답변 가져오기</button>
        {externalFeedback && <p role={externalFeedback.error ? 'alert' : 'status'} style={{ fontSize: 12, color: externalFeedback.error ? '#b91c1c' : '#58677d' }}>{externalFeedback.text}</p>}
      </details>
      {chat.error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{chat.error}</p>}
      {chat.storageError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>이 기기에 임시 대화를 보관할 수 없습니다. 닫기 전에 필요한 내용을 독서장에 반영해 주세요.</p>}
      {chat.usage && <p style={{ color: '#58677d', fontSize: 12 }}>이번 달 AI 도움 {chat.usage.used}/{chat.usage.limit}회 · 남은 {chat.usage.remaining}회</p>}
      {!!chat.proposal && !applied && <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8 }}>
        <strong style={{ fontSize: 13 }}>반영할 내용 확인</strong>
        <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>내가 던진 질문: {chat.selected.map((a) => a.question).join('\n')}</p>
        <label style={{ fontSize: 13 }}>AI 참고 메모 · 내 생각과 별도 저장
          <textarea aria-label="AI 참고 메모 제안" rows={4} maxLength={4000} style={{ ...textarea, marginTop: 6 }} value={chat.proposal} onChange={(e) => chat.setProposal(e.target.value)} />
        </label>
        <p style={{ fontSize: 12 }}>질문은 아래 독서장에 추가되고, AI 메모는 별도 참고자료로 남습니다. 아직 SAYU에 저장되지 않습니다. 내 생각은 독서장에 직접 덧붙여 주세요.</p>
        <button type="button" style={button} disabled={locked} onClick={() => {
          setApplyError('');
          try {
            const merged = mergeInAppReadingReference(reference, bookId, chat.selected, chat.proposal);
            onApply(merged.selected, merged.aiMemo);
            setApplied(true);
          } catch (error) {
            setApplyError(error instanceof Error ? error.message : '참고자료를 반영하지 못했습니다. 기존 자료와 제안은 유지됩니다.');
          }
        }}>확인 후 독서장에 반영</button>
        {applyError && <p role="alert" style={{ fontSize: 12, color: '#b91c1c' }}>{applyError}</p>}
      </div>}
      {savedReference && <div style={{ fontSize: 12, marginTop: 12 }}>
        <p role="status">질문 {savedReference.questions.length}개와 AI 참고자료가 반영되었습니다. 아래 독서장을 수정한 뒤 ‘독서장 추가하기’로 저장하세요.</p>
        <details>
          <summary style={{ cursor: 'pointer' }}>반영한 AI 참고자료 확인</summary>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{savedReference.aiMemo}</p>
        </details>
      </div>}
    </div>}
  </section>;
}
