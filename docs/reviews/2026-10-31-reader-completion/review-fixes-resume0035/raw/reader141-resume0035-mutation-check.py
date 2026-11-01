#!/usr/bin/env python3
"""수정을 하나씩 되돌려 회귀시험이 실제 동작 실패로 잡는지 확인하고 파일을 원래대로 복원한다.

사용: mutation-check.py <로그 경로>
"""
import hashlib
import re
import subprocess
import sys

WORK = '/private/tmp/haru-completion-reader141-20261031'
PAGE = f'{WORK}/frontend/src/app/pages/BiblePage.tsx'
TEST = f'{WORK}/frontend/test/bibleGrammarPopup.test.mjs'
GUARD = "    assert.ok(state.cleanups.some(Boolean), '페이지 이탈 cleanup이 있어야 한다');\n"
CLEANUP = "  useEffect(() => () => {\n    ttsRequestRef.current += 1;\n  }, []);\n"

# (이름, BiblePage 원문, 대체 원문, 시험의 cleanup 존재 검사 제거 여부)
MUTATIONS = [
    ('F2 cleanup 제거', CLEANUP, '', True),
    ('무음 재생 뒤 취소 확인 제거', "catch(_) {}\n      if (isStale()) return;\n", "catch(_) {}\n", False),
    ('AudioContext 뒤 취소 확인 제거', "        } catch(_) {}\n        if (isStale()) return;\n", "        } catch(_) {}\n", False),
    ('첫 play 뒤 오디오 일치 확인 제거', "          if (isStale()) {\n            audio.pause();\n            return;\n          }\n          setTtsPlaying(key);\n\n",
     "          if (requestId !== ttsRequestRef.current) {\n            audio.pause();\n            return;\n          }\n          setTtsPlaying(key);\n\n", False),
    ('F1 재시도 최종 실패 안내 제거', "              if (quality === 'native') showNativeTTSFailureAlert();\n", '', False),
    ('F1 재시도 표준까지 안내', "              if (quality === 'native') showNativeTTSFailureAlert();\n", "              showNativeTTSFailureAlert();\n", False),
    ('F1 재시도 실패의 취소 확인 제거', "              if (isStale()) return;\n              console.error('TTS play 최종 실패:', e);\n", "              console.error('TTS play 최종 실패:', e);\n", False),
    ('F1 빈 응답 안내 제거', "      } else if (quality === 'native') {\n        throw new Error('재생할 고음질 음성이 응답에 없습니다.');\n", '', False),
    ('Codex3 재개 성공 뒤 취소 확인 제거', "      if (isResumeStale()) {\n        resumeAudio?.pause();\n        return;\n      }\n", '', False),
    ('Codex3 재개 대상 오디오 일치 확인 제거', "resumeRequestId !== ttsRequestRef.current || audioRef.current !== resumeAudio", "resumeRequestId !== ttsRequestRef.current", False),
    ('Codex3 재개 실패의 취소 확인 제거', "        if (isResumeStale()) return;\n        console.error('TTS 이어 듣기 실패:', err);\n", "        console.error('TTS 이어 듣기 실패:', err);\n", False),
    ('Codex3 재개 실패 표준까지 안내', "        console.error('TTS 이어 듣기 실패:', err);\n        if (quality === 'native') showNativeTTSFailureAlert();\n", "        console.error('TTS 이어 듣기 실패:', err);\n        showNativeTTSFailureAlert();\n", False),
]


def digest(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


page_original = open(PAGE, encoding='utf-8').read()
test_original = open(TEST, encoding='utf-8').read()
hashes = (digest(PAGE), digest(TEST))
head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=WORK, capture_output=True, text=True).stdout.strip()
node = subprocess.run(['node', '-v'], capture_output=True, text=True).stdout.strip()
missed = []
with open(sys.argv[1], 'x', encoding='utf-8') as log:
    log.write(f'실행자: Claude Code (CC), phase review-fixes-resume0035\nnode -v: {node}\nHEAD: {head}\n')
    log.write('방법: HEAD의 파일에서 수정 하나만 임시로 되돌려 npm --prefix frontend run test:bible-grammar 실행. 커밋하지 않음.\n')
    log.write(f'cleanup 검사 문구 제거가 표시된 항목은 cleanup이 없을 때의 실제 동작을 보려고 시험의 존재 검사도 임시로 뺐다.\n\n')
    try:
        for name, old, new, drop_guard in MUTATIONS:
            assert page_original.count(old) == 1, f'{name}: 원문 {page_original.count(old)}곳'
            open(PAGE, 'w', encoding='utf-8').write(page_original.replace(old, new))
            if drop_guard:
                assert test_original.count(GUARD) == 1
                open(TEST, 'w', encoding='utf-8').write(test_original.replace(GUARD, ''))
            result = subprocess.run(['npm', '--prefix', 'frontend', 'run', 'test:bible-grammar'], cwd=WORK, capture_output=True, text=True)
            open(PAGE, 'w', encoding='utf-8').write(page_original)
            open(TEST, 'w', encoding='utf-8').write(test_original)
            failed = re.findall(r'^not ok \d+ - .*$', result.stdout, re.M)
            messages = re.findall(r"^  error: (?:\|-\n\s+)?(.+)$", result.stdout, re.M)
            log.write(f'## {name}{" (cleanup 검사 문구 제거)" if drop_guard else ""}\n종료 코드: {result.returncode}\n')
            log.write(''.join(f'{line}\n' for line in failed))
            log.write(''.join(f'  오류: {line}\n' for line in messages))
            log.write('\n')
            log.flush()
            if result.returncode == 0:
                missed.append(name)
    finally:
        open(PAGE, 'w', encoding='utf-8').write(page_original)
        open(TEST, 'w', encoding='utf-8').write(test_original)
    restored = hashes == (digest(PAGE), digest(TEST))
    log.write(f'잡히지 않은 변형: {missed}\n복원 해시 일치: {restored}\n')
print('missed', missed, 'restored', restored)
sys.exit(0 if not missed and restored else 1)
