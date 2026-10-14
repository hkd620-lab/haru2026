#!/bin/bash
SP=/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad
for w in cc-270-main cc-270 cc-270-merge; do
  cd "$SP/$w/frontend" || exit 1
  node /opt/node-tools/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json > "$SP/pr270-verify/tsc-$w.txt" 2>&1
  echo "$w tsc exit=$? errors=$(grep -c 'error TS' $SP/pr270-verify/tsc-$w.txt)" >> "$SP/pr270-verify/tsc-summary.txt"
done
echo done >> "$SP/pr270-verify/tsc-summary.txt"
