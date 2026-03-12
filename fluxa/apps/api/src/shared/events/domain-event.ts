export interface DomainEvent {
  readonly eventId: string
  readonly eventName: string
  readonly occurredAt: Date
  readonly companyId: string
  readonly payload: Record<string, unknown>
}

export function createDomainEvent(
  eventName: string,
  companyId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    eventId: crypto.randomUUID(),
    eventName,
    occurredAt: new Date(),
    companyId,
    payload,
  }
}
