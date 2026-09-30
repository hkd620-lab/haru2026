export type AiLibraryPageRequestTicket = {
  generation: number;
  key: string;
};

export class AiLibraryPageRequestGuard {
  private generation = 0;
  private activeKeys = new Set<string>();

  startSession(): number {
    this.generation += 1;
    this.activeKeys.clear();
    return this.generation;
  }

  endSession(generation: number): void {
    if (this.generation !== generation) return;
    this.generation += 1;
    this.activeKeys.clear();
  }

  isCurrent(generation: number): boolean {
    return this.generation === generation;
  }

  startRequest(generation: number, key: string): AiLibraryPageRequestTicket | null {
    if (!this.isCurrent(generation) || this.activeKeys.has(key)) return null;
    this.activeKeys.add(key);
    return { generation, key };
  }

  finishRequest(ticket: AiLibraryPageRequestTicket): boolean {
    if (!this.isCurrent(ticket.generation)) return false;
    this.activeKeys.delete(ticket.key);
    return true;
  }
}

export function mergeAiLibraryLogs<T extends { id: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];
  incoming.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  });
  return merged;
}

export function hasAiLibraryNextPage(cursor: unknown): cursor is string {
  return typeof cursor === 'string' && cursor.length > 0;
}
