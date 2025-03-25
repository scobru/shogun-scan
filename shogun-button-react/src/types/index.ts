export interface ShogunConnectorOptions {
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
} 