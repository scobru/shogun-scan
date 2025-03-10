import { ShogunSDK } from "@shogun/shogun-core";
import  { HDNodeWallet } from "ethers";

// Estendi i tipi dall'SDK di Shogun per risolvere i problemi di compatibilità

// Estendere il tipo MetaMask per includere i possibili metodi per ottenere l'indirizzo
declare module "@shogun/shogun-core" {
  interface MetaMask {
    getEthereumAddress?: () => Promise<string>;
    getAddress?: () => Promise<string>;
    connect?: () => Promise<string>;
  }

  // Estendere i tipi dei risultati di autenticazione
  interface AuthResult {
    success: boolean;
    userPub?: string;
    publicKey?: string;
    wallet?: HDNodeWallet;
    error?: string;
  }

  interface SignUpResult {
    success: boolean;
    userPub?: string;
    publicKey?: string;
    wallet?: HDNodeWallet;
    error?: string;
  }

  // Estendere il tipo ShogunSDKConfig per essere sicuri che accetti la configurazione corretta
  interface ShogunSDKConfig {
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
    hedgehog?: any;
    metamask?: {
      enabled?: boolean;
    };
    webauthn?: {
      enabled?: boolean;
      rpName?: string;
      rpId?: string;
    };
    axe?: boolean;
    multicast?: boolean;
  }
}

// Tipo per le opzioni di configurazione del connettore Shogun
export type ShogunConnectorOptions = {
  appName: string;
  appDescription?: string;
  appUrl?: string;
  appIcon?: string;
  showMetamask?: boolean;
  showWebauthn?: boolean;
  darkMode?: boolean;
  websocketSecure?: boolean;
};
