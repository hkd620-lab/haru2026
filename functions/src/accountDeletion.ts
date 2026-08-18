import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getStorage } from 'firebase-admin/storage';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { cancelSubscriptionForUid, revokeBillingKeyForWithdrawal, PORTONE_API_SECRET } from './subscriptionHelpers';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const DELETION_GRACE_PERIOD_DAYS = 30;

// ===== 회원탈퇴 신청 =====
// 실제 기록 데이터 삭제는 하지 않는다(30일 유예 후 executeScheduledDeletion이 담당).
// 다만 카드 재청구 경로(billingKey)는 유예기간을 두지 않고 신청 즉시 제거한다 —
// 정기결제 인증정보이므로 탈퇴 후에도 남아있으면 안 되는 위험 자산으로 취급한다.
export const requestAccountDeletion = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;

    // Kill switch: config/accountDeletion.enabled 가 true가 아니면 즉시 종료한다.
    // 활성화는 이 문서 필드를 별도 승인 후 수동으로 true로 바꾸는 방식으로만 한다.
    const configSnap = await db.doc('config/accountDeletion').get();
    const enabled = configSnap.exists && configSnap.data()?.enabled === true;
    if (!enabled) {
      logger.info('requestAccountDeletion: kill switch OFF(config/accountDeletion.enabled !== true) — 종료', { uid });
      throw new HttpsError('failed-precondition', '회원탈퇴 기능이 현재 비활성화되어 있습니다.');
    }

    // 포트원 빌링키 삭제 + billingSubscriptions에서 billingKey 필드 즉시 제거(withdrawnAt 기록).
    // 결제일시·금액·상품명·주문번호 등 거래 기록 필드는 건드리지 않고 보존한다.
    // 포트원 API 호출이 실패해도 탈퇴 신청 자체는 막지 않는다(내부에서 에러를 로그로만 남김).
    // ⚠️ 반드시 cancelSubscriptionForUid보다 먼저 호출한다 — 그 함수가 billingKey를 자체적으로
    //    null로 덮어쓰기 때문에, 순서가 바뀌면 실제 빌링키 값을 읽지 못해 포트원 삭제가 스킵된다.
    await revokeBillingKeyForWithdrawal(uid, PORTONE_API_SECRET.value());

    try {
      await cancelSubscriptionForUid(uid);
    } catch (error: any) {
      if (error instanceof HttpsError && error.code === 'failed-precondition') {
        // 해지할 구독 자체가 없는 사용자(무료 플랜) — 정상 케이스이므로 탈퇴 신청을 계속 진행한다.
        logger.info('탈퇴 신청 — 해지할 구독 없음, 계속 진행:', { uid });
      } else {
        logger.error('탈퇴 신청 중 구독 해지 실패:', { uid, message: error?.message });
        throw error;
      }
    }

    // cancelSubscriptionForUid가 billingKey를 null로 다시 채워 넣으므로(구독 해지 로직 자체는
    // 건드리지 않기 위해 그대로 둠), 필드 자체가 남지 않도록 한 번 더 정리한다.
    // 이미 삭제된 빌링키라 포트원 API는 재호출되지 않고 Firestore 정리만 수행된다.
    await revokeBillingKeyForWithdrawal(uid, PORTONE_API_SECRET.value());

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await db.doc(`users/${uid}`).set(
      {
        accountStatus: 'pending_deletion',
        deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletionScheduledAt: admin.firestore.Timestamp.fromDate(scheduledAt),
      },
      { merge: true },
    );

    logger.info(
      '✅ 회원탈퇴 신청 접수 — uid: %s, scheduledAt: %s',
      uid,
      scheduledAt.toISOString(),
    );

    return {
      success: true,
      deletionScheduledAt: scheduledAt.toISOString(),
    };
  },
);

// ===== 회원탈퇴 취소(복구) =====
// 유예기간 중 이용자가 복구를 선택하면 pending_deletion 관련 필드를 제거한다.
export const cancelAccountDeletion = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;

    await db.doc(`users/${uid}`).set(
      {
        accountStatus: admin.firestore.FieldValue.delete(),
        deletionRequestedAt: admin.firestore.FieldValue.delete(),
        deletionScheduledAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );

    logger.info('✅ 회원탈퇴 취소(복구) — uid: %s', uid);

    return { success: true };
  },
);

// ===== 실제 삭제 (1단계 승인 범위 + billingSubscriptions 처리 변경 승인분) =====
// [삭제] users/{uid} 하위 서브컬렉션 전체, Storage users/{uid}/ 전체,
//        email_to_uid, prophecyUsage, shared_records(+comments),
//        sharedHaruLawCardMeta, haruLawSharePreviews
//        + billingSubscriptions/{uid}.billingKey(포트원 빌링키 포함) — 30일 유예 없이
//          requestAccountDeletion 신청 즉시 삭제(아래 markBillingRecordsWithdrawn은 안전망)
// [보존] billingSubscriptions/{uid}의 결제일시·금액·상품명·주문번호 등 거래기록,
//        paymentReviews/single/payments/{id} — 삭제하지 않고 withdrawnAt 필드만 추가
// [익명화] aiUsageLogs — uid 필드만 제거, 문서는 유지
// [유지]  sharedHaruLawCards — 손대지 않음
const USER_SUBCOLLECTIONS_TO_DELETE = [
  'records',
  'vaultItems',
  'growthSubjects',
  'library',
  'subscription',
  'assets',
  'plants',
  'settings',
  'readProgress',
  'novelSettings',
  'bibleProgress',
  'bibleWordbook',
  'snsRecords',
  'savedSearches',
  'timelines',
  'legalCases',
  'health',
  'petHealthLogs',
  'lawsuitClaimReasonUsage',
];

// 1회 스케줄 실행에서 처리할 최대 계정 수(타임아웃 방지). 남은 대상은 다음날 처리된다.
const DELETION_BATCH_LIMIT = 20;

async function deleteStorageFilesForUid(uid: string): Promise<number> {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
  if (files.length === 0) return 0;
  await Promise.all(
    files.map((file) =>
      file.delete().catch((error: any) => {
        // 재시도 중 이미 삭제된 파일이면 조용히 넘어간다.
        if (error?.code !== 404) throw error;
      }),
    ),
  );
  return files.length;
}

async function deleteUserSubcollections(uid: string): Promise<void> {
  const userRef = db.doc(`users/${uid}`);
  for (const sub of USER_SUBCOLLECTIONS_TO_DELETE) {
    await db.recursiveDelete(userRef.collection(sub));
  }
}

async function deleteEmailToUidMapping(uid: string): Promise<void> {
  const snap = await db.collection('email_to_uid').where('uid', '==', uid).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function deleteProphecyUsage(uid: string): Promise<void> {
  await db.doc(`prophecyUsage/${uid}`).delete();
}

async function deleteOwnedSharedRecords(uid: string): Promise<void> {
  const snap = await db.collection('shared_records').where('ownerUid', '==', uid).get();
  for (const docSnap of snap.docs) {
    // comments 하위 서브컬렉션까지 함께 삭제
    await db.recursiveDelete(docSnap.ref);
  }
}

async function deleteOwnedHaruLawShareMeta(uid: string): Promise<void> {
  const [metaSnap, previewSnap] = await Promise.all([
    db.collection('sharedHaruLawCardMeta').where('ownerUid', '==', uid).get(),
    db.collection('haruLawSharePreviews').where('ownerUid', '==', uid).get(),
  ]);
  await Promise.all([
    ...metaSnap.docs.map((d) => d.ref.delete()),
    ...previewSnap.docs.map((d) => d.ref.delete()),
  ]);
  // sharedHaruLawCards(발행된 카드)는 승인 범위상 "유지" 대상이므로 건드리지 않는다.
}

async function anonymizeAiUsageLogs(uid: string): Promise<void> {
  const snap = await db.collection('aiUsageLogs').where('uid', '==', uid).get();
  await Promise.all(
    snap.docs.map((d) => d.ref.update({ uid: admin.firestore.FieldValue.delete() })),
  );
}

async function markBillingRecordsWithdrawn(uid: string, withdrawnAtIso: string): Promise<void> {
  // billingKey 삭제는 requestAccountDeletion에서 신청 즉시 처리되지만, 그 시점에 실패했을
  // 가능성에 대비해 여기서 한 번 더 시도한다(멱등적 — 이미 지워졌으면 아무 일도 하지 않음).
  await revokeBillingKeyForWithdrawal(uid, PORTONE_API_SECRET.value());

  const paymentsSnap = await db
    .collection('paymentReviews/single/payments')
    .where('uid', '==', uid)
    .get();
  await Promise.all(
    paymentsSnap.docs.map((d) => d.ref.set({ withdrawnAt: withdrawnAtIso }, { merge: true })),
  );
}

async function deleteAuthAccountIfExists(uid: string): Promise<void> {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found') {
      // 이미 삭제됨 — 재시도 시 정상 케이스이므로 무시하고 계속 진행한다.
      return;
    }
    throw error;
  }
}

export const executeScheduledDeletion = onSchedule(
  {
    region: 'asia-northeast3',
    schedule: 'every day 04:00',
    timeZone: 'Asia/Seoul',
    timeoutSeconds: 540,
    secrets: [PORTONE_API_SECRET],
  },
  async () => {
    // Kill switch: config/accountDeletion.enabled 가 true가 아니면 즉시 종료한다.
    // 활성화는 이 문서 필드를 별도 승인 후 수동으로 true로 바꾸는 방식으로만 한다.
    const configSnap = await db.doc('config/accountDeletion').get();
    const enabled = configSnap.exists && configSnap.data()?.enabled === true;
    if (!enabled) {
      logger.info('executeScheduledDeletion: kill switch OFF(config/accountDeletion.enabled !== true) — 종료');
      return;
    }

    const nowIso = new Date().toISOString();
    const targetsSnap = await db
      .collection('users')
      .where('accountStatus', '==', 'pending_deletion')
      .where('deletionScheduledAt', '<=', admin.firestore.Timestamp.fromDate(new Date()))
      .limit(DELETION_BATCH_LIMIT)
      .get();

    logger.info('executeScheduledDeletion: 삭제 대상 %d건', targetsSnap.size);

    for (const docSnap of targetsSnap.docs) {
      const uid = docSnap.id;
      const completedSteps: string[] = [];
      try {
        const storageFileCount = await deleteStorageFilesForUid(uid);
        completedSteps.push(`storage(${storageFileCount}건)`);

        await deleteUserSubcollections(uid);
        completedSteps.push('users_subcollections');

        await deleteEmailToUidMapping(uid);
        completedSteps.push('email_to_uid');

        await deleteProphecyUsage(uid);
        completedSteps.push('prophecyUsage');

        await deleteOwnedSharedRecords(uid);
        completedSteps.push('shared_records');

        await deleteOwnedHaruLawShareMeta(uid);
        completedSteps.push('sharedHaruLawCardMeta+haruLawSharePreviews');

        await anonymizeAiUsageLogs(uid);
        completedSteps.push('aiUsageLogs(익명화)');

        await markBillingRecordsWithdrawn(uid, nowIso);
        completedSteps.push('billing/payment(보존, withdrawnAt 기록)');

        // Auth 계정 삭제는 실질 데이터를 모두 정리한 뒤, users/{uid} 문서를 지우기 직전에 한다.
        // 여기서 실패하면 users/{uid} 문서(accountStatus=pending_deletion)가 남아 다음 실행에서 재시도된다.
        await deleteAuthAccountIfExists(uid);
        completedSteps.push('auth_account');

        // users/{uid} 최상위 문서는 Auth 삭제가 끝난 뒤 가장 마지막에 지운다.
        await docSnap.ref.delete();
        completedSteps.push('users_root_doc');

        logger.info('✅ 계정 삭제 완료 — uid: %s, 완료 단계: %s', uid, completedSteps.join(', '));
      } catch (error: any) {
        logger.error(
          '❌ 계정 삭제 실패 — uid: %s, 완료된 단계: %s, 실패 사유: %s',
          uid,
          completedSteps.join(', ') || '(없음)',
          error?.message,
        );
      }
    }
  },
);
