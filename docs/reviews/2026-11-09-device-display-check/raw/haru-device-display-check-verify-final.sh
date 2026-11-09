#!/bin/zsh
# '이 기기 알림 표시 시험' 검증 runner (root 실행용). 서버 호출·배포·Git 쓰기 없음.
# 사용법: NODE22=/path/to/node-v22.23.2/bin/node zsh /private/tmp/haru-device-display-check-verify.sh
set -u
WT=/private/tmp/haru-device-display-check-20261109
LOG=/private/tmp/haru-device-display-check-verify-final.log
: "${NODE22:?NODE22에 Node 22.23.2 실행 파일 경로를 지정하세요}"
NODE22_DIR="$(dirname "$NODE22")"
export PATH="$NODE22_DIR:$PATH"

{
  echo "== node: $(node -v)"
  cd "$WT/frontend" || exit 1
  echo "== tests (신규 deviceDisplayTest + 기존 pushDevice/regression)"
  node --import tsx --test test/deviceDisplayTest.test.mjs test/pushDevice.test.mjs test/pushDeviceRejection.regression.test.mjs
  echo "tests_exit=$?"

  echo "== build (자리값 env, prebuild env 검증 통과용 — 실제 배포값 아님)"
  VITE_FIREBASE_API_KEY=x VITE_FIREBASE_AUTH_DOMAIN=x VITE_FIREBASE_PROJECT_ID=haru2026-8abb8 \
  VITE_FIREBASE_STORAGE_BUCKET=x VITE_FIREBASE_MESSAGING_SENDER_ID=x VITE_FIREBASE_APP_ID=x \
    npm run build
  echo "build_exit=$?"

  echo "== 변경 파일 타입 오류만 추출 (전체 tsc 통과 주장 아님, ExportModal 기존 구문오류 제외)"
  if [ -x "$WT/functions/node_modules/.bin/tsc" ]; then
    "$WT/functions/node_modules/.bin/tsc" --noEmit -p "$WT/frontend/tsconfig.json" 2>&1 \
      | grep -E 'pushDevice\.ts|notificationService\.ts|SettingsPage\.tsx' || echo "changed_files_tsc_errors=0"
  else
    echo "tsc 없음(functions/node_modules 미설치) — 타입 확인 생략"
  fi

  echo "== git diff --stat"
  git -C "$WT" diff --stat
  git -C "$WT" status --short
} 2>&1 | tee "$LOG"
