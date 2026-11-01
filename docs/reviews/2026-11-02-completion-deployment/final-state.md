# PR319·320·321 운영 반영 확인 — 2026-11-02

판정: **🔍 배포 완료·추가 운영 E2E 필요**. 기록자 Codex. CC가 검토 기록 보존·Git·함수 배포·병합·Hosting 확인을 실행했고 Codex가 운영 브라우저와 선택된 요청 로그를 대조했다. 실제 음성 실청·iOS 새 버전 동작·PDF 사진 포함 출력까지 완료했다고 주장하지 않는다.

## 확정 Git·검증

- PR319: b9651bf2 → main a5258e46. PR320: 리뷰 기록 추가 최종61203da3 → main79543644. PR321: 리뷰 기록 추가 최종d300581a → mainbea0aadcd8afe6e548ea8b9c3a8d221b0f471225. 세 PR 모두 MERGED.
- 최종 PR CI: 319 41195010345/41195010348, 320 41358477442, 321 41358288303 성공. 최신 Codex는 지적0이고 기존 독립 승인 유지. 독립 '수정 후 승인' 누적 319=0,320=1,321=1.
- 검토 후 변경은 필터 없는 name-status로 전부 A/docs/reviews 확인(31924개,32016개,321108개). 제품 변경 없음.
- CC의 기존 합본 b935b898 검증: 웹·Functions build, 131/131, compiled exports114 동일. 합본과 최종main의 frontend/functions/tests/.github/설정·Rules 제품 diff 없음. 이번에는 이 시험을 불필요하게 재실행하지 않았다.

## 함수 선배포

프로젝트 haru2026-8abb8 / asia-northeast3 / nodejs22. b935b898 소스를 ROOT firebase.json predeploy로 빌드해 지정4함수만 배포했다. 2026-11-02 07:49~07:52 KST. 네 함수 모두 ACTIVE·새 revision Ready·트래픽100%, secret 버전 메타데이터 유지.

| 함수 | 새 revision |
|---|---|
| generateTTS | generatetts-00118-niw |
| generateGrowthTimelinePdf | generategrowthtimelinepdf-00034-sox |
| detectPlantAdvanced | detectplantadvanced-00042-bir |
| analyzeFacebookZip | analyzefacebookzip-00045-zoh |

TTS 선배포 후 PR320을 병합했다. 전체 Functions·Rules 배포 없음. Firestore 핵심경로·리전·결제·인증 정책·기존 객체 ACL·캐시 삭제 변경 없음.

## Hosting 경합과 수정 — 실패 기록 보존

세 PR 연속 병합으로 Hosting run3개가 겹쳤다. 마지막 main run41360647969가 성공했어도 PR320 run이 더 늦게 끝나 live를 c8b730e300f42323으로 덮어썼음을 실제 채널 조회로 발견했다. 이 중간 상태를 완료로 처리하지 않았다.

모든 run 종료와 최종main 일치를 확인한 뒤 같은 최종run만 **1회 재실행**했다. attempt2 성공, 코드 추가 변경 없음. 실제 live와 해당 재실행의 버전이 일치한다.

- 최종 main: bea0aadcd8afe6e548ea8b9c3a8d221b0f471225
- 최종 Hosting: **23916f645ab911ff**, releaseTime **2026-11-02 08:29:47 KST**
- [최종 Hosting run41360647969](https://github.com/hkd620-lab/haru2026/actions/runs/41360647969), attempt2
- 실제 HTML·현대JS index-DktopbGn.js·legacyJS·CSS·manifest HTTP200. 최종 버전에서 인증 관문을 거쳐 운영 홈과 SNS 목록 재열기 표시를 확인했다. 실제 Google OAuth 새 로그인 시험과는 구분한다.

## 운영 사용자 동작 확인

1. 아이폰 기존 홈 아이콘은 Firebase Site Not Found였으나 Safari에서 운영주소는 정상. 사용자가 새 홈 아이콘 추가 후 성공을 확인했다. 이전 아이콘의 정확한 URL·캐시 원인은 미확인. 이 사용자 확인은 최종 새 배포 전의 확인이다. 에이전트가 아이콘 삭제·캐시 초기화를 하지 않았다.
2. 합성4색PNG: 식물 분석에 실제 전송, 화면에서 '식물 이미지 아님/4색 도형' 응답. detectplantadvanced-00042-bir POST200(2026-11-02 08:07:57 KST). 식물도감·오늘 기록 저장은 누르지 않았다. 실제 식물종 식별 정확도 시험이 아니다.
3. 성경 문법 팝업: beginning→시초와 문법 예문·AI고음질 버튼 표시 확인. generatetts-00118-niw POST200(08:11:22 KST). 도구에서 안정적인 재생 상태 진입을 확인하지 못했다. 실제 소리·중단/재개·아이폰 자동재생·캐시/한도는 **미확인**이며 실패 원인을 단정하지 않는다. 단어장 저장은 누르지 않았다.
4. 승인된 679바이트 합성 Facebook ZIP 업로드·자동 분석: analyzefacebookzip-00045-zoh POST200(08:37:39 KST). 합성 게시물 **1건과4색 썸네일** 표시. 최종 웹에서 새로고침 후 같은 게시물과 썸네일 재조회 확인. 게시물 문구 'HARU synthetic SNS verification 20261031. No personal information.'이며 개인정보 없는 시험자료다. 시험 게시물1건은 보관 중이며 임의 삭제하지 않았다. 2회 업로드 중복 방지는 이번 운영 시험에서 미실행.

## 남은 확인

- 아이폰 최종 새 배포에서 고음질 듣기·일시정지/재개·닫기 후 취소, 음성 실청.
- 성장 타임라인 PDF에서 합성사진 포함 출력. 이번 운영 PDF 호출은 미실행.
- 독서 이어쓰기 저장·재열기·시작일 보존의 실제 운영 동작, 구형iOS/PWA 갱신. 자동 시험과 운영 확인을 혼동하지 않는다.

## 보관·보존

외장 보관 폴더: /Volumes/LaCie/Mac_작업/완료자료/HARU2026/2026-11-02_PR319-321_마무리

LaCie UUID06827F85-BF9F-465C-9C30-E39085839975를 Codex가 diskutil로 실확인했다. CC의 일부 diskutil 권한 거부는 이 부모 확인과 별개로 원문에 보존했다. cc-*-prompt/stream/stderr, 함수 사전·사후 metadata, 배포 명령 로그, Hosting 중간 실패·재실행 원문, plant-synthetic-live.png, bible-popup-live.png, sns-synthetic-reopened.png, home-final-live.png를 보관한다. 내부 소스·설정·기존 worktree·필수 리뷰 기록을 유지하고 내부 임시 원본을 삭제하지 않았다. 일부 도구 명령이 권한 거부되어 확인하지 못한 항목은 각 원문 README에 명시했다. 에이전트 권한 검사를 비활성화하지 않았다.

원본 작업본은 codex-household-file-import의 사용자 상태 그대로 보존. 이 문서는 운영 후 추가하는 새 기록이며 기존 검토 원문을 수정하지 않는다. Slack 전송은 하지 않았다.

Slack 기록용 확정 요약: PR319/320/321 병합, mainbea0aadc/Hosting23916f645ab911ff 반영. 지정4함수 서울·Node22·Ready·100%. 자동배포 경합을 실제live 조회로 발견해 최종run1회 재실행으로 해결. 합성PNG 분석·SNS1건 썸네일/재열기·TTS200/단어뜻·최종홈 확인. 음성실청/iOS/PDF/독서 저장운영E2E 추가필요. Rules변경없음. 시험SNS1건 보존.

작업 난이도: **5.5 높음**.
