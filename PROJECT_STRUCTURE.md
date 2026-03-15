# HARU2026 프로젝트 구조 설명

## 📂 전체 프로젝트 구조

```
haru2026/
├── frontend/                 # React 프론트엔드 애플리케이션
│   ├── src/
│   │   ├── app/             # React 컴포넌트 및 페이지
│   │   │   ├── components/  # UI 컴포넌트
│   │   │   │   ├── ui/      # Radix UI 기반 기본 컴포넌트
│   │   │   │   ├── SayuTitleAnimation.tsx
│   │   │   │   ├── RecordDetailModal.tsx
│   │   │   │   ├── ExportModal.tsx
│   │   │   │   └── 기타 커스텀 컴포넌트
│   │   │   └── App.tsx      # 루트 애플리케이션 컴포넌트
│   │   ├── lib/             # 유틸리티 및 설정
│   │   │   └── supabase.ts  # Supabase 클라이언트 설정
│   │   ├── styles/          # 스타일시트
│   │   │   └── index.css    # Tailwind CSS 설정
│   │   ├── main.tsx         # 애플리케이션 진입점 (ReactDOM.createRoot)
│   │   ├── firebase.ts      # Firebase 초기화 및 설정
│   │   └── check_router.ts  # 라우터 검증 유틸리티
│   ├── guidelines/          # 개발 가이드라인 및 문서
│   ├── public/              # 정적 자산 (필요시)
│   ├── index.html           # HTML 진입점
│   ├── package.json         # 프론트엔드 의존성
│   ├── package-lock.json    # 의존성 락 파일
│   ├── tsconfig.json        # TypeScript 설정
│   ├── vite.config.ts       # Vite 번들러 설정
│   ├── postcss.config.mjs   # PostCSS 설정
│   ├── README.md            # 프론트엔드 개발 가이드
│   ├── ATTRIBUTIONS.md      # 외부 라이브러리 출처 표기
│   └── 각종 유틸리티 스크립트
│
├── functions/               # Firebase Cloud Functions (백엔드)
│   ├── src/
│   │   └── index.ts        # Cloud Functions 메인 로직
│   ├── lib/                # 컴파일된 JavaScript 파일
│   ├── package.json        # 백엔드 의존성
│   ├── package-lock.json   # 의존성 락 파일
│   ├── tsconfig.json       # TypeScript 설정
│   └── firebase.json       # Firebase 함수 배포 설정
│
├── firebase.json            # Firebase 프로젝트 설정
│   ├── functions: Node.js 20 런타임에서 실행
│   ├── firestore: Firestore 규칙
│   └── hosting: SPA 호스팅 설정
├── package.json             # 루트 패키지 설정
├── package-lock.json        # 루트 의존성 락 파일
└── .git/                    # Git 저장소
```

## 🔧 주요 기술 스택

### 프론트엔드
- **프레임워크**: React 18.3 + TypeScript
- **번들러**: Vite 6.3.5
- **스타일링**: Tailwind CSS 4.1 + PostCSS
- **라우팅**: React Router 7.13
- **UI 라이브러리**:
  - Radix UI (기본 컴포넌트)
  - Material-UI 7.3 (아이콘, 컴포넌트)
  - Shadcn/ui (커스텀 UI 컴포넌트)
- **상태관리**: Context API (필요시 확장 가능)
- **폼 관리**: React Hook Form 7.55
- **데이터 시각화**: Recharts 2.15
- **애니메이션**: Motion 12.23
- **클라우드**: Firebase 10.14
- **AI/ML**: Google Generative AI, OpenAI

### 백엔드
- **런타임**: Node.js 20
- **플랫폼**: Firebase Cloud Functions
- **프레임워크**: firebase-functions 6.3
- **데이터베이스**: Firebase Firestore
- **인증**: Firebase Authentication
- **AI**:
  - Google Vertex AI (vertex-ai 1.10)
  - Google Generative AI (0.24.1)
  - OpenAI (6.22.0)

## 📋 디렉토리별 역할

### `/frontend/src/app/components/`
**UI 컴포넌트 라이브러리**
- `ui/`: Radix UI 래퍼 컴포넌트 (Button, Dialog, Tabs 등)
- 커스텀 모달 (RecordDetailModal, ExportModal)
- 애니메이션 컴포넌트 (SayuTitleAnimation)

### `/frontend/src/lib/`
**유틸리티 및 서비스**
- Supabase 클라이언트 초기화
- API 호출 함수 (필요시)
- 데이터 변환 함수 (필요시)

### `/frontend/src/styles/`
**전역 스타일**
- Tailwind CSS 설정
- 커스텀 CSS 변수
- 글로벌 스타일 정의

### `/functions/src/`
**서버리스 백엔드**
- Cloud Functions HTTP 트리거
- Firestore 데이터 처리
- AI 모델 호출
- 외부 API 통합

## 🚀 주요 기능

1. **사용자 인터페이스**
   - Radix UI 기반의 접근성 높은 컴포넌트
   - Tailwind CSS로 빠른 스타일링
   - Material-UI 아이콘 라이브러리

2. **데이터 관리**
   - Firebase Firestore 실시간 데이터베이스
   - React Hook Form으로 폼 데이터 관리
   - Supabase 연동 가능 (선택사항)

3. **AI 기능**
   - Google Gemini API 통합
   - OpenAI API 통합
   - Google Vertex AI 연동

4. **데이터 시각화**
   - Recharts를 활용한 차트 및 그래프
   - 반응형 차트 컴포넌트

5. **배포 및 호스팅**
   - Firebase Hosting에서 정적 파일 제공
   - Cloud Functions에서 서버 로직 실행
   - SPA(Single Page Application) 설정

## 📝 개발 워크플로우

### 설정 및 설치
```bash
# 루트 디렉토리에서 모든 의존성 설치
npm install

# 프론트엔드 의존성만 설치 (선택)
cd frontend && npm install

# 백엔드 의존성만 설치 (선택)
cd functions && npm install
```

### 로컬 개발
```bash
# 프론트엔드 개발 서버 실행 (http://localhost:5173)
cd frontend && npm run dev

# 프로덕션 빌드
cd frontend && npm run build

# 백엔드 TypeScript 컴파일
cd functions && npm run build

# Firebase 에뮬레이터 사용 (선택)
firebase emulators:start
```

### 배포
```bash
# Firebase에 배포
firebase deploy

# 함수만 배포
firebase deploy --only functions

# 호스팅만 배포
firebase deploy --only hosting
```

## 🔑 환경 설정

### 프론트엔드 (`.env` 파일)
```
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
VITE_GEMINI_API_KEY=...
```

### Firebase 설정
- `firebase.json`: Firebase 프로젝트 설정
- `functions/firebase.json`: 함수 배포 설정
- `firestore.rules`: Firestore 보안 규칙

## 📚 주요 파일 설명

| 파일 | 목적 |
|------|------|
| `frontend/src/main.tsx` | React 애플리케이션 진입점 |
| `frontend/src/app/App.tsx` | 루트 컴포넌트 및 라우팅 |
| `frontend/src/firebase.ts` | Firebase 초기화 |
| `frontend/vite.config.ts` | 번들러 및 개발 서버 설정 |
| `functions/src/index.ts` | Cloud Functions 메인 파일 |
| `firebase.json` | Firebase 배포 설정 |
| `postcss.config.mjs` | CSS 후처리 설정 |

## 🔒 보안 고려사항

- Firebase Firestore 규칙: `firestore.rules`에서 관리
- API 키: 환경 변수로 관리 (.env 파일)
- 민감한 정보는 Cloud Functions에서만 처리
- Firebase Security Rules로 데이터 접근 제어

## 📦 의존성 관리

- **패키지 관리자**: npm (선택: pnpm)
- **Node.js 버전**: 18+ (프론트엔드), 20 (백엔드)
- **TypeScript**: 5.0+
- 의존성은 `package-lock.json`으로 버전 고정

## 🎯 프로젝트 특징

1. **풀스택 JavaScript/TypeScript**: 프론트엔드와 백엔드 모두 JavaScript 사용
2. **서버리스 아키텍처**: Firebase Cloud Functions로 인프라 관리 최소화
3. **AI 통합**: 다양한 AI 모델 (Gemini, OpenAI, Vertex AI) 지원
4. **개발자 경험**: Vite, TypeScript, Tailwind CSS로 빠른 개발
5. **확장 가능성**: Radix UI와 커스텀 컴포넌트로 쉬운 UI 확장

이 구조로 유지보수가 쉽고 확장 가능한 모던 웹 애플리케이션을 개발할 수 있습니다.
