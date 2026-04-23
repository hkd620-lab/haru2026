import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';


type Tab = 'motive' | 'birth' | 'desire' | 'shackle' | 'luck' | 'narrative' | 'chars' | 'events';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'motive',    label: '예언 모티브', icon: '🔮' },
  { id: 'birth',     label: '탄생',   icon: '🌱' },
  { id: 'desire',    label: '욕망',   icon: '🔥' },
  { id: 'shackle',   label: '족쇄',   icon: '⛓' },
  { id: 'luck',      label: '운',     icon: '🍀' },
  { id: 'narrative', label: '서사',   icon: '📖' },
  { id: 'chars',     label: '인물',   icon: '👥' },
  { id: 'events',    label: '사건',   icon: '⚡' },
];

function useMultiSelect(init: string[] = []) {
  const [selected, setSelected] = useState<string[]>(init);
  const toggle = (v: string) =>
    setSelected(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  return { selected, toggle };
}

function useSingle(init: string = '') {
  const [selected, setSelected] = useState(init);
  return { selected, set: setSelected };
}

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 99,
        border: `1px solid ${on ? '#1A3C6E' : '#c7d6ea'}`,
        background: on ? '#1A3C6E' : '#fff',
        color: on ? '#fff' : '#1A3C6E',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function Memo({ placeholder, value, onChange }: {
  placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      style={{
        width: '100%',
        border: '1px dashed #c7d6ea',
        borderRadius: 8,
        padding: '7px 10px',
        fontSize: 12,
        color: '#374151',
        background: '#f9fbfd',
        resize: 'none',
        outline: 'none',
        marginTop: 7,
        lineHeight: 1.6,
        fontFamily: 'inherit',
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 5 }}>
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid #e5e7eb',
      borderRadius: 10,
      padding: 11,
    }}>
      {children}
    </div>
  );
}

function MotiveTab({ s, upd }: { s: NovelSettings; upd: (k: keyof NovelSettings, v: any) => void }) {
  const OPTIONS = [
    { id: 'daughter_future', label: '👧 나 딸의 미래는' },
    { id: 'my_future',       label: '🌟 나의 미래는' },
    { id: 'what_if',         label: '⏪ 그때 이랬다면' },
    { id: 'lottery',         label: '🎰 로또 1등 당첨이 되었다면' },
    { id: 'custom',          label: '✏️ 직접설정' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionLabel>🔮 예언 모티브 — 어떤 미래를 예언받고 싶으신가요?</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => upd('motive', opt.id)}
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                border: `2px solid ${s.motive === opt.id ? '#1A3C6E' : '#e5e7eb'}`,
                backgroundColor: s.motive === opt.id ? '#1A3C6E' : '#fff',
                color: s.motive === opt.id ? '#fff' : '#374151',
                fontSize: 14,
                fontWeight: s.motive === opt.id ? 700 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {opt.label}
            </button>
          ))}
          {s.motive === 'custom' && (
            <textarea
              placeholder="예언받고 싶은 상황을 자유롭게 입력하세요..."
              value={s.motiveCustom || ''}
              onChange={e => upd('motiveCustom', e.target.value)}
              style={{
                width: '100%', minHeight: 80, padding: '10px 12px',
                borderRadius: 8, border: '1.5px solid #d1d5db',
                fontSize: 13, resize: 'none', boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function BirthTab() {
  const gender  = useSingle('남성');
  const spoon   = useSingle('흙수저');
  const looks   = useSingle('평범함');
  const era     = useMultiSelect(['일제강점기']);
  const region  = useMultiSelect(['어촌·섬']);
  const family  = useMultiSelect(['가부장적 가정']);
  const social  = useMultiSelect(['식민·지배 체제']);

  const [memoGender,  setMemoGender]  = useState('');
  const [memoSpoon,   setMemoSpoon]   = useState('');
  const [memoLooks,   setMemoLooks]   = useState('');
  const [memoEra,     setMemoEra]     = useState('');
  const [memoRegion,  setMemoRegion]  = useState('');
  const [memoFamily,  setMemoFamily]  = useState('');
  const [memoSocial,  setMemoSocial]  = useState('');

  const genders  = ['남성', '여성', '직접 정의'];
  const spoons   = ['흙수저', '동수저', '은수저', '금수저'];
  const looksList= ['매우 추함', '추함', '평범함', '준수함', '미남/미녀'];
  const eras     = ['조선시대', '일제강점기', '한국전쟁', '산업화시대', '현대', '직접 설정'];
  const regions  = ['어촌·섬', '농촌', '산촌', '소도시', '대도시', '변방·국경', '해외 이민', '직접 입력'];
  const families = ['결손가정', '가부장적 가정', '다자녀 빈곤', '상실의 가정', '명예를 중시', '직접 입력'];
  const socials  = ['식민·지배 체제', '전쟁·분쟁', '경제 공황', '신분·계급 사회', '재난·자연재해', '직접 입력'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionLabel>성별</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {genders.map(g => (
            <Pill key={g} label={g} on={gender.selected === g} onClick={() => gender.set(g)} />
          ))}
        </div>
        {gender.selected === '직접 정의' && (
          <Memo placeholder="직접 입력: 성별 관련 특이사항..." value={memoGender} onChange={setMemoGender} />
        )}
      </Card>

      <Card>
        <SectionLabel>경제적 출발 (수저)</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {spoons.map(s => (
            <Pill key={s} label={s} on={spoon.selected === s} onClick={() => spoon.set(s)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 가정 경제 상황 상세..." value={memoSpoon} onChange={setMemoSpoon} />
      </Card>

      <Card>
        <SectionLabel>외모</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {looksList.map(l => (
            <Pill key={l} label={l} on={looks.selected === l} onClick={() => looks.set(l)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 외모 특징 상세..." value={memoLooks} onChange={setMemoLooks} />
      </Card>

      <Card>
        <SectionLabel>태어난 시대</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {eras.map(e => (
            <Pill key={e} label={e} on={era.selected.includes(e)} onClick={() => era.toggle(e)} />
          ))}
        </div>
        {era.selected.includes('직접 설정') && (
          <Memo placeholder="직접 입력: 시대적 배경 설명..." value={memoEra} onChange={setMemoEra} />
        )}
      </Card>

      <Card>
        <SectionLabel>태어난 지역</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {regions.map(r => (
            <Pill key={r} label={r} on={region.selected.includes(r)} onClick={() => region.toggle(r)} />
          ))}
        </div>
        {region.selected.includes('직접 입력') && (
          <Memo placeholder="직접 입력: 지역 특성 설명..." value={memoRegion} onChange={setMemoRegion} />
        )}
      </Card>

      <Card>
        <SectionLabel>가정환경</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {families.map(f => (
            <Pill key={f} label={f} on={family.selected.includes(f)} onClick={() => family.toggle(f)} />
          ))}
        </div>
        {family.selected.includes('직접 입력') && (
          <Memo placeholder="직접 입력: 가정환경 상세 설명..." value={memoFamily} onChange={setMemoFamily} />
        )}
      </Card>

      <Card>
        <SectionLabel>사회·역사적 환경</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {socials.map(s => (
            <Pill key={s} label={s} on={social.selected.includes(s)} onClick={() => social.toggle(s)} />
          ))}
        </div>
        {social.selected.includes('직접 입력') && (
          <Memo placeholder="직접 입력: 사회환경 상세 설명..." value={memoSocial} onChange={setMemoSocial} />
        )}
      </Card>
    </div>
  );
}

function DesireTab() {
  const desire  = useMultiSelect(['인정욕구']);
  const limit   = useMultiSelect(['나이·시간']);
  const [intensity, setIntensity] = useState(5);
  const [memo, setMemo] = useState('');
  const [memoL, setMemoL] = useState('');

  const desires = ['인정욕구', '생존욕구', '소속욕구', '자유욕구', '복수욕구', '의미욕구', '창조욕구', '안정욕구', '직접 입력'];
  const limits  = ['나이·시간', '건강', '가정환경', '경제적 한계', '사회적 편견', '지식·능력', '고립·외로움', '직접 입력'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionLabel>핵심 욕망</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {desires.map(d => (
            <Pill key={d} label={d} on={desire.selected.includes(d)} onClick={() => desire.toggle(d)} />
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: '#854F0B', marginBottom: 4 }}>욕망 강도 {intensity}/7</p>
          <input
            type="range" min={1} max={7} value={intensity}
            onChange={e => setIntensity(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        {desire.selected.includes('직접 입력') && (
          <Memo placeholder="직접 입력: 욕망의 구체적 내용..." value={memo} onChange={setMemo} />
        )}
      </Card>

      <Card>
        <SectionLabel>현실적 한계</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {limits.map(l => (
            <Pill key={l} label={l} on={limit.selected.includes(l)} onClick={() => limit.toggle(l)} />
          ))}
        </div>
        {limit.selected.includes('직접 입력') && (
          <Memo placeholder="직접 입력: 한계의 구체적 내용..." value={memoL} onChange={setMemoL} />
        )}
      </Card>
    </div>
  );
}

function ShackleTab() {
  const shackle = useMultiSelect(['트라우마']);
  const yearn   = useMultiSelect(['행동으로 보여줌']);
  const [memo, setMemo]  = useState('');
  const [memo2, setMemo2] = useState('');

  const shackles = ['트라우마', '타인의 시선', '빈곤·계급', '관계의 의무', '두려움', '자기불신', '전통·관습', '직접 입력'];
  const yearns   = ['행동으로 보여줌', '독백으로 드러냄', '타인의 눈을 통해', '침묵과 인내로'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionLabel>주인공의 족쇄</SectionLabel>
        <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>모든 인간은 무언가에 묶여 있습니다</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {shackles.map(s => (
            <Pill key={s} label={s} on={shackle.selected.includes(s)} onClick={() => shackle.toggle(s)} />
          ))}
        </div>
        {shackle.selected.includes('직접 입력') && (
          <Memo placeholder="직접 입력: 족쇄의 구체적 내용..." value={memo} onChange={setMemo} />
        )}
      </Card>

      <Card>
        <SectionLabel>갈구함의 표현 방식</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {yearns.map(y => (
            <Pill key={y} label={y} on={yearn.selected.includes(y)} onClick={() => yearn.toggle(y)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 갈구함의 표현..." value={memo2} onChange={setMemo2} />
      </Card>

      <div style={{ background: '#FFF8E8', border: '0.5px solid #F9CB42', borderRadius: 10, padding: 11 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: '#633806', marginBottom: 4 }}>⚡ 열역학 1법칙 (에너지 보존)</p>
        <p style={{ fontSize: 10, color: '#854F0B', lineHeight: 1.6 }}>족쇄를 끊으려는 갈구함이 에너지가 됩니다.<br />이 에너지가 운을 부릅니다.</p>
      </div>

      <div style={{ background: '#F0F4FF', border: '0.5px solid #85B7EB', borderRadius: 10, padding: 11 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: '#0C447C', marginBottom: 4 }}>🌀 열역학 2법칙 (엔트로피)</p>
        <p style={{ fontSize: 10, color: '#185FA5', lineHeight: 1.6 }}>갈구하지 않으면 족쇄는 더 단단해집니다.<br />방치할수록 상황은 무질서해집니다.</p>
      </div>
    </div>
  );
}

function LuckTab() {
  const [stages, setStages] = useState(['', '', '']);
  const [memo, setMemo] = useState('');

  const updateStage = (i: number, v: string) => {
    setStages(p => p.map((s, idx) => idx === i ? v : s));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#FFFBF0', border: '0.5px solid #F9CB42', borderRadius: 10, padding: 11 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: '#633806', marginBottom: 4 }}>🍀 운(運)의 법칙</p>
        <p style={{ fontSize: 10, color: '#854F0B', lineHeight: 1.6 }}>
          운은 누구에게나 찾아옵니다.<br />
          단, 갈구하는 자에게만 잡힙니다.<br />
          한 단계 오를 때마다 운이 개입합니다.
        </p>
      </div>

      <Card>
        <SectionLabel>운이 찾아오는 전환점</SectionLabel>
        <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>주인공이 운을 만나는 순간들을 직접 입력하세요</p>
        {stages.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#F9CB42', color: '#412402',
              fontSize: 10, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>{i + 1}</div>
            <input
              value={s}
              onChange={e => updateStage(i, e.target.value)}
              placeholder={`전환점 ${i + 1} (예: 뜻밖의 도움을 받는 순간)`}
              style={{
                flex: 1, border: 'none',
                borderBottom: '0.5px solid #F9CB42',
                padding: '4px 0', fontSize: 12,
                color: '#374151', background: 'transparent',
                outline: 'none',
              }}
            />
          </div>
        ))}
        <button
          onClick={() => setStages(p => [...p, ''])}
          style={{
            width: '100%', padding: '6px',
            border: '1px dashed #F9CB42',
            borderRadius: 8, background: 'transparent',
            color: '#854F0B', fontSize: 11, cursor: 'pointer',
          }}
        >+ 전환점 추가</button>
        <Memo placeholder="직접 입력: 운에 대한 작가의 생각..." value={memo} onChange={setMemo} />
      </Card>
    </div>
  );
}

function NarrativeTab() {
  const writers  = useMultiSelect([]);
  const conflict = useMultiSelect(['인간 vs 운명']);
  const devices  = useMultiSelect(['복선']);
  const [writerMemo, setWriterMemo] = useState('');
  const [conflictMemo, setConflictMemo] = useState('');

  const krWriters  = ['김훈', '박경리', '한강', '이청준', '황석영', '최인훈'];
  const enWriters  = ['헤밍웨이', '톨스토이', '카뮈', '마르케스', '도스토예프스키', '가브리엘 가르시아'];
  const conflicts  = ['인간 vs 운명', '인간 vs 인간', '인간 vs 사회', '내면 갈등', '인간 vs 자연'];
  const deviceList = ['복선', '회상 구조', '반전', '상징', '액자 구조', '시점 교차', '아이러니'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionLabel>작가 서체 모방</SectionLabel>
        <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 5 }}>한국 작가</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {krWriters.map(w => (
            <Pill key={w} label={w} on={writers.selected.includes(w)} onClick={() => writers.toggle(w)} />
          ))}
        </div>
        <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 5 }}>서양 작가</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {enWriters.map(w => (
            <Pill key={w} label={w} on={writers.selected.includes(w)} onClick={() => writers.toggle(w)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 서체 스타일 설명..." value={writerMemo} onChange={setWriterMemo} />
      </Card>

      <Card>
        <SectionLabel>갈등 유형</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {conflicts.map(c => (
            <Pill key={c} label={c} on={conflict.selected.includes(c)} onClick={() => conflict.toggle(c)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 갈등 구조 설명..." value={conflictMemo} onChange={setConflictMemo} />
      </Card>

      <Card>
        <SectionLabel>서사 장치</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {deviceList.map(d => (
            <Pill key={d} label={d} on={devices.selected.includes(d)} onClick={() => devices.toggle(d)} />
          ))}
        </div>
      </Card>
    </div>
  );
}

interface NovelEvent {
  id: string;
  category: string;
  title: string;
  timing: string;
  impact: string;
  isCore: boolean;
}

type CharRole = '시동자' | '반대자' | '동조자' | '방관자';
interface Character {
  name: string;
  role: CharRole;
  // 성격
  personalities: string[];
  personalityMemo: string;
  // 욕망
  desires: string[];
  desireMemo: string;
  // 족쇄
  shackles: string[];
  shackleMemo: string;
  // 역할 설명
  roleDesc: string;
}

interface NovelSettings {
  chars: Character[];
  events: NovelEvent[];
  motive?: string;
  motiveCustom?: string;
}

const defaultSettings: NovelSettings = {
  chars: [
    { name: '', role: '시동자', personalities: [], personalityMemo: '', desires: [], desireMemo: '', shackles: [], shackleMemo: '', roleDesc: '' },
    { name: '', role: '반대자', personalities: [], personalityMemo: '', desires: [], desireMemo: '', shackles: [], shackleMemo: '', roleDesc: '' },
  ],
  events: [],
  motive: '',
  motiveCustom: '',
};

const ROLE_COLOR: Record<CharRole, string> = {
  '시동자': '#185FA5',
  '반대자': '#A32D2D',
  '동조자': '#085041',
  '방관자': '#5F5E5A',
};

const CHAR_PERSONALITIES = [
  '내성적', '외향적', '충동적', '신중한', '낙천적', '비관적',
  '고집스러운', '유연한', '냉정한', '감성적', '야망가', '순종적',
  '반항아', '이상주의자', '현실주의자', '완벽주의자',
];

const CHAR_DESIRES = [
  '인정받고 싶다', '사랑받고 싶다', '자유롭고 싶다',
  '복수하고 싶다', '살아남고 싶다', '뭔가를 증명하고 싶다',
  '가족을 지키고 싶다', '도망치고 싶다', '잊혀지고 싶다',
  '최고가 되고 싶다', '평화롭게 살고 싶다', '의미있게 살고 싶다',
];

const CHAR_SHACKLES = [
  '과거의 실패', '트라우마', '가족에 대한 죄책감', '두려움',
  '타인의 시선', '자기불신', '빚 또는 약속', '신체적 한계',
  '신분·계급', '사랑하는 사람', '복수심', '전통과 관습',
];

function CharDetail({
  c, i, onUpdate,
}: {
  c: Character;
  i: number;
  onUpdate: (i: number, field: keyof Character, v: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [charSaved, setCharSaved] = useState(false);

  const toggleItem = (field: 'personalities' | 'desires' | 'shackles', v: string) => {
    const arr = c[field] as string[];
    onUpdate(i, field, arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const SubPill = ({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      padding: '3px 9px', borderRadius: 99, fontSize: 11,
      border: `1px solid ${on ? '#1A3C6E' : '#e5e7eb'}`,
      background: on ? '#EEF3FA' : '#fff',
      color: on ? '#1A3C6E' : '#9ca3af',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>{on ? '✓ ' : ''}{label}</button>
  );

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '7px 10px',
          border: '1px dashed #c7d6ea', borderRadius: 8,
          background: open ? '#f4f8fc' : '#fff',
          color: '#1A3C6E', fontSize: 12,
          cursor: 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between',
        }}
      >
        <span>상세 설정 (성격·욕망·족쇄·역할)</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 성격 */}
          <div style={{ background: '#f9fbfd', borderRadius: 8, padding: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#1A3C6E', marginBottom: 6 }}>
              성격 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(복수 선택 가능)</span>
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {CHAR_PERSONALITIES.map(p => (
                <SubPill key={p} label={p}
                  on={c.personalities.includes(p)}
                  onClick={() => toggleItem('personalities', p)} />
              ))}
            </div>
            <textarea
              value={c.personalityMemo}
              onChange={e => onUpdate(i, 'personalityMemo', e.target.value)}
              placeholder="추가 성격 설명... (예: 겉은 강해 보이지만 속은 여린)"
              rows={2}
              style={{
                width: '100%', border: '1px dashed #c7d6ea', borderRadius: 7,
                padding: '6px 9px', fontSize: 11, color: '#374151',
                background: '#fff', resize: 'none', outline: 'none',
                lineHeight: 1.6, fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 욕망 */}
          <div style={{ background: '#FFF8E8', borderRadius: 8, padding: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#633806', marginBottom: 6 }}>
              🔥 욕망 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(복수 선택 가능)</span>
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {CHAR_DESIRES.map(d => (
                <SubPill key={d} label={d}
                  on={c.desires.includes(d)}
                  onClick={() => toggleItem('desires', d)} />
              ))}
            </div>
            <textarea
              value={c.desireMemo}
              onChange={e => onUpdate(i, 'desireMemo', e.target.value)}
              placeholder="이 인물만의 욕망 설명... (예: 아버지보다 더 나은 사람이 되고 싶다)"
              rows={2}
              style={{
                width: '100%', border: '1px dashed #F9CB42', borderRadius: 7,
                padding: '6px 9px', fontSize: 11, color: '#374151',
                background: '#fff', resize: 'none', outline: 'none',
                lineHeight: 1.6, fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 족쇄 */}
          <div style={{ background: '#FFF0F0', borderRadius: 8, padding: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#7F1D1D', marginBottom: 6 }}>
              ⛓ 족쇄 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(복수 선택 가능)</span>
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {CHAR_SHACKLES.map(sh => (
                <SubPill key={sh} label={sh}
                  on={c.shackles.includes(sh)}
                  onClick={() => toggleItem('shackles', sh)} />
              ))}
            </div>
            <textarea
              value={c.shackleMemo}
              onChange={e => onUpdate(i, 'shackleMemo', e.target.value)}
              placeholder="이 인물만의 족쇄 설명... (예: 형의 죽음에 대한 죄책감)"
              rows={2}
              style={{
                width: '100%', border: '1px dashed #FCA5A5', borderRadius: 7,
                padding: '6px 9px', fontSize: 11, color: '#374151',
                background: '#fff', resize: 'none', outline: 'none',
                lineHeight: 1.6, fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 역할 설명 */}
          <div style={{ background: '#F0F4FF', borderRadius: 8, padding: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#0C447C', marginBottom: 6 }}>
              📌 이야기에서의 역할
            </p>
            <textarea
              value={c.roleDesc}
              onChange={e => onUpdate(i, 'roleDesc', e.target.value)}
              placeholder="이 인물이 이야기에서 하는 역할... (예: 주인공의 출발을 막는 존재이나 결말에서 조력자로 전환)"
              rows={3}
              style={{
                width: '100%', border: '1px dashed #85B7EB', borderRadius: 7,
                padding: '6px 9px', fontSize: 11, color: '#374151',
                background: '#fff', resize: 'none', outline: 'none',
                lineHeight: 1.6, fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 인물 저장 버튼 */}
          <button
            onClick={() => {
              setCharSaved(true);
              setTimeout(() => setCharSaved(false), 2000);
            }}
            style={{
              width: '100%', padding: '10px',
              borderRadius: 8, border: 'none',
              background: charSaved ? '#10b981' : '#1A3C6E',
              color: '#fff', fontSize: 13,
              fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.3s',
              marginTop: 4,
            }}
          >
            {charSaved ? '✓ 인물 설정 저장됨' : '이 인물 설정 저장'}
          </button>

        </div>
      )}
    </div>
  );
}

function CharsTab({ s, upd }: { s: NovelSettings; upd: (k: keyof NovelSettings, v: any) => void }) {
  const addChar = () => upd('chars', [...s.chars, {
    name: '', role: '방관자' as CharRole,
    personalities: [], personalityMemo: '',
    desires: [], desireMemo: '',
    shackles: [], shackleMemo: '',
    roleDesc: '',
  }]);

  const updateChar = (i: number, field: keyof Character, v: any) => {
    const arr = s.chars.map((c, idx) => idx === i ? { ...c, [field]: v } : c);
    upd('chars', arr);
  };

  const removeChar = (i: number) => upd('chars', s.chars.filter((_, idx) => idx !== i));

  const roles: CharRole[] = ['시동자', '반대자', '동조자', '방관자'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#f4f8fc', borderRadius: 8, padding: '8px 10px', fontSize: 10, color: '#1A3C6E', lineHeight: 1.6 }}>
        🟦 시동자: 이야기를 시작하는 힘 | 🟥 반대자: 저항하는 힘<br />
        🟩 동조자: 함께하는 힘 | ⬜ 방관자: 침묵하는 힘
      </div>
      {s.chars.map((c, i) => (
        <div key={i} style={{
          background: '#fff',
          border: `1px solid ${ROLE_COLOR[c.role]}33`,
          borderRadius: 10, padding: 11,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {roles.map(r => (
                <button key={r} onClick={() => updateChar(i, 'role', r)} style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 10,
                  border: `1px solid ${ROLE_COLOR[r]}`,
                  background: c.role === r ? ROLE_COLOR[r] : '#fff',
                  color: c.role === r ? '#fff' : ROLE_COLOR[r],
                  cursor: 'pointer',
                }}>{r}</button>
              ))}
            </div>
            {s.chars.length > 1 && (
              <button onClick={() => removeChar(i)} style={{
                fontSize: 11, color: '#dc2626',
                background: 'none', border: 'none', cursor: 'pointer',
              }}>삭제</button>
            )}
          </div>
          <input
            value={c.name}
            onChange={e => updateChar(i, 'name', e.target.value)}
            placeholder="인물 이름"
            style={{
              width: '100%', border: 'none',
              borderBottom: `0.5px solid ${ROLE_COLOR[c.role]}`,
              padding: '4px 0', color: '#1A3C6E',
              background: 'transparent', outline: 'none',
              marginBottom: 4, fontSize: 16,
            }}
          />
          <CharDetail c={c} i={i} onUpdate={updateChar} />
        </div>
      ))}
      <button onClick={addChar} style={{
        width: '100%', padding: 8,
        border: '1px dashed #c7d6ea', borderRadius: 8,
        background: 'transparent', color: '#1A3C6E',
        fontSize: 12, cursor: 'pointer',
      }}>+ 인물 추가</button>
    </div>
  );
}

const EVENT_CATEGORIES = [
  {
    group: '🌹 첫 경험',
    items: ['첫사랑', '첫 이별·실연', '첫 성적 경험', '첫 친구', '첫 배신', '첫 죽음 목격'],
  },
  {
    group: '💔 관계의 상처',
    items: ['배신', '버려짐', '폭력·학대', '굴욕', '오해와 단절', '가족의 죽음'],
  },
  {
    group: '🏆 결정적 성취',
    items: ['인생 첫 성공', '인정받는 순간', '꿈의 실현', '오랜 노력의 결실'],
  },
  {
    group: '💀 실패와 추락',
    items: ['사업 실패', '시험·경쟁 탈락', '직장 해고', '큰 실수·사고', '파산'],
  },
  {
    group: '🌊 운명적 만남',
    items: ['평생의 스승', '운명적 연인', '진정한 친구', '라이벌과의 만남'],
  },
  {
    group: '⚡ 사회·역사적 사건',
    items: ['전쟁 경험', '재난·재해', '차별·박해', '역사적 격변 목격'],
  },
];

function EventsTab({ s, upd }: { s: NovelSettings; upd: (k: keyof NovelSettings, v: any) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState<NovelEvent>({
    id: '', category: '', title: '', timing: '', impact: '', isCore: false,
  });

  const addEvent = () => {
    if (!newEvent.title.trim()) return;
    const ev: NovelEvent = { ...newEvent, id: Date.now().toString() };
    upd('events', [...s.events, ev]);
    setNewEvent({ id: '', category: '', title: '', timing: '', impact: '', isCore: false });
    setShowForm(false);
  };

  const removeEvent = (id: string) => {
    upd('events', s.events.filter(e => e.id !== id));
  };

  const toggleCore = (id: string) => {
    upd('events', s.events.map(e => e.id === id ? { ...e, isCore: !e.isCore } : e));
  };

  const selectPreset = (category: string, item: string) => {
    setNewEvent(prev => ({ ...prev, category, title: item }));
    setShowForm(true);
  };

  const coreCount = s.events.filter(e => e.isCore).length;
  const total = s.events.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 추천 안내 */}
      <div style={{ background: '#FFFBF0', border: '0.5px solid #F9CB42', borderRadius: 10, padding: 11 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: '#633806', marginBottom: 4 }}>⚡ 사건이란?</p>
        <p style={{ fontSize: 10, color: '#854F0B', lineHeight: 1.7 }}>
          시간이 지나도 잊히지 않는 것.<br />
          첫사랑, 첫 실패, 배신, 죽음 목격...<br />
          이런 사건들이 인물의 족쇄가 되거나 욕망의 씨앗이 됩니다.
        </p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E' }}>{total}</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>등록된 사건</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E24B4A' }}>{coreCount}</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>핵심 사건</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>2~3</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>단편 권장</div>
          </div>
        </div>
      </div>

      {/* 사건 유형 선택 */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: 11 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 8 }}>사건 유형 선택</p>
        {EVENT_CATEGORIES.map(cat => (
          <div key={cat.group} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 5 }}>{cat.group}</p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {cat.items.map(item => {
                const already = s.events.some(e => e.title === item);
                return (
                  <button
                    key={item}
                    onClick={() => !already && selectPreset(cat.group, item)}
                    style={{
                      padding: '4px 10px', borderRadius: 99, fontSize: 11,
                      border: `1px solid ${already ? '#10b981' : '#c7d6ea'}`,
                      background: already ? '#e1f5ee' : '#fff',
                      color: already ? '#085041' : '#1A3C6E',
                      cursor: already ? 'default' : 'pointer',
                    }}
                  >{already ? '✓ ' : ''}{item}</button>
                );
              })}
            </div>
          </div>
        ))}
        <button
          onClick={() => { setNewEvent({ id: '', category: '직접 입력', title: '', timing: '', impact: '', isCore: false }); setShowForm(true); }}
          style={{
            marginTop: 4, padding: '6px 14px', borderRadius: 99,
            border: '1px dashed #1A3C6E', background: 'transparent',
            color: '#1A3C6E', fontSize: 11, cursor: 'pointer',
          }}
        >+ 직접 입력</button>
      </div>

      {/* 사건 입력 폼 */}
      {showForm && (
        <div style={{ background: '#f4f8fc', border: '1px solid #c7d6ea', borderRadius: 10, padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 10 }}>
            {newEvent.title || '새 사건'} 상세 입력
          </p>

          {newEvent.category === '직접 입력' && (
            <input
              value={newEvent.title}
              onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
              placeholder="사건 이름 (예: 어머니의 죽음)"
              style={{
                width: '100%', border: 'none', borderBottom: '0.5px solid #1A3C6E',
                padding: '6px 0', color: '#1A3C6E',
                background: 'transparent', outline: 'none',
                marginBottom: 10, fontSize: 16,
              }}
            />
          )}

          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>언제 일어났나요?</p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['유년기 (0~12세)', '청소년기 (13~19세)', '청년기 (20~30대)', '중년기 (40~50대)', '이야기 시작 직전', '이야기 중'].map(t => (
                <button key={t} onClick={() => setNewEvent(prev => ({ ...prev, timing: t }))}
                  style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: 10,
                    border: `1px solid ${newEvent.timing === t ? '#1A3C6E' : '#c7d6ea'}`,
                    background: newEvent.timing === t ? '#1A3C6E' : '#fff',
                    color: newEvent.timing === t ? '#fff' : '#1A3C6E',
                    cursor: 'pointer',
                  }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>이 사건이 주인공에게 미친 영향</p>
            <textarea
              value={newEvent.impact}
              onChange={e => setNewEvent(prev => ({ ...prev, impact: e.target.value }))}
              placeholder="예: 이후 바다를 두려워하게 됨. 형에 대한 죄책감의 시작."
              rows={3}
              style={{
                width: '100%', border: '1px dashed #c7d6ea', borderRadius: 8,
                padding: '7px 10px', fontSize: 12, color: '#374151',
                background: '#fff', resize: 'none', outline: 'none',
                lineHeight: 1.6, fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setNewEvent(prev => ({ ...prev, isCore: !prev.isCore }))}
              style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 11,
                border: `1px solid ${newEvent.isCore ? '#E24B4A' : '#c7d6ea'}`,
                background: newEvent.isCore ? '#FCEBEB' : '#fff',
                color: newEvent.isCore ? '#A32D2D' : '#9ca3af',
                cursor: 'pointer',
              }}
            >{newEvent.isCore ? '🔴 핵심 사건' : '핵심 사건으로 지정'}</button>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>단편 기준 1~2개 권장</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addEvent} style={{
              flex: 1, padding: '9px', borderRadius: 8, border: 'none',
              background: '#1A3C6E', color: '#fff', fontSize: 13, cursor: 'pointer',
            }}>사건 추가</button>
            <button onClick={() => setShowForm(false)} style={{
              padding: '9px 16px', borderRadius: 8,
              border: '0.5px solid #e5e7eb', background: '#fff',
              color: '#9ca3af', fontSize: 12, cursor: 'pointer',
            }}>취소</button>
          </div>
        </div>
      )}

      {/* 등록된 사건 목록 */}
      {s.events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E' }}>등록된 사건</p>
          {s.events.map((ev, i) => (
            <div key={ev.id} style={{
              background: '#fff',
              border: `1px solid ${ev.isCore ? '#E24B4A' : '#e5e7eb'}`,
              borderRadius: 10, padding: 11,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {ev.isCore && <span style={{ fontSize: 10, background: '#FCEBEB', color: '#A32D2D', padding: '2px 7px', borderRadius: 99 }}>핵심</span>}
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E' }}>
                      {i + 1}. {ev.title}
                    </span>
                  </div>
                  {ev.timing && <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>⏱ {ev.timing}</p>}
                  {ev.impact && <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>{ev.impact}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <button onClick={() => toggleCore(ev.id)} style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 99,
                    border: '0.5px solid #e5e7eb', background: '#fff',
                    color: ev.isCore ? '#A32D2D' : '#9ca3af', cursor: 'pointer',
                  }}>{ev.isCore ? '핵심해제' : '핵심'}</button>
                  <button onClick={() => removeEvent(ev.id)} style={{
                    fontSize: 10, color: '#dc2626', background: 'none',
                    border: 'none', cursor: 'pointer',
                  }}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ tabs, s }: { tabs: Tab[]; s: NovelSettings }) {
  let score = tabs.length;
  if (s.events.length > 0) score += 1;
  if (s.events.some(e => e.isCore)) score += 1;
  const pct = Math.min(100, Math.round((score / 9) * 100));
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: 10, marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#1A3C6E' }}>설정 완성도</span>
        <span style={{ fontSize: 11, color: '#10b981' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 5, textAlign: 'center' }}>
        더 많이 채울수록 AI가 더 탄탄한 이야기를 만듭니다
      </p>
    </div>
  );
}

export function NovelStudio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('birth');
  const [visitedTabs, setVisitedTabs] = useState<Tab[]>(['birth']);
  const [settings, setSettings] = useState<NovelSettings>(defaultSettings);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 앱 시작 시 불러오기
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'novelSettings', 'draft'));
        if (snap.exists()) {
          const data = snap.data();
          delete data.updatedAt;
          setSettings(prev => ({ ...prev, ...data }));
          setSaveStatus('saved');
        }
      } catch(e) { console.error(e); }
    })();
  }, [user?.uid]);

  // 수동 저장 함수
  const saveNow = useCallback(async (data: NovelSettings) => {
    if (!user?.uid) return;
    setSaveStatus('saving');
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'novelSettings', 'draft'),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaveStatus('saved');
    } catch(e) {
      console.error(e);
      setSaveStatus('unsaved');
    }
  }, [user?.uid]);

  const upd = (key: keyof NovelSettings, value: any) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      setSaveStatus('unsaved');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => saveNow(next), 2500);
      return next;
    });
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF9F6' }}>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>로그인이 필요합니다.</p>
      </div>
    );
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (!visitedTabs.includes(tab)) setVisitedTabs(p => [...p, tab]);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6', color: '#1A3C6E', paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        padding: '12px 16px',
        borderBottom: '0.5px solid #e5e5e5',
        background: '#FAF9F6',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔮</span>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E' }}>HARU예언</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => saveNow(settings)}
              style={{
                padding: '5px 12px', borderRadius: 99,
                border: 'none',
                background: saveStatus === 'saved' ? '#10b981'
                  : saveStatus === 'saving' ? '#F9CB42' : '#E24B4A',
                color: '#fff', fontSize: 11,
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {saveStatus === 'saved' ? '✓ 저장됨'
                : saveStatus === 'saving' ? '저장 중...' : '💾 저장하기'}
            </button>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>v0.1</span>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ overflowX: 'auto', borderBottom: '0.5px solid #e5e5e5', background: '#fff' }}>
        <div style={{ display: 'flex', maxWidth: 640, margin: '0 auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              style={{
                flexShrink: 0,
                padding: '10px 14px',
                fontSize: 12,
                border: 'none',
                borderBottom: `2px solid ${activeTab === t.id ? '#1A3C6E' : 'transparent'}`,
                background: 'transparent',
                color: activeTab === t.id ? '#1A3C6E' : '#9ca3af',
                fontWeight: activeTab === t.id ? 500 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 내용 */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 0' }}>
        {activeTab === 'motive'    && <MotiveTab    s={settings} upd={upd} />}
        {activeTab === 'birth'     && <BirthTab />}
        {activeTab === 'desire'    && <DesireTab />}
        {activeTab === 'shackle'   && <ShackleTab />}
        {activeTab === 'luck'      && <LuckTab />}
        {activeTab === 'narrative' && <NarrativeTab />}
        {activeTab === 'chars'     && <CharsTab     s={settings} upd={upd} />}
        {activeTab === 'events'    && <EventsTab    s={settings} upd={upd} />}

        <div style={{ marginTop: 16 }}>
          <ProgressBar tabs={visitedTabs} s={settings} />
        </div>

        <button
          onClick={() => navigate('/novel-synopsis')}
          style={{
            width: '100%', marginTop: 12, padding: '14px',
            borderRadius: 10, border: 'none',
            background: '#1A3C6E', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          시놉시스 생성 →
        </button>
      </div>
    </div>
  );
}
