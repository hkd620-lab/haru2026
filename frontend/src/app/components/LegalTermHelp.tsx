import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { legalTermDetails, type LegalTerm } from '../data/legalTermDictionary';

type PopoverPosition = {
  left: number;
  width: number;
  arrowLeft: number;
};

const LEGAL_HELP_EVENT = 'haru-legal-help-open';
const LEGAL_TERM_TOAST_ID = 'haru-legal-term-toast';

function makeSafeId(value: string) {
  return value.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export function InlineHelpPopover({
  label,
  ariaLabel,
  title,
  children,
  emphasis,
  onOpen,
  className = 'inline align-baseline font-semibold text-blue-700 underline decoration-dotted underline-offset-4',
}: {
  label: ReactNode;
  ariaLabel: string;
  title?: string;
  children: ReactNode;
  emphasis?: string;
  onOpen?: () => void;
  className?: string;
}) {
  const generatedId = useId();
  const instanceId = `${makeSafeId(generatedId)}-${typeof label === 'string' ? makeSafeId(label) : 'help'}`;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition>({
    left: 0,
    width: 280,
    arrowLeft: 132,
  });
  const popoverId = `${instanceId}-popover`;

  const updatePopoverPosition = () => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(280, Math.max(220, window.innerWidth - 24));
    const viewportPadding = 12;
    const desiredLeft = rect.left + rect.width / 2 - width / 2;
    const clampedLeft = Math.min(
      Math.max(desiredLeft, viewportPadding),
      window.innerWidth - width - viewportPadding,
    );
    const arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - clampedLeft - 4, 12), width - 20);

    setPopoverPosition({
      left: clampedLeft - rect.left,
      width,
      arrowLeft,
    });
  };

  useEffect(() => {
    const closeWhenAnotherOpens = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instanceId) {
        setIsOpen(false);
      }
    };

    window.addEventListener(LEGAL_HELP_EVENT, closeWhenAnotherOpens);
    return () => window.removeEventListener(LEGAL_HELP_EVENT, closeWhenAnotherOpens);
  }, [instanceId]);

  useEffect(() => {
    if (!isOpen) return;
    updatePopoverPosition();

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-legal-help-root="${instanceId}"]`)) return;
      setIsOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [instanceId, isOpen]);

  const popoverStyle: CSSProperties = {
    left: `${popoverPosition.left}px`,
    width: `${popoverPosition.width}px`,
  };

  return (
    <span className="relative inline-block" data-legal-help-root={instanceId}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label={ariaLabel}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          updatePopoverPosition();
          window.dispatchEvent(new CustomEvent(LEGAL_HELP_EVENT, { detail: instanceId }));
          onOpen?.();
          setIsOpen(true);
        }}
        className={className}
      >
        {label}
      </button>
      {isOpen && (
        <span
          id={popoverId}
          role="tooltip"
          className="absolute top-full z-50 mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs leading-5 text-gray-700 shadow-md"
          style={popoverStyle}
        >
          <span
            aria-hidden="true"
            className="absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-blue-100 bg-blue-50"
            style={{ left: `${popoverPosition.arrowLeft}px` }}
          />
          {title && <span className="mb-1 block font-semibold text-gray-900">{title}</span>}
          <span className="block">{children}</span>
          {emphasis && <span className="mt-1 block font-semibold text-blue-800">{emphasis}</span>}
        </span>
      )}
    </span>
  );
}

function showLegalTermToast(term: LegalTerm, expanded = false) {
  const detail = legalTermDetails[term];

  toast.custom(
    (toastId) => (
      <div className="w-[min(92vw,420px)] rounded-lg border border-[#bfd1e8] bg-white p-4 text-left shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-[#162f55]">{detail.title}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[#475569]">
              {detail.shortDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="min-h-8 shrink-0 rounded border border-[#cbd5e1] bg-white px-2 text-xs font-extrabold text-[#64748b]"
          >
            닫기
          </button>
        </div>
        {expanded && (
          <div className="mt-3 rounded-md border border-[#dbe3ec] bg-[#f8fafc] px-3 py-3 text-xs font-bold leading-5 text-[#475569]">
            <p>{detail.actionGuide}</p>
            <p className="mt-2 text-[#9a3412]">{detail.caution}</p>
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          {!expanded && (
            <button
              type="button"
              onClick={() => showLegalTermToast(term, true)}
              className="min-h-9 rounded bg-[#183c73] px-3 text-xs font-extrabold text-white"
            >
              자세히 보기
            </button>
          )}
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="min-h-9 rounded border border-[#183c73] bg-white px-3 text-xs font-extrabold text-[#183c73]"
          >
            닫기
          </button>
        </div>
      </div>
    ),
    {
      id: LEGAL_TERM_TOAST_ID,
      duration: expanded ? 8000 : 7000,
      position: 'bottom-center',
      className: 'mb-20',
    },
  );
}

export function LegalTermHelp({ term, className }: { term: LegalTerm; className?: string }) {
  const detail = legalTermDetails[term];

  return (
    <InlineHelpPopover
      label={
        <span className="inline-flex items-baseline gap-1">
          <span>{term}</span>
          <span aria-hidden="true" className="text-[0.82em] leading-none">
            ⓘ
          </span>
        </span>
      }
      ariaLabel={`${term} 뜻 보기`}
      className={className}
      title={detail.title}
      emphasis={detail.actionGuide}
      onOpen={() => showLegalTermToast(term)}
    >
      {detail.shortDescription}
    </InlineHelpPopover>
  );
}
