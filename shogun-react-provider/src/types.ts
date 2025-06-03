// Re-export connector options from the connector-options.ts file
export * from './types/connector-options.js';

// Tipo per le opzioni di configurazione del connettore Shogun
// Deprecated - use ShogunConnectorOptions from connector-options.ts
export type ShogunConnectorOptions = {
  appName: string;
  appDescription?: string;
  appUrl?: string;
  appIcon?: string;
  showMetamask?: boolean;
  showWebauthn?: boolean;
  darkMode?: boolean;
  websocketSecure?: boolean;
  didRegistryAddress?: string | null;
  providerUrl?: string | null;
  peers?: string[];
  authToken?: string;
};
