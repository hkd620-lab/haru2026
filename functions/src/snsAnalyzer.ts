import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JSZip = require('jszip');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Facebook JSON exports double-encode Korean: bytes are UTF-8 but the JSON
// stores them as latin1 escape sequences. Buffer reinterpretation restores them.
function fixFbEncoding(s: string): string {
  if (!s) return '';
  try {
    return Buffer.from(s, 'latin1').toString('utf8');
  } catch {
    return s;
  }
}

interface FbPostMedia {
  uri?: string;
  creation_timestamp?: number;
  media_metadata?: any;
}

interface FbPostData {
  post?: string;
  update_timestamp?: number;
}

interface FbPost {
  timestamp?: number;
  data?: FbPostData[];
  attachments?: { data?: { media?: FbPostMedia; external_context?: any }[] }[];
  title?: string;
}

export const analyzeFacebookZip = onCall(
  {
    region: 'asia-northeast3',
    memory: '2GiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    const { storagePath, source } = (request.data || {}) as {
      storagePath?: string;
      source?: string;
    };
    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('invalid-argument', 'storagePath가 필요합니다.');
    }
    if (source !== 'facebook') {
      throw new HttpsError('invalid-argument', '현재 Facebook만 지원됩니다.');
    }
    if (!storagePath.startsWith(`users/${uid}/`)) {
      throw new HttpsError('permission-denied', '본인 경로만 처리할 수 있습니다.');
    }

    const bucket = admin.storage().bucket();
    const zipFile = bucket.file(storagePath);

    let zipBuffer: Buffer;
    try {
      const [buf] = await zipFile.download();
      zipBuffer = buf;
    } catch (e: any) {
      logger.error('ZIP 다운로드 실패:', e);
      throw new HttpsError('not-found', 'ZIP 파일을 찾을 수 없습니다.');
    }

    let zip: any;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch (e: any) {
      logger.error('ZIP 파싱 실패:', e);
      throw new HttpsError('invalid-argument', 'ZIP 파일을 열 수 없습니다.');
    }

    // 게시물 JSON 파일 후보 (1개 이상일 수 있음)
    const postJsonNames = Object.keys(zip.files).filter((n) =>
      /your_posts__check_ins__photos_and_videos_\d+\.json$/i.test(n)
    );
    if (postJsonNames.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'your_posts__check_ins__photos_and_videos_*.json 파일을 ZIP에서 찾지 못했습니다. JSON 형식으로 신청한 ZIP인지 확인해주세요.'
      );
    }

    let allPosts: FbPost[] = [];
    for (const name of postJsonNames) {
      try {
        const raw = await zip.files[name].async('string');
        const fixed = fixFbEncoding(raw);
        const parsed = JSON.parse(fixed);
        if (Array.isArray(parsed)) allPosts = allPosts.concat(parsed as FbPost[]);
      } catch (e) {
        logger.warn(`JSON 파싱 실패: ${name}`, e);
      }
    }

    if (allPosts.length === 0) {
      throw new HttpsError('failed-precondition', '게시물을 찾지 못했습니다.');
    }

    let saved = 0;
    let skippedDuplicates = 0;
    const colRef = db.collection('users').doc(uid).collection('snsRecords');

    // 기존 저장 데이터의 (timestamp + text) 키 미리 로드 → 중복 저장 방지
    const existingKeys = new Set<string>();
    try {
      const existingSnap = await colRef.get();
      existingSnap.forEach((d) => {
        const data = d.data() as any;
        existingKeys.add(`${data.timestamp || 0}__${fixFbEncoding(data.text || '')}`);
      });
    } catch (e) {
      logger.warn('기존 snsRecords 로드 실패:', e);
    }

    for (const post of allPosts) {
      const ts =
        typeof post.timestamp === 'number'
          ? post.timestamp
          : post.data?.[0]?.update_timestamp || 0;
      const text = (post.data || [])
        .map((d) => (d.post ? d.post : ''))
        .filter(Boolean)
        .join('\n')
        .trim();

      const mediaItems: FbPostMedia[] = [];
      for (const att of post.attachments || []) {
        for (const item of att.data || []) {
          if (item.media?.uri) mediaItems.push(item.media);
        }
      }

      // 텍스트와 사진이 모두 없으면 스킵
      if (!text && mediaItems.length === 0) continue;

      // 중복 저장 방지: 같은 timestamp + 같은 텍스트는 스킵
      const dedupKey = `${ts}__${fixFbEncoding(text)}`;
      if (existingKeys.has(dedupKey)) {
        skippedDuplicates++;
        continue;
      }
      existingKeys.add(dedupKey);

      const docRef = colRef.doc();
      const thumbnails: string[] = [];

      // 사진 최대 3장만 처리 (저장 비용 절감)
      const photosToProcess = mediaItems.slice(0, 3);
      for (let i = 0; i < photosToProcess.length; i++) {
        const m = photosToProcess[i];
        if (!m.uri) continue;
        try {
          const photoFile = zip.file(m.uri);
          if (!photoFile) continue;
          const photoBuf: Buffer = await photoFile.async('nodebuffer');
          const resized = await sharp(photoBuf)
            .resize({ width: 400, withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
          const thumbPath = `users/${uid}/snsThumbnails/${docRef.id}/${i}.jpg`;
          const thumbFile = bucket.file(thumbPath);
          await thumbFile.save(resized, {
            contentType: 'image/jpeg',
            metadata: { cacheControl: 'public, max-age=31536000' },
          });
          await thumbFile.makePublic();
          thumbnails.push(
            `https://storage.googleapis.com/${bucket.name}/${thumbPath}`
          );
        } catch (e) {
          logger.warn(`썸네일 처리 실패 (${m.uri}):`, e);
        }
      }

      await docRef.set({
        source: 'facebook',
        timestamp: ts,
        text: fixFbEncoding(text),
        thumbnails,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      saved++;
    }

    // 원본 ZIP 삭제
    try {
      await zipFile.delete();
    } catch (e) {
      logger.warn('원본 ZIP 삭제 실패:', e);
    }

    logger.info(`analyzeFacebookZip 완료: uid=${uid}, saved=${saved}, skippedDuplicates=${skippedDuplicates}`);
    return { success: true, count: saved };
  }
);
