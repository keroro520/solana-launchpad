import { 
  EventEmitterInterface, 
  EventListener, 
  EventSubscription,
  EventSubscriptionOptions,
  ResetEvents 
} from '../types/events';

/**
 * Event emitter for Reset SDK
 */
export class EventEmitter implements EventEmitterInterface {
  private listeners: Map<keyof ResetEvents, Set<EventListener>> = new Map();

  /**
   * Add event listener
   */
  on<K extends keyof ResetEvents>(
    event: K, 
    listener: EventListener<ResetEvents[K]>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof ResetEvents>(
    event: K, 
    listener: EventListener<ResetEvents[K]>
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Add one-time event listener
   */
  once<K extends keyof ResetEvents>(
    event: K, 
    listener: EventListener<ResetEvents[K]>
  ): void {
    const onceListener = (data: ResetEvents[K]) => {
      listener(data);
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }

  /**
   * Emit event to all listeners
   */
  emit<K extends keyof ResetEvents>(event: K, data: ResetEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      // Create a copy of listeners to avoid issues if listeners are modified during emission
      const listenersArray = Array.from(eventListeners);
      listenersArray.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          // Emit error event for listener errors
          this.emit('error', {
            code: 'LISTENER_ERROR',
            message: `Error in event listener for ${String(event)}`,
            details: error,
            timestamp: Date.now()
          });
        }
      });
    }
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: keyof ResetEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: keyof ResetEvents): number {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? eventListeners.size : 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): Array<keyof ResetEvents> {
    return Array.from(this.listeners.keys());
  }

  /**
   * Subscribe to event with options
   */
  subscribe<K extends keyof ResetEvents>(
    event: K,
    listener: EventListener<ResetEvents[K]>,
    options?: EventSubscriptionOptions
  ): EventSubscription {
    let actualListener = listener;

    // Apply filter if provided
    if (options?.filter) {
      const originalListener = listener;
      actualListener = (data: ResetEvents[K]) => {
        if (options.filter!(data)) {
          originalListener(data);
        }
      };
    }

    // Add listener (once or regular)
    if (options?.once) {
      this.once(event, actualListener);
    } else {
      this.on(event, actualListener);
    }

    // Return subscription object
    return {
      unsubscribe: () => {
        this.off(event, actualListener);
      }
    };
  }

  /**
   * Wait for a specific event
   */
  waitFor<K extends keyof ResetEvents>(
    event: K,
    timeout?: number,
    filter?: (data: ResetEvents[K]) => boolean
  ): Promise<ResetEvents[K]> {
    return new Promise((resolve, reject) => {
      let timeoutId: any;

      const listener = (data: ResetEvents[K]) => {
        if (!filter || filter(data)) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          this.off(event, listener);
          resolve(data);
        }
      };

      this.on(event, listener);

      if (timeout) {
        timeoutId = setTimeout(() => {
          this.off(event, listener);
          reject(new Error(`Timeout waiting for event: ${String(event)}`));
        }, timeout);
      }
    });
  }

  /**
   * Create a filtered event emitter
   */
  filter<K extends keyof ResetEvents>(
    event: K,
    filterFn: (data: ResetEvents[K]) => boolean
  ): EventEmitter {
    const filteredEmitter = new EventEmitter();
    
    this.on(event, (data) => {
      if (filterFn(data)) {
        filteredEmitter.emit(event, data);
      }
    });

    return filteredEmitter;
  }
} 