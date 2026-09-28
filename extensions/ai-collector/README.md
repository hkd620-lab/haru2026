# AI 지식 수집기 2.4

HARU 연동 소스의 리뷰·배포 기준본이다. Chrome의 `압축해제된 확장 프로그램을 로드합니다`에서 이 폴더를 선택한다.

## HARU 저장 흐름

1. 선택 본문·출처 URL로 SHA-256 멱등키를 만든다.
2. AI 보관함은 멱등키를 문서 ID로 사용한다. 이미 존재하는 문서(HTTP 409)는 중복 없는 성공으로 처리한다.
3. 확장은 본문을 `chrome.storage.local`에 임시 저장하고 `https://haru2026.com/ai-import#<멱등키>`를 연다.
4. HARU 웹앱이 기존 Firebase 로그인 세션으로 `users/{uid}/records/ai_import_<멱등키>`에 저장한다.
5. HARU 웹앱이 기록을 다시 읽어 존재·타입·출처를 확인한 뒤에만 성공을 표시한다.
6. 확인 성공 메시지를 받은 확장은 임시 payload를 삭제한다.

Firebase 로그인 토큰과 HARU 사용자 UID는 확장에 저장하지 않는다. Firestore 보안 규칙은 기존 본인 UID 제한을 그대로 사용한다.

## 시험

```sh
npm test
```
