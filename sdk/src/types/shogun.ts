import { IGunInstance } from "gun/types";

// Dichiarazioni dei tipi per i moduli esterni
type Webauthn = any;
type MetaMask = any;
type Stealth = any;
type GunDB = any;

// Aggiungi l'interfaccia per i risultati di autenticazione
export interface AuthResult {
  success: boolean;
  userPub?: string;
  password?: string;
  error?: string;
  wallet?: any;
  username?: string;
}

export interface SignUpResult {
  success: boolean;
  wallet?: any;
  pub?: string;
  error?: string;
}

export interface IShogunSDK {
  gun: IGunInstance<any>;
  gundb: GunDB;
  hedgehog: any;
  webauthn?: Webauthn | undefined;
  metamask?: MetaMask | undefined;
  stealth?: Stealth | undefined;

  // Metodi di autenticazione
  isWebAuthnSupported(): boolean;
  handleLogin(username: string, password: string, options: {
    setUserpub?: (pub: string) => void;
    setSignedIn?: (signedIn: boolean) => void;
  }): Promise<AuthResult>;
  handleSignUp(
    username: string, 
    password: string, 
    passwordConfirmation: string, 
    options: {
      setErrorMessage?: (message: string) => void;
      setUserpub?: (pub: string) => void;
      setSignedIn?: (signedIn: boolean) => void;
      messages?: { [key: string]: string };
    }
  ): Promise<AuthResult>;
  
  // Metodi WebAuthn
  loginWithWebAuthn(username: string): Promise<{
    success: boolean;
    error?: string;
    userPub?: string;
    password?: string;
    credentialId?: string;
  }>;
  registerWithWebAuthn(username: string): Promise<{
    success: boolean;
    error?: string;
    userPub?: string;
    password?: string;
    credentialId?: string;
  }>;

  // Metodi MetaMask
  loginWithMetaMask(address: string): Promise<AuthResult>;
  signUpWithMetaMask(address: string): Promise<AuthResult>;
  
  // Metodi Wallet
  getMainWallet(): any;
  createWallet(): Promise<any>;
  loadWallets(): Promise<any[]>;
  deriveWallet(userpub: string, index: number): Promise<any>;
  signMessage(wallet: any, message: string | Uint8Array): Promise<string>;
  verifySignature(message: string | Uint8Array, signature: any): any;
  
  // Metodi HD Wallet con ethers v6
  createHDWallet(username: string, password: string): Promise<{
    wallet: any;
    mnemonic?: string;
    address: string;
    privateKey: string;
  }>;
  deriveChildWallet(hdWallet: any, index: number): any;
  encryptWallet(wallet: any, password: string): Promise<string>;
  decryptWallet(json: string, password: string): Promise<any>;
  signTransaction(wallet: any, toAddress: string, value: string): Promise<string>;
  generateMnemonicWallet(): { wallet: any; mnemonic: string };
  restoreFromMnemonic(mnemonic: string): any;
  saveMnemonicToGun(userpub: string, mnemonic: string): Promise<void>;
  getMnemonicFromGun(userpub: string): Promise<string | null>;
  saveMnemonicToLocalStorage(mnemonic: string): void;
  getMnemonicFromLocalStorage(): string | null;
  accessHDWallet(username: string, password: string): Promise<{
    wallet: any;
    mnemonic?: string;
    isNew: boolean;
  }>;
  accessHDWalletWithFallback(username: string, password: string): Promise<{
    wallet: any;
    mnemonic?: string;
    isNew: boolean;
  }>;
  migrateToEthersV6(): Promise<boolean>;
  
  // Metodi di utilità
  logout(): void;
  isLoggedIn(): boolean;
}

export interface ShogunSDKConfig {
  peers: any;
}

export interface WalletInfo {
  wallet: any;
  path: string;
  address: string;
  getAddressString: () => string;
}

// Definizione esplicita dell'interfaccia ShogunEvents che non richiedeva prima
export interface ShogunEvents {
  'error': (data: { action: string; message: string }) => void;
  'auth:signup': (data: { username: string; userPub: string }) => void;
  'auth:login': (data: { username: string; userPub: string }) => void;
  'auth:logout': (data: Record<string, never>) => void;
}

