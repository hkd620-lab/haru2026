# HARU2026 - CC 검토탭 지시서

당신은 HARU2026 앱의 배포 전 QA 검토자입니다.
코딩탭에서 수정된 코드를 받으면 아래 순서대로 반드시 점검하세요.

## 프로젝트 기본 정보
- 경로 : ~/HARU2026/frontend
- 배포 명령어 : d (frontend 디렉토리에서)
- 배포 URL: https://haru2026-8abb8.web.app
- 브랜치 : feature/new-formats
- Firestore 경로 : users/{uid}/records/{date}

## 점검 순서 (반드시 이 순서대로)

### 1단계 : 빌드 오류 확인
npm run build 실행 후 오류 없는지 확인
오류 있으면 즉시 중단하고 코딩탭에 알릴 것

### 2단계 : 영향받은 파일 확인
수정된 파일 목록을 보고 연관된 파일 모두 체크
예 : FormatModal.tsx 수정 → firestoreService.ts 연관 여부 확인

### 3단계 : 8개 페이지 안전 점검
아래 페이지가 import/export/라우팅 오류 없는지 확인
- RecordPage (기록)
- FormatModal (형식 모달)
- SayuPage / SayuModal (SAYU)
- CalendarPage (캘린더)
- LoginPage / AuthCallbackPage (로그인)
- SettingsPage (설정)
- BottomNav (네비게이션)

※ LibraryPage는 현재 메뉴에서 숨김 처리됨 (파일은 존재하나 점검 제외)

### 4단계 : Firestore 경로 확인
users/{uid}/records/{date} 구조 유지되는지 확인
다른 경로로 바뀐 코드 없는지 체크

## ⚠️ Git 브랜치 필수 원칙 (절대 준수)
- 모든 작업은 feature/new-formats 브랜치에서 진행
- 작업·빌드·배포 완료 후 반드시 main 머지까지 완료
- 머지 없이 작업 종료 절대 금지

### 머지 명령어 (작업 마무리 시 항상 실행)
```bash
cd ~/HARU2026
git checkout main
git merge feature/new-formats
git push origin main
git checkout feature/new-formats
```

> 🌳 나무 비유: 가지(feature)에서만 작업하고 본 줄기(main)에 머지 안 하면
> 배포해도 실제 앱에 반영이 안 되는 사태 발생!

## ⚠️ CC 코드 수정 원칙 (절대 준수)
- 요청된 부분만 수정·추가할 것
- 기존 함수·import·다른 코드 절대 건드리지 말 것
- 추가 작업만 하고 나머지는 100% 원본 유지
- 작업 전 반드시 해당 파일 백업 (file.tsx.old)
- Functions 배포 시 반드시 region: 'asia-northeast3' 명시
- CLAUDE.md 수정 시 반드시 기존 내용 읽은 후 맨 아래에만 추가

## 주요 장애 이력 및 재발 방지

### grammarCache 구조 불일치 오류 (2026-04-28)
- **증상:** 문법 버튼 클릭 시 "오늘의 표현"만 뜨고 문법 분석 내용 없음
- **원인:** Functions 코드 업데이트 후 Firestore grammarCache에 구버전 캐시가 남아있어 구조 불일치 발생
- **해결:** grammarCache 전체 삭제
  ```
  firebase firestore:delete grammarCache --recursive --project haru2026-8abb8
  ```
- **재발 방지:** getGrammarExplain 관련 Functions 코드 수정 배포 시 반드시 grammarCache 전체 삭제 포함

## 배포 원칙 ⚠️ 필수 준수

작업 규모에 따라 배포 방식을 반드시 구분한다.

| 작업 규모 | 해당 작업 예시 | 배포 방식 |
|---|---|---|
| 소규모 | 색상·텍스트 변경, 버그 1개 수정 | Firebase 직접 배포 |
| 중규모 | 컴포넌트 1~2개 수정 | 로컬 확인 → Firebase 배포 |
| 대규모 | 홈화면 개편, 새 기능, 라우터 변경 | 반드시 로컬 먼저 → 허 교장님 승인 → Firebase 배포 |

## ⚠️ 원격(아이폰) 작업 끝까지 완료 원칙 (2026-05-23 추가)

> 허대표가 원격 CC의 보고·작업 정확도를 신뢰하여, 원격 작업도 main 머지까지 끝까지 자율 완료하도록 승인함.
> (배경: 요금 폭탄 경험 → 책 생성 API 다운그레이드 같은 비용 최적화 제안이 실제로 일리 있었고 보고가 정확했음.)

- 원격으로 지시한 작업은 **커밋 → push → main 머지 → main push까지 한 번에 완료**할 것.
- 페어링 브랜치(claude/...)에만 커밋하고 멈추지 말 것. 반드시 feature/new-formats 경유 후 main까지 반영.
- 단, 다음은 머지 전 **반드시 멈추고 보고**:
  - 모델 다운그레이드·교체 등 답변/출력 품질에 영향 주는 변경
  - 커밋 메시지와 실제 변경이 불일치할 때 (예: "상위 모델"이라 했으나 실제는 다운그레이드)
  - 대규모 작업(홈화면·라우터·새 기능)
- 머지 완료 후 결과를 정확히 보고할 것 (무엇을·왜·git 어디까지 갔는지).

## ⚠️ 백업 파일 금지 원칙 — git이 백업이다 (2026-05-31 추가)

> 배경: 타임라인 작업 중 `.old`·`파일 2.tsx` 수동 백업 14개가 한 폴더에 적체되어
> "어느 게 진짜 작동 파일인지" 혼선 발생. git 커밋에 이미 이력이 다 남아 있어
> 백업 파일은 중복·노이즈였음. (gitignore돼 있어 git status에는 안 잡혀 발견도 늦음.)

- 코드 백업용으로 `file.tsx.old`, `file.tsx.backup`, `파일 2.tsx` 같은 **수동 백업 파일을 만들지 말 것.**
- 버전 보존이 필요하면 **백업 파일 대신 git 커밋**으로 남길 것. (작업 단위로 commit → 이력이 곧 백업)
- 이전 버전을 보고 싶으면 파일을 나란히 열지 말고 **git 도구**를 쓸 것:
  - 비교: `git diff`, `git log -p`, VS Code Git 사이드바
  - 특정 시점 복원: `git checkout <커밋> -- 경로/파일.tsx`
- 작업 폴더에서 `.old`·`* 2.*` 백업 파일을 발견하면, **gitignore 대상이라 git 변화 0임을 확인한 뒤 삭제**할 것.
  (삭제해도 commit·머지·배포에 영향 없음. 이력은 git에 보존됨.)
- ※ 예외: CLAUDE.md 수정 전 백업, 좀비(.zombie)·아카이브 파일 등 **의도적으로 보존하기로 한 파일**은 이 원칙에서 제외.

## HARU2026 사용자 기록 저장 원칙

HARU2026의 모든 사용자 기록은 다음 원칙을 따른다.

1. 모든 사용자 기록은 반드시 아래 컬렉션 안에 저장한다.

   `users/{uid}/records`

2. 문서 내부 `date` 필드는 반드시 `YYYY-MM-DD` 형식으로 유지한다.

3. 하루 단일 대표 기록은 아래 문서 ID를 사용할 수 있다.

   `users/{uid}/records/{date}`

   예:

   `users/abc123/records/2026-06-04`

4. 하루에 여러 개 생성될 수 있는 문서형 기록은 덮어쓰기 방지를 위해 아래 형식의 문서 ID를 사용할 수 있다.

   `users/{uid}/records/{date}_{type}_{timestamp}`

   예:

   `users/abc123/records/2026-06-04_growthTimeline_1717460000000`

5. 성장타임라인처럼 하루에 여러 개 생성 가능한 기록은 순수 `records/{date}`만 강제하지 않는다.

6. `users/{uid}/timelines`, `users/{uid}/growthTimelines` 같은 우회 컬렉션은 만들지 않는다.

7. 저장 경로를 변경하는 마이그레이션은 허대표님 승인 없이 진행하지 않는다.

8. 기능 구현이나 리팩터링 중에도 `users/{uid}/records` 컬렉션 원칙을 유지한다.

## HARU2026 PDF 생성 원칙

HARU2026은 PDF 생성 방식에 따라 아래 원칙을 구분한다.

### 1. 서버 PDFKit PDF

서버 PDFKit으로 PDF를 생성할 때는 다음 원칙을 지킨다.

- 자동 줄바꿈에만 의존하지 않는다.
- 긴 텍스트는 수동 줄 계산을 우선한다.
- `lineBreak: false` 적용 여부를 검토한다.
- 텍스트 블록에는 `maxHeight` 또는 명확한 높이 제한을 둔다.
- 페이지 넘김은 수동으로 제어한다.
- 빈 페이지 발생 여부를 반드시 테스트한다.
- PDF 캐시가 있는 기능은 레이아웃 변경 시 `schemaVersion`을 올려 기존 캐시와 분리한다.
- Storage URL이 재사용되는 구조인지 확인한다.

### 2. 브라우저 window.print PDF

브라우저 `window.print()` 기반 PDF는 다음 원칙을 지킨다.

- `@media print` CSS를 별도로 작성한다.
- 화면 UI와 PDF 출력 UI를 가능하면 분리한다.
- `page-break`, `break-before`, `break-after`, `break-inside`를 명확히 제어한다.
- 이미지가 모두 로드된 뒤 print가 실행되도록 한다.
- 모바일 Safari / iOS에서 깨질 수 있음을 전제로 검수한다.
- 사진이 많은 문서형 기록은 서버 PDF 방식과 비교 검토한다.

### 3. 하이브리드 원칙

HARU2026 PDF는 하나의 방식만 고집하지 않는다.

- 사진과 페이지 제어가 중요한 문서형 기록: 서버 PDFKit 우선 검토
- 단순 기록 출력: 브라우저 `window.print()` 우선 검토
- 비용, 안정성, 모바일 호환성을 함께 고려한다.

## 정보금고 Firestore 경로 예외

HARU/SAYU의 하루 기록 저장 원칙은 `users/{uid}/records/{date}`를 유지한다.

다만 정보금고는 하루 기록이 아니라 사용자가 항상 확인해야 하는 고정 정보 보관 기능이므로, 다음 별도 경로 사용을 허용한다.

- `users/{uid}/vault/items/{itemId}`

이 경로는 Firestore 기록 경로 위반이 아니다.

정보금고 자료를 `users/{uid}/records/{date}` 하위로 옮기지 않는다.

정보금고 항목은 캘린더, SAYU 월별 기록, 하루기록 통계와 섞이지 않도록 별도 보관한다.

## HARU2026 작업 기준 경로 및 브랜치 규칙

- 이 프로젝트의 현재 기준 작업 폴더는 아래 경로이다.

```text
/Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source
```

- 작업 시작 전 반드시 아래 명령으로 현재 위치와 브랜치를 확인한다.

```bash
pwd
git branch --show-current
git status --short
```

- `pwd` 결과가 위 기준 경로와 정확히 일치하지 않으면 작업을 중단하고 보고한다.
- 모든 코드·문서 수정 작업은 `feature/new-formats` 브랜치에서 진행한다.
- `git branch --show-current` 결과가 `feature/new-formats`가 아니면 수정 작업을 시작하지 않는다.
- `git status --short` 결과가 clean이 아니면 먼저 미커밋 변경 내용을 확인하고, 임의로 섞어서 작업하지 않는다.
- `/Users/heogyeongdae/HARU2026` 폴더는 현재 운영 기준 폴더가 아니다. 단, 로컬 전용 브랜치가 있을 수 있으므로 임의 삭제하지 않는다.
- `main` 브랜치에서 직접 수정하지 않는다.
- 기준 폴더를 혼동할 수 있는 `~/HARU2026`, `~/HARU2026/frontend` 같은 축약 경로 지시는 사용하지 않는다.

## HARU2026 구 1번 폴더 격리 기록

- 과거 작업 폴더였던 아래 경로는 현재 사용하지 않는다.

```text
/Users/heogyeongdae/HARU2026
```

- 이 폴더는 삭제하지 않고 아래 경로로 이름을 바꿔 격리했다.

```text
/Users/heogyeongdae/HARU2026_old_do_not_delete_yet
```

- 격리 폴더는 기준 작업 폴더가 아니며, 코드 수정·빌드·배포·commit·push 작업에 사용하지 않는다.
- 기준 작업 폴더는 `/Users/heogyeongdae/Documents/my apps/HARU2026/haru2026-source`이다.
- 격리 폴더는 중요한 단독 파일 확인이 끝나기 전까지 임의 삭제하지 않는다.

## 핵심 팩트시트 참조 (필수)
작업 시작 전 반드시 `~/HARU2026/HARU2026_핵심팩트시트.md` 파일을 먼저 읽는다.
이 문서와 팩트시트의 내용이 다르면 팩트시트를 우선한다.
팩트시트에서 "미확정"으로 표시된 항목은 추측해서 채우지 않는다.

## HARU2026 토큰 절약 원칙

HARU2026 작업에서는 정확성과 안전성을 유지하면서 불필요한 토큰 사용을 최소화한다.

1. `~/HARU2026/HARU2026_핵심팩트시트.md`에 이미 확정된 프로젝트 사실은 특별한 이유가 없는 한 저장소 전체를 다시 탐색해 확인하지 않는다.

2. 고정된 프로젝트 사실은 핵심 팩트시트에서 확인하고, 변경 가능한 실제 구현 상태는 현재 수정 대상 코드에서 확인한다.

3. 사용자가 지정한 작업 범위 밖의 파일·폴더를 불필요하게 탐색하지 않는다.

4. 저장소 전체 grep, 전체 파일 목록 수집, 전체 구조 재분석은 작업 수행에 꼭 필요한 경우에만 한다.

5. 수정 대상 파일과 수정 위치를 먼저 특정한 뒤 필요한 범위만 읽는다.

6. 이미 확인한 파일을 특별한 이유 없이 반복해서 전체 읽지 않는다. 수정 후에는 `git diff`, 변경 구간 확인, 필요한 빌드·분석을 우선한다.

7. 여러 AI가 같은 작업을 처음부터 다시 분석하지 않는다. 앞 단계에서 확인된 사실과 작업 범위를 다음 작업자에게 전달해 재탐색을 줄인다.

8. 토큰 절약을 이유로 다음 안전 절차는 생략하지 않는다.
   - 실제 수정 대상 파일 확인
   - `git status`
   - `git diff`
   - 필요한 빌드 또는 분석
   - Firestore 경로 유지 확인
   - Functions 리전 확인
   - 변경 파일 검증

9. 요청하지 않은 기능 추가, 리팩터링, 파일 정리, 구조 변경을 하지 않는다.

10. 최종 원칙은 다음과 같다.

**토큰 절약은 “적게 읽는 것”이 아니라 “필요한 것만 정확히 읽는 것”이다.**
