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

/**
 * Configurazione di un canale di pagamento
 */
export interface ChannelConfig {
  /** Identificatore univoco del canale */
  channelId: string;
  /** Indirizzo Ethereum del creatore del canale */
  creatorAddress: string;
  /** Indirizzo Ethereum della controparte */
  counterpartyAddress: string;
  /** Deposito iniziale in wei */
  initialDeposit: string;
  /** Timestamp di creazione del canale */
  createdAt: number;
  /** Periodo di timeout per le dispute in secondi */
  timeoutPeriod: number;
  /** Indirizzo dello smart contract */
  contractAddress: string;
}

/**
 * Stato corrente di un canale di pagamento
 */
export interface ChannelState {
  /** Identificatore univoco del canale */
  channelId: string;
  /** Saldo corrente in wei (quanto rimane al creatore) */
  balance: string;
  /** Numero di sequenza per prevenire replay attack */
  nonce: number;
  /** Firma del creatore sullo stato corrente */
  creatorSignature?: string;
  /** Firma della controparte sullo stato corrente */
  counterpartySignature?: string;
  /** Timestamp dell'ultimo aggiornamento */
  lastUpdated: number;
  /** Stato del canale */
  status: 'open' | 'closing' | 'disputed' | 'closed';
}

/**
 * Risultato di un'operazione sul canale di pagamento
 */
export interface ChannelResult {
  /** Indica se l'operazione ha avuto successo */
  success: boolean;
  /** Messaggio di errore in caso di fallimento */
  error?: string;
  /** Stato del canale dopo l'operazione */
  state?: ChannelState;
  /** ID della transazione Ethereum (se applicabile) */
  txHash?: string;
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

/**
 * Configurazione per WebAuthn
 */
export interface WebauthnConfig {
  /** Abilita WebAuthn */
  enabled?: boolean;
  /** Nome dell'entità di verifica */
  rpName?: string;
  /** ID dell'entità di verifica */
  rpId?: string;
}

/**
 * Configurazione dell'SDK Shogun
 */
export interface ShogunSDKConfig {
  /** Configurazione GunDB */
  gundb?: {
    /** Lista dei peer da utilizzare */
    peers: string[];
  };
  /** Lista dei peer da utilizzare (deprecato, usa gundb.peers) */
  peers?: string[];
  /** Abilita websocket */
  websocket?: boolean;
  /** URL del provider Ethereum */
  providerUrl?: string;
  /** Indirizzo del contratto per i canali di pagamento */
  paymentChannelContract?: string;
  /** Abilita il radisk per lo storage su disco */
  radisk?: boolean;
  /** Abilita localStorage */
  localStorage?: boolean;
  /** Autorità di stato */
  stateAuthority?: string;
  /** Configurazione WebAuthn */
  webauthn?: WebauthnConfig;
  /** Configurazione per MetaMask */
  metamask?: {
    /** Abilita MetaMask */
    enabled?: boolean;
  };
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


