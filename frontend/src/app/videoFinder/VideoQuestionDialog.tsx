import { useRef, useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { createNonce } from './videoFinderBridge';
import { VIDEO_FINDER_AI_CONSENT_VERSION, friendlyErrorMessage, youtubeWatchUrl, type VideoFinderAccess, type VideoFinderClient } from './videoFinderModel';

export type VideoQuestionTarget = { videoId: string; title: string };

type Turn = { requestId: string; question: string; answer: string; timestamps: number[]; needsClarification?: boolean };
type Props = {
  video: VideoQuestionTarget;
  access: VideoFinderAccess;
  client: VideoFinderClient;
  haruOrigin: string;
  onAccess: (access: VideoFinderAccess) => void;
  onClose: () => void;
  onPrepareNote: (text: string) => Promise<void>;
};

const questions = ['핵심을 세 줄로 알려줘', '중요한 용어를 쉽게 설명해 줘', '어느 장면부터 보면 좋을까?'];
const secondary = 'min-h-[44px] rounded-lg border border-[#9fb39a] bg-white px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 disabled:opacity-60';
const primary = 'min-h-[44px] rounded-lg bg-[#285843] px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 disabled:opacity-60';

function timeLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VideoQuestionDialog({ video, access, client, haruOrigin, onAccess, onClose, onPrepareNote }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [acceptingAi, setAcceptingAi] = useState(false);
  const [pending, setPending] = useState(false);
  const [preparingNote, setPreparingNote] = useState(false);
  const [error, setError] = useState('');
  const lastAttempt = useRef<{ question: string; id: string } | undefined>(undefined);
  const sending = useRef(false);
  const eligible = access.questionAccess === 'ready';
  const hasQuestions = access.remainingQuestions > 0;

  async function acceptAiConsent() {
    setAcceptingAi(true);
    setError('');
    try {
      onAccess(await client.acceptAiConsent(VIDEO_FINDER_AI_CONSENT_VERSION));
    } catch (error) {
      setError(friendlyErrorMessage(error));
    } finally {
      setAcceptingAi(false);
    }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!eligible || !access.aiConsentAccepted || !hasQuestions || !text || sending.current) return;
    sending.current = true;
    setPending(true);
    setError('');
    try {
      const requestId = lastAttempt.current?.question === text ? lastAttempt.current.id : createNonce();
      lastAttempt.current = { question: text, id: requestId };
      const previousRequestIds = turns.filter((turn) => !turn.needsClarification).slice(-3).map((turn) => turn.requestId);
      const { answer, timestamps, needsClarification, status } = await client.askQuestion({ requestId, videoId: video.videoId, question: text, previousRequestIds });
      lastAttempt.current = undefined;
      setTurns((current) => [...current, { requestId, question: text, answer, timestamps, needsClarification }]);
      setQuestion((current) => current.trim() === text ? '' : current);
      onAccess(status);
    } catch (error) {
      setError(friendlyErrorMessage(error));
      void client.accessStatus().then(onAccess).catch(() => undefined);
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  async function prepareNote() {
    if (!note?.trim()) return;
    setPreparingNote(true);
    setError('');
    try {
      await onPrepareNote(note.trim());
    } catch (error) {
      setError(friendlyErrorMessage(error));
    } finally {
      setPreparingNote(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88dvh] min-w-0 overflow-y-auto bg-white text-[#27332e] sm:max-w-xl">
        <DialogTitle className="pr-6 text-xl leading-7">이 영상에 질문하기</DialogTitle>
        <DialogDescription className="break-words text-base">{video.title}</DialogDescription>
        {eligible && !access.aiConsentAccepted ? (
          <section className="space-y-3 text-base leading-7" aria-label="AI 질문 개인정보 국외 이전 동의">
            <p>질문을 보낼 때 질문과 필요한 이전 답변, 공개 영상 주소를 Google Gemini에 국외 전송해 답변을 받습니다. Google은 서비스 악용 방지 등을 위해 입력 내용과 답변을 55일간 보관합니다.</p>
            <p>동의 여부와 관계없이 영상 검색, 시청, 보관함을 이용할 수 있어요. 보관함의 ‘내 기록 관리’에서 철회할 수 있어요.</p>
            <a className="block font-semibold underline underline-offset-4" href={`${haruOrigin}/privacy#video-finder-ai`} target="_blank" rel="noopener noreferrer">AI 질문 개인정보 처리 안내 ↗</a>
            <button type="button" className={primary} disabled={acceptingAi} onClick={() => void acceptAiConsent()}>
              {acceptingAi ? '동의를 저장하는 중…' : '동의하고 AI 질문 열기'}
            </button>
          </section>
        ) : eligible ? (
          <>
            <p className="text-base leading-7">
              오늘 질문 <strong>{access.remainingQuestions}회</strong> · 이번 구독 기간 분석 <strong>{Math.floor(access.remainingAnalysisSeconds / 60)}분 {access.remainingAnalysisSeconds % 60}초</strong> 남았어요.
            </p>
            <p className="text-sm leading-6">이전 질문과 답변은 1시간 동안 후속 질문에 참고해요. 질문에 개인정보를 넣지 마세요.</p>
            {turns.length > 0 && (
              <ol className="space-y-3" aria-live="polite" aria-label="영상 질문과 답변">
                {turns.map((turn) => (
                  <li key={turn.requestId} className="min-w-0 space-y-2 rounded-xl bg-[#f7faed] p-3">
                    <p className="break-words font-bold">{turn.question}</p>
                    <p className="whitespace-pre-wrap break-words leading-7">{turn.answer}</p>
                    {turn.timestamps.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {turn.timestamps.map((time) => (
                          <a key={time} className={secondary} href={youtubeWatchUrl(video.videoId, time)} target="_blank" rel="noopener noreferrer"
                            aria-label={`YouTube ${timeLabel(time)} 장면 열기 (새 창)`}>{timeLabel(time)} ↗</a>
                        ))}
                      </div>
                    )}
                    {!turn.needsClarification && (
                      <button type="button" className={secondary} onClick={() => setNote(turn.answer.slice(0, 2000))}>답변을 메모로 옮기기</button>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {note !== null && (
              <div className="space-y-2 rounded-xl border border-[#e6d9b8] bg-[#fffaf0] p-3">
                <label htmlFor="vf-question-note" className="font-bold">내 말로 정리하기</label>
                <textarea id="vf-question-note" className="w-full rounded-lg border border-[#9fb39a] bg-white p-2" rows={3}
                  maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primary} disabled={!note.trim() || preparingNote} onClick={() => void prepareNote()}>보관함 메모에 추가</button>
                  <button type="button" className={secondary} disabled={preparingNote} onClick={() => setNote(null)}>취소</button>
                </div>
              </div>
            )}
            {hasQuestions ? (
              <form onSubmit={ask} className="space-y-2">
                {turns.length === 0 && <div className="flex flex-wrap gap-2">
                  {questions.map((example) => <button key={example} type="button" className={secondary} disabled={pending}
                    onClick={() => setQuestion(example)}>{example}</button>)}
                </div>}
                <label htmlFor="vf-question" className="block font-bold">{turns.length ? '이어서 궁금한 점' : '영상에 대해 궁금한 점'}</label>
                <textarea id="vf-question" className="w-full rounded-lg border border-[#9fb39a] bg-white p-2" rows={2} maxLength={500}
                  value={question} onChange={(e) => setQuestion(e.target.value)} />
                <button type="submit" className={primary} disabled={pending || !question.trim()}>{pending ? '답변을 확인하는 중…' : '질문 보내기'}</button>
              </form>
            ) : <p role="status">오늘 질문을 모두 사용했어요. 한국 시간 자정 이후에 다시 질문할 수 있어요.</p>}
          </>
        ) : <p className="text-base leading-7">
          {access.questionAccess === 'premium-required' ? '영상 질문은 haru2026 프리미엄 전용 기능이에요.' : '영상 질문을 준비 중이에요.'}
        </p>}
        {error && <p role="alert" className="break-words rounded-lg bg-[#fff6f2] p-3 text-[#8a2f22]">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
