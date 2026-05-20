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
      toast.success('선택한 자산을 HARU 폴더에 복사했습니다.');
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
            📦 HARU 기록탐정
          </h1>
          <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14, lineHeight: 1.6 }}>
            선택한 기록만 HARU 폴더에 정리합니다 — Google Drive 연결
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, color: '#1A3C6E', fontSize: 16, fontWeight: 800 }}>
                Google Drive 연결
              </p>
              <p style={{ margin: '6px 0 0', color: '#777', fontSize: 13 }}>
                연결 후 `/HARU` 폴더를 확인하고, 최근 문서·이미지·PDF 후보만 보여드립니다.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={connectDrive}
                disabled={isConnecting}
                style={{
                  border: '1px solid #1A3C6E',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#1A3C6E',
                  padding: '11px 13px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: isConnecting ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isConnecting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Drive 연결
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
                  padding: '11px 13px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: isLoadingCandidates ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isLoadingCandidates ? <Loader2 size={15} className="animate-spin" /> : <FolderPlus size={15} />}
                후보 탐색
              </button>
            </div>
          </div>
          {hasDriveConnection && (
            <p style={{ margin: '12px 0 0', color: '#4A5A2C', fontSize: 12, fontWeight: 700 }}>
              Google Drive 연결 상태를 확인했습니다.
            </p>
          )}
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
              HARU 자산 검색
            </h2>
            <div style={{ position: 'relative', width: 'min(100%, 320px)' }}>
              <Search size={16} style={{ position: 'absolute', left: 11, top: 11, color: '#888' }} />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="파일명 검색"
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
              {savedAssets.length === 0 ? '아직 HARU 폴더에 정리한 자산이 없습니다.' : '검색 결과가 없습니다.'}
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
