# 네이버 심사 대응 운영 지시서 — 탈퇴·환불·결제취소·빌링키·이용 개시 로그

작성일: 2026-08-24

## 1. 회원탈퇴

- 이용자 화면: `설정 > 계정 관리 > 회원탈퇴`
- 서버 함수: `requestAccountDeletion`
- 실행 조건: `config/accountDeletion.enabled === true`
- 처리 원칙:
  - 탈퇴 신청 즉시 정기구독을 해지한다.
  - 탈퇴 신청 즉시 `billingSubscriptions/{uid}.billingKey`를 삭제한다.
  - 포트원 서버 빌링키도 `DELETE /billing-keys/{billingKey}`로 삭제한다.
  - 결제일시, 결제금액, 상품명, 주문번호 등 전자상거래법상 거래 기록은 삭제하지 않는다.
  - 이용자 기록과 사진은 30일 유예 후 `executeScheduledDeletion`에서 삭제한다.

## 2. 구독 해지와 결제취소

- 이용자 화면: `설정 > 구독 관리 > 구독 해지`
- 서버 함수: `cancelSubscription`
- 처리 원칙:
  - 해지 신청 즉시 다음 결제를 중단한다.
  - 해지 신청 즉시 포트원 빌링키를 삭제한다.
  - 이미 결제된 이용 기간은 `endDate`까지 유지한다.
  - 환불이 필요한 경우 운영자가 환불정책에 따라 별도 결제취소를 처리한다.

## 3. 환불 운영

- 이용자 화면: `/refund`, `설정 > 구독 관리 > 환불 문의`
- 접수 채널: `harul2026lab@gmail.com`
- 처리 기한: 환불 요청 확인 후 3영업일 이내
- 처리 원칙:
  - 결제수단과 동일한 방법으로 환불하는 것을 원칙으로 한다.
  - 포트원 관리자 콘솔 또는 PortOne 결제취소 API에서 원거래 `paymentId` 기준으로 취소한다.
  - 전액 환불 판단 시 `users/{uid}/subscription/info.hasPaidServiceUsage`와 `paidServiceUsage/{uid}/events`를 확인한다.
  - 유료 기능 이용 이력이 없고 결제일로부터 7일 이내이면 전액 환불 대상이다.
  - 이용 이력이 있거나 7일을 초과한 경우 `/refund`의 부분 환불 산식에 따라 처리한다.

## 4. 포트원 빌링키 삭제

- 공용 헬퍼: `revokeBillingKeyForUid`
- 탈퇴용 래퍼: `revokeBillingKeyForWithdrawal`
- 삭제 사유:
  - `subscription_cancelled`: 구독 해지
  - `account_withdrawal`: 회원탈퇴
- Firestore 기록:
  - `billingKey` 필드는 삭제한다.
  - `billingKeyRevokedAt`과 `billingKeyRevocationReason`을 남긴다.
  - 회원탈퇴 시에는 `withdrawnAt`도 함께 남긴다.

## 5. 이용 개시 로그

- 서버 함수: `recordPaidServiceUsage`
- 서버 내부 기록 함수: `logPaidServiceUsage`
- 저장 위치:
  - 상세 이벤트: `paidServiceUsage/{uid}/events/{eventId}`
  - 빠른 환불 판단 필드: `users/{uid}/subscription/info`
- 기록 이벤트:
  - `record_created`: 유료 이용권 보유 상태에서 기록 생성
  - `record_updated`: 유료 이용권 보유 상태에서 기록 수정
  - `ai_polish`: AI 다듬기 실행
  - `timeline_pdf`: 성장 타임라인 PDF 생성
  - `result_chat`: 결과 기반 AI 대화
- 운영 판단:
  - `hasPaidServiceUsage === true`이면 이용 개시 이력이 있는 것으로 본다.
  - `firstPaidServiceUsageAtIso`는 최초 이용 시각이며 이후 이벤트로 덮어쓰지 않는다.
  - `lastPaidServiceUsageAtIso`와 `lastPaidServiceUsageType`은 최근 유료 기능 이용 확인용이다.

## 6. 심사 응답 문구

HARU2026은 회원이 설정 화면에서 직접 구독 해지와 회원탈퇴를 신청할 수 있습니다. 구독 해지 또는 회원탈퇴 신청 시 서버에서 정기결제 빌링키를 즉시 삭제하고 포트원 서버의 빌링키 삭제 API도 호출하여 다음 결제 경로를 차단합니다. 환불 요청은 환불정책 페이지와 설정 화면에서 안내한 이메일로 접수하며, 결제수단과 동일한 방법으로 3영업일 이내 처리합니다. 전액 환불 여부는 결제일과 유료 기능 이용 개시 로그를 기준으로 판단합니다.
