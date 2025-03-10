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
      log("Evento auth ricevuto:", ack);
      if (ack.err) {
        logError("Errore di autenticazione:", ack.err);
      } else {
        this.notifyAuthListeners(ack.sea?.pub || "");
      }
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
   * Registra un nuovo utente
   * @param username - Nome utente
   * @param password - Password
   * @returns Promise che risolve con la chiave pubblica dell'utente
   */
  async signUp(username: string, password: string): Promise<any> {
    try {
      log("Tentativo di registrazione utente:", username);
      
      return new Promise((resolve) => {
        this.gun.user().create(username, password, async (ack: any) => {
          if (ack.err) {
            logError(`Errore registrazione: ${ack.err}`);
            resolve({ success: false, error: ack.err });
            return;
          }

          // Effettua il login automatico dopo la registrazione
          const loginResult = await this.login(username, password);
          
          if (loginResult.success) {
            log("Registrazione e login completati con successo");
          } else {
            logError("Registrazione completata ma login fallito");
          }
          
          resolve(loginResult);
        });
      });
    } catch (error) {
      logError("Errore durante la registrazione:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto"
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
      log("Tentativo di login per:", username);
      
      return new Promise((resolve) => {
        this.gun.user().auth(username, password, (ack: any) => {
          if (ack.err) {
            logError(`Errore login: ${ack.err}`);
            resolve({ 
              success: false, 
              error: ack.err 
            });
            return;
          }

          const user = this.gun.user();
          if (!user.is) {
            resolve({
              success: false,
              error: "Login fallito: utente non autenticato"
            });
            return;
          }

          log("Login completato con successo");
          resolve({
            success: true,
            userPub: user.is.pub,
            username
          });
        });
      });
    } catch (error) {
      logError("Errore durante il login:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto"
      };
    }
  }

  /**
   * Effettua il logout dell'utente corrente
   */
  logout(): void {
    try {
      log("Tentativo di logout");
      this.gun.user().leave();
      log("Logout completato");
    } catch (error) {
      logError("Errore durante il logout:", error);
    }
  }

  /**
   * Verifica se c'è un utente attualmente autenticato
   * @returns true se un utente è autenticato
   */
  isLoggedIn(): boolean {
    const user = this.gun.user();
    return !!(user && user.is && user.is.pub);
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
