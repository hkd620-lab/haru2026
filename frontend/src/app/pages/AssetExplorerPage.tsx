import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FolderPlus, Loader2, Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { toast } from 'sonner';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { AssetCandidateModal, type AssetCandidate } from '../components/AssetCandidateModal';

type SavedAsset = {
  id: string;
  title: string;
  mimeType?: string;
  driveUrl?: string;
  kind?: string;
  thumbnailLink?: string;
  iconLink?: string;
  updatedAt?: { toDate?: () => Date };
};

type CandidateResponse = {
  haruFolderId: string;
  candidates: AssetCandidate[];
};

type CopyResponse = {
  copiedCount: number;
};

function formatSavedDate(asset: SavedAsset) {
  const date = asset.updatedAt?.toDate?.();
  if (!date) return '';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function AssetExplorerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([]);
  const [searchText, setSearchText] = useState('');
  const [hasDriveConnection, setHasDriveConnection] = useState(searchParams.get('drive') === 'connected');

  const filteredAssets = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return savedAssets;
    return savedAssets.filter((asset) => asset.title.toLowerCase().includes(keyword));
  }, [savedAssets, searchText]);

  const loadAssets = async () => {
    if (!user?.uid) return;
    const snap = await getDocs(query(collection(db, 'users', user.uid, 'assets'), orderBy('updatedAt', 'desc')));
    setSavedAssets(
      snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<SavedAsset, 'id'>),
      }))
    );
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (searchParams.get('drive') === 'connected') {
      toast.success('Google Drive 연결이 완료되었습니다.');
      setHasDriveConnection(true);
    } else if (searchParams.get('drive') === 'error') {
      toast.error('Google Drive 연결에 실패했습니다.');
    }
  }, [searchParams]);

  useEffect(() => {
    loadAssets().catch((error) => {
      console.error('자산 목록 로드 실패:', error);
      toast.error('HARU 자산 목록을 불러오지 못했습니다.');
    });
  }, [user?.uid]);

  const connectDrive = async () => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    setIsConnecting(true);
    try {
      const startConnect = httpsCallable<unknown, { authUrl: string }>(functions, 'startHaruDriveConnect');
      const result = await startConnect({});
      window.location.href = result.data.authUrl;
    } catch (error: any) {
      console.error('Drive 연결 시작 실패:', error);
      toast.error(error?.message || 'Google Drive 연결을 시작하지 못했습니다.');
      setIsConnecting(false);
    }
  };

  const loadCandidates = async () => {
    setIsLoadingCandidates(true);
    try {
      const getCandidates = httpsCallable<unknown, CandidateResponse>(functions, 'getHaruDriveCandidates');
      const result = await getCandidates({});
      setCandidates(result.data.candidates || []);
      setSelectedIds([]);
      setHasDriveConnection(true);
      setModalOpen(true);
    } catch (error: any) {
      console.error('자산 후보 탐색 실패:', error);
      const message = String(error?.message || '');
      if (message.includes('Google Drive 연결')) {
        toast.error('Google Drive 연결이 필요합니다.');
      } else {
        toast.error(error?.message || '최근 자산 후보를 불러오지 못했습니다.');
      }
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const copySelectedAssets = async () => {
    if (selectedIds.length === 0) return;
    setIsCopying(true);
    try {
      const copyAssets = httpsCallable<{ fileIds: string[] }, CopyResponse>(functions, 'copyHaruDriveAssets');
      const result = await copyAssets({ fileIds: selectedIds });
      toast.success('선택한 기록 자산을 정리했습니다.');
      setModalOpen(false);
      setSelectedIds([]);
      await loadAssets();
      if (result.data.copiedCount === 0) {
        toast.warning('복사 가능한 문서·이미지·PDF가 없었습니다.');
      }
    } catch (error: any) {
      console.error('자산 복사 실패:', error);
      toast.error(error?.message || '선택한 자산을 복사하지 못했습니다.');
    } finally {
      setIsCopying(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', background: '#FAF9F6', padding: '18px 14px 32px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#1A3C6E',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 0',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          돌아가기
        </button>

        <header style={{ margin: '8px 0 18px' }}>
          <h1 style={{ margin: 0, color: '#1A3C6E', fontSize: 24, fontWeight: 900 }}>
            ☁️ HARU 클라우드 기록탐정
          </h1>
          <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14, lineHeight: 1.6 }}>
            개인의 기록 자산을 안전하게 연결하고 정리합니다
          </p>
        </header>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e8e2d8',
            borderRadius: 10,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: '0 0 12px', color: '#1A3C6E', fontSize: 16, fontWeight: 900 }}>
            클라우드 연결
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {/* iCloud 카드 — 준비중 */}
            <button
              type="button"
              onClick={() => toast.info('iCloud 연결은 준비중입니다')}
              style={{
                textAlign: 'left',
                border: '1px solid #e6e2d8',
                background: '#FBFAF6',
                borderRadius: 10,
                padding: 14,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🍎</span>
                <p style={{ margin: 0, color: '#1A3C6E', fontSize: 15, fontWeight: 800 }}>
                  iCloud 연결
                </p>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#8a6d1f',
                    background: '#fff5d6',
                    border: '1px solid #e8d68a',
                    borderRadius: 6,
                    padding: '2px 8px',
                  }}
                >
                  준비중
                </span>
              </div>
              <p style={{ margin: 0, color: '#777', fontSize: 12, lineHeight: 1.55 }}>
                아이폰·맥 기록 자산 연결
              </p>
            </button>

            {/* Google Drive 카드 — 실연결 */}
            <div
              style={{
                border: '1px solid #d6e0f0',
                background: '#fff',
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>📁</span>
                <p style={{ margin: 0, color: '#1A3C6E', fontSize: 15, fontWeight: 800 }}>
                  Google Drive 연결
                </p>
                {hasDriveConnection && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#166534',
                      background: '#DCFCE7',
                      border: '1px solid #bbf7d0',
                      borderRadius: 6,
                      padding: '2px 8px',
                    }}
                  >
                    연결됨
                  </span>
                )}
              </div>
              <p style={{ margin: 0, color: '#777', fontSize: 12, lineHeight: 1.55 }}>
                문서·사진·PDF 자동 연결
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={connectDrive}
                  disabled={isConnecting}
                  style={{
                    border: '1px solid #1A3C6E',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#1A3C6E',
                    padding: '8px 11px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: isConnecting ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {isConnecting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  {hasDriveConnection ? '다시 연결' : '연결하기'}
                </button>
                <button
                  type="button"
                  onClick={loadCandidates}
                  disabled={isLoadingCandidates}
                  style={{
                    border: 'none',
                    borderRadius: 8,
                    background: '#1A3C6E',
                    color: '#fff',
                    padding: '8px 11px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: isLoadingCandidates ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {isLoadingCandidates ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />}
                  최근 자산 추천
                </button>
              </div>
            </div>

            {/* OneDrive 카드 — 준비중 */}
            <button
              type="button"
              onClick={() => toast.info('OneDrive 연결은 준비중입니다')}
              style={{
                textAlign: 'left',
                border: '1px solid #e6e2d8',
                background: '#FBFAF6',
                borderRadius: 10,
                padding: 14,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🪟</span>
                <p style={{ margin: 0, color: '#1A3C6E', fontSize: 15, fontWeight: 800 }}>
                  OneDrive 연결
                </p>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#8a6d1f',
                    background: '#fff5d6',
                    border: '1px solid #e8d68a',
                    borderRadius: 6,
                    padding: '2px 8px',
                  }}
                >
                  준비중
                </span>
              </div>
              <p style={{ margin: 0, color: '#777', fontSize: 12, lineHeight: 1.55 }}>
                Windows 파일 자산 연결
              </p>
            </button>
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e8e2d8',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: '#1A3C6E', fontSize: 17, fontWeight: 900 }}>
              내 기록 자산
            </h2>
            <div style={{ position: 'relative', width: 'min(100%, 320px)' }}>
              <Search size={16} style={{ position: 'absolute', left: 11, top: 11, color: '#888' }} />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="기록 자산 검색"
                style={{
                  width: '100%',
                  height: 38,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: '0 10px 0 34px',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div style={{ padding: '34px 10px', textAlign: 'center', color: '#777', fontSize: 14 }}>
              {savedAssets.length === 0 ? '아직 정리한 기록 자산이 없습니다.' : '검색 결과가 없습니다.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {filteredAssets.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.driveUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: 'none',
                    color: '#1A3C6E',
                    border: '1px solid #ececec',
                    borderRadius: 8,
                    padding: 12,
                    display: 'grid',
                    gridTemplateColumns: '38px minmax(0, 1fr)',
                    gap: 10,
                    alignItems: 'center',
                    background: '#fff',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      border: '1px solid #eee',
                      background: '#FAF9F6',
                      overflow: 'hidden',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {asset.thumbnailLink ? (
                      <img src={asset.thumbnailLink} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : asset.iconLink ? (
                      <img src={asset.iconLink} alt="" style={{ width: 20, height: 20 }} />
                    ) : (
                      <span>📄</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.title}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777' }}>
                      {asset.kind || asset.mimeType || '파일'} {formatSavedDate(asset)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ========== HARU 철학 안내 ========== */}
        <section
          style={{
            marginTop: 14,
            background: '#FBFAF6',
            border: '1px solid #e8e2d8',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <p style={{ margin: 0, color: '#1A3C6E', fontSize: 14, fontWeight: 900 }}>
            기록이 쌓여 가치가 됩니다
          </p>
          <p style={{ margin: '6px 0 0', color: '#666', fontSize: 13, lineHeight: 1.6 }}>
            HARU는 사진·문서·관찰·생각을 연결해 개인의 기록 자산으로 정리합니다.
          </p>
        </section>
      </div>

      <AssetCandidateModal
        open={modalOpen}
        candidates={candidates}
        selectedIds={selectedIds}
        isCopying={isCopying}
        onClose={() => setModalOpen(false)}
        onToggle={toggleSelected}
        onCopy={copySelectedAssets}
      />
    </div>
  );
}
