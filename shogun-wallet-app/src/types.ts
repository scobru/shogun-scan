export * from './types/index';

// Tipo per le opzioni di configurazione del connettore Shogun
export type ShogunConnectorOptions = {
  appName: string;
  appDescription?: string;
  appUrl?: string;
  appIcon?: string;
  showMetamask?: boolean;
  showWebauthn?: boolean;
  darkMode?: boolean;
  websocketSecure?: boolean; // Nuova opzione per controllare se usare wss:// o ws://
};

// Interfaccia per le chiavi stealth
export interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
  // Campi opzionali per retrocompatibilità
  privateKey?: string;
  publicKey?: string;
} 