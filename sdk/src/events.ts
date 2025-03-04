import { EventEmitter } from './utils/eventEmitter';
import { Wallet } from 'ethers';

export interface AuthEventData {
  userPub: string;
  username?: string;
  method: 'password' | 'webauthn' | 'metamask';
}

export interface WalletEventData {
  address: string;
  path?: string;
}

export interface ErrorEventData {
  code: string;
  message: string;
  details?: any;
}

export interface ShogunEvents {
  'auth:login': (data: AuthEventData) => void;
  'auth:logout': () => void;
  'auth:signup': (data: AuthEventData) => void;
  'wallet:created': (data: WalletEventData) => void;
  'error': (data: ErrorEventData) => void;
}

export class ShogunEventEmitter extends EventEmitter {
  emit<K extends keyof ShogunEvents>(event: K, ...args: Parameters<ShogunEvents[K]>): void {
    super.emit(event as string, ...args);
  }

  on<K extends keyof ShogunEvents>(event: K, listener: ShogunEvents[K]): void {
    super.on(event as string, listener);
  }

  off<K extends keyof ShogunEvents>(event: K, listener: ShogunEvents[K]): void {
    super.off(event as string, listener);
  }
}