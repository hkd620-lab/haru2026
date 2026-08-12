import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';

type HomeTileOption = {
  key: string;
  label: string;
  sub: string;
};

type HomePersonalizationModalProps = {
  isOpen: boolean;
  records: HomeTileOption[];
  agents: HomeTileOption[];
  initialRecordKeys: string[];
  initialAgentKeys: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (selection: { selectedRecordFormats: string[]; selectedAgents: string[] }) => void | Promise<void>;
};

const FONT_KR = "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const FONT_SERIF = "'MaruBuri', 'Pretendard', serif";

export function HomePersonalizationModal({
  isOpen,
  records,
  agents,
  initialRecordKeys,
  initialAgentKeys,
  saving = false,
  onClose,
  onSave,
}: HomePersonalizationModalProps) {
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(() => new Set(initialRecordKeys));
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(() => new Set(initialAgentKeys));

  useEffect(() => {
    if (!isOpen) return;
    setSelectedRecords(new Set(initialRecordKeys));
    setSelectedAgents(new Set(initialAgentKeys));
  }, [isOpen, initialRecordKeys, initialAgentKeys]);

  const totalSelected = selectedRecords.size + selectedAgents.size;
  const allRecordKeys = useMemo(() => records.map((item) => item.key), [records]);
  const allAgentKeys = useMemo(() => agents.map((item) => item.key), [agents]);

  if (!isOpen) return null;

  const toggle = (
    key: string,
    setter: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedRecords(new Set(allRecordKeys));
    setSelectedAgents(new Set(allAgentKeys));
  };

  const clearAll = () => {
    setSelectedRecords(new Set());
    setSelectedAgents(new Set());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-personalization-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(44,44,42,0.36)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        fontFamily: FONT_KR,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        style={{
          width: 'min(920px, 100%)',
          maxHeight: 'min(780px, 92vh)',
          overflow: 'auto',
          background: '#F5F0E8',
          border: '1px solid #E5DFD0',
          borderRadius: 22,
          boxShadow: '0 24px 70px -34px rgba(44,44,42,0.55)',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            background: 'rgba(245,240,232,0.96)',
            backdropFilter: 'blur(6px)',
            borderBottom: '1px solid #E5DFD0',
            padding: '20px 22px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="home-personalization-title"
                style={{
                  margin: 0,
                  fontFamily: FONT_SERIF,
                  fontSize: 24,
                  color: '#2C2C2A',
                  letterSpacing: 0,
                }}
              >
                내 HARU 관리
              </h2>
              <p style={{ margin: '6px 0 0', color: '#7A6F5A', fontSize: 12, lineHeight: 1.6 }}>
                자주 쓰는 기록과 AI 비서만 골라 홈에 표시합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="내 HARU 관리 닫기"
              style={iconButtonStyle}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <span style={countPillStyle}>선택 {totalSelected}개</span>
            <button type="button" onClick={selectAll} disabled={saving} style={miniButtonStyle}>전체 선택</button>
            <button type="button" onClick={clearAll} disabled={saving} style={miniButtonStyle}>전체 해제</button>
          </div>
        </div>

        <div style={{ padding: 22, display: 'grid', gap: 24 }}>
          <OptionGroup
            title="HARU 기록"
            options={records}
            selected={selectedRecords}
            onToggle={(key) => toggle(key, setSelectedRecords)}
          />
          <OptionGroup
            title="HARU AI 비서"
            options={agents}
            selected={selectedAgents}
            onToggle={(key) => toggle(key, setSelectedAgents)}
          />
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'rgba(245,240,232,0.96)',
            backdropFilter: 'blur(6px)',
            borderTop: '1px solid #E5DFD0',
            padding: '14px 22px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button type="button" onClick={onClose} disabled={saving} style={secondaryButtonStyle}>
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave({
              selectedRecordFormats: Array.from(selectedRecords),
              selectedAgents: Array.from(selectedAgents),
            })}
            style={primaryButtonStyle}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: HomeTileOption[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <section>
      <h3
        style={{
          margin: '0 0 12px',
          fontFamily: FONT_SERIF,
          fontSize: 18,
          color: '#2C2C2A',
          letterSpacing: 0,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        {options.map((option) => {
          const checked = selected.has(option.key);
          return (
            <label
              key={option.key}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                minHeight: 76,
                borderRadius: 14,
                border: `1px solid ${checked ? '#7A8B4E' : '#E5DFD0'}`,
                background: checked ? '#FFFFFF' : 'rgba(255,255,255,0.56)',
                padding: 12,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option.key)}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: '#4A5A2C', flexShrink: 0 }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ color: '#2C2C2A', fontSize: 13, fontWeight: 700 }}>{option.label}</span>
                <span style={{ color: '#7A6F5A', fontSize: 11, lineHeight: 1.45 }}>{option.sub}</span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

const iconButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: '1px solid #E5DFD0',
  background: '#fff',
  color: '#7A6F5A',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const countPillStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid #D4DEA0',
  background: '#fff',
  color: '#4A5A2C',
  padding: '6px 11px',
  fontSize: 12,
  fontWeight: 700,
};

const miniButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid #E5DFD0',
  background: '#fff',
  color: '#7A6F5A',
  padding: '6px 11px',
  fontSize: 12,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid #E5DFD0',
  background: '#fff',
  color: '#7A6F5A',
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid #4A5A2C',
  background: '#4A5A2C',
  color: '#F5F0E8',
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
};

export type { HomeTileOption };
