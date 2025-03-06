import { ethers } from "ethers";
import { HDNodeWallet } from "ethers";
declare module "uuid";
import * as uuid from "uuid";
import { GunDB } from "./gun/gun";

// Ignorare gli errori di typescript per gli import di moduli che esistono a runtime
import {
  Webauthn,
  WebAuthnCredentials,
} from "./webauthn/webauthn";
import { MetaMask } from "./connector/metamask";
import {
  Stealth,
  StealthKeyPair,
  StealthAddressResult,
} from "./stealth/stealth";
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

// import hedgehog
// import { Hedgehog } from "@audius/hedgehog";openStealthAddress
import "./hedgehog/browser";

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
 * Shogun SDK - Decentralized Authentication Protocol
 *
 * This SDK implements a 3-layer authentication protocol:
 *
 * 1. Credential Generation Layer
 *    - User/Password: Standard username and password credentials
 *    - MetaMask: Ethereum wallet-based authentication using digital signatures
 *    - WebAuthn: Biometric and hardware security key authentication (FIDO2)
 *
 * 2. Hedgehog Layer
 *    - Provides cryptographic identity management
 *    - Generates and manages key pairs for users
 *    - Handles encryption and decryption operations
 *
 * 3. GunDB Layer
 *    - Decentralized database for user data storage
 *    - Peer-to-peer synchronization
 *    - Encrypted data storage
 *
 * Authentication Flow:
 * 1. User provides credentials (username/password, MetaMask signature, or WebAuthn)
 * 2. Credentials are verified and used to authenticate with Hedgehog
 * 3. Hedgehog credentials are used to authenticate with GunDB
 * 4. Upon successful authentication, user data is accessible
 */

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
    const isNode = typeof window === "undefined";
    this.storage = new Storage();

    // Inizializza GunDB
    this.gundb = new GunDB(config.peers);
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

    // Inizializza i moduli
    try {
      this.webauthn = new Webauthn();
      log("Modulo WebAuthn inizializzato con successo");
    } catch (error) {
      console.error("Errore nell'inizializzazione del modulo WebAuthn:", error);
      // Creiamo un oggetto vuoto per evitare errori null
      this.webauthn = {
        generateCredentials: () =>
          Promise.resolve({
            success: false,
            error: "WebAuthn non inizializzato correttamente",
          }),
        authenticateUser: () =>
          Promise.resolve({
            success: false,
            error: "WebAuthn non inizializzato correttamente",
          }),
        isSupported: () => false,
      } as any;
    }

    try {
      this.metamask = new MetaMask();
      log("Modulo MetaMask inizializzato con successo");
    } catch (error) {
      console.error("Errore nell'inizializzazione del modulo MetaMask:", error);
      this.metamask = undefined;
    }

    try {
      this.stealth = new Stealth();
      log("Modulo Stealth inizializzato con successo");
    } catch (error) {
      console.error("Errore nell'inizializzazione del modulo Stealth:", error);
      this.stealth = undefined;
    }

    this.initGunSession();
    this.eventEmitter = new ShogunEventEmitter();

    // Aggiungiamo un handler di debug per gli eventi in development
    if (process.env.NODE_ENV === "development") {
      this.eventEmitter.on("error", (data) => {
        console.error("ShogunSDK Error:", data);
      });

      this.eventEmitter.on("auth:signup", (data) => {
        console.log("ShogunSDK Signup:", data);
      });
    }
  }

  // ==========================================
  // Metodi Core e inizializzazione
  // ==========================================

  /**
   * Verifica che l'istanza Gun sia disponibile
   */
  checkGun() {
    if (!this.gundb || !this.gundb.gun) {
      throw new Error("Gun DB is not initialized");
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
   * Register a new user
   */
  async signUp(username: string, password: string): Promise<SignUpResult> {
    try {
      log("Attempting user registration:", username);
      this.checkGun();

      // First try to login with Hedgehog to see if the user exists
      log("Checking Hedgehog user existence...");
      try {
        const result = await this.hedgehog.login(username, password);
        if (result) {
          // If the user already exists and login is successful, emit the event and return success
          const userPub = result.pub || "";

          log("User already exists, login completed");

          this.eventEmitter.emit("auth:signup", {
            userPub,
            username,
            method: "password",
          });

          return { success: true, wallet: result, pub: userPub };
        }
      } catch (hedgehogError) {
        log("User does not exist in Hedgehog, proceeding with registration");
      }

      // Then try to create the GUN user
      log("Creating GUN user...");
      let gunErrorCaught = false;
      try {
        const result = await this.gundb.createGunUser(username, password);
        log("GUN user created successfully:", result);

        // Save the user's public key
        await this.gundb.authenticateGunUser(username, password);

        const user = this.gun.user();
        let pub = user?.is?.epub;

        if (!pub) {
          throw new Error("Public key not available");
        }

        // Explicitly save user data using the public key
        await new Promise((resolve, reject) => {
          this.gun
            .get("users")
            .get(pub)
            .put(
              {
                username: username,
                epub: pub,
                created: Date.now(),
              },
              (ack) => {
                if ("err" in ack) reject(new Error(ack.err));
                else resolve(ack);
              }
            );
        });

        log("User data saved in GUN with public key");

        // Save the pair in sessionStorage for persistence
        try {
          const pair = (this.gun.user() as any)._.sea;
          if (pair) {
            sessionStorage.setItem("gun-current-pair", JSON.stringify(pair));
            log("Gun pair saved in sessionStorage");
          }
        } catch (pairError) {
          log("Could not save Gun pair:", pairError);
        }
      } catch (gunError) {
        gunErrorCaught = true;
        if (
          gunError instanceof Error &&
          gunError.message.includes("User already created")
        ) {
          log("GUN user already exists, attempting authentication...");
          await this.gundb.authenticateGunUser(username, password);
          log("GUN authentication with existing user completed");

          // Save the pair in sessionStorage for persistence
          try {
            const pair = (this.gun.user() as any)._.sea;
            if (pair) {
              sessionStorage.setItem("gun-current-pair", JSON.stringify(pair));
              log("Gun pair saved in sessionStorage");
            }
          } catch (pairError) {
            log("Could not save Gun pair:", pairError);
          }
        } else {
          throw gunError;
        }
      }

      log("Updating public key...");
      await this.updateGunPublicKey();

      // Registration or login with Hedgehog
      log("Registering Hedgehog user...");
      let wallet;
      try {
        wallet = await this.hedgehog.signUp(username, password);
        log("Hedgehog user registered successfully");
      } catch (hedgehogError) {
        if (
          hedgehogError instanceof Error &&
          hedgehogError.message.includes("User already created")
        ) {
          log("Hedgehog user already exists, attempting login...");
          wallet = await this.hedgehog.login(username, password);
          log("Hedgehog login with existing user completed");
        } else {
          throw hedgehogError;
        }
      }

      // Final verification and setup
      const user = this.gun.user();
      if (!user.is) {
        log("GUN re-authentication needed...");
        await this.gundb.authenticateGunUser(username, password);

        // Save the pair in sessionStorage for persistence
        try {
          const pair = (user as any)._.sea;
          if (pair) {
            sessionStorage.setItem("gun-current-pair", JSON.stringify(pair));
            log("Gun pair saved in sessionStorage after re-authentication");
          }
        } catch (pairError) {
          log("Could not save Gun pair:", pairError);
        }
      }

      // Update public key
      const userPub = user?.is?.epub || "";

      log("Registration completed successfully");

      this.eventEmitter.emit("auth:signup", {
        userPub,
        username,
        method: "password",
      });

      return { success: true, wallet: wallet, pub: userPub };
    } catch (error: any) {
      console.error("Error during registration:", error);
      // Cleanup in case of error
      try {
        this.gun.user()?.leave();
        sessionStorage.removeItem("gun-current-pair");
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError);
      }
      this.eventEmitter.emit("error", {
        code: "AUTH_SIGNUP_ERROR",
        message: error.message || "Error during registration",
        details: error,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Login a user
   */
  async login(
    username: string,
    password: string
  ): Promise<{ wallet: any; userpub: string }> {
    return this.loginWithCredentials(username, password, "password");
  }

  /**
   * Login with specific credentials
   */
  private async loginWithCredentials(
    username: string,
    password: string,
    method: string
  ): Promise<{ wallet: any; userpub: string }> {
    try {
      log("Attempting login with specific credentials:", { username, method });
      this.checkGun();

      // Authenticate with Hedgehog
      const hedgehogResult = await this.authenticateWithHedgehog(
        username,
        password
      );
      log("Hedgehog authentication result:", hedgehogResult);

      if (!hedgehogResult) {
        throw new Error("Hedgehog authentication failed");
      }

      // Authenticate with Gun
      log("Attempting Gun authentication...");
      const gunResult = await this.authenticateWithGun(username, password);
      log("Gun authentication result:", gunResult);

      if (!gunResult) {
        throw new Error("Gun authentication failed");
      }

      // Save the key pair
      await this.storage.setPair({
        pub: gunResult,
        priv: password,
        method: method,
      });

      // Save the pair in sessionStorage for persistence
      try {
        const pair = (this.gun.user() as any)._.sea;
        if (pair) {
          sessionStorage.setItem("gun-current-pair", JSON.stringify(pair));
          log("Gun pair saved in sessionStorage during login");
        }
      } catch (pairError) {
        log("Could not save Gun pair during login:", pairError);
      }

      // Update the public key
      await this.updateGunPublicKey();

      log("Login completed successfully for:", username);

      // Notify login event
      this.eventEmitter.emit("auth:login", {
        username,
        userPub: gunResult,
        method: method,
      });

      return { wallet: hedgehogResult, userpub: gunResult };
    } catch (error: any) {
      console.error("Error during login:", error);
      this.eventEmitter.emit("error", {
        code: "AUTH_LOGIN_ERROR",
        message: error.message || "Error during login",
        details: error,
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
    log("Logout completed");
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
   * Normalizza un indirizzo Ethereum per l'uso come username
   */
  private normalizeEthAddress(address: string): string {
    // Se l'indirizzo è già in formato username (metamask_*), restituiscilo così com'è
    if (address.startsWith("metamask_")) {
      return address;
    }

    // Normalizza l'indirizzo Ethereum (tutto minuscolo)
    return address.toLowerCase();
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

      // Cerca credenziali MetaMask salvate
      const savedCredentials = this.storage.getItem("metamask_credentials");
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        const normalizedSaved = this.normalizeEthAddress(credentials.username);
        const normalizedRequested = this.normalizeEthAddress(username);

        log(
          `Confronto credenziali: richiesto=${normalizedRequested}, salvato=${normalizedSaved}`
        );

        // Se l'username normalizzato corrisponde, usa la password salvata
        if (normalizedSaved === normalizedRequested) {
          log("Usando credenziali MetaMask salvate");
          password = credentials.password;
          // Aggiorna anche l'username se necessario
          username = normalizedSaved;
        }
      }

      try {
        // Tenta il login diretto con Hedgehog
        const result = await this.hedgehog.login(username, password);
        log("Autenticazione Hedgehog completata");
        return result;
      } catch (hedgehogError) {
        // Se fallisce, prova a recuperare l'utente dal database Gun
        log("Errore login Hedgehog, tentativo alternativo:", hedgehogError);

        // Qui potremmo provare un approccio alternativo...

        throw hedgehogError; // Per ora rilancia l'errore
      }
    } catch (error) {
      console.error("Errore durante l'autenticazione con Hedgehog:", error);
      throw error;
    }
  }

  /**
   * Recupera le credenziali MetaMask da GunDB
   * @private
   */
  private async getMetaMaskCredentials(address: string): Promise<any | null> {
    try {
      return new Promise((resolve) => {
        this.gun
          .get(this.metamask?.AUTH_DATA_TABLE || "AuthData")
          .get(address.toLowerCase())
          .once((data: any) => {
            resolve(data);
          });
      });
    } catch (error) {
      console.error("Errore nel recupero delle credenziali MetaMask:", error);
      return null;
    }
  }

  /**
   * Effettua il login con MetaMask
   */
  async loginWithMetaMask(address: string): Promise<AuthResult> {
    try {
      if (!this.metamask) {
        console.error("MetaMask is not initialized");
        return this.createAuthResult(false, {
          error: "MetaMask is not initialized",
        });
      }

      if (!this.gundb) {
        console.error("Gun DB is not initialized");
        return this.createAuthResult(false, {
          error: "Gun DB is not initialized",
        });
      }

      // Normalizza l'indirizzo (solo minuscolo)
      const normalizedAddress = address.toLowerCase();
      log("Tentativo di login con MetaMask, indirizzo:", address);
      log("Indirizzo normalizzato:", normalizedAddress);

      // Genera credenziali (include firma e verifica)
      const credentials = await this.metamask.generateCredentials(address);

      // Imposta l'username come indirizzo normalizzato
      credentials.username = normalizedAddress;

      // Non salviamo più le credenziali, sono generate deterministicamente

      try {
        // Effettua login con le credenziali generate
        const result = await this.loginWithCredentials(
          credentials.username,
          credentials.password,
          "metamask"
        );

        return this.createAuthResult(true, {
          username: credentials.username,
          password: credentials.password,
          wallet: result.wallet,
        });
      } catch (error) {
        console.error("Error in MetaMask login:", error);
        return this.createAuthResult(false, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Error in MetaMask login:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Effettua la registrazione con MetaMask
   */
  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    try {
      if (!this.metamask) {
        console.error("MetaMask is not initialized");
        return this.createAuthResult(false, {
          error: "MetaMask is not initialized",
        });
      }

      if (!this.gundb) {
        console.error("Gun DB is not initialized");
        return this.createAuthResult(false, {
          error: "Gun DB is not initialized",
        });
      }

      // Normalize address (lowercase only)
      const normalizedAddress = address.toLowerCase();
      log("Verifying user existence for:", address);
      log("Normalized address:", normalizedAddress);

      // Check if gun is on
      this.checkGun();

      // First check if the user already exists
      const userExists = await this.checkUserExists(normalizedAddress);

      // If the user already exists, try to login
      if (userExists) {
        log("User already exists, attempting login...");
        return await this.loginWithMetaMask(address);
      }

      // Generate credentials (includes signing and verification)
      const credentials = await this.metamask.generateCredentials(address);

      // Set username as normalized address
      credentials.username = normalizedAddress;

      // Non salviamo più le credenziali, sono generate deterministicamente

      // Register the user
      try {
        const result = await this.signUp(
          credentials.username,
          credentials.password
        );

        if (!result.success) {
          return this.createAuthResult(false, {
            error: result.error || "Error during signup",
          });
        }

        return this.createAuthResult(true, {
          username: credentials.username,
          password: credentials.password,
          wallet: result.wallet,
        });
      } catch (error) {
        console.error("Error in MetaMask signup:", error);
        return this.createAuthResult(false, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Error in MetaMask signup:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Verifica se un utente esiste
   */
  private async checkUserExists(username: string): Promise<boolean> {
    try {
      log("Verifica esistenza utente GUN:", username);

      // Prima verifichiamo in GunDB
      return await new Promise<boolean>((resolve) => {
        // Imposta un timeout per evitare che la promessa si blocchi
        const timeoutId = setTimeout(() => {
          log("Timeout verifica utente, assumiamo che non esista");
          resolve(false);
        }, 5000);

        this.gun
          .get("Users")
          .get(username)
          .once((data: any) => {
            clearTimeout(timeoutId);
            const exists = !!data;
            log(
              `Utente ${username} ${exists ? "esiste" : "non esiste"} in GUN`
            );
            resolve(exists);
          });
      });
    } catch (error) {
      log("Errore durante la verifica dell'utente:", error);
      return false;
    }
  }

  // ==========================================
  // Metodi WebAuthn
  // ==========================================

  /**
   * Check if WebAuthn is supported
   */
  isWebAuthnSupported(): boolean {
    // Check if WebAuthn is supported by the browser
    const browserSupport =
      typeof window !== "undefined" && window.PublicKeyCredential !== undefined;

    // Check if the WebAuthn module is properly initialized
    const moduleAvailable =
      !!this.webauthn &&
      typeof this.webauthn.generateCredentials === "function" &&
      typeof this.webauthn.authenticateUser === "function";

    // Both conditions must be true
    return browserSupport && moduleAvailable;
  }

  /**
   * Register a new user with WebAuthn
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
        throw new Error("WebAuthn is not supported in this browser");
      }

      if (!this.webauthn) {
        throw new Error("WebAuthn is not initialized");
      }

      // Recupera le credenziali esistenti (se presenti)
      const existingCredentials = await this.getWebAuthnCredentials(username);

      // Generate WebAuthn credentials
      const result = await this.webauthn.generateCredentials(
        username,
        existingCredentials,
        false
      );
      log("WebAuthn credentials generation result:", result);

      if (!result.success || !result.password) {
        throw new Error(result.error || "WebAuthn registration failed");
      }

      // Salva le credenziali WebAuthn
      if (result.webAuthnCredentials) {
        await this.saveWebAuthnCredentials(
          username,
          result.webAuthnCredentials
        );
      }

      // Important: Create Gun user with the same credentials
      log("Creating Gun user with WebAuthn credentials...");
      let userPub: string | undefined;
      try {
        // First check if the user already exists
        const userExists = await this.checkUserExists(username);

        if (!userExists) {
          // If the user doesn't exist, create it
          await this.gundb.createGunUser(username, result.password);
          log("Gun user successfully created for WebAuthn");
        } else {
          log("Gun user already exists for WebAuthn");
        }

        // Authenticate the Gun user
        await this.gundb.authenticateGunUser(username, result.password);
        log("Gun user successfully authenticated for WebAuthn");

        // Get the public key
        userPub = this.gun.user().is?.pub;
        if (!userPub) {
          throw new Error("Unable to get Gun user's public key");
        }

        // Save user data
        await new Promise((resolve, reject) => {
          this.gun
            .get("users")
            .get(userPub as string) // Ensure userPub is a string
            .put(
              {
                username: username,
                epub: userPub,
                created: Date.now(),
                authMethod: "webauthn",
              },
              (ack) => {
                if ("err" in ack) reject(new Error(ack.err));
                else resolve(ack);
              }
            );
        });

        log("WebAuthn user data saved in Gun");
      } catch (gunError) {
        console.error("Error creating Gun user for WebAuthn:", gunError);
        // Continue anyway, because WebAuthn authentication succeeded
      }

      // Logout before authenticating to avoid issues
      this.gun.user().leave();

      return {
        success: true,
        userPub: userPub,
        password: result.password,
        credentialId: result.credentialId,
      };
    } catch (error: any) {
      console.error("Error in WebAuthn registration:", error);
      return {
        success: false,
        error: error.message || "Error in WebAuthn registration",
      };
    }
  }

  /**
   * Login with WebAuthn
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
        throw new Error("WebAuthn is not supported in this browser");
      }

      if (!this.webauthn) {
        throw new Error("WebAuthn is not initialized");
      }

      // Logout before authenticating to avoid issues
      this.gun.user().leave();

      // Recupera il salt dalle credenziali WebAuthn
      const credentials = await this.getWebAuthnCredentials(username);
      const salt = credentials?.salt || null;

      // Authenticate the user with WebAuthn
      log("Attempting WebAuthn authentication for:", username);
      const result = await this.webauthn.authenticateUser(username, salt);
      log("WebAuthn authentication result:", result);

      if (!result.success || !result.password) {
        return {
          success: false,
          error: result.error || "WebAuthn authentication failed",
        };
      }

      // Directly authenticate with Gun using WebAuthn credentials
      try {
        log("Direct authentication with Gun using WebAuthn credentials...");
        await this.gundb.authenticateGunUser(username, result.password);

        // Get the user's public key
        const userPub = this.gun.user().is?.pub;
        if (!userPub) {
          throw new Error("Unable to get user's public key");
        }

        log("Gun authentication completed successfully using WebAuthn");

        return {
          success: true,
          userPub: userPub,
          password: result.password,
          credentialId: result.credentialId,
        };
      } catch (gunError: any) {
        console.error("Error in Gun authentication with WebAuthn:", gunError);

        // If direct authentication fails, try to create the user and then authenticate
        log("Attempting to create Gun user with WebAuthn credentials...");
        try {
          await this.gundb.createGunUser(username, result.password);
          await this.gundb.authenticateGunUser(username, result.password);

          // Get the user's public key
          const userPub = this.gun.user().is?.pub;
          if (!userPub) {
            throw new Error("Unable to get user's public key");
          }

          // Save user data
          await new Promise((resolve, reject) => {
            this.gun
              .get("users")
              .get(userPub as string) // Ensure userPub is a string
              .put(
                {
                  username: username,
                  epub: userPub,
                  created: Date.now(),
                  authMethod: "webauthn",
                },
                (ack) => {
                  if ("err" in ack) reject(new Error(ack.err));
                  else resolve(ack);
                }
              );
          });

          log("Gun user created and authenticated successfully for WebAuthn");

          return {
            success: true,
            userPub: userPub,
            password: result.password,
            credentialId: result.credentialId,
          };
        } catch (createError: any) {
          console.error("Error creating Gun user for WebAuthn:", createError);
          return {
            success: false,
            error: createError.message || "Error in WebAuthn authentication",
          };
        }
      }
    } catch (error: any) {
      console.error("Error in WebAuthn login:", error);
      return {
        success: false,
        error: error.message || "Error in WebAuthn login",
      };
    }
  }

  /**
   * Salva le informazioni WebAuthn per un utente (solo salt e dispositivi)
   * @private
   */
  private async saveWebAuthnCredentials(
    username: string,
    credentials: WebAuthnCredentials
  ): Promise<void> {
    // Salviamo solo il salt e le informazioni sui dispositivi, non le credenziali complete
    // Le credenziali possono essere rigenerate deterministicamente dal salt
    await this.gundb.writeToGun("WebAuthn", username, {
      salt: credentials.salt,
      timestamp: credentials.timestamp,
      credentials: credentials.credentials,
    });
  }

  /**
   * Recupera le informazioni WebAuthn per un utente
   * @private
   */
  private async getWebAuthnCredentials(
    username: string
  ): Promise<WebAuthnCredentials | null> {
    try {
      return new Promise((resolve) => {
        this.gun
          .get("WebAuthn")
          .get(username)
          .once((data: WebAuthnCredentials | null) => {
            resolve(data);
          });
      });
    } catch (error) {
      console.error("Errore nel recupero delle credenziali WebAuthn:", error);
      return null;
    }
  }

  /**
   * Get WebAuthn devices for a user
   */
  async getWebAuthnDevices(username: string): Promise<any[]> {
    if (!this.webauthn || !this.isWebAuthnSupported()) {
      return [];
    }

    try {
      const credentials = await this.getWebAuthnCredentials(username);
      if (!credentials?.credentials) {
        return [];
      }
      return Object.values(credentials.credentials);
    } catch (error) {
      console.error("Error getting WebAuthn devices:", error);
      return [];
    }
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
  async getWalletPaths(userpub: string): Promise<any> {
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
   * Handle user login (UI Helper)
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
      log("Handling user login:", username);

      // Normalize username only if it's an Ethereum address
      let normalizedUsername = username;
      if (username.startsWith("0x") && username.length === 42) {
        normalizedUsername = this.normalizeEthAddress(username);
      }

      // If it's a MetaMask username, check for saved credentials
      if (normalizedUsername.startsWith("metamask_")) {
        const savedCredentials = this.storage.getItem("metamask_credentials");
        if (savedCredentials) {
          const credentials = JSON.parse(savedCredentials);
          if (credentials.username === normalizedUsername) {
            log("Using saved MetaMask credentials for:", normalizedUsername);
            password = credentials.password;
          }
        }
      }

      const result = await this.loginWithCredentials(
        normalizedUsername,
        password,
        "password"
      );

      if (setUserpub) {
        setUserpub(result.userpub);
      }

      if (setSignedIn) {
        setSignedIn(true);
      }

      // Update Gun public key
      await this.updateGunPublicKey();

      log("Login completed successfully for:", normalizedUsername);

      return this.createAuthResult(true, {
        userPub: result.userpub,
        wallet: result.wallet,
      });
    } catch (error: any) {
      console.error("Error during login:", error);

      this.eventEmitter.emit("error", {
        code: "AUTH_LOGIN_ERROR",
        message: error.message,
        details: error,
      });

      return this.createAuthResult(false, {
        error: error.message,
      });
    }
  }

  /**
   * Handle user signup (UI Helper)
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
      // Password validation
      if (password !== passwordConfirmation) {
        const error = messages.passwordMismatch || "Passwords do not match";
        if (setErrorMessage) setErrorMessage(error);

        this.eventEmitter.emit("error", {
          code: "PASSWORD_MISMATCH",
          message: error,
        });

        return this.createAuthResult(false, { error });
      }

      // Normalize username only if it's an Ethereum address
      let normalizedUsername = username;
      if (username.startsWith("0x") && username.length === 42) {
        normalizedUsername = this.normalizeEthAddress(username);
      }
      log("Handling user registration:", normalizedUsername);

      const result = (await this.signUp(
        normalizedUsername,
        password
      )) as SignUpResult;

      if (!result.success || result.error) {
        if (setErrorMessage) setErrorMessage(result.error);
        return this.createAuthResult(false, { error: result.error });
      }

      // Login after successful signup
      const loginResult = await this.login(normalizedUsername, password);

      if (setUserpub) {
        setUserpub(loginResult.userpub);
      }

      if (setSignedIn) {
        setSignedIn(true);
      }

      log(
        "Registration and login completed successfully for:",
        normalizedUsername
      );

      return this.createAuthResult(true, {
        userPub: loginResult.userpub,
        wallet: loginResult.wallet,
      });
    } catch (error: any) {
      console.error("Error during registration:", error);

      if (setErrorMessage) {
        setErrorMessage(error.message);
      }

      this.eventEmitter.emit("error", {
        code: "AUTH_SIGNUP_ERROR",
        message: error.message,
        details: error,
      });

      return this.createAuthResult(false, {
        error: error.message,
      });
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
   * Authenticate with Gun
   */
  private async authenticateWithGun(
    username: string,
    password: string
  ): Promise<string> {
    log("Attempting authentication with Gun:", username);

    try {
      // First, ensure we're not already authenticated
      this.gun.user().leave();

      // Attempt to authenticate
      return new Promise((resolve, reject) => {
        this.gun.user().auth(username, password, (ack: any) => {
          if (ack.err) {
            log("Gun authentication error:", ack.err);
            reject(new Error(ack.err));
            return;
          }

          // Check if authentication was successful
          const user = this.gun.user();
          if (!user.is) {
            log("Gun authentication failed - user is not authenticated");
            reject(new Error("Gun authentication failed"));
            return;
          }

          const userPub = user.is.pub;
          if (!userPub) {
            log("Gun authentication failed - public key not available");
            reject(new Error("Public key not available"));
            return;
          }

          log("Gun authentication completed successfully, pub:", userPub);

          // Save the pair in sessionStorage for persistence
          try {
            const pair = (user as any)._.sea;
            if (pair) {
              sessionStorage.setItem("gun-current-pair", JSON.stringify(pair));
              log("Gun pair saved in sessionStorage during authentication");
            }
          } catch (pairError) {
            log("Could not save Gun pair during authentication:", pairError);
          }

          resolve(userPub);
        });
      });
    } catch (error) {
      log("Error during Gun authentication:", error);
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

  /**
   * Rimuove un dispositivo WebAuthn per un utente
   */
  async removeWebAuthnDevice(
    username: string,
    credentialId: string
  ): Promise<boolean> {
    if (!this.webauthn || !this.isWebAuthnSupported()) {
      return false;
    }

    try {
      const credentials = await this.getWebAuthnCredentials(username);
      if (!credentials) {
        return false;
      }

      const result = await this.webauthn.removeDevice(
        username,
        credentialId,
        credentials
      );

      if (result.success && result.updatedCredentials) {
        await this.saveWebAuthnCredentials(username, result.updatedCredentials);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error removing WebAuthn device:", error);
      return false;
    }
  }

  /**
   * Salva le chiavi stealth in GunDB
   * @private
   */
  private async saveStealthKeys(stealthKeyPair: StealthKeyPair): Promise<any> {
    if (!this.gun.user().is) {
      throw new Error("User not authenticated for saving stealth keys");
    }

    const appKeyPair = (this.gun.user() as any)._.sea;
    if (!appKeyPair) {
      throw new Error("Gun key pair not found");
    }

    log("Salvataggio chiavi stealth per utente:", appKeyPair.pub);

    try {
      // Prima crittografa i dati sensibili
      const encryptedPriv = await (Gun as any).SEA.encrypt(
        stealthKeyPair.priv,
        appKeyPair
      );
      const encryptedEpriv = await (Gun as any).SEA.encrypt(
        stealthKeyPair.epriv,
        appKeyPair
      );

      // Poi salva i dati crittografati
      return new Promise((resolve, reject) => {
        this.gun
          .get(this.stealth?.STEALTH_DATA_TABLE || "Stealth")
          .get(appKeyPair.pub)
          .put(
            {
              pub: stealthKeyPair.pub,
              priv: encryptedPriv,
              epub: stealthKeyPair.epub,
              epriv: encryptedEpriv,
              timestamp: Date.now(),
            },
            (ack: any) => {
              if (ack.err) {
                reject(new Error(ack.err));
              } else {
                resolve(ack);
              }
            }
          );
      });
    } catch (error) {
      console.error("Errore nel salvataggio delle chiavi stealth:", error);
      throw error;
    }
  }

  /**
   * Recupera le chiavi stealth dell'utente corrente
   * @private
   */
  private async getStealthKeys(): Promise<StealthKeyPair | null> {
    try {
      // Assicurati che Gun sia inizializzato
      if (!this.gun) {
        console.error("Gun non è inizializzato");
        return null;
      }

      // Recupera l'utente
      this.gun.user().recall({ sessionStorage: true });

      // Verifica che l'utente sia autenticato
      if (!this.gun.user().is) {
        console.error("Utente non autenticato");
        return null;
      }

      // Ottieni la coppia di chiavi dell'app
      const appKeyPair = (this.gun.user() as any)._.sea;

      // Verifica che le chiavi dell'app siano valide
      if (!appKeyPair || !appKeyPair.pub) {
        console.error("Chiavi dell'app non valide");
        return null;
      }

      log("Cercando chiavi stealth per pub:", appKeyPair.pub);

      return new Promise((resolve, reject) => {
        this.gun
          .get(this.stealth?.STEALTH_DATA_TABLE || "Stealth")
          .get(appKeyPair.pub)
          .once(async (data: any) => {
            // Log per debug
            log("Dati stealth trovati:", data);

            if (!data) {
              console.warn("Nessun dato stealth trovato per", appKeyPair.pub);
              resolve(null);
              return;
            }

            try {
              // Verifica che i dati crittografati esistano
              if (!data.priv || !data.epriv) {
                console.error("Dati stealth incompleti");
                resolve(null);
                return;
              }

              // Decrittografa i dati
              log("Tentativo di decrittare i dati stealth...");
              const decryptedPriv = await (Gun as any).SEA.decrypt(
                data.priv,
                appKeyPair
              );
              const decryptedEpriv = await (Gun as any).SEA.decrypt(
                data.epriv,
                appKeyPair
              );

              if (!decryptedPriv || !decryptedEpriv) {
                console.error("Decrittazione fallita");
                resolve(null);
                return;
              }

              // Restituisci le chiavi decrittate
              resolve({
                pub: data.pub,
                priv: decryptedPriv,
                epub: data.epub,
                epriv: decryptedEpriv,
              });
            } catch (error) {
              console.error("Errore nella decrittazione:", error);
              reject(error);
            }
          });
      });
    } catch (error) {
      console.error("Errore nel recupero delle chiavi stealth:", error);
      return null;
    }
  }

  /**
   * Recupera la chiave pubblica stealth di un utente
   * @private
   */
  private async getStealthPublicKey(publicKey: string): Promise<string | null> {
    const formattedPubKey = this.stealth?.formatPublicKey(publicKey);
    if (!formattedPubKey) {
      return null;
    }

    return new Promise((resolve) => {
      this.gun
        .get(this.stealth?.STEALTH_DATA_TABLE || "Stealth")
        .get(formattedPubKey)
        .once((data: any) => {
          resolve(data?.epub || null);
        });
    });
  }

  /**
   * Crea un nuovo account stealth o recupera quello esistente
   */
  async createStealthAccount(): Promise<StealthKeyPair | null> {
    try {
      if (!this.stealth) {
        throw new Error("Stealth module not initialized");
      }

      // Verifica se esistono già delle chiavi
      const existingKeys = await this.getStealthKeys();
      if (existingKeys) {
        log("Chiavi stealth esistenti trovate");
        return existingKeys;
      }

      log("Creazione nuove chiavi stealth...");

      // Verifica che l'utente sia disponibile
      if (!this.gun.user().is) {
        throw new Error("User not authenticated");
      }

      // Genera nuove chiavi stealth
      const stealthKeyPair = await this.stealth.createAccount();

      // Salva le chiavi
      await this.saveStealthKeys(stealthKeyPair);
      log("Chiavi stealth salvate con successo");

      return stealthKeyPair;
    } catch (error) {
      console.error("Errore in createStealthAccount:", error);
      throw error;
    }
  }

  /**
   * Genera un indirizzo stealth per un destinatario
   */
  async generateStealthAddress(
    recipientPublicKey: string
  ): Promise<StealthAddressResult | null> {
    try {
      if (!this.stealth) {
        throw new Error("Stealth module not initialized");
      }

      // Recupera la chiave pubblica del destinatario
      const pubKey = await this.getStealthPublicKey(recipientPublicKey);
      if (!pubKey) {
        throw new Error("Recipient public key not found");
      }

      // Genera l'indirizzo stealth
      return await this.stealth.generateStealthAddress(pubKey);
    } catch (error) {
      console.error("Errore in generateStealthAddress:", error);
      throw error;
    }
  }

  /**
   * Apre un indirizzo stealth
   */
  async openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string
  ): Promise<ethers.Wallet | null> {
    try {
      if (!this.stealth) {
        throw new Error("Stealth module not initialized");
      }

      // Recupera le chiavi stealth dell'utente
      const stealthKeys = await this.getStealthKeys();
      if (!stealthKeys) {
        throw new Error("Stealth keys not found");
      }

      // Apri l'indirizzo stealth
      return await this.stealth.openStealthAddress(
        stealthAddress,
        ephemeralPublicKey,
        stealthKeys
      );
    } catch (error) {
      console.error("Errore in openStealthAddress:", error);
      throw error;
    }
  }
}

// Esporta la classe principale
export default ShogunSDK;
