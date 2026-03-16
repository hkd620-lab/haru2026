import { useState } from 'react';
import { X, User, Mail, Calendar, Save } from 'lucide-react';

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
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  const handleSave = () => {
    // Save logic here
    alert('프로필이 업데이트되었습니다');
    onClose();
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
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#003366' }}
            >
              <span className="text-3xl" style={{ color: '#F9F8F3' }}>
                {name.charAt(0)}
              </span>
            </div>
            <button
              className="text-xs px-4 py-2 rounded transition-all"
              style={{ backgroundColor: '#F9F8F3', color: '#666666' }}
            >
              사진 변경
            </button>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none"
              style={{
                backgroundColor: '#F9F8F3',
                border: '1px solid #e5e5e5',
                color: '#333333',
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
            className="px-5 py-2 rounded-lg text-sm transition-all"
            style={{ backgroundColor: '#F9F8F3', color: '#666666' }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all hover:opacity-90"
            style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
          >
            <Save className="w-4 h-4" />
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
