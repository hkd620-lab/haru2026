# 하루LAW 전용 화면·문서 첨부 배포 전 검증

- 기능 HEAD: `4459061c` (UI `9a1d2b39`, 문서 첨부 `4459061c`).
- 실제 작업 브랜치: `codex-haru-law-dedicated`. 최초 `codex/haru-law-dedicated` push가 원격 directory/file 충돌로 거절되어 커밋 변경 없이 이름만 변경했다.
- 사용자 범위: 전용 화면과 기존 기능/기록 보존, PDF·HWP·HWPX·TXT 본문 읽기, 검증 결과 보고. 운영 배포 승인 아님.
- 작업 난이도: 높음. 홈·라우터 및 Storage Rules 변경은 이번 사용자가 제안과 추가 첨부 지원을 승인한 범위이며 병합/배포는 보류한다.
- 웹/Functions 빌드 통과. 웹은 실제 환경값 대신 명시적인 demo 설정으로 컴파일했으며 배포 산출물로 사용하지 않는다.
- 프론트 관련 시험 47통과/0실패, 에뮬레이터 시험 1개는 별도 재실행. 저장 회귀+권한 에뮬레이터 14/14, Storage 권한 6/6, Node22 문서·worker·AI File 전달 10/10 통과.
- 기존 Firestore 권한 판단 90개 유지, 없는 날짜 조회 12개/실제 저장 4개 확인. 역사적 before 규칙 시험은 기존 missing-document 절만 제거한 baseline을 명시적으로 제공했다. 이번 Firestore Rules diff 없음.
- resultChat 통합시험은 demo Firestore+가짜 Gemini로 통과(39 genai 호출, 기존 SDK11, File 업로드25). 실제 AI 요청이나 운영 데이터 수정 없음.
- 기존 첨부 정리 19개 시나리오와 오류/스크롤/질문칸/법령해석/홈 개인화 검사 통과.
- 격리 브라우저에서 기존 홈 개인화 선택 유지, 전용 질문 첫 화면, 새로고침/홈 복귀, 실패와 재시도, 기존 기록 병합, PDF 분석·저장, PDF/HWP/HWPX/TXT 네 파일 동시 선택·표시를 확인했다.
- Vite 파일 감시가 이전 코드를 제공해 첫 추가형식 선택 시도가 실패했다. 검증 서버를 재시작하고 polling을 적용한 후 최신 accept와 네 형식 동시 선택 성공을 확인했다. 이전 실패를 성공으로 덮어쓰지 않는다.
- 390px iframe 콘텐츠 폭과 화면 폭이 모두375px(스크롤바 제외), 가로 넘침 없음. 브라우저 viewport override가 즉시 적용되지 않은 캡처는 모바일 근거로 사용하지 않았고 별도390px iframe으로 재확인했다.
- 캡처: `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/2026-11-05_하루LAW_전용화면_검증/documents-desktop.jpg` 및 `documents-mobile-390.jpg`. UUID 확인 및 임시 캡처와 SHA-256 일치 검증.
- SHA-256 desktop `2b5c923f585deb4a229ce1d56ff0775917f926a326dbd8d829beb295ef16c67a`, mobile `e4a8c727c7c3a426180f993d88e14a89ca44b3eb44f0349d12e7925556c3a73b`.
- 기존 소스/Git 경로 및 필수 dist/lib 출력 경로 유지. 빌드가 다시 만든 index.js/snsToDiary.js의 범위 밖 생성물 diff만 되돌렸으며 초기 작업본은 깨끗했다.
- 기존 functions export/리전 asia-northeast3/Firestore 경로/결제/인증/모델 유지. 추후 승인 시 Hosting+lawSearch+chatWithResult+Storage Rules 동시 범위 배포가 필요하다. Hosting만 먼저 배포하지 않는다.
- 실제 사용자 문서·운영 Gemini·실기기 E2E는 미실행. HWP5/HWPX 본문만 추출하며 암호·배포용·HWP97·그림 중심 문서는 PDF 변환이 필요하다. 8MiB/문서,20만 문자,16MiB 압축 확장,5초/96MiB worker 제한.
- Slack 직접 게시 없음. GitHub/Slack 대조는 최종 PR 상태와 함께 추가 기록한다. 기록 부재를 기존 작업 미완료 근거로 삼지 않는다.

## 독립 Claude 검토 실행

- 별도 비영속 CLI 세션에서 실행, 파일 수정 권한 없이 `--permission-mode plan --tools Read,Grep,Glob --no-session-persistence --output-format text` 사용.
- 실행 날짜: 2026-11-05 KST. 시작/종료 초 단위 시각은 확보하지 못했다. 대상 HEAD `4459061c`.
- 종료 코드1. 인증 만료로 검토 실행 불가. 승인/지적/자동 판정① 근거가 아니다. 사용자에게 이 제한을 보고한다. 인증 갱신은 수행하지 않았다.

### 질문 원문

```text
독립 읽기 전용 설계·완료 검토를 수행하라. 저장소 /Users/heogyeongdae/Developer/HARU2026, 브랜치 codex/haru-law-dedicated, 검토 대상 HEAD 4459061c. origin/main..HEAD의 코드 변경과 frontend/test/haruLawEntry.test.cjs, frontend/test/haruLawAttachment.test.mjs, frontend/test/haruLawSave.test.cjs, functions/test/haruLawDocument.test.js, functions/test/haruLawAttachmentPipeline.test.js, frontend/test/haruLawStorage.rules.test.mjs를 확인하라. 사용자는 하루LAW 전용 화면 구현, 기존 검색·첨부·저장·기록 보존, 검증 후 배포 전 결과 보고를 요청했고 PDF·HWP·HWPX·텍스트 선택 및 본문 읽기를 추가 요청했다. 파일 수정, Git 변경, 외부 게시, 자격 증명 및 .env 읽기는 금지한다. Read/Grep/Glob만 사용한다. 실제 운영 서비스나 배포를 검증했다고 추측하지 말라. 승인 범위·대규모 여부·Storage 보안 범위·본문 추출 정확성·호환성·기존 기록 보존을 검토하고 P1/P2 결함이 있으면 위치와 재현 조건을 제시하라. 마지막에 승인 / 수정 후 승인 / 재설계 중 판정을 명시하라. 이번 변경은 미병합·미배포이며 운영 E2E와 공식 자동 검토 완료를 주장하지 않는다.
```

### 결과 원문

```text
Failed to authenticate: OAuth session expired and could not be refreshed

```

## 형식 구현 근거

- [한컴 HWP 본문 레코드 설명](https://tech.hancom.com/python-hwp-parsing-2/)
- [한컴 공개 형식](https://download.hancom.com/support/downloadCenter/hwpOwpml)
- [기존 office-crypto OLE reader API](https://github.com/doracpphp/office-crypto#lower-level-access)
- [Gemini 파일 입력](https://ai.google.dev/gemini-api/docs/file-input-methods)

## Slack 기록용 확정 요약

하루LAW 전용 화면과 PDF/HWP/HWPX/TXT 본문 읽기를 작업 브랜치에 구현했다. 기존 기록·원본 첨부·개인화 선택 보존, 웹/Functions 빌드와 관련 시험·권한 에뮬레이터·격리 브라우저를 검증했다. 독립 Claude 검토는 OAuth 만료로 미실행이며 승인으로 간주하지 않는다. 미병합·운영 미배포, 대표님 검토와 공식 리뷰·운영 E2E가 남아 있다.
