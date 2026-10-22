# 기록 사진 격리 브라우저 검증

frontend에서 `npm run dev -- --config test/record-photos-browser/vite.config.mjs` 실행 후 http://127.0.0.1:18762 를 연다.

실제 FormatModal·SayuModal·사진 읽기·EXIF·압축 코드를 사용한다. Firebase SDK·인증·구독·로딩·firestoreService는 Vite 테스트 resolver가 모의 구현으로 교체한다. 운영 Firebase·Storage·AI에는 연결하지 않는다. 모의 사진 URL에는 합성 SVG를 표시하며 실제 업로드 이미지 내용은 저장하지 않는다. 저장 데이터는 해당 origin의 localStorage `record-photos-qa`에만 남는다.

- 에세이/일기 → 신규 기록 → 간편 또는 프리미엄 → 제목/본문 입력 → 시험용 사진 7장 선택 → 5장 표시·초과 2장 안내·첨부 버튼 비활성 확인.
- 저장 후 ‘저장 기록 열기’에서 5장 재표시 확인.
- 수정하기 → 다섯 번째 사진 삭제 → 4/5 추가 버튼 → 1장 재첨부 → 5장 확인.
- `/?mobile`은 390×844 iframe으로 같은 컴포넌트의 실제 휴대폰 너비 viewport를 제공한다. 프레임 안에서 동일한 저장 기록을 열고 수정한다.
- `/?app&edit&plan=premium`으로 프리미엄 구독 mock, 기본은 basic. 사진 한도는 구독값을 참조하지 않는다.

2026-10-22 검증: 간편 에세이에서 7장 중 5장 첨부·저장·재열기·다섯 번째 삭제·재첨부를 브라우저로 확인. 390px 표시 및 수정 화면의 5장 그리드·삭제 버튼 확인. 실제 기기·운영 Firebase 영속 저장은 별도 E2E 대상이다.

사진 첨부가 없던 독서사유·주식 OCR·배뇨일지에는 새 저장 사진 기능을 추가하지 않는다. 보조장부는 기존 10장 한도를 유지한다. 숨김 형식·Flutter 앱은 수정하지 않는다.
