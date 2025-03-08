/**
 * Funzione di utilità per il log
 * @param message - Messaggio da loggare
 * @param args - Argomenti aggiuntivi
 */
export function log(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
    console.log(`[ShogunSDK] ${message}`, ...args);
  }
}

/**
 * Funzione di utilità per il log di errori
 * @param message - Messaggio di errore da loggare
 * @param args - Argomenti aggiuntivi, inclusi eventuali oggetti Error
 */
export function logError(message: string, ...args: any[]) {
  // Logga sempre gli errori, indipendentemente dall'ambiente
  console.error(`[ShogunSDK] ERRORE: ${message}`, ...args);
}

/**
 * Funzione di utilità per il log di avvisi
 * @param message - Messaggio di avviso da loggare
 * @param args - Argomenti aggiuntivi
 */
export function logWarning(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
    console.warn(`[ShogunSDK] AVVISO: ${message}`, ...args);
  }
}

/**
 * Funzione di utilità per il log di debug
 * @param message - Messaggio di debug da loggare
 * @param args - Argomenti aggiuntivi
 */
export function logDebug(message: string, ...args: any[]) {
  if (process.env.DEBUG === "true") {
    console.debug(`[ShogunSDK] DEBUG: ${message}`, ...args);
  }
}
