import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

type RefundStatus = 'requested' | 'reviewing' | 'approved' | 'refunding' | 'refunded' | 'rejected' | 'failed';

interface AdminRefundRequest {
  id: string;
  refundRequestId: string;
  uid: string;
  paymentId: string;
  status: RefundStatus;
  plan?: string;
  productName?: string;
  paidAmount?: number;
  refundableAmount?: number;
  reasonLabel?: string;
  description?: string;
  paymentDate?: string | null;
  createdAt?: string | null;
  publicMessage?: string | null;
  usageSummary?: {
    hasPaidServiceUsage?: boolean;
    usageCount?: number;
    eventTypes?: string[];
    firstUsageAt?: string | null;
  } | null;
  validation?: Record<string, unknown> | null;
  audit?: { action?: string; actorUid?: string; at?: string; safeErrorCode?: string }[];
  adminMemo?: string;
}

const STATUS_LABELS: Record<RefundStatus, string> = {
  requested: '접수',
  reviewing: '검토 중',
  approved: '승인',
  refunding: '환불 처리 중',
  refunded: '환불 완료',
  rejected: '반려',
  failed: '실패',
};

function formatWon(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : '확인 필요';
}

function formatDate(value?: string | null): string {
  if (!value) return '확인 필요';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '확인 필요' : date.toLocaleString('ko-KR');
}

function canApprove(status: RefundStatus): boolean {
  return status === 'requested' || status === 'reviewing' || status === 'approved' || status === 'failed';
}

function canReject(status: RefundStatus): boolean {
  return status === 'requested' || status === 'reviewing' || status === 'approved' || status === 'failed';
}

export function AdminSubscriptionRefundsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminRefundRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loadingList, setLoadingList] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isAdmin = user?.uid === ADMIN_UID;

  useEffect(() => {
    if (!loading && user && !isAdmin) navigate('/');
  }, [loading, user, isAdmin, navigate]);

  const loadRefunds = async () => {
    if (!isAdmin) return;
    setLoadingList(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const callable = httpsCallable<{ status?: string }, { items: AdminRefundRequest[] }>(
        functions,
        'listSubscriptionRefundRequests',
      );
      const res = await callable(statusFilter ? { status: statusFilter } : {});
      setItems(Array.isArray(res.data.items) ? res.data.items : []);
    } catch (error: any) {
      console.error('환불 요청 목록 조회 실패:', error);
      toast.error(error?.message || '환불 요청 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadRefunds();
  }, [isAdmin, statusFilter]);

  const approveRefund = async (item: AdminRefundRequest) => {
    const ok = confirm(`${item.productName || '구독 결제'} ${formatWon(item.refundableAmount)} 환불을 승인할까요?\n\n실제 PortOne 취소 API가 호출됩니다.`);
    if (!ok) return;
    const adminMemo = window.prompt('관리자 메모를 입력하세요.', item.adminMemo || '') || '';
    setBusyId(item.id);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const callable = httpsCallable(functions, 'approveSubscriptionRefund');
      await callable({ refundRequestId: item.refundRequestId || item.id, adminMemo });
      toast.success('환불 승인이 처리되었습니다.');
      await loadRefunds();
    } catch (error: any) {
      console.error('환불 승인 실패:', error);
      toast.error(error?.message || '환불 승인에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const rejectRefund = async (item: AdminRefundRequest) => {
    const publicMessage = window.prompt('사용자에게 표시할 반려 사유를 입력하세요.', '환불 조건 확인 결과 환불이 어렵습니다.');
    if (!publicMessage) return;
    const adminMemo = window.prompt('관리자 내부 메모를 입력하세요.', item.adminMemo || '') || '';
    setBusyId(item.id);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const callable = httpsCallable(functions, 'rejectSubscriptionRefund');
      await callable({ refundRequestId: item.refundRequestId || item.id, publicMessage, adminMemo });
      toast.success('환불 요청을 반려했습니다.');
      await loadRefunds();
    } catch (error: any) {
      console.error('환불 반려 실패:', error);
      toast.error(error?.message || '환불 반려에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: '#F5F7FB' }}>
      <PageHeaderActions onClose={() => navigate('/admin/console')} />
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#1A3C6E' }}>
              구독 환불 요청
            </h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              관리자 승인 후에만 PortOne 환불 API가 호출됩니다.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#111827' }}
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadRefunds}
              disabled={loadingList}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              style={{ backgroundColor: '#1A3C6E', color: '#fff', fontWeight: 700 }}
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center" style={{ border: '1px solid #E5E7EB' }}>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              환불 요청이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-lg p-5" style={{ border: '1px solid #E5E7EB' }}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#EEF2FF', color: '#1A3C6E' }}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <h2 className="text-base font-bold" style={{ color: '#111827' }}>
                      {item.productName || 'HARU2026 정기구독'}
                    </h2>
                    <p className="text-xs mt-1 font-mono" style={{ color: '#6B7280' }}>
                      uid {item.uid} · payment {item.paymentId}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => approveRefund(item)}
                      disabled={!canApprove(item.status) || busyId === item.id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#10B981', color: '#fff', fontWeight: 700 }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectRefund(item)}
                      disabled={!canReject(item.status) || busyId === item.id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#DC2626', color: '#fff', fontWeight: 700 }}
                    >
                      <XCircle className="w-4 h-4" />
                      거절
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                  <div>
                    <p style={{ color: '#9CA3AF' }}>결제일</p>
                    <p className="font-bold" style={{ color: '#374151' }}>{formatDate(item.paymentDate)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#9CA3AF' }}>결제금액</p>
                    <p className="font-bold" style={{ color: '#374151' }}>{formatWon(item.paidAmount)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#9CA3AF' }}>환불 예정액</p>
                    <p className="font-bold" style={{ color: '#374151' }}>{formatWon(item.refundableAmount)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#9CA3AF' }}>이용내역</p>
                    <p className="font-bold" style={{ color: '#374151' }}>
                      {item.usageSummary?.hasPaidServiceUsage ? `${item.usageSummary.usageCount || 0}건` : '없음'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg p-3" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                    <p className="font-bold mb-1" style={{ color: '#374151' }}>신청 사유</p>
                    <p style={{ color: '#4B5563' }}>{item.reasonLabel || '확인 필요'}</p>
                    {item.description && <p className="mt-2 leading-relaxed" style={{ color: '#6B7280' }}>{item.description}</p>}
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                    <p className="font-bold mb-1" style={{ color: '#374151' }}>감사 로그</p>
                    {(item.audit || []).length === 0 ? (
                      <p style={{ color: '#6B7280' }}>기록 없음</p>
                    ) : (
                      <div className="space-y-1">
                        {(item.audit || []).map((audit, index) => (
                          <p key={`${audit.action}-${index}`} style={{ color: '#6B7280' }}>
                            {formatDate(audit.at)} · {audit.action} · {audit.actorUid || 'system'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {item.publicMessage && (
                  <p className="mt-3 text-xs leading-relaxed" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                    사용자 표시 메시지: {item.publicMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
