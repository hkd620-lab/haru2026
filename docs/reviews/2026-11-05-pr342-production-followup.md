# PR342 병합·운영 배포 및 실기기 검증 추가 기록

기존 검토 색인과 원문은 당시 상태를 보존한다. 이 문서는 병합 승인 이후의 별도 기록이다.

## 추가 Codex 실행 3

- 대상 HEAD: `494adfe53ed2f1d530b6ab061b63bc9493dc6275`.
- 트리거: 병합을 위한 초안 ready 전환. 시작 시각은 확보하지 못했으며 추정하지 않는다.
- 완료 UTC: `2026-11-05T09:21:00.151972Z`.
- 결과: completed, has_any_findings=false, has_unresolved_findings=false.
- 결과 식별자: 요약 댓글 `6652474476`. 기존 실행과 같은 댓글이 수정되었다.
- [추가 실행 원문 스냅샷](2026-11-05-pr342-codex-ready-494adfe5-raw.json).
- 앞선 두 실행과 독립 Claude 검토 이력은 [기존 색인](2026-11-05-pr342-review-index.md)에 남아 있다. 실행 3은 앞선 기록을 대체하지 않는다.

## 승인과 배포

- 사용자 요청: PR342 병합, 웹과 lawSearch 배포, iPhone·PWA 운영 확인.
- PR342 병합 SHA: `5ac06e853b2062d0e20b860096c99e97916adf41`, UTC `2026-11-05T09:20:16Z`.
- 웹: [자동 배포 42001541477](https://github.com/hkd620-lab/haru2026/actions/runs/42001541477) 성공.
- Hosting version: `14033df159d7ad0a`, release UTC `2026-11-05T09:21:33.843Z`.
- 운영 asset: `/assets/index-Bu4zXthq.js`, SHA-256 `9806968ed6e0da47a093a03b61ede31da15bd864acc6dc33f24676a70e6460b0`.
- lawSearch만 명시 배포: project `haru2026-8abb8`, region `asia-northeast3`, GEN_2 Node.js22, ACTIVE.
- revision `lawsearch-00142-gum`, traffic 100%, update UTC `2026-11-05T09:18:32.444741886Z`.
- Functions 배포 소스 HEAD494와 병합 main5ac의 제품 코드 diff가 없음을 확인했다.
- Firestore·Storage Rules 및 다른 Functions는 이번에 배포하지 않았다. 기록 경로, 인증, 결제, 환경변수 변경 없음.

## 운영 E2E 확인 범위

- 실제 설치형 Chrome PWA: standalone=true. 홈에서 하루LAW 진입, PDF·HWP·HWPX·TXT 네 시험 파일 첨부, 법령 검색·AI 읽기 응답, 별도 합성 날짜 `2099-11-08` 저장, 페이지 새로고침, `PR342PWA` 검색, 재열기 성공.
- PDF 검증코드 PDF339-K7, TXT 검증코드 TXT339-P2를 응답에서 확인했다. 공개 HWP/HWPX는 같은 본문이며 AI가 두 형식을 묶어서 첫 문장을 답했다. 두 파일을 독립 식별한 결과라고 확대 해석하지 않는다.
- PWA 실시간·재열기 답변: 본문 15px, 줄높이 28.5px, 첫 줄 들여쓰기 15px, 분석 제목 7개. 저장된 첨부 네 버튼 활성 상태 확인.
- iPhone16e Safari 실기기: 하루LAW 진입 및 파일 선택창 열기, SAYU에서 PR342PWA 검색·재열기, 네 첨부 형식 표시, 핵심 답변 들여쓰기·분석 제목·목록 간격, PDF 원본 열기와 검증코드 확인.
- iPhone 검색창 포커스 이후 페이지가 확대된 채 우측 일부가 화면 밖으로 나오는 모습도 관찰했다. 일반 배율의 최종 화면 확인은 아직 남았다. 이를 모든 모바일 표시가 정상이라는 근거로 사용하지 않는다.
- iPhone에서 새 네 파일을 첨부→검색→저장하는 전체 흐름은 미완료. iCloud 전체에서 IPHONE1105 검색 결과가 없어 시험 파일 위치를 사용자에게 확인 중이다. Safari PDF의 파일 저장 메뉴는 눌렀지만 저장 완료 화면을 확인하지 못했다. 파일 저장 성공으로 기록하지 않는다.
- 제품 코드 수정 없이 검증만 수행했다. 기존 사용자 기록 삭제·정리 없음.

## 보관과 대조

- 외장 보관: `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/2026-11-05_하루LAW_가독성_운영검증_205550`.
- LaCie UUID `06827F85-BF9F-465C-9C30-E39085839975` 확인 후 새 폴더 생성. 화면·스타일 측정·Hosting 전후 스냅샷 8개를 복사하고 전체 SHA-256 일치 확인. 임시 원본 보존.
- GitHub에서 PR342 MERGED를 재확인했고 Slack 공개 검색 `342`, after:2026-11-05는 결과 없음. Slack에 직접 게시하지 않았다.
- 판정: 배포 ✅ 완료 / PWA ✅ 완료 / iPhone 🔍 추가 E2E 필요. 난이도 높음.
