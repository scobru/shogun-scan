import { GunDB } from "./gun/gun";
import { Webauthn } from "./webauthn/webauthn";
import { MetaMask } from "./connector/metamask";
import { Stealth } from "./stealth/stealth";
import { EventEmitter } from "events";
import { Storage } from "./storage/storage";
import {
  IShogunSDK,
  ShogunSDKConfig,
  AuthResult,
  SignUpResult,
  WalletInfo,
} from "./types/shogun";
import { IGunInstance } from "gun/types/gun";
import { log, logError, logWarning } from "./utils/logger";
import { WalletManager } from "./wallet/walletManager";
import CONFIG from "./config";
import { ethers } from "ethers";

let gun: any;

export class ShogunSDK implements IShogunSDK {
  public gun: IGunInstance<any>;
  public gundb: GunDB;
  public webauthn: Webauthn;
  public metamask: MetaMask;
  public stealth: Stealth;
  private storage: Storage;
  private eventEmitter: EventEmitter;
  private walletManager: WalletManager;

  /**
   * Inizializza l'SDK Shogun
   * @param config - Configurazione dell'SDK
   */
  constructor(config: ShogunSDKConfig) {
    log("Inizializzazione di ShogunSDK");

    this.storage = new Storage();

    this.eventEmitter = new EventEmitter();

    const gundbConfig = {
      peers: config.gundb?.peers || config.peers || CONFIG.PEERS,
      websocket: config.websocket,
      localStorage: false,
      radisk: false,
    };

    this.gundb = new GunDB(gundbConfig);
    this.gun = this.gundb.getGun();

    this.webauthn = new Webauthn();
    this.metamask = new MetaMask();
    this.stealth = new Stealth();

    this.walletManager = new WalletManager(this.gundb, this.gun, this.storage);

    log("ShogunSDK initialized!");
  }

  /**
   * Verifica se l'utente è loggato
   * @returns true se l'utente è loggato, false altrimenti
   */
  isLoggedIn(): boolean {
    const gunLoggedIn = this.gundb.isLoggedIn();

    if (gunLoggedIn) {
      return true;
    }

    const gunUser = this.gun.user();
    // @ts-ignore - Accesso a proprietà interna di Gun non completamente tipizzata
    const hasPair = gunUser && gunUser._ && gunUser._.sea;

    const hasLocalPair = this.storage.getItem("pair");

    return gunLoggedIn || !!hasPair || !!hasLocalPair;
  }

  /**
   * Effettua il logout
   */
  logout(): void {
    try {
      if (!this.isLoggedIn()) {
        log("Logout ignorato: utente non autenticato");
        return;
      }

      this.gundb.logout();

      this.eventEmitter.emit("auth:logout", {});

      log("Logout completato con successo");
    } catch (error) {
      logError("Errore durante il logout:", error);
      this.eventEmitter.emit("error", {
        action: "logout",
        message:
          error instanceof Error ? error.message : "Errore durante il logout",
      });
    }
  }

  /**
   * Autentica un utente con username e password
   * @param username - Nome utente
   * @param password - Password dell'utente
   * @returns Promise con il risultato dell'autenticazione
   */
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      const result = await this.gundb.login(username, password);

      if (result.success) {
        log(`Login riuscito per l'utente: ${username}`);

        this.eventEmitter.emit("auth:login", {
          userPub: result.userPub || "",
        });
      } else {
        logError(`Login fallito per l'utente: ${username}: ${result.error}`);
      }

      return result;
    } catch (error: any) {
      logError(`Errore durante il login per l'utente: ${username}`, error);
      return {
        success: false,
        error: error.message || "Errore sconosciuto durante il login",
      };
    }
  }

  /**
   * Registra un nuovo utente con le credenziali fornite
   * @param username - Nome utente
   * @param password - Password
   * @param passwordConfirmation - Conferma password
   * @returns Risultato della registrazione
   */
  async signUp(
    username: string,
    password: string,
    passwordConfirmation?: string
  ): Promise<SignUpResult> {
    try {
      if (
        passwordConfirmation !== undefined &&
        password !== passwordConfirmation
      ) {
        return {
          success: false,
          error: "Le password non corrispondono",
        };
      }

      if (password.length < 6) {
        return {
          success: false,
          error: "La password deve contenere almeno 6 caratteri",
        };
      }

      const result = await this.gundb.signUp(username, password);

      if (result.success) {
        log(
          `Registrazione riuscita per l'utente: ${username}, pub: ${result.userPub}`
        );

        this.eventEmitter.emit("auth:signup", {
          userPub: result.userPub || "",
          username,
        });

        return {
          success: true,
          userPub: result.userPub,
        };
      } else {
        const errorMsg =
          result.error || "Errore sconosciuto durante la registrazione";
        logError(
          `Registrazione fallita per l'utente: ${username}: ${errorMsg}`
        );

        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (error: any) {
      const errorMsg =
        error.message || "Errore sconosciuto durante la registrazione";
      logError(
        `Errore durante la registrazione per l'utente: ${username}`,
        error
      );

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Verifica se WebAuthn è supportato dal browser
   * @returns true se WebAuthn è supportato, false altrimenti
   */
  isWebAuthnSupported(): boolean {
    return this.webauthn.isSupported();
  }

  /**
   * Effettua il login con WebAuthn
   * @param username - Nome utente
   * @returns Risultato dell'autenticazione
   */
  async loginWithWebAuthn(username: string): Promise<AuthResult> {
    try {
      log(`Tentativo di login WebAuthn per l'utente: ${username}`);

      if (!username) {
        throw new Error("Username richiesto per il login WebAuthn");
      }

      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato da questo browser");
      }

      // Verifica le credenziali WebAuthn
      const assertionResult = await this.webauthn.generateCredentials(
        username,
        null,
        true
      );
      if (!assertionResult.success) {
        throw new Error(assertionResult.error || "Verifica WebAuthn fallita");
      }

      // Usa l'ID delle credenziali come password
      const hashedCredentialId = ethers.keccak256(
        ethers.toUtf8Bytes(assertionResult.credentialId)
      );

      // Effettua il login con le credenziali verificate
      const result = await this.login(username, hashedCredentialId);

      if (result.success) {
        log(`Login WebAuthn completato con successo per l'utente: ${username}`);
        return {
          ...result,
          username,
          password: hashedCredentialId,
          credentialId: assertionResult.credentialId,
        };
      }

      return result;
    } catch (error: any) {
      logError(`Errore durante il login WebAuthn: ${error}`);
      return {
        success: false,
        error: error.message || "Errore durante il login WebAuthn",
      };
    }
  }

  /**
   * Registra un nuovo utente con WebAuthn
   * @param username - Nome utente
   * @returns Risultato della registrazione
   */
  async signUpWithWebAuthn(username: string): Promise<AuthResult> {
    try {
      log(`Tentativo di registrazione WebAuthn per l'utente: ${username}`);

      if (!username) {
        throw new Error("Username richiesto per la registrazione WebAuthn");
      }

      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato da questo browser");
      }

      // Genera nuove credenziali WebAuthn
      const attestationResult = await this.webauthn.generateCredentials(
        username,
        null,
        false
      );
      if (!attestationResult.success) {
        throw new Error(
          attestationResult.error ||
            "Impossibile generare le credenziali WebAuthn"
        );
      }

      // Usa l'ID delle credenziali come password
      const hashedCredentialId = ethers.keccak256(
        ethers.toUtf8Bytes(attestationResult.credentialId)
      );

      // Effettua la registrazione
      const result = await this.signUp(username, hashedCredentialId);

      if (result.success) {
        log(
          `Registrazione WebAuthn completata con successo per l'utente: ${username}`
        );
        return {
          ...result,
          username,
          password: hashedCredentialId,
          credentialId: attestationResult.credentialId,
        };
      }

      return result;
    } catch (error: any) {
      logError(`Errore durante la registrazione WebAuthn: ${error}`);
      return {
        success: false,
        error: error.message || "Errore durante la registrazione WebAuthn",
      };
    }
  }

  /**
   * Effettua il login con MetaMask
   * @param address - Indirizzo Ethereum
   * @returns Risultato del login
   */
  async loginWithMetaMask(address: string): Promise<AuthResult> {
    try {
      log(`Tentativo di login con MetaMask per l'indirizzo: ${address}`);

      // Genera le credenziali usando MetaMask
      const credentials = await this.metamask.generateCredentials(address);

      // Effettua il login con le credenziali generate
      const result = await this.login(
        credentials.username,
        credentials.password
      );

      if (result.success) {
        log(
          `Login con MetaMask completato con successo per l'indirizzo: ${address}`
        );

        return {
          ...result,
          username: credentials.username,
          password: credentials.password,
        };
      } else {
        logError(`Login con MetaMask fallito per l'indirizzo: ${address}`);
        return {
          success: false,
          error: result.error || "Errore durante il login con MetaMask",
        };
      }

      
    } catch (error: any) {
      logError(`Errore durante il login con MetaMask: ${error}`);
      return {
        success: false,
        error: error.message || "Errore durante il login con MetaMask",
      };
    }
  }

  /**
   * Registra un nuovo utente con MetaMask
   * @param address - Indirizzo Ethereum
   * @returns Risultato della registrazione
   */
  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    try {
      log(
        `Tentativo di registrazione con MetaMask per l'indirizzo: ${address}`
      );

      // Genera le credenziali usando MetaMask
      const credentials = await this.metamask.generateCredentials(address);

      // Effettua la registrazione con le credenziali generate
      const result = await this.signUp(
        credentials.username,
        credentials.password
      );

      if (result.success) {
        log(
          `Registrazione con MetaMask completata con successo per l'indirizzo: ${address}`
        );

        // Aggiungi l'username alle informazioni restituite
        return {
          ...result,
          username: credentials.username,
          password: credentials.password,
        };
      }

      return result;
    } catch (error: any) {
      logError(`Errore durante la registrazione con MetaMask: ${error}`);
      return {
        success: false,
        error: error.message || "Errore durante la registrazione con MetaMask",
      };
    }
  }

  /**
   * Ottiene il wallet principale
   * @returns Wallet principale
   */
  getMainWallet(): ethers.Wallet | null {
    return this.walletManager.getMainWallet();
  }

  /**
   * Crea un nuovo wallet
   * @returns Wallet creato
   */
  async createWallet(): Promise<WalletInfo> {
    return this.walletManager.createWallet();
  }

  /**
   * Carica i wallet
   * @returns Wallet caricati
   */
  async loadWallets(): Promise<WalletInfo[]> {
    try {
      if (!this.isLoggedIn()) {
        log("Impossibile caricare i wallet: utente non autenticato");
        return [];
      }

      return await this.walletManager.loadWallets();
    } catch (error) {
      logError("Errore durante il caricamento dei wallet:", error);
      return [];
    }
  }

  /**
   * Firma un messaggio
   * @param wallet - Wallet per la firma
   * @param message - Messaggio da firmare
   * @returns Firma del messaggio
   */
  async signMessage(
    wallet: ethers.Wallet,
    message: string | Uint8Array
  ): Promise<string> {
    return this.walletManager.signMessage(wallet, message);
  }

  /**
   * Verifica una firma
   * @param message - Messaggio firmato
   * @param signature - Firma da verificare
   * @returns Indirizzo che ha firmato il messaggio
   */
  verifySignature(message: string | Uint8Array, signature: string): string {
    return this.walletManager.verifySignature(message, signature);
  }

  /**
   * Firma una transazione
   * @param wallet - Wallet per la firma
   * @param toAddress - Indirizzo destinatario
   * @param value - Valore da inviare
   * @returns Transazione firmata
   */
  async signTransaction(
    wallet: ethers.Wallet,
    toAddress: string,
    value: string
  ): Promise<string> {
    return this.walletManager.signTransaction(wallet, toAddress, value);
  }

  /**
   * Esporta la frase mnemonica dell'utente
   * @param password Password opzionale per cifrare i dati esportati
   */
  async exportMnemonic(password?: string): Promise<string> {
    return this.walletManager.exportMnemonic(password);
  }

  /**
   * Esporta le chiavi private di tutti i wallet
   * @param password Password opzionale per cifrare i dati esportati
   */
  async exportWalletKeys(password?: string): Promise<string> {
    return this.walletManager.exportWalletKeys(password);
  }

  /**
   * Esporta il pair di Gun dell'utente
   * @param password Password opzionale per cifrare i dati esportati
   */
  async exportGunPair(password?: string): Promise<string> {
    return this.walletManager.exportGunPair(password);
  }

  /**
   * Esporta tutti i dati dell'utente in un unico file
   * @param password Password obbligatoria per cifrare i dati esportati
   */
  async exportAllUserData(password: string): Promise<string> {
    return this.walletManager.exportAllUserData(password);
  }

  /**
   * Importa una frase mnemonica
   * @param mnemonicData La mnemonica o il JSON cifrato da importare
   * @param password Password opzionale per decifrare la mnemonica se cifrata
   */
  async importMnemonic(
    mnemonicData: string,
    password?: string
  ): Promise<boolean> {
    return this.walletManager.importMnemonic(mnemonicData, password);
  }

  /**
   * Importa le chiavi private dei wallet
   * @param walletsData JSON contenente i dati dei wallet o JSON cifrato
   * @param password Password opzionale per decifrare i dati se cifrati
   */
  async importWalletKeys(
    walletsData: string,
    password?: string
  ): Promise<number> {
    return this.walletManager.importWalletKeys(walletsData, password);
  }

  /**
   * Importa un pair di Gun
   * @param pairData JSON contenente il pair di Gun o JSON cifrato
   * @param password Password opzionale per decifrare i dati se cifrati
   */
  async importGunPair(pairData: string, password?: string): Promise<boolean> {
    return this.walletManager.importGunPair(pairData, password);
  }

  /**
   * Importa un backup completo
   * @param backupData JSON cifrato contenente tutti i dati dell'utente
   * @param password Password per decifrare il backup
   * @param options Opzioni di importazione (quali dati importare)
   */
  async importAllUserData(
    backupData: string,
    password: string,
    options: {
      importMnemonic?: boolean;
      importWallets?: boolean;
      importGunPair?: boolean;
    } = { importMnemonic: true, importWallets: true, importGunPair: true }
  ): Promise<{
    success: boolean;
    mnemonicImported?: boolean;
    walletsImported?: number;
    gunPairImported?: boolean;
  }> {
    return this.walletManager.importAllUserData(backupData, password, options);
  }
}

// Esporta tutti i tipi
export * from "./types/auth";
export * from "./types/gun";
export * from "./types/shogun";
export * from "./types/token";

// Esporta le classi
export { GunDB } from "./gun/gun";
export { MetaMask } from "./connector/metamask";
export {
  Stealth,
  StealthKeyPair,
  StealthAddressResult,
} from "./stealth/stealth";
export { Webauthn } from "./webauthn/webauthn";
export { Storage } from "./storage/storage";
export { ShogunEventEmitter } from "./events";
