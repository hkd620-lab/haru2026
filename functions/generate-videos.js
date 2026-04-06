const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
require('dotenv').config();

admin.initializeApp();
const storage = admin.storage();
const bucket = storage.bucket('haru2026-8abb8.firebasestorage.app');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PROJECT_ID = 'haru2026-8abb8';
const LOCATION = 'us-central1';

const videos = [
  /* 이미 생성 완료된 장면들 (다시 생성하려면 주석 해제)
  {
    id: '01_intro',
    model: 'veo-3.0-generate-preview',
    prompt: 'A cozy morning scene, coffee mug on a wooden table, warm sunlight filtering through a window, smartphone next to the mug with HARU app visible on screen, high-quality cinematic bokeh style, 4k background, calm and peaceful mood',
    aspectRatio: '16:9',
    durationSeconds: 6
  },
  {
    id: '02_problem',
    model: 'veo-3.0-generate-preview',
    prompt: 'Cinematic close-up of fingers typing quickly and roughly on a smartphone in a moving subway, slightly chaotic or busy vibe, urban lighting with light streaks passing by, focus on the screen reflecting hurried motion',
    aspectRatio: '16:9',
    durationSeconds: 6
  },
  {
    id: '03_sayu_magic',
    model: 'veo-3.0-generate-preview',
    prompt: 'Magical transformation on a smartphone screen, rough text turning into glowing golden particles and reforming into beautiful, flowing Korean calligraphy and poetic sentences, premium look, clean UI background, cinematic slow motion',
    aspectRatio: '16:9',
    durationSeconds: 8
  },
  {
    id: '04_multiformat',
    model: 'veo-3.0-generate-preview',
    prompt: 'Rapid but smooth montage of various diary styles: a traveler beside mountains, a mother hugging a baby, a gardener with blooming flowers, all shown as digital screens or layouts in a consistent premium navy and cream aesthetic',
    aspectRatio: '16:9',
    durationSeconds: 8
  },
  {
    id: '05_result_pdf',
    model: 'veo-3.0-generate-preview',
    prompt: 'A high-end leather-bound diary book on a dark wooden shelf with "HARU 2026" embossed in silver on the spine, soft warm spotlight hitting the book, turning pages inside showing beautiful layouts, cinematic feel',
    aspectRatio: '16:9',
    durationSeconds: 8
  },
  */
  {
    id: '06_outro_final',
    model: 'veo-3.0-generate-preview',
    prompt: 'A cinematic reimagining of the HARU app login splash screen. In the center, artistic grape grains gather to form a premium bunch of grapes with a vibrant purple and golden shimmer. Below the logo, a minimalist layout for the main title "HARU2026" and subtitle. Consistent navy blue and cream color palette, soft glowing particles, smooth 4k animation, high-end mobile app landing page vibe.',
    aspectRatio: '16:9',
    durationSeconds: 8
  }
];

async function getAccessToken() {
  const token = await admin.app().options.credential.getAccessToken();
  return token.access_token;
}

async function generateVideo(video, accessToken) {
  console.log(`\n🎬 영상 생성 시작: ${video.id}`);

  const requestBody = {
    instances: [{
      prompt: video.prompt
    }],
    parameters: {
      aspectRatio: video.aspectRatio,
      durationSeconds: 8,
      sampleCount: 1
    }
  };

  // 생성 요청 (v1beta1 + predictLongRunning)
  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${video.model}:predictLongRunning`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(`❌ 요청 실패:`, JSON.stringify(data));
    return null;
  }

  // 비동기 작업 — 폴링
  const operationName = data.name;
  console.log(`⏳ 생성 중... (1~3분 소요)`);

  let result = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 10000)); // 10초 대기
    console.log(`  폴링 ${i + 1}/30...`);

    const pollResponse = await fetch(
      `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${video.model}:fetchPredictOperation`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operationName })
      }
    );
    const pollText = await pollResponse.text();
    let pollData;
    try { pollData = JSON.parse(pollText); } catch(e) { console.log('  폴링 파싱 실패:', pollText.slice(0, 200)); continue; }
    console.log(`  상태:`, JSON.stringify(pollData).slice(0, 200));

    if (pollData.done) {
      result = pollData.response;
      break;
    }
  }

  if (!result) {
    console.error(`❌ ${video.id} 시간 초과`);
    return null;
  }

  // Storage 업로드
  const videoBase64 = result.videos?.[0]?.bytesBase64Encoded;
  if (!videoBase64) {
    console.error(`❌ 영상 데이터 없음:`, JSON.stringify(result));
    return null;
  }

  const buffer = Buffer.from(videoBase64, 'base64');
  const filePath = `landing/videos/${video.id}.mp4`;
  const file = bucket.file(filePath);
  await file.save(buffer, { contentType: 'video/mp4', public: true });

  const url = `https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/${filePath}`;
  console.log(`✅ ${video.id} 완료: ${url}`);
  return url;
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY 없음');
    process.exit(1);
  }

  const accessToken = await getAccessToken();
  const urls = {};

  for (const video of videos) {
    const url = await generateVideo(video, accessToken);
    if (url) urls[video.id] = url;
  }

  fs.writeFileSync('landing-video-urls.json', JSON.stringify(urls, null, 2));
  console.log('\n📄 landing-video-urls.json 저장 완료');
  console.log(JSON.stringify(urls, null, 2));
}

main();
