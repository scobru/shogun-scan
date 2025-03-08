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