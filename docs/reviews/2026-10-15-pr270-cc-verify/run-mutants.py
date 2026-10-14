#!/usr/bin/env python3
"""PR #270 추천 유틸 변이 시험 — 복사본(cc-270-mut)에서만 실행한다. 원본(PR 브랜치·main)은 건드리지 않는다.
변이 하나를 적용 → assistantRecommendations 단위 시험 실행 → 실패하면 KILLED, 통과하면 SURVIVED → 원문 복원."""
import subprocess, sys, re
SP='/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad'
FILE=f'{SP}/cc-270-mut/frontend/src/app/utils/assistantRecommendations.ts'
CWD=f'{SP}/cc-270-mut/frontend'
orig=open(FILE,encoding='utf-8').read()
M=[
 ('M01 강한 단어 점수 3→2', 'const STRONG_KEYWORD_SCORE = 3;', 'const STRONG_KEYWORD_SCORE = 2;'),
 ('M02 약한 단어 점수 1→0', 'const WEAK_KEYWORD_SCORE = 1;', 'const WEAK_KEYWORD_SCORE = 0;'),
 ('M03 약한 단어 점수 1→2', 'const WEAK_KEYWORD_SCORE = 1;', 'const WEAK_KEYWORD_SCORE = 2;'),
 ('M04 절반 기준 포함→미포함', 'score >= topScore / 2', 'score > topScore / 2'),
 ('M05 절반 기준 1/2→1/3', 'score >= topScore / 2', 'score >= topScore / 3'),
 ('M06 카드 최대 2→3장', '.slice(0, 2)\n    .map(', '.slice(0, 3)\n    .map('),
 ('M07 카드 최대 2→1장', '.slice(0, 2)\n    .map(', '.slice(0, 1)\n    .map('),
 ('M08 약한 단어 단독 후보 허용', 'if (strongMatches.length === 0) return [];', 'if (matches.length === 0) return [];'),
 ('M09 점수 정렬 방향 반대', 'return second.score - first.score;', 'return first.score - second.score;'),
 ('M10 동점 형식 우선순위 제거', 'return getPriorityRank(first.recommendation, formats) - getPriorityRank(second.recommendation, formats);', 'return 0;'),
 ('M11 동점 형식 우선순위 반대', 'return getPriorityRank(first.recommendation, formats) - getPriorityRank(second.recommendation, formats);', 'return getPriorityRank(second.recommendation, formats) - getPriorityRank(first.recommendation, formats);'),
 ('M12 표시 키워드 약한 단어 먼저', '[...strongMatches, ...weakMatches].slice(0, 5)', '[...weakMatches, ...strongMatches].slice(0, 5)'),
 ('M13 표시 키워드 5→3개', '[...strongMatches, ...weakMatches].slice(0, 5)', '[...strongMatches, ...weakMatches].slice(0, 3)'),
 ('M14 점수를 표시 5개 제한 뒤로 계산', 'score: strongMatches.length * STRONG_KEYWORD_SCORE + weakMatches.length * WEAK_KEYWORD_SCORE', 'score: Math.min(strongMatches.length, 5) * STRONG_KEYWORD_SCORE + Math.min(weakMatches.length, 5) * WEAK_KEYWORD_SCORE'),
 ('M15 NFC 정규화 제거', ".normalize('NFC').toLowerCase()", ".toLowerCase()"),
 ('M16 경계 문자 숫자 제외 해제(앞)', '(^|[^\\\\p{L}\\\\p{N}_])', '(^|[^\\\\p{L}_])'),
 ('M17 경계 문자 밑줄 제외 해제(앞뒤)', '[^\\\\p{L}\\\\p{N}_])(?:', '[^\\\\p{L}\\\\p{N}])(?:'),
 ('M18 허용 합성어·활용형 무시', '[normalizedKeyword, ...(KEYWORD_VARIANTS[normalizedKeyword] || [])]', '[normalizedKeyword]'),
 ('M19 복수형 들 허용 제거', "'(?:들)?(?:에게서", "'(?:에게서"),
 ('M20 조사 허용 제거', "const KOREAN_PARTICLES = '(?:들)?(?:에게서|한테서|에서|에게|한테|께서|으로|부터|까지|처럼|보다|이라서|이라고|이었다|입니다|이다|은|는|이|가|을|를|에|로|도|만|과|와|의)?(?:도|만|는)?';", "const KOREAN_PARTICLES = '';"),
 ('M21 뒤쪽 낱말 경계 제거(아이디어 허용)', '(?=$|[^\\\\p{L}\\\\p{N}_])', '(?:)'),
 ('M22 앞쪽 낱말 경계 제거(AI아이 허용)', '`(^|[^\\\\p{L}\\\\p{N}_])(?:${alternatives})', '`(^|)(?:${alternatives})'),
 ('M23 소문자화 제거', '.normalize(\'NFC\').toLowerCase()', ".normalize('NFC')"),
 ('M24 고유 단어 중복 제거 해제(동등 변이 가능)', 'Array.from(new Set(rule.keywords))', 'rule.keywords'),
 ('M25 강한 단어 판정 반대(약한 단어를 강한 단어로)', 'const strongMatches = matches.filter((keyword) => !weakKeywords.has(keyword));', 'const strongMatches = matches.filter((keyword) => weakKeywords.has(keyword) || !weakKeywords.has(keyword));'),
]
res=[]
for name, a, b in M:
    if a not in orig:
        res.append((name,'PATTERN-MISSING')); print(name,'PATTERN-MISSING'); continue
    open(FILE,'w',encoding='utf-8').write(orig.replace(a,b,1))
    p=subprocess.run(['node','--import','tsx','--test','test/assistantRecommendations.test.mjs'],cwd=CWD,capture_output=True,text=True,timeout=120)
    out=p.stdout+p.stderr
    m=re.search(r'^# fail (\d+)',out,re.M)
    failn=int(m.group(1)) if m else -1
    status='KILLED' if (p.returncode!=0 or failn>0) else 'SURVIVED'
    res.append((name,status,failn)); print(name,status,failn,flush=True)
open(FILE,'w',encoding='utf-8').write(orig)
k=sum(1 for r in res if r[1]=='KILLED'); s=[r for r in res if r[1]=='SURVIVED']
print(f'합계 {len(res)}개 중 KILLED {k}, SURVIVED {len(s)}:', [r[0] for r in s])
