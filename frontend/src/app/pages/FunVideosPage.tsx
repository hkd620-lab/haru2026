import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
type Video = { id: string; title: string; url: string; videoId: string; createdAt?: { seconds: number } };

function parseYoutubeId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.slice(1).split('/')[0];
    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2];
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function FunVideosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entitlement, loading: subscriptionLoading } = useSubscription();
  const isDeveloper = user?.uid === DEVELOPER_UID;
  const canView = isDeveloper || entitlement.hasPaidAccess;
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [metadataStatus, setMetadataStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const videoId = parseYoutubeId(url);
  const isDuplicate = Boolean(videoId && videos.some(video => video.id === videoId));

  useEffect(() => {
    setTitle('');
    if (!isDeveloper || !videoId || isDuplicate) { setMetadataStatus('idle'); return; }
    let cancelled = false;
    setMetadataStatus('loading');
    const timer = window.setTimeout(async () => {
      try {
        const lookup = httpsCallable<{ videoId: string }, { title: string; channelTitle: string }>(functions, 'getFunVideoMetadata');
        const result = await lookup({ videoId });
        if (cancelled) return;
        setTitle(current => current.trim() || result.data.title);
        setMetadataStatus('ready');
      } catch {
        if (!cancelled) setMetadataStatus('error');
      }
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [isDeveloper, videoId, isDuplicate]);

  useEffect(() => {
    if (!user || subscriptionLoading || !canView) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    if (isDeveloper) {
      return onSnapshot(collection(db, 'funVideos'), snapshot => {
        setVideos(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Video))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        setLoading(false);
      }, () => { setLoading(false); setLoadError(true); });
    }
    let cancelled = false;
    const load = httpsCallable<void, { videos: Video[] }>(functions, 'getFunVideos');
    load().then(result => {
      if (cancelled) return;
      setVideos(result.data.videos);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      setLoadError(true);
    });
    return () => { cancelled = true; };
  }, [user, subscriptionLoading, canView, isDeveloper]);

  const publish = async () => {
    if (!isDeveloper || !videoId || !title.trim() || isDuplicate) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'funVideos', videoId), {
        title: title.trim().slice(0, 100), videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        createdAt: serverTimestamp(),
      });
      setUrl(''); setTitle(''); toast.success('영상이 게시되었습니다.');
    } catch { toast.error('게시하지 못했습니다. 다시 시도해주세요.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!isDeveloper || !window.confirm('이 영상을 목록에서 내릴까요?')) return;
    try { await deleteDoc(doc(db, 'funVideos', id)); toast.success('목록에서 내렸습니다.'); }
    catch { toast.error('영상을 내리지 못했습니다.'); }
  };

  return <div className="min-h-screen bg-[#FEFBE8] px-4 pb-24 pt-8 text-[#27332e]">
    <div className="mx-auto max-w-4xl">
      <button type="button" onClick={() => navigate('/')} className="mb-7 text-sm font-semibold">← HARU</button>
      <div className="rounded-[28px] bg-[#e7efcb] px-7 py-10 sm:px-10">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">잠깐 웃고<br />다시 하루로</h1>
        <p className="mt-4 text-base leading-7">가볍게 보고 기분 전환할 수 있는 짧은 영상 모음.<br />영상을 누르면 유튜브에서 재생됩니다.</p>
      </div>

      {!user && <div className="mt-8 rounded-2xl bg-white p-6">로그인 후 영상을 볼 수 있습니다. <button type="button" className="font-bold underline" onClick={() => navigate('/login')}>로그인하기</button></div>}
      {user && !subscriptionLoading && !canView && <div className="mt-8 rounded-2xl bg-white p-6">구독 중인 회원에게 제공되는 영상 모음입니다. <button type="button" className="font-bold underline" onClick={() => navigate('/subscription')}>구독 살펴보기</button></div>}

      {isDeveloper && <section className="mt-8 rounded-2xl border border-[#dce3d2] bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold">영상 링크 게시</h2>
        <p className="mt-1 text-sm text-[#657268]">유튜브 공유 메뉴에서 복사한 링크를 붙여넣으세요. 쇼츠와 일반 영상을 받습니다.</p>
        <label className="mt-5 block text-sm font-semibold" htmlFor="fun-video-url">유튜브 링크</label>
        <input id="fun-video-url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://youtube.com/shorts/..." className="mt-2 w-full rounded-xl border border-[#bccbb9] px-4 py-3 outline-offset-2" />
        {url && <p className={`mt-2 text-sm ${videoId ? 'text-[#285843]' : 'text-red-700'}`}>{videoId ? '유튜브 링크를 확인했습니다.' : '유튜브 영상 링크를 입력해주세요.'}</p>}
        {isDuplicate && <p className="mt-2 text-sm text-red-700">이미 목록에 있는 영상입니다.</p>}
        {videoId && <div className="mt-4 max-w-sm overflow-hidden rounded-xl border border-[#dce3d2]"><img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="게시 전 영상 썸네일 미리보기" className="aspect-video w-full object-cover" /><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="block p-3 text-sm font-semibold underline">원본 영상 확인하기 ↗</a></div>}
        <label className="mt-5 block text-sm font-semibold" htmlFor="fun-video-title">목록에 표시할 제목</label>
        <input id="fun-video-title" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} placeholder="영상 제목을 확인해 입력하세요" className="mt-2 w-full rounded-xl border border-[#bccbb9] px-4 py-3 outline-offset-2" />
        {metadataStatus === 'loading' && <p className="mt-2 text-sm text-[#657268]">유튜브 원본 제목을 가져오는 중입니다.</p>}
        {metadataStatus === 'ready' && <p className="mt-2 text-sm text-[#285843]">원본 제목을 채웠습니다. 게시 전에 확인하거나 수정할 수 있습니다.</p>}
        {metadataStatus === 'error' && <p className="mt-2 text-sm text-[#657268]">제목을 가져오지 못했습니다. 직접 입력해 게시할 수 있습니다.</p>}
        <button type="button" disabled={!videoId || !title.trim() || isDuplicate || saving} onClick={publish} className="mt-5 rounded-xl bg-[#285843] px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? '게시 중…' : '영상 게시'}</button>
      </section>}

      {canView && <section className="mt-9">
        <h2 className="mb-4 text-2xl font-bold">재미 영상 모음</h2>
        {loading ? <p>영상을 불러오는 중입니다.</p> : loadError ? <div role="alert" className="rounded-2xl bg-white p-6">영상 목록을 불러오지 못했습니다. 잠시 후 다시 열어주세요.</div> : videos.length === 0 ? <div className="rounded-2xl border border-dashed border-[#bac9ae] bg-[#f7faed] p-8 text-center">아직 게시된 영상이 없습니다.</div> :
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{videos.map(video => <article key={video.id} className="overflow-hidden rounded-2xl border border-[#e5e8da] bg-white">
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#e8ae45]">
              <img loading="lazy" src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`} alt="" className="aspect-video w-full bg-[#dce6d1] object-cover" />
              <div className="p-5"><h3 className="min-h-14 text-lg font-bold">{video.title}</h3><span className="mt-3 inline-block rounded-xl bg-[#285843] px-4 py-2 text-sm font-bold text-white">유튜브에서 보기 ↗</span></div>
            </a>
            {isDeveloper && <button type="button" onClick={() => remove(video.id)} className="mb-4 ml-5 text-sm text-red-700 underline">목록에서 내리기</button>}
          </article>)}</div>}
      </section>}
      <p className="mt-8 text-sm text-[#657268]">영상은 유튜브에서 재생됩니다. 원본이 삭제되거나 공개가 제한되면 볼 수 없습니다.</p>
    </div>
  </div>;
}
