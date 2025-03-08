/**
 * GunDB - Classe ottimizzata con integrazione di Auth avanzata
 */
import Gun from "gun";
import "gun/sea";
import { IGunInstance } from "gun/types";
import CONFIG from "../config";
import { log, logError } from "../utils/logger";

// Configurazione di base per GunDB
interface GunDBOptions {
  peers?: string[];
  localStorage?: boolean;
  sessionStorage?: boolean;
  radisk?: boolean;
  multicast?: boolean;
  axe?: boolean;
}

/**
 * GunDB - Gestione semplificata di Gun con Auth avanzata
 *
 * Utilizza la classe Auth per una gestione ottimizzata dell'autenticazione
 */
class GunDB {
  public gun: IGunInstance<any>;
  private certificato: string | null = null;
  private onAuthCallbacks: Array<(user: any) => void> = [];

  /**
   * Inizializza GunDB con le opzioni specificate
   */
  constructor(options: GunDBOptions = {}) {
    log("Inizializzazione GunDB");
    log("Opzioni:", options);

    // Configura GunDB con le opzioni fornite
    this.gun = Gun({
      peers: options.peers || CONFIG.PEERS,
      localStorage: options.localStorage ?? false,
      radisk: options.radisk ?? false,
      multicast: options.multicast ?? false,
      axe: options.axe ?? false,
    });

    // Gestione degli eventi di autenticazione
    this.subscribeToAuthEvents();
  }

  /**
   * Sottoscrive agli eventi di autenticazione di Gun
   */
  private subscribeToAuthEvents() {
    this.gun.on("auth", (ack: any) => {
      this.notifyAuthListeners(ack.sea?.pub || "");
    });
  }

  /**
   * Notifica tutti i listener di autenticazione
   * @param pub - Chiave pubblica dell'utente autenticato
   */
  private notifyAuthListeners(pub: string): void {
    const user = this.gun.user();
    this.onAuthCallbacks.forEach((callback) => {
      callback(user);
    });
  }

  /**
   * Crea una nuova istanza GunDB con i peer specificati
   * @param peers - Array di URL peer
   * @returns Nuova istanza GunDB
   */
  static withPeers(peers: string[] = CONFIG.PEERS): GunDB {
    return new GunDB({ peers });
  }

  /**
   * Aggiunge un listener per eventi di autenticazione
   * @param callback - Funzione da chiamare quando l'utente si autentica
   * @returns Funzione per rimuovere il listener
   */
  onAuth(callback: (user: any) => void): () => void {
    this.onAuthCallbacks.push(callback);

    // Se l'utente è già autenticato, chiamiamo immediatamente il callback
    const user = this.gun.user();
    if (user && user.is) {
      callback(user);
    }

    // Restituiamo una funzione per rimuovere il listener
    return () => {
      const index = this.onAuthCallbacks.indexOf(callback);
      if (index !== -1) {
        this.onAuthCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Ottiene l'istanza Gun sottostante
   * @returns Istanza Gun
   */
  getGun(): IGunInstance<any> {
    return this.gun;
  }

  /**
   * Ottiene l'utente corrente
   * @returns Utente Gun o null se non autenticato
   */
  getUser(): any {
    return this.gun.user();
  }

  /**
   * Imposta un certificato per l'utente corrente
   * @param certificate - Certificato da utilizzare
   */
  setCertificate(certificate: string): void {
    this.certificato = certificate;
    const user = this.gun.user();
    user.get("trust").get("certificate").put(certificate);
  }

  /**
   * Ottiene il certificato dell'utente corrente
   * @returns Certificato o null se non disponibile
   */
  getCertificate(): string | null {
    return this.certificato;
  }

  /**
   * Verifica se un nome utente è disponibile
   * @param username - Nome utente da verificare
   * @returns Promise che risolve a true se il nome utente è disponibile, false altrimenti
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.gun.get(`~@${username}`).once((data: any) => {
        // Se data è null o undefined, l'utente non esiste
        resolve(data === null || data === undefined);
      });
    });
  }

  /**
   * Registra un nuovo utente
   * @param username - Nome utente
   * @param password - Password
   * @returns Promise che risolve con la chiave pubblica dell'utente
   */
  async signUp(username: string, password: string): Promise<any> {
    log("signUp", username, password);

    try {
      // Verifica se l'utente esiste già
      const isAvailable = await this.isUsernameAvailable(username);
      if (!isAvailable) {
        log(`L'utente ${username} esiste già`);
        return {
          success: false,
          error: "User already exists",
        };
      }

      log("create user", username, password);

      // Utilizziamo il metodo create di Gun con un timeout
      return new Promise((resolve, reject) => {
        // Imposta un timeout per evitare blocchi indefiniti
        const timeout = setTimeout(() => {
          log(`Timeout raggiunto durante la creazione dell'utente: ${username}`);
          resolve({
            success: false,
            error: "Timeout durante la creazione dell'utente",
          });
        }, 10000); // 10 secondi di timeout
        
        try {
          this.gun.user().create(username, password, (ack: any) => {
            log("create user ack", ack);
            
            if (ack.err) {
              clearTimeout(timeout);
              log(`Errore durante la creazione dell'utente: ${ack.err}`);
              resolve({
                success: false,
                error: ack.err,
              });
            } else {
              log(`Utente ${username} creato con successo, tentativo di login...`);
              
              // Imposta un nuovo timeout per l'operazione di login
              const loginTimeout = setTimeout(() => {
                clearTimeout(timeout); // Cancella il timeout precedente
                log(`Timeout raggiunto durante il login post-registrazione: ${username}`);
                resolve({
                  success: false,
                  error: "Timeout durante il login post-registrazione",
                });
              }, 10000); // 10 secondi di timeout
              
              // Dopo la creazione, eseguiamo il login
              try {
                this.gun.user().auth(username, password, (loginAck: any) => {
                  clearTimeout(loginTimeout);
                  clearTimeout(timeout);
                  
                  if (loginAck.err) {
                    log(`Errore durante il login post-registrazione: ${loginAck.err}`);
                    resolve({
                      success: false,
                      error: loginAck.err,
                    });
                  } else {
                    log("signUp success", loginAck.sea?.pub);
                    resolve({
                      success: true,
                      userPub: loginAck.sea?.pub,
                    });
                  }
                });
              } catch (authError) {
                clearTimeout(loginTimeout);
                clearTimeout(timeout);
                log(`Eccezione durante il login post-registrazione: ${authError}`);
                resolve({
                  success: false,
                  error: authError instanceof Error ? authError.message : "Errore durante il login post-registrazione",
                });
              }
            }
          });
        } catch (createError) {
          clearTimeout(timeout);
          log(`Eccezione durante la creazione dell'utente: ${createError}`);
          resolve({
            success: false,
            error: createError instanceof Error ? createError.message : "Errore durante la creazione dell'utente",
          });
        }
      });
    } catch (error) {
      console.error("Errore durante la registrazione:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore sconosciuto durante la registrazione",
      };
    }
  }

  /**
   * Effettua il login di un utente
   * @param username - Nome utente
   * @param password - Password
   * @returns Promise che risolve con il risultato del login
   */
  async login(username: string, password: string): Promise<any> {
    try {
      // Utilizziamo un approccio basato su promise per gestire correttamente l'autenticazione
      return new Promise((resolve) => {
        // Pulisci eventuali sessioni precedenti
        this.gun.user().leave();
        
        // Esegui l'autenticazione
        this.gun.user().auth(username, password, (ack: any) => {
          if (ack.err) {
            log(`Errore di autenticazione per ${username}: ${ack.err}`);
            resolve({
              success: false,
              error: ack.err,
            });
          } else {
            // Verifica che l'autenticazione sia effettivamente avvenuta
            const isAuth = this.isLoggedIn();
            log(`Login completato per ${username}, stato autenticazione: ${isAuth ? 'autenticato' : 'non autenticato'}`);
            
            if (!isAuth) {
              // Se non siamo autenticati nonostante il callback positivo, c'è un problema
              log("Login apparentemente riuscito ma utente non autenticato, tentativo di recupero...");
              
              // Aspetta un momento e riprova a verificare lo stato
              setTimeout(() => {
                const isAuthRetry = this.isLoggedIn();
                log(`Verifica autenticazione dopo recupero: ${isAuthRetry ? 'autenticato' : 'non autenticato'}`);
                
                if (isAuthRetry) {
                  resolve({
                    success: true,
                    userPub: this.gun.user().is?.pub,
                  });
                } else {
                  resolve({
                    success: false,
                    error: "Autenticazione non riuscita: gun.user().is non disponibile dopo il login",
                  });
                }
              }, 500); // Attendi 500ms per dare tempo a Gun di aggiornare lo stato
            } else {
              // Autenticazione riuscita normalmente
              resolve({
                success: true,
                userPub: ack.sea?.pub || this.gun.user().is?.pub,
              });
            }
          }
        });
      });
    } catch (error) {
      console.error("Errore durante il login:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore sconosciuto durante il login",
      };
    }
  }

  /**
   * Effettua il logout dell'utente corrente
   */
  logout(): void {
    this.gun.user()?.leave();
  }

  /**
   * Verifica se c'è un utente attualmente autenticato
   * @returns true se un utente è autenticato
   */
  isLoggedIn(): boolean {
    return !!this.gun.user()?.is?.pub;
  }

  /**
   * Ottiene l'utente correntemente autenticato
   * @returns Utente corrente o null se non autenticato
   */
  getCurrentUser(): any {
    const userPub = this.gun.user()?.is?.pub;
    if (!userPub) {
      return null;
    }
    return {
      pub: userPub,
      user: this.gun.user(),
    };
  }

  /**
   * Salva dati nel nodo dell'utente
   */
  async saveUserData(path: string, data: any): Promise<any> {
    if (!this.gun.user()?.is?.pub) {
      throw new Error("Utente non autenticato");
    }

    return new Promise((resolve, reject) => {
      const options = this.certificato
        ? { opt: { cert: this.certificato } }
        : undefined;

      this.gun
        .user()
        .get(path)
        .put(
          data,
          (ack: any) => {
            if (ack && ack.err) {
              logError(`Errore salvataggio dati: ${ack.err}`);
              reject(new Error(ack.err));
              return;
            }

            log(`Dati salvati in ${path}`);
            resolve(data);
          },
          options
        );
    });
  }

  /**
   * Recupera dati dal nodo dell'utente
   */
  async getUserData(path: string): Promise<any> {
    if (!this.gun.user()?.is?.pub) {
      throw new Error("Utente non autenticato");
    }

    return new Promise((resolve) => {
      this.gun
        .user()
        .get(path)
        .once((data) => {
          if (!data) {
            log(`Nessun dato trovato in ${path}`);
            resolve(null);
            return;
          }

          log(`Dati recuperati da ${path}`);
          resolve(data);
        });
    });
  }

  /**
   * Salva dati in un nodo pubblico
   */
  async savePublicData(node: string, key: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = this.certificato
        ? { opt: { cert: this.certificato } }
        : undefined;

      this.gun
        .get(node)
        .get(key)
        .put(
          data,
          (ack: any) => {
            if (ack && ack.err) {
              logError(`Errore salvataggio dati pubblici: ${ack.err}`);
              reject(new Error(ack.err));
              return;
            }

            log(`Dati pubblici salvati in ${node}/${key}`);
            resolve(data);
          },
          options
        );
    });
  }

  /**
   * Recupera dati da un nodo pubblico
   */
  async getPublicData(node: string, key: string): Promise<any> {
    return new Promise((resolve) => {
      this.gun
        .get(node)
        .get(key)
        .once((data) => {
          if (!data) {
            log(`Nessun dato pubblico trovato in ${node}/${key}`);
            resolve(null);
            return;
          }

          log(`Dati pubblici recuperati da ${node}/${key}`);
          resolve(data);
        });
    });
  }

  /**
   * Genera una nuova coppia di chiavi SEA
   */
  async generateKeyPair(): Promise<any> {
    // Utilizzo direttamente SEA.pair() invece di this.auth.generatePair()
    return (Gun as any).SEA.pair();
  }
}

// Rendi disponibile la classe globalmente
declare global {
  interface Window {
    GunDB: typeof GunDB;
  }
  namespace NodeJS {
    interface Global {
      GunDB: typeof GunDB;
    }
  }
}

if (typeof window !== "undefined") {
  window.GunDB = GunDB;
} else if (typeof global !== "undefined") {
  (global as any).GunDB = GunDB;
}

export { GunDB };
