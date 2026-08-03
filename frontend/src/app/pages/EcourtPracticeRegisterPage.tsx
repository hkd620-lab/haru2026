import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { EcourtPracticeShell } from '../components/ecourt-practice/EcourtPracticeShell';

type UserTypeOption = {
  group: string;
  category: string;
  label: string;
};

const GENERAL_USER_GROUPS: Array<{ category: string; options: string[] }> = [
  { category: '개인 만 10~13세', options: ['내국인'] },
  { category: '개인 만 14세 이상', options: ['내국인', '외국인'] },
  {
    category: '법인·단체 및 공공기관',
    options: ['법인', '기타단체/관공서', '국가', '지방자치단체', '행정청'],
  },
  { category: '사실조회기관', options: ['사실조회기관'] },
];

const QUALIFIED_USER_GROUPS: Array<{ category: string; options: string[] }> = [
  {
    category: '대리인',
    options: ['변호사', '변리사', '소송수행자', '공익법무관', '특허법인', '법무법인', '법무법인(유한)', '법무조합', '합동법률사무소'],
  },
  { category: '법무사', options: ['법무사', '법무사법인', '법무사법인(유한)'] },
  { category: '회생파산절차 관계인', options: ['관리인', '조사위원', '파산관재인', '감사위원', '감사'] },
  { category: '가사행정 후견절차 관계인', options: ['전문후견감독위원'] },
  { category: '보호절차 관계인', options: ['소년보호기관', '수탁기관', '상담교육기관'] },
];

const STEPS = [
  '1단계 사용자유형선택',
  '2단계 이용약관동의',
  '3단계 실명확인',
  '4단계 사용자정보입력',
  '5단계 등록완료',
];

function optionKey(option: UserTypeOption) {
  return `${option.group}-${option.category}-${option.label}`;
}

export function EcourtPracticeRegisterPage() {
  const [selectedOption, setSelectedOption] = useState<UserTypeOption | null>(null);
  const [notice, setNotice] = useState('');

  const selectedText = selectedOption
    ? `${selectedOption.group} · ${selectedOption.category} · ${selectedOption.label}`
    : '';

  const renderOptionSection = (
    group: string,
    sections: Array<{ category: string; options: string[] }>,
  ) => (
    <section className="border border-[#d7dde5] bg-white">
      <div className="border-b border-[#d7dde5] bg-[#f7f9fc] px-4 py-3">
        <h2 className="text-lg font-extrabold text-[#162f55]">{group}</h2>
      </div>
      <div className="grid gap-4 p-4">
        {sections.map((section) => (
          <div key={section.category} className="grid gap-3 border-b border-[#edf0f4] pb-4 last:border-b-0 last:pb-0">
            <h3 className="text-sm font-extrabold text-[#334155]">{section.category}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.options.map((label) => {
                const option = { group, category: section.category, label };
                const selected = selectedOption ? optionKey(selectedOption) === optionKey(option) : false;
                return (
                  <button
                    key={optionKey(option)}
                    type="button"
                    data-group={group}
                    data-category={section.category}
                    data-label={label}
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedOption(option);
                      setNotice('');
                    }}
                    className={`min-h-12 rounded border px-3 py-2 text-left text-sm font-extrabold leading-5 ${
                      selected
                        ? 'border-[#183c73] bg-[#eaf3ff] text-[#183c73] shadow-[0_10px_22px_-18px_rgba(24,60,115,0.8)]'
                        : 'border-[#cbd5e1] bg-white text-[#475569]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <EcourtPracticeShell>
      <div className="mx-auto max-w-[1040px]">
        <div className="mb-8 text-center">
          <p className="text-sm font-extrabold text-[#58708f]">1단계만 구현된 연습 화면</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#162f55] sm:text-4xl">사용자등록 연습</h1>
        </div>

        <div className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className={`min-h-16 rounded border px-3 py-3 text-center text-xs font-extrabold leading-5 ${
                index === 0
                  ? 'border-[#183c73] bg-[#183c73] text-white'
                  : 'border-[#d7dde5] bg-[#f7f9fc] text-[#64748b]'
              }`}
            >
              {step}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {renderOptionSection('일반사용자', GENERAL_USER_GROUPS)}
          {renderOptionSection('자격자 사용자', QUALIFIED_USER_GROUPS)}
        </div>

        <div className="mt-6 rounded border border-[#bfd1e8] bg-[#f5f9ff] px-4 py-4 text-sm font-bold leading-7 text-[#183c73]">
          {selectedOption ? `선택한 사용자 유형: ${selectedText}` : '선택한 사용자 유형: 아직 선택하지 않았습니다.'}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[#64748b]">
            실제 사용자등록, 실명확인, 개인정보 입력으로 연결하지 않습니다.
          </p>
          <button
            type="button"
            disabled={!selectedOption}
            onClick={() =>
              setNotice('사용자유형 선택 연습을 완료했습니다.\n이용약관 동의 화면은 다음 작업에서 구현합니다.')
            }
            className="min-h-11 rounded bg-[#183c73] px-5 text-sm font-extrabold text-white disabled:bg-[#94a3b8]"
          >
            다음 단계
          </button>
        </div>

        {notice && (
          <div className="mt-5 rounded border border-[#bfd1e8] bg-[#f5f9ff] px-4 py-4 text-sm font-bold leading-7 text-[#183c73]">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="whitespace-pre-line">{notice}</p>
            </div>
          </div>
        )}
      </div>
    </EcourtPracticeShell>
  );
}
