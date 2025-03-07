// Definizione dell'interfaccia di ShogunSDK aggiornata

declare module 'shogun-sdk' {
  export interface ShogunSDK {
    gun: any;
    gundb: any;
    webauthn: any;
    metamask?: any;
    stealth?: any;
    hedgehog: any;
    
    // Metodi di autenticazione
    handleSignUp: (username: string, password: string, passwordConfirmation: string, options: any) => Promise<any>;
    handleLogin: (username: string, password: string, options: any) => Promise<any>;
    logout: () => void;
    isLoggedIn: () => boolean;
    
    // Metodi WebAuthn
    isWebAuthnSupported: () => boolean;
    loginWithWebAuthn: (username: string) => Promise<any>;
    registerWithWebAuthn: (username: string) => Promise<any>;
    getWebAuthnDevices: (username: string) => Promise<any[]>;
    removeWebAuthnDevice: (username: string, credentialId: string) => Promise<boolean>;
    
    // Metodi MetaMask
    loginWithMetaMask: (address: string) => Promise<any>;
    signUpWithMetaMask: (address: string) => Promise<any>;
    
    // Metodi Wallet
    getMainWallet: () => any;
    createWallet: () => Promise<any>;
    loadWallets: () => Promise<any[]>;
    deriveWallet: (userpub: any, index: any) => Promise<any>;
    signMessage: (wallet: any, message: string | Uint8Array) => Promise<string>;
    verifySignature: (message: string | Uint8Array, signature: any) => boolean;
    
    // Nuovi metodi HD Wallet con ethers v6
    createHDWallet: (username: string, password: string) => Promise<{
      wallet: any;
      mnemonic?: string;
      address: string;
      privateKey: string;
    }>;
    deriveChildWallet: (hdWallet: any, index: number) => any;
    encryptWallet: (wallet: any, password: string) => Promise<string>;
    decryptWallet: (json: string, password: string) => Promise<any>;
    signTransaction: (wallet: any, toAddress: string, value: string) => Promise<string>;
    generateMnemonicWallet: () => { wallet: any; mnemonic: string };
    restoreFromMnemonic: (mnemonic: string) => any;
    saveMnemonicToGun: (userpub: string, mnemonic: string) => Promise<void>;
    getMnemonicFromGun: (userpub: string) => Promise<string | null>;
    saveMnemonicToLocalStorage: (mnemonic: string) => void;
    getMnemonicFromLocalStorage: () => string | null;
    accessHDWallet: (username: string, password: string) => Promise<{
      wallet: any;
      mnemonic?: string;
      isNew: boolean;
    }>;
    accessHDWalletWithFallback: (username: string, password: string) => Promise<{
      wallet: any;
      mnemonic?: string;
      isNew: boolean;
    }>;
    migrateToEthersV6: () => Promise<boolean>;
    
    // Metodi Stealth
    createStealthAccount: () => Promise<any>;
    generateStealthAddress: (recipientPublicKey: string) => Promise<any>;
    openStealthAddress: (stealthAddress: string, ephemeralPublicKey: string) => Promise<any>;
    
    // Eventi
    on: (event: string, listener: Function) => void;
    off: (event: string, listener: Function) => void;
  }

  export interface StealthKeyPair {
    pub: string;
    priv: string;
    epub: string;
    epriv: string;
  }

  export interface StealthAddressResult {
    stealthAddress: string;
    ephemeralPublicKey: string;
    recipientPublicKey: string;
  }

  export interface WalletInfo {
    wallet: any;
    path: string;
    address: string;
    getAddressString: () => string;
    signMessage: (message: string | Uint8Array) => Promise<string>;
  }

  export class ShogunSDK {
    constructor(options: { peers: string[] });
  }
} 