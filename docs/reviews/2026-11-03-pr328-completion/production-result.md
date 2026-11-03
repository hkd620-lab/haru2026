# PR #328 병합·Hosting 결과 및 Functions 잔여 범위

## 승인된 작업 결과

- ✅ main 병합·Hosting 배포 완료. 허대표님 직접 승인 “#328 병합·Hosting 자동배포 승인”. 이 승인에는 Functions·Rules 배포나 이전 함수 14개 삭제가 포함되지 않는다.
- 검토 HEAD e829fa4cc2197703ab21e6318b174fb19b4f9fd2, main 병합 69480ecafdb8b170051e1ea3ae71bb72512f1208. 이전 main 대비 functions/package-lock.json 3필드 변경뿐이다. 병합된 lock은 검토 원본과 바이트 단위 동일, SHA-256 76e03c4c6015e6caa55135ef5e4b1bf46460ab433c5627781c33cab5159b40e4.
- Functions 빌드, 합성 호환성 7/7, 관련 시험 18/18, CI 2개, 자동 Codex 무지적, 독립 Codex 원문 “승인”. 근거는 같은 디렉터리의 기존 검토 기록에 보존했다.
- [Hosting 실행 41586795863](https://github.com/hkd620-lab/haru2026/actions/runs/41586795863) 성공. 프로젝트 haru2026-8abb8, Hosting live 버전 8e836f851b5b844c. 배포 단계 완료 2026-11-03 14:57:37 KST, 실행 완료 14:57:40 KST.
- 운영 확인 14:58:35 KST: https://haru2026.com HTML 및 modern/legacy JavaScript HTTP 200, 제목 정상, HTML 자산명과 해당 CI 빌드 결과 일치. 프론트 코드가 같아 자산명이 이전 배포와 같으며 배포 구분 근거는 Actions의 main SHA와 Hosting 버전이다.
- Slack 공개 검색에서 #haru2026-개발 GitHub 연동의 #328 병합·main push 알림 14:56:18 KST를 GitHub 결과와 대조했다. 봇 자동 알림이며 별도 감사 판정 게시를 한 것은 아니다. 직접 전송 지시가 없어 Slack 미게시.

## Functions 적용은 아직 미완료

- ⚠️ 부분완료: 저장소의 Functions 잠금 파일은 갱신됐지만 운영 Functions는 재배포하지 않았다. 현재 함수 100개의 운영 소스 압축본에 포함된 lock은 모두 node-forge 1.4.0이다. 이는 배포 소스 lock 확인이며 실행 중 컨테이너 파일을 직접 읽은 결과는 아니다.
- gcloud read-only 목록·소스 참조 및 Storage 객체 메타데이터를 대조했다. 현재 export100개에 해당하는 중복 제외 압축본36개/517,540,752바이트를 내부 임시 검증 위치에 내려받았다. generation을 현재 함수 참조와 대조하고 내려받은 각 원본의 MD5를 원격 메타데이터와 확인했으며 SHA-256도 기록했다.
- 비교 범위는 lib 아래 컴파일된 JS/map/JSON 및 package.json/package-lock.json이다. .env 내용은 비교·출력하지 않았다. 소스 아카이브 원문을 Git·PR·Slack에 올리지 않았다.
- 99개 함수의 배포 압축본에는 현재 후보와 다른 컴파일 파일이 있다. chatWithResult는 공통 컴파일 파일·manifest가 같고 lock만 다르지만, 이전 grammar 컴파일 파일 5개가 운영 압축본에 추가로 있어 전체 아티팩트 동일성을 주장할 수 없다. 전체 파일 목록·함수 대응은 live-source-comparison.json에 있다.
- 따라서 현재 main으로 함수100개를 일괄 재배포하면 node-forge 외 코드 변경이 함께 반영될 수 있다. 현재의 일괄 배포안을 승인 대상으로 올리지 않는다. 이전 export 밖 함수14개는 비교·배포·삭제 대상에서 제외했다.

## 다음 작업 인수인계

첫 행동은 live-source-comparison.json의 함수별 차이를 검토하여 각 운영 소스에 node-forge 잠금 갱신만 적용할 수 있는 배포 후보를 설계하는 것이다. 현재 main으로 바꾸려면 같이 배포될 코드 차이를 별도 검토해야 한다. 후보별 원본·수정 diff, 정확한 함수명, 이전 source/revision, 배포 후 dependency/runtime/traffic 확인과 최소 사용자 동작을 준비하고 독립 검토 후 구체적 Functions 승인을 받는다.

- 금지: 전체 functions 명령, legacy14개 삭제, Rules 배포, 실제 사용자 데이터 정리, 승인 전 Functions 배포. 인증·결제 정책을 바꾸지 않는다.
- 기존 별개 audit64건과 실기기 E2E·정책 결정 장부는 유지한다.
- 증빙은 audit 브랜치에 추가 파일로 보존하고 외장 새 폴더 20261103_PR328_병합완료_01에 SHA-256 확인 후 보관한다. 실행 결과는 외장 SHA256-검증.json과 최종 보고에 남긴다. 내려받은 운영 소스는 내부 임시 검증 위치에 보존하며 삭제하지 않았다.
- 난이도: 중간.

## Slack 기록용 확정 요약 (미게시)

PR #328 검증·독립 검토 승인 후 허대표님 승인으로 main 69480eca 병합, Hosting 41586795863/live8e836f851b5b844c 성공, 운영 HTML·JS HTTP200. Functions·Rules 배포 없음. 운영 소스 lock100개는 node-forge1.4.0이며 99개에 후보와 다른 컴파일 코드가 있어 함수별 배포 후보 검토가 남음. legacy14개 보존.
