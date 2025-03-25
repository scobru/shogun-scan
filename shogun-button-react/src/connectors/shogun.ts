import { ShogunCore } from "shogun-core";
import { ShogunConnectorOptions } from "../types/connector-options";

/**
 * Crea un connettore Shogun per l'autenticazione
 */
function shogunConnector({
  appName,
  appDescription,
  appUrl,
  appIcon,
  showMetamask = true,
  showWebauthn = true,
  darkMode = true,
  websocketSecure = false,
  didRegistryAddress = null,
  providerUrl = null,
  peers = ["http://localhost:8765/gun"]
}: ShogunConnectorOptions) {
  // Configurazione dell'SDK Shogun
  const config = {
    // Configurazione principale per gun 
    peers: peers,

    // Configurazione WebSocket
    websocket: websocketSecure, // Convertito in booleano
    
    // Sottoconfigurazioni opzionali per Gun
    gundb: {
      peers: peers,
      localStorage: false,
      radisk: false
    },
    
    // Configurazione dello storage
    storage: {
      prefix: appName || "shogun",
    },
    
    
    // Configurazione di MetaMask
    metamask: {
      enabled: showMetamask
    },
    
    // Configurazione di WebAuthn
    webauthn: {
      enabled: showWebauthn,
      rpName: appName || "Shogun App",
      rpId: typeof window !== 'undefined' ? window.location.hostname : ''
    },
    
    // Provider Ethereum per operazioni blockchain
    providerUrl: providerUrl,
    
    // Configurazione DID
    did: {
      registryAddress: didRegistryAddress || undefined,
      network: "main" // Valore predefinito
    }
  };

  // Inizializza l'SDK Shogun
  const sdk = new ShogunCore(config);

  return {
    sdk,
    options: {
      appName,
      appDescription,
      appUrl,
      appIcon,
      showMetamask,
      showWebauthn,
      darkMode,
      websocketSecure,
      didRegistryAddress,
      providerUrl,
      peers
    }
  };
}

export { shogunConnector };
