# S21 사진 속도 개선 웹 배포 확인

- 허대표님 승인: “배포하고 마무리 하자 속도개선이 됀거지?” (현재 대화)
- PR #276: https://github.com/hkd620-lab/haru2026/pull/276
- 병합 SHA: e3137c3b84174805f2fbe0c49286c0ae4032f3ec
- 병합: 2026-10-17 09:50:57 KST. Hosting 자동배포 성공 확인: 2026-10-17 09:52:23 KST (Actions updatedAt).
- 배포 근거: https://github.com/hkd620-lab/haru2026/actions/runs/38988248168
- Firebase 프로젝트 haru2026-8abb8, Hosting live만 배포. Functions/Rules 배포 없음. 리전·Firestore 경로·결제·인증 정책 변경 없음.
- 두 운영 도메인 haru2026.com, haru2026-8abb8.web.app에서 /assets/index-D5tDjIF6.js 확인. 검토된 preview와 SHA256 동일: 364aeeab317eadff8dd9af80c697c475e5ef43ece8246c4653dc75702d72acca. 두 sw.js 모두 새 bundle 참조.
- 판정: 배포 완료, 🔍 실제 업로드·저장 재열기 E2E 필요. S21 최종 제품 전체 업로드 속도는 아직 측정하지 않음. 기기 내 진단4.77초를 전체 업로드 속도로 주장하지 않음.
- S21에서 저장 중인 내용 저장 후 페이지를 다시 열어 같은 사진1장 선택, 완료 시간·표시 확인, 기록 저장 후 재열기 필요. iPhone 회귀 및 큰 HEIC/여러장/방향·색 확인도 남음.
- 후속 실행2 색인 및 이 배포 증거는 작업 브랜치의 사후 문서 기록으로 보존. 운영 코드 추가 변경·추가 배포 없음.
