import { IGunInstance } from "gun/types";
import { ethers } from "ethers";
import { record } from "ts-minimal";

// Dichiarazioni dei tipi per i moduli esterni
type Webauthn = any;
type MetaMask = any;
type Stealth = any;
type GunDB = any;

// Definizione schemi per i risultati di autenticazione
const AuthResultSchema = record<{
  success: boolean;
  userPub?: string;
  wallet?: any;
  username?: string;
  error?: string;
  credentialId?: string;
  password?: string;
}>({
  success: Boolean,
  userPub: String,
  wallet: Object,
  username: String,
  error: String,
  credentialId: String,
  password: String
});

export type AuthResult = Parameters<typeof AuthResultSchema>[0];

const SignUpResultSchema = record<{
  success: boolean;
  userPub?: string;
  pub?: string;
  error?: string;
  message?: string;
  wallet?: any;
}>({
  success: Boolean,
  userPub: String,
  pub: String,
  error: String,
  message: String,
  wallet: Object
});

export type SignUpResult = Parameters<typeof SignUpResultSchema>[0];

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

const ShogunSDKConfigSchema = record<{
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
}>({
  gunPeers: Array,
  localStorage: Boolean,
  sessionStorage: Boolean,
  rpcUrl: String,
  ipfsGateway: String,
  ipfsService: String,
  momStorageType: String,
  peers: Array,
  gundb: Object,
  websocket: Object,
  storage: Object,
  axe: Boolean,
  multicast: Boolean
});

export type ShogunSDKConfig = Parameters<typeof ShogunSDKConfigSchema>[0];

const WalletInfoSchema = record<{
  wallet: any;
  path: string;
  address: string;
  getAddressString: () => string;
}>({
  wallet: Object,
  path: String,
  address: String,
  getAddressString: Function
});

export type WalletInfo = Parameters<typeof WalletInfoSchema>[0];

const ShogunEventsSchema = record<{
  error: (data: { action: string; message: string }) => void;
  "auth:signup": (data: { username: string; userPub: string }) => void;
  "auth:login": (data: { username: string; userPub: string }) => void;
  "auth:logout": (data: Record<string, never>) => void;
}>({
  error: Function,
  "auth:signup": Function,
  "auth:login": Function,
  "auth:logout": Function
});

export type ShogunEvents = Parameters<typeof ShogunEventsSchema>[0];

// Esporta gli schemi per l'utilizzo in altre parti dell'applicazione
export {
  AuthResultSchema,
  SignUpResultSchema,
  ShogunSDKConfigSchema,
  WalletInfoSchema,
  ShogunEventsSchema
};


