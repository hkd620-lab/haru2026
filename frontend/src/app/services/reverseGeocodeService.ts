import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export type ReverseGeocodeCandidate = {
  regionLabel?: string;
  roadAddress?: string;
  jibunAddress?: string;
  source: 'kakao';
};

type ReverseGeocodeResult = {
  success?: boolean;
  regionLabel?: string;
  roadAddress?: string;
  jibunAddress?: string;
  reason?: string;
};

const reverseGeocodeKakao = httpsCallable<
  { latitude: number; longitude: number },
  ReverseGeocodeResult
>(functions, 'reverseGeocodeKakao');

export async function getLocationCandidateFromGps(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeCandidate | null> {
  const result = await reverseGeocodeKakao({ latitude, longitude });
  const data = result.data;

  if (!data?.success) return null;
  if (!data.regionLabel && !data.roadAddress && !data.jibunAddress) return null;

  return {
    regionLabel: data.regionLabel,
    roadAddress: data.roadAddress,
    jibunAddress: data.jibunAddress,
    source: 'kakao',
  };
}
