import { IGunInstance } from "gun/types";
import { ethers } from "ethers";

// Dichiarazioni dei tipi per i moduli esterni
type Webauthn = any;
type MetaMask = any;
type Stealth = any;
type GunDB = any;

// Aggiungi l'interfaccia per i risultati di autenticazione
export interface AuthResult {
  success: boolean;
  userPub?: string;
  wallet?: any;
  username?: string;
  error?: string;
  credentialId?: string;
}

export interface SignUpResult {
  success: boolean;
  userPub?: string;
  pub?: string;
  error?: string;
  message?: string;
  wallet?: any;
}

export interface IShogunSDK {
  gun: IGunInstance<any>;
  gundb: GunDB;
  webauthn: Webauthn;
  metamask: MetaMask;
  stealth: Stealth;

  // Metodi di autenticazione diretti
  login(username: string, password: string): Promise<AuthResult>;
  signUp(username: string, password: string, passwordConfirmation?: string): Promise<SignUpResult>;
  loginWithWebAuthn(username: string): Promise<AuthResult>;
  registerWithWebAuthn(username: string): Promise<AuthResult>;
  loginWithMetaMask(address: string): Promise<AuthResult>;
  signUpWithMetaMask(address: string): Promise<AuthResult>;
  // Metodi di supporto
  isWebAuthnSupported(): boolean;

  // Metodi Wallet
  getMainWallet(): ethers.Wallet | null;
  createWallet(): Promise<WalletInfo>;
  loadWallets(): Promise<WalletInfo[]>;
  deriveWallet(index: number): Promise<WalletInfo>;
  signMessage(wallet: ethers.Wallet, message: string | Uint8Array): Promise<string>;
  verifySignature(message: string | Uint8Array, signature: string): string;
  signTransaction(wallet: ethers.Wallet, toAddress: string, value: string): Promise<string>;

  // Metodi di utilità
  logout(): void;
  isLoggedIn(): boolean;
}

export interface ShogunSDKConfig {
  peers?: string[];
  gundb?: {
    peers?: string[];
  };
  websocket?: {
    secure?: boolean;
    mode?: string;
    path?: string;
  };
  storage?: {
    prefix?: string;
  };
  axe?: boolean;
  multicast?: boolean;
}

export interface WalletInfo {
  wallet: any;
  path: string;
  address: string;
  getAddressString: () => string;
}

// Definizione esplicita dell'interfaccia ShogunEvents che non richiedeva prima
export interface ShogunEvents {
  error: (data: { action: string; message: string }) => void;
  "auth:signup": (data: { username: string; userPub: string }) => void;
  "auth:login": (data: { username: string; userPub: string }) => void;
  "auth:logout": (data: Record<string, never>) => void;
}


