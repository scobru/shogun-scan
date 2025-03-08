/**
 * Definizione dei tipi per Gun e SEA
 */

/**
 * Interfaccia per un riferimento a una catena Gun
 */
export interface IGunChainReference<T = any> {
  /**
   * Ottiene un nodo specifico nella catena
   */
  get(path: string): IGunChainReference;

  /**
   * Mette dati in un nodo
   */
  put(data: any, callback?: (ack: any) => void, options?: any): IGunChainReference;

  /**
   * Ottiene il valore del nodo corrente una volta
   */
  once(callback: (data: T) => void): IGunChainReference;

  /**
   * Ottiene l'utente Gun
   */
  user(): IGunChainReference;
  user(pub?: string): IGunChainReference;

  /**
   * Recupera la sessione dell'utente
   */
  recall(options?: any, callback?: (ack: any) => void): IGunChainReference;

  /**
   * Effettua il logout dell'utente
   */
  leave(): void;

  /**
   * Accede all'utente
   */
  auth(username: string, password: string, callback?: (ack: any) => void, options?: any): IGunChainReference;
  auth(pair: IGunCryptoKeyPair, callback?: (ack: any) => void, options?: any): IGunChainReference;

  /**
   * Crea un nuovo utente
   */
  create(username: string, password: string, callback?: (ack: any) => void): IGunChainReference;
  create(username: string, password: any, pair: any, callback?: (ack: any) => void): IGunChainReference;

  /**
   * Elimina un utente
   */
  delete(username: string, password: string, callback?: (ack: any) => void): IGunChainReference;

  /**
   * Registra un evento
   */
  on(event: string, callback: (...args: any[]) => void): IGunChainReference;
  on(callback: (data: T) => void): IGunChainReference;
}

/**
 * Interfaccia per una coppia di chiavi crittografiche SEA
 */
export interface IGunCryptoKeyPair {
  /**
   * Chiave pubblica
   */
  pub: string;

  /**
   * Chiave pubblica cifrata
   */
  epub: string;

  /**
   * Chiave privata
   */
  priv?: string;

  /**
   * Chiave privata cifrata
   */
  epriv?: string;
}
