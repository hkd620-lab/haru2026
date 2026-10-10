#!/bin/bash
# 사용: run-all-tests.sh <frontend 폴더> <결과 파일>   (에뮬레이터·서버가 필요한 시험은 제외)
cd "$1" || exit 1
: > "$2"
for f in test/*.test.mjs test/*.test.cjs; do
  case "$f" in *emulator*) continue;; esac
  if [[ "$f" == *.test.mjs ]]; then out=$(timeout 120 node --import tsx --test "$f" 2>&1); rc=$?
  else out=$(timeout 120 node "$f" 2>&1); rc=$?; fi
  if [[ "$f" == *.test.mjs ]]; then
    p=$(echo "$out" | grep -E '^# pass ' | awk '{print $3}'); fl=$(echo "$out" | grep -E '^# fail ' | awk '{print $3}')
    echo "$f rc=$rc pass=${p:-?} fail=${fl:-?}" >> "$2"
  else
    echo "$f rc=$rc" >> "$2"
  fi
done
echo done >> "$2"
