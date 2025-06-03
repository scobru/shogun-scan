/**
 * Simple logging utility
 */
export function log(message: string, ...args: any[]): void {
  console.log(`[BIP44] ${message}`, ...args);
}

/**
 * Simple error logging utility
 */
export function logError(message: string, error?: any): void {
  console.error(`[BIP44] ${message}`, error);
}

/**
 * Simple warning logging utility
 */
export function logWarn(message: string, ...args: any[]): void {
  console.warn(`[BIP44] ${message}`, ...args);
}

/**
 * Error types for the BIP44 plugin
 */
export enum ErrorType {
  AUTHENTICATION = "AuthenticationError",
  WALLET = "WalletError",
  VALIDATION = "ValidationError",
  NETWORK = "NetworkError",
}

/**
 * Simple error handler
 */
export class ErrorHandler {
  static handle(
    type: ErrorType,
    code: string,
    message: string,
    originalError?: any
  ): void {
    const error = new Error(`[${type}] ${code}: ${message}`);
    if (originalError) {
      console.error("Original error:", originalError);
    }
    console.error(error);
  }
}

/**
 * Simple EventEmitter implementation
 */
export class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          logError(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  off(event: string, listener: Function): void {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
} 