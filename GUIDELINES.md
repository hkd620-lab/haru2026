# HARU2026 프로젝트 가이드라인 (2026)

## 🎯 프로젝트 개요
- **프로젝트명**: HARU2026 (하루이공이육)
- **개발자**: 허 교장님
- **슬로건**: "간편하게 입력하고, 쓸모있게 남깁니다"

## 🏗️ 핵심 기술 스택
- **프론트엔드**: React + TypeScript + Vite + Tailwind CSS
- **백엔드**: Firebase (Auth, Firestore, Functions)
- **AI 연동**: Gemini API (반드시 Cloud Functions를 통해서만 호출)

## ⭐ SAYU 철학 (절대 원칙)
- **AI의 역할**: 사용자의 글을 다듬고 구조화할 뿐, 새로운 내용을 창작하거나 감정을 조작하지 않는다.
- **SAYU 이름**: 반드시 "SAYU"로 표기 (SAU 사용 금지)

## 🔐 보안 및 데이터
- **API 키**: 클라이언트 코드(.tsx, .ts)에 절대 노출 금지
- **Firestore 경로**: `users/{userId}/records/{recordId}`

## 📁 파일 구조 준수
- 페이지: `frontend/src/app/pages/`
- 컴포넌트: `frontend/src/app/components/`
- 서비스/로직: `frontend/src/app/services/`
