# 이번 PR에 한해 허대표님이 지정한 독립 Codex 검토 원문

- 대상 HEAD `8ff9b1d9ec7a809645c1f9237600e807dd5fee70`
- 2026-11-16 KST. 검토자 `independent_pr403`.

## 질문

User explicitly authorized a separate Codex independent review instead of Claude for HARU2026 PR #403, this one time; you are the fresh independent reviewer and should not edit files, comment externally, deploy, or take other write actions. Worktree /private/tmp/haru-sayu-original-one-tap; inspect actual code delta `git diff a02d73ca9d6a678a575934b5636bfd5f4a8f9f10..8ff9b1d9ec7a809645c1f9237600e807dd5fee70` (latest PR contains only subsequently added review docs bf26f303). User's intent: in SAYU > My records > original tab a single tap of Weak/Strong must run polishing immediately, preview in SAYU editor, never write record on click; final save remains explicit. Preserve existing SAYU edit use, special format behavior, source selection, protections against lost manual edits, close / record switching / concurrency, and checkbox behavior. Review intended scope plain-text eligible records, and inspect actual data paths as needed. Report independent verdict 승인 / 수정 후 승인 / 재설계 with findings, concrete file lines, evidence, any remaining nonblocking limitations, and project §8.1 stop condition (web only, no new AI endpoint/model/charges above existing use, user specifically approved deployment conditioned on review + latest CI) in Korean. Read-only tools only. Send result promptly; no need to rerun browser or builds unless useful; executor's earlier web build, 68 tests, and mock Chrome 390px both buttons/cancel/persisted original were successful. Critically assess rather than rubber-stamp.

## 결과

허대표님, **PR #403 독립 판정은 수정 후 승인**입니다. 검토한 코드 HEAD는 `8ff9b1d9ec7a809645c1f9237600e807dd5fee70`입니다.

**[P2] 일반 텍스트용 원본 탭 변경이 HARU보조장부와 주식거래에도 적용됩니다.** 원본 탭이 기존 SAYU 수정 화면의 `canPolishEdit`를 그대로 사용합니다. HARU보조장부에서 거래 한 건을 열어도 상세 화면은 그날의 문서 전체를 읽습니다. 강도만 선택하던 약·강 버튼이 즉시 AI를 호출하면서 전체 `ledger_entries` JSON과 승인번호까지 넘길 수 있습니다. 주식관리·주식거래일지도 같은 조건을 통과해 거래 필드와 캡처 추출문을 즉시 보냅니다. 원본 탭의 한 번 실행을 일반 텍스트 기록으로 제한하고, 기존 SAYU 수정 화면과 특수 형식의 흐름은 보존해야 합니다. [원본 탭 분기](https://github.com/hkd620-lab/haru2026/blob/8ff9b1d9ec7a809645c1f9237600e807dd5fee70/frontend/src/app/components/SayuModal.tsx#L3533-L3540) · [장부 열기](https://github.com/hkd620-lab/haru2026/blob/8ff9b1d9ec7a809645c1f9237600e807dd5fee70/frontend/src/app/pages/SayuPage.tsx#L4181-L4195) · [저장 필드](https://github.com/hkd620-lab/haru2026/blob/8ff9b1d9ec7a809645c1f9237600e807dd5fee70/frontend/src/app/components/FormatModal.tsx#L2549-L2563)

일반 기록은 현재 원본 입력을 기존 `polishContent`에 넘기고 응답을 편집창에 표시합니다. 미리보기 분기는 기록 쓰기 전에 종료하며 최종 저장은 별도입니다. 직접 수정한 본문을 교체하기 전에 확인하고, 요청 중에는 본문 입력과 탭 전환을 막습니다. 요청 식별자로 중복 실행과 닫기·기록 전환 이후의 늦은 응답을 거릅니다. 안내의 ‘다시 보지 않기’ 저장 동작도 기존 공용 컴포넌트에 남아 있습니다. [미리보기 및 응답 확인](https://github.com/hkd620-lab/haru2026/blob/8ff9b1d9ec7a809645c1f9237600e807dd5fee70/frontend/src/app/components/SayuModal.tsx#L1749-L1819)

변경 규모는 소규모이며 웹 Hosting 범위입니다. 호출당 기존 엔드포인트·모델·사용량 한도를 이용하고 미리보기는 AI 한마디 생성을 생략합니다. 검토 시점의 최종 HEAD `bf26f303`에는 새 검토 기록 2개만 추가됐으며 CI 2건이 통과했습니다. GitHub와 Slack의 PR 기록을 대조했습니다. 변경 테스트를 독립 실행하려 했으나 검토용 작업 폴더에 `esbuild`가 없어 실행하지 못했습니다. 빌드·68개 테스트·390px 브라우저 검증은 PR에 기록된 실행자 근거입니다. **§8.1에 따라 범위 수정, 최신 코드 자동·독립 재검토와 최종 HEAD CI 통과 전에는 병합 및 운영 배포를 보류합니다.** [PR #403](https://github.com/hkd620-lab/haru2026/pull/403)
