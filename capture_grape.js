/**
 * 포도송이 애니메이션 캡처 스크립트 (순수 CSS/JS 버전)
 * 실행: node capture_grape.js
 * 결과: ~/Downloads/grape_animation.mp4
 */

const puppeteer = require('./functions/node_modules/puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const FRAMES_DIR = path.join(os.tmpdir(), 'grape_frames');
const OUTPUT = path.join(os.homedir(), 'Downloads', 'grape_animation.mp4');
const FPS = 30;
const DURATION_SEC = 7;
const TOTAL_FRAMES = FPS * DURATION_SEC;

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: #F5F3EE;
  width: 390px; height: 844px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  font-family: Georgia, serif;
}
#scene {
  position: relative;
  width: 200px; height: 200px;
  display: flex; align-items: center; justify-content: center;
}
.grape {
  position: absolute;
  width: 36px; height: 36px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #8B4789 0%, #6B3767 30%, #4a2349 60%, #2a1329 100%);
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 5px 10px rgba(0,0,0,0.3),
              inset -6px -6px 15px rgba(0,0,0,0.6), inset 6px 6px 15px rgba(255,255,255,0.15);
  transition: transform 1s cubic-bezier(0.43, 0.13, 0.23, 0.96),
              opacity 1s ease;
  will-change: transform;
}
#stem {
  position: absolute;
  top: -36px; left: 50%;
  transform: translateX(-50%) rotate(15deg);
  transform-origin: bottom center;
  opacity: 0;
  transition: opacity 0.5s ease;
}
#haru {
  display: flex; gap: 4px;
  margin-top: 16px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
#haru span {
  font-size: 64px; font-weight: 700;
  background-image: linear-gradient(135deg, #cc4400 0%, #ff6600 20%, #ffaa44 40%, #fff0dd 50%, #ffaa44 60%, #ff6600 80%, #cc4400 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 8px rgba(255,102,0,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}
#check {
  position: absolute;
  opacity: 0;
  transform: scale(0);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1);
}
#wrapper {
  display: flex; flex-direction: column; align-items: center;
}
</style>
</head>
<body>
<div id="wrapper">
  <div id="scene">
    <div id="stem">
      <svg width="30" height="46" viewBox="0 0 30 46" fill="none">
        <path d="M15 44 C15 34 15 22 15 14 C15 8 18 4 22 2"
              stroke="#5a3a2a" stroke-width="7.5" stroke-linecap="round" fill="none"/>
      </svg>
    </div>
    <div id="check">
      <svg width="48" height="48" viewBox="0 0 24 24">
        <path d="M5 12 L10 17 L19 7" stroke="#00E676" fill="none"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
  <div id="haru">
    <span>H</span><span>A</span><span>R</span><span>U</span>
  </div>
</div>

<script>
// 포도알 최종 위치 (HaruLogo.tsx grapeLayout 그대로)
const targets = [
  { x: -55, y: -66 },
  { x: -18, y: -66 },
  { x:  18, y: -66 },
  { x:  55, y: -66 },
  { x: -36, y: -26 },
  { x:   0, y: -26 },
  { x:  36, y: -26 },
  { x: -18, y:  14 },
  { x:  18, y:  14 },
  { x:   0, y:  54 },
];

const scene = document.getElementById('scene');
const grapes = [];

// 포도알 생성 + 랜덤 시작 위치
targets.forEach((t, i) => {
  const el = document.createElement('div');
  el.className = 'grape';
  const rx = (Math.random() - 0.5) * 600;
  const ry = (Math.random() - 0.5) * 600;
  el.style.transform = \`translate(\${rx}px, \${ry}px)\`;
  el.style.opacity = '0.5';
  el.style.transitionDelay = (i * 0.05) + 's';
  scene.appendChild(el);
  grapes.push({ el, tx: t.x, ty: t.y });
});

// 100ms 후 포도 모이기 시작
setTimeout(() => {
  document.getElementById('stem').style.opacity = '1';
  grapes.forEach(g => {
    g.el.style.transform = \`translate(\${g.tx}px, \${g.ty}px)\`;
    g.el.style.opacity = '1';
  });
}, 100);

// 1.2초 후 HARU 텍스트 등장
setTimeout(() => {
  const haru = document.getElementById('haru');
  haru.style.opacity = '1';
  haru.style.transform = 'translateY(0)';
}, 1200);

// 4.5초 후 체크마크
setTimeout(() => {
  const check = document.getElementById('check');
  check.style.opacity = '1';
  check.style.transform = 'scale(1)';
}, 4500);
</script>
</body>
</html>`;

(async () => {
  if (fs.existsSync(FRAMES_DIR)) fs.rmSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  console.log('🚀 브라우저 시작...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.setContent(HTML, { waitUntil: 'domcontentloaded' });

  // 시작 전 1프레임 대기
  await new Promise(r => setTimeout(r, 50));

  console.log(`📸 프레임 캡처 시작 (${TOTAL_FRAMES}장, ${FPS}fps)...`);

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const framePath = path.join(FRAMES_DIR, `frame_${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath, clip: { x: 0, y: 272, width: 390, height: 300 } }); // 포도 영역만
    await new Promise(r => setTimeout(r, 1000 / FPS));
    if (i % 30 === 0) process.stdout.write(`  ${i}/${TOTAL_FRAMES}\r`);
  }

  await browser.close();
  console.log('\n✅ 프레임 캡처 완료');

  console.log('🎬 ffmpeg로 영상 합성 중...');
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/frame_%04d.png" -vf "scale=390:300" -c:v libx264 -pix_fmt yuv420p -crf 18 "${OUTPUT}"`,
    { stdio: 'inherit' }
  );

  fs.rmSync(FRAMES_DIR, { recursive: true });
  console.log(`\n🎉 완료! 저장 위치: ${OUTPUT}`);
})();
