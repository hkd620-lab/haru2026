type Action = () => Promise<void>;
type Options = {
  activate: Action;
  reload: () => void;
  offer: (action: Action, label?: string, notice?: string) => void;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};
/** Consent belongs to this tab, even when a different tab activates the worker. */
export function createPwaUpdateController({ activate, reload, offer, schedule = setTimeout, cancel = clearTimeout }: Options) {
  let requested = false;
  let generation = 0;
  let controlledByNewWorker = false;
  let pending: Promise<void> | null = null;
  let finish: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    generation++;
    if (timer !== undefined) cancel(timer);
    timer = undefined;
    finish?.();
    finish = undefined;
    pending = null;
  };
  const reloadThisTab = async () => { reload(); };
  const requestUpdate: Action = () => {
    if (pending) return pending;
    if (controlledByNewWorker) return reloadThisTab();
    requested = true;
    const attempt = ++generation;
    pending = new Promise<void>(resolve => { finish = resolve; });
    const result = pending;
    timer = schedule(() => {
      if (attempt !== generation) return;
      requested = false;
      offer(reloadThisTab, '화면 다시 열기', '업데이트 확인이 늦어지고 있어요. 입력 내용을 저장한 뒤 화면을 다시 열어 주세요.');
      settle();
    }, 12000);
    void activate().catch(() => {
      if (attempt !== generation) return;
      requested = false;
      offer(requestUpdate, '다시 시도', '업데이트를 적용하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
      settle();
    });
    return result;
  };
  const onNeedReload = () => {
    controlledByNewWorker = true;
    if (requested) { requested = false; settle(); reload(); }
    else offer(requestUpdate, '화면 다시 열기', '다른 창에서 새 버전이 적용됐어요. 이 창의 내용을 저장한 뒤 화면을 다시 열어 주세요.');
  };
  const onNeedRefresh = () => {
    if (pending) return;
    controlledByNewWorker = false;
    offer(requestUpdate);
  };
  return { requestUpdate, onNeedReload, onNeedRefresh };
}
