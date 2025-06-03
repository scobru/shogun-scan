// Type definitions for shogun-core
// This file extends the types provided by shogun-core

import { ShogunCore, IShogunCore, ShogunSDKConfig, AuthResult, SignUpResult, WalletInfo, LoggingConfig } from 'shogun-core';
import { ethers } from 'ethers';
import { Observable } from 'rxjs';

declare module 'shogun-core' {
  // Plugin definitions
  interface ShogunPlugin {
    name: string;
    category: PluginCategory;
    initialize(core: IShogunCore): Promise<void>;
    destroy?(): Promise<void>;
  }

  type PluginCategory = 'auth' | 'storage' | 'blockchain' | 'utility' | 'other';

  interface IShogunCore {
    // Core properties
    gun: IGunInstance<any>;
    user: IGunUserInstance<any> | null;
    gundb: GunDB;
    did?: DID;
    storage: ShogunStorage;
    provider?: ethers.Provider;
    config: ShogunSDKConfig;
    rx: GunRxJS; // RxJS integration
    webauthn?: Webauthn;
    metamask?: MetaMask;
    stealth?: Stealth;

    // Plugin system
    register(plugin: ShogunPlugin): void;
    unregister(pluginName: string): void;
    getPlugin<T>(name: string): T | undefined;
    hasPlugin(name: string): boolean;
    getPluginsByCategory(category: PluginCategory): ShogunPlugin[];

    // RxJS methods
    observe<T>(path: string | any): Observable<T>;
    match<T>(path: string | any, matchFn?: (data: any) => boolean): Observable<T[]>;
    rxPut<T>(path: string | any, data: T): Observable<T>;
    rxSet<T>(path: string | any, data: T): Observable<T>;
    once<T>(path: string | any): Observable<T>;
    compute<T, R>(sources: Array<string | Observable<any>>, computeFn: (...values: T[]) => R): Observable<R>;
    rxUserPut<T>(path: string, data: T): Observable<T>;
    observeUser<T>(path: string): Observable<T>;

    // Authentication methods
    isLoggedIn(): boolean;
    logout(): void;
    login(username: string, password: string): Promise<AuthResult>;
    signUp(username: string, password: string, passwordConfirmation?: string): Promise<SignUpResult>;
    loginWithWebAuthn(username: string): Promise<AuthResult>;
    signUpWithWebAuthn(username: string): Promise<AuthResult>;
    loginWithMetaMask(address: string): Promise<AuthResult>;
    signUpWithMetaMask(address: string): Promise<AuthResult>;
    
    // Utility methods
    setRpcUrl(rpcUrl: string): boolean;
    getRpcUrl(): string | null;
    getRecentErrors(count?: number): ShogunError[];
    configureLogging(config: LoggingConfig): void;
    
    // Wallet methods
    getMainWallet(): ethers.Wallet | null;
    
    // DID related methods (exposed via the did property)
    get(path: string): Promise<any>;
    put(data: Record<string, any>): Promise<any>;
    userPut(data: Record<string, any>): Promise<any>;
    userGet(path: string): Promise<any>;
    
    // Event system
    emit(eventName: string | symbol, ...args: any[]): boolean;
  }

  // Define GunRxJS interface for RxJS integration
  interface GunRxJS {
    observe<T>(path: string | any): Observable<T>;
    match<T>(path: string | any, matchFn?: (data: any) => boolean): Observable<T[]>;
  }

  // Define ShogunError for error handling
  interface ShogunError {
    message: string;
    code?: string;
    timestamp: number;
    context?: any;
  }

  // Ensure ShogunCore interface matches the IShogunCore interface
  interface ShogunCore extends IShogunCore {}
} 