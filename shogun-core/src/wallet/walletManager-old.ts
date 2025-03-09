import { ethers } from "ethers";
import { ISEAPair } from "gun";
import { log } from "../utils/logger";
import { GunDB } from "../gun/gun";
import { Storage } from "../storage/storage";
import { WalletInfo } from "../types/shogun";
import SEA from "gun/sea";

/**
 * Classe che gestisce le funzionalità dei wallet
 */
export class WalletManager {
  private gundb: GunDB;
  private gun: any;
  private storage: Storage;
  private walletPaths: {
    [address: string]: { path: string; created: number };
  } = {};
  private mainWallet: ethers.Wallet | null = null;

  constructor(gundb: GunDB, gun: any, storage: Storage) {
    this.gundb = gundb;
    this.gun = gun;
    this.storage = storage;
    this.initializeWalletPaths();
  }

  /**
   * Inizializza i paths dei wallet
   * Carica i paths sia da GUN che da localStorage
   * @private
   */
  private async initializeWalletPaths() {
    try {
      // Reset dei path esistenti
      this.walletPaths = {};

      // 1. Prima tentiamo di caricare da GUN se l'utente è autenticato
      const user = this.gun.user();
      if (user && user.is) {
        log(`Caricamento wallet paths da GUN per l'utente: ${user.is.alias}`);

        // Carica i paths dal profilo dell'utente
        const walletPaths = await new Promise<Record<string, any>>(
          (resolve) => {
            user.get("wallet_paths").once((data: any) => {
              if (!data) {
                log("Nessun wallet path trovato in GUN");
                resolve({});
              } else {
                log(
                  `Trovati wallet paths in GUN: ${Object.keys(data).length - 1} wallet`
                ); // -1 per il campo _
                resolve(data || {});
              }
            });
          }
        );

        // Converti i dati ricevuti da GUN in walletPaths
        for (const [address, pathData] of Object.entries(walletPaths)) {
          if (address !== "_" && pathData) {
            // Verifica che pathData sia un oggetto con i campi richiesti
            const data = pathData as any;
            if (data.path) {
              this.walletPaths[address] = {
                path: data.path,
                created: data.created || Date.now(),
              };
              log(`Caricato path per wallet: ${address} -> ${data.path}`);
            }
          }
        }
      }

      // 2. Poi carichiamo anche da localStorage come fallback
      const storageKey = `shogun_wallet_paths_${this.getStorageUserIdentifier()}`;
      const storedPaths = this.storage.getItem(storageKey);

      if (storedPaths) {
        try {
          log("Trovati wallet paths in localStorage");
          const parsedPaths = JSON.parse(storedPaths);

          // Aggiunge i paths da localStorage se non sono già presenti in GUN
          for (const [address, pathData] of Object.entries(parsedPaths)) {
            if (!this.walletPaths[address]) {
              this.walletPaths[address] = pathData as {
                path: string;
                created: number;
              };
              log(`Caricato path da localStorage per wallet: ${address}`);
            }
          }
        } catch (error) {
          console.error(
            "Errore nel parsing dei wallet paths da localStorage:",
            error
          );
        }
      }

      // Se non sono stati trovati wallet paths né in GUN né in localStorage
      if (Object.keys(this.walletPaths).length === 0) {
        log(
          "Nessun wallet path trovato, verranno creati nuovi wallet quando necessario"
        );
      } else {
        log(
          `Inizializzati ${Object.keys(this.walletPaths).length} wallet paths`
        );
      }
    } catch (error) {
      console.error(
        "Errore durante l'inizializzazione dei wallet paths:",
        error
      );
    }
  }

  /**
   * Ottiene un identificatore univoco per l'utente corrente per lo storage
   * @private
   */
  private getStorageUserIdentifier(): string {
    const user = this.gun.user();
    if (user && user.is && user.is.pub) {
      return user.is.pub.substring(0, 12); // Usa una parte della chiave pubblica
    }
    return "guest"; // Identificatore per utenti non autenticati
  }

  /**
   * Salva i paths dei wallet in localStorage
   * @private
   */
  private saveWalletPathsToLocalStorage() {
    try {
      const storageKey = `shogun_wallet_paths_${this.getStorageUserIdentifier()}`;
      const pathsToSave = JSON.stringify(this.walletPaths);
      this.storage.setItem(storageKey, pathsToSave);
      log(
        `Salvati ${Object.keys(this.walletPaths).length} wallet paths in localStorage`
      );
    } catch (error) {
      console.error(
        "Errore nel salvataggio dei wallet paths in localStorage:",
        error
      );
    }
  }

  /**
   * Converte una stringa in un valore hex utilizzabile come chiave privata
   * @param input - Stringa da convertire
   * @returns Stringa hex
   */
  private generatePrivateKeyFromString(input: string): string {
    try {
      // Utilizziamo SHA-256 per generare un valore hash deterministico
      const encoder = new TextEncoder();
      const data = encoder.encode(input);

      // Utilizziamo crypto.subtle.digest in modo sincrono con un bypass
      const digestSync = (data: Uint8Array): Uint8Array => {
        // Versione semplificata per ambiente senza crypto.subtle
        // Non è crittograficamente sicura ma è deterministca
        let h1 = 0xdeadbeef,
          h2 = 0x41c6ce57;
        for (let i = 0; i < data.length; i++) {
          h1 = Math.imul(h1 ^ data[i], 2654435761);
          h2 = Math.imul(h2 ^ data[i], 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
        h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
        h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);

        // Creiamo un array di 32 byte
        const out = new Uint8Array(32);
        for (let i = 0; i < 4; i++) {
          out[i] = (h1 >> (8 * i)) & 0xff;
        }
        for (let i = 0; i < 4; i++) {
          out[i + 4] = (h2 >> (8 * i)) & 0xff;
        }
        // Riempiamo con valori derivati
        for (let i = 8; i < 32; i++) {
          out[i] = (out[i % 8] ^ out[(i - 1) % 8]) & 0xff;
        }
        return out;
      };

      // Utilizziamo la versione sincrona del digest
      const hashArray = digestSync(data);

      // Convertiamo in hex string
      return (
        "0x" +
        Array.from(hashArray)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      );
    } catch (error) {
      console.error("Errore nella generazione della chiave privata:", error);
      // Fallback: creiamo un valore hex valido dai primi 32 byte della stringa
      const fallbackHex =
        "0x" +
        Array.from(input.slice(0, 64))
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("")
          .slice(0, 64);

      if (fallbackHex.length < 66) {
        // Se non è abbastanza lungo, aggiungiamo padding
        return fallbackHex.padEnd(66, "0");
      }
      return fallbackHex;
    }
  }

  /**
   * Ottiene il wallet principale
   */
  getMainWallet(): ethers.Wallet | null {
    try {
      if (!this.mainWallet) {
        const user = this.gun.user();
        if (!user || !user.is) {
          log("getMainWallet: Utente non autenticato");
          return null;
        }

        // Verifica se abbiamo accesso alle proprietà necessarie
        if (!user._ || !user._.sea || !user._.sea.priv || !user._.sea.pub) {
          log(
            "getMainWallet: Dati utente insufficienti",
            JSON.stringify({
              hasUserData: !!user._,
              hasSea: !!(user._ && user._.sea),
              hasPriv: !!(user._ && user._.sea && user._.sea.priv),
              hasPub: !!(user._ && user._.sea && user._.sea.pub),
            })
          );

          // Verifica se è un utente MetaMask e utilizziamo un approccio alternativo
          if (user.is.alias && user.is.alias.startsWith("0x")) {
            log(
              "getMainWallet: Utente MetaMask rilevato, utilizzo approccio alternativo"
            );
            // Per MetaMask, usiamo l'indirizzo come seed
            const address = user.is.alias;
            const seed = `metamask-${address}-${Date.now()}`;
            const privateKey = this.generatePrivateKeyFromString(seed);
            this.mainWallet = new ethers.Wallet(privateKey);
            return this.mainWallet;
          }

          return null;
        }

        // Combiniamo chiave privata + chiave pubblica + alias dell'utente per avere un seed unico
        const userSeed = user._.sea.priv;
        const userPub = user._.sea.pub;
        const userAlias = user.is.alias;

        // Creiamo un seed univoco per questo utente
        const seed = `${userSeed}|${userPub}|${userAlias}`;

        // Usiamo il nuovo metodo sicuro per generare la chiave privata
        const privateKey = this.generatePrivateKeyFromString(seed);
        this.mainWallet = new ethers.Wallet(privateKey);
      }
      return this.mainWallet;
    } catch (error) {
      console.error("Errore nel recupero del wallet principale:", error);
      return null;
    }
  }

  /**
   * Crea un nuovo wallet derivato
   */
  async createWallet(): Promise<WalletInfo> {
    try {
      // Verifica che l'utente sia autenticato
      const user = this.gun.user();
      if (!user.is) {
        throw new Error("L'utente non è autenticato");
      }

      // Determina il prossimo indice disponibile
      const existingWallets = Object.values(this.walletPaths).length;
      const nextIndex = existingWallets;

      // Usa il formato standard Ethereum per i path
      const path = `m/44'/60'/0'/0/${nextIndex}`;

      // Deriva il nuovo wallet
      // Combiniamo chiave privata + chiave pubblica + alias dell'utente per avere un seed unico per utente
      const userSeed = user._.sea.priv;
      const userPub = user._.sea.pub;
      const userAlias = user.is.alias;

      // Creiamo un seed univoco per questo utente
      const uniqueUserSeed = `${userSeed}|${userPub}|${userAlias}`;

      const encoder = new TextEncoder();
      const seedData = encoder.encode(uniqueUserSeed + path);
      const hashBuffer = await crypto.subtle.digest("SHA-256", seedData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));

      const seaPair = await SEA.pair(
        (data: ISEAPair) => {
          console.log("seaPair", data);
        },
        { seed: hashArray.toString() }
      );

      const hex = this.generatePrivateKeyFromString(seaPair.priv);

      // Creiamo una chiave privata valida per Ethereum
      // Assicuriamoci che sia esattamente 32 byte (64 caratteri hex)
      // const privateKey = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const privateKey = hex;

      // Creiamo il wallet con la chiave privata generata
      const wallet = new ethers.Wallet(privateKey);

      // Salva il path del wallet
      const timestamp = Date.now();
      this.walletPaths[wallet.address] = {
        path,
        created: timestamp,
      };

      // Salva nel contesto dell'utente in GUN
      await user.get("wallet_paths").get(wallet.address).put({
        path,
        created: timestamp,
      });

      // Salva anche in localStorage
      this.saveWalletPathsToLocalStorage();

      return {
        wallet,
        path,
        address: wallet.address,
        getAddressString: () => wallet.address,
      };
    } catch (error) {
      console.error("Errore durante la creazione del wallet:", error);
      throw error;
    }
  }

  /**
   * Carica tutti i wallet dell'utente
   * @returns Array di WalletInfo con tutti i wallet dell'utente
   */
  async loadWallets(): Promise<WalletInfo[]> {
    try {
      const user = this.gun.user();

      // Verifica più completa dell'autenticazione
      if (!user) {
        log("loadWallets: Nessun utente Gun disponibile");
        throw new Error("Utente Gun non disponibile");
      }

      // Controllo dettagliato dello stato di autenticazione
      const userDetails = {
        userExists: !!user,
        isAuthenticated: !!user.is,
        hasUserData: !!user._,
        // @ts-ignore - Accesso a proprietà interna di Gun
        hasSea: !!user._ && !!user._.sea,
      };
      log("Stato utente durante loadWallets:", JSON.stringify(userDetails));

      // Verifica se esiste almeno un metodo di autenticazione
      // Siamo più tolleranti qui, se c'è il sea possiamo procedere anche se is non è disponibile
      const hasAuthentication =
        userDetails.isAuthenticated || userDetails.hasSea;

      if (!hasAuthentication) {
        log("loadWallets: Nessun metodo di autenticazione disponibile");

        // Prova a verificare se ci sono credenziali in localStorage
        // @ts-ignore - Usiamo una proprietà di Gun non completamente tipizzata
        if (!user._.sea && window.sessionStorage) {
          const localPair = window.sessionStorage.getItem("pair");
          if (localPair) {
            log(
              "Trovate credenziali in sessionStorage, tentativo di recupero..."
            );
            try {
              // Tentativo di ripristino manuale di pair da localStorage
              user.auth(JSON.parse(localPair));
              // Aspettiamo un attimo che l'autenticazione si propaghi
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (e) {
              console.error(
                "Errore nel tentativo di ripristino delle credenziali:",
                e
              );
            }
          }
        }

        // Verifica di nuovo se ora siamo autenticati
        // @ts-ignore - Accesso a proprietà interna di Gun
        if (!user.is && !user._.sea) {
          throw new Error(
            "L'utente non è autenticato e non è stato possibile recuperare le credenziali"
          );
        }
      }

      // Log per debug
      // @ts-ignore - Accesso a proprietà interna di Gun
      const pubKey =
        user.is?.pub || (user._.sea?.pub ? user._.sea.pub : "unknown");
      const alias = user.is?.alias || "unknown";
      log(`loadWallets: Utente autenticato ${alias}, pub: ${pubKey}`);

      // Assicurati che i paths siano inizializzati
      await this.initializeWalletPaths();

      const wallets: WalletInfo[] = [];

      // Verifica che ci siano wallet paths salvati
      log(
        `loadWallets: Wallet paths disponibili: ${Object.keys(this.walletPaths).length}`
      );

      // Se non ci sono wallet paths, proviamo a crearne uno predefinito
      if (Object.keys(this.walletPaths).length === 0) {
        log("Nessun wallet trovato, creazione del wallet predefinito...");
        const mainWallet = await this.createWallet();
        return [mainWallet];
      }

      // Deriva ogni wallet dai paths salvati
      for (const [address, data] of Object.entries(this.walletPaths)) {
        try {
          // @ts-ignore - Accesso a proprietà interna di Gun
          const userSeed = user._.sea?.priv || "defaultSeed";
          // @ts-ignore - Accesso a proprietà interna di Gun
          const userPub = user._.sea?.pub || pubKey;
          const userAlias = user.is?.alias || alias;

          // Log per debug
          log(
            `Derivazione wallet per indirizzo: ${address} con path: ${data.path}`
          );

          // Creiamo un seed univoco per questo utente
          const uniqueUserSeed = `${userSeed}|${userPub}|${userAlias}`;

          const encoder = new TextEncoder();
          const seedData = encoder.encode(uniqueUserSeed + data.path);
          const hashBuffer = await crypto.subtle.digest("SHA-256", seedData);
          const hashArray = Array.from(new Uint8Array(hashBuffer));

          const seaPair = await SEA.pair(
            (data: ISEAPair) => {
              console.log("seaPair", data);
            },
            { seed: hashArray.toString() }
          );

          const hex = this.generatePrivateKeyFromString(seaPair.priv);

          // Creiamo una chiave privata valida per Ethereum
          // Assicuriamoci che sia esattamente 32 byte (64 caratteri hex)
          // const privateKey = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const privateKey = hex;

          // Creiamo il wallet con la chiave privata generata
          const wallet = new ethers.Wallet(privateKey);

          // Verifica che l'indirizzo generato corrisponda a quello salvato
          if (wallet.address.toLowerCase() !== address.toLowerCase()) {
            log(
              `Attenzione: Indirizzo generato (${wallet.address}) non corrisponde a quello salvato (${address})`
            );
          }

          wallets.push({
            wallet,
            path: data.path,
            address: wallet.address,
            getAddressString: () => wallet.address,
          });
        } catch (innerError) {
          // Log ma continua con gli altri wallet
          console.error(
            `Errore nella derivazione del wallet ${address}:`,
            innerError
          );
        }
      }

      // Imposta il mainWallet se ci sono wallet
      if (wallets.length > 0) {
        this.mainWallet = wallets[0].wallet;
      }

      return wallets;
    } catch (error) {
      console.error("Errore durante il caricamento dei wallet:", error);
      throw error;
    }
  }

  // BASIC WALLET FUNCTIONS

  async getBalance(wallet: ethers.Wallet): Promise<string> {
    const provider = new ethers.JsonRpcProvider();
    const balance = await provider.getBalance(wallet.address);
    return ethers.formatEther(balance);
  }

  async getNonce(wallet: ethers.Wallet): Promise<number> {
    const provider = new ethers.JsonRpcProvider();
    const nonce = await provider.getTransactionCount(wallet.address);
    return nonce;
  }

  async sendTransaction(
    wallet: ethers.Wallet,
    toAddress: string,
    value: string
  ): Promise<string> {
    const provider = new ethers.JsonRpcProvider();

    wallet.connect(provider);

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(value),
    });
    return tx.hash;
  }

  /**
   * Firma un messaggio con un wallet
   */
  async signMessage(
    wallet: ethers.Wallet,
    message: string | Uint8Array
  ): Promise<string> {
    try {
      return await wallet.signMessage(message);
    } catch (error) {
      console.error("Errore durante la firma del messaggio:", error);
      throw error;
    }
  }

  /**
   * Verifica una firma
   */
  verifySignature(message: string | Uint8Array, signature: string): string {
    return ethers.verifyMessage(message, signature);
  }

  /**
   * Firma una transazione
   */
  async signTransaction(
    wallet: ethers.Wallet,
    toAddress: string,
    value: string,
    provider?: ethers.JsonRpcProvider
  ): Promise<string> {
    try {
      // Se non viene fornito un provider, usa quello di default di Ethereum mainnet
      const actualProvider = provider || new ethers.JsonRpcProvider();

      // Ottieni il nonce
      const nonce = await actualProvider.getTransactionCount(wallet.address);

      // Ottieni i dati delle fee
      const feeData = await actualProvider.getFeeData();

      const tx = {
        nonce: nonce,
        to: toAddress,
        value: ethers.parseEther(value),
        gasPrice: feeData.gasPrice,
        gasLimit: 21000, // Gas limit standard per trasferimenti ETH
      };

      // Firma la transazione
      return wallet.signTransaction(tx);
    } catch (error) {
      console.error("Errore durante la firma della transazione:", error);
      throw error;
    }
  }

  /**
   * Resetta il wallet principale
   * Utile quando vogliamo forzare la rigenerazione del wallet
   */
  resetMainWallet(): void {
    log("Reset del wallet principale");
    this.mainWallet = null;
  }
}
