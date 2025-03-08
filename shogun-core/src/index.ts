import { HDNodeWallet } from "ethers";
import { GunDB } from "./gun/gun";
// Importa i moduli
import { Webauthn } from "./webauthn/webauthn";
import { MetaMask } from "./connector/metamask";
import { Stealth } from "./stealth/stealth";
import { ShogunEventEmitter } from "./events/eventEmitter";
import { Storage } from "./storage/storage";
import {
  IShogunSDK,
  ShogunSDKConfig,
  AuthResult,
  SignUpResult,
  WalletInfo,
} from "./types/shogun";
import { IGunInstance } from "gun/types/gun";
import { log, logError, logWarning, logDebug } from "./utils/logger";
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
  private eventEmitter: ShogunEventEmitter;
  private walletManager: WalletManager;

  /**
   * Inizializza l'SDK Shogun
   * @param config - Configurazione dell'SDK
   */
  constructor(config: ShogunSDKConfig) {
    log("Inizializzazione di ShogunSDK");

    // Configura lo storage
    this.storage = new Storage();

    // Inizializza l'emettitore di eventi
    this.eventEmitter = new ShogunEventEmitter();

    // Inizializza GunDB con supporto WebSocket
    const gundbConfig = {
      peers: config.gundb?.peers || config.peers || CONFIG.PEERS,
      websocket: config.websocket,
      localStorage: false,
      radisk: false,
    };

    // Inizializza GunDB
    this.gundb = new GunDB(gundbConfig);
    this.gun = this.gundb.getGun();

    // Inizializza i moduli
    this.webauthn = new Webauthn(this.gun); // Passa l'istanza Gun a Webauthn
    this.metamask = new MetaMask();
    this.stealth = new Stealth();

    // Inizializza i gestori
    this.walletManager = new WalletManager(this.gundb, this.gun, this.storage);
    
    // Log di inizializzazione completata
    log("ShogunSDK inizializzato con successo");
  }

  /**
   * Verifica se l'utente è loggato
   * @returns true se l'utente è loggato, false altrimenti
   */
  isLoggedIn(): boolean {
    const gunLoggedIn = this.gundb.isLoggedIn();
    log(`Verifica dello stato di autenticazione: Gun=${gunLoggedIn ? 'autenticato' : 'non autenticato'}`);
    
    // Se Gun indica che siamo autenticati, restituisci true
    if (gunLoggedIn) {
      return true;
    }
    
    // Verifica anche il localStorage per le credenziali (pair)
    // Questo può aiutare quando Gun non ha completato l'autenticazione ma le credenziali sono presenti
    const gunUser = this.gun.user();
    // @ts-ignore - Accesso a proprietà interna di Gun non completamente tipizzata
    const hasPair = gunUser && gunUser._ && gunUser._.sea;
    
    // Verifica anche localstorage
    const hasLocalPair = this.storage.getItem('pair');
    
    log(`Controlli aggiuntivi: GunUser=${!!gunUser}, GunSea=${!!hasPair}, LocalPair=${!!hasLocalPair}`);
    
    // Considera autenticato se il user._ contiene sea o se c'è un pair nel localStorage
    return gunLoggedIn || !!hasPair || !!hasLocalPair;
  }

  /**
   * Effettua il logout
   */
  logout(): void {
    try {
      log("Richiesta logout");

      // Verifica se l'utente è effettivamente autenticato
      if (!this.isLoggedIn()) {
        log("Logout ignorato: utente non autenticato");
        return;
      }

      // Ottieni info utente prima del logout per il logging
      const user = this.gun.user().is;
      const userPub = user?.pub;
      const username = user?.alias;

      log(
        `Esecuzione logout per utente: ${username || "sconosciuto"}, pub: ${userPub || "sconosciuto"}`
      );

      // Logout da GunDB
      this.gundb.logout();

      // Emetti l'evento di logout
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
    password: string,
    useRetryIfNeeded = false
  ): Promise<AuthResult> {
    try {
      log(`Tentativo di login per l'utente: ${username}`);

      const result = await this.gundb.login(username, password);

      if (result.success) {
        log(`Login riuscito per l'utente: ${username}`);

        // Emettiamo l'evento di login
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
   * @param useCleanupIfNeeded - Se effettuare un cleanup in caso di errore
   * @returns Risultato della registrazione
   */
  async signUp(
    username: string,
    password: string,
    passwordConfirmation?: string
  ): Promise<SignUpResult> {
    try {
      log(`Registrazione nuovo utente: ${username}`);
      
      // Verifica che le password corrispondano se fornita la conferma
      if (passwordConfirmation !== undefined && password !== passwordConfirmation) {
        return {
          success: false,
          error: "Le password non corrispondono"
        };
      }

      // Verifica la lunghezza minima della password
      if (password.length < 6) {
        return {
          success: false,
          error: "La password deve contenere almeno 6 caratteri"
        };
      }

      log(`signUp ${username} ${password}`);
      const result = await this.gundb.signUp(username, password);
      log("Result", result);

      if (result.success) {
        log(`Registrazione riuscita per l'utente: ${username}, pub: ${result.userPub}`);

        // Emettiamo l'evento di registrazione
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

      // Otteniamo le credenziali WebAuthn per l'utente
      log(`Recupero credenziali WebAuthn per l'utente: ${username}`);
      const credentialsData =
        await this.webauthn.generateCredentials (username,
          null,
          true,
          "WebAuthn"
        );

      if (!credentialsData || !credentialsData.credentialId) {
        logError(
          `Nessuna credenziale WebAuthn trovata per l'utente: ${username}`
        );
        return {
          success: false,
          error: "Nessuna credenziale WebAuthn trovata per questo utente",
        };
      }

      log(`Credenziali WebAuthn recuperate per l'utente: ${username}`);

       // Convertiamo il credentialId in una stringa sicura da usare come password
       let hashedCredentialId: string;
       try {
         // Convertiamo prima l'UUID in una stringa di bytes UTF-8
         const encoder = new TextEncoder();
         const credentialIdBytes = encoder.encode(credentialsData.credentialId);
         
         // Calcoliamo il digest SHA-256
         hashedCredentialId = ethers.keccak256(credentialIdBytes);
         log(`Credential ID convertito con successo in hex: ${hashedCredentialId.slice(0, 10)}...`);
       } catch (error) {
         logError(`Errore nella conversione del credentialId: ${error}`);
         // Fallback: usiamo una stringa derivata deterministicamente
         const fallbackPassword = `webauthn-${username}-${Date.now()}`;
         hashedCredentialId = ethers.keccak256(ethers.toUtf8Bytes(fallbackPassword));
         log(`Utilizzato metodo alternativo per la generazione della password`);
       }
 
       // Salva le informazioni sul device per future autenticazioni
       try {
         this.storage.setItem(
           `webauthn_credential_${username}`,
           JSON.stringify({
             credentialId: credentialsData.credentialId,
             username: username,
             created: Date.now()
           })
         );
         log(`Credenziali WebAuthn salvate per l'utente: ${username}`);
       } catch (storageError) {
         logWarning(`Impossibile salvare le credenziali WebAuthn: ${storageError}`);
       }

      // Login with the derived password
      const result = await this.login(username, hashedCredentialId) as AuthResult;

      if (result.success) {
        log(`Login WebAuthn riuscito per l'utente: ${username}`);
        this.eventEmitter.emit("auth:login", {
          username,
          method: "webauthn",
          userPub: result.userPub,
        });
      } else {
        logError(
          `Login WebAuthn fallito per l'utente: ${username}`,
          result.error
        );
      }

      return result;
    } catch (error) {
      logError(
        `Errore durante il login WebAuthn per l'utente: ${username}`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore durante il login con WebAuthn",
      };
    }
  }

  /**
   * Registra un nuovo utente con WebAuthn
   * @param username - Nome utente
   * @returns Risultato della registrazione
   */
  async registerWithWebAuthn(username: string): Promise<AuthResult> {
    try {
      log(`Richiesta registrazione con WebAuthn per l'utente: ${username}`);

      if (!username) {
        logError("Username richiesto per la registrazione con WebAuthn");
        return {
          success: false,
          error: "Username richiesto",
        };
      }

      // Creiamo nuove credenziali WebAuthn per l'utente
      log(`Creazione credenziali WebAuthn per l'utente: ${username}`);
      const credentialsData =
        await this.webauthn.generateCredentials(username,
          null,
          true,
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

      log(`Credenziali WebAuthn create per l'utente: ${username}`);
      
      // Convertiamo il credentialId in una stringa sicura da usare come password
      let hashedCredentialId: string;
      try {
        // Convertiamo prima l'UUID in una stringa di bytes UTF-8
        const encoder = new TextEncoder();
        const credentialIdBytes = encoder.encode(credentialsData.credentialId);
        
        // Calcoliamo il digest SHA-256
        hashedCredentialId = ethers.keccak256(credentialIdBytes);
        log(`Credential ID convertito con successo in hex: ${hashedCredentialId.slice(0, 10)}...`);
      } catch (error) {
        logError(`Errore nella conversione del credentialId: ${error}`);
        // Fallback: usiamo una stringa derivata deterministicamente
        const fallbackPassword = `webauthn-${username}-${Date.now()}`;
        hashedCredentialId = ethers.keccak256(ethers.toUtf8Bytes(fallbackPassword));
        log(`Utilizzato metodo alternativo per la generazione della password`);
      }

      // Salva le informazioni sul device per future autenticazioni
      try {
        this.storage.setItem(
          `webauthn_credential_${username}`,
          JSON.stringify({
            credentialId: credentialsData.credentialId,
            username: username,
            created: Date.now()
          })
        );
        log(`Credenziali WebAuthn salvate per l'utente: ${username}`);
      } catch (storageError) {
        logWarning(`Impossibile salvare le credenziali WebAuthn: ${storageError}`);
      }

      // Registrazione utente
      const result = await this.signUp(username, hashedCredentialId);

      if (result.success) {
        log(`Registrazione WebAuthn riuscita per l'utente: ${username}`);
        this.eventEmitter.emit("auth:signup", {
          username,
          method: "webauthn",
          userPub: result.userPub,
        });
      } else {
        logError(
          `Registrazione WebAuthn fallita per l'utente: ${username}`,
          result.error
        );
      }

      return result;
    } catch (error) {
      logError(
        `Errore durante la registrazione WebAuthn per l'utente: ${username}`,
        error
      );
      return {
        success: false,
        error: error instanceof Error 
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
      log(`Richiesta login con MetaMask per l'indirizzo: ${address}`);

      // Genera le credenziali per MetaMask
      const credentials = await this.metamask.generateCredentials(address);
      log(`Credenziali generate per: ${credentials.username}`);

      // Salva le credenziali per il wallet manager
      this.storage.setItem(
        `metamask_credentials_${address.toLowerCase()}`,
        JSON.stringify(credentials)
      );

      // Esegui il login con le credenziali
      const result = await this.login(credentials.username, credentials.password);

      if (result.success) {
        log(`Login con MetaMask completato con successo per l'indirizzo: ${address}`);
        
        // Forza la creazione del wallet
        try {
          // Resetta il main wallet per assicurarsi che venga rigenerato
          this.walletManager.resetMainWallet();
          
          // Ottieni il main wallet
          const wallet = this.getMainWallet();
          if (wallet) {
            log(`Wallet creato con successo per l'indirizzo MetaMask: ${address}`);
            log(`Indirizzo wallet: ${wallet.address}`);
          } else {
            log(`Impossibile creare il wallet per l'indirizzo MetaMask: ${address}`);
          }
        } catch (walletError: any) {
          // Non far fallire il login se c'è un problema con il wallet
          logError(`Errore nella creazione del wallet per MetaMask: ${walletError.message || walletError}`);
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
      log(`Richiesta registrazione con MetaMask per l'indirizzo: ${address}`);

      // Genera le credenziali per MetaMask
      const credentials = await this.metamask.generateCredentials(address);
      log(`Credenziali generate per la registrazione: ${credentials.username}`);

      // Salva le credenziali per il wallet manager
      this.storage.setItem(
        `metamask_credentials_${address.toLowerCase()}`,
        JSON.stringify(credentials)
      );

      // Qui dovremmo andare direttamente alla registrazione
      const result = await this.signUp(credentials.username, credentials.password);

      if (result.success) {
        log(`Registrazione con MetaMask completata con successo per: ${address}`);
        
        // Per login dopo registrazione
        try {
          // Ottieni il main wallet
          this.walletManager.resetMainWallet();
          const wallet = this.getMainWallet();
          if (wallet) {
            log(`Wallet creato con successo per l'indirizzo MetaMask: ${address}`);
            log(`Indirizzo wallet: ${wallet.address}`);
          }
        } catch (walletError: any) {
          logError(`Errore nella creazione del wallet per MetaMask: ${walletError.message || walletError}`);
        }

        // Emettiamo l'evento di registrazione
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
        logError(`Registrazione con MetaMask fallita per l'indirizzo: ${address}: ${result.error}`);
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
      // Verifica che l'utente sia autenticato
      if (!this.isLoggedIn()) {
        log("Impossibile caricare i wallet: utente non autenticato");
        return [];
      }

      return await this.walletManager.loadWallets();
    } catch (error) {
      logError("Errore durante il caricamento dei wallet:", error);
      // Invece di propagare l'errore, restituiamo un array vuoto
      return [];
    }
  }

  /**
   * Deriva un wallet
   * @param index - Indice del wallet da derivare
   * @returns Wallet derivato
   */
  async deriveWallet(index: number): Promise<WalletInfo> {
    return this.walletManager.deriveWallet(index);
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
   * Cripta un wallet
   * @param wallet - Wallet da criptare
   * @param password - Password per la crittografia
   * @returns JSON del wallet criptato
   */
  async encryptWallet(
    wallet: ethers.Wallet,
    password: string
  ): Promise<string> {
    return this.walletManager.encryptWallet(wallet, password);
  }

  /**
   * Decripta un wallet
   * @param json - JSON del wallet criptato
   * @param password - Password per la decrittografia
   * @returns Wallet decriptato
   */
  async decryptWallet(json: string, password: string): Promise<ethers.Wallet> {
    return this.walletManager.decryptWallet(json, password);
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
   * Ottiene lo stato di autenticazione in modo sincrono
   * @returns Stato di autenticazione
   */
  getAuthStateSync(): { gunLoggedIn: boolean; isPending: boolean } {
    const gunLoggedIn = this.isLoggedIn();
    const pending = false; // Non gestiamo più lo stato pending in questo modo
    
    log(`Stato di autenticazione: ${JSON.stringify({ gunLoggedIn, isPending: pending })}`);
    
    return {
      gunLoggedIn,
      isPending: pending,
    };
  }

  /**
   * Crea credenziali WebAuthn integrate con GunDB
   * @param username - Nome utente
   * @returns Promise con le credenziali create
   */
  async createWebAuthnGunCredential(username: string): Promise<AuthResult> {
    try {
      log(`Creazione credenziale WebAuthn-Gun per l'utente: ${username}`);

      if (!username) {
        logError("Username richiesto per la creazione della credenziale WebAuthn-Gun");
        return {
          success: false,
          error: "Username richiesto",
        };
      }

      const result = await this.webauthn.createGunCredential(username);
      
      if (!result.credential) {
        logError(`Impossibile creare la credenziale WebAuthn-Gun per l'utente: ${username}`);
        return {
          success: false,
          error: "Impossibile creare la credenziale WebAuthn",
        };
      }
      
      log(`Credenziale WebAuthn-Gun creata per l'utente: ${username}, pub: ${result.pub.substring(0, 10)}...`);
      
      // Salva la credenziale nel localStorage per future interazioni
      this.storage.setItem(`webauthn_gun_pub_${username}`, result.pub);
      
      return {
        success: true,
        userPub: result.pub,
        username,
      };
    } catch (error) {
      logError(`Errore durante la creazione della credenziale WebAuthn-Gun per l'utente: ${username}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }
  
  /**
   * Autentica un utente con WebAuthn direttamente con GunDB
   * @param username - Nome utente
   * @returns Promise con il risultato dell'autenticazione
   */
  async authenticateWithWebAuthnGun(username: string): Promise<AuthResult> {
    try {
      log(`Richiesta autenticazione WebAuthn-Gun per l'utente: ${username}`);

      if (!username) {
        logError("Username richiesto per l'autenticazione WebAuthn-Gun");
        return {
          success: false,
          error: "Username richiesto",
        };
      }

      const result = await this.webauthn.authenticateWithGun(username);
      
      if (!result.success) {
        logError(`Autenticazione WebAuthn-Gun fallita per l'utente: ${username}`, result.error);
        return {
          success: false,
          error: result.error || "Autenticazione fallita",
        };
      }
      
      log(`Autenticazione WebAuthn-Gun completata per l'utente: ${username}, pub: ${result.pub?.substring(0, 10)}...`);
      
      // Emetti l'evento di login
      this.eventEmitter.emit("auth:login", {
        username,
        method: "webauthn",
        userPub: result.pub,
      });
      
      return {
        success: true,
        userPub: result.pub,
        username,
      };
    } catch (error) {
      logError(`Errore durante l'autenticazione WebAuthn-Gun per l'utente: ${username}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }
  
  /**
   * Salva dati su GunDB utilizzando l'autenticazione WebAuthn
   * @param path - Percorso Gun
   * @param data - Dati da salvare
   * @param username - Nome utente
   * @returns Promise con il risultato dell'operazione
   */
  async putToGunWithWebAuthn(path: string, data: any, username: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      log(`Salvataggio dati con WebAuthn-Gun per l'utente: ${username}, path: ${path}`);

      if (!username) {
        logError("Username richiesto per il salvataggio con WebAuthn-Gun");
        return {
          success: false,
          error: "Username richiesto",
        };
      }

      // Autentica l'utente
      const authResult = await this.webauthn.authenticateWithGun(username);
      
      if (!authResult.success || !authResult.authenticator) {
        logError(`Autenticazione WebAuthn-Gun fallita per l'utente: ${username}`, authResult.error);
        return {
          success: false,
          error: authResult.error || "Autenticazione fallita",
        };
      }
      
      // Salva i dati
      await this.webauthn.putToGun(path, data, authResult.authenticator);
      
      log(`Dati salvati con successo con WebAuthn-Gun per l'utente: ${username}, path: ${path}`);
      
      return {
        success: true,
      };
    } catch (error) {
      logError(`Errore durante il salvataggio con WebAuthn-Gun per l'utente: ${username}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }
  
  /**
   * Firma dati con WebAuthn
   * @param data - Dati da firmare
   * @param username - Nome utente
   * @returns Promise con la firma
   */
  async signDataWithWebAuthn(data: any, username: string): Promise<{
    success: boolean;
    signature?: any;
    error?: string;
  }> {
    try {
      log(`Firma dati con WebAuthn per l'utente: ${username}`);

      if (!username) {
        logError("Username richiesto per la firma con WebAuthn");
        return {
          success: false,
          error: "Username richiesto",
        };
      }

      // Autentica l'utente
      const authResult = await this.webauthn.authenticateWithGun(username);
      
      if (!authResult.success || !authResult.authenticator) {
        logError(`Autenticazione WebAuthn fallita per l'utente: ${username}`, authResult.error);
        return {
          success: false,
          error: authResult.error || "Autenticazione fallita",
        };
      }
      
      // Firma i dati
      const signature = await this.webauthn.signData(data, authResult.authenticator);
      
      log(`Dati firmati con successo con WebAuthn per l'utente: ${username}`);
      
      return {
        success: true,
        signature,
      };
    } catch (error) {
      logError(`Errore durante la firma con WebAuthn per l'utente: ${username}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }

}

// Esporta la classe principale
export default ShogunSDK;