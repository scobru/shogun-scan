import { ShogunCore } from "shogun-core";
import { ShogunConnectorOptions } from "../types";

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
}: ShogunConnectorOptions) {
  // Configurazione dell'SDK Shogun
  const config = {
    // Configurazione principale per gun 
    peers: ["http://localhost:8765/gun"],

    // Configurazione WebSocket
    websocket: websocketSecure, // Convertito in booleano
    
    // Sottoconfigurazioni opzionali per Gun
    gundb: {
      peers: ["http://localhost:8765/gun"],
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
      darkMode
    }
  };
}

export { shogunConnector };
