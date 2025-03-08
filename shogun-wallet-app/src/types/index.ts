import { ethers } from "ethers";

export interface WalletInfo {
  wallet: ethers.Wallet;
  path: string;
  address: string;
  getAddressString: () => string;
}

export type AuthMethod = 
  | "standard"
  | "metamask_direct"
  | "metamask_saved"
  | "metamask_signup"
  | "standard_signup"
  | "webauthn"
  | "mnemonic";

export interface AuthResult {
  success: boolean;
  userPub?: string;
  error?: string;
  username?: string;
  wallet?: ethers.Wallet;
  authMethod?: AuthMethod;
}

export interface AutoLoginResult {
  success: boolean;
  userPub?: string;
  error?: string;
  registrationSuccess?: boolean;
  loginSuccess?: boolean;
}

export interface StealthKeyPair {
  privateKey: string;
  publicKey: string;
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

export interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  wallet?: ethers.Wallet;
}

export interface ConversationData {
  id: string;
  recipient: string;
  recipientType: string;
  recipientPubKey: string;
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  isCurrentUser: boolean;
}

export interface MessageConstants {
  mismatched: string;
  empty: string;
  exists: string;
  invalid: string;
  signedIn: {
    header: string;
    body: string;
  };
  signedOut: {
    header: string;
    body: string;
    instructions: string;
  };
  metamaskMessage: string;
  webauthnMessage: string;
}

export interface RpcOption {
  value: string;
  label: string;
  url: string;
}

export interface SearchResult {
  type: string;
  key: string;
  data: any;
  epub: string;
  username: string;
} 