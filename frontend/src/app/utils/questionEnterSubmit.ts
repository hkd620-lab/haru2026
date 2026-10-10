// 질문 입력칸에서 Enter를 "전송"으로 처리할지 판단한다.
// 한글 같은 IME 조합을 확정하는 Enter는 전송하지 않는다.
//
// - Chrome: 조합 중 keydown은 isComposing=true 이고, compositionend는 그 뒤에 온다.
// - Safari(WebKit): compositionend가 먼저 오고, 확정 Enter keydown은 isComposing=false, keyCode=229 로 온다.
// - keyCode 229를 주지 않는 환경을 대비해, compositionend 직후 짧은 시간 안의 Enter도 확정 Enter로 보고
//   전송도 줄바꿈도 하지 않는다. 두 이벤트의 timeStamp 차이로 판단하므로 핸들러 실행 지연의 영향을 받지 않는다.
//   키보드 이벤트는 플랫폼 입력 시각을, 조합 이벤트는 생성 시각을 쓰는 환경에서는 확정 Enter의 timeStamp가
//   compositionend보다 앞설 수 있으므로, 앞뒤 어느 쪽이든 보호 시간 안이면 확정 Enter로 본다.
//   보호 시간(50ms)은 같은 키 입력에서 나온 두 이벤트의 간격보다 길고, 사람이 Enter를 두 번 누르는 간격보다 짧게 잡았다.
// - compositionend가 오지 않아 "조합 중" 표시가 남으면 Enter 전송이 막히므로, blur에서 reset()으로 푼다.

export const ENTER_AFTER_COMPOSITION_GUARD_MS = 50;

export type EnterKeyInput = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
  timeStamp: number;
};

/** send: 질문 전송 / ignore: 전송도 줄바꿈도 하지 않음(기본 동작 차단) / pass: 그대로 둔다 */
export type EnterKeyDecision = 'send' | 'ignore' | 'pass';

export class EnterSubmitGuard {
  private composing = false;
  private compositionEndedAt: number | null = null;
  private readonly guardMs: number;

  constructor(guardMs: number = ENTER_AFTER_COMPOSITION_GUARD_MS) {
    this.guardMs = guardMs;
  }

  compositionStart(): void {
    this.composing = true;
  }

  compositionEnd(timeStamp: number): void {
    this.composing = false;
    this.compositionEndedAt = timeStamp;
  }

  reset(): void {
    this.composing = false;
    this.compositionEndedAt = null;
  }

  decide(input: EnterKeyInput): EnterKeyDecision {
    if (input.key !== 'Enter' || input.shiftKey) return 'pass';
    if (this.composing || input.isComposing || input.keyCode === 229) return 'pass';
    if (this.compositionEndedAt !== null) {
      const sinceCompositionEnd = input.timeStamp - this.compositionEndedAt;
      if (Math.abs(sinceCompositionEnd) < this.guardMs) return 'ignore';
    }
    return 'send';
  }
}
