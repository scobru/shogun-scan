// Crea questo file per definire l'interfaccia di ShogunSDK

declare module 'shogun-sdk' {
  export interface ShogunSDK {
    gun: any;
    gundb: any;
    stealth?: {
      generateStealthAddress: (senderPublicKey: string, recipientPublicKey: string) => Promise<any>;
      openStealthAddress: (stealthAddress: string, ephemeralKey: string) => Promise<any>;
    };
    
    handleSignUp: (username: string, password: string, passwordConfirmation: string, options: any) => Promise<any>;
    handleLogin: (username: string, password: string, options: any) => Promise<any>;
    performLogout: (userpub: string, callback: () => void) => void;
    getWalletPaths: (pubKey: string) => Promise<string[]>;
    deriveWallet: (pubKey: string, index: number) => Promise<any>;
    getMainWallet: () => any;
    signMessage: (address: string, message: string) => Promise<string>;
    connectMetaMask: () => Promise<any>;
    handleMetaMaskLogin: (address: string, options: any) => Promise<any>;
    isWebAuthnSupported: () => boolean;
    handleWebAuthnSignUp: (username: string, options: any) => Promise<any>;
    handleWebAuthnLogin: (username: string, options: any) => Promise<any>;
    getWebAuthnDevices: (username: string) => Promise<any[]>;
  }

  export class ShogunSDK {
    constructor(options: { peers: string[] });
  }
} 