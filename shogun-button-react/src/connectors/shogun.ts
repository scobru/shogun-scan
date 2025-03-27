import { ShogunCore } from "shogun-core";
import { ShogunConnectorOptions, ShogunConnectorResult } from "../types/connector-options";

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
}: ShogunConnectorOptions): ShogunConnectorResult {
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
  
  // Memorizziamo l'URL del provider corrente
  let currentProviderUrl = providerUrl;

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
    },
    // Aggiunti metodi helper per funzionalità comuni
    setProvider: (provider: any) => {
      // Metodo di compatibilità per i cambiamenti in shogun-core
      // Questo metodo è utilizzato quando l'app cambia il provider RPC
      try {
        let newProviderUrl: string | null = null;
        
        // Se è un provider ethers, estraiamo l'URL
        if (provider && provider.connection && provider.connection.url) {
          newProviderUrl = provider.connection.url;
        } 
        // Se è una stringa, utilizziamola direttamente come URL
        else if (typeof provider === 'string') {
          newProviderUrl = provider;
        }
        
        if (newProviderUrl) {
          // Memorizziamo il nuovo URL del provider
          currentProviderUrl = newProviderUrl;
          
          // Utilizziamo il metodo setRpcUrl di ShogunCore
          if (typeof sdk.setRpcUrl === 'function') {
            const result = sdk.setRpcUrl(newProviderUrl);
            console.log(`Provider RPC aggiornato: ${newProviderUrl}, risultato: ${result}`);
            return result;
          } else {
            // Fallback nel caso in cui il metodo non sia disponibile
            console.log(`Provider URL salvato: ${newProviderUrl}, ma non applicato (metodo setRpcUrl non disponibile)`);
          }
          
          return true;
        }
        
        return false;
      } catch (error) {
        console.error("Errore nell'impostazione del provider:", error);
        return false;
      }
    },
    // Metodo per ottenere l'URL del provider corrente
    getCurrentProviderUrl: () => {
      // Prima proviamo ad utilizzare il metodo di ShogunCore
      if (typeof sdk.getRpcUrl === 'function') {
        const url = sdk.getRpcUrl();
        if (url) return url;
      }
      // Fallback alla variabile locale
      return currentProviderUrl;
    }
  };
}

export { shogunConnector };
