/**
 * Definizione dei tipi per le funzionalità di autenticazione
 */
import { IGunCryptoKeyPair } from "./gun";

/**
 * Credenziali utente
 */
export interface UserCredentials {
  /**
   * Nome utente
   */
  alias: string;

  /**
   * Password
   */
  pass: string;
}

/**
 * Opzioni base per le operazioni di autenticazione
 */
export interface AuthBasicOptions {
  /**
   * Timeout in millisecondi
   */
  timeout?: number;

  /**
   * Opzioni per la memorizzazione della sessione
   */
  sessionStorage?: boolean;
  
  /**
   * Timeout per verificare l'esistenza di un utente
   */
  existsTimeout?: number;
}

/**
 * Delegato per la memorizzazione personalizzata
 */
export interface AuthDelegate {
  /**
   * Memorizza una coppia di chiavi
   */
  storePair?: (pair: IGunCryptoKeyPair, auth: any) => Promise<void> | void;

  /**
   * Recupera una coppia di chiavi
   */
  recallPair?: (
    auth: any,
    opts?: any
  ) => Promise<IGunCryptoKeyPair | undefined> | (IGunCryptoKeyPair | undefined);
}
  