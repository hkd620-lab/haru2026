import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  AlertTriangle,
  Copy,
  Edit3,
  Eye,
  FilePlus2,
  ImagePlus,
  Link as LinkIcon,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import './VaultPage.css';

type VaultCategory = 'business' | 'bank' | 'tax' | 'vehicle' | 'insurance' | 'family' | 'etc';

type VaultField = {
  label: string;
  value: string;
  masked?: boolean;
};

type VaultImageMeta = {
  url: string;
  path: string;
  fileName: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: unknown;
};

type VaultItem = {
  id: string;
  title: string;
  category: VaultCategory;
  content: string;
  fields: VaultField[];
  memo?: string;
  originalLink?: string;
  imageMetas?: VaultImageMeta[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

type VaultForm = {
  title: string;
  category: VaultCategory;
  content: string;
  originalLink: string;
  imageMetas: VaultImageMeta[];
};

const CATEGORIES: Array<{ value: VaultCategory | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'business', label: '사업자 정보' },
  { value: 'bank', label: '은행 계좌' },
  { value: 'tax', label: '행정·세금' },
  { value: 'vehicle', label: '차량' },
  { value: 'insurance', label: '보험' },
  { value: 'family', label: '가족·연락처' },
  { value: 'etc', label: '기타' },
];

const CATEGORY_LABELS = CATEGORIES.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const EMPTY_FORM: VaultForm = {
  title: '',
  category: 'bank',
  content: '',
  originalLink: '',
  imageMetas: [],
};

const MAX_IMAGES_PER_ITEM = 3;
const MAX_IMAGE_SIDE = 1600;
const COMPRESSED_IMAGE_QUALITY = 0.75;

function isVaultCategory(value: unknown): value is VaultCategory {
  return ['business', 'bank', 'tax', 'vehicle', 'insurance', 'family', 'etc'].includes(String(value));
}

function normalizeFields(value: unknown): VaultField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((field) => {
      const item = field as Partial<VaultField>;
      return {
        label: String(item.label || '').trim(),
        value: String(item.value || '').trim(),
        masked: Boolean(item.masked),
      };
    })
    .filter((field) => field.label || field.value);
}

function normalizeImageMetas(value: unknown): VaultImageMeta[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((image) => {
      const item = image as Partial<VaultImageMeta>;
      return {
        url: String(item.url || ''),
        path: String(item.path || ''),
        fileName: String(item.fileName || ''),
        size: Number(item.size || 0),
        width: typeof item.width === 'number' ? item.width : undefined,
        height: typeof item.height === 'number' ? item.height : undefined,
        createdAt: item.createdAt || null,
      };
    })
    .filter((image) => image.url && image.path);
}

function maskValue(value: string) {
  const clean = value.trim();
  if (clean.length <= 4) return '*'.repeat(clean.length || 3);
  const chars = [...clean];
  const keepStart = Math.min(3, chars.length);
  const keepEnd = chars.length > 8 ? 2 : 1;
  const maskedCount = Math.max(3, chars.length - keepStart - keepEnd);
  return `${chars.slice(0, keepStart).join('')}${'*'.repeat(maskedCount)}${chars.slice(-keepEnd).join('')}`;
}

function sanitizeFileName(fileName: string) {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    .slice(0, 60) || 'vault-image';
  return `${base}.jpg`;
}

function formatSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function isAllowedImage(file: File) {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
}

async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
      img.src = imageUrl;
    });

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지 압축을 준비할 수 없습니다.');
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('이미지 압축에 실패했습니다.'));
        },
        'image/jpeg',
        COMPRESSED_IMAGE_QUALITY,
      );
    });

    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function itemToForm(item?: VaultItem): VaultForm {
  if (!item) return { ...EMPTY_FORM, imageMetas: [] };
  const content = item.content || item.memo ||
    (item.fields?.length ? item.fields.map((f) => `${f.label}: ${f.value}`).join('\n') : '');
  return {
    title: item.title || '',
    category: item.category || 'bank',
    content,
    originalLink: item.originalLink || '',
    imageMetas: item.imageMetas?.map((image) => ({ ...image })) || [],
  };
}

export function VaultPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<VaultCategory | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [viewingItem, setViewingItem] = useState<VaultItem | null>(null);
  const [form, setForm] = useState<VaultForm>(() => itemToForm());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removedImagePaths, setRemovedImagePaths] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user?.uid) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(collection(db, `users/${user.uid}/vaultItems`), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((snap) => {
          const data = snap.data();
          return {
            id: snap.id,
            title: String(data.title || '제목 없음'),
            category: isVaultCategory(data.category) ? data.category : 'etc',
            content: typeof data.content === 'string' ? data.content : '',
            fields: normalizeFields(data.fields),
            memo: typeof data.memo === 'string' ? data.memo : '',
            originalLink: typeof data.originalLink === 'string' ? data.originalLink : '',
            imageMetas: normalizeImageMetas(data.imageMetas),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        setItems(next);
        setIsLoading(false);
      },
      (error) => {
        console.error('정보금고 로딩 실패:', error);
        toast.error('정보금고를 불러오지 못했습니다.');
        setIsLoading(false);
      },
    );
  }, [loading, user?.uid]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => item.category === filter);
  }, [filter, items]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(itemToForm());
    setPendingFiles([]);
    setRemovedImagePaths([]);
    setEditorOpen(true);
  };

  const openEdit = (item: VaultItem) => {
    setEditingItem(item);
    setForm(itemToForm(item));
    setPendingFiles([]);
    setRemovedImagePaths([]);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setEditingItem(null);
    setForm(itemToForm());
    setPendingFiles([]);
    setRemovedImagePaths([]);
    setEditorOpen(false);
  };

  const isEditorOpen = editorOpen;

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';

    if (!selected.length) return;

    const invalid = selected.filter((file) => !isAllowedImage(file));
    if (invalid.length) {
      toast.error('jpg, jpeg, png, webp 이미지만 업로드할 수 있습니다.');
      return;
    }

    const available = MAX_IMAGES_PER_ITEM - form.imageMetas.length - pendingFiles.length;
    if (available <= 0) {
      toast.error('항목 1개당 이미지는 최대 3장까지 저장할 수 있습니다.');
      return;
    }

    if (selected.length > available) {
      toast.error(`이미지는 ${available}장만 더 추가할 수 있습니다.`);
    }

    setPendingFiles((prev) => [...prev, ...selected.slice(0, available)]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const removeExistingImage = (image: VaultImageMeta) => {
    if (!confirm('이 확인용 이미지를 삭제하시겠습니까?')) return;

    if (image.path) {
      setRemovedImagePaths((prev) => (prev.includes(image.path) ? prev : [...prev, image.path]));
    }
    setForm((prev) => ({
      ...prev,
      imageMetas: prev.imageMetas.filter((meta) => meta.path !== image.path),
    }));
    toast.success('이미지를 삭제 목록에 반영했습니다. 저장하면 확정됩니다.');
  };

  const uploadPendingImages = async (itemId: string) => {
    if (!user?.uid || pendingFiles.length === 0) return [];

    const metas: VaultImageMeta[] = [];
    for (const [index, file] of pendingFiles.entries()) {
      const compressed = await compressImage(file);
      const fileName = `${Date.now()}_${index}_${sanitizeFileName(file.name)}`;
      const path = `users/${user.uid}/vault/images/${itemId}/${fileName}`;
      const imageRef = ref(storage, path);
      await uploadBytes(imageRef, compressed.blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(imageRef);

      metas.push({
        url,
        path,
        fileName,
        size: compressed.blob.size,
        width: compressed.width,
        height: compressed.height,
        createdAt: Timestamp.now(),
      });
    }
    return metas;
  };

  const handleSave = async () => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    const title = form.title.trim();

    if (!title) {
      toast.error('정보 이름을 입력해주세요.');
      return;
    }

    if (form.imageMetas.length + pendingFiles.length > MAX_IMAGES_PER_ITEM) {
      toast.error('항목 1개당 이미지는 최대 3장까지 저장할 수 있습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const basePayload = {
        title,
        category: form.category,
        content: form.content.trim(),
        originalLink: form.originalLink.trim(),
        updatedAt: serverTimestamp(),
      };

      let itemId = editingItem?.id;
      if (!itemId) {
        const docRef = await addDoc(collection(db, `users/${user.uid}/vaultItems`), {
          ...basePayload,
          imageMetas: [],
          createdAt: serverTimestamp(),
        });
        itemId = docRef.id;
      }

      const uploadedMetas = await uploadPendingImages(itemId);
      const imageMetas = [...form.imageMetas, ...uploadedMetas].slice(0, MAX_IMAGES_PER_ITEM);
      await setDoc(
        doc(db, `users/${user.uid}/vaultItems/${itemId}`),
        {
          ...basePayload,
          imageMetas,
          createdAt: editingItem ? editingItem.createdAt || serverTimestamp() : serverTimestamp(),
        },
        { merge: true },
      );

      await Promise.allSettled(
        removedImagePaths.map((path) => deleteObject(ref(storage, path))),
      );

      toast.success('정보금고 항목을 저장했습니다.');
      setEditingItem(null);
      setForm(itemToForm());
      setPendingFiles([]);
      setRemovedImagePaths([]);
      setEditorOpen(false);
    } catch (error) {
      console.error('정보금고 저장 실패:', error);
      toast.error('정보금고 항목 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: VaultItem) => {
    if (!user?.uid) return;
    if (!confirm(`"${item.title}" 항목을 삭제하시겠습니까?`)) return;

    try {
      const images = item.imageMetas || [];
      await Promise.allSettled(images.map((image) => (image.path ? deleteObject(ref(storage, image.path)) : Promise.resolve())));
      await deleteDoc(doc(db, `users/${user.uid}/vaultItems/${item.id}`));
      toast.success('정보금고 항목을 삭제했습니다.');
    } catch (error) {
      console.error('정보금고 삭제 실패:', error);
      toast.error('정보금고 항목 삭제에 실패했습니다.');
    }
  };

  const handleCopy = async (item: VaultItem) => {
    const contentText = item.content || item.memo ||
      item.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
    const text = [
      item.title,
      CATEGORY_LABELS[item.category],
      contentText,
      item.originalLink ? `원본 파일 링크: ${item.originalLink}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('정보를 복사했습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="vault-page">
        <div className="vault-shell">
          <div className="vault-empty">정보금고를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (!user?.uid) {
    return (
      <div className="vault-page">
        <div className="vault-shell">
          <div className="vault-login">
            <ShieldCheck size={36} color="#1A3C6E" />
            <h1 className="vault-title" style={{ marginTop: 12 }}>정보금고</h1>
            <p className="vault-description">로그인 후 은행계좌, 사업자등록번호, 보험, 차량, 행정·세금 정보를 안전하게 확인하세요.</p>
            <button type="button" className="vault-primary-button" style={{ marginTop: 18 }} onClick={() => navigate('/login')}>
              로그인하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-page">
      <div className="vault-shell">
        <header className="vault-header">
          <div>
            <h1 className="vault-title">정보금고</h1>
            <p className="vault-description">
              은행계좌, 사업자등록번호, 보험, 차량, 행정·세금 정보처럼 항상 필요한 정보를 보관합니다.
            </p>
          </div>
          <button type="button" className="vault-primary-button" onClick={openCreate}>
            <Plus size={18} />
            새 정보 추가
          </button>
        </header>

        <section className="vault-alert" aria-label="정보금고 주의 안내">
          <AlertTriangle size={22} color="#B85C2E" />
          <div>
            정보금고 이미지는 보기 편한 확인용으로 자동 압축되어 저장됩니다. 기관 제출용 원본은 Google Drive 또는 홈택스/정부24 발급본을 별도로 사용하세요. 비밀번호, 보안카드, OTP, 공동인증서 비밀번호 이미지는 저장하지 마세요.
          </div>
        </section>

        <div className="vault-filters" aria-label="카테고리 필터">
          {CATEGORIES.map((category) => (
            <button
              key={category.value}
              type="button"
              className={`vault-filter-button${filter === category.value ? ' active' : ''}`}
              onClick={() => setFilter(category.value)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <section className="vault-grid">
          {filteredItems.length === 0 ? (
            <div className="vault-empty">
              <FilePlus2 size={32} color="#7A6F5A" />
              <p style={{ margin: '10px 0 0' }}>아직 저장된 정보금고 항목이 없습니다.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <article className="vault-card" key={item.id}>
                <div className="vault-card-head">
                  <div>
                    <h2 className="vault-card-title">{item.title}</h2>
                    <span className="vault-category" style={{ marginTop: 8 }}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  {item.imageMetas?.length ? (
                    <span className="vault-category" style={{ background: '#F5E5DC', color: '#B85C2E' }}>
                      이미지 {item.imageMetas.length}
                    </span>
                  ) : null}
                </div>

                {(() => {
                  const preview = item.content || item.memo ||
                    item.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
                  return preview ? (
                    <p className="vault-content-preview">{preview.slice(0, 100)}{preview.length > 100 ? '…' : ''}</p>
                  ) : null;
                })()}

                <div className="vault-card-actions">
                  <button type="button" className="vault-secondary-button" onClick={() => setViewingItem(item)}>
                    <Eye size={15} /> 보기
                  </button>
                  <button type="button" className="vault-secondary-button" onClick={() => handleCopy(item)}>
                    <Copy size={15} /> 복사
                  </button>
                  <button type="button" className="vault-ghost-button" onClick={() => openEdit(item)}>
                    <Edit3 size={15} /> 수정
                  </button>
                  <button type="button" className="vault-danger-button" onClick={() => handleDelete(item)}>
                    <Trash2 size={15} /> 삭제
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {isEditorOpen && (
        <div className="vault-modal-backdrop" role="dialog" aria-modal="true">
          <div className="vault-modal">
            <div className="vault-modal-header">
              <h2 className="vault-modal-title">{editingItem ? '정보 수정' : '새 정보 추가'}</h2>
              <button type="button" className="vault-ghost-button" onClick={closeEditor} aria-label="닫기">
                <X size={16} />
              </button>
            </div>

            <div className="vault-modal-body">
              <div className="vault-form-grid">
                <label className="vault-label">
                  정보 이름
                  <input
                    className="vault-input"
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="예: 카카오뱅크 하루랩 계좌"
                  />
                </label>

                <label className="vault-label">
                  분류
                  <select
                    className="vault-select"
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as VaultCategory }))}
                  >
                    {CATEGORIES.filter((category) => category.value !== 'all').map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="vault-label">
                내용
                <textarea
                  className="vault-textarea vault-textarea-lg"
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  placeholder={'은행: 카카오뱅크\n계좌번호: 3333-00-0000000\n예금주: 하루랩\n용도: 포트원 정산용'}
                />
              </label>
              <p className="vault-help">비밀번호, OTP, 보안카드 전체번호는 저장하지 마세요.</p>

              <label className="vault-label">
                원본 파일 링크
                <input
                  className="vault-input"
                  value={form.originalLink}
                  onChange={(event) => setForm((prev) => ({ ...prev, originalLink: event.target.value }))}
                  placeholder="Google Drive 원본 링크"
                />
              </label>

              <section className="vault-form-section">
                <h3>확인용 이미지 업로드</h3>
                <label className="vault-secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content' }}>
                  <ImagePlus size={16} />
                  이미지 선택
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleFilesChange} hidden />
                </label>
                <p className="vault-help">jpg, jpeg, png, webp만 가능하며 업로드 전 긴 변 1600px, JPEG 품질 0.75 수준으로 자동 압축됩니다. 항목당 최대 3장입니다.</p>

                {(form.imageMetas.length > 0 || pendingFiles.length > 0) && (
                  <div className="vault-images" style={{ marginTop: 12 }}>
                    {form.imageMetas.map((image) => (
                      <div className="vault-image-tile" key={image.path}>
                        <img src={image.url} alt={image.fileName || '정보금고 이미지'} />
                        <div className="vault-image-meta">
                          <span>{image.fileName}</span>
                          <span>{formatSize(image.size)}</span>
                          <button type="button" className="vault-danger-button" onClick={() => removeExistingImage(image)}>
                            이미지 삭제
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingFiles.map((file, index) => (
                      <div className="vault-image-tile" key={`${file.name}-${index}`}>
                        <div className="vault-image-meta" style={{ minHeight: 120, justifyContent: 'center' }}>
                          <strong>저장 대기</strong>
                          <span>{file.name}</span>
                          <span>원본 {formatSize(file.size)}</span>
                          <button type="button" className="vault-ghost-button" onClick={() => removePendingFile(index)}>
                            선택 취소
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="vault-modal-actions">
              <button type="button" className="vault-ghost-button" onClick={closeEditor} disabled={isSaving}>
                취소
              </button>
              <button type="button" className="vault-primary-button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingItem && (
        <div className="vault-modal-backdrop" role="dialog" aria-modal="true">
          <div className="vault-modal">
            <div className="vault-modal-header">
              <div>
                <h2 className="vault-modal-title">{viewingItem.title}</h2>
                <span className="vault-category" style={{ marginTop: 8 }}>{CATEGORY_LABELS[viewingItem.category]}</span>
              </div>
              <button type="button" className="vault-ghost-button" onClick={() => setViewingItem(null)} aria-label="닫기">
                <X size={16} />
              </button>
            </div>
            <div className="vault-modal-body">
              {(() => {
                const text = viewingItem.content || viewingItem.memo ||
                  viewingItem.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
                return text ? (
                  <section className="vault-detail-block">
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.95rem' }}>{text}</p>
                  </section>
                ) : null;
              })()}

              {viewingItem.originalLink ? (
                <section className="vault-form-section">
                  <h3>원본 보관 링크</h3>
                  <a className="vault-detail-link" href={viewingItem.originalLink} target="_blank" rel="noreferrer">
                    <LinkIcon size={15} /> {viewingItem.originalLink}
                  </a>
                </section>
              ) : null}

              {viewingItem.imageMetas?.length ? (
                <section className="vault-form-section">
                  <h3>확인용 이미지</h3>
                  <div className="vault-images">
                    {viewingItem.imageMetas.map((image) => (
                      <a className="vault-image-tile" key={image.path} href={image.url} target="_blank" rel="noreferrer">
                        <img src={image.url} alt={image.fileName || '정보금고 이미지'} />
                        <div className="vault-image-meta">
                          <span>{image.fileName}</span>
                          <span>{formatSize(image.size)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
            <div className="vault-modal-actions">
              <button type="button" className="vault-secondary-button" onClick={() => handleCopy(viewingItem)}>
                <Copy size={15} /> 복사
              </button>
              <button type="button" className="vault-primary-button" onClick={() => { setViewingItem(null); openEdit(viewingItem); }}>
                <Edit3 size={15} /> 수정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
