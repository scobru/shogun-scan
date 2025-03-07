import { log } from "../utils/logger";
import { GunDB } from "../gun/gun";
import { Storage } from "../storage/storage";
import { Webauthn } from "../webauthn/webauthn";
import { AuthResult } from "../types/shogun";

/**
 * Classe che gestisce l'autenticazione con WebAuthn
 */
export class WebAuthnAuth {
  private gundb: GunDB;
  private gun: any;
  private storage: Storage;
  private webauthn: Webauthn;

  constructor(gundb: GunDB, gun: any, storage: Storage, webauthn: Webauthn) {
    this.gundb = gundb;
    this.gun = gun;
    this.storage = storage;
    this.webauthn = webauthn;
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
   * Verifica se WebAuthn è supportato
   * @returns true se WebAuthn è supportato, false altrimenti
   */
  isWebAuthnSupported(): boolean {
    try {
      return this.webauthn ? this.webauthn.isSupported() : false;
    } catch (error) {
      log("Errore durante la verifica del supporto WebAuthn:", error);
      return false;
    }
  }

  /**
   * Effettua il login con WebAuthn
   * @param username - Nome utente
   * @returns Risultato del login
   */
  async loginWithWebAuthn(username: string): Promise<AuthResult> {
    try {
      log("Tentativo di login con WebAuthn:", username);
      
      if (!this.webauthn) {
        return this.createAuthResult(false, {
          error: "WebAuthn non supportato",
        });
      }
      
      // Verifica se WebAuthn è supportato
      if (!this.isWebAuthnSupported()) {
        return this.createAuthResult(false, {
          error: "WebAuthn non è supportato dal browser",
        });
      }
      
      // Recupera le credenziali WebAuthn
      const credentials = await this.getWebAuthnCredentials(username);
      const salt = credentials ? credentials.salt : null;
      
      // Effettua il login con WebAuthn
      const result = await this.webauthn.authenticateUser(username, salt);
      
      if (!result.success) {
        return this.createAuthResult(false, {
          error: result.error || "Errore durante il login con WebAuthn",
        });
      }
      
      // Autentica l'utente con GunDB
      try {
        await this.gundb.authenticateGunUser(username, result.password || '');
      } catch (authError) {
        log("Errore durante l'autenticazione con GunDB:", authError);
        return this.createAuthResult(false, {
          error: "Errore durante l'autenticazione con GunDB",
        });
      }
      
      const userPub = this.gun.user().is?.pub;
      
      return this.createAuthResult(true, {
        userPub,
        username,
        credentialId: result.credentialId,
      });
    } catch (error) {
      log("Errore durante il login con WebAuthn:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Errore durante il login con WebAuthn",
      });
    }
  }

  /**
   * Registra un nuovo utente con WebAuthn
   * @param username - Nome utente
   * @returns Risultato della registrazione
   */
  async registerWithWebAuthn(username: string): Promise<AuthResult> {
    try {
      log("Tentativo di registrazione con WebAuthn:", username);
      
      if (!this.webauthn) {
        return this.createAuthResult(false, {
          error: "WebAuthn non supportato",
        });
      }
      
      // Verifica se WebAuthn è supportato
      if (!this.isWebAuthnSupported()) {
        return this.createAuthResult(false, {
          error: "WebAuthn non è supportato dal browser",
        });
      }
      
      // Registra l'utente con WebAuthn
      const result = await this.webauthn.createAccount(username, null);
      
      if (!result.success) {
        return this.createAuthResult(false, {
          error: result.error || "Errore durante la registrazione con WebAuthn",
        });
      }
      
      // Crea un utente GUN
      try {
        await this.gundb.createGunUser(username, result.password || '');
      } catch (gunError) {
        if (gunError instanceof Error && gunError.message.includes("User already created")) {
          log("Utente GUN già esistente, tentativo di autenticazione...");
        } else {
          throw gunError;
        }
      }
      
      // Autentica l'utente con GunDB
      await this.gundb.authenticateGunUser(username, result.password || '');
      
      const userPub = this.gun.user().is?.pub;
      
      // Salva le credenziali WebAuthn
      if (result.webAuthnCredentials) {
        await this.saveWebAuthnCredentials(username, result.webAuthnCredentials);
      }
      
      return this.createAuthResult(true, {
        userPub,
        username,
        credentialId: result.credentialId,
      });
    } catch (error) {
      log("Errore durante la registrazione con WebAuthn:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Errore durante la registrazione con WebAuthn",
      });
    }
  }

  /**
   * Recupera le credenziali WebAuthn
   * @param username - Nome utente
   * @returns Credenziali WebAuthn o null se non trovate
   */
  private async getWebAuthnCredentials(username: string): Promise<any | null> {
    try {
      const credentialsJson = this.storage.getItem(`webauthn_${username}`);
      return credentialsJson ? JSON.parse(credentialsJson) : null;
    } catch (error) {
      log("Errore durante il recupero delle credenziali WebAuthn:", error);
      return null;
    }
  }

  /**
   * Salva le credenziali WebAuthn
   * @param username - Nome utente
   * @param credentials - Credenziali WebAuthn
   */
  private async saveWebAuthnCredentials(username: string, credentials: any): Promise<void> {
    try {
      this.storage.setItem(`webauthn_${username}`, JSON.stringify(credentials));
    } catch (error) {
      log("Errore durante il salvataggio delle credenziali WebAuthn:", error);
    }
  }
} 