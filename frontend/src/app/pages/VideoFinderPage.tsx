// '내 영상 찾기' — HARU 안(/video-finder). 같은 출처의 정상 HARU Firebase 로그인을 그대로 쓴다.
// 화면 본체는 videoFinder/VideoFinderScreen.tsx이며, 독립 주소는 이 파일 대신 전용 세션 호출로 그 화면을 연다.
import { useAuth } from '../contexts/AuthContext';
import { haruVideoFinderClient } from '../videoFinder/videoFinderApi';
import { VideoFinderScreen } from '../videoFinder/VideoFinderScreen';

type Props = {
  basePath: string;
  variant: 'haru';
};

export function VideoFinderPage({ basePath, variant }: Props) {
  const { user } = useAuth();
  return <VideoFinderScreen key={user?.uid} basePath={basePath} variant={variant} client={haruVideoFinderClient} accountKey={user?.uid || ''} />;
}
