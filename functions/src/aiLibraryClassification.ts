/** Classification core. Provider and runtime authority are explicitly injected by the server.
 * Store/Authority are server trust boundaries, never construct them from request data.
 */
import { createHash } from 'node:crypto';
import { isAiLibraryCategory } from './aiLibraryCategory';

export const CLASSIFICATION_POLICY = 'ai-library-reviewed-v1';
export const CLASSIFICATION_MODEL = 'jev-1.14.0';
/** Conservative 65536 tokens for documented '64k' context at USD 0.042/M, output free. */
export const CLASSIFICATION_MIN_RESERVATION_MICROUSD = 2753;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export interface ClassificationRecord {
  type?: unknown; content?: unknown; aiCategory?: unknown; aiCategorySource?: unknown;
  aiCategoryAuto?: unknown; aiCategoryUpdatedAt?: unknown;
  [key: string]: unknown;
}
export interface PlannedRecord { id: string; contentHash: string; payloadHash: string; reason: string | null }
export interface ClassificationManifest {
  owner: string; model: typeof CLASSIFICATION_MODEL; policy: typeof CLASSIFICATION_POLICY;
  expiresAt: number; budgetMicrousd: number; records: PlannedRecord[];
}
export interface ClassificationDecision {
  decision: { status: 'classified'; category: string; confidence: number } | { status: 'review'; reason: string };
}
/** Full text is screened BEFORE minimization. This heuristic is not a privacy guarantee.
 * Every transmitted payload additionally requires explicit trusted review attestation.
 */
export function prepareClassificationPayload(record: ClassificationRecord): { text: string; reason: string | null } {
  if (record.type !== 'ai_log') return { text: '', reason: 'not_ai_log' };
  if (record.aiCategorySource === 'manual') return { text: '', reason: 'manual' };
  if (typeof record.content !== 'string' || !record.content.trim()) return { text: '', reason: 'empty' };
  const raw = record.content;
  if (Buffer.byteLength(raw, 'utf8') > 16000) return { text: '', reason: 'long_text_review' };
  // Deliberately overinclusive. Never claim exhaustive credential/PII detection.
  if (/(?:password|passwd|api[ _-]?key|bearer\s|private key|secret|token\s*[:=]|sk-[\w-]{8}|비밀번호|인증번호|주민등록|여권번호|면허번호|\b\d{6}[- ]?[1-8]\d{6}\b|\b\d{3}-\d{2}-\d{4}\b|my\s+(?:diagnosis|medication|account|balance|child)|diagnosed|prescription|내\s*(?:진단|약|계좌|잔고|자산)|복용|진단받|미성년|자녀|아동|child|minor|account\s*number|routing\s*number|계좌번호|카드번호)/i.test(raw)) {
    return { text: '', reason: 'sensitive_review' };
  }
  const text = raw.replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?\b/g, ' ')
    .replace(/^\s*(?:uid|id|record[_ ]?id|source|date|timestamp|user[_ ]?id)\s*[:=].*$/gim, ' ')
    .replace(/\s+/g, ' ').trim();
  return { text, reason: text ? null : 'empty' };
}
export function contentHash(record: ClassificationRecord): string {
  return hash(JSON.stringify([record.type ?? null, record.content ?? null]));
}
export function planClassification(owner: string, records: ReadonlyArray<{ id: string; record: ClassificationRecord }>, expiresAt: number, budgetMicrousd: number): ClassificationManifest {
  if (!owner || !Number.isSafeInteger(expiresAt) || !Number.isSafeInteger(budgetMicrousd) || budgetMicrousd <= 0) throw new Error('invalid_manifest');
  const seen = new Set<string>();
  return { owner, model: CLASSIFICATION_MODEL, policy: CLASSIFICATION_POLICY, expiresAt, budgetMicrousd,
    records: records.map(({ id, record }) => {
      if (!id || seen.has(id)) throw new Error('duplicate_record');
      seen.add(id);
      const payload = prepareClassificationPayload(record);
      return { id, contentHash: contentHash(record), payloadHash: hash(payload.text), reason: payload.reason };
    }).sort((a, b) => a.id.localeCompare(b.id)) };
}
/** Firestore maps may be read back in a different key order. Array order remains significant. */
export function classificationManifestHash(manifest: ClassificationManifest): string {
  return hash(JSON.stringify(manifest, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value));
}
export interface TrustedClassificationApproval {
  manifestHash: string; owner: string; expiresAt: number;
  /** Immutable server-side review ledger: exact payload hashes reviewed for this destination. */
  reviewedPayloadHashes: readonly string[];
}
export interface ClassificationAuthority {
  /** Resolve authenticated server identity; never trust an owner supplied by a client. */
  owner(): Promise<string>;
}
export type ItemStatus = 'pending' | 'dispatched' | 'applied' | 'review' | 'skipped' | 'unknown';
export interface ClassificationItem extends PlannedRecord {
  status: ItemStatus; dispatchedAt?: number; permittedAt?: number;
  /** Creation identity at claim; do not apply to a deleted/recreated document. */
  recordIdentity?: string;
  restoration?: ClassificationRestoration;
  /** Legacy lossy snapshots are never used for restoration. */
  previous?: { category: unknown; source: unknown; auto: unknown };
}
export interface ClassificationRestoration {
  status: 'restored' | 'skipped' | 'unavailable'; reason?: string;
}
export type ClassificationCategoryPatch = Pick<ClassificationRecord, 'aiCategory' | 'aiCategorySource' | 'aiCategoryAuto'>;
export interface ClassificationJob {
  manifestHash: string; owner: string; cancelled: boolean; reservedMicrousd: number; items: ClassificationItem[];
  restoration?: { requested: true };
}
export interface ClassificationTransaction {
  /** Read server-private runtime/approval/revocation documents in THIS serializable transaction.
   * Revocations/settings changes MUST conflict with these reads. Missing state denies access.
   */
  getAuthorization(manifestHash: string): Promise<{ enabled: boolean; approval: TrustedClassificationApproval | null } | undefined> | { enabled: boolean; approval: TrustedClassificationApproval | null } | undefined;
  /** Global immutable dispatch ledger across ALL manifests/jobs. Never delete on restart. */
  getAttempt(key: string): Promise<{ manifestHash: string } | undefined> | { manifestHash: string } | undefined;
  putAttempt(key: string, attempt: { manifestHash: string }): void;
  getJob(key: string): Promise<ClassificationJob | undefined> | ClassificationJob | undefined;
  putJob(key: string, job: ClassificationJob): void;
  getRecord(owner: string, id: string): Promise<ClassificationRecord | undefined> | ClassificationRecord | undefined;
  getRecordIdentity(owner: string, id: string): Promise<string | undefined> | string | undefined;
  /** Snapshot exact category field presence/values and patch them atomically. False means no write. */
  applyRecord(owner: string, id: string, manifestHash: string, patch: ClassificationCategoryPatch): Promise<boolean>;
  /** Restore ONLY the three category fields if the original applied revision still owns the record. */
  restoreRecord(owner: string, id: string, manifestHash: string, contentHash: string): Promise<ClassificationRestoration>;
}
export interface ClassificationStore {
  /** Durable SERIALIZABLE transaction. Resolve only after commit. No network calls in callback.
   * Enforce unique manifest key across restarts; never expire/reclaim dispatched entries.
   */
  transaction<T>(work: (tx: ClassificationTransaction) => T | Promise<T>): Promise<T>;
}
export interface ClassificationProvider {
  model: typeof CLASSIFICATION_MODEL;
  /** Trusted official max-context input + max-output cost upper bound, rounded UP in microUSD.
   * NOT an estimate of the text's token count. Unknown pricing means do not wire a provider.
   */
  maxRequestCostMicrousd: number;
  classify(text: string): Promise<ClassificationDecision>;
}
export class ClassificationRunner {
  constructor(private readonly store: ClassificationStore, private readonly authority: ClassificationAuthority,
    private readonly provider: ClassificationProvider, private readonly now: () => number = Date.now) {}
  private async authorize(tx: ClassificationTransaction, manifest: ClassificationManifest, owner: string): Promise<string> {
    const key = classificationManifestHash(manifest);
    const state = await tx.getAuthorization(key);
    const approval = state?.approval;
    if (state?.enabled !== true || owner !== manifest.owner || !approval ||
      approval.owner !== manifest.owner || approval.manifestHash !== key || approval.expiresAt !== manifest.expiresAt ||
      !Number.isSafeInteger(manifest.expiresAt) || manifest.expiresAt <= this.now() ||
      manifest.model !== CLASSIFICATION_MODEL || manifest.policy !== CLASSIFICATION_POLICY ||
      this.provider.model !== manifest.model || !Number.isSafeInteger(this.provider.maxRequestCostMicrousd) || this.provider.maxRequestCostMicrousd < CLASSIFICATION_MIN_RESERVATION_MICROUSD ||
      !Number.isSafeInteger(manifest.budgetMicrousd) || manifest.budgetMicrousd <= 0 ||
      new Set(manifest.records.map(r => r.id)).size !== manifest.records.length ||
      manifest.records.some(r => !r.reason && !approval.reviewedPayloadHashes.includes(r.payloadHash))) throw new Error('approval_required');
    return key;
  }
  async step(input: ClassificationManifest, limit = 10): Promise<ClassificationJob> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('invalid_step_limit');
    // Snapshot before async work prevents caller mutation of a reviewed manifest.
    const manifest: ClassificationManifest = JSON.parse(JSON.stringify(input));
    const owner = await this.authority.owner();
    const key = classificationManifestHash(manifest);
    await this.store.transaction(async tx => {
      await this.authorize(tx, manifest, owner);
      if (!(await tx.getJob(key))) tx.putJob(key, { manifestHash: key, owner: manifest.owner, cancelled: false, reservedMicrousd: 0,
        items: manifest.records.map(r => ({ ...r, status: r.reason ? (r.reason.endsWith('review') ? 'review' : 'skipped') : 'pending' })) });
    });
    for (let i = 0; i < limit; i++) {
      const claim = await this.store.transaction(async tx => {
        await this.authorize(tx, manifest, owner);
        const job = (await tx.getJob(key))!;
        if (job.cancelled || manifest.expiresAt <= this.now()) return null;
        const item = job.items.find(r => r.status === 'pending');
        if (!item) return null;
        const record = await tx.getRecord(manifest.owner, item.id);
        const identity = await tx.getRecordIdentity(manifest.owner, item.id);
        const payload = record ? prepareClassificationPayload(record) : { text: '', reason: 'deleted' };
        if (!record || !identity || contentHash(record) !== item.contentHash || payload.reason || hash(payload.text) !== item.payloadHash) {
          item.status = 'skipped'; item.reason = payload.reason || 'content_changed'; tx.putJob(key, job); return { skip: true as const };
        }
        const attemptKey = hash(JSON.stringify([manifest.owner, item.id, item.contentHash, item.payloadHash, manifest.model, manifest.policy]));
        if (await tx.getAttempt(attemptKey)) {
          item.status = 'skipped'; item.reason = 'prior_attempt_no_retry'; tx.putJob(key, job); return { skip: true as const };
        }
        if (this.provider.maxRequestCostMicrousd > manifest.budgetMicrousd - job.reservedMicrousd) return null;
        tx.putAttempt(attemptKey, { manifestHash: key });
        job.reservedMicrousd += this.provider.maxRequestCostMicrousd;
        item.status = 'dispatched'; item.dispatchedAt = this.now();
        item.recordIdentity = identity;
        tx.putJob(key, job);
        return { skip: false as const, id: item.id, text: payload.text };
      });
      if (!claim) break;
      if (claim.skip) continue;
      let result: ClassificationDecision | undefined;
      try {
        // Committing this atomic permit defines request start. Revocation after commit
        // cannot retract an in-flight request, but prevents later permits and result application.
        // Full reservation is retained even if the permit is denied or the process crashes.
        const permitted = await this.store.transaction(async tx => {
          await this.authorize(tx, manifest, owner);
          const job = (await tx.getJob(key))!;
          const item = job.items.find(r => r.id === claim.id);
          if (job.cancelled || item?.status !== 'dispatched' || item.permittedAt !== undefined) return false;
          // The record read joins the same serializable permit fence. A deletion,
          // content edit or manual decision before commit must stop transmission too.
          const current = await tx.getRecord(manifest.owner, item.id);
          const payload = current ? prepareClassificationPayload(current) : { text: '', reason: 'deleted' };
          if (!current || !item.recordIdentity || await tx.getRecordIdentity(manifest.owner, item.id) !== item.recordIdentity || current.aiCategorySource === 'manual' || contentHash(current) !== item.contentHash ||
              payload.reason || hash(payload.text) !== item.payloadHash) {
            item.status = 'skipped'; item.reason = 'record_changed_before_permit';
            // Keep the global attempt and conservative reservation. Never auto-retry.
            tx.putJob(key, job);
            return false;
          }
          item.permittedAt = this.now();
          tx.putJob(key, job);
          return true;
        });
        if (permitted) result = await this.provider.classify(claim.text);
      } catch { /* An uncertain paid outcome is NEVER automatically retried. */ }
      await this.store.transaction(async tx => {
        const job = (await tx.getJob(key))!; const item = job.items.find(r => r.id === claim.id)!;
        if (item.status !== 'dispatched') return;
        let authorized = true;
        try { await this.authorize(tx, manifest, owner); } catch { authorized = false; }
        if (!authorized || !result || (result.decision.status === 'review' && ['transport_error', 'invalid_response'].includes(result.decision.reason))) { item.status = 'unknown'; item.reason = 'dispatch_outcome_unknown'; }
        else {
          const record = await tx.getRecord(manifest.owner, item.id);
          if (job.cancelled || manifest.expiresAt <= this.now() || !record || !item.recordIdentity || await tx.getRecordIdentity(manifest.owner, item.id) !== item.recordIdentity || record.aiCategorySource === 'manual' || contentHash(record) !== item.contentHash) {
            item.status = 'skipped'; item.reason = job.cancelled ? 'cancelled' : 'record_changed';
          } else if (result.decision.status !== 'classified' || !isAiLibraryCategory(result.decision.category) ||
            !Number.isFinite(result.decision.confidence) || result.decision.confidence < 0.85 || result.decision.confidence > 1) {
            item.status = 'review'; item.reason = result.decision.status === 'review' &&
              ['invalid_input', 'missing_transport', 'out_of_scope', 'low_confidence', 'ambiguous'].includes(result.decision.reason)
              ? result.decision.reason : 'classification_review';
          } else {
            const applied = await tx.applyRecord(manifest.owner, item.id, key, { aiCategory: result.decision.category, aiCategorySource: 'auto',
              aiCategoryAuto: { model: manifest.model, policy: manifest.policy, confidence: result.decision.confidence,
                contentHash: item.contentHash, manifestHash: key } });
            item.status = applied ? 'applied' : 'review'; item.reason = applied ? null : 'restore_snapshot_unavailable';
          }
        }
        tx.putJob(key, job);
      });
    }
    return this.store.transaction(async tx => (await tx.getJob(key))!);
  }
  async cancel(input: ClassificationManifest): Promise<void> {
    const manifest = JSON.parse(JSON.stringify(input)) as ClassificationManifest;
    if (await this.authority.owner() !== manifest.owner) throw new Error('approval_required');
    const key = classificationManifestHash(manifest);
    await this.store.transaction(async tx => { const job = await tx.getJob(key) ?? { manifestHash: key, owner: manifest.owner, cancelled: false, reservedMicrousd: 0, items: manifest.records.map(r => ({ ...r, status: 'pending' as const })) }; if (job) { if (job.owner !== manifest.owner) throw new Error('approval_required'); job.cancelled = true; tx.putJob(key, job); } });
  }
  /** Explicit category restoration also stops this job. It never recalls requests or refunds cost.
   * Each item commits independently with its terminal outcome, so interruption/retry is safe.
   */
  async restore(input: ClassificationManifest, limit = 25): Promise<ClassificationJob> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('invalid_restore_limit');
    const manifest = JSON.parse(JSON.stringify(input)) as ClassificationManifest;
    if (await this.authority.owner() !== manifest.owner) throw new Error('approval_required');
    const key = classificationManifestHash(manifest);
    await this.store.transaction(async tx => {
      const job = await tx.getJob(key);
      if (!job) throw new Error('job_not_found');
      if (job.owner !== manifest.owner || job.manifestHash !== key) throw new Error('approval_required');
      job.cancelled = true;
      job.restoration = { requested: true };
      tx.putJob(key, job);
    });
    for (let i = 0; i < limit; i++) {
      const processed = await this.store.transaction(async tx => {
        const job = await tx.getJob(key);
        if (!job || job.owner !== manifest.owner || job.manifestHash !== key || !job.cancelled || !job.restoration?.requested) throw new Error('approval_required');
        const item = job.items.find(row => row.status === 'applied' && !row.restoration);
        if (!item) return false;
        const planned = manifest.records.find(row => row.id === item.id);
        item.restoration = !item.recordIdentity || !planned || planned.contentHash !== item.contentHash || planned.payloadHash !== item.payloadHash
          ? { status: 'unavailable', reason: 'legacy_snapshot_unavailable' }
          : await tx.restoreRecord(manifest.owner, item.id, key, item.contentHash);
        tx.putJob(key, job);
        return true;
      });
      if (!processed) break;
    }
    return this.store.transaction(async tx => (await tx.getJob(key))!);
  }
  /** Operator recovery only. Never resubmit possibly billed requests. No reservation refunds. */
  async recover(input: ClassificationManifest): Promise<void> {
    const manifest = JSON.parse(JSON.stringify(input)) as ClassificationManifest;
    if (await this.authority.owner() !== manifest.owner) throw new Error('approval_required');
    const key = classificationManifestHash(manifest);
    await this.store.transaction(async tx => { const job = await tx.getJob(key); if (!job) return;
      if (job.owner !== manifest.owner) throw new Error('approval_required');
      for (const item of job.items) if (item.status === 'dispatched') { item.status = 'unknown'; item.reason = 'recovery_unknown'; }
      tx.putJob(key, job);
    });
  }
}
