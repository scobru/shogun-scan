import { IGunInstance } from "gun/types";
import { ethers } from "ethers";

// Dichiarazioni dei tipi per i moduli esterni
type Webauthn = any;
type MetaMask = any;
type Stealth = any;
type GunDB = any;

// Definizione interfacce per i risultati di autenticazione
export interface AuthResult {
  success: boolean;
  userPub?: string;
  wallet?: any;
  username?: string;
  error?: string;
  credentialId?: string;
  password?: string;
}

export interface SignUpResult {
  success: boolean;
  userPub?: string;
  username?: string;
  pub?: string;
  error?: string;
  message?: string;
  wallet?: any;
}

export interface IShogunCore {
  gun: IGunInstance<any>;
  gundb: GunDB;
  webauthn: Webauthn;
  metamask: MetaMask;
  stealth: Stealth;

  // Metodi di autenticazione diretti
  login(username: string, password: string): Promise<AuthResult>;
  loginWithWebAuthn(username: string): Promise<AuthResult>;
  loginWithMetaMask(address: string): Promise<AuthResult>;

  signUp(username: string, password: string, passwordConfirmation?: string): Promise<SignUpResult>;
  signUpWithMetaMask(address: string): Promise<AuthResult>;
  signUpWithWebAuthn(username: string): Promise<AuthResult>;

  // Metodi di supporto
  isWebAuthnSupported(): boolean;

  // Metodi Wallet
  getMainWallet(): ethers.Wallet | null;
  createWallet(): Promise<WalletInfo>;
  loadWallets(): Promise<WalletInfo[]>;
  signMessage(wallet: ethers.Wallet, message: string | Uint8Array): Promise<string>;
  verifySignature(message: string | Uint8Array, signature: string): string;
  signTransaction(wallet: ethers.Wallet, toAddress: string, value: string): Promise<string>;
  getStandardBIP44Addresses(mnemonic: string, count?: number): string[];
  generateNewMnemonic(): string;

  // Metodi di utilità
  logout(): void;
  isLoggedIn(): boolean;
}

export interface ShogunSDKConfig {
  gunPeers?: string[];
  localStorage?: boolean;
  sessionStorage?: boolean;
  rpcUrl?: string;
  ipfsGateway?: string;
  ipfsService?: string;
  momStorageType?: "gun" | "ipfs";
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
  getAddressString(): string;
}

export interface ShogunEvents {
  error: (data: { action: string; message: string }) => void;
  "auth:signup": (data: { username: string; userPub: string }) => void;
  "auth:login": (data: { username: string; userPub: string }) => void;
  "auth:logout": (data: Record<string, never>) => void;
}


