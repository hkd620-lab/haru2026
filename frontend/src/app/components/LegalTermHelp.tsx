import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { legalTermDictionary, type LegalTerm } from '../data/legalTermDictionary';

type PopoverPosition = {
  left: number;
  width: number;
  arrowLeft: number;
};

const LEGAL_HELP_EVENT = 'haru-legal-help-open';

function makeSafeId(value: string) {
  return value.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export function InlineHelpPopover({
  label,
  ariaLabel,
  title,
  children,
  emphasis,
  className = 'inline align-baseline font-semibold text-blue-700 underline decoration-dotted underline-offset-4',
}: {
  label: ReactNode;
  ariaLabel: string;
  title?: string;
  children: ReactNode;
  emphasis?: string;
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

export function LegalTermHelp({ term, className }: { term: LegalTerm; className?: string }) {
  return (
    <InlineHelpPopover label={term} ariaLabel={`${term} 뜻 보기`} className={className}>
      {legalTermDictionary[term]}
    </InlineHelpPopover>
  );
}
