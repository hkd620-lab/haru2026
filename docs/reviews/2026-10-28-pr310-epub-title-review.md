# PR #310 EPUB 제목 검토 원문과 배포 승인

- PR: https://github.com/hkd620-lab/haru2026/pull/310
- 검토 대상 HEAD: e98cca9d3d30fc6b72029abd76dcbb4fadf183d0
- 독립 Claude 실행: 2026-10-28 22:00~22:02 KST, 새 CLI 세션, Read/Grep/Glob만 허용, MCP 없음
- 허대표님 승인 원문(이 대화): `배포승인`
- 승인 범위: 검토 후 PR #310 병합 및 exportEpub만 운영 배포
- 운영 배포·운영 E2E: 이 기록 작성 시점 미실행

## 필수 검증

- `cd functions && npm run build`: 성공
- `node --test test/epubSingleRecord.test.js test/epubContent.test.js`: 16/16 성공
- `git diff --check`: 통과
- `git diff --name-only origin/main -- functions/src/index.ts`: 출력 없음(export 목록 변경 없음)
- CI: https://github.com/hkd620-lab/haru2026/actions/runs/40692310066 SUCCESS
- 원격 브랜치에 `codex`가 있어 `codex/` 하위 브랜치 push가 directory/file conflict로 거절됨. `codex-epub-record-title`로 push 완료.

## Codex 검토 색인 — 실행 1

- 요청: 없음(자동), PR draft → ready 전환
- 요청 시각: 별도 댓글 없음(자동), 시작 2026-10-28T12:59:58.685549Z
- 실행 대상 커밋/검토 대상 HEAD: e98cca9d3d30fc6b72029abd76dcbb4fadf183d0
- 완료: 2026-10-28T13:01:26.403622Z
- 결과: completed, has_any_findings=false, has_unresolved_findings=false
- 결과 리뷰 ID: 별도 review 없음, 공식 요약 댓글 ID 6469623898 (IC_kwDORWOKJc8AAAABgZ6gWg)
- 자동 요청·결과 원문: https://github.com/hkd620-lab/haru2026/pull/310#issuecomment-6469623898
- 지적 사항: 없음, 반영 커밋 해당 없음

### Codex 결과 원문

<!-- codex-pull-request-review-summary -->
<!-- codex-review-state:v1 {"code_review":{"commit_sha":"e98cca9d3d30fc6b72029abd76dcbb4fadf183d0","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->

## Codex Review Summary

This comment shows the latest Codex review activity on this pull request.

| Review | Status | Commit | Review trigger |
| --- | --- | --- | --- |
| 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-28T13:01:26.403622Z">2026-10-28T13:01:26.403622Z</relative-time> | `e98cca9` | Draft marked ready |



<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review" or "@codex security review".

Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.

</details>

## 독립 Claude 질문 원문

당신은 파일을 수정하지 않는 독립 Claude 검토자입니다. 아래 저장소와 PR, 근거 파일만으로 설계·완료 검토를 하십시오. 코드 변경·커밋·배포·외부 메시지 전송 금지. 구현자의 대화 맥락은 제공하지 않습니다.
저장소: /Users/heogyeongdae/Developer/HARU2026
PR: https://github.com/hkd620-lab/haru2026/pull/310
검토 대상 HEAD: e98cca9d3d30fc6b72029abd76dcbb4fadf183d0
Diff: /private/tmp/haru-pr310-review.diff
요구: 다운로드한 단건 EPUB의 책 제목에 저장된 기록 제목이 나와야 한다.
근거: functions/src/epubExport.ts, functions/src/epubContent.ts, functions/test/epubSingleRecord.test.js, functions/test/epubContent.test.js, docs/HARU2026_Slack_운영정책.md
검증 기록: Functions npm run build 성공, node --test test/epubSingleRecord.test.js test/epubContent.test.js 16/16 통과. export index 변경 없음. 운영 배포 전.
요청: 제목 우선순위와 형식 분리, XML escape, 파일명 안전성, 기존 기간/합본 호환성, 보안·개인정보, 범위 크기(소·중·대), 멈춤 조건 해당 여부를 독립 검토. 최종 문구는 승인/수정 후 승인/재설계 중 하나로 분명히 쓰고 근거를 적으십시오. 운영 E2E가 남아 있음을 구분하십시오. 이전 검토 없음.

## 독립 Claude 결과 원문

# PR #310 독립 검토: 단건 EPUB에 저장된 기록 제목 반영

## 판정: **승인**

요구사항(단건 EPUB의 책 제목에 저장된 기록 제목 표시)은 구현돼 있습니다. 막는 결함은 없고, 아래 참고 사항은 머지를 막지 않습니다. 단, **운영 E2E는 아직 하지 않았습니다**. 이번 승인은 코드와 단위 테스트만 근거로 한 것입니다.

## 1. 제목 우선순위와 형식 분리

`functions/src/epubExport.ts:51-55`
```ts
const candidates = [prefix ? record[`${prefix}_title`] : undefined, record.title, record.ai_title];
return candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
```
- 순서는 형식 제목(`diary_title` 등), 공통 `title`, `ai_title`입니다. FormatModal이 `${prefix}_title`로 저장하므로(`FormatModal.tsx:1182, 2355, 2706`) 실제 저장 구조와 맞습니다.
- 형식이 섞이지 않습니다. 책 제목(`:235`, `format || includedFormats[0]`)과 본문 `<h2>`(`:70-72`, `firstFormat`)이 같은 형식을 고릅니다. 테스트도 `essay_title`이 섞이지 않는지 확인합니다(`epubSingleRecord.test.js:114`).
- 공백만 있는 값은 건너뛰고, 앞뒤 공백은 지운 뒤 씁니다. 둘 다 테스트가 있습니다.
- `bookTitle`은 `singleRecordId`가 있을 때만 정해집니다. 형식 필터를 통과하지 못한 기록에서는 정해지지 않습니다.
- 참고(막지 않음): 화면은 제목이 비었을 때 `독서사유`는 `reading_book_title`, 주식 형식은 `stock_name`을 대신 씁니다(`FormatModal.tsx:1384`). 서버에는 이 대체 경로가 없습니다. 독서사유는 저장할 때 `reading_title`을 채우므로(`:2969`) 새 기록은 괜찮습니다. 그 이전에 저장된 기록은 제목 대신 기존 기간형 이름으로 나올 수 있습니다.

## 2. XML escape
- OPF의 `<dc:title>`은 epub-gen-memory의 EJS `<%= title %>`로 들어갑니다(`node_modules/epub-gen-memory/dist/lib/templates/epub3/content.opf.ejs.js`). EJS가 `& < > " '`를 이스케이프하므로 안전합니다.
- 본문 `<h2>`는 기존 `escapeHtml`을 그대로 씁니다.
- 테스트 한계: 테스트는 OPF를 디코드한 뒤 문자열을 비교합니다(`test.js:106-111`). 그래서 이스케이프가 안 된 원문이 들어가도 통과합니다. 실제 안전성은 위 EJS 확인으로 보장되며, 테스트가 이를 증명하지는 않습니다. 원본 OPF에 `&lt;기록&gt;`이 있는지 확인하는 단언을 추가하길 권합니다(막지 않음).

## 3. 파일명 안전성
`:296-299`
```ts
const safeTitle = bookTitle && Array.from(bookTitle.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')).slice(0, 40).join('');
const fileName = safeTitle ? `HARU_${safeTitle}_${startDate}.epub` : ...
```
- `/`와 `\`를 바꾸므로 Storage 경로 `epub/${uid}/`를 벗어날 수 없습니다. `..`이 있어도 `HARU_` 접두어 때문에 경로 이동이 되지 않습니다.
- 40코드포인트로 자르면 한글은 약 120바이트입니다. 접두어·날짜를 더해도 255바이트 안에 듭니다.
- 사소한 점(막지 않음):
  - 이모지 ZWJ 조합은 중간에서 잘릴 수 있습니다.
  - U+202E 같은 방향 제어 문자는 거르지 않습니다. 본인 기록이라 위험은 낮습니다.
  - 제목 끝에 `.`나 공백이 있어도 `_날짜.epub`이 뒤에 붙으므로 Windows 문제는 없습니다.
- `startDate`는 형식 검사 없이 파일명에 들어갑니다. PR #308 검토에서 이미 지적된 기존 문제이고, 이번 변경으로 새로 생긴 것은 아닙니다.

## 4. 기존 기간·합본 호환성
- 합본(`recordIds`) 경로: `buildAndSave`를 `bookTitle` 없이 부르므로(`:211`) 변화가 없습니다.
- 기간 경로: `bookTitle`이 `undefined`라 책 제목과 파일명은 그대로입니다. 테스트도 있습니다(`test.js:116`).
- **눈에 보이는 변화 1건**: 기간 내보내기의 각 장 `<h2>`도 이제 형식 제목을 먼저 씁니다. 예전에는 `record.title || record.ai_title`만 봤는데, 실제 저장은 `${prefix}_title`로 되므로 기간 EPUB에는 제목이 대부분 빠져 있었을 것으로 보입니다. 이제는 표시됩니다. 개선 방향이지만 "단건" 범위 밖의 동작 변화이고 이를 검증하는 테스트가 없습니다. 보고할 때 이 점을 밝히길 권합니다.

## 5. 보안·개인정보
- 읽는 범위는 그대로입니다: `users/${uid}/records/{id}`, 인증·구독 검사도 변경 없음.
- Storage 객체 이름에 기록 제목(개인 내용)이 들어갑니다. 서명 URL 경로와 GCS 객체 목록에도 제목이 보입니다. 서명 URL은 본인에게만 10분 동안 유효하고 EPUB 안에는 원래 제목이 있으므로, 추가 노출은 작습니다.
- 확인 권장: 저장소 코드에서 `epub/` 객체 정리 정책을 찾지 못했습니다. 예전에는 같은 기간이면 파일을 덮어썼지만, 이제는 제목마다 객체가 따로 쌓입니다. GCS 수명 주기 규칙이 있는지 운영에서 확인하길 권합니다(막지 않음).

## 6. 범위 크기: **소규모**
Functions 파일 1개(약 20줄)와 테스트 2건입니다. export index, 라우터, 프론트엔드는 바뀌지 않았습니다.

## 7. 멈춤 조건: **해당 없음**
- 모델 교체·다운그레이드 없음.
- 커밋 메시지("단건 EPUB에 저장된 기록 제목 반영")와 실제 변경이 일치함. 기간 `<h2>` 변화는 위 4번에서 밝혔습니다.
- 대규모 작업(홈 화면·라우터·새 기능) 아님.
- Firestore 경로 `users/{uid}/records` 유지, Functions 리전 `asia-northeast3` 유지.

## 남은 일 (승인과 별개)
1. **운영 E2E (아직 안 함)**: 배포 후 실제 기기에서 단건 EPUB을 내려받아 다음을 확인해야 합니다.
   - 리더 앱에 책 제목이 저장된 제목으로 나오는지
   - iOS·Android에서 받은 파일명에 한글이 정상으로 나오는지
   - 특수문자가 든 제목도 내려받기가 되는지
2. (선택) 원본 OPF에 이스케이프가 들어갔는지 확인하는 테스트와 기간 `<h2>` 테스트를 추가하기.
3. (선택) 독서사유·주식 형식의 옛 기록에 제목 대체 경로를 넣을지 정하기.

## Slack 기록용 확정 요약
> PR #310 (HEAD e98cca9d) 독립 검토: **승인**. 단건 EPUB의 책 제목·`<h2>`·파일명에 형식 제목 → 공통 title → ai_title 순으로 저장 제목이 들어감. OPF는 EJS가 이스케이프하고, 파일명은 경로 문자 치환·40자 제한으로 `epub/{uid}/` 안에 머묾. 합본·기간의 책 제목과 파일명은 그대로이고, 기간 장 `<h2>`에 형식 제목이 새로 보이는 변화 1건 있음. 소규모, 멈춤 조건 없음. 운영 E2E(리더 앱 제목, 모바일 한글 파일명)는 배포 후 남은 일. 참고: 테스트가 이스케이프를 직접 증명하지 못함, 옛 독서사유·주식 기록은 제목 대체 경로 없음, epub/ 수명 주기 규칙 확인 권장.

Slack에 직접 게시하지는 않았습니다.
