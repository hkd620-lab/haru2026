interface GrapeLoadingMiniProps {
  size?: number;
  withText?: boolean;
  color?: string;
}

const GRAPES = [
  { cx: 8, cy: 7, delay: '0s' },
  { cx: 12, cy: 7, delay: '0.1s' },
  { cx: 16, cy: 7, delay: '0.2s' },
  { cx: 10, cy: 12, delay: '0.3s' },
  { cx: 14, cy: 12, delay: '0.4s' },
  { cx: 12, cy: 17, delay: '0.5s' },
];

export default function GrapeLoadingMini({
  size = 24,
  withText = false,
  color = '#1A3C6E',
}: GrapeLoadingMiniProps) {
  const gap = Math.max(4, Math.round(size * 0.25));
  const fontSize = Math.max(11, Math.round(size * 0.55));

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        verticalAlign: 'middle',
        lineHeight: 1,
      }}
    >
      <style>{`
        @keyframes grape-loading-mini-bounce {
          0%, 100% { transform: scale(0.7); opacity: 0.35; }
          50%     { transform: scale(1.15); opacity: 1; }
        }
        .grape-loading-mini-circle {
          transform-box: fill-box;
          transform-origin: center;
          animation: grape-loading-mini-bounce 1.2s ease-in-out infinite;
          will-change: transform, opacity;
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ display: 'inline-block', flexShrink: 0 }}
        aria-hidden="true"
      >
        <path
          d="M12 4 C13 3 14.5 2.5 16 2.5"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
        {GRAPES.map((g, i) => (
          <circle
            key={i}
            cx={g.cx}
            cy={g.cy}
            r="2.4"
            fill={color}
            className="grape-loading-mini-circle"
            style={{ animationDelay: g.delay }}
          />
        ))}
      </svg>
      {withText && (
        <span
          style={{
            fontSize,
            color,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          준비 중...
        </span>
      )}
    </span>
  );
}
