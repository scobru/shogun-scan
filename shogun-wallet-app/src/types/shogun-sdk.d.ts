declare module 'shogun-sdk' {
  export function createWallet(options: {
    mnemonic: string;
    path: string;
  }): any;
  
  export interface ShogunSDKConfig {
    peers?: string[];
    persistence?: boolean;
    storage?: Storage;
    // Altri parametri del costruttore
  }
  
  export class ShogunSDK {
    constructor(config?: ShogunSDKConfig);
    
    // Metodi della classe
    signUp(username: string, password: string): Promise<any>;
    login(username: string, password: string): Promise<any>;
    logout(): void;
    isLoggedIn(): boolean;
    getMainWallet(): any;
    deriveWallet(userpub: any, index: any): Promise<any>;
    signMessage(wallet: any, message: string | Uint8Array): Promise<string>;
    verifySignature(message: string | Uint8Array, signature: any): string;
  }
} 