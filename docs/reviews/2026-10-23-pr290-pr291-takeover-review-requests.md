# 통계·합본 인수 후 최신 HEAD 검토 요청 색인

- 인수 근거: https://harulab-hq.slack.com/archives/C0C11P98MHV/p1792744413952579
- 선행 PR #290 HEAD: `e8414275371a72e26a718323122f9715455f7a8f`
- 통합 PR #291 HEAD: `0a8a20d6e6b707faeef2b1d262195a29562cde64`
- CC 인수 HEAD `1b36eb75` 이후 코드 변경은 `writeBeforeFormat.ts`와 그 테스트 두 파일뿐이다. 선교·일반보고 후보와 프리미엄 초안 전달을 보완했다.

| PR·실행 | 요청 원문 | 요청 시각(UTC) | 실행 대상 HEAD | 상태 |
| --- | --- | --- | --- | --- |
| #290 인수 후 실행 1 | https://github.com/hkd620-lab/haru2026/pull/290#issuecomment-6361028446 | 2026-10-23 08:42:45 | e8414275371a72e26a718323122f9715455f7a8f | 요청 완료, 결과 대기 |
| #291 실행 8 | https://github.com/hkd620-lab/haru2026/pull/291#issuecomment-6361028767 | 2026-10-23 08:42:46 | 0a8a20d6e6b707faeef2b1d262195a29562cde64 | 요청 완료, 결과 대기 |

시작 시각·완료 시각·결과 리뷰 ID는 아직 확인되지 않았다. 결과가 나온 뒤 별도 보조 색인으로 추가하며 이 요청 기록은 수정하지 않는다. 기존 독립 Claude 검토 승인은 CC 코드 HEAD `2cb31382` 기준이며 새 코드 변경을 승인한 것으로 간주하지 않는다. 최신 HEAD 검토·대표 결정 전 main 병합과 운영 배포는 하지 않았다.

## 인수 후 검증

- PR #290: 글쓰기·형식 등록부 11/11, `npm run build` 통과. 빌드에는 비밀값이 아닌 임시 Firebase 자리표시자를 사용했다.
- PR #291 통합 코드: 글쓰기·형식 등록부·통계 27/27, 저장 정책 테스트 통과.
- PR #291 통합 코드: `npm run build` 통과(2분 58초). 비밀값이 아닌 임시 Firebase 자리표시자 사용.
- Functions: `npm run test:epub-content` 8/8, `npm run test:format-registry-parity` 3/3 통과. 두 명령에 포함된 Functions 빌드 통과.
- Functions 소스·export 목록은 CC 인수 HEAD 이후 변경 없음. 빌드가 바꾼 추적 생성 파일 두 개는 빌드 전 HEAD 내용으로 복원했다.
- CI: #290 run 39926213099, #291 run 39926340190 성공.
- PR #291 미리보기의 공개 첫 화면이 열리는 것만 확인했다. 로그인 계정이 없어 통계·합본·EPUB E2E는 미확인이다.
- 운영 `exportEpub` 읽기 전용 실측: `asia-northeast3`, Node.js 22, revision `exportepub-00030-vok`, 메모리 512MiB, 동시 요청 80, 제한 시간 120초. 운영 변경 없음.

## 남은 결정·검증

- #290 → #291 순서의 main 병합 및 Hosting 자동배포, `exportEpub` 단독 운영 배포 승인.
- `pet_special` 본문 칸과 충돌을 피하는 `specialDays[형식 키]` 저장 방식 확인.
- EPUB 메모리·동시 요청 제한 결정. 현재 PR은 메모리 512MiB·제한 시간 300초이며 인스턴스 동시 요청 제한은 명시하지 않았다.
- 최신 HEAD Codex 결과와 독립 Claude 검토, 로그인 계정별 통계 대조 및 사진 포함 EPUB, iOS·Android PDF/EPUB 확인.
- #290 병합 후 #291 base를 main으로 변경하고 변경 HEAD·충돌·CI를 확인한다.
