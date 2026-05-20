import { X } from 'lucide-react';

export type AssetCandidate = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  kind?: string;
};

type AssetCandidateModalProps = {
  open: boolean;
  candidates: AssetCandidate[];
  selectedIds: string[];
  isCopying: boolean;
  onClose: () => void;
  onToggle: (id: string) => void;
  onCopy: () => void;
};

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function AssetCandidateModal({
  open,
  candidates,
  selectedIds,
  isCopying,
  onClose,
  onToggle,
  onCopy,
}: AssetCandidateModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.34)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '86vh',
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#1A3C6E', fontWeight: 800 }}>
              자산 후보 선택
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
              선택한 자산만 HARU 폴더에 정리합니다
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              background: '#fff',
              color: '#444',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ overflow: 'auto', padding: 12 }}>
          {candidates.length === 0 ? (
            <div style={{ padding: '36px 12px', textAlign: 'center', color: '#777', fontSize: 14 }}>
              최근 문서·이미지·PDF 후보가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map((file) => {
                const checked = selectedIds.includes(file.id);
                return (
                  <label
                    key={file.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px 44px minmax(0, 1fr)',
                      gap: 10,
                      alignItems: 'center',
                      padding: 10,
                      border: `1px solid ${checked ? '#1A3C6E' : '#ececec'}`,
                      borderRadius: 8,
                      background: checked ? '#F5F8FC' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(file.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        border: '1px solid #eee',
                        background: '#FAF9F6',
                        overflow: 'hidden',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : file.iconLink ? (
                        <img src={file.iconLink} alt="" style={{ width: 22, height: 22 }} />
                      ) : (
                        <span style={{ fontSize: 18 }}>📄</span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#1A3C6E',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {file.name}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777' }}>
                        {file.kind || file.mimeType} · {formatDate(file.modifiedTime)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 12,
            borderTop: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: '#666' }}>{selectedIds.length}개 선택</span>
          <button
            type="button"
            onClick={onCopy}
            disabled={selectedIds.length === 0 || isCopying}
            style={{
              border: 'none',
              borderRadius: 8,
              background: selectedIds.length === 0 || isCopying ? '#B8C0CC' : '#1A3C6E',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              padding: '12px 16px',
              cursor: selectedIds.length === 0 || isCopying ? 'not-allowed' : 'pointer',
            }}
          >
            {isCopying ? '복사 중...' : '/HARU 폴더로 복사'}
          </button>
        </div>
      </div>
    </div>
  );
}
