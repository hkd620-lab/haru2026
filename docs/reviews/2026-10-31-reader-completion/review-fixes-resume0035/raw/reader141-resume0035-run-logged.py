#!/usr/bin/env python3
"""명령을 작업본에서 실행하고 실행자·node·HEAD·작업본 상태·명령·종료 코드를 원문 로그에 남긴다.

사용: run-logged.py <로그 경로> <코드 상태 설명> -- <명령...>
값이 더미가 아닌 환경 변수는 기록하지 않는다.
"""
import datetime
import subprocess
import sys

WORK = '/private/tmp/haru-completion-reader141-20261031'


def text(*cmd):
    return subprocess.run(cmd, cwd=WORK, capture_output=True, text=True).stdout.strip()


log_path, code_state = sys.argv[1], sys.argv[2]
command = sys.argv[sys.argv.index('--') + 1:]
with open(log_path, 'x', encoding='utf-8') as log:
    log.write('실행자: Claude Code (CC), phase review-fixes-resume0035\n')
    log.write(f'시작: {datetime.datetime.now().astimezone().isoformat()}\n')
    log.write(f'node -v: {text("node", "-v")}\nnpm -v: {text("npm", "-v")}\n')
    log.write(f'HEAD: {text("git", "rev-parse", "HEAD")}\n')
    log.write(f'코드 상태: {code_state}\n')
    log.write('git status --short:\n' + text('git', 'status', '--short') + '\n')
    log.write(f'명령: {" ".join(command)}\n---\n')
    log.flush()
    result = subprocess.run(command, cwd=WORK, stdout=log, stderr=subprocess.STDOUT)
    log.write(f'---\n종료 코드: {result.returncode}\n')
    log.write(f'끝: {datetime.datetime.now().astimezone().isoformat()}\n')
print(f'exit={result.returncode} log={log_path}')
sys.exit(result.returncode)
