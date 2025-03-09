// Definizione dell'interfaccia di ShogunSDK aggiornata

declare module 'shogun-sdk' {
  export interface ShogunSDK {
    gun: any;
    gundb: any;
    webauthn: any;
    metamask?: any;
    stealth?: any;
    hedgehog: any;
    mom?: any; // Nuovo modulo MOM
    
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
    
    // Metodi di esportazione
    exportMnemonic: (password?: string) => Promise<string>;
    exportWalletKeys: (password?: string) => Promise<string>;
    exportGunPair: (password?: string) => Promise<string>;
    exportAllUserData: (password: string) => Promise<string>;
    
    // Metodi di importazione
    importMnemonic: (mnemonicData: string, password?: string) => Promise<boolean>;
    importWalletKeys: (walletsData: string, password?: string) => Promise<number>;
    importGunPair: (pairData: string, password?: string) => Promise<boolean>;
    importAllUserData: (
      backupData: string, 
      password: string,
      options?: { 
        importMnemonic?: boolean; 
        importWallets?: boolean; 
        importGunPair?: boolean;
      }
    ) => Promise<{ 
      success: boolean; 
      mnemonicImported?: boolean; 
      walletsImported?: number; 
      gunPairImported?: boolean;
    }>;
    
    // Nuovi metodi MOM (My Own Messages)
    publishMOMMessage: (
      wallet: any, 
      message: MOMDraftMessage,
      operation?: MOMOperation
    ) => Promise<string>;
    
    getMOMMessages: (
      address: string,
      fromBlock?: number,
      toBlock?: string | number
    ) => Promise<MOMMessage[]>;
    
    getMOMMessagesWithContent: (
      messages: MOMMessage[]
    ) => Promise<MOMMessage[]>;
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

  // Tipi per MOM
  export type MOMOperation = number;
  
  export interface MOMDraftMessage {
    content: string;
    contentType?: string;
    replyTo?: string;
    references?: string[];
  }
  
  export interface MOMMessage {
    multihash: string;
    content?: string;
    contentType?: string;
    transactionHash: string;
    author: string;
    timestamp: number;
    replies?: MOMMessage[];
    replyTo?: string;
    endorsed?: boolean;
    disapproved?: boolean;
    references?: string[];
  }
  
  export class ShogunSDK {
    constructor(options: { peers: string[] });
  }
} 