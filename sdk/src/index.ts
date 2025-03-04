// Import delle dipendenze
import Gun, { IGunInstance, IGunUserInstance } from "gun";
import { ethers, HDNodeWallet } from "ethers";
import { localStorage } from "./utils/storageMock";
import { GunDB } from "./gun/gun";
import { MetaMask } from "./connector/metamask";
import { Webauthn } from "./webauthn/webauthn";
import { Stealth } from "./stealth/stealth";
import Wallet from "ethereumjs-wallet";
import "./hedgehog/browser";
import { CONFIG } from "./config";
import { ShogunEventEmitter, ShogunEvents } from "./events";
import LoginWithShogunReact from "./components/react/LoginWithShogunReact";

// Istanza Gun globale
export let gun: IGunInstance<any>;

// Gun
if (typeof window !== "undefined") {
  (window as any).Gun = Gun;
} else if (typeof global !== "undefined") {
  (global as any).Gun = Gun;
}

export function log(message: string, ...args: any[]) {
  console.log(CONFIG.PREFIX + message, ...args);
}

interface ShogunSDKConfig {
  peers: any;
}

interface WalletInfo {
  wallet: any;
  path: string;
  address: string;
  getAddressString: () => string;
}

// Aggiungi l'interfaccia per i risultati di autenticazione
interface AuthResult {
  success: boolean;
  userPub?: string;
  password?: string;
  error?: string;
  wallet?: any;
  username?: string;
}

interface SignUpResult {
  success: boolean;
  wallet?: any;
  pub?: string;
  error?: string;
}

/**
 * SHOGUN SDK - Libreria semplificata per la gestione di wallet crypto con GunDB
 * @version 1.1.0
 */
export class ShogunSDK {
  public gun: IGunInstance<any>;
  private storage: Storage;
  public gundb: GunDB;
  public hedgehog: any;
  public webauthn: Webauthn | undefined;
  public metamask: MetaMask | undefined;
  public stealth: Stealth | undefined;
  private eventEmitter: ShogunEventEmitter;

  /**
   * Inizializza l'SDK di SHOGUN
   * @param {Object} config - Configurazione
   * @param {string[]} config.peers - Array di peer GunDB
   */
  constructor(config: ShogunSDKConfig) {
    const isNode = typeof window === "undefined";
    this.storage = isNode ? localStorage : window.localStorage;

    // Inizializza GunDB
    this.gundb = new GunDB(config.peers);
    this.gun = this.gundb.gun as IGunInstance<any>; // mantiene riferimento a gun per compatibilità

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
    

    // Inizializza la sessione GUN
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

  /**
   * Inizializza la sessione GUN
   * @private
   */
  async initGunSession() {
    if (!Node) {
      const user = this.gun.user();
      user.recall({ sessionStorage: true });
    }
  }

  /**
   * Autentica un utente GUN con una coppia di chiavi
   * @param {Object} pair - Coppia di chiavi
   */
  async authenticateGunUserWithPair(pair: any) {
    return this.gundb.authenticateGunUserWithPair(pair);
  }

  /**
   * Crea un nuovo utente GUN con una nuova coppia di chiavi
   * @param {string} username - Nome utente
   */
  async createGunUserWithPair(username: string) {
    return this.gundb.createGunUserWithPair(username);
  }

  /**
   * Registra un nuovo utente
   * @param {string} username - Nome utente
   * @param {string} password - Password
   * @returns {Promise<{wallet: Wallet, pub: string}>}
   */
  async signUp(
    username: string,
    password: string
  ): Promise<
    | { success: boolean; wallet: any; pub: string }
    | { success: boolean; error: string }
  > {
    try {
      // Prima verifichiamo se l'utente esiste già su Hedgehog
      log("Verifica esistenza utente Hedgehog...");

      try {
        const result = await this.hedgehog.login(username, password);
        if (result) {
          // Se l'utente esiste già e il login ha successo, emmettiamo l'evento e restituiamo un successo
          const userPub = result.pub || "";

          log("Utente già esistente, login completato");

          this.eventEmitter.emit("auth:signup", {
            userPub,
            username,
            method: "password",
          });

          return { success: true, wallet: result, pub: userPub };
        }
      } catch (hedgehogError) {
        log("Utente non esistente su Hedgehog, procedo con la registrazione");
      }

      // Poi proviamo a creare l'utente GUN
      log("Creazione utente GUN...");
      let gunUser;
      let gunErrorCaught = false;
      try {
        const result = await this.gundb.createGunUser(username, password);
        log("Utente GUN creato con successo:", result);

        // Salva la chiave pubblica dell'utente
        await this.gundb.authenticateGunUser(username, password);

        const user = this.gun.user() as IGunUserInstance;
        let pub = user?.is?.epub;

        if (!pub) {
          throw new Error("Chiave pubblica non disponibile");
        }

        // Salva esplicitamente i dati dell'utente usando la chiave pubblica
        await new Promise((resolve, reject) => {
          this.gun
            .get("users")
            .get(pub) // Usa la chiave pubblica invece dello username
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

        log("Dati utente salvati in GUN con chiave pubblica");
      } catch (gunError) {
        gunErrorCaught = true;
        if (
          gunError instanceof Error &&
          gunError.message.includes("User already created")
        ) {
          log("Utente GUN già esistente, tento autenticazione...");
          await this.gundb.authenticateGunUser(username, password);
          // Recupera la chiave pubblica
          const user = this.gun.user() as IGunUserInstance;
          const pub = user?.is?.epub;
          log("Autenticazione GUN con utente esistente completata");
        } else {
          throw gunError;
        }
      }

      log("Aggiornamento chiave pubblica...");
      await this.updateGunPublicKey();

      // Inizializza la struttura dei wallet paths
      log("Inizializzazione struttura wallet paths...");
      try {
        await Promise.race([
          new Promise((resolve, reject) => {
            const user = this.gundb.gun.user();
            if (!user.is) {
              reject(new Error("Utente Gun non autenticato"));
              return;
            }

            const userPub = user.is.epub;

            this.gun
              .get("WalletPaths")
              .get(userPub) // Usa la chiave pubblica invece dello username
              .set(
                {
                  paths: {},
                },
                (ack) => {
                  if ("err" in ack) {
                    console.error(
                      "Errore nell'inizializzazione wallet paths:",
                      ack.err
                    );
                    reject(new Error(ack.err));
                  } else {
                    log("Struttura wallet paths inizializzata con successo");
                    resolve(ack);
                  }
                }
              );
          }),

          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("Timeout nell'inizializzazione wallet paths")),
              5000
            )
          ),
        ]);
      } catch (e) {
        console.error("Errore durante l'inizializzazione dei wallet paths:", e);
        throw e;
      }

      // Registrazione o login con Hedgehog
      log("Registrazione utente Hedgehog...");
      let wallet;
      try {
        wallet = await this.hedgehog.signUp(username, password);
        log("Utente Hedgehog registrato con successo");
      } catch (hedgehogError) {
        if (
          hedgehogError instanceof Error &&
          hedgehogError.message.includes("User already created")
        ) {
          log("Utente Hedgehog già esistente, tentativo di login...");
          wallet = await this.hedgehog.login(username, password);
          log("Login Hedgehog con utente esistente completato");
        } else {
          throw hedgehogError;
        }
      }

      // Verifica finale e setup
      const user = this.gundb.gun.user();
      if (!user.is) {
        log("Riautenticazione GUN necessaria...");
        await this.gundb.authenticateGunUser(username, password);
      }

      // Aggiorna la chiave pubblica
      const userPub = user?.is?.epub || "";

      log("Aggiornamento chiave pubblica...");

      this.eventEmitter.emit("auth:signup", {
        userPub,
        username,
        method: "password",
      });

      return { success: true, wallet: wallet, pub: userPub };
    } catch (e: any) {
      console.error("Errore durante la registrazione:", e);
      // Cleanup in caso di errore
      try {
        this.gun.user()?.leave();
        sessionStorage.removeItem("gun-current-pair");
      } catch (cleanupError) {
        console.error("Errore durante il cleanup:", cleanupError);
      }
      this.eventEmitter.emit("error", {
        code: "AUTH_SIGNUP_ERROR",
        message: e.message || "Errore durante la registrazione",
        details: e,
      });
      return { success: false, error: e.message };
    }
  }

  /**
   * Effettua il login
   * @param {string} username - Nome utente
   * @param {string} password - Password
   * @returns {Promise<{wallet: Wallet, pub: string}>}
   */
  async login(
    username: string,
    password: string
  ): Promise<{ wallet: any; userpub: string }> {
    try {
      return new Promise((resolve, reject) => {
        try {
          this.authenticateWithHedgehog(username, password)
            .then((result) => {
              // Verifica se il risultato contiene un wallet
              if (!result || !result.wallet) {
                reject(
                  new Error("Autenticazione fallita: wallet non disponibile")
                );
                return;
              }

              const wallet = result.wallet;

              // Tenta di ottenere la chiave pubblica
              let userpub = this.gun.user().is?.pub;

              // Se la chiave pubblica non è disponibile, prova ad autenticare con GUN
              if (!userpub) {
                console.log(
                  "Chiave pubblica non disponibile, tentativo di autenticazione con GUN..."
                );

                // Tenta di autenticare con GUN
                this.authenticateWithGun(username, password)
                  .then((gunPub) => {
                    if (!gunPub) {
                      reject(
                        new Error(
                          "Impossibile ottenere la chiave pubblica dell'utente"
                        )
                      );
                      return;
                    }
                    resolve({ wallet, userpub: gunPub });
                  })
                  .catch((error) => {
                    console.error(
                      "Errore durante l'autenticazione con GUN:",
                      error
                    );
                    reject(error);
                  });
              } else {
                // Se la chiave pubblica è disponibile, risolvi la Promise
                resolve({ wallet, userpub });
              }
            })
            .catch((error) => {
              console.error(
                "Errore durante l'autenticazione con Hedgehog:",
                error
              );
              reject(error);
            });
        } catch (error) {
          console.error("Errore durante il login:", error);
          reject(error);
        }
      });
    } catch (error) {
      this.eventEmitter.emit("error", {
        code: "AUTH_LOGIN_ERROR",
        message:
          error instanceof Error ? error.message : "Errore durante il login",
        details: error,
      });
      throw error;
    }
  }

  /**
   * Effettua il logout
   */
  logout() {
    this.hedgehog.logout();
    this.gundb.logout();
    this.eventEmitter.emit("auth:logout");
  }

  /**
   * Verifica se l'utente è loggato
   * @returns {boolean}
   */
  isLoggedIn(): boolean {
    return this.hedgehog.isLoggedIn();
  }

  /**
   * Ottiene il wallet principale
   * @returns {Object} Wallet
   */
  getMainWallet(): Wallet {
    return this.hedgehog.getWallet();
  }

  /**
   * Deriva un wallet HD da un indice specifico
   * @param {string} userpub - Chiave pubblica dell'utente
   * @param {number} index - Indice di derivazione
   * @returns {Promise<Object>} Wallet derivato
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
    try {
      // Verifica che l'utente sia autenticato
      if (!this.hedgehog.isLoggedIn()) {
        throw new Error("Utente non autenticato");
      }

      // Ottieni il wallet principale
      const mainWallet = this.hedgehog.getWallet() as Wallet;
      if (!mainWallet) {
        throw new Error("Wallet principale non disponibile");
      }

      // Ottieni l'entropy dal localStorage
      const entropy = this.storage.getItem("hedgehog-entropy-key");
      if (!entropy) {
        // Se non troviamo l'entropy in localStorage, proviamo a ricavarla dal wallet
        if (!mainWallet.getPrivateKeyString()) {
          throw new Error(
            "Impossibile recuperare la chiave privata del wallet"
          );
        }

        // Usa la chiave privata come entropy
        const privateKey = mainWallet.getPrivateKeyString();
        // Se la chiave privata è un Uint8Array, convertila in hex

        this.storage.setItem("hedgehog-entropy-key", privateKey);
      }

      // Riprova a ottenere l'entropy
      const finalEntropy = this.storage.getItem(
        "hedgehog-entropy-key"
      ) as string;
      if (!finalEntropy) {
        throw new Error("Impossibile recuperare l'entropy");
      }

      // Crea HD wallet master
      const entropyBytes = new Uint8Array(
        finalEntropy.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
      const masterHDNode = ethers.HDNodeWallet.fromSeed(entropyBytes);

      // Deriva il wallet usando il path BIP44 standard per Ethereum
      const derivationPath = `m/44'/60'/0'/0/${index}`;
      const derivedWallet = masterHDNode.derivePath(derivationPath);

      // Gestione dei paths
      let currentPaths = [];
      try {
        currentPaths = (await this.getWalletPaths(userpub)) || [];
      } catch (e) {
        log("Nessun path esistente trovato, inizializzo nuovo array");
      }

      // Aggiungi il nuovo path solo se non esiste già
      if (!currentPaths.includes(derivationPath)) {
        currentPaths.push(derivationPath);

        // Salva i paths
        await this.saveWalletPaths(userpub, currentPaths);
      }

      // Restituisci il wallet con interfaccia consistente
      return {
        wallet: derivedWallet,
        path: derivationPath,
        address: derivedWallet.address,
        getAddressString: () => derivedWallet.address,
        signMessage: (message: string | Uint8Array<ArrayBufferLike>) =>
          derivedWallet.signMessage(message),
      };
    } catch (error) {
      console.error("Errore nella derivazione del wallet:", error);
      throw error;
    }
  }

  /**
   * Firma un messaggio
   * @param wallet - Wallet
   * @param message - Messaggio da firmare
   * @returns - Firma del messaggio
   */
  async signMessage(
    wallet: {
      signMessage: (arg0: any) => any;
      _privKey: string | ethers.SigningKey;
    },
    message: string | Uint8Array<ArrayBufferLike>
  ) {
    try {
      // Se il wallet è un'istanza di ethers.Wallet, usa direttamente il suo metodo
      if (wallet instanceof ethers.Wallet) {
        return wallet.signMessage(message);
      }

      // Altrimenti usa il metodo signMessage del wallet (mock o Hedgehog)
      if (typeof wallet.signMessage === "function") {
        return wallet.signMessage(message);
      }

      // Se il wallet ha una chiave privata, crea un wallet ethers e firma
      if (wallet._privKey) {
        const ethersWallet = new ethers.Wallet(wallet._privKey);
        return ethersWallet.signMessage(message);
      }

      throw new Error("Wallet non supporta la firma di messaggi");
    } catch (error) {
      console.error("Errore durante la firma del messaggio:", error);
      throw error;
    }
  }

  /**
   * Verifica una firma
   * @param message - Messaggio da verificare
   * @param signature - Firma da verificare
   * @returns - Risultato della verifica
   */
  verifySignature(
    message: string | Uint8Array<ArrayBufferLike>,
    signature: ethers.SignatureLike
  ) {
    return ethers.verifyMessage(message, signature);
  }

  /**
   * Salva i paths del wallet
   * @param userpub - Chiave pubblica dell'utente
   * @param paths - Paths da salvare
   */
  async saveWalletPaths(userpub: string, paths: any) {
    if (!userpub || !Array.isArray(paths)) {
      throw new Error("userpub e paths sono richiesti");
    }

    try {
      // Salva in localStorage per il mock
      this.storage.setItem(`walletPaths_${userpub}`, JSON.stringify(paths));

      // Se non siamo in modalità mock, salva in GunDB
      if (!Node) {
        await this.gundb.saveWalletPaths(userpub, paths);
      }
    } catch (error) {
      console.warn("Errore nel salvataggio dei paths:", error);
      throw error;
    }
  }

  /**
   * Recupera i paths del wallet
   * @param userpub - Chiave pubblica dell'utente
   * @returns - Paths del wallet
   */
  async getWalletPaths(userpub: string) {
    if (!userpub) throw new Error("userpub è richiesto");

    try {
      // Prima prova a recuperare da localStorage (per il mock)
      const storedPaths = this.storage.getItem(`walletPaths_${userpub}`);
      if (storedPaths) {
        try {
          return JSON.parse(storedPaths);
        } catch (e) {
          console.warn("Errore nel parsing dei paths da localStorage:", e);
        }
      }

      // Se non siamo in modalità mock e non ci sono paths in localStorage
      if (!Node) {
        try {
          return await this.gundb.getWalletPaths(userpub);
        } catch (e) {
          console.warn("Errore nel recupero paths da GunDB:", e);
          return [];
        }
      }

      return [];
    } catch (error) {
      console.warn("Errore nel recupero dei paths:", error);
      return [];
    }
  }

  /**
   * Carica i wallet esistenti
   * @returns {Promise<WalletInfo[]>} Array di wallet
   */
  async loadWallets(): Promise<WalletInfo[]> {
    try {
      const user = this.gun.user() as IGunUserInstance;
      const userpub = user?.is?.pub || "";

      // Recupera i wallet paths
      const data = await new Promise<any>((resolve) => {
        this.gun
          .get("WalletPaths")
          .get(userpub)
          .once((data: any) => {
            resolve(data);
          });
      });

      if (!data || !data.paths) {
        return [];
      }

      // Estrai i paths
      const paths = Object.entries(data.paths)
        .filter(([key]) => !key.startsWith("_") && key !== "#")
        .map(([_, value]) => value)
        .filter((path) => typeof path === "string");

      if (paths.length === 0) {
        return [];
      }

      // Recupera l'entropy
      const entropy = window.localStorage.getItem("hedgehog-entropy-key");
      if (!entropy) {
        throw new Error("Entropy non trovata");
      }

      // Converti l'entropy in bytes
      const entropyBytes = new Uint8Array(
        entropy.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      // Crea il master HD node
      const masterHDNode = ethers.HDNodeWallet.fromSeed(entropyBytes);

      // Deriva i wallet
      const wallets = paths
        .map((path: string) => {
          try {
            const derivedWallet = masterHDNode.derivePath(path);
            return {
              wallet: derivedWallet,
              path: path,
              getAddressString: () => derivedWallet.address,
              address: derivedWallet.address,
            };
          } catch (e) {
            console.error(`Errore nella derivazione del path ${path}:`, e);
            return null;
          }
        })
        .filter((w) => w !== null) as WalletInfo[];

      return wallets;
    } catch (e) {
      console.error("Errore nel caricamento dei wallet:", e);
      throw e;
    }
  }

  /**
   * Aggiorna la chiave pubblica GUN
   * @returns - Chiave pubblica GUN
   */
  async updateGunPublicKey(): Promise<string | null> {
    try {
      log("Tentativo di recupero chiave pubblica GUN...");

      // Verifica se l'utente è autenticato
      const user = this.gun.user() as IGunUserInstance;
      if (!user.is) {
        log("Utente GUN non autenticato, tentativo di recall sessione...");
        await new Promise<void>((resolve) => {
          user.recall({ sessionStorage: true }, () => {
            resolve();
          });
        });
      }

      if (user && user.is) {
        log("User GUN autenticato, recupero pair...");
        const pair = (user as any)._?.sea;

        if (pair && pair.epub) {
          log("Chiave pubblica GUN trovata:", pair.epub);

          // Salva le chiavi nella sessione
          if (!sessionStorage.getItem("gun-current-pair")) {
            sessionStorage.setItem("gun-current-pair", JSON.stringify(pair));
          }

          return pair.epub;
        } else {
          log("Pair o epub non trovati nel pair GUN");
          // Prova a recuperare le chiavi dalla sessione
          const savedPair = sessionStorage.getItem("gun-current-pair");
          if (savedPair) {
            const parsedPair = JSON.parse(savedPair);
            return parsedPair.epub;
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Errore nel recupero della chiave pubblica Gun:", error);
      return null;
    }
  }

  /**
   * Verifica se WebAuthn è supportato
   * @returns - True se WebAuthn è supportato, altrimenti false
   */
  isWebAuthnSupported(): boolean {
    return window.PublicKeyCredential !== undefined;
  }

  // Metodo per la registrazione con WebAuthn
  async registerWithWebAuthn(
    username: string
  ): Promise<{
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

      // Utilizziamo la funzione generateCredentials del modulo WebAuthn
      const result = await this.webauthn.generateCredentials(username);
      console.log("Risultato generazione credenziali WebAuthn:", result);

      if (!result.success || !result.password) {
        throw new Error(result.error || "Registrazione WebAuthn fallita");
      }

      try {
        // Effettuiamo un logout prima di creare l'utente per evitare conflitti
        this.gundb.gun.user().leave();

        // Creiamo l'utente Gun
        console.log("Tentativo di creazione utente Gun, username:", username);
        await this.gundb.createGunUser(username, result.password);
        console.log("Creazione utente Gun riuscita");

        // Autentichiamo l'utente con Gun
        console.log("Tentativo di autenticazione con Gun, username:", username);
        const userPub = await this.authenticateWithGun(
          username,
          result.password
        );
        console.log("Autenticazione Gun riuscita, userPub:", userPub);

        return {
          success: true,
          userPub,
          password: result.password,
          credentialId: result.credentialId,
        };
      } catch (gunError) {
        console.error(
          "Errore durante la creazione/autenticazione con Gun:",
          gunError
        );

        if (
          gunError instanceof Error &&
          gunError.message.includes("User already created")
        ) {
          console.log(
            "Utente Gun già esistente, tentativo di autenticazione..."
          );

          try {
            // Effettuiamo un logout prima di autenticare per evitare problemi
            this.gundb.gun.user().leave();

            // Autentichiamo l'utente con Gun
            const userPub = await this.authenticateWithGun(
              username,
              result.password
            );
            console.log("Autenticazione Gun riuscita, userPub:", userPub);

            return {
              success: true,
              userPub,
              password: result.password,
              credentialId: result.credentialId,
            };
          } catch (authError) {
            console.error(
              "Errore durante l'autenticazione con Gun:",
              authError
            );
            throw authError;
          }
        }

        throw gunError;
      }
    } catch (error: any) {
      console.error("Errore nella registrazione con WebAuthn:", error);
      return {
        success: false,
        error: error.message || "Errore nella registrazione con WebAuthn",
      };
    }
  }

  /**
   * Ottiene i dispositivi WebAuthn registrati
   * @param username - Nome utente
   * @returns - Dispositivi registrati
   */
  async getWebAuthnDevices(username: string): Promise<any[]> {
    try {
      // Qui dovresti implementare la logica per recuperare i dispositivi registrati
      // Questo è solo un esempio e dovrebbe essere adattato alla tua implementazione
      return [];
    } catch (error) {
      console.error("Errore nel recupero dei dispositivi WebAuthn:", error);
      return [];
    }
  }

  // Metodo per il login con MetaMask
  async loginWithMetaMask(address: string): Promise<AuthResult> {
    try {
      if (!this.metamask) {
        return this.createAuthResult(false, {
          error: "MetaMask non è inizializzato",
        });
      }

      // Verifica se Gun DB è inizializzato
      if (!this.gundb || !this.gundb.gun) {
        console.error("Gun DB non è inizializzato");
        return this.createAuthResult(false, {
          error: "Gun DB non è inizializzato",
        });
      }

      console.log("Tentativo di login con MetaMask, indirizzo:", address);
      
      // Verifichiamo prima se l'utente esiste
      const metamaskUsername = `metamask_${address.slice(0, 10)}`;
      console.log("Verifica esistenza utente per login:", metamaskUsername);
      
      // Utilizziamo una promessa che si risolve sempre, anche in caso di errore o mancanza di dati
      const userExists = await new Promise<boolean>((resolve) => {
        let resolved = false;
        
        // Funzione per risolvere la promessa solo una volta
        const resolveOnce = (exists: boolean) => {
          if (!resolved) {
            resolved = true;
            resolve(exists);
          }
        };
        
        // Verifichiamo se l'utente esiste
        this.gundb.gun.get('Users').get(metamaskUsername).once((data: any) => {
          console.log("Risposta Gun per verifica utente (login):", data ? "Utente trovato" : "Utente non trovato");
          resolveOnce(!!data);
        });
        
        // Verifica secondaria dopo un breve intervallo
        setTimeout(() => {
          this.gundb.gun.get('Users').get(metamaskUsername).once((data: any) => {
            if (!data && !resolved) {
              console.log("Utente non trovato (verifica secondaria per login)");
              resolveOnce(false);
            }
          });
        }, 1000);
        
        // Fallback di sicurezza
        setTimeout(() => {
          console.log("Nessuna risposta da Gun DB per login, assumiamo che l'utente non esista");
          resolveOnce(false);
        }, 3000);
      });
      
      // Se l'utente non esiste, restituiamo un errore
      if (!userExists) {
        console.log("Utente non trovato per login con MetaMask");
        return this.createAuthResult(false, {
          error: "Account non registrato con questo indirizzo MetaMask",
        });
      }
      
      const result = await this.metamask.login(address);
      console.log("Risultato login MetaMask:", result);

      if (!result.success || !result.username || !result.password) {
        return this.createAuthResult(false, {
          error: result.error || "Errore durante il login con MetaMask",
        });
      }

      try {
        // Tenta di autenticare con Hedgehog
        let hedgehogResult;
        try {
          console.log(
            "Tentativo di autenticazione con Hedgehog, username:",
            result.username
          );
          hedgehogResult = await this.authenticateWithHedgehog(
            result.username,
            result.password
          );
          console.log("Autenticazione Hedgehog riuscita:", hedgehogResult);
        } catch (hedgehogError) {
          console.error(
            "Errore durante l'autenticazione con Hedgehog:",
            hedgehogError
          );

          // Se l'autenticazione con Hedgehog fallisce, potrebbe essere necessario registrare l'utente
          try {
            console.log("Tentativo di registrazione con Hedgehog...");
            await this.hedgehog.signUp(result.username, result.password);
            hedgehogResult = await this.authenticateWithHedgehog(
              result.username,
              result.password
            );
            console.log(
              "Registrazione e autenticazione Hedgehog riuscita:",
              hedgehogResult
            );
          } catch (signupError) {
            console.error(
              "Errore durante la registrazione con Hedgehog:",
              signupError
            );
            throw signupError;
          }
        }

        // Tenta di autenticare con Gun
        let userPub;
        try {
          console.log(
            "Tentativo di autenticazione con Gun, username:",
            result.username
          );
          userPub = await this.authenticateWithGun(
            result.username,
            result.password
          );
          console.log("Autenticazione Gun riuscita, userPub:", userPub);
        } catch (gunError) {
          console.error("Errore durante l'autenticazione con Gun:", gunError);

          // Se l'autenticazione con Gun fallisce, potrebbe essere necessario creare l'utente
          try {
            console.log("Tentativo di creazione utente Gun...");
            await this.gundb.createGunUser(result.username, result.password);
            userPub = await this.authenticateWithGun(
              result.username,
              result.password
            );
            console.log(
              "Creazione e autenticazione Gun riuscita, userPub:",
              userPub
            );
          } catch (createError) {
            console.error(
              "Errore durante la creazione utente Gun:",
              createError
            );
            throw createError;
          }
        }

        console.log(
          "Login con MetaMask completato con successo, userPub:",
          userPub
        );
        return this.createAuthResult(true, {
          userPub: userPub ,
          username: result.username,
          password: result.password,
          wallet: hedgehogResult.wallet,
        });
      } catch (authError) {
        console.error("Errore autenticazione:", authError);
        // Se l'autenticazione fallisce, ritorniamo un errore invece di success: true
        return this.createAuthResult(false, {
          error: "Errore nell'autenticazione: " + (authError as Error).message,
        });
      }
    } catch (error: any) {
      console.error("Errore nel login con MetaMask:", error);
      return this.createAuthResult(false, {
        error: error.message || "Errore nel login con MetaMask",
      });
    }
  }

  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    try {
      if (!this.metamask) {
        console.error("MetaMask non è inizializzato");
        return this.createAuthResult(false, {
          error: "MetaMask non è inizializzato",
        });
      }

      // Verifica se Gun DB è inizializzato
      if (!this.gundb || !this.gundb.gun) {
        console.error("Gun DB non è inizializzato");
        return this.createAuthResult(false, {
          error: "Gun DB non è inizializzato",
        });
      }

      // Prima verifichiamo se l'utente esiste già
      const metamaskUsername = `metamask_${address.slice(0, 10)}`;
      console.log("Verifica esistenza utente:", metamaskUsername);
      
      // Utilizziamo una promessa che si risolve sempre, anche in caso di errore o mancanza di dati
      const userExists = await new Promise<boolean>((resolve) => {
        
        
        // Utilizziamo sia 'once' che un controllo manuale per assicurarci che la promessa si risolva
        this.gundb.gun.get('Users').get(metamaskUsername).once((data: any) => {
          console.log("Risposta Gun per verifica utente:", data ? "Utente trovato" : "Utente non trovato");
            resolve(!!data);
        });
        
        // Utilizziamo un approccio alternativo per verificare l'assenza di dati
        // Questo evita l'uso del metodo 'not' che potrebbe non essere disponibile in tutte le versioni di Gun
        setTimeout(() => {
          this.gundb.gun.get('Users').get(metamaskUsername).once((data: any) => {
            if (!data) {
              console.log("Utente non trovato (verifica secondaria)");
              resolve(false);
            }
          });
        }, 5000);
        
        // Assicuriamoci che la promessa si risolva dopo un po' se Gun non risponde
        // Questo non è un timeout vero e proprio, ma un fallback di sicurezza
        setTimeout(() => {
          console.log("Nessuna risposta da Gun DB, assumiamo che l'utente non esista");
          resolve(false);
        }, 5000);
      });
      
      // Se l'utente esiste già, proviamo a fare login
      if (userExists) {
        console.log("Utente già esistente, tentativo di login...");
        return await this.loginWithMetaMask(address);
      }

      console.log("Tentativo di registrazione con MetaMask, indirizzo:", address);

      try {
        // Utilizziamo la funzione signUp del modulo MetaMask
        const result = await this.metamask.signUp(address);
        console.log("Risultato registrazione MetaMask:", result);

        if (!result.success || !result.username || !result.password) {
          // Se l'errore è che l'account è già registrato o il documento esiste già, proviamo a fare login
          if (
            result.error &&
            (result.error.includes("Account already registered") ||
              result.error.includes("Document already exists"))
          ) {
            console.log(
              "Account già registrato o documento esistente, tentativo di login..."
            );
            const loginResult = await this.loginWithMetaMask(address);

            // Se il login ha successo, restituiamo il risultato
            if (loginResult.success) {
              return loginResult;
            }
          }

          console.error(
            "Errore durante la registrazione con MetaMask:",
            result.error
          );
          return this.createAuthResult(false, {
            error:
              result.error || "Errore durante la registrazione con MetaMask",
          });
        }

        try {
          // NOTA: La registrazione con Hedgehog è già stata effettuata nella funzione signUp di MetaMask
          // Quindi non è necessario registrare nuovamente l'utente con Hedgehog qui
          console.log(
            "Verifica autenticazione con Hedgehog, username:",
            result.username
          );
          let hedgehogWallet;
          try {
            const hedgehogResult = await this.authenticateWithHedgehog(
              result.username,
              result.password
            );
            console.log("Autenticazione Hedgehog riuscita:", hedgehogResult);
            hedgehogWallet = hedgehogResult.wallet;
          } catch (hedgehogError) {
            console.error(
              "Errore durante l'autenticazione con Hedgehog:",
              hedgehogError
            );
            // Non facciamo nulla qui, perché l'utente dovrebbe già essere stato registrato
            // nella funzione signUp di MetaMask
          }

          // Assicuriamoci che l'utente Gun sia creato correttamente
          console.log(
            "Tentativo di creazione utente Gun, username:",
            result.username
          );
          try {
            // Effettuiamo un logout prima di creare l'utente per evitare conflitti
            this.gundb.gun.user().leave();

            await this.gundb.createGunUser(result.username, result.password);
            console.log("Creazione utente Gun riuscita");
          } catch (gunError) {
            if (
              gunError instanceof Error &&
              gunError.message.includes("User already created")
            ) {
              console.log("Utente Gun già esistente");
            } else {
              throw gunError;
            }
          }

          // Effettuiamo un logout prima di autenticare per evitare problemi
          this.gundb.gun.user().leave();

          console.log(
            "Tentativo di autenticazione con Gun, username:",
            result.username
          );
          try {
            const userPub = await this.authenticateWithGun(
              result.username,
              result.password
            );
            console.log("Autenticazione Gun riuscita, userPub:", userPub);

            console.log("Inizializzazione dati utente...");
            await this.initializeUserData(
              result.username,
              result.password,
              userPub
            );
            console.log("Inizializzazione dati utente completata");

            console.log(
              "Registrazione con MetaMask completata con successo, userPub:",
              userPub
            );
            return this.createAuthResult(true, {
              userPub: userPub ,
              password: result.password,
              wallet: hedgehogWallet,
              username: result.username,
            });
          } catch (authError) {
            console.error(
              "Errore durante l'autenticazione con Gun:",
              authError
            );

            // Proviamo a ricreare l'utente Gun con una nuova password
            console.log(
              "Tentativo di ricreare l'utente Gun con una nuova password..."
            );

            // Generiamo una nuova password casuale
            const newPassword = Array.from(
              crypto.getRandomValues(new Uint8Array(32))
            )
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            try {
              // Effettuiamo un logout prima di creare l'utente
              this.gundb.gun.user().leave();

              // Creiamo un nuovo utente con la nuova password
              await this.gundb.createGunUser(result.username, newPassword);
              console.log("Utente Gun ricreato con successo");

              // Autentichiamo l'utente con la nuova password
              const userPub = await this.authenticateWithGun(
                result.username,
                newPassword
              );
              console.log(
                "Autenticazione Gun riuscita con la nuova password, userPub:",
                userPub
              );

              return this.createAuthResult(true, {
                userPub: userPub || address,
                password: newPassword, // Restituiamo la nuova password
                wallet: hedgehogWallet,
                username: result.username,
              });
            } catch (recreateError) {
              console.error(
                "Errore durante la ricreazione dell'utente Gun:",
                recreateError
              );
              throw recreateError;
            }
          }
        } catch (createError: any) {
          if (createError.message?.includes("User already created")) {
            // Se l'utente esiste già, proviamo a fare login
            try {
              console.log("Utente già creato, tentativo di autenticazione...");
              const hedgehogResult = await this.authenticateWithHedgehog(
                result.username,
                result.password
              );
              console.log("Autenticazione Hedgehog riuscita");

              // Effettuiamo un logout prima di autenticare
              this.gundb.gun.user().leave();

              const userPub = await this.authenticateWithGun(
                result.username,
                result.password
              );
              console.log("Autenticazione Gun riuscita, userPub:", userPub);

              return this.createAuthResult(true, {
                userPub: userPub || address,
                password: result.password,
                wallet: hedgehogResult.wallet,
                username: result.username,
              });
            } catch (loginError) {
              console.error(
                "Errore durante il login dopo 'User already created':",
                loginError
              );
              return this.createAuthResult(false, {
                error:
                  "Errore durante il login: " + (loginError as Error).message,
              });
            }
          }

          console.error("Errore durante la creazione utente:", createError);
          return this.createAuthResult(false, {
            error: createError.message || "Errore durante la creazione utente",
          });
        }
      } catch (metamaskError: any) {
        // Se l'errore è che il documento esiste già, proviamo a fare login
        if (
          metamaskError.message &&
          metamaskError.message.includes("Document already exists")
        ) {
          console.log(
            "Documento già esistente in Hedgehog, tentativo di login..."
          );
          return await this.loginWithMetaMask(address);
        }

        console.error(
          "Errore durante la registrazione con MetaMask:",
          metamaskError
        );
        return this.createAuthResult(false, {
          error:
            metamaskError.message ||
            "Errore durante la registrazione con MetaMask",
        });
      }
    } catch (error: any) {
      console.error("Errore nella registrazione con MetaMask:", error);
      return this.createAuthResult(false, {
        error: error.message || "Errore nella registrazione con MetaMask",
      });
    }
  }

  /**
   * Crea un nuovo wallet
   * @returns {Promise<WalletInfo>} Informazioni sul nuovo wallet
   */
  async createWallet(): Promise<WalletInfo> {
    try {
      // Usa this.hedgehog invece di super
      const wallet = await this.hedgehog.createWallet();

      this.eventEmitter.emit("wallet:created", {
        address: wallet.address,
        path: wallet.path,
      });

      return wallet;
    } catch (error) {
      this.eventEmitter.emit("error", {
        code: "WALLET_CREATE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Errore durante la creazione del wallet",
        details: error,
      });
      throw error;
    }
  }

  /**
   * Gestisce il login di un utente
   * @param {string} username - Nome utente
   * @param {string} password - Password
   * @param {Object} options - Opzioni
   * @returns {Promise<Object>} Risultato dell'operazione
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
      const { wallet, userpub } = await this.login(username, password);

      if (setUserpub) setUserpub(userpub);
      if (setSignedIn) setSignedIn(true);

      return this.createAuthResult(true, {
        userPub: userpub,
        password,
        wallet,
      });
    } catch (error) {
      return this.createAuthResult(false, {
        error:
          error instanceof Error ? error.message : "Errore durante il login",
      });
    }
  }

  /**
   * Gestisce la registrazione di un nuovo utente
   * @param {string} username - Nome utente
   * @param {string} password - Password
   * @param {string} passwordConfirmation - Conferma password
   * @param {Object} options - Opzioni
   * @returns {Promise<Object>} Risultato dell'operazione
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
      // Validazione password
      if (password !== passwordConfirmation) {
        const error = messages.passwordMismatch || "Le password non coincidono";
        if (setErrorMessage) setErrorMessage(error);

        this.eventEmitter.emit("error", {
          code: "PASSWORD_MISMATCH",
          message: error,
        });

        return this.createAuthResult(false, { error });
      }

      const result = (await this.signUp(username, password)) as SignUpResult;

      if (!result.success || result.error) {
        if (setErrorMessage) setErrorMessage(result.error);
        return this.createAuthResult(false, { error: result.error });
      }

      if (setUserpub && result.pub) setUserpub(result.pub);
      if (setSignedIn) setSignedIn(true);

      // Emettiamo l'evento di successo
      this.eventEmitter.emit("auth:signup", {
        userPub: result.pub || "",
        username,
        method: "password",
      });

      return this.createAuthResult(true, {
        userPub: result.pub,
        password,
        wallet: result.wallet,
        username,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Errore durante la registrazione";
      if (setErrorMessage) setErrorMessage(errorMessage);

      this.eventEmitter.emit("error", {
        code: "SIGNUP_ERROR",
        message: errorMessage,
        details: error,
      });

      return this.createAuthResult(false, { error: errorMessage });
    }
  }

  /**
   * Inizializza la struttura dei wallet paths
   * @param {string} userPub - Chiave pubblica dell'utente
   * @private
   */
  private async initializeWalletPaths(userPub: string): Promise<void> {
    try {
      log("Inizializzazione wallet paths per l'utente:", userPub);

      // Verifichiamo che l'utente sia autenticato
      const user = this.gun.user();
      if (!user.is) {
        console.warn(
          "Utente non autenticato durante l'inizializzazione wallet paths"
        );
        // Tentiamo di riautenticare usando la sessione
        await new Promise<void>((resolve) => {
          user.recall({ sessionStorage: true }, () => resolve());
        });
      }

      // Approccio alternativo: utilizziamo set invece di put
      // che è più affidabile per strutture di dati semplici
      return await new Promise<void>((resolve, reject) => {
        log("Scrittura wallet paths in GunDB con metodo alternativo...");

        // Usiamo setTimeout invece di Promise.race per gestire meglio il timeout
        const timeoutId = setTimeout(() => {
          console.warn("Timeout scaduto, ma continuiamo l'esecuzione");
          // Invece di fallire, consideriamo l'operazione come completata
          // anche se potrebbe non essere stata salvata completamente
          resolve();
        }, 10000);

        // Prima controlliamo se esiste già
        this.gun
          .get("WalletPaths")
          .get(userPub)
          .once((data) => {
            // Se i dati esistono già, non c'è bisogno di reinizializzare
            if (data && data.initialized) {
              log("Wallet paths già inizializzati", data);
              clearTimeout(timeoutId);
              resolve();
              return;
            }

            // Altrimenti creiamo una nuova entry
            const pathNode = this.gun.get("WalletPaths").get(userPub);

            // Utilizziamo un doppio set invece di put per avere maggiori probabilità di successo
            pathNode.get("paths").set({}, (ack1) => {
              pathNode.get("initialized").put(true, (ack2) => {
                log("Wallet paths inizializzati con metodo alternativo");
                clearTimeout(timeoutId);
                resolve();
              });
            });
          });
      });
    } catch (error) {
      console.error("Errore nell'inizializzazione wallet paths:", error);
      // Catturiamo l'errore ma non lo propaghiamo, permettendo all'applicazione di continuare
      return Promise.resolve();
    }
  }

  // Metodi privati di utilità
  private async authenticateWithHedgehog(
    username: string,
    password: string
  ): Promise<any> {
    log("Autenticazione con Hedgehog...");
    try {
      const wallet = await this.hedgehog.login(username, password);
      log("Login Hedgehog completato con successo");
      return { success: true, wallet };
    } catch (error) {
      log("Errore login Hedgehog:", error);
      throw error;
    }
  }

  private async authenticateWithGun(
    username: string,
    password: string
  ): Promise<string> {
    log("Autenticazione con GUN...");
    try {
      await this.gundb.authenticateGunUser(username, password);
      const user = this.gun.user();
      if (!user.is?.pub) {
        throw new Error("Chiave pubblica GUN non disponibile");
      }
      return user.is.pub;
    } catch (error) {
      log("Errore autenticazione GUN:", error);
      throw error;
    }
  }

  private async initializeUserData(
    username: string,
    password: string,
    userPub: string
  ): Promise<void> {
    log("Inizializzazione dati utente...");
    try {
      await new Promise((resolve, reject) => {
        this.gun
          .get("users")
          .get(userPub)
          .put(
            {
              username: username,
              epub: userPub,
              created: Date.now(),
            },
            (ack) => {
              if ("err" in ack) reject(new Error(ack.err));
              else resolve(ack);
            }
          );
      });

      await this.initializeWalletPaths(userPub);
    } catch (error) {
      log("Errore inizializzazione dati utente:", error);
      throw error;
    }
  }

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
      ...(data || {}),
    };
  }

  // Metodi per la gestione degli eventi
  public on<K extends keyof ShogunEvents>(
    event: K,
    listener: ShogunEvents[K]
  ): void {
    this.eventEmitter.on(event, listener);
  }

  public off<K extends keyof ShogunEvents>(
    event: K,
    listener: ShogunEvents[K]
  ): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Autentica con WebAuthn
   * @param {string} username - Nome utente
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async authenticateWithWebAuthn(
    username: string
  ): Promise<{
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

      // Utilizziamo la funzione authenticateUser del modulo WebAuthn
      const result = await this.webauthn.authenticateUser(username);
      console.log("Risultato autenticazione WebAuthn:", result);

      if (!result.success || !result.password) {
        throw new Error(result.error || "Autenticazione WebAuthn fallita");
      }

      try {
        // Effettuiamo un logout prima di autenticare per evitare problemi
        this.gundb.gun.user().leave();

        // Autentichiamo l'utente con Gun
        console.log("Tentativo di autenticazione con Gun, username:", username);
        const userPub = await this.authenticateWithGun(
          username,
          result.password
        );
        console.log("Autenticazione Gun riuscita, userPub:", userPub);

        return {
          success: true,
          userPub,
          password: result.password,
          credentialId: result.credentialId,
        };
      } catch (gunError) {
        console.error("Errore durante l'autenticazione con Gun:", gunError);

        // Se l'autenticazione con Gun fallisce, proviamo a creare l'utente Gun
        try {
          console.log("Tentativo di creazione utente Gun, username:", username);
          // Effettuiamo un logout prima di creare l'utente
          this.gundb.gun.user().leave();

          await this.gundb.createGunUser(username, result.password);
          console.log("Creazione utente Gun riuscita");

          // Autentichiamo l'utente con Gun
          const userPub = await this.authenticateWithGun(
            username,
            result.password
          );
          console.log(
            "Autenticazione Gun riuscita dopo creazione, userPub:",
            userPub
          );

          return {
            success: true,
            userPub,
            password: result.password,
            credentialId: result.credentialId,
          };
        } catch (createError) {
          if (
            createError instanceof Error &&
            createError.message.includes("User already created")
          ) {
            console.log(
              "Utente Gun già esistente, tentativo di autenticazione con una nuova password..."
            );

            // Generiamo una nuova password casuale
            const newPassword = Array.from(
              crypto.getRandomValues(new Uint8Array(32))
            )
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            try {
              // Effettuiamo un logout prima di creare l'utente
              this.gundb.gun.user().leave();

              // Creiamo un nuovo utente con la nuova password
              await this.gundb.createGunUser(username, newPassword);
              console.log("Utente Gun ricreato con successo");

              // Autentichiamo l'utente con la nuova password
              const userPub = await this.authenticateWithGun(
                username,
                newPassword
              );
              console.log(
                "Autenticazione Gun riuscita con la nuova password, userPub:",
                userPub
              );

              return {
                success: true,
                userPub,
                password: newPassword,
                credentialId: result.credentialId,
              };
            } catch (recreateError) {
              console.error(
                "Errore durante la ricreazione dell'utente Gun:",
                recreateError
              );
              throw recreateError;
            }
          }

          throw createError;
        }
      }
    } catch (error: any) {
      console.error("Errore nell'autenticazione con WebAuthn:", error);
      return {
        success: false,
        error: error.message || "Errore nell'autenticazione con WebAuthn",
      };
    }
  }
}

// Esporta per entrambi Node.js e browser
if (typeof window !== "undefined") {
  (window as any).ShogunSDK = ShogunSDK;
  (window as any).Webauthn = Webauthn;
  (window as any).MetaMask = MetaMask;
  (window as any).Stealth = Stealth;
} else if (typeof global !== "undefined") {
  (global as any).ShogunSDK = ShogunSDK;
  (global as any).Webauthn = Webauthn;
  (global as any).MetaMask = MetaMask;
  (global as any).Stealth = Stealth;
}

// export components
export { LoginWithShogunReact };

// export sdk
export default ShogunSDK;
