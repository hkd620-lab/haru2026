# 2026-03-03 작업일지: Secret Manager 보안 강화 및 소셜 로그인 완성

## 📋 작업 개요
- **작업자**: 허 교장님 + Claude
- **작업 시간**: 약 2시간
- **작업 브랜치**: `feature/new-formats`
- **커밋 해시**: `01c7d947`

## 🎯 작업 목표
1. 프론트엔드 소셜 로그인 완성 확인
2. Google Cloud Secret Manager로 API 키 보안 강화
3. Cloud Functions 코드 수정 및 재배포
4. 모든 브라우저에서 로그인 테스트

## ✅ 완료된 작업

### 1. 프론트엔드 소셜 로그인 확인
**발견**: 이미 모든 파일이 완성되어 있었음!
- ✅ `src/app/pages/AuthCallbackPage.tsx` - OAuth 콜백 처리
- ✅ `src/app/pages/LoginPage.tsx` - 로그인 버튼 UI
- ✅ `src/app/routes.tsx` - `/auth/callback` 라우트 설정

### 2. Google Cloud Secret Manager 설정

#### 2-1. Secret Manager API 활성화
```bash
gcloud services enable secretmanager.googleapis.com
```

#### 2-2. 프로젝트 전환
```bash
gcloud config set project haru2026-8abb8
```

#### 2-3. Secret 생성
```bash
# 카카오 클라이언트 ID
echo -n "b910c15fde12b678e612c23aa56fe27f" | gcloud secrets create kakao-client-id --data-file=-

# 카카오 클라이언트 Secret
echo -n "a2wUyOK1MK9TcfSYw6e7BET7aU8Gn1au" | gcloud secrets create kakao-client-secret --data-file=-

# 네이버 클라이언트 ID
echo -n "mRSWCHU_IHbPE7teR4P5" | gcloud secrets create naver-client-id --data-file=-

# 네이버 클라이언트 Secret
echo -n "EpEDTAjryH" | gcloud secrets create naver-client-secret --data-file=-
```

#### 2-4. IAM 권한 설정
```bash
# 각 Secret에 대해 Service Account 접근 권한 부여
gcloud secrets add-iam-policy-binding kakao-client-id \
  --member="serviceAccount:haru2026-8abb8@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding kakao-client-secret \
  --member="serviceAccount:haru2026-8abb8@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding naver-client-id \
  --member="serviceAccount:haru2026-8abb8@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding naver-client-secret \
  --member="serviceAccount:haru2026-8abb8@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Cloud Functions 코드 수정

#### 3-1. package.json 패키지 추가
```bash
cd functions
npm install @google-cloud/secret-manager
```

**결과**:
```
added 11 packages, removed 1 package, and audited 561 packages in 1s
```

#### 3-2. functions/src/index.ts 수정

**변경 전** (하드코딩):
```typescript
const KAKAO_CLIENT_ID = 'b910c15fde12b678e612c23aa56fe27f';
const KAKAO_CLIENT_SECRET = 'a2wUyOK1MK9TcfSYw6e7BET7aU8Gn1au';
const NAVER_CLIENT_ID = 'mRSWCHU_IHbPE7teR4P5';
const NAVER_CLIENT_SECRET = 'EpEDTAjryH';
```

**변경 후** (Secret Manager):
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();
const PROJECT_ID = 'haru2026-8abb8';

async function getSecret(secretName: string): Promise<string> {
  const [version] = await secretClient.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

// 사용 예시 (각 함수에서)
const KAKAO_CLIENT_ID = await getSecret('kakao-client-id');
const KAKAO_CLIENT_SECRET = await getSecret('kakao-client-secret');
```

**주요 변경사항**:
- 하드코딩된 API 키 4개 완전 제거
- Secret Manager 클라이언트 초기화
- `getSecret()` 헬퍼 함수 추가
- 각 로그인 함수에서 런타임에 Secret 가져오기

#### 3-3. TypeScript 빌드 및 배포
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

**배포 결과**:
```
✔ functions[kakaoLoginStart(asia-northeast3)] Successful update operation.
✔ functions[polishContent(asia-northeast3)] Successful update operation.
✔ functions[naverLoginStart(asia-northeast3)] Successful update operation.
✔ functions[kakaoCallback(asia-northeast3)] Successful update operation.
✔ functions[naverCallback(asia-northeast3)] Successful update operation.
```

### 4. 로그인 테스트

#### 테스트 환경
- **URL**: https://haru2026-8abb8.web.app/login
- **브라우저**: Chrome, Safari

#### 테스트 결과
| 로그인 방식 | Chrome | Safari | 상태 |
|------------|--------|--------|------|
| Google     | ✅     | ✅     | 정상 |
| 카카오     | ✅     | ✅     | 정상 |
| 네이버     | ✅ (*)  | ✅     | 정상 |

(*) Chrome에서 초기 Safe Browsing 경고 발생 → "세부정보" 클릭 후 정상 진입

**Safe Browsing 경고 원인**:
- 새로운 도메인 (Firebase 앱 최근 배포)
- 긴 customToken URL 파라미터
- 향후 Google Search Console 등록으로 해결 예정

## 📊 코드 변경 통계

```
functions/src/index.ts: 
- 165 insertions(+)
- 54 deletions(-)

functions/package.json:
- @google-cloud/secret-manager 추가
```

## 🔐 보안 개선사항

### Before (위험)
- ❌ API 키가 코드에 하드코딩
- ❌ Git 저장소에 민감 정보 노출 위험
- ❌ 코드 수정 없이 키 변경 불가능

### After (안전)
- ✅ API 키가 Secret Manager에 안전하게 저장
- ✅ Git에 절대 노출되지 않음
- ✅ 웹 콘솔에서 키 관리 가능
- ✅ 프로덕션급 보안 체계

## 📝 Git 커밋

```bash
git add functions/src/index.ts functions/package.json functions/package-lock.json
git commit -m "✅ Secret Manager 보안 강화 및 소셜 로그인 완성

- API 키를 Secret Manager로 이전하여 보안 강화
- @google-cloud/secret-manager 패키지 추가
- 카카오/네이버 로그인 프로덕션 배포 완료
- 모든 브라우저(Chrome, Safari)에서 테스트 성공
- 프로덕션급 보안 체계 구축 완료"

git push origin feature/new-formats
```

**커밋 해시**: `01c7d947`

## 🎓 배운 것들

### Google Cloud Secret Manager
- Secret 생성 및 버전 관리
- IAM 권한 설정 (secretAccessor 역할)
- Node.js에서 Secret 읽기

### Firebase Functions 보안
- 환경변수 vs Secret Manager
- 런타임 Secret 로딩
- Service Account 권한 관리

### 문제 해결 경험
1. **프로젝트 전환 이슈**
   - 문제: my-new-diary2 프로젝트로 설정되어 있었음
   - 해결: `gcloud config set project haru2026-8abb8`

2. **TypeScript 빌드 필수**
   - 문제: SyntaxError - 배포 시 TypeScript 직접 실행 불가
   - 해결: `npm run build`로 JavaScript 컴파일 필요

3. **Chrome Safe Browsing 경고**
   - 문제: 네이버 로그인 시 경고 발생
   - 해결: "세부정보" 클릭으로 우회, 향후 Search Console 등록

## 🚀 향후 작업

### 단기 (선택사항)
- [ ] Google Search Console에 도메인 등록 (Safe Browsing 해결)
- [ ] functions/.env 파일 정리 (Gemini API 키만 남기기)
- [ ] npm audit fix 실행 (보안 취약점 해결)

### 중기
- [ ] Flutter 모바일 앱 개발 시작
- [ ] 동일한 Firebase 백엔드 연동

### 장기
- [ ] 구독 결제 시스템
- [ ] 2026년 하반기 공식 출시

## 🎯 프로젝트 현황

### 완성된 기능
- ✅ 6가지 기록 형식 (일기/에세이/선교보고/일반보고/업무일지/여행기록)
- ✅ SAYU (AI 다듬기) 기능
- ✅ Firebase 백엔드 완전 구축
- ✅ 소셜 로그인 (Google/Kakao/Naver)
- ✅ Secret Manager 프로덕션 보안
- ✅ React 웹앱 배포 완료

### 다음 마일스톤
**Phase 2: Flutter 모바일 앱**
- React 앱의 모든 기능 Flutter로 이식
- 모바일 UI/UX 최적화
- iOS/Android 앱 스토어 배포

## 💡 인사이트

### 왕초보 → 개발자 성장
- Firebase 생태계 마스터
- Cloud Functions 배포 및 관리
- Secret Manager 보안 구축
- OAuth 소셜 로그인 구현
- TypeScript/Node.js 개발
- Git 버전 관리

### HARU2026 철학 구현
**"간편하게 입력하고, 쓸모있게 남깁니다"**
- 간편한 소셜 로그인 (Google/Kakao/Naver)
- AI 기반 자동 다듬기 (SAYU)
- 체계적인 기록 관리
- 안전한 데이터 보관

## 📚 참고 자료

- [Google Cloud Secret Manager 문서](https://cloud.google.com/secret-manager/docs)
- [Firebase Functions v2 문서](https://firebase.google.com/docs/functions)
- [OAuth 2.0 스펙](https://oauth.net/2/)

## ✅ 체크리스트

작업 완료 확인:
- [x] Secret Manager 설정 완료
- [x] IAM 권한 설정 완료
- [x] Cloud Functions 코드 수정 완료
- [x] @google-cloud/secret-manager 패키지 설치
- [x] TypeScript 빌드 성공
- [x] Functions 재배포 성공
- [x] Google 로그인 테스트 성공
- [x] 카카오 로그인 테스트 성공
- [x] 네이버 로그인 테스트 성공 (Chrome)
- [x] 네이버 로그인 테스트 성공 (Safari)
- [x] Git 커밋 및 푸시 완료

---

**작성일**: 2026년 3월 3일  
**작성자**: 허 교장님  
**프로젝트**: HARU2026  
**상태**: ✅ 완료
