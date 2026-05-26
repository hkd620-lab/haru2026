import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  RotateCcw,
  Scale,
} from 'lucide-react';

type Stage = 'start' | 'question' | 'result';

type AnswerKey =
  | 'item'
  | 'amount'
  | 'tradeDate'
  | 'problem'
  | 'seller'
  | 'evidence';

type Answers = Record<AnswerKey, string>;

type Question = {
  key: AnswerKey;
  label: string;
  prompt: string;
  placeholder: string;
  helper: string;
};

const INITIAL_ANSWERS: Answers = {
  item: '',
  amount: '',
  tradeDate: '',
  problem: '',
  seller: '',
  evidence: '',
};

const QUESTIONS: Question[] = [
  {
    key: 'item',
    label: '거래 물건',
    prompt: '무엇을 거래했나요?',
    placeholder: '예: 중고 노트북, 아이폰, 카메라 렌즈',
    helper: '상품명과 약속한 상태를 함께 적으면 사건 정리가 쉬워집니다.',
  },
  {
    key: 'amount',
    label: '거래 금액',
    prompt: '얼마를 지급했나요?',
    placeholder: '예: 480000원',
    helper: '입금액, 배송비, 추가 송금액이 있으면 모두 적어주세요.',
  },
  {
    key: 'tradeDate',
    label: '거래 일자',
    prompt: '언제 결제하거나 거래를 약속했나요?',
    placeholder: '예: 2026년 5월 20일 계좌이체',
    helper: '정확한 날짜를 모르면 대략적인 순서라도 적어도 됩니다.',
  },
  {
    key: 'problem',
    label: '분쟁 내용',
    prompt: '무슨 문제가 생겼나요?',
    placeholder: '예: 입금 후 판매자가 연락을 끊고 물건을 보내지 않았습니다.',
    helper: '미배송, 하자, 환불 거부, 연락 두절 중 해당되는 내용을 적어주세요.',
  },
  {
    key: 'seller',
    label: '상대방 정보',
    prompt: '상대방을 특정할 수 있는 정보가 있나요?',
    placeholder: '예: 닉네임, 계좌번호 끝자리, 휴대폰 번호, 플랫폼 채팅방',
    helper: '전자소송에서는 상대방 특정 가능성이 중요합니다.',
  },
  {
    key: 'evidence',
    label: '증거 자료',
    prompt: '지금 가지고 있는 증거는 무엇인가요?',
    placeholder: '예: 채팅 캡처, 입금확인증, 게시글 캡처, 택배 조회 내역',
    helper: '증거 이름만 적어도 결과 화면에서 정리해 드립니다.',
  },
];

function formatAmount(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return value.trim() || '금액 미입력';
  return `${Number(digits).toLocaleString('ko-KR')}원`;
}

function splitEvidence(value: string) {
  return value
    .split(/[,/·\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTimeline(answers: Answers) {
  const evidence = splitEvidence(answers.evidence);
  return [
    {
      title: '거래 약속',
      body: `${answers.item || '거래 물건'} 거래를 약속했습니다.`,
    },
    {
      title: '대금 지급',
      body: `${answers.tradeDate || '거래 일자 미입력'}에 ${formatAmount(
        answers.amount,
      )} 지급 사실을 정리합니다.`,
    },
    {
      title: '분쟁 발생',
      body: answers.problem || '미배송, 하자, 환불 거부 등 분쟁 내용을 보완해야 합니다.',
    },
    {
      title: '상대방 특정',
      body:
        answers.seller ||
        '닉네임, 계좌, 휴대폰, 플랫폼 채팅방 등 상대방 특정 자료를 더 모아야 합니다.',
    },
    {
      title: '증거 정리',
      body: evidence.length
        ? `${evidence.join(', ')} 자료를 소장 첨부자료 후보로 분류합니다.`
        : '채팅, 입금내역, 게시글, 배송내역 등 증거명을 입력해야 합니다.',
    },
  ];
}

export function LawsuitPracticePage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('start');
  const [selectedCase, setSelectedCase] = useState('used-trade');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);

  const currentQuestion = QUESTIONS[step];
  const progress = Math.round(((step + 1) / QUESTIONS.length) * 100);
  const timeline = useMemo(() => buildTimeline(answers), [answers]);
  const evidenceItems = splitEvidence(answers.evidence);

  const updateAnswer = (key: AnswerKey, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const resetPractice = () => {
    setStage('start');
    setStep(0);
    setSelectedCase('used-trade');
    setAnswers(INITIAL_ANSWERS);
  };

  const moveNext = () => {
    if (step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    setStage('result');
  };

  const moveBack = () => {
    if (stage === 'result') {
      setStage('question');
      setStep(QUESTIONS.length - 1);
      return;
    }
    if (stage === 'question' && step > 0) {
      setStep((prev) => prev - 1);
      return;
    }
    setStage('start');
  };

  return (
    <main className="min-h-screen bg-[#FEFBE8] text-[#1A3C6E] px-4 py-5 sm:px-6">
      <style>{`
        .lawsuit-shell {
          max-width: 980px;
          margin: 0 auto;
          padding-bottom: 96px;
        }
        .lawsuit-card {
          background: #fff;
          border: 1px solid #e5dfd0;
          border-radius: 18px;
          box-shadow: 0 18px 44px -34px rgba(26, 60, 110, 0.38);
        }
        .lawsuit-button {
          min-height: 46px;
          border-radius: 12px;
          font-weight: 700;
          transition: transform 120ms ease, background 160ms ease, border-color 160ms ease;
        }
        .lawsuit-button:active {
          transform: scale(0.99);
        }
        .lawsuit-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .lawsuit-timeline {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr);
          gap: 12px;
        }
        @media (max-width: 720px) {
          .lawsuit-shell {
            padding-bottom: 112px;
          }
          .lawsuit-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="lawsuit-shell">
        <header className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/v2')}
            className="lawsuit-button inline-flex items-center gap-2 border border-[#d8d1bc] bg-white px-4 text-sm text-[#4A5A2C]"
          >
            <ArrowLeft className="h-4 w-4" />
            HARU 홈
          </button>
          <button
            type="button"
            onClick={resetPractice}
            className="lawsuit-button inline-flex items-center gap-2 border border-[#d8d1bc] bg-white px-4 text-sm text-[#7A6F5A]"
          >
            <RotateCcw className="h-4 w-4" />
            초기화
          </button>
        </header>

        <section className="lawsuit-card mb-4 overflow-hidden">
          <div className="border-b border-[#e5dfd0] bg-[#f5f0e8] px-5 py-4 sm:px-7">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-[#B85C2E]">
              <Scale className="h-3.5 w-3.5" />
              LAWSUIT PRACTICE V1
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              전자소송연습비서
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6673]">
              중고거래 분쟁을 질문 순서대로 정리하고, 전자소송 준비용 사건 타임라인을
              만들어봅니다.
            </p>
          </div>

          {stage === 'start' && (
            <div className="px-5 py-6 sm:px-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">사건 유형 선택</h2>
                  <p className="mt-1 text-sm text-[#6b7280]">
                    v1은 중고거래 대금반환 흐름만 동작합니다.
                  </p>
                </div>
                <span className="rounded-full bg-[#e0e8b8] px-3 py-1 text-xs font-bold text-[#4A5A2C]">
                  미저장 연습
                </span>
              </div>

              <div className="lawsuit-grid">
                <button
                  type="button"
                  onClick={() => setSelectedCase('used-trade')}
                  className="min-h-[150px] rounded-2xl border bg-[#f9faf3] p-5 text-left"
                  style={{
                    borderColor: selectedCase === 'used-trade' ? '#4A5A2C' : '#e5dfd0',
                  }}
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#4A5A2C]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-base font-extrabold">중고거래 분쟁</div>
                  <div className="mt-2 text-sm leading-5 text-[#6b7280]">
                    미배송, 환불 거부, 하자 물품 사건을 연습합니다.
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#1A3C6E] px-3 py-1 text-xs font-bold text-white">
                    선택됨
                  </div>
                </button>

                {['임대차 보증금', '임금 체불'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    className="min-h-[150px] rounded-2xl border border-dashed border-[#d8d1bc] bg-white p-5 text-left opacity-70"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5f0e8] text-[#7A6F5A]">
                      <Scale className="h-5 w-5" />
                    </div>
                    <div className="text-base font-extrabold text-[#7A6F5A]">{label}</div>
                    <div className="mt-2 text-sm leading-5 text-[#8a8f98]">
                      다음 버전에서 추가 예정입니다.
                    </div>
                    <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-[#e5dfd0] px-3 py-1 text-xs font-bold text-[#7A6F5A]">
                      준비중
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStage('question')}
                className="lawsuit-button mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#1A3C6E] px-5 text-white"
              >
                중고거래 사건 연습 시작
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {stage === 'question' && (
            <div className="px-5 py-6 sm:px-7">
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#7A6F5A]">
                  <span>
                    STEP {step + 1} / {QUESTIONS.length}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#ede8dc]">
                  <div
                    className="h-full rounded-full bg-[#4A5A2C]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mb-4 inline-flex rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-bold text-[#B85C2E]">
                {currentQuestion.label}
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">
                {currentQuestion.prompt}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                {currentQuestion.helper}
              </p>

              <textarea
                value={answers[currentQuestion.key]}
                onChange={(event) => updateAnswer(currentQuestion.key, event.target.value)}
                placeholder={currentQuestion.placeholder}
                className="mt-5 min-h-[160px] w-full resize-none rounded-2xl border border-[#d8d1bc] bg-[#fffdf4] p-4 text-base leading-7 text-[#1A3C6E] outline-none focus:border-[#1A3C6E]"
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={moveBack}
                  className="lawsuit-button inline-flex items-center justify-center gap-2 border border-[#d8d1bc] bg-white px-5 text-[#4A5A2C]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  이전
                </button>
                <button
                  type="button"
                  onClick={moveNext}
                  className="lawsuit-button inline-flex items-center justify-center gap-2 bg-[#1A3C6E] px-5 text-white"
                >
                  {step === QUESTIONS.length - 1 ? '타임라인 만들기' : '다음 질문'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {stage === 'result' && (
            <div className="px-5 py-6 sm:px-7">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#e0e8b8] px-3 py-1 text-xs font-bold text-[#4A5A2C]">
                    <CheckCircle2 className="h-4 w-4" />
                    결과 생성 완료
                  </div>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    중고거래 사건 타임라인
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                    입력값은 화면 안에서만 사용되며 Firestore에 저장하지 않습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStage('question');
                    setStep(0);
                  }}
                  className="lawsuit-button inline-flex items-center justify-center gap-2 border border-[#d8d1bc] bg-white px-4 text-sm text-[#4A5A2C]"
                >
                  답변 수정
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-[#e5dfd0] bg-[#fffdf4] p-5">
                  <div className="space-y-5">
                    {timeline.map((item, index) => (
                      <div key={item.title} className="lawsuit-timeline">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A3C6E] text-sm font-extrabold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-base font-extrabold">{item.title}</div>
                          <p className="mt-1 text-sm leading-6 text-[#5f6673]">{item.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-[#e5dfd0] bg-white p-5">
                    <h3 className="font-extrabold">청구 취지 연습 문장</h3>
                    <p className="mt-3 text-sm leading-6 text-[#5f6673]">
                      피고는 원고에게 {formatAmount(answers.amount)} 및 이에 대한 지연손해금을
                      지급하라는 취지로 정리할 수 있습니다.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#e5dfd0] bg-white p-5">
                    <h3 className="font-extrabold">증거 후보</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(evidenceItems.length ? evidenceItems : ['채팅 캡처', '입금확인증']).map(
                        (item) => (
                          <span
                            key={item}
                            className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-bold text-[#4A5A2C]"
                          >
                            {item}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#f0c8c8] bg-[#fff5f5] p-5">
                    <h3 className="font-extrabold text-[#a33a3a]">주의</h3>
                    <p className="mt-3 text-sm leading-6 text-[#7a4a4a]">
                      이 화면은 소송 연습용 정리 도구입니다. 실제 제출 전에는 관할,
                      상대방 인적사항, 청구원인, 증거 적합성을 별도로 확인해야 합니다.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default LawsuitPracticePage;
