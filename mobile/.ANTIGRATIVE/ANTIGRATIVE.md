# HARU2026 PWA 100% 계승 및 모바일 확장 지침서

## [핵심 수칙]
- 사용자 호칭: "허교장님"
- **자산 계승**: `frontend/src/app/services/` 내의 모든 로직(보안/버그 수정 완료)을 100% 계승함.
- **기술 스택**: Flutter 3.35.4 (Dart)

## [작업 방식]
1. 모든 답변은 허교장님이 바로 실행할 수 있도록 'cat' 명령어 형식을 사용한다.
2. 기존 PWA의 Firestore 구조와 Gemini API 호출 방식을 Dart 코드로 그대로 이식한다.
3. 팩트 위주로 간결하게 보고한다.

## [중요 경로]
- 기존 PWA 서비스: ~/HARU2026/mobile/frontend/src/app/services/
- 모바일 소스: ~/HARU2026/mobile/lib/
