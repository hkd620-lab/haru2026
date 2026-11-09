import type { RecordFormat } from '../types/haruTypes';
import { DRAFT_PICKER_FORMATS } from '../records/writeBeforeFormat';
import { RECORD_FORMAT_DESCRIPTIONS, getRecordFormatLabel } from '../records/recordFormatDescriptions';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

export function RecordFormatPicker({ open, afterWriting = false, onClose, onSelect }: {
  open: boolean;
  afterWriting?: boolean;
  onClose: () => void;
  onSelect: (format: RecordFormat) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto" style={{ background: '#F5F0E8', color: '#2C2C2A' }}>
        <DialogTitle className="pr-6">{afterWriting ? '작성한 기록을 어떤 형식으로 남길까요?' : '어떤 내용을 남기고 싶으세요?'}</DialogTitle>
        <DialogDescription>
          {afterWriting ? '작성한 내용은 그대로 유지돼요. 어울리는 형식을 골라 편집창에서 확인하고 저장하세요.' : '형식마다 어떤 내용을 남기는지 살펴보세요. 먼저 골라도, 쓰고 나서 골라도 괜찮아요.'}
        </DialogDescription>
        <div className="grid gap-2 sm:grid-cols-2">
          {DRAFT_PICKER_FORMATS.map((format) => (
            <button type="button" key={format} onClick={() => onSelect(format)} className="rounded-xl border bg-white p-4 text-left hover:bg-lime-50" style={{ borderColor: '#E5DFD0' }}>
              <span className="block text-base font-semibold">{getRecordFormatLabel(format)}</span>
              <span className="mt-1 block text-sm" style={{ color: '#646B57' }}>{RECORD_FORMAT_DESCRIPTIONS[format]?.description}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-3">돌아가기</button>
      </DialogContent>
    </Dialog>
  );
}
