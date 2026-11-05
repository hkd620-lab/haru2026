# PR339 운영 배포와 첫 E2E 근거

- 사용자 지시: 남은 리뷰 후 문제없으면 PR339 병합 및 웹/Functions/Storage 규칙 배포, 검색/문서 첨부/저장을 운영에서 확인.
- PR339 merge SHA `7542e33457bdcb54ce3236f1d4d096fdf8c1a9d3`, 2026-11-05T05:31:30Z. main 코드와 배포 작업본 c81178f0의 파일 diff 없음.
- Hosting 성공 실행 https://github.com/hkd620-lab/haru2026/actions/runs/41974545070 . 최초 live release `1793856774342000`, version `2e29d9e8c052a647`, releaseTime 2026-11-05T05:32:54.342Z, FINALIZED.
- 운영 자산 `/assets/index-DPipsV4O.js`, SHA256 `593680087ac1ffb70bcb8904f7f29da9214bf15f9f0d00902762921f3fb6cdc9`.
- Functions 두 개만 배포: lawSearch `lawsearch-00141-hat`(2026-11-05T03:44:10.944339675Z), chatWithResult `chatwithresult-00039-rom`(2026-11-05T03:44:11.486142402Z). 둘 다 GEN2/ACTIVE/nodejs22/asia-northeast3. gcloud functions list와 Cloud Run traffic 실측, 각 새 revision 100%.
- Storage ruleset `projects/haru2026-8abb8/rulesets/e6c81b6f-d330-4e83-828f-ee9890c0f890`, updateTime 2026-11-05T03:40:35.189212Z. 운영 원문 SHA256 `0647d1dca7491179f2b994368004a2a99b06d18d612af6f971e1e5a692d399a0`가 검토본과 일치. Firestore Rules 배포 없음.
- 규칙 → Functions → 웹 순서. 서버/규칙 이전 상태와 되돌리기 기준은 PR339 검토 색인에 보존.
- 운영 Chrome의 홈 카드가 `/haru-law`로 진입하며 질문이 첫 화면에 보임. 기존 개인화의 하루LAW 1개 유지.
- 운영 Storage에 합성 PDF/TXT와 공개 실제 HWP/HWPX 샘플 네 개 업로드 성공. 운영 lawSearch가 공식 법령 검색과 실제 Gemini 응답에 성공(HTTP200, 2026-11-05T05:44:41.558814Z).
- 응답에 합성 PDF 검증코드 PDF339-K7 및 TXT 코드 TXT339-P2가 일치했다. HWP/HWPX에 대해 응답한 문장을 각각 로컬 추출 본문과 공백 정규화 대조하여 둘 다 일치함을 확인했다. 코드·문서에 실제 당사자/계약정보를 넣지 않았다. 공개 원본 출처/해시는 PR339 검토 색인에 기록.
- 저장 성공 안내, 사유비서 상세 재열기 및 네 첨부/분석 결과 표시 확인.
- 자동 날짜 입력 화면에는2099-11-05가 보였으나 실제 저장은2026-11-05였다. 미래 날짜 저장 시험을 통과로 보지 않는다. 실제 Firestore 문서의 createTime/updateTime 모두2026-11-05T05:59:30.850062Z이며 새 문서 생성으로 확인, 기존 문서를 덮어쓴 것이 아님. 사용자 식별자/원문은 출력·보존하지 않고 메타데이터만 확인했다.
- 시험 문서 `users/{uid}/records/2026-11-05`: 첨부4개, MIME application/pdf, application/x-hwp, application/vnd.hancom.hwpx, text/plain. 미선택 날씨/기온/기분 필드 없음. 시험 기록은 삭제하지 않았다.
- 운영 재열기에서 저장 상세의 비이미지 배지가 모두 PDF인 표시 누락을 발견하여 PR341에서 같은 작업 범위의 웹 라벨만 보완한다. 이 표시가 고쳐지기 전 전체 화면 완성으로 주장하지 않는다.
- 실기기 모바일/PWA E2E나 모든 HWP 버전 지원을 확인했다고 표현하지 않는다. Slack 직접 게시 없음. 최종 운영 증거와 라벨 확인은 후속 결과로 별도 남긴다.
