/**
 * Funzione di utilità per il log
 * @param message - Messaggio da loggare
 * @param args - Argomenti aggiuntivi
 */
export function log(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[ShogunSDK] ${message}`, ...args);
  }
} 