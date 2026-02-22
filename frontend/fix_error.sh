#!/bin/bash

echo "허교장님의 .env 파일 오타 수정을 시작합니다..."

# macOS 전용 명령어(sed)로 잘못된 주소를 올바른 주소(-8abb8 추가)로 안전하게 교체합니다.
sed -i '' 's/haru2026.firebaseapp.com/haru2026-8abb8.firebaseapp.com/g' .env
sed -i '' 's/VITE_FIREBASE_PROJECT_ID="haru2026"/VITE_FIREBASE_PROJECT_ID="haru2026-8abb8"/g' .env

echo "✅ 완벽하게 수정되었습니다! 아래에서 수정된 결과를 직접 확인해 보십시오:"
echo "------------------------------------------------"
cat .env
echo "------------------------------------------------"
