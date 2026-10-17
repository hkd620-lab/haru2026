# 기록·비서 사진 선택 경로 점검

기준 main e3137c3b. PR #275/276이 새 기록 `FormatModal.handleImageUpload`만 고친 상태에서 나의 기록 수정은 `SayuModal.handleImageUpload`의 별도 코드에 남아 있었다. 수정 화면은 원본 size/EXIF를 먼저 읽고 HEIC를 서버로 먼저 보내므로 같은 Android 파일 읽기 오류와 지연이 재현될 수 있다.

| 사용자 동작 | 실제 입력/처리 | 보완 |
|---|---|---|
| 기록 형식 새 기록·보조장부 행 사진 | FormatModal.handleImageUpload | 기존 즉시 읽기/로컬 우선/부분 성공 유지 |
| 사유 나의 기록 사진 수정 | SayuModal.handleImageUpload | 선택 즉시 메모리 File 확보, 로컬 우선, 새 기록과 같은 800px·0.85, 기존 저장 실패 롤백 유지 |
| 성장타임라인 새 기록 | GrowthTimelineCreator.handleFiles | 즉시 읽기, 원본 EXIF 추출 후 JPEG 미리보기 생성, 저장 때 재변환하지 않음 |
| 성장타임라인 수정 | SayuModal.handleTimelineImageAdd | 즉시 읽기·로컬 우선/서버 대체 |
| 독서 본문·주식·보조장부·가계부 OCR | FormatModal의 네 사진 선택 핸들러 | 선택 시 메모리 File 확보 후 input 초기화. 나중 OCR 실행에서도 읽을 수 있음. 로컬 우선/서버 대체 |
| 식물탐정 새 판독·판독 편집 | PlantDetectivePage.handleFileChange | 즉시 읽기. HEIC 원본 한 번 변환, JPEG에서 썸네일 생성. 일부 실패 때 성공 사진 유지 |
| 내 식물도감 성장사진 | PlantDetectivePage.addGrowthPhotoToPlant | input 초기화 전에 읽기 시작, 로컬 우선/서버 대체 |
| 나의 기록 식물 판독 사진 추가 | SayuPage → uploadSayuPlantDetectivePhoto | event→업로드 함수 첫 await 전에 원본 읽기 시작, 로컬 우선/서버 대체 |
| 약 비서 사진 | SayuHealthDrugPage.onPhotoChange | 즉시 읽기·빈 MIME 보완·로컬 우선/서버 대체 |
| 하루LAW 첫 첨부·대화 추가 첨부 | HaruLawPanel/ResultChatModal | 사진만 즉시 읽기, 원본 첨부 바이트와 기존 7MB/총량 정책 유지. PDF 경로 유지. 원본 첨부는 화질 보존을 위해 재압축하지 않으므로 전송 속도는 원본 크기·통신에 따름 |
| 정보금고 새 기록·수정 사진 | VaultPage.handleFilesChange | 즉시 읽기·HEIC 지원·기존 긴 변1600px 확인용 압축 유지. 읽는 중 저장/닫기 방지 |

사진당20MiB 제한을 유지하고, 한 번 선택한 사진 읽기는 합계60MiB를 넘으면 중단해 나누어 선택하도록 안내한다. 빈 MIME은 jpg/jpeg/png/webp/heic/heif 확장자로 보완한다. 기존 파일 정책, 저장 경로, Functions 리전, Rules·결제·인증은 변경하지 않는다. 원본 HEIC 서버 대체는 기존 convertHeic API를 이용한다.

점검 범위는 활성 기록·비서 사진 선택 경로다. 관리자 발행 화면(오늘충전·K뉴스), 프로필, 연결되지 않은 ExportModal/DEBUG, ZIP/XLSX/TXT/HWP 입력은 이 범위 밖이다. 숨김 LibraryPage와 금지 파일은 점검·수정하지 않는다.

실기기 검증: iPhone과 S21에서 같은 사진의 새 기록/수정/저장 재열기, JPEG·HEIC·세로사진·복수선택, OCR 지연 실행, 비서 분석 입력, 정보금고 저장을 확인한다. 사진 선택~읽기/변환 완료~전송 완료를 구분한다. 현재 기기 미연결로 제품 전체 시간과 운영 E2E는 미확인이다. 이전4.77초는 한 S21 사진의 로컬 진단 수치이며 모든 경로 시간 보장이 아니다.
