# EPUB 사진 잘림·설치 안내 — 검증 원문 로그 (독립 검토1 차단 지적 1 보완)

- 기준: HEAD `90ca414ed40b3593422b204fb876c74f28982442`, BASE `a2db4665` (origin/main), 수집 2026-11-05 05:32~05:33 UTC
- 코드 변경 없음. 각 로그에 명령, 작업 폴더, stdout+stderr 원문, exit code가 들어 있습니다.
- 수집 스크립트 사본: `run-validation.sh.txt`(01~06 실행), `run-export-compare-only.sh.txt`(08만 재실행)

| 파일 | 내용 | 결과 |
|---|---|---|
| 01-functions-build.log | functions `npm run build` | exit 0 |
| 02-functions-epub-tests.log | functions `node --test test/epubContent.test.js test/epubSingleRecord.test.js` | 18/18 통과, exit 0 |
| 03-frontend-epub-tests.log | frontend `node --import tsx --test` epubReaderGuide·epubExportGuide·epubSingleRecord | 11/11 통과, exit 0 |
| 04-frontend-build.log | frontend `npm run build` (명령줄 시험용 env 값, `.env` 미사용) | exit 0 |
| 05-changed-files.log | `git diff --name-status a2db4665..HEAD` | 9개 파일(M), 모두 EPUB 소스·테스트 |
| 06-index-ts-diff.log | `git diff --stat --exit-code a2db4665..HEAD -- functions/src/index.ts` | 출력 없음, exit 0 = 변경 0 |
| 07-export-list-compare.log | **무효** — zsh가 `"$1:functions/…"`의 `:f…`를 변수 수식어로 해석해 git 경로가 깨짐. 실패 기록으로 보존 | 사용하지 않음 |
| 08-export-list-compare-fixed.log | 07을 고친 재실행. index.ts `^export` 줄 BASE/HEAD 비교 | 77줄 = 77줄, diff 0개. `export { exportEpub } from './epubExport'` 유지 |
| 09-log-sensitive-scan.log | 01~08 로그의 비밀값·개인정보 패턴 검사와 판정 | 비밀값·UID·서명 URL·개인 기록 없음 |

참고(08): `epubContent.ts`에 모듈 내부용 export 2개(`EPUB_STYLESHEET`, `epubPhotoHtml`)가 추가됐습니다. index.ts에서 다시 내보내지 않으므로 Cloud Functions 배포 목록은 그대로입니다. `epubExport.ts`의 export(`exportEpub`) 변화는 0입니다.

빌드 산출물: 01의 tsc가 바꾼 추적 파일 `functions/lib/index.js`·`functions/lib/snsToDiary.js`는 수집 후 `git restore`로 되돌렸습니다. `frontend/dist`는 gitignore 대상이며 커밋하지 않습니다.

미확인(이 로그 범위 밖): 최종 코드 EPUB의 갤럭시 Play 북 실기기 검증(Codex 담당, 진행 중). 운영 완료 아님.
