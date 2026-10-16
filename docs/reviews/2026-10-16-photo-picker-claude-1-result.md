# 독립 Claude 검토 1차 결과 원문

- 대상 HEAD: 2acf20b2447342bbf5827bebd06819b641cf434c
- 결과 확인 시각: 2026-10-16 14:33:58 KST
- 판정: 수정 후 승인

# PR #275 검토 (HEAD 2acf20b2)

## 판정: 수정 후 승인

방향은 맞습니다. 파일을 선택한 직후 모든 원본 읽기를 동기적으로 시작하고, 이후 단계는 메모리에 복사한 `File`만 쓰는 방식은 ERR_UPLOAD_FILE_CHANGED 대응으로 타당합니다. 여러 장 중 일부가 실패해도 나머지를 살리는 처리와 "0장 성공" 오보를 없앤 처리도 개선입니다. 다만 아래 두 가지는 병합 전에 고쳐야 합니다. 첫째는 메모리 보유 구조이고, 둘째는 `lastModified` 소실이 촬영 시각 메타데이터에 주는 영향입니다.

---

## 1. 정확성

**맞는 부분**
- `files.map(async ...)`는 첫 `await` 전까지 동기적으로 실행됩니다. 그래서 모든 `source.arrayBuffer()` 호출이 변경 이벤트 핸들러 안에서 즉시 시작됩니다. 비이미지 파일은 읽지 않고 걸러지며, 이 동작은 테스트로 검증됩니다.
- 헬퍼의 promise는 reject되지 않고 항상 `{ok}` 형태로 resolve됩니다. 핸들러가 중간에 빠져나가도 unhandled rejection이 생기지 않습니다.
- 기존에는 `throw fileError` 때문에 루프 전체가 중단됐습니다. 이제는 파일 단위 `continue`로 바뀌어, 이미 성공한 업로드가 결과에 반영됩니다. 테스트에서 `tracked`와 `images`가 일치하는 것도 확인됩니다.
- 0장 성공일 때 `return`해도 `finally`가 실행되므로 `setIsUploading(false)`와 input 초기화가 유지됩니다. 테스트로 확인됩니다.

**확인·수정이 필요한 부분**
1. **`lastModified` 소실 (회귀 가능성 높음)**: `new File([buffer], name, { type })`로 만들면 `lastModified`가 생성 시각(현재 시각)이 됩니다. `readOriginalImageMeta`가 EXIF가 없을 때 `file.lastModified`를 촬영 시각으로 대신 쓴다면, EXIF 없는 사진과 HEIC→JPEG 변환본의 날짜가 업로드 시각으로 바뀝니다. 원본의 `lastModified`를 읽지 않는 것이 이번 설계의 전제이므로, 대체값 로직을 제거하거나 "메타데이터 없음"으로 명시하는 처리가 필요합니다. 해당 함수의 사용처를 꼭 확인하세요.
2. **헬퍼 호출 이전의 원본 접근 여부**: diff에는 `files.length`, `slice`만 보입니다. 하지만 `handleImageUpload`에서 `startSelectedRecordPhotoReads` 호출 전 구간이나 `onChange` 상위에서 `file.size`, `file.name`, 미리보기 `URL.createObjectURL` 같은 접근이 없는지 전체 핸들러를 확인해야 합니다. 같은 문제를 가진 다른 업로드 진입점(다른 기록 형식, 프로필, 가계부 등)은 이번 범위 밖이라 여전히 취약합니다.
3. **죽은 분기**: HEIC 변환 catch의 `NotReadableError` 분기는 이제 메모리 버퍼만 다루므로 사실상 실행될 일이 없습니다. 테스트 이름("Android HEIC NotReadableError ... before calling the server")도 실제로는 헬퍼의 catch를 검증합니다. 해롭지는 않지만, 분기를 제거하거나 주석으로 의도를 밝히는 편이 낫습니다.
4. **겹치는 검사**: 루프 안의 20MB 검사와 형식 검사는 헬퍼와 중복이고, 형식 판정 기준도 미묘하게 다릅니다(헬퍼는 type의 heic/heif 정규식, 모달은 확장자 위주). 지금은 결과가 같지만, 한쪽만 수정되면 어긋날 수 있습니다.
5. **토스트 잔존**: 바깥 `catch`의 `toast.error`에는 `{ id: uploadNoticeId }`가 없습니다. 그래서 장수 초과 경고 토스트가 오류 토스트와 함께 남습니다(경미).

## 2. 메모리 위험 (주요 수정 사항)

- **동시 전량 적재**: 선택한 모든 파일을 한꺼번에 `ArrayBuffer`로 읽습니다. 20MB를 넘는 파일도 **전부 읽은 뒤에야** 거절됩니다. size를 읽을 수 없다는 제약상 불가피하지만, 대형 파일이 섞이면 순간 메모리가 크게 튑니다.
- **이중 보유와 해제 불가**: 반환값에 `buffer`와 `new File([buffer])`가 함께 담깁니다. Blob 생성 시 데이터가 복사되므로 파일당 약 2배를 차지합니다. 게다가 `selectedPhotoReads` 배열이 resolve된 promise, 곧 버퍼를 핸들러가 끝날 때까지 참조합니다. 이미 처리한 사진의 버퍼도 GC되지 않습니다. 최대 장수 × 20MB × 2에 압축 캔버스와 HEIC base64 문자열(UTF-16 이진 문자열 포함 수 배)까지 더하면, 저사양 Android Chrome에서 탭 강제 종료(OOM)가 날 수 있습니다.
- **권장 수정**:
  - 헬퍼는 메모리 기반 `File`(Blob)만 반환하고 `buffer`는 반환하지 않습니다. Chrome은 Blob 데이터를 JS 힙 밖 blob 저장소로 옮길 수 있습니다.
  - HEIC 경로는 메모리 기반 `file.arrayBuffer()`를 다시 호출합니다. 원본이 아니므로 ERR_UPLOAD_FILE_CHANGED 위험이 없습니다.
  - 처리가 끝난 항목은 배열 슬롯을 `undefined`로 비워 참조를 끊습니다.
  - HEIC base64 변환은 `String.fromCharCode` 누적 대신 `FileReader.readAsDataURL`처럼 중간 문자열이 적은 방식을 검토합니다(선택 사항).

## 3. 테스트

**좋은 점**: 원본의 `size`·`lastModified`·`slice` 접근을 getter가 던지는 예외로 막아 검증하는 방식이 이번 수정의 핵심 불변식을 잘 고정합니다. 부분 실패, 재시도, 20MiB 경계 테스트도 적절합니다.

**한계와 누락**
- `formatPhotoUploadResult.test.mjs`는 소스 문자열을 마커(`const handleImageUpload = async`, `// Firebase Storage URL →`)로 잘라 `loader: 'ts'`로 vm에서 실행합니다. 리팩터링이나 JSX 유입에 매우 취약하고, 실패하면 원인이 테스트 인프라인지 코드인지 구분하기 어렵습니다. 장기적으로는 핸들러 로직을 순수 함수로 분리하길 권합니다.
- `.ts`를 직접 import하므로 CI의 Node 버전과 type stripping 플래그 설정을 확인해야 합니다.
- 누락된 테스트:
  - `periodRow`(가계부 기간 입력) 경로
  - `readOriginalImageMeta`에 넘어가는 `lastModified` 값(위 회귀 검증용)
  - 처리 완료 후 버퍼 참조 해제 여부(구조 수정 후 간접 검증)
  - 로그인 없음이 여러 장일 때 실패 메시지 개수
- Node의 `File`은 Chrome의 snapshot·content URI 동작을 재현하지 못합니다. 지금 테스트는 "원본 메타데이터를 건드리지 않는다"는 **설계 불변식**만 증명할 뿐, 실제 오류가 해소된다는 증명은 아닙니다.

## 4. 운영 판정의 한계

- 근본 원인 가설은 이렇습니다. Chrome이 content URI 파일의 snapshot(size/mtime)을 처음 접근할 때 확정하고, 이후 읽기에서 provider 값이 달라지면 오류가 납니다. 이 가설로 보면 이번 수정은 **실패 창을 줄이는 것이지 없애는 것이 아닙니다**. 클라우드 전용 항목처럼 provider가 읽는 도중 내용을 실체화하는 경우에는 여전히 실패할 수 있고, 이때는 "기기에 다운로드" 안내로 넘어갑니다.
- 병합 전후로 실기기 확인을 권장합니다: Google 포토(로컬/클라우드 전용), 삼성 갤러리, Drive 선택, HEIC, 여러 장 동시 선택, 저메모리 기기.
- 현재는 실패가 `console.error`로만 남아 현장 재발 여부를 판단할 수 없습니다. 실패 사유 범주(읽기 실패/용량/형식/업로드)별 카운트를 분석·로그로 수집하면 효과를 판정할 근거가 생깁니다. 개인정보가 포함되지 않도록 사유 코드만 남기세요.

## 요약

| 항목 | 판단 |
|---|---|
| 접근 방식(즉시 읽기 후 메모리 복사본 사용) | 타당 |
| 부분 실패 처리·알림 | 개선, 승인 |
| 메모리(버퍼 이중·전량 보유) | **수정 필요** |
| `lastModified` 소실의 메타데이터 영향 | **확인·수정 필요** |
| 테스트 | 불변식 검증은 양호, 취약한 구조와 일부 누락 |
| 운영 효과 | 실기기와 계측 없이는 판정 불가 |

→ **수정 후 승인**: 메모리 보유 구조를 고치고 `lastModified` 영향을 확인·보완하면 승인 가능합니다. 재설계까지는 필요 없습니다.
