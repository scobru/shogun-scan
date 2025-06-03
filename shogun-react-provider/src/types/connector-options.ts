import { ShogunCore } from "shogun-core";

export interface ShogunConnectorOptions {
  // App information
  appName: string;
  appDescription?: string;
  appUrl?: string;
  appIcon?: string;
  
  // Feature toggles
  showMetamask?: boolean;
  showWebauthn?: boolean;
  darkMode?: boolean;
  
  // Network configuration
  websocketSecure?: boolean;
  didRegistryAddress?: string | null;
  providerUrl?: string | null;
  peers?: string[];
  authToken?: string;
  
  // Advanced options (directly mapped to ShogunSDKConfig)
  logging?: {
    enabled: boolean;
    level: "error" | "warning" | "info" | "debug";
  };
  timeouts?: {
    login?: number;
    signup?: number;
    operation?: number;
  };
}

// Definisco un nuovo tipo per l'oggetto ritornato dal connettore
export interface ShogunConnectorResult {
  sdk: ShogunCore;
  options: ShogunConnectorOptions;
  
  // Helper methods
  setProvider: (provider: any) => boolean;
  getCurrentProviderUrl: () => string | null;
  
  // Nuovi metodi per la gestione dei plugin
  registerPlugin: (plugin: any) => boolean;
  hasPlugin: (name: string) => boolean;
} 