import { ethers } from "ethers";
import { HDNodeWallet } from "ethers";
// Dichiarazione modulo per uuid
declare module "uuid";
import * as uuid from "uuid";
import { GunDB } from "./gun/gun";

// Ignorare gli errori di typescript per gli import di moduli che esistono a runtime
import { Webauthn } from "./webauthn/webauthn";
import { MetaMask } from "./connector/metamask";
import { Stealth } from "./stealth/stealth";
import { EventEmitter as ShogunEventEmitter } from "./utils/eventEmitter";
import { Storage } from "./storage/storage";
import {
  IShogunSDK,
  ShogunSDKConfig,
  WalletInfo,
  AuthResult,
  SignUpResult,
  ShogunEvents,
} from "./types/shogun";
import { IGunInstance } from "gun/types/gun";

let gun: any;

/**
 * Funzione di utilità per il log
 */
export function log(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[ShogunSDK] ${message}`, ...args);
  }
}

/**
 * Interfaccia principale SDK Shogun
 * @version 1.1.0
 */
export class ShogunSDK implements IShogunSDK {
  // ==========================================
  // Proprietà principali
  // ==========================================
  public gun: IGunInstance<any>;
  private storage: Storage;
  public gundb: GunDB;
  public hedgehog: any;
  public webauthn: Webauthn;
  public metamask: MetaMask | undefined;
  public stealth: Stealth | undefined;
  private eventEmitter: ShogunEventEmitter;

  /**
   * Costruttore principale di ShogunSDK
   * @param config Configurazione dell'SDK
   */
  constructor(config: ShogunSDKConfig) {
    this.storage = new Storage();
    this.gundb = new GunDB(config.peers as string[]);
    this.gun = this.gundb.gun as IGunInstance<any>;

    // Esporta l'istanza gun globalmente
    gun = this.gun;

    // Inizializza Hedgehog con le funzioni appropriate
    const setAuthFn = async (obj: { lookupKey: string }) =>
      this.gundb.createIfNotExists("Authentications", obj.lookupKey, obj);
    const setUserFn = async (obj: {
      walletAddress: string;
      username: string;
    }) =>
      this.gundb.createIfNotExists(
        "Users",
        obj.walletAddress || obj.username,
        obj
      );
    const getFn = async (obj: { lookupKey: string }) =>
      this.gundb.readRecordFromGun("Authentications", obj);

    //@ts-ignore
    this.hedgehog = new Hedgehog(getFn, setAuthFn, setUserFn) as any;
    this.webauthn = new Webauthn(this.gundb, this.hedgehog);
    this.metamask = new MetaMask(this.gundb, this.hedgehog);
    this.stealth = new Stealth(this.gundb);
    this.initGunSession();
    this.eventEmitter = new ShogunEventEmitter();

    // Aggiungiamo un handler di debug per gli eventi in development
    if (process.env.NODE_ENV === "development") {
      this.eventEmitter.on(
        "error",
        (data: { action: string; message: string }) => {
          console.error("ShogunSDK Error:", data);
        }
      );

      this.eventEmitter.on(
        "auth:signup",
        (data: { username: string; userPub: string }) => {
          console.log("ShogunSDK Signup:", data);
        }
      );
    }
  }

  // ==========================================
  // Metodi Core e inizializzazione
  // ==========================================

  /**
   * Verifica che l'istanza Gun sia disponibile
   */
  checkGun() {
    if (!this.gun || !this.gundb || !this.gundb.gun) {
      throw new Error("Gun DB non è inizializzato");
    }
  }

  /**
   * Inizializza la sessione Gun
   */
  async initGunSession() {
    try {
      const pair = await this.storage.getPair();
      if (pair) {
        await this.authenticateGunUserWithPair(pair);
        return;
      }
    } catch (error) {
      console.error("Errore durante l'inizializzazione della sessione:", error);
    }
  }

  /**
   * Crea un oggetto AuthResult standardizzato
   */
  private createAuthResult(
    success: boolean,
    data?: {
      userPub?: string;
      password?: string;
      wallet?: any;
      error?: string;
      username?: string;
    }
  ): AuthResult {
    return {
      success,
      userPub: data?.userPub,
      password: data?.password,
      wallet: data?.wallet,
      error: data?.error,
      username: data?.username,
    };
  }

  /**
   * Autentica un utente Gun con la coppia di chiavi
   */
  async authenticateGunUserWithPair(pair: any) {
    try {
      await this.gun.user().auth(pair);
      log("Utente Gun autenticato con successo");
    } catch (error) {
      console.error("Errore durante l'autenticazione con la coppia:", error);
    }
  }

  /**
   * Crea un utente Gun con la coppia di chiavi
   */
  async createGunUserWithPair(username: string) {
    return new Promise((resolve, reject) => {
      this.gun.user().create(username, "", async (ack: any) => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          resolve(ack);
        }
      });
    });
  }

  // ==========================================
  // Metodi Core di Autenticazione
  // ==========================================

  /**
   * Registra un nuovo utente
   */
  async signUp(username: string, password: string): Promise<SignUpResult> {
    try {
      log("Tentativo di registrazione utente:", username);
      this.checkGun();

      // Verifica se l'utente esiste già
      const user = await this.hedgehog.getUser(username);
      if (user) {
        return { success: false, error: "Username già registrato" };
      }

      // Registra con Hedgehog
      const result = await this.hedgehog.signUp(username, password);
      if (!result || !result.wallet) {
        return { success: false, error: "Registrazione fallita" };
      }

      log("Utente registrato con successo:", username);

      // Autentica con Gun
      const userPub = await this.authenticateWithGun(username, password);

      // Inizializza i dati dell'utente
      await this.initializeUserData(username, password, userPub);

      // Inizializza i percorsi del wallet
      await this.initializeWalletPaths(userPub);

      // Notifica l'evento di registrazione
      this.eventEmitter.emit("auth:signup", { username, userPub });

      return { success: true, wallet: result.wallet, pub: userPub };
    } catch (error: any) {
      console.error("Errore durante la registrazione:", error);
      this.eventEmitter.emit("error", {
        action: "signup",
        message: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Effettua il login di un utente
   */
  async login(
    username: string,
    password: string
  ): Promise<{ wallet: any; userpub: string }> {
    try {
      log("Tentativo di login utente:", username);
      this.checkGun();

      // Autentica con Hedgehog
      const result = await this.authenticateWithHedgehog(username, password);
      if (!result || !result.wallet) {
        throw new Error("Autenticazione fallita");
      }

      // Autentica con Gun
      const userPub = await this.authenticateWithGun(username, password);

      // Salva la coppia
      await this.storage.setPair({ pub: userPub, priv: password });
      log("Login completato con successo per:", username);

      // Notifica l'evento di login
      this.eventEmitter.emit("auth:login", { username, userPub });

      return { wallet: result.wallet, userpub: userPub };
    } catch (error: any) {
      console.error("Errore durante il login:", error);
      this.eventEmitter.emit("error", {
        action: "login",
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Effettua il logout dell'utente
   */
  logout() {
    this.gun.user().leave();
    this.storage.clearAll();
    this.eventEmitter.emit("auth:logout", {});
    log("Logout completato");
  }

  /**
   * Verifica se l'utente è loggato
   */
  isLoggedIn(): boolean {
    const pair = this.storage.getPairSync();
    return !!pair && !!pair.pub;
  }

  /**
   * Ottiene il wallet principale
   */
  getMainWallet(): HDNodeWallet {
    const pair = this.storage.getPairSync();
    if (!pair || !pair.pub) {
      throw new Error("Utente non autenticato");
    }
    return this.deriveWallet(pair.pub, 0) as unknown as HDNodeWallet;
  }

  // ==========================================
  // Metodi MetaMask
  // ==========================================

  /**
   * Effettua il login con MetaMask
   */
  async loginWithMetaMask(address: string): Promise<AuthResult> {
    try {
      if (!this.metamask) {
        return this.createAuthResult(false, {
          error: "MetaMask non è inizializzato",
        });
      }

      // Verifica se Gun DB è inizializzato
      if (!this.gundb || !this.gundb.gun) {
        return this.createAuthResult(false, {
          error: "Gun DB non è inizializzato",
        });
      }

      log("Tentativo di login con MetaMask, indirizzo:", address);

      // Genera credenziali (include firma e verifica)
      const credentials = await this.metamask.generateCredentials(address);

      try {
        // Effettua login con le credenziali generate
        const result = await this.login(
          credentials.username,
          credentials.password
        );

        log("Login con MetaMask completato con successo");
        return this.createAuthResult(true, {
          userPub: result.userpub,
          username: credentials.username,
          password: credentials.password,
          wallet: result.wallet,
        });
      } catch (authError) {
        log("Errore durante l'autenticazione:", authError);
        return this.createAuthResult(false, {
          error: "Errore nell'autenticazione: " + (authError as Error).message,
        });
      }
    } catch (error: any) {
      log("Errore nel login con MetaMask:", error);
      return this.createAuthResult(false, {
        error: error.message || "Errore nel login con MetaMask",
      });
    }
  }

  /**
   * Effettua la registrazione con MetaMask
   */
  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    try {
      if (!this.metamask) {
        return this.createAuthResult(false, {
          error: "MetaMask non è inizializzato",
        });
      }

      // Verifica se Gun DB è inizializzato
      if (!this.gundb || !this.gundb.gun) {
        return this.createAuthResult(false, {
          error: "Gun DB non è inizializzato",
        });
      }

      const metamaskUsername = address.toLowerCase();
      log("Verifica utente esistente per:", metamaskUsername);

      // Verifica se l'utente esiste già
      let userExists = false;
      try {
        const userCheck = await Promise.race([
          new Promise((resolve) => {
            this.gundb.gun
              .get("Users")
              .get(metamaskUsername)
              .once((data: any) => {
                resolve(!!data);
              });
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
        ]);

        userExists = !!userCheck;
      } catch (e) {
        log("Errore durante la verifica utente:", e);
        userExists = false;
      }

      // Se l'utente esiste già, effettua login
      if (userExists) {
        log("Utente già esistente, tentativo di login...");
        return await this.loginWithMetaMask(address);
      }

      log("Tentativo di registrazione con MetaMask, indirizzo:", address);

      // Genera credenziali con firma
      const credentials = await this.metamask.generateCredentials(address);

      // Registra con le credenziali generate
      const result = await this.signUp(
        credentials.username,
        credentials.password
      );

      if (!result.success) {
        return this.createAuthResult(false, {
          error: result.error || "Registrazione fallita",
        });
      }

      // Salva dati di autenticazione
      await this.gundb.writeToGun(this.metamask.AUTH_DATA_TABLE, address, {
        username: credentials.username,
        address: address.toLowerCase(),
        nonce: credentials.nonce,
        timestamp: credentials.timestamp,
        messageToSign: credentials.messageToSign,
      });

      log("Registrazione con MetaMask completata con successo");
      return this.createAuthResult(true, {
        userPub: result.pub,
        username: credentials.username,
        password: credentials.password,
        wallet: result.wallet,
      });
    } catch (error: any) {
      log("Errore nella registrazione con MetaMask:", error);
      return this.createAuthResult(false, {
        error: error.message || "Errore nella registrazione con MetaMask",
      });
    }
  }

  /**
   * Verifica se un utente esiste
   */
  private async checkUserExists(username: string): Promise<boolean> {
    return new Promise((resolve) => {
      let isResolved = false;

      this.gundb.gun
        .get("Users")
        .get(username)
        .once((data: any) => {
          if (!isResolved) {
            isResolved = true;
            resolve(!!data);
          }
        });

      // Timeout per garantire che la promessa si risolva
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve(false);
        }
      }, 5000);
    });
  }

  // ==========================================
  // Metodi WebAuthn
  // ==========================================

  /**
   * Verifica se WebAuthn è supportato
   */
  isWebAuthnSupported(): boolean {
    return (
      typeof window !== "undefined" && window.PublicKeyCredential !== undefined
    );
  }

  /**
   * Registra un utente con WebAuthn
   */
  async registerWithWebAuthn(username: string): Promise<{
    success: boolean;
    error?: string;
    userPub?: string;
    password?: string;
    credentialId?: string;
  }> {
    try {
      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato in questo browser");
      }

      if (!this.webauthn) {
        throw new Error("WebAuthn non è inizializzato");
      }

      // Genera credenziali WebAuthn
      const result = await this.webauthn.generateCredentials(username);
      log("Risultato generazione credenziali WebAuthn:", result);

      if (!result.success || !result.password) {
        throw new Error(result.error || "Registrazione WebAuthn fallita");
      }

      // Registra l'utente
      const signUpResult = await this.signUp(username, result.password);

      if (!signUpResult.success) {
        throw new Error(signUpResult.error);
      }

      return {
        success: true,
        userPub: signUpResult.pub,
        password: result.password,
        credentialId: result.credentialId,
      };
    } catch (error: any) {
      console.error("Errore nella registrazione con WebAuthn:", error);
      return {
        success: false,
        error: error.message || "Errore nella registrazione con WebAuthn",
      };
    }
  }

  /**
   * Effettua il login con WebAuthn
   */
  async loginWithWebAuthn(username: string): Promise<{
    success: boolean;
    error?: string;
    userPub?: string;
    password?: string;
    credentialId?: string;
  }> {
    try {
      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato in questo browser");
      }

      if (!this.webauthn) {
        throw new Error("WebAuthn non è inizializzato");
      }

      // Autentica con WebAuthn
      const result = await this.webauthn.authenticateUser(username);
      log("Risultato autenticazione WebAuthn:", result);

      if (!result.success || !result.password) {
        throw new Error(result.error || "Autenticazione WebAuthn fallita");
      }

      // Effettua login con le credenziali
      const loginResult = await this.login(username, result.password);

      return {
        success: true,
        userPub: loginResult.userpub,
        password: result.password,
        credentialId: result.credentialId,
      };
    } catch (error: any) {
      console.error("Errore nel login con WebAuthn:", error);
      return {
        success: false,
        error: error.message || "Errore nel login con WebAuthn",
      };
    }
  }

  /**
   * Ottiene i dispositivi WebAuthn dell'utente
   */
  async getWebAuthnDevices(username: string): Promise<any[]> {
    if (!this.webauthn) {
      throw new Error("WebAuthn non è inizializzato");
    }
    return this.webauthn.getDevices(username);
  }

  // ==========================================
  // Metodi di Wallet
  // ==========================================

  /**
   * Deriva un wallet dall'indice
   */
  async deriveWallet(
    userpub: any,
    index: any
  ): Promise<{
    wallet: HDNodeWallet;
    path: string;
    address: string;
    getAddressString: () => string;
    signMessage: (
      message: string | Uint8Array<ArrayBufferLike>
    ) => Promise<string>;
  }> {
    const user = {
      pub: typeof userpub === "string" ? userpub : userpub.pub,
    };

    log("Derivazione wallet per utente:", user.pub, "indice:", index);

    // Ottieni o crea la chiave master
    const hdnode = await this.hedgehog.getMasterHDNode(user.pub);
    if (!hdnode) {
      throw new Error("Impossibile ottenere la chiave master");
    }

    // Deriva il wallet dall'indice
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = hdnode.derivePath(path);
    const address = await wallet.getAddress();

    return {
      wallet,
      path,
      address,
      getAddressString: () => address,
      signMessage: (message: string | Uint8Array<ArrayBufferLike>) =>
        this.signMessage(wallet, message),
    };
  }

  /**
   * Firma un messaggio con un wallet
   */
  async signMessage(
    wallet: {
      signMessage: (arg0: any) => any;
      _privKey: string | ethers.SigningKey;
    },
    message: string | Uint8Array<ArrayBufferLike>
  ) {
    try {
      log("Firma messaggio");
      return await wallet.signMessage(message);
    } catch (error) {
      console.error("Errore durante la firma del messaggio:", error);
      throw error;
    }
  }

  /**
   * Verifica una firma
   */
  verifySignature(
    message: string | Uint8Array<ArrayBufferLike>,
    signature: ethers.SignatureLike
  ) {
    try {
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      console.error("Errore durante la verifica della firma:", error);
      throw error;
    }
  }

  /**
   * Salva i percorsi del wallet
   */
  async saveWalletPaths(userpub: string, paths: any) {
    try {
      log("Salvataggio percorsi wallet per utente:", userpub);

      // Verifica se i percorsi sono validi
      if (!paths || Object.keys(paths).length === 0) {
        log("Nessun percorso da salvare");
        return;
      }

      await new Promise<void>((resolve) => {
        this.gun
          .user(userpub)
          .get("walletPaths")
          .put(paths, () => {
            resolve();
          });
      });

      log("Percorsi wallet salvati con successo");
    } catch (error) {
      console.error("Errore durante il salvataggio dei percorsi:", error);
      throw error;
    }
  }

  /**
   * Ottiene i percorsi del wallet
   */
  async getWalletPaths(userpub: string) {
    try {
      log("Recupero percorsi wallet per utente:", userpub);

      return new Promise<any>((resolve) => {
        this.gun
          .user(userpub)
          .get("walletPaths")
          .once((data: any) => {
            if (!data) {
              resolve({});
              return;
            }
            resolve(data);
          });
      });
    } catch (error) {
      console.error("Errore durante il recupero dei percorsi:", error);
      throw error;
    }
  }

  /**
   * Carica tutti i wallet
   */
  async loadWallets(): Promise<WalletInfo[]> {
    try {
      const pair = this.storage.getPairSync();
      if (!pair || !pair.pub) {
        log("Utente non autenticato, impossibile caricare i wallet");
        return [];
      }

      const paths = await this.getWalletPaths(pair.pub);
      if (!paths) {
        log("Nessun percorso wallet trovato");
        return [];
      }

      const indexes = Object.keys(paths);
      log("Caricamento wallet, indici trovati:", indexes);

      const wallets = await Promise.all(
        indexes.map(async (index) => {
          const wallet = await this.deriveWallet(pair.pub, parseInt(index));
          return {
            wallet: wallet.wallet,
            path: wallet.path,
            address: wallet.address,
            getAddressString: wallet.getAddressString,
          } as WalletInfo;
        })
      );

      return wallets;
    } catch (error) {
      console.error("Errore durante il caricamento dei wallet:", error);
      return [];
    }
  }

  /**
   * Aggiorna la chiave pubblica Gun
   */
  async updateGunPublicKey(): Promise<string | null> {
    try {
      const pair = this.storage.getPairSync();
      if (!pair || !pair.pub) {
        log(
          "Utente non autenticato, impossibile aggiornare la chiave pubblica"
        );
        return null;
      }

      await this.gun.user().auth(pair);
      log("Chiave pubblica Gun aggiornata con successo");
      return pair.pub;
    } catch (error) {
      console.error(
        "Errore durante l'aggiornamento della chiave pubblica:",
        error
      );
      return null;
    }
  }

  /**
   * Crea un nuovo wallet
   */
  async createWallet(): Promise<WalletInfo> {
    try {
      const pair = this.storage.getPairSync();
      if (!pair || !pair.pub) {
        throw new Error("Utente non autenticato");
      }

      const paths = await this.getWalletPaths(pair.pub);
      const indexes = Object.keys(paths || {});

      // Trova il prossimo indice disponibile
      let nextIndex = 0;
      if (indexes.length > 0) {
        nextIndex = Math.max(...indexes.map((i) => parseInt(i))) + 1;
      }

      log("Creazione nuovo wallet con indice:", nextIndex);

      // Deriva il nuovo wallet
      const wallet = await this.deriveWallet(pair.pub, nextIndex);

      // Aggiorna i percorsi
      const newPaths = { ...(paths || {}), [nextIndex]: wallet.path };
      await this.saveWalletPaths(pair.pub, newPaths);

      return {
        wallet: wallet.wallet,
        path: wallet.path,
        address: wallet.address,
        getAddressString: wallet.getAddressString,
      };
    } catch (error) {
      console.error("Errore durante la creazione del wallet:", error);
      throw error;
    }
  }

  // ==========================================
  // Metodi Helper per Autenticazione UI
  // ==========================================

  /**
   * Gestisce il login dell'utente (Helper per UI)
   */
  async handleLogin(
    username: string,
    password: string,
    {
      setUserpub,
      setSignedIn,
    }: { setUserpub?: Function; setSignedIn?: Function }
  ): Promise<AuthResult> {
    try {
      log("Gestione login utente:", username);

      const result = await this.login(username, password);

      if (setUserpub) {
        setUserpub(result.userpub);
      }

      if (setSignedIn) {
        setSignedIn(true);
      }

      return this.createAuthResult(true, {
        userPub: result.userpub,
        wallet: result.wallet,
        username,
      });
    } catch (error: any) {
      console.error("Errore durante la gestione del login:", error);
      return this.createAuthResult(false, {
        error: error.message || "Errore durante il login",
      });
    }
  }

  /**
   * Gestisce la registrazione dell'utente (Helper per UI)
   */
  async handleSignUp(
    username: string,
    password: string,
    passwordConfirmation: string,
    {
      setErrorMessage,
      setUserpub,
      setSignedIn,
      messages = {},
    }: {
      setErrorMessage?: Function;
      setUserpub?: Function;
      setSignedIn?: Function;
      messages?: { [key: string]: string };
    }
  ): Promise<AuthResult> {
    try {
      // Validazioni
      if (!username) {
        const errorMsg =
          messages.emptyUsername || "Username non può essere vuoto";
        if (setErrorMessage) setErrorMessage(errorMsg);
        return this.createAuthResult(false, { error: errorMsg });
      }

      if (!password) {
        const errorMsg =
          messages.emptyPassword || "Password non può essere vuota";
        if (setErrorMessage) setErrorMessage(errorMsg);
        return this.createAuthResult(false, { error: errorMsg });
      }

      if (password !== passwordConfirmation) {
        const errorMsg =
          messages.passwordMismatch || "Le password non corrispondono";
        if (setErrorMessage) setErrorMessage(errorMsg);
        return this.createAuthResult(false, { error: errorMsg });
      }

      log("Gestione registrazione utente:", username);

      // Effettua la registrazione
      const result = await this.signUp(username, password);

      if (!result.success) {
        const errorMsg = result.error || "Errore durante la registrazione";
        if (setErrorMessage) setErrorMessage(errorMsg);
        return this.createAuthResult(false, { error: errorMsg });
      }

      // Login automatico dopo la registrazione
      return await this.handleLogin(username, password, {
        setUserpub,
        setSignedIn,
      });
    } catch (error: any) {
      console.error("Errore durante la gestione della registrazione:", error);
      const errorMsg = error.message || "Errore durante la registrazione";
      if (setErrorMessage) setErrorMessage(errorMsg);
      return this.createAuthResult(false, { error: errorMsg });
    }
  }

  // ==========================================
  // Metodi Privati di Utilità
  // ==========================================

  /**
   * Inizializza i percorsi del wallet
   */
  private async initializeWalletPaths(userPub: string): Promise<void> {
    try {
      log("Inizializzazione percorsi wallet per utente:", userPub);

      // Verifica se esistono già percorsi
      const existingPaths = await this.getWalletPaths(userPub);
      if (existingPaths && Object.keys(existingPaths).length > 0) {
        log("Percorsi wallet già esistenti:", existingPaths);
        return;
      }

      // Crea il percorso iniziale
      const wallet = await this.deriveWallet(userPub, 0);

      // Salva il percorso
      await this.saveWalletPaths(userPub, { 0: wallet.path });

      log("Percorsi wallet inizializzati con successo");
    } catch (error) {
      console.error(
        "Errore durante l'inizializzazione dei percorsi wallet:",
        error
      );
      throw error;
    }
  }

  /**
   * Autentica con Hedgehog
   */
  private async authenticateWithHedgehog(
    username: string,
    password: string
  ): Promise<any> {
    try {
      log("Tentativo di autenticazione con Hedgehog:", username);
      const result = await this.hedgehog.signIn(username, password);
      log("Autenticazione Hedgehog completata");
      return result;
    } catch (error) {
      console.error("Errore durante l'autenticazione con Hedgehog:", error);
      throw error;
    }
  }

  /**
   * Autentica con Gun
   */
  private async authenticateWithGun(
    username: string,
    password: string
  ): Promise<string> {
    try {
      log("Tentativo di autenticazione con Gun:", username);

      return new Promise((resolve, reject) => {
        this.gun.user().auth(username, password, (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            resolve(ack.sea.pub);
          }
        });
      });
    } catch (error) {
      console.error("Errore durante l'autenticazione con Gun:", error);
      throw error;
    }
  }

  /**
   * Inizializza i dati dell'utente
   */
  private async initializeUserData(
    username: string,
    password: string,
    userPub: string
  ): Promise<void> {
    try {
      log("Inizializzazione dati utente:", username);

      // Salva la coppia di chiavi
      await this.storage.setPair({ pub: userPub, priv: password });

      // Salva l'alias dell'utente
      await this.saveAlias(userPub, username);

      // Inizializza dati personali
      await new Promise<void>((resolve) => {
        this.gun
          .user()
          .get("profile")
          .put(
            {
              username,
              id: uuid.v4(),
            },
            () => {
              resolve();
            }
          );
      });

      log("Dati utente inizializzati con successo");
    } catch (error) {
      console.error(
        "Errore durante l'inizializzazione dei dati utente:",
        error
      );
      throw error;
    }
  }

  /**
   * Salva l'alias dell'utente (sostituzione di gundb.saveAlias)
   */
  private async saveAlias(userPub: string, username: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.gun.get("~@" + username).put({ "#": userPub }, () => {
        resolve();
      });
    });
  }

  // ==========================================
  // Gestione Eventi
  // ==========================================

  /**
   * Registra un listener per un evento
   */
  public on<K extends keyof ShogunEvents>(
    event: K,
    listener: ShogunEvents[K]
  ): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Rimuove un listener per un evento
   */
  public off<K extends keyof ShogunEvents>(
    event: K,
    listener: ShogunEvents[K]
  ): void {
    this.eventEmitter.off(event, listener);
  }
}

// Esporta la classe principale
export default ShogunSDK;
