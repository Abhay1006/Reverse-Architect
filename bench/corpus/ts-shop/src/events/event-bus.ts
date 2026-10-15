type Listener = (payload: any) => void;

export class EventBus {
  private listeners = new Map<string, Listener[]>();

  subscribe(event: string, listener: Listener): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
  }

  emit(event: string, payload: unknown): void {
    for (const l of this.listeners.get(event) ?? []) l(payload);
  }
}
