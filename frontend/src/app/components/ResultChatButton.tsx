import { MessageCircle } from 'lucide-react';

type ResultChatButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function ResultChatButton({ onClick, disabled = false }: ResultChatButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 42,
        borderRadius: 10,
        border: '1px solid #1A3C6E',
        backgroundColor: disabled ? '#E5E7EB' : '#FFFFFF',
        color: disabled ? '#9CA3AF' : '#1A3C6E',
        fontSize: 13,
        fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <MessageCircle size={16} />
      이 결과로 AI에게 묻기
    </button>
  );
}
