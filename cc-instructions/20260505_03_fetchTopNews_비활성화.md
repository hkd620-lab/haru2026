# CC 지시서 — fetchTopNews 자동 스케줄 비활성화 (오늘 2단계)

## 작업 개요

`fetchTopNews` 함수가 30분마다 자동 실행되어 월 7,200원 비용 발생 중.
이걸 완전히 OFF 시켜줘. 뉴스는 이제 개발자(허 교장님)만 수동으로 새로고침 사용 예정.

## 작업 전 안전 저장

```bash
cd ~/HARU2026 && git add -A && git commit -m "작업 전 안전 저장 - fetchTopNews 비활성화"
```

## 수정 대상

### 파일: `~/HARU2026/functions/src/index.ts`
### 위치: 약 line 2138 부근, `fetchTopNews` 함수

## 수정 방법

`fetchTopNews` 함수 전체를 **삭제하지 말고 주석 처리**해줘.
(나중에 필요하면 다시 살릴 수 있게)

방법:
- `export const fetchTopNews = onSchedule(...)` 시작부터 함수 끝까지 `/* */` 블록 주석으로 감싸기
- 함수 위에 한 줄 메모 추가: `// 2026-05-05 비활성화: 비용 절감 (월 7,200원). 필요 시 주석 해제하여 재활성화`

## 작업 절차

1. fetchTopNews 함수 전체 범위 확인 (시작줄~끝줄)
2. 주석 처리
3. `cd ~/HARU2026/functions && npm run build` 빌드 확인
4. 배포는 안 함, 허 교장님 승인 대기

## 보고 형식

1. 주석 처리한 줄 범위 (시작~끝)
2. 빌드 결과
3. 배포 대기 중

## ⚠️ 금지 사항

- 다른 함수 손대지 말 것
- refreshNews는 건드리지 말 것 (이미 어제 작업 완료)
- 배포 절대 금지 (승인 후)
