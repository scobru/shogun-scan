/**
 * Entry point per la versione browser di Shogun Core
 */
import { ShogunCore } from "./index";
import { ShogunSDKConfig } from "./types/shogun";

/**
 * Funzione per inizializzare Shogun in un ambiente browser
 * 
 * @param config - Configurazione per l'SDK Shogun
 * @returns Una nuova istanza di ShogunCore
 */
export function initShogunBrowser(config: ShogunSDKConfig): ShogunCore {
  // Applica impostazioni predefinite per il browser
  const browserConfig: ShogunSDKConfig = {
    ...config,
    // Assicuriamoci che le impostazioni predefinite per browser siano applicate
    localStorage: config.localStorage ?? true,
    radisk: config.radisk ?? true,
    // Impostazioni specifiche per WebAuthn (se non specificate)
    webauthn: {
      ...config.webauthn,
      rpId: config.webauthn?.rpId || window.location.hostname,
      enabled: config.webauthn?.enabled ?? true,
    }
  };

  // Crea una nuova istanza di ShogunCore con la configurazione ottimizzata per browser
  return new ShogunCore(browserConfig);
}

// Esporta la classe principale per chi preferisce usarla direttamente
export { ShogunCore };

// Esporta anche i tipi principali
export * from "./types/shogun";

// Per supportare l'uso come variabile globale in caso di inclusione via <script>
if (typeof window !== 'undefined') {
  (window as any).ShogunCore = ShogunCore;
  (window as any).initShogunBrowser = initShogunBrowser;
} 