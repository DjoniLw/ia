import { EventEmitter } from 'events'
import type { DomainEvent } from './domain-event'
import { logger } from '../logger/logger'

class EventBus extends EventEmitter {
  publish(event: DomainEvent): void {
    logger.debug({ eventName: event.eventName, eventId: event.eventId }, 'Domain event published')
    this.emit(event.eventName, event)
    this.emit('*', event)
  }

  subscribe(eventName: string, handler: (event: DomainEvent) => void | Promise<void>): void {
    this.on(eventName, handler)
  }

  subscribeAll(handler: (event: DomainEvent) => void | Promise<void>): void {
    this.on('*', handler)
  }
}

export const eventBus = new EventBus()
