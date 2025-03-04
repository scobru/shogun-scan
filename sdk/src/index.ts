// Import delle dipendenze
import Gun, { IGunInstance, IGunUserInstance } from "gun";
import { ethers, HDNodeWallet } from "ethers";
import { localStorage } from "./utils/storage-mock";
import { GunDB } from "./gun/Gun";
import { MetaMask } from "./connector/MetaMask";
import { Webauthn } from "./webauthn/Webauthn";
import { Stealth } from "./stealth/Stealth";
import Wallet from "ethereumjs-wallet";
import LoginWithShogunReact from "./components/react/LoginWithShogunReact";


import "./hedgehog/browser";
//

// Istanza Gun globale
export let gun: IGunInstance<any>;

// Gun
if (typeof window !== "undefined") {
  (window as any).Gun = Gun;
} else if (typeof global !== "undefined") {
  (global as any).Gun = Gun;
}

// prefix "ShogunSDK:"
const prefix = "⚔️ ShogunSDK:";

function log(message: string, ...args: any[]) {
  console.log(prefix + message, ...args);
}

interface ShogunSDKConfig {
  peers: any;
  storage?: Storage;
  gundb?: GunDB;
  gun?: IGunInstance<any>;
  hedgehog?: any; // Utilizzo di 'any' invece di 'typeof Hedgehog' per evitare il riferimento privato
  webauthn?: Webauthn;
  metamask?: MetaMask;
  stealth?: Stealth;
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
  wallet?: Wallet;
  username?: string;
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

  /**
   * Inizializza l'SDK di SHOGUN
   * @param {Object} config - Configurazione
   * @param {boolean} config.persistence - Abilita/disabilita la persistenza locale
   * @param {Object} config.hedgehog - Istanza di Hedgehog (opzionale)
   * @param {Object} config.storage - Storage da utilizzare (opzionale)
   * @param {string[]} config.peers - Array di peer GunDB
   */
  constructor(config: ShogunSDKConfig) {
    const isNode = typeof window === "undefined";
    this.storage =
      config.storage || (isNode ? localStorage : window.localStorage);

    // Inizializza GunDB
    this.gundb = new GunDB(config.peers);
    this.gun = this.gundb.gun as IGunInstance<any>; // mantiene riferimento a gun per compatibilità

    // Esporta l'istanza gun globalmente
    gun = this.gun;

    // Inizializza Hedgehog con le funzioni appropriate
    if (!config.hedgehog) {
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
    } else {
      this.hedgehog = config.hedgehog as any;
    }

    // Inizializza i moduli di autenticazione aggiuntivi solo nel browser
    if (!isNode) {
      this.webauthn = new Webauthn(this.gundb, this.hedgehog);
      this.metamask = new MetaMask(this.gundb, this.hedgehog);
      this.stealth = new Stealth(this.gundb);
    }

    // Inizializza la sessione GUN
    this.initGunSession();
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

      log(this.hedgehog);

      try {
        const result = await this.hedgehog.login(username, password);
        if (result) {
          return { success: true, wallet: result, pub: result.pub };
        }
        return { success: false, error: "User already created" };
      } catch (hedgehogError) {
        log("Utente non esistente su Hedgehog, procedo con la registrazione");
      }

      // Poi proviamo a creare l'utente GUN
      log("Creazione utente GUN...");
      let gunUser;
      try {
        const result = await this.gundb.createGunUser(username, password);
        log("Utente GUN creato con successo:", result);

        // Salva la chiave pubblica dell'utente
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
        if (
          gunError instanceof Error &&
          gunError.message.includes("User already created")
        ) {
          log("Utente GUN già esistente, tento autenticazione...");
          await this.gundb.authenticateGunUser(username, password);
          // Recupera la chiave pubblica
          const user = this.gun.user() as IGunUserInstance;
          const pub = user?.is?.epub;
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

      // Registrazione utente con Hedgehog
      log("Registrazione utente Hedgehog...");
      const wallet = await this.hedgehog.signUp(username, password);
      log("Utente Hedgehog registrato con successo");

      // Verifica finale e setup
      const user = this.gundb.gun.user();
      if (!user.is) {
        log("Riautenticazione GUN necessaria...");
        await this.gundb.authenticateGunUser(username, password);
      }

      // Aggiorna la chiave pubblica
      const userPub = user?.is?.epub || "";

      log("Aggiornamento chiave pubblica...");

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
    return new Promise((resolve, reject) => {
      try {
        log("Inizio processo di login...");

        // Autentica l'utente GUN
        this.gun.user().auth(username, password, async (ack) => {
          log("Risposta autenticazione:", ack);

          if ("err" in ack) {
            reject(new Error(ack.err));
            return;
          }

          try {
            // Login con Hedgehog
            const hedgehogWallet = await this.hedgehog.login(
              username,
              password
            );
            log("Login Hedgehog completato:", hedgehogWallet);

            // Ottieni la chiave pubblica dell'utente
            const user = this.gun.user() as IGunUserInstance;
            const userpub = user?.is?.pub || "";

            resolve({
              wallet: hedgehogWallet,
              userpub: userpub,
            });
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Effettua il logout
   */
  logout() {
    this.hedgehog.logout();
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
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato in questo browser");
      }

      // Crea le opzioni per la creazione delle credenziali
      const publicKeyCredentialCreationOptions = {
        challenge: new Uint8Array(32),
        rp: {
          name: "Shogun Wallet",
          id: window.location.hostname,
        },
        user: {
          id: new Uint8Array(16),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
        ],
        timeout: 60000,
        attestation: "direct",
      };

      // Popola gli array con valori casuali
      window.crypto.getRandomValues(
        publicKeyCredentialCreationOptions.challenge
      );
      window.crypto.getRandomValues(publicKeyCredentialCreationOptions.user.id);

      // Crea le credenziali
      const credential = await (navigator.credentials as any).create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      if (!credential) {
        throw new Error("Creazione credenziali fallita");
      }

      return {
        success: true,
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
   * Autentica con WebAuthn
   * @param username - Nome utente
   * @returns - Risultato dell'autenticazione
   */
  async authenticateWithWebAuthn(
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato in questo browser");
      }

      // Crea le opzioni per la richiesta di credenziali
      const publicKeyCredentialRequestOptions = {
        challenge: new Uint8Array(32),
        timeout: 60000,
        rpId: window.location.hostname,
      };

      // Popola il challenge con valori casuali
      window.crypto.getRandomValues(
        publicKeyCredentialRequestOptions.challenge
      );

      // Richiedi le credenziali
      const assertion = await (navigator.credentials as any).get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      if (!assertion) {
        throw new Error("Autenticazione fallita");
      }

      return {
        success: true,
      };
    } catch (error: any) {
      console.error("Errore nell'autenticazione con WebAuthn:", error);
      return {
        success: false,
        error: error.message || "Errore nell'autenticazione con WebAuthn",
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

      const result = await this.metamask.login(address);

      if (!result.success || !result.username || !result.password) {
        return this.createAuthResult(false, {
          error: result.error || "Errore durante il login con MetaMask",
        });
      }

      try {
        const hedgehogResult = await this.authenticateWithHedgehog(
          result.username,
          result.password
        );
        const userPub = await this.authenticateWithGun(
          result.username,
          result.password
        );

        return this.createAuthResult(true, {
          userPub: userPub || address,
          password: result.password,
          wallet: hedgehogResult.wallet,
        });
      } catch (authError) {
        log("Errore autenticazione:", authError);
        // Se l'autenticazione fallisce, ritorniamo un errore invece di success: true
        return this.createAuthResult(false, {
          error: "Errore nell'autenticazione: " + (authError as Error).message,
        });
      }
    } catch (error: any) {
      return this.createAuthResult(false, {
        error: error.message || "Errore nel login con MetaMask",
      });
    }
  }

  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    try {
      if (!this.metamask) {
        return this.createAuthResult(false, {
          error: "MetaMask non è inizializzato",
        });
      }

      const result = await this.metamask.signUp(address);

      if (!result.success || !result.username || !result.password) {
        return this.createAuthResult(false, {
          error: result.error || "Errore durante la registrazione con MetaMask",
        });
      }

      try {
        // Verifica se l'utente esiste già
        try {
          const hedgehogResult = await this.authenticateWithHedgehog(
            result.username,
            result.password
          );
          return this.createAuthResult(true, {
            userPub: address,
            password: result.password,
            wallet: hedgehogResult.wallet,
          });
        } catch (hedgehogError) {
          log("Utente non esistente, procedo con la registrazione");
        }

        const hedgehogWallet = await this.hedgehog.signUp(
          result.username,
          result.password
        );
        await this.gundb.createGunUser(result.username, result.password);
        const userPub = await this.authenticateWithGun(
          result.username,
          result.password
        );
        await this.initializeUserData(
          result.username,
          result.password,
          userPub
        );

        return this.createAuthResult(true, {
          userPub: userPub || address,
          password: result.password,
          wallet: hedgehogWallet,
        });
      } catch (createError: any) {
        if (createError.message?.includes("User already created")) {
          return this.createAuthResult(true, {
            userPub: address,
            password: result.password,
          });
        }

        return this.createAuthResult(false, {
          error: createError.message || "Errore durante la creazione utente",
        });
      }
    } catch (error: any) {
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
      // Recupera la chiave pubblica dell'utente
      const userpub = this.gun.user()?.is?.pub;

      if (!userpub) {
        throw new Error("Chiave pubblica non disponibile");
      }

      // Recupera l'entropy dal localStorage
      const entropy = window.localStorage.getItem("hedgehog-entropy-key");
      if (!entropy) {
        throw new Error("Entropy non trovata");
      }

      // Converti l'entropy in bytes
      const entropyBytes = new Uint8Array(
        entropy.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      // Crea il master HD node usando ethers v6
      const masterHDNode = ethers.HDNodeWallet.fromSeed(entropyBytes);

      // Recupera i wallet esistenti
      const existingWallets = await this.loadWallets();
      const nextIndex = existingWallets.length;

      // Crea il nuovo path di derivazione
      const derivationPath = `m/44'/60'/0'/0/${nextIndex}`;

      // Deriva il nuovo wallet
      const derivedWallet = masterHDNode.derivePath(derivationPath);

      // Crea l'oggetto wallet
      const walletInfo: WalletInfo = {
        wallet: derivedWallet,
        path: derivationPath,
        getAddressString: () => derivedWallet.address,
        address: derivedWallet.address,
      };

      // Salva il nuovo path in GunDB
      await new Promise<void>((resolve, reject) => {
        // Recupera prima i paths esistenti
        this.gun
          .get("WalletPaths")
          .get(userpub)
          .once((data: any) => {
            const paths = data && data.paths ? { ...data.paths } : {};

            // Aggiungi il nuovo path
            paths[`path_${nextIndex}`] = derivationPath;

            // Salva i paths aggiornati
            this.gun
              .get("WalletPaths")
              .get(userpub)
              .put({ paths }, (ack: any) => {
                if (ack.err) {
                  reject(new Error(ack.err));
                } else {
                  resolve();
                }
              });
          });
      });

      return walletInfo;
    } catch (error: any) {
      console.error("Errore nella creazione del wallet:", error);
      throw new Error(error.message || "Errore nella creazione del wallet");
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
  ): Promise<{ success: boolean; userPub?: string; error?: string }> {
    try {
      log("Inizio processo di login...");

      // Prima verifichiamo se l'utente esiste su Hedgehog
      log("Verifica credenziali Hedgehog...");
      try {
        await this.hedgehog.login(username, password);
        log("Login Hedgehog completato con successo");
      } catch (hedgehogError) {
        console.error("Errore login Hedgehog:", hedgehogError);
        throw new Error("Username o password non validi");
      }

      // Poi autentichiamo l'utente su GUN
      log("Autenticazione GUN...");
      try {
        await this.gundb.authenticateGunUser(username, password);
        log("Autenticazione GUN completata con successo");
      } catch (gunError: unknown) {
        console.error("Errore autenticazione GUN:", gunError);
        if (
          gunError instanceof Error &&
          gunError.message.includes("Wrong user or password")
        ) {
          log("Tentativo di creazione utente GUN...");
          await this.gundb.createGunUser(username, password);
        } else {
          throw gunError;
        }
      }

      const user = this.gundb.gun.user();

      const pair = (user as any)._?.sea;
      if (!user.is) {
        throw new Error("Autenticazione GUN fallita: utente non autenticato");
      }

      if (user.is) {
        sessionStorage.setItem("gun-current-pair", JSON.stringify(pair));
        if (setUserpub) setUserpub(user.is.pub);
      } else {
        throw new Error("Chiavi GUN mancanti dopo l'autenticazione");
      }

      if (setSignedIn) setSignedIn(true);
      return { success: true, userPub: user.is.pub };
    } catch (e: any) {
      console.error("Errore durante il login:", e);
      try {
        this.gundb.logout();
        sessionStorage.removeItem("gun-current-pair");
      } catch (cleanupError) {
        console.error("Errore durante il cleanup:", cleanupError);
      }
      return { success: false, error: e.message || "Errore durante il login" };
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
  ): Promise<{ success: boolean; userPub?: string; error?: string }> {
    log("Start handleSignUp");

    try {
      // Verifica esistenza utente
      log("Verifica esistenza utente", username);

      try {
        log("Tentativo login Hedgehog per verifica esistenza...");
        const loginResult = await this.hedgehog.login(username, password);
        log("Risultato login Hedgehog:", loginResult);
        return {
          success: false,
          error: messages.exists || "Utente già esistente",
        };
      } catch (hedgehogError) {
        log("Utente non esistente in Hedgehog, procedo con la registrazione");
      }

      // Crea utente GUN
      log("Creazione utente GUN");
      try {
        await this.gundb.createGunUser(username, password);
        log("Utente GUN creato con successo");
      } catch (gunError: any) {
        log("Errore creazione utente GUN:", gunError);
        throw new Error(
          gunError.message || "Errore nella creazione utente GUN"
        );
      }

      // Autentica utente GUN
      log("Autenticazione utente GUN");
      await this.gundb.authenticateGunUser(username, password);

      // Recupera chiave pubblica
      const userPub = this.gundb.gun?.user()?.is?.pub;
      if (setUserpub && userPub) setUserpub(userPub);

      // Registra su Hedgehog
      log("Registrazione su Hedgehog");
      await this.hedgehog.signUp(username, password);

      // Inizializza wallet paths
      log("Inizializzazione wallet paths");
      await this.initializeWalletPaths(userPub || "");

      if (setSignedIn) setSignedIn(true);

      log("Registrazione completata con successo");
      return { success: true, userPub };
    } catch (e: any) {
      console.error("Errore durante la registrazione:", e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Gestisce il logout
   * @param {string} userpub - Chiave pubblica dell'utente
   * @param {Function} resetState - Funzione per resettare lo stato
   */
  performLogout(userpub: string, resetState?: Function): void {
    try {
      this.hedgehog.logout();
      this.gundb.logout();

      if (userpub) {
        sessionStorage.removeItem("gun-current-pair");
        localStorage.removeItem(`gun-keys-${userpub}`);
      }

      if (typeof resetState === "function") {
        resetState();
      }
    } catch (error) {
      console.error("Errore durante il logout:", error);
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
    data?: { userPub?: string; password?: string; wallet?: any; error?: string }
  ): AuthResult {
    return {
      success,
      ...(data || {}),
    };
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

export { LoginWithShogunReact  };
export default ShogunSDK;
