# Android 기록형식 사진 업로드 수정 검증

- PR: https://github.com/hkd620-lab/haru2026/pull/275
- 검토 대상 소스 HEAD: `8a7ac2f87eb77ce6f75f9dd8d5fa3367249cafe9`
- 브랜치: `codex-photo-picker-compatibility` (원격 `codex` 브랜치가 있어 `codex/` 접두어는 directory/file 충돌로 사용 불가)
- 변경 영역: FormatModal 업로드 핸들러, selectedRecordPhoto 서비스, 시험 두 파일.

## 검증 명령과 결과

- `cd frontend && node --import tsx --test test/formatPhotoUploadResult.test.mjs test/selectedRecordPhoto.test.mjs`: 14건 통과.
- `cd frontend && node --import tsx test/recordPhotoUploadCore.test.mjs`: 통과.
- `cd frontend && node test/recordPhotoPolicy.test.mjs`: 통과.
- `cd frontend && npm run build`: 통과. 명시적인 시험용 Firebase 설정(demo-haru)을 프로세스 환경으로만 제공하여 컴파일·번들 확인. 이 산출물은 운영 배포용이 아님. 환경파일 수정 없음.
- `git diff --check`: 통과.
- 소스 HEAD의 GitHub `build_and_preview`, `Deploy Preview`: SUCCESS 확인.

## 검토 원문

- Codex 1차: [색인](2026-10-16-photo-picker-codex-1-index.md). P1 용량·메모리 지적 후 수정.
- Codex 2차: [색인](2026-10-16-photo-picker-codex-2-index.md). `Codex Review: Didn't find any major issues. :tada:`
- 독립 Claude 1차: [질문](2026-10-16-photo-picker-claude-1-request.md), [결과](2026-10-16-photo-picker-claude-1-result.md). `수정 후 승인`.
- 독립 Claude 2차: [질문](2026-10-16-photo-picker-claude-2-request.md), [결과](2026-10-16-photo-picker-claude-2-result.md). `판정: 승인`.
- 정책 보충: [질문](2026-10-16-photo-picker-claude-policy-request.md), [결과](2026-10-16-photo-picker-claude-policy-result.md). 승인 유지, 중규모. 운영 완료 판정은 실기기 확인 필요. 특정 과거 CC 세션의 배포 승인은 이 Codex 작업에 승계하지 않음.

## 커밋 메시지와 실제 diff 대조

- `db854fc5 fix: 기록 사진 전체 실패와 부분 성공 안내 수정`: 0장 성공 차단·부분 성공 보존과 시험.
- `2acf20b2 fix: 안드로이드 사진 원본을 메타정보보다 먼저 읽기`: change 이벤트에서 즉시 읽기 후 메모리 File 전달과 시험.
- `8a7ac2f8 fix: 사진 읽기 용량을 제한하고 처리 메모리 해제`: 제한 스트림, 초과 취소, 원시 버퍼 이중 반환 제거, 처리 큐 해제와 시험.
- 세 제목과 실제 변경 일치 확인. 모델·홈·라우터·Functions·Rules·저장 경로·결제·인증·환경파일 변경 없음.

## 실기기 증거와 한계

- 연결된 갤럭시 Chrome/PWA의 같은 HEIC 약 4.5MB에서 원본 arrayBuffer/FileReader 읽기 실패, blob URL 로컬 fetch의 ERR_UPLOAD_FILE_CHANGED 확인.
- 현재 화면에서 change 시 원본을 즉시 읽고 메모리 File로 전달하는 임시 우회 후 4,513,391바이트 읽기 성공. 허대표님이 변환·첨부 성공 확인.
- 해당 convertHeic 요청 duration 약 15.2초, Storage 요청 각각 약 0.4~0.9초. 과거 동일 조건 계측값이 없어 속도 퇴행 여부는 미확정.
- 최종 제한 스트림 빌드 자체의 실기기 E2E와 운영 배포 후 저장·재조회는 미확인. 임시 우회 성공을 최종 운영 완료로 확대하지 않음.
- 운영 미배포, main 미병합. 운영 반영 승인과 이후 실기기 확인 필요.
