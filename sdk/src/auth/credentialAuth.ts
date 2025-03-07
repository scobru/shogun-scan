import { log } from "../utils/logger";
import { GunDB } from "../gun/gun";
import { Storage } from "../storage/storage";
import { AuthResult } from "../types/shogun";

/**
 * Classe che gestisce l'autenticazione con credenziali (username/password)
 */
export class CredentialAuth {
  private gundb: GunDB;
  private gun: any;
  private storage: Storage;
  private hedgehog: any;

  constructor(gundb: GunDB, gun: any, storage: Storage, hedgehog: any) {
    this.gundb = gundb;
    this.gun = gun;
    this.storage = storage;
    this.hedgehog = hedgehog;
  }

  /**
   * Crea un risultato di autenticazione
   * @param success - Indica se l'autenticazione è riuscita
   * @param data - Dati aggiuntivi
   * @returns Risultato dell'autenticazione
   */
  private createAuthResult(success: boolean, data: any = {}): AuthResult {
    return {
      success,
      ...data,
    };
  }

  /**
   * Gestisce il login con credenziali
   * @param username - Nome utente
   * @param password - Password
   * @param options - Opzioni aggiuntive
   * @returns Risultato del login
   */
  async handleLogin(
    username: string,
    password: string,
    options: {
      setUserpub?: (pub: string) => void;
      setSignedIn?: (signedIn: boolean) => void;
    } = {}
  ): Promise<AuthResult> {
    try {
      log("Tentativo di login con credenziali:", username);
      
      // Verifica se le credenziali sono valide
      if (!username || !password) {
        return this.createAuthResult(false, {
          error: "Username e password sono richiesti",
        });
      }
      
      // Autentica l'utente con GunDB
      try {
        await this.gundb.authenticateGunUser(username, password);
      } catch (authError) {
        log("Errore durante l'autenticazione con GunDB:", authError);
        return this.createAuthResult(false, {
          error: "Credenziali non valide",
        });
      }
      
      // Autentica l'utente con Hedgehog
      try {
        await this.hedgehog.authenticate(username, password);
      } catch (hedgehogError) {
        log("Errore durante l'autenticazione con Hedgehog:", hedgehogError);
        // Continua comunque, poiché l'autenticazione con GunDB è riuscita
      }
      
      const userPub = this.gun.user().is?.pub;
      
      // Aggiorna lo stato dell'utente
      if (options.setUserpub && userPub) {
        options.setUserpub(userPub);
      }
      
      if (options.setSignedIn) {
        options.setSignedIn(true);
      }
      
      return this.createAuthResult(true, {
        userPub,
        username,
      });
    } catch (error) {
      log("Errore durante il login con credenziali:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Errore durante il login",
      });
    }
  }

  /**
   * Gestisce la registrazione con credenziali
   * @param username - Nome utente
   * @param password - Password
   * @param passwordConfirmation - Conferma della password
   * @param options - Opzioni aggiuntive
   * @returns Risultato della registrazione
   */
  async handleSignUp(
    username: string,
    password: string,
    passwordConfirmation: string,
    options: {
      setErrorMessage?: (message: string) => void;
      setUserpub?: (pub: string) => void;
      setSignedIn?: (signedIn: boolean) => void;
      messages?: { [key: string]: string };
    } = {}
  ): Promise<AuthResult> {
    try {
      log("Tentativo di registrazione con credenziali:", username);
      
      // Verifica se le credenziali sono valide
      if (!username || !password) {
        const errorMessage = options.messages?.emptyFields || "Username e password sono richiesti";
        if (options.setErrorMessage) {
          options.setErrorMessage(errorMessage);
        }
        return this.createAuthResult(false, {
          error: errorMessage,
        });
      }
      
      // Verifica se le password corrispondono
      if (password !== passwordConfirmation) {
        const errorMessage = options.messages?.passwordMismatch || "Le password non corrispondono";
        if (options.setErrorMessage) {
          options.setErrorMessage(errorMessage);
        }
        return this.createAuthResult(false, {
          error: errorMessage,
        });
      }
      
      // Crea un utente GUN
      try {
        await this.gundb.createGunUser(username, password);
      } catch (gunError) {
        if (gunError instanceof Error && gunError.message.includes("User already created")) {
          const errorMessage = options.messages?.userExists || "L'utente esiste già";
          if (options.setErrorMessage) {
            options.setErrorMessage(errorMessage);
          }
          return this.createAuthResult(false, {
            error: errorMessage,
          });
        } else {
          throw gunError;
        }
      }
      
      // Autentica l'utente con GunDB
      await this.gundb.authenticateGunUser(username, password);
      
      // Crea un utente Hedgehog
      try {
        await this.hedgehog.create(username, password);
      } catch (hedgehogError) {
        log("Errore durante la creazione dell'utente Hedgehog:", hedgehogError);
        // Continua comunque, poiché l'autenticazione con GunDB è riuscita
      }
      
      const userPub = this.gun.user().is?.pub;
      
      // Aggiorna lo stato dell'utente
      if (options.setUserpub && userPub) {
        options.setUserpub(userPub);
      }
      
      if (options.setSignedIn) {
        options.setSignedIn(true);
      }
      
      return this.createAuthResult(true, {
        userPub,
        username,
      });
    } catch (error) {
      log("Errore durante la registrazione con credenziali:", error);
      const errorMessage = error instanceof Error ? error.message : "Errore durante la registrazione";
      if (options.setErrorMessage) {
        options.setErrorMessage(errorMessage);
      }
      return this.createAuthResult(false, {
        error: errorMessage,
      });
    }
  }

  /**
   * Effettua il login con credenziali
   * @param username - Nome utente
   * @param password - Password
   * @returns Risultato del login
   */
  async loginWithCredentials(username: string, password: string): Promise<AuthResult> {
    try {
      log("Tentativo di login con credenziali:", username);
      
      // Verifica se le credenziali sono valide
      if (!username || !password) {
        return this.createAuthResult(false, {
          error: "Username e password sono richiesti",
        });
      }
      
      // Autentica l'utente con GunDB
      try {
        await this.gundb.authenticateGunUser(username, password);
      } catch (authError) {
        log("Errore durante l'autenticazione con GunDB:", authError);
        return this.createAuthResult(false, {
          error: "Credenziali non valide",
        });
      }
      
      // Autentica l'utente con Hedgehog
      try {
        await this.hedgehog.authenticate(username, password);
      } catch (hedgehogError) {
        log("Errore durante l'autenticazione con Hedgehog:", hedgehogError);
        // Continua comunque, poiché l'autenticazione con GunDB è riuscita
      }
      
      const userPub = this.gun.user().is?.pub;
      
      return this.createAuthResult(true, {
        userPub,
        username,
      });
    } catch (error) {
      log("Errore durante il login con credenziali:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Errore durante il login",
      });
    }
  }
} 