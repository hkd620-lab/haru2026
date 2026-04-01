const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');

admin.initializeApp();
const storage = admin.storage();
const bucket = storage.bucket('haru2026-8abb8.firebasestorage.app');

// .env 에서 Gemini API 키 읽기
require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const prompts = [
  {
    id: 'hero',
    prompt: 'A warm minimalist illustration of an open diary with a pen, soft morning light, pastel colors, flat design style, no text, no letters'
  },
  {
    id: 'feature_record',
    prompt: 'Clean flat illustration of colorful notebook pages with category tabs, soft blue and green tones, minimal style, no text, no letters'
  },
  {
    id: 'feature_sayu',
    prompt: 'Abstract illustration of glowing words transforming, soft light particles, deep blue and mint colors, flat minimal style, no text'
  },
  {
    id: 'feature_stats',
    prompt: 'Clean flat illustration of colorful bar charts and pie charts on light background, minimal modern style, no text, no letters'
  },
  {
    id: 'sayu_premium',
    prompt: 'Elegant abstract AI neural network illustration, soft golden and teal flowing light, premium minimal flat design, no text'
  }
];

async function generateAndUpload() {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY 없음 — .env 확인 필요');
    process.exit(1);
  }

  const urls = {};

  for (const item of prompts) {
    console.log(`\n생성 중: ${item.id}...`);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: item.prompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ ${item.id} API 오류:`, JSON.stringify(data));
        continue;
      }

      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData);

      if (!imagePart) {
        console.error(`❌ ${item.id} 이미지 없음:`, JSON.stringify(data));
        continue;
      }

      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const filePath = `landing/${item.id}.png`;
      const file = bucket.file(filePath);
      await file.save(buffer, { contentType: 'image/png', public: true });

      const url = `https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/${filePath}`;
      urls[item.id] = url;
      console.log(`✅ ${item.id} 완료: ${url}`);

      // API 과부하 방지 — 2초 대기
      await new Promise(r => setTimeout(r, 2000));

    } catch (e) {
      console.error(`❌ ${item.id} 실패:`, e.message);
    }
  }

  fs.writeFileSync('landing-image-urls.json', JSON.stringify(urls, null, 2));
  console.log('\n\n📄 landing-image-urls.json 저장 완료');
  console.log('결과:', JSON.stringify(urls, null, 2));
}

generateAndUpload();
