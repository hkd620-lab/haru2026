#!/bin/bash
# 사용: run-builds.sh <결과 폴더>  — 더미 Firebase 변수로 PR 단독·병합 결과를 각각 빌드한다(운영 환경 변수 빌드 아님)
SP=/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad
OUT="$1"
export VITE_FIREBASE_API_KEY=dummy-api-key VITE_FIREBASE_AUTH_DOMAIN=dummy.firebaseapp.com VITE_FIREBASE_PROJECT_ID=dummy-project VITE_FIREBASE_STORAGE_BUCKET=dummy-project.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000 VITE_FIREBASE_APP_ID=1:000000000000:web:dummy
export VITE_AI_LIBRARY_FIREBASE_API_KEY=dummy-api-key VITE_AI_LIBRARY_FIREBASE_AUTH_DOMAIN=dummy.firebaseapp.com VITE_AI_LIBRARY_FIREBASE_PROJECT_ID=dummy-project VITE_AI_LIBRARY_FIREBASE_STORAGE_BUCKET=dummy-project.appspot.com VITE_AI_LIBRARY_FIREBASE_MESSAGING_SENDER_ID=000000000000 VITE_AI_LIBRARY_FIREBASE_APP_ID=1:000000000000:web:dummy
for w in cc-270 cc-270-merge; do
  cd "$SP/$w/frontend" || exit 1
  s=$(date +%s)
  npm run build -- --outDir "$SP/pr270-verify/dist-$w" --emptyOutDir > "$OUT/build-$w.log" 2>&1
  echo "$w build exit=$? elapsed=$(( $(date +%s) - s ))s" >> "$OUT/build-summary.txt"
done
echo done >> "$OUT/build-summary.txt"
