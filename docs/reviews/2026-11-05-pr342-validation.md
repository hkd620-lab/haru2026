# PR342 코드 HEAD bb8f14f3 검증

## 목적·범위
하루LAW 질문 결과와 SAYU 저장 분석의 문단·제목·목록·첫 줄 들여쓰기를 개선함. 새 답변은 짧은 문장과 2~3문장 단락을 생성하도록 lawSearch 지시문 보완. 기존 기록의 저장 원문은 수정하지 않음.

## 실행 명령·결과

- `cd frontend && node --import tsx --test test/haruLawAnswer.test.mjs test/haruLawEntry.test.cjs test/haruLawAttachment.test.mjs test/haruLawSave.test.cjs`: 최종 27 통과, 0 실패, 기존 Rules 에뮬레이터 항목 1 미실행. 새 렌더 테스트는 문단·강조·목록·검증코드 보존, 단일 줄바꿈, 코드 블록, 원시 HTML·위험 링크·외부 이미지 처리를 다룸.
- `cd frontend && npm run build`: 최신 보완 후 통과. 로컬은 demo Firebase 공개 설정으로 빌드했으며 운영용 dist로 사용하지 않음. 기존 청크 크기·legacy·동적 import 경고는 남아 있음.
- `cd functions && npm run build`: 통과. Functions 소스는 첫 코드 커밋 이후 변경 없음.
- `cd functions && node --test test/haruLawDocument.test.js test/haruLawAttachmentPipeline.test.js`: 13 통과, 0 실패.
- `cd functions && node --experimental-strip-types test/haruLawErrorCore.test.js`: 통과. 손상 PDF fixture의 진단 출력은 예상된 오류 사례이며 종료코드 0.
- `git diff origin/main...HEAD -- functions/src/index.ts firebase.json storage.rules firestore.rules`: 변경 없음. 공개 Functions export·설정·Rules 변경 없음.
- `git diff --check`: 통과. 빌드가 재생성한 범위 밖의 기존 `functions/lib/index.js`, `functions/lib/snsToDiary.js`는 작업 전 무변경 상태와 비교해 해당 생성 변화만 복원함. 작업 전부터 있던 `firestore-debug.log`는 그대로 보존함.

## 표시 검증

- 실제 공통 HaruLawAnswer 컴포넌트와 스타일을 이용한 합성 예문 표시 검증. 운영 데이터·인증·추가 AI 호출 없음.
- 390×844 브라우저 모바일 크기: 문서 scrollWidth 375px, 가로 넘침 없음. 본문 15px·line-height 28.5px·첫 줄 text-indent 15px를 DOM 계산 스타일로 확인.
- 1280px 브라우저: scrollWidth 1265px, 답변 읽기 폭 약 642.59px, 가로 넘침 없음. 임시 viewport는 원래 크기로 복원함.
- iPhone/PWA 운영에서 새 코드를 검증한 것은 아님. 별도 운영 배포를 하지 않았으므로 운영의 기존 화면은 그대로임.
- 검토용 이미지의 외장 보관 위치: `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/2026-11-05_하루LAW_답변가독성_174312`. LaCie UUID와 복사본 SHA-256 일치 확인. 최종 화면 보완본은 같은 폴더에 새 이름으로 추가 보관.

## 보존·배포 영향

Firestore 핵심 경로 `users/{uid}/records/{date}`, Functions 리전 `asia-northeast3`, 모델·호출 횟수·환경변수·결제·인증·첨부 MIME·저장 필드·Storage/Firestore Rules 유지. 모바일 Flutter 소스 변경 없음.
후속 배포 대상은 웹 Hosting과 `lawSearch`만이며 아직 병합·운영 배포하지 않음. 새 생성 지시문의 실제 모델 출력은 편차가 있을 수 있고, 기존 장문 자체를 재작성하는 변경은 아님. 필요 시 코드 되돌리기와 직전 웹/해당 함수 소스 재배포로 복귀하며 기록 삭제·마이그레이션 불필요.
