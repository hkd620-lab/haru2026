#!/bin/bash
# 사용: run-mutants.sh <PR 작업 폴더의 frontend 경로> <임시 백업 폴더>
# 가드·핸들러 배선·입력칸 속성을 하나씩 망가뜨린 변이를 만들어 단위 시험과 정책 시험이 잡는지 확인한다. 끝나면 원본을 복원한다.
cd "$1" || exit 1; SB="$2"; rm -rf "$SB"; mkdir -p "$SB"
U=src/app/utils/questionEnterSubmit.ts; M=src/app/components/ResultChatModal.tsx; R=src/app/components/ReadingAiChat.tsx; F=src/app/components/FormatModal.tsx
cp $U $SB/util.orig; cp $M $SB/modal.orig; cp $R $SB/reading.orig; cp $F $SB/format.orig
run_unit() { node --import tsx --test test/questionEnterSubmit.test.mjs 2>&1 | grep -E "^# fail" | awk '{print $3}'; }
run_policy() { node test/questionInputs.policy.test.cjs >/dev/null 2>&1 && echo 0 || echo 1; }
restore() { cp $SB/util.orig $U; cp $SB/modal.orig $M; cp $SB/reading.orig $R; cp $SB/format.orig $F; }
mutate() { restore; sed -i -E "$3" "$2"; if cmp -s "$2" "$SB/$4"; then echo "NOCHANGE  $1"; return; fi
  u=$(run_unit); p=$(run_policy); if [ "$u" != "0" ] || [ "$p" != "0" ]; then echo "KILLED    $1 (unit_fail=$u policy_fail=$p)"; else echo "SURVIVED  $1"; fi; }
echo "== 유틸(가드·배선 함수) 변이 =="
mutate "preventDefault 제거"                 $U "s/^  event\.preventDefault\(\);\$/  \/\/ removed/" util.orig
mutate "ignore에서도 전송"                    $U "s/if \(decision === 'send'\) send\(\);/send();/" util.orig
mutate "pass 조기 반환 제거"                  $U "s/if \(decision === 'pass'\) return decision;/\/\/ no early return/" util.orig
mutate "shiftKey 배선 제거"                   $U "s/shiftKey: event\.shiftKey,/shiftKey: false,/" util.orig
mutate "key 배선 고정"                        $U "s/key: event\.key,/key: 'Enter',/" util.orig
mutate "isComposing 배선 제거"                $U "s/isComposing: event\.nativeEvent\.isComposing,/isComposing: false,/" util.orig
mutate "keyCode 배선 제거"                    $U "s/keyCode: event\.nativeEvent\.keyCode,/keyCode: 13,/" util.orig
mutate "timeStamp 배선 제거"                  $U "s/timeStamp: event\.timeStamp,/timeStamp: 0,/" util.orig
mutate "보호 시간 0"                          $U "s/ENTER_AFTER_COMPOSITION_GUARD_MS = 50/ENTER_AFTER_COMPOSITION_GUARD_MS = 0/" util.orig
mutate "abs 제거(부호 규칙 복귀)"             $U "s/Math\.abs\(sinceCompositionEnd\) < this\.guardMs/(sinceCompositionEnd >= 0 \&\& sinceCompositionEnd < this.guardMs)/" util.orig
mutate "composing 검사 제거"                  $U "s/if \(this\.composing \|\| input\.isComposing \|\| input\.keyCode === 229\) return 'pass';/if (input.isComposing || input.keyCode === 229) return 'pass';/" util.orig
mutate "keyCode 229 검사 제거"                $U "s/ \|\| input\.keyCode === 229//" util.orig
mutate "isComposing 검사 제거"                $U "s/ \|\| input\.isComposing//" util.orig
mutate "reset이 composing을 안 지움"          $U "/^  reset\(\): void \{/,/^  \}/ s/this\.composing = false;/\/\/ keep/" util.orig
mutate "reset이 종료 기록을 안 지움"          $U "/^  reset\(\): void \{/,/^  \}/ s/this\.compositionEndedAt = null;/\/\/ keep/" util.orig
mutate "compositionEnd가 시각을 안 기록"      $U "/^  compositionEnd/,/^  \}/ s/this\.compositionEndedAt = timeStamp;/\/\/ keep/" util.orig
echo "== 컴포넌트 배선 변이 =="
mutate "컴포넌트: 핸들러 호출 제거"           $M "s/handleQuestionEnterKeyDown\(questionEnterGuard, event, \(\) => \{ void sendQuestion\(question\); \}\);/void 0;/" modal.orig
mutate "컴포넌트: 전송 콜백 제거"             $M "s/\(\) => \{ void sendQuestion\(question\); \}\)/() => {})/" modal.orig
mutate "컴포넌트: 가드를 매 렌더 재생성"      $M "s/const \[questionEnterGuard\] = useState\(\(\) => new EnterSubmitGuard\(\)\);/const questionEnterGuard = new EnterSubmitGuard();/" modal.orig
mutate "컴포넌트: onBlur reset 제거"          $M "s/onBlur=\{\(\) => questionEnterGuard\.reset\(\)\}//" modal.orig
mutate "컴포넌트: onCompositionStart 제거"    $M "s/onCompositionStart=\{\(\) => questionEnterGuard\.compositionStart\(\)\}//" modal.orig
mutate "컴포넌트: onCompositionEnd 시각 제거" $M "s/questionEnterGuard\.compositionEnd\(event\.timeStamp\)/questionEnterGuard.compositionEnd(0)/" modal.orig
mutate "컴포넌트: 질문칸 rows 변경"           $M "s/rows=\{3\}\$/rows={4}/;" modal.orig
mutate "컴포넌트: 질문칸 disabled 변경"       $M "s/disabled=\{loading \|\| uploadingFiles \|\| closingAttachments \|\| isChoicePending\}\$/disabled={false}/" modal.orig
echo "== 입력칸 속성 변이 =="
mutate "독서 AI 질문 maxLength 변경"          $R "s/maxLength=\{1000\} rows=\{3\}/maxLength={500} rows={3}/" reading.orig
mutate "독서 AI 질문 rows 변경"               $R "s/maxLength=\{1000\} rows=\{3\}/maxLength={1000} rows={2}/" reading.orig
mutate "AI 참고 메모 제안 rows 변경"          $R "s/aria-label=\"AI 참고 메모 제안\" rows=\{4\}/aria-label=\"AI 참고 메모 제안\" rows={3}/" reading.orig
mutate "독서 질문칸 resize 복원(vertical)"    $R "s/lineHeight: '21px', resize: 'none'/lineHeight: '21px', resize: 'vertical'/" reading.orig
mutate "간편 작성 resize none"                $F "/자유롭게 기록해 주세요/,/\/>/ s/resize: 'vertical'/resize: 'none'/" format.orig
restore; echo; echo "restored: unit_fail=$(run_unit) policy_fail=$(run_policy)"
