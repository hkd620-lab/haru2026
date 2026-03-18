import { useState, useRef } from 'react';
import { X, User, Mail, Calendar, Save, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { uploadProfileImage } from '../services/imageService';
import { toast } from 'sonner';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    joinDate: string;
    profileImage: string | null;
  };
}

export function ProfileModal({ open, onClose, user }: ProfileModalProps) {
  const { updateUserProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.profileImage);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 선택할 수 있습니다.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('10MB 이하의 이미지를 선택해주세요.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: { displayName?: string; photoURL?: string } = {};

      if (name.trim() && name.trim() !== user.name) {
        updates.displayName = name.trim();
      }

      if (selectedFile) {
        toast.info('이미지를 압축하고 업로드하는 중...');
        // AuthContext의 uid를 사용하기 위해 user.email 기반 uid는 쓸 수 없으므로
        // 업로드는 현재 Firebase Auth 사용자 기준으로 처리
        const { auth } = await import('../../firebase');
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('로그인이 필요합니다.');
        const photoURL = await uploadProfileImage(currentUser.uid, selectedFile);
        updates.photoURL = photoURL;
      }

      if (Object.keys(updates).length > 0) {
        await updateUserProfile(updates);
      }

      toast.success('프로필이 업데이트되었습니다.');
      onClose();
    } catch (error: any) {
      console.error('프로필 업데이트 실패:', error);
      toast.error('프로필 업데이트에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#e5e5e5' }}>
          <h2 className="text-lg tracking-wide" style={{ color: '#003366' }}>
            프로필 편집
          </h2>
          <button
            onClick={onClose}
            className="p-3 rounded hover:bg-gray-50 transition-all"
            style={{ color: '#999999' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile Image */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: '#003366' }}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="프로필 이미지"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl" style={{ color: '#F9F8F3' }}>
                    {name.charAt(0)}
                  </span>
                )}
              </div>
              <button
                onClick={handlePhotoClick}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all hover:opacity-90"
                style={{ backgroundColor: '#003366' }}
                title="사진 변경"
              >
                <Camera className="w-3.5 h-3.5" style={{ color: '#F9F8F3' }} />
              </button>
            </div>
            <button
              onClick={handlePhotoClick}
              className="text-xs px-4 py-2 rounded transition-all hover:opacity-80"
              style={{ backgroundColor: '#F9F8F3', color: '#666666' }}
            >
              사진 변경
            </button>
            {selectedFile && (
              <p className="text-xs" style={{ color: '#10b981' }}>
                ✓ {selectedFile.name} 선택됨 (저장 시 압축 업로드)
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-xs mb-2" style={{ color: '#666666' }}>
              <User className="w-4 h-4" />
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none"
              style={{
                backgroundColor: '#F9F8F3',
                border: '1px solid #e5e5e5',
                color: '#333333',
              }}
            />
          </div>

          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-xs mb-2" style={{ color: '#666666' }}>
              <Mail className="w-4 h-4" />
              이메일
            </label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="w-full px-4 py-3 rounded-lg text-sm"
              style={{
                backgroundColor: '#F9F8F3',
                border: '1px solid #e5e5e5',
                color: '#999999',
                cursor: 'not-allowed',
              }}
            />
          </div>

          {/* Join Date (Read-only) */}
          <div>
            <label className="flex items-center gap-2 text-xs mb-2" style={{ color: '#666666' }}>
              <Calendar className="w-4 h-4" />
              가입일
            </label>
            <input
              type="text"
              value={user.joinDate}
              readOnly
              className="w-full px-4 py-3 rounded-lg text-sm"
              style={{
                backgroundColor: '#F9F8F3',
                border: '1px solid #e5e5e5',
                color: '#999999',
                cursor: 'not-allowed',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#e5e5e5' }}>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: '#F9F8F3', color: '#666666' }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
