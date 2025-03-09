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

/**
 * Shogun SDK - Decentralized Authentication Protocol
 *
 * This SDK implements a 3-layer authentication protocol:
 *
 * 1. Credential Generation Layer
 *    - User/Password: Standard username and password credentials
 *    - MetaMask: Ethereum wallet-based authentication using digital signatures
 *    - WebAuthn: Biometric and hardware security key authentication (FIDO2)
 *
 * 2. Authentication Layer
 *    - GunDB: Decentralized graph database for user authentication
 *    - Hedgehog: Ethereum wallet-based authentication
 *
 * 3. Wallet Management Layer
 *    - HD Wallet: Hierarchical deterministic wallet for Ethereum
 *    - Stealth Addresses: Privacy-enhancing technology for Ethereum
 */
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
   * Effettua il login con le credenziali fornite
   * @param username - Nome utente
   * @param password - Password
   * @param useRetryIfNeeded - Se utilizzare il meccanismo di retry in caso di fallimento
   * @returns Risultato del login
   */
  async login(
    username: string,
    password: string
  ): Promise<AuthResult> {
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
      if (passwordConfirmation !== undefined && password !== passwordConfirmation) {
        return {
          success: false,
          error: "Le password non corrispondono"
        };
      }

      if (password.length < 6) {
        return {
          success: false,
          error: "La password deve contenere almeno 6 caratteri"
        };
      }
      const timeoutPromise = new Promise<SignUpResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Timeout durante la registrazione dopo 15 secondi"));
        }, 15000);
      });

      const registrationPromise = this.gundb.signUp(username, password);

      const result = await Promise.race([registrationPromise, timeoutPromise])
        .catch(error => {
          logError(`Errore durante la registrazione: ${error.message}`);
          return {
            success: false,
            error: error.message || "Errore durante la registrazione"
          };
        });


      if (result.success) {
        log(`Registrazione riuscita per l'utente: ${username}, pub: ${result.userPub}`);

        this.eventEmitter.emit("auth:signup", {
          userPub: result.userPub || "",
          username,
        });

        return {
          success: true,
          userPub: result.userPub,
        };
      } else {
        const errorMsg = result.error || "Errore sconosciuto durante la registrazione";
        logError(`Registrazione fallita per l'utente: ${username}: ${errorMsg}`);

        return {
          success: false,
          error: errorMsg
        };
      }
    } catch (error: any) {
      const errorMsg = error.message || "Errore sconosciuto durante la registrazione";
      logError(`Errore durante la registrazione per l'utente: ${username}`, error);

      return {
        success: false,
        error: errorMsg
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
      log(`Richiesta login con WebAuthn per l'utente: ${username}`);

      if (!username) {
        logError("Username richiesto per il login con WebAuthn");
        return {
          success: false,
          error: "Username richiesto",
        };
      }

      // Verifichiamo che l'utente abbia già delle credenziali WebAuthn salvate
      log(`Recupero credenziali WebAuthn per l'utente: ${username}`);
      const storedCredentialsString = this.storage.getItem(
        `webauthn_credential_${username}`
      );

      if (!storedCredentialsString) {
        logError(`Nessuna credenziale WebAuthn trovata per l'utente: ${username}`);
        return {
          success: false,
          error: "Nessuna credenziale WebAuthn trovata per questo utente. Se non hai mai usato WebAuthn, devi prima registrare il tuo dispositivo durante la fase di registrazione.",
        };
      }

      try {
        const storedCredentials = JSON.parse(storedCredentialsString);

        const hashedCredentialId = ethers.keccak256(
          ethers.toUtf8Bytes(storedCredentials.credentialId)
        );

        const result = await this.login(username, hashedCredentialId);

        if (result.success) {
          log(`Login WebAuthn riuscito per l'utente: ${username}`);
          this.eventEmitter.emit("auth:login", {
            username,
            method: "webauthn",
            userPub: result.userPub,
          });
        } else {
          logError(`Login WebAuthn fallito per l'utente: ${username}`, result.error);
        }

        return result;
      } catch (error) {
        logError(`Errore nell'elaborazione delle credenziali WebAuthn: ${error}`);
        return {
          success: false,
          error: "Errore durante l'autenticazione WebAuthn",
        };
      }
    } catch (error) {
      logError(
        `Errore durante il login WebAuthn per l'utente: ${username}`,
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore durante il login con WebAuthn",
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
      if (!username) {
        logError("Username richiesto per la registrazione con WebAuthn");
        return {
          success: false,
          error: "Username richiesto",
        };
      }

      // Creiamo nuove credenziali WebAuthn per l'utente
      const credentialsData = await this.webauthn.generateCredentials(
        username,
        null,
        false,
        "WebAuthn"
      );

      if (!credentialsData || !credentialsData.credentialId) {
        logError(
          `Impossibile creare credenziali WebAuthn per l'utente: ${username}`
        );
        return {
          success: false,
          error: "Impossibile creare credenziali WebAuthn",
        };
      }

      let hashedCredentialId: string;
      try {
        const encoder = new TextEncoder();
        const credentialIdBytes = encoder.encode(credentialsData.credentialId);

        hashedCredentialId = ethers.keccak256(credentialIdBytes);

      } catch (error) {
        logError(`Errore nella conversione del credentialId: ${error}`);
        const fallbackPassword = `webauthn-${username}-${Date.now()}`;
        hashedCredentialId = ethers.keccak256(
          ethers.toUtf8Bytes(fallbackPassword)
        );
        log(`Utilizzato metodo alternativo per la generazione della password`);
      }

      try {
        this.storage.setItem(
          `webauthn_credential_${username}`,
          JSON.stringify({
            credentialId: credentialsData.credentialId,
            username: username,
            created: Date.now(),
          })
        );
        log(`Credenziali WebAuthn salvate per l'utente: ${username}`);
      } catch (storageError) {
        logWarning(
          `Impossibile salvare le credenziali WebAuthn: ${storageError}`
        );
      }

      const result = await this.signUp(username, hashedCredentialId);

      if (result.success) {
        this.eventEmitter.emit("auth:signup", {
          username,
          method: "webauthn",
          userPub: result.userPub,
        });
      } else {
        if (result.error === "User already exists") {

          const loginResult = await this.login(username, hashedCredentialId);

          if (loginResult.success) {
            this.eventEmitter.emit("auth:login", {
              username,
              method: "webauthn",
              userPub: loginResult.userPub,
            });

            return {
              success: true,
              userPub: loginResult.userPub,
              error: "Utente già esistente, login effettuato con successo"
            };
          }
        }

        logError(`Registrazione WebAuthn fallita per l'utente: ${username}`, result.error);
      }

      return result;
    } catch (error) {
      logError(
        `Errore durante la registrazione WebAuthn per l'utente: ${username}`,
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore durante la registrazione con WebAuthn",
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
      const credentials = await this.metamask.generateCredentials(address);

      this.storage.setItem(
        `metamask_credentials_${address.toLowerCase()}`,
        JSON.stringify(credentials)
      );

      const result = await this.login(
        credentials.username,
        credentials.password
      );


      if (result.success) {
        log(
          `Login con MetaMask completato con successo per l'indirizzo: ${address}`
        );

        try {
          this.walletManager.resetMainWallet();

          const wallet = this.getMainWallet();
          if (wallet) {
            log(
              `Wallet creato con successo per l'indirizzo MetaMask: ${address}`
            );
            log(`Indirizzo wallet: ${wallet.address}`);
          } else {
            log(
              `Impossibile creare il wallet per l'indirizzo MetaMask: ${address}`
            );
          }
        } catch (walletError: any) {
          logError(
            `Errore nella creazione del wallet per MetaMask: ${walletError.message || walletError}`
          );
        }

        // Emetti l'evento di login
        this.eventEmitter.emit("auth:login", {
          username: address,
          userPub: result.userPub || "",
        });
      } else {
        logWarning(
          `Login con MetaMask fallito per l'indirizzo: ${address}`,
          result.error
        );
      }

      return result;
    } catch (error: any) {
      logError(
        `Errore durante il login con MetaMask per l'indirizzo: ${address}:`,
        error
      );
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
      const credentials = await this.metamask.generateCredentials(address);
      this.storage.setItem(
        `metamask_credentials_${address.toLowerCase()}`,
        JSON.stringify(credentials)
      );

      const result = await this.signUp(
        credentials.username,
        credentials.password
      );


      if (result.success) {
        try {
          this.walletManager.resetMainWallet();
          const wallet = this.getMainWallet();
          if (wallet) {
            log(
              `Wallet creato con successo per l'indirizzo MetaMask: ${address}`
            );
            log(`Indirizzo wallet: ${wallet.address}`);
          }
        } catch (walletError: any) {
          logError(
            `Errore nella creazione del wallet per MetaMask: ${walletError.message || walletError}`
          );
        }

        this.eventEmitter.emit("auth:signup", {
          username: address,
          userPub: result.userPub || "",
        });

        return {
          success: true,
          userPub: result.userPub,
          username: credentials.username,
        };
      } else {
        logError(
          `Registrazione con MetaMask fallita per l'indirizzo: ${address}: ${result.error}`
        );
        return {
          success: false,
          error: result.error || "Errore durante la registrazione con MetaMask",
        };
      }
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
  async importMnemonic(mnemonicData: string, password?: string): Promise<boolean> {
    return this.walletManager.importMnemonic(mnemonicData, password);
  }

  /**
   * Importa le chiavi private dei wallet
   * @param walletsData JSON contenente i dati dei wallet o JSON cifrato
   * @param password Password opzionale per decifrare i dati se cifrati
   */
  async importWalletKeys(walletsData: string, password?: string): Promise<number> {
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

// Esporta la classe principale
export default ShogunSDK;
