import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, HelpCircle, Loader2, Scale, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LegalTermHelp } from '../components/LegalTermHelp';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';

type GuideStep = {
  title: string;
  easy: string;
  userTasks: string[];
  haruTasks: string[];
  note?: string;
};

type CheckAnswer = 'yes' | 'no' | null;

const advantageCards = [
  {
    title: '비용 부담을 줄일 수 있습니다',
    body: '직접 진행 가능한 사건에서는 전문가 선임비용 부담을 줄일 수 있습니다.',
  },
  {
    title: '내 사건을 직접 관리합니다',
    body: '사실관계, 증거, 제출서류와 법원 문서를 한곳에서 정리할 수 있습니다.',
  },
  {
    title: '절차를 이해하며 진행합니다',
    body: '어려운 용어와 각 단계의 의미를 확인하면서 사건 진행을 따라갈 수 있습니다.',
  },
  {
    title: '필요한 순간 도움을 선택합니다',
    body: '직접 정리할 부분과 전문가 상담을 고려할 부분을 구분할 수 있습니다.',
  },
];

const guideSteps: GuideStep[] = [
  {
    title: '1단계 — 사건 내용 정리',
    easy: '누구에게 무엇을 요구하려는지, 어떤 일이 있었는지 정리하는 단계입니다.',
    userTasks: ['상대방 확인', '요구할 내용 정리', '중요한 날짜 정리', '계약·송금·문자·사진 등 자료 모으기'],
    haruTasks: ['사실관계 시간순 정리', '기록과 자료 목록 만들기', '빠진 내용 확인', '어려운 용어 설명'],
  },
  {
    title: '2단계 — 절차와 법원 확인',
    easy: '어떤 절차로 어느 법원에 제출할지 확인하는 단계입니다.',
    userTasks: ['전자소송포털 공식 안내 확인', '사건 종류 확인', '관할법원 확인', '지급명령·소송 등 절차 차이 확인'],
    haruTasks: ['확인해야 할 항목 안내', '사용자가 확인한 내용을 기록', '공식 안내를 다시 확인하도록 표시'],
    note: 'HARU가 절차나 관할법원을 자동 확정하지 않습니다.',
  },
  {
    title: '3단계 — 서류와 증거 준비',
    easy: '법원에 낼 서류와 사실을 보여주는 자료를 준비하는 단계입니다.',
    userTasks: ['청구취지 확인', '청구원인 작성', '증거자료 원본 확인', '상대방 정보 확인'],
    haruTasks: ['작성 연습', '사건 기록 요약', '증거목록 정리', '제출 전 체크리스트'],
  },
  {
    title: '4단계 — 전자 제출',
    easy: '전자소송포털에서 서류를 등록하고 제출하는 단계입니다.',
    userTasks: ['전자소송포털 로그인', '제출서류와 첨부파일 확인', '전자서명 여부 확인', '인지대·송달료 등 납부 상태 확인', '최종 제출'],
    haruTasks: ['제출 과정 연습', '제출 전 확인 목록', '제출한 최종 PDF 보관 여부 확인', '접수증 저장 여부 확인'],
    note: 'HARU가 실제 법원 제출을 대신하지 않습니다.',
  },
  {
    title: '5단계 — 접수 확인',
    easy: '제출한 서류가 정상 접수되었는지 확인하는 단계입니다.',
    userTasks: ['제출내역 확인', '접수증 확인', '사건번호 확인', '비용 납부 상태 확인'],
    haruTasks: ['사건번호와 제출일 기록', '제출 후 체크리스트', '빠진 확인사항 표시'],
  },
  {
    title: '6단계 — 송달 확인',
    easy: '법원이 보낸 문서가 있는지 확인하고 받은 내용을 기록하는 단계입니다.',
    userTasks: ['전자소송포털 문서함 확인', '법원이 보낸 문서 원문 확인', '문서에 적힌 날짜와 안내 확인'],
    haruTasks: ['오늘 확인 여부 기록', '받은 문서 목록 관리', '대응 필요 여부 기록', '사용자가 직접 확인한 기한 관리'],
    note: 'HARU가 새 송달문서 도착 여부를 자동 확인하지 않습니다.',
  },
  {
    title: '7단계 — 보정·답변·추가서류·기일 대응',
    easy: '법원 문서나 상대방의 대응을 확인하고 필요한 일을 준비하는 단계입니다.',
    userTasks: ['보정명령 원문 확인', '답변서나 추가자료 필요 여부 확인', '기일통지 내용 확인', '법원 문서에 적힌 기한 직접 확인'],
    haruTasks: ['요구사항 체크리스트', '준비자료 기록', '사용자가 입력한 기한 알림', '처리 완료 기록'],
    note: '법정기한을 HARU가 계산하거나 확정하지 않습니다.',
  },
  {
    title: '8단계 — 판결 또는 결정 확인',
    easy: '법원이 내린 판단 내용을 확인하는 단계입니다.',
    userTasks: ['판결문·결정문 원문 확인', '송달 및 확정 관련 안내 확인', '후속조치 필요 여부 확인'],
    haruTasks: ['문서 확인 기록', '중요한 내용 메모', '후속 확인사항 체크리스트'],
  },
  {
    title: '9단계 — 판결 이후 확인',
    easy: '상소, 확정, 강제집행 등 다음 절차가 필요한지 확인하는 단계입니다.',
    userTasks: ['법원 문서와 공식 안내 확인', '상소나 집행이 필요한지 확인', '필요한 경우 전문가 상담'],
    haruTasks: ['확인할 항목 정리', '사용자가 확인한 날짜 기록', '관련 문서와 메모 관리'],
    note: 'HARU가 상소기간, 확정일 또는 집행 가능 여부를 자동 판단하지 않습니다.',
  },
];

const checkQuestions = [
  '상대방이 누구인지 알고 있나요?',
  '상대방에게 요구하려는 내용이 명확한가요?',
  '계약서·송금내역·문자·사진 등 관련 자료가 있나요?',
  '사건의 중요한 날짜를 정리할 수 있나요?',
  '상대방과 사실관계 자체에 큰 다툼이 있나요?',
  '가압류·가처분·부동산 명도와 관련되어 있나요?',
  '형사사건이나 복잡한 계약 해석과 연결되어 있나요?',
  '금액이 크거나 손해액 계산이 복잡한가요?',
  '법원 문서에 적힌 중요한 기한이 임박했나요?',
];

const riskQuestionIndexes = new Set([4, 5, 6, 7, 8]);

const riskResultReasons: Record<number, string> = {
  4: '사실관계에 큰 다툼이 있습니다.',
  5: '가압류·가처분·부동산 명도와 관련되어 있습니다.',
  6: '형사사건이나 복잡한 계약 해석과 연결되어 있습니다.',
  7: '금액이 크거나 손해액 계산이 복잡합니다.',
  8: '법원 문서에 적힌 중요한 기한이 임박해 있습니다.',
};

const haruPreparationItems = [
  '사건 내용과 요구사항 정리',
  '계약서·송금내역·문자·사진 등 관련 자료 정리',
  '중요한 날짜 확인',
  '제출 전 확인사항 점검',
];

export default function LegalSelfLitigationGuidePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [answers, setAnswers] = useState<CheckAnswer[]>(() => checkQuestions.map(() => null));

  const selectedRiskReasons = useMemo(
    () =>
      answers
        .map((answer, index) => (answer === 'yes' && riskQuestionIndexes.has(index) ? riskResultReasons[index] : null))
        .filter((item): item is string => Boolean(item)),
    [answers],
  );
  const hasAnyAnswer = answers.some(Boolean);

  const setAnswer = (index: number, answer: CheckAnswer) => {
    setAnswers((prev) => prev.map((item, itemIndex) => (itemIndex === index ? answer : item)));
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, navigate, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFBE8] px-4 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-20 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          나홀로소송 전체 과정을 준비하는 중입니다.
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#FEFBE8] px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/legal-assistant')} className="px-2">
            <ArrowLeft className="size-4" />
            비서 홈
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-semibold text-gray-900">나홀로소송 전체 과정</h1>
            <p className="truncate text-xs text-gray-500">준비 · 제출 · 송달 · 대응 · 판결 이후</p>
          </div>
          <span />
        </header>

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <Scale className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">나홀로소송의 장점</h2>
              <div className="mt-2 space-y-2 text-sm leading-6 text-gray-600">
                <p>
                  <LegalTermHelp term="나홀로소송" />은 사건에 따라 당사자가 직접 서류를 준비하고 절차를 진행하는 방식입니다.
                </p>
                <p>직접 진행할 수 있는 사건이라면 비용 부담을 줄이고, 내 사건의 기록과 진행상황을 스스로 관리할 수 있습니다.</p>
                <p>다만 사실관계가 복잡하거나 중요한 기한·재산보전·고액 청구 등이 관련된 사건은 전문가 상담을 함께 고려해야 합니다.</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {advantageCards.map((card) => (
                  <article key={card.title} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-600">{card.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
            아래 내용은 일반적인 민사 나홀로소송의 흐름을 쉽게 정리한 것입니다. 사건 종류와 진행상황에 따라 절차는 달라질 수 있으므로 법원 문서와 전자소송포털 안내를 직접 확인하세요.
          </p>
          <div className="mt-4 space-y-4">
            {guideSteps.map((step) => (
              <article key={step.title} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{step.title}</h2>
                  {step.title.includes('송달') && <LegalTermHelp term="송달" />}
                  {step.title.includes('보정') && <LegalTermHelp term="보정명령" />}
                  {step.title.includes('기일') && <LegalTermHelp term="기일" />}
                </div>
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-semibold text-blue-800">쉽게 말하면</p>
                  <p className="mt-1 text-sm leading-6 text-blue-900">{step.easy}</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <TaskList title="내가 할 것" items={step.userTasks} />
                  <TaskList title="HARU가 도울 것" items={step.haruTasks} />
                </div>
                {step.note && (
                  <p className="mt-3 rounded-md border border-yellow-100 bg-yellow-50 px-3 py-2 text-xs leading-5 text-yellow-900">
                    {step.note}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <HelpCircle className="mt-0.5 size-5 shrink-0 text-blue-700" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">시작 전에 확인해 보세요</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                이 점검은 나홀로소송 가능 여부를 법적으로 판단하지 않습니다. 직접 정리할 부분과 전문가 상담을 고려할 부분을 구분하는 참고용입니다.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {checkQuestions.map((question, index) => (
              <div key={question} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-sm font-medium text-gray-900">{index + 1}. {question}</p>
                <div className="mt-2 flex gap-2">
                  {(['yes', 'no'] as const).map((answer) => (
                    <button
                      key={answer}
                      type="button"
                      onClick={() => setAnswer(index, answers[index] === answer ? null : answer)}
                      className={`min-h-9 rounded-md border px-3 text-sm font-semibold ${
                        answers[index] === answer
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {answer === 'yes' ? '예' : '아니오'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {hasAnyAnswer && (
            <div className="mt-4 space-y-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-sm leading-6 text-blue-900">
              <div>
                <p className="font-semibold">나홀로소송 준비를 계속할 수 있습니다</p>
                <p className="mt-1">
                  이 점검은 나홀로소송 가능 여부를 판단하지 않습니다.
                  직접 준비할 부분과 추가로 확인하면 좋은 부분을 나누어 보여드립니다.
                </p>
              </div>

              <div className="rounded-md border border-blue-100 bg-white px-3 py-3">
                <p className="font-semibold text-gray-900">HARU와 먼저 준비할 부분</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-700">
                  {haruPreparationItems.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              {selectedRiskReasons.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-white px-3 py-3">
                  <p className="font-semibold text-gray-900">전문가에게 확인하면 좋은 부분</p>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-700">
                    {selectedRiskReasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                이 결과는 나홀로소송 가능 여부를 판단하거나 중단을 권하는 내용이 아닙니다.
                필요한 부분만 전문가에게 확인하면서 HARU와 계속 준비할 수 있습니다.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">전문가 상담이 필요한 사건</p>
              <p className="mt-1">
                상대방이 강하게 다투는 사건, 금액이 큰 사건, 손해배상액 산정이 어려운 사건,
                부동산 명도·가압류·가처분, 가사·형사 연계, 계약 해석이 복잡하거나 법률상 기한 계산이
                중요한 사건은 실제 진행 전 전문가 상담을 권장합니다.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1" onClick={() => navigate('/lawsuit-practice')}>
            새로 소송을 준비하고 있어요
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/legal-cases')}>
            이미 제출한 사건 관리
          </Button>
        </div>
      </div>
    </main>
  );
}

function TaskList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="size-4 text-blue-700" />
        <p className="text-sm font-semibold text-gray-900">{title}</p>
      </div>
      <ul className="space-y-1 text-xs leading-5 text-gray-600">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
