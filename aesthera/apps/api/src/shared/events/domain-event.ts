export interface DomainEvent {
  readonly eventId: string
  readonly eventName: string
  readonly occurredAt: Date
  readonly clinicId: string
  readonly payload: Record<string, unknown>
}

export function createDomainEvent(
  eventName: string,
  clinicId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    eventId: crypto.randomUUID(),
    eventName,
    occurredAt: new Date(),
    clinicId,
    payload,
  }
}
