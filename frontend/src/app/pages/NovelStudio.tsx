import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';


type Tab = 'birth' | 'desire' | 'shackle' | 'luck' | 'narrative' | 'chars';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'birth',     label: '탄생',   icon: '🌱' },
  { id: 'desire',    label: '욕망',   icon: '🔥' },
  { id: 'shackle',   label: '족쇄',   icon: '⛓' },
  { id: 'luck',      label: '운',     icon: '🍀' },
  { id: 'narrative', label: '서사',   icon: '📖' },
  { id: 'chars',     label: '인물',   icon: '👥' },
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

function BirthTab() {
  const gender   = useSingle('남성');
  const spoon    = useSingle('흙수저');
  const looks    = useSingle('평범함');
  const era      = useMultiSelect(['일제강점기']);
  const region   = useMultiSelect(['어촌·섬']);
  const family   = useMultiSelect(['가부장적 가정']);
  const social   = useMultiSelect(['식민·지배 체제']);
  const [memo1, setMemo1] = useState('');
  const [memo2, setMemo2] = useState('');
  const [memo3, setMemo3] = useState('');

  const genders = ['남성', '여성', '직접 정의'];
  const spoons  = ['흙수저', '동수저', '은수저', '금수저'];
  const looksList = ['매우 추함', '추함', '평범함', '준수함', '미남/미녀'];
  const eras    = ['조선시대', '일제강점기', '한국전쟁', '산업화시대', '현대', '직접 설정'];
  const regions = ['어촌·섬', '농촌', '산촌', '소도시', '대도시', '변방·국경', '해외 이민'];
  const families = ['결손가정', '가부장적 가정', '다자녀 빈곤', '상실의 가정', '명예를 중시', '직접 입력'];
  const socials  = ['식민·지배 체제', '전쟁·분쟁', '경제 공황', '신분·계급 사회', '재난·자연재해', '직접 입력'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionLabel>성별</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {genders.map(g => (
            <Pill key={g} label={g} on={gender.selected === g} onClick={() => gender.set(g)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 성별 관련 특이사항..." value={memo1} onChange={setMemo1} />
      </Card>

      <Card>
        <SectionLabel>경제적 출발 (수저)</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {spoons.map(s => (
            <Pill key={s} label={s} on={spoon.selected === s} onClick={() => spoon.set(s)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 가정 경제 상황..." value={memo2} onChange={setMemo2} />
      </Card>

      <Card>
        <SectionLabel>외모</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {looksList.map(l => (
            <Pill key={l} label={l} on={looks.selected === l} onClick={() => looks.set(l)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 외모 특징..." value={memo3} onChange={setMemo3} />
      </Card>

      <Card>
        <SectionLabel>태어난 시대</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {eras.map(e => (
            <Pill key={e} label={e} on={era.selected.includes(e)} onClick={() => era.toggle(e)} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>태어난 지역</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {regions.map(r => (
            <Pill key={r} label={r} on={region.selected.includes(r)} onClick={() => region.toggle(r)} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>가정환경</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {families.map(f => (
            <Pill key={f} label={f} on={family.selected.includes(f)} onClick={() => family.toggle(f)} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>사회·역사적 환경</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {socials.map(s => (
            <Pill key={s} label={s} on={social.selected.includes(s)} onClick={() => social.toggle(s)} />
          ))}
        </div>
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
        <Memo placeholder="직접 입력: 욕망의 구체적 내용..." value={memo} onChange={setMemo} />
      </Card>

      <Card>
        <SectionLabel>현실적 한계</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {limits.map(l => (
            <Pill key={l} label={l} on={limit.selected.includes(l)} onClick={() => limit.toggle(l)} />
          ))}
        </div>
        <Memo placeholder="직접 입력: 한계의 구체적 내용..." value={memoL} onChange={setMemoL} />
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
        <Memo placeholder="직접 입력: 족쇄의 구체적 내용..." value={memo} onChange={setMemo} />
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

type CharRole = '시동자' | '반대자' | '동조자' | '방관자';
interface Character {
  name: string;
  role: CharRole;
  desc: string;
}

const ROLE_COLOR: Record<CharRole, string> = {
  '시동자': '#185FA5',
  '반대자': '#A32D2D',
  '동조자': '#085041',
  '방관자': '#5F5E5A',
};

function CharsTab() {
  const [chars, setChars] = useState<Character[]>([
    { name: '', role: '시동자', desc: '' },
    { name: '', role: '반대자', desc: '' },
  ]);

  const addChar = () =>
    setChars(p => [...p, { name: '', role: '방관자', desc: '' }]);

  const update = (i: number, field: keyof Character, v: string) =>
    setChars(p => p.map((c, idx) => idx === i ? { ...c, [field]: v } : c));

  const roles: CharRole[] = ['시동자', '반대자', '동조자', '방관자'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#f4f8fc', borderRadius: 8, padding: '8px 10px', fontSize: 10, color: '#1A3C6E', lineHeight: 1.6 }}>
        🟦 시동자: 이야기를 시작하는 힘 &nbsp;|&nbsp; 🟥 반대자: 저항하는 힘<br />
        🟩 동조자: 함께하는 힘 &nbsp;|&nbsp; ⬜ 방관자: 침묵하는 힘
      </div>
      {chars.map((c, i) => (
        <div key={i} style={{
          background: '#fff',
          border: `1px solid ${ROLE_COLOR[c.role]}33`,
          borderRadius: 10, padding: 11,
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {roles.map(r => (
              <button
                key={r}
                onClick={() => update(i, 'role', r)}
                style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 10,
                  border: `1px solid ${ROLE_COLOR[r]}`,
                  background: c.role === r ? ROLE_COLOR[r] : '#fff',
                  color: c.role === r ? '#fff' : ROLE_COLOR[r],
                  cursor: 'pointer',
                }}
              >{r}</button>
            ))}
          </div>
          <input
            value={c.name}
            onChange={e => update(i, 'name', e.target.value)}
            placeholder="인물 이름"
            style={{
              width: '100%', border: 'none',
              borderBottom: `0.5px solid ${ROLE_COLOR[c.role]}`,
              padding: '4px 0',
              color: '#1A3C6E', background: 'transparent',
              outline: 'none', marginBottom: 6, fontSize: 16,
            }}
          />
          <textarea
            value={c.desc}
            onChange={e => update(i, 'desc', e.target.value)}
            placeholder="성격, 욕망, 족쇄, 역할 설명..."
            rows={2}
            style={{
              width: '100%', border: 'none',
              fontSize: 12, color: '#6b7280',
              background: 'transparent', resize: 'none',
              outline: 'none', lineHeight: 1.6, fontFamily: 'inherit',
            }}
          />
        </div>
      ))}
      <button
        onClick={addChar}
        style={{
          width: '100%', padding: 8,
          border: '1px dashed #c7d6ea',
          borderRadius: 8, background: 'transparent',
          color: '#1A3C6E', fontSize: 12, cursor: 'pointer',
        }}
      >+ 인물 추가</button>
    </div>
  );
}

function ProgressBar({ tabs }: { tabs: Tab[] }) {
  const pct = Math.round((tabs.length / 6) * 100);
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
            <span style={{ fontSize: 20 }}>✍️</span>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E' }}>소설 스튜디오</h1>
          </div>
          <span style={{ fontSize: 11, color: '#10b981' }}>초본 v0.1</span>
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
        {activeTab === 'birth'     && <BirthTab />}
        {activeTab === 'desire'    && <DesireTab />}
        {activeTab === 'shackle'   && <ShackleTab />}
        {activeTab === 'luck'      && <LuckTab />}
        {activeTab === 'narrative' && <NarrativeTab />}
        {activeTab === 'chars'     && <CharsTab />}

        <div style={{ marginTop: 16 }}>
          <ProgressBar tabs={visitedTabs} />
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
