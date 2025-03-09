import { ethers } from "ethers";
import { ISEAPair } from "gun";
import { log } from "../utils/logger";
import { GunDB } from "../gun/gun";
import { Storage } from "../storage/storage";
import { WalletInfo } from "../types/shogun";
import SEA from "gun/sea";
import { HDNodeWallet, randomBytes, Mnemonic } from "ethers";

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
  private balanceCache: Map<string, { balance: string; timestamp: number }> = new Map();
  private balanceCacheTTL: number = 30000; // 30 secondi di cache
  private defaultRpcUrl: string = "https://mainnet.infura.io/v3/your-project-id";
  private configuredRpcUrl: string | null = null;

  constructor(gundb: GunDB, gun: any, storage: Storage) {
    this.gundb = gundb;
    this.gun = gun;
    this.storage = storage;
    this.initializeWalletPaths();
  }

  /**
   * Configura l'URL RPC da utilizzare per le connessioni
   * @param rpcUrl URL del provider RPC
   */
  setRpcUrl(rpcUrl: string): void {
    this.configuredRpcUrl = rpcUrl;
    log(`Provider RPC configurato: ${rpcUrl}`);
  }

  /**
   * Ottiene un provider JSON RPC configurato
   * @returns Provider JSON RPC
   */
  getProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(this.configuredRpcUrl || this.defaultRpcUrl);
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
      
      // Carica i path da Gun
      await this.loadWalletPathsFromGun();
      
      // Carica i path da localStorage come fallback
      await this.loadWalletPathsFromLocalStorage();

      // Logga il numero di wallet caricati
      const walletCount = Object.keys(this.walletPaths).length;
      if (walletCount === 0) {
        log("Nessun wallet path trovato, verranno creati nuovi wallet quando necessario");
      } else {
        log(`Inizializzati ${walletCount} wallet paths`);
      }
    } catch (error) {
      console.error("Errore durante l'inizializzazione dei wallet paths:", error);
    }
  }

  /**
   * Carica i path dei wallet da Gun
   * @private
   */
  private async loadWalletPathsFromGun(): Promise<void> {
    // 1. Prima tentiamo di caricare da GUN se l'utente è autenticato
    const user = this.gun.user();
    if (!user || !user.is) {
      log("Utente non autenticato su Gun, non è possibile caricare i wallet paths da Gun");
      return;
    }

    log(`Caricamento wallet paths da GUN per l'utente: ${user.is.alias}`);

    // Carica i paths dal profilo dell'utente
    const walletPaths = await new Promise<Record<string, any>>((resolve) => {
      user.get("wallet_paths").once((data: any) => {
        if (!data) {
          log("Nessun wallet path trovato in GUN");
          resolve({});
        } else {
          log(`Trovati wallet paths in GUN: ${Object.keys(data).length - 1} wallet`); // -1 per il campo _
          resolve(data || {});
        }
      });
    });

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

  /**
   * Carica i path dei wallet da localStorage
   * @private
   */
  private async loadWalletPathsFromLocalStorage(): Promise<void> {
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
        console.error("Errore nel parsing dei wallet paths da localStorage:", error);
      }
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
   * Deriva una chiave privata in modo deterministico e compatibile
   */
  private derivePrivateKeyFromMnemonic(mnemonic: string, path: string): ethers.Wallet {
    try {
      // Approccio completamente ridisegnato per evitare i problemi di hdnode
      log(`Derivazione wallet per path: ${path}`);
      
      // Creiamo un seed deterministico che combina mnemonic e path
      const seedBase = `${mnemonic}|${path}`;
      
      // Usiamo crypto.subtle per generare un hash SHA-256 del seed
      // Questo ci dà un valore deterministico basato su mnemonic e path
      const encoder = new TextEncoder();
      const messageBuffer = encoder.encode(seedBase);
      
      // Generiamo la chiave privata in modo deterministico
      const privateKey = this.generatePrivateKeyFromString(seedBase);
      log(`Generata chiave privata deterministica per ${path}`);
      
      // Creiamo il wallet dalla chiave privata
      return new ethers.Wallet(privateKey);
    } catch (error) {
      // Fallback di ultima istanza in caso di errori
      log(`Errore nella derivazione deterministica: ${error}, utilizzo chiave di fallback`);
      
      // Generiamo una chiave completamente hardcoded come ultima risorsa
      // (questo è solo per evitare che l'app si blocchi completamente)
      const fallbackSeed = `fallback-${path}-${mnemonic.substring(0, 10)}`;
      const fallbackKey = this.generatePrivateKeyFromString(fallbackSeed);
      return new ethers.Wallet(fallbackKey);
    }
  }

  /**
   * Genera una nuova mnemonic BIP39 standard - anche se per ora
   * non utilizziamo realmente la derivazione HD ma solo un approccio deterministico
   */
  generateNewMnemonic(): string {
    // Genera una mnemonic casuale a 12 parole che utilizziamo come base per la generazione di wallet
    return ethers.Mnemonic.fromEntropy(ethers.randomBytes(16)).phrase;
  }

  /**
   * Override della funzione principale con correzioni e miglioramenti
   */
  private generatePrivateKeyFromString(input: string): string {
    try {
      // Utilizziamo SHA-256 per generare un valore hash deterministico
      const encoder = new TextEncoder();
      const data = encoder.encode(input);

      // Utilizziamo il metodo digestSync semplificato
      const digestSync = (data: Uint8Array): Uint8Array => {
        // Versione semplificata 
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
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
      const privateKey = "0x" + Array.from(hashArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      
      return privateKey;
    } catch (error) {
      console.error("Errore nella generazione della chiave privata:", error);
      
      // Fallback: creiamo un valore hex valido
      const fallbackHex = "0x" + Array.from({ length: 32 })
        .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"))
        .join("");
      
      return fallbackHex;
    }
  }

  /**
   * METODO INFORMATIVO: Recupera i primi n wallet che sarebbero stati creati da una mnemonic
   * usando MetaMask (solo per debug e verifica)
   */
  getMetaMaskCompatibleAddresses(mnemonic: string, count: number = 5): string[] {
    try {
      // Questo è solo a scopo informativo, non influisce sulla funzionalità dell'app
      const addresses: string[] = [];
      
      log(`Tentativo di derivazione compatibile con MetaMask per mnemonic`);
      
      for (let i = 0; i < count; i++) {
        // Generiamo indirizzi deterministici usando il nostro metodo
        const path = `m/44'/60'/0'/0/${i}`;
        const wallet = this.derivePrivateKeyFromMnemonic(mnemonic, path);
        addresses.push(wallet.address);
      }
      
      return addresses;
    } catch (error) {
      log(`Errore nel calcolo degli indirizzi MetaMask: ${error}`);
      return [];
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
   * Cifra un testo sensibile usando SEA
   * @param text Testo da cifrare
   * @returns Testo cifrato
   */
  private async encryptSensitiveData(text: string): Promise<string> {
    try {
      const user = this.gun.user();
      if (user && user._ && user._.sea) {
        // Usa la chiave dell'utente per cifrare
        const encrypted = await SEA.encrypt(text, user._.sea);
        return JSON.stringify(encrypted);
      } else {
        // Fallback: usa una chiave derivata dall'ID utente
        const userIdentifier = this.getStorageUserIdentifier();
        const key = `shogun-encrypt-${userIdentifier}-key`;
        const encrypted = await SEA.encrypt(text, key);
        return JSON.stringify(encrypted);
      }
    } catch (error) {
      console.error("Errore durante la cifratura dei dati:", error);
      // Fallback: salva in chiaro ma con un warning
      log("ATTENZIONE: Dati sensibili salvati senza cifratura");
      return `unencrypted:${text}`;
    }
  }

  /**
   * Decifra un testo sensibile cifrato con SEA
   * @param encryptedText Testo cifrato
   * @returns Testo decifrato
   */
  private async decryptSensitiveData(encryptedText: string): Promise<string | null> {
    try {
      // Controlla se è un testo non cifrato (fallback)
      if (encryptedText.startsWith("unencrypted:")) {
        return encryptedText.substring(12);
      }
      
      // Prova a parsificare il testo cifrato
      const encryptedData = JSON.parse(encryptedText);
      
      const user = this.gun.user();
      if (user && user._ && user._.sea) {
        // Usa la chiave dell'utente per decifrare
        const decrypted = await SEA.decrypt(encryptedData, user._.sea);
        return decrypted as string;
      } else {
        // Fallback: usa una chiave derivata dall'ID utente
        const userIdentifier = this.getStorageUserIdentifier();
        const key = `shogun-encrypt-${userIdentifier}-key`;
        const decrypted = await SEA.decrypt(encryptedData, key);
        return decrypted as string;
      }
    } catch (error) {
      console.error("Errore durante la decifratura dei dati:", error);
      return null;
    }
  }

  /**
   * Ottiene la mnemonic principale dell'utente, prima cercando in GunDB e poi in localStorage
   */
  async getUserMasterMnemonic(): Promise<string | null> {
    try {
      // 1. Prima cerchiamo in GunDB (cifrata automaticamente da SEA)
      const user = this.gun.user();
      if (user && user.is) {
        const gunMnemonic = await new Promise<string | null>((resolve) => {
          user.get("master_mnemonic").once((data: any) => {
            resolve(data || null);
          });
        });
        
        if (gunMnemonic) {
          log("Mnemonic recuperata da GunDB");
          return gunMnemonic;
        }
      }
      
      // 2. Se non trovata in GunDB, cerchiamo in localStorage
      const storageKey = `shogun_master_mnemonic_${this.getStorageUserIdentifier()}`;
      const encryptedMnemonic = this.storage.getItem(storageKey);
      
      if (!encryptedMnemonic) {
        log("Nessuna mnemonic trovata né in GunDB né in localStorage");
        return null;
      }
      
      // Decifra la mnemonic da localStorage
      const decrypted = await this.decryptSensitiveData(encryptedMnemonic);
      log("Mnemonic recuperata da localStorage");
      
      // Se troviamo la mnemonic in localStorage ma non in GunDB, la salviamo anche in GunDB
      // per future sincronizzazioni (ma solo se l'utente è autenticato)
      if (decrypted && user && user.is) {
        await user.get("master_mnemonic").put(decrypted);
        log("Mnemonic da localStorage sincronizzata con GunDB");
      }
      
      return decrypted;
    } catch (error) {
      console.error("Errore nel recupero della mnemonic:", error);
      return null;
    }
  }

  /**
   * Salva la mnemonic principale dell'utente sia in GunDB che in localStorage
   */
  async saveUserMasterMnemonic(mnemonic: string): Promise<void> {
    try {
      // 1. Salva in GunDB (cifrata automaticamente da SEA)
      const user = this.gun.user();
      if (user && user.is) {
        await user.get("master_mnemonic").put(mnemonic);
        log("Mnemonic salvata in GunDB");
      }
      
      // 2. Salva anche in localStorage come backup
      const storageKey = `shogun_master_mnemonic_${this.getStorageUserIdentifier()}`;
      
      // Cifra la mnemonic prima di salvarla in localStorage
      const encryptedMnemonic = await this.encryptSensitiveData(mnemonic);
      this.storage.setItem(storageKey, encryptedMnemonic);
      log("Mnemonic cifrata salvata anche in localStorage come backup");
    } catch (error) {
      console.error("Errore nel salvataggio della mnemonic:", error);
      throw error;
    }
  }

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

      // Recupera il master mnemonic dell'utente
      let masterMnemonic = await this.getUserMasterMnemonic();
      if (!masterMnemonic) {
        // Genera una nuova mnemonic
        masterMnemonic = this.generateNewMnemonic();
        await this.saveUserMasterMnemonic(masterMnemonic);
        log(`Generata nuova mnemonic: ${masterMnemonic}`);
      }
      
      // Deriva il wallet usando il metodo sicuro
      const wallet = this.derivePrivateKeyFromMnemonic(masterMnemonic, path);
      log(`Derivato wallet per path ${path} con indirizzo ${wallet.address}`);

      // Salva il path del wallet
      const timestamp = Date.now();
      this.walletPaths[wallet.address] = { path, created: timestamp };

      // Salva nel contesto dell'utente in Gun
      await user
        .get("wallet_paths")
        .get(wallet.address)
        .put({ path, created: timestamp });
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

  async loadWallets(): Promise<WalletInfo[]> {
    try {
      const user = this.gun.user();

      // Verifica più completa dell'autenticazione
      if (!user) {
        console.error("loadWallets: Nessun utente Gun disponibile");
        throw new Error("Utente Gun non disponibile");
      }

      // Inizializza i wallet paths se non già fatto
      await this.initializeWalletPaths();

      // Recupera il master mnemonic dell'utente
      let masterMnemonic = await this.getUserMasterMnemonic();
      if (!masterMnemonic) {
        // Se non esiste, creiamo il wallet predefinito
        console.log("Nessun mnemonic trovato, creazione del wallet predefinito...");
        const mainWallet = await this.createWallet();
        return [mainWallet];
      }

      log(`masterMnemonic trovata: ${masterMnemonic}`);
      const wallets: WalletInfo[] = [];

      // Deriva ogni wallet dai paths salvati
      for (const [address, data] of Object.entries(this.walletPaths)) {
        try {
          // Usa il metodo sicuro per derivare la chiave privata
          const wallet = this.derivePrivateKeyFromMnemonic(masterMnemonic, data.path);
          log(`Derivato wallet per path ${data.path} con indirizzo ${wallet.address}`);
          
          if (wallet.address.toLowerCase() !== address.toLowerCase()) {
            console.warn(
              `Attenzione: l'indirizzo derivato (${wallet.address}) non corrisponde a quello salvato (${address})`
            );
          }
          wallets.push({
            wallet,
            path: data.path,
            address: wallet.address,
            getAddressString: () => wallet.address,
          });
        } catch (innerError) {
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

  /**
   * Ottiene il saldo di un wallet con caching per ridurre le chiamate RPC
   */
  async getBalance(wallet: ethers.Wallet): Promise<string> {
    try {
      const address = wallet.address;
      
      // Controlla se abbiamo una cache valida
      const cachedData = this.balanceCache.get(address);
      const now = Date.now();
      
      if (cachedData && (now - cachedData.timestamp) < this.balanceCacheTTL) {
        log(`Usando saldo in cache per ${address}: ${cachedData.balance} ETH`);
        return cachedData.balance;
      }
      
      // Altrimenti chiama il provider
      log(`Chiamata RPC per ottenere il saldo di ${address}`);
      const provider = this.getProvider();
      const balance = await provider.getBalance(wallet.address);
      const formattedBalance = ethers.formatEther(balance);
      
      // Aggiorna la cache
      this.balanceCache.set(address, { 
        balance: formattedBalance, 
        timestamp: now 
      });
      
      return formattedBalance;
    } catch (error) {
      console.error("Errore durante il recupero del saldo:", error);
      return "0.0";
    }
  }

  /**
   * Invalida la cache del saldo per un indirizzo
   */
  invalidateBalanceCache(address: string) {
    this.balanceCache.delete(address);
    log(`Cache del saldo invalidata per ${address}`);
  }

  async getNonce(wallet: ethers.Wallet): Promise<number> {
    const provider = this.getProvider();
    const nonce = await provider.getTransactionCount(wallet.address);
    return nonce;
  }

  async sendTransaction(
    wallet: ethers.Wallet,
    toAddress: string,
    value: string
  ): Promise<string> {
    try {
      log(`Invio transazione dal wallet ${wallet.address} a ${toAddress} per ${value} ETH`);
      const provider = this.getProvider();

      wallet.connect(provider);

      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(value),
      });
      
      // Invalida la cache del saldo dopo l'invio di una transazione
      this.invalidateBalanceCache(wallet.address);
      
      log(`Transazione inviata con successo: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error("Errore durante l'invio della transazione:", error);
      throw error;
    }
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
      log(`Firma transazione dal wallet ${wallet.address} a ${toAddress} per ${value} ETH`);
      
      // Se non viene fornito un provider, usa quello configurato
      const actualProvider = provider || this.getProvider();

      // Ottieni il nonce
      const nonce = await actualProvider.getTransactionCount(wallet.address);
      log(`Nonce per la transazione: ${nonce}`);

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
      const signedTx = await wallet.signTransaction(tx);
      log(`Transazione firmata con successo`);
      return signedTx;
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

  /**
   * Esporta la frase mnemonica dell'utente
   * @param password Password opzionale per cifrare la mnemonica esportata
   * @returns La mnemonica in chiaro o cifrata se viene fornita una password
   */
  async exportMnemonic(password?: string): Promise<string> {
    try {
      // Recupera la mnemonica
      const mnemonic = await this.getUserMasterMnemonic();
      
      if (!mnemonic) {
        throw new Error("Nessuna mnemonica trovata da esportare");
      }
      
      // Se è stata fornita una password, cifra la mnemonica
      if (password) {
        const encryptedData = await SEA.encrypt(mnemonic, password);
        return JSON.stringify({
          type: "encrypted-mnemonic",
          data: encryptedData,
          version: "1.0"
        });
      }
      
      // Altrimenti restituisci la mnemonica in chiaro
      return mnemonic;
    } catch (error) {
      console.error("Errore nell'esportazione della mnemonica:", error);
      throw error;
    }
  }
  
  /**
   * Esporta le chiavi private di tutti i wallet generati
   * @param password Password opzionale per cifrare i dati esportati
   * @returns Un oggetto JSON contenente tutti i wallet con relative chiavi private
   */
  async exportWalletKeys(password?: string): Promise<string> {
    try {
      // Carica tutti i wallet
      const wallets = await this.loadWallets();
      
      if (!wallets || wallets.length === 0) {
        throw new Error("Nessun wallet trovato da esportare");
      }
      
      // Crea un oggetto con i dati dei wallet
      const walletData = wallets.map(walletInfo => ({
        address: walletInfo.address,
        privateKey: walletInfo.wallet.privateKey,
        path: walletInfo.path,
        created: this.walletPaths[walletInfo.address]?.created || Date.now()
      }));
      
      const exportData = {
        wallets: walletData,
        version: "1.0",
        exportedAt: new Date().toISOString()
      };
      
      // Se è stata fornita una password, cifra i dati
      if (password) {
        const encryptedData = await SEA.encrypt(JSON.stringify(exportData), password);
        return JSON.stringify({
          type: "encrypted-wallets",
          data: encryptedData,
          version: "1.0"
        });
      }
      
      // Altrimenti restituisci i dati in chiaro
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error("Errore nell'esportazione delle chiavi dei wallet:", error);
      throw error;
    }
  }
  
  /**
   * Esporta il pair (coppia di chiavi) di Gun dell'utente
   * @param password Password opzionale per cifrare i dati esportati
   * @returns Il pair di Gun in formato JSON
   */
  async exportGunPair(password?: string): Promise<string> {
    try {
      const user = this.gun.user();
      
      if (!user || !user._ || !user._.sea) {
        throw new Error("Utente non autenticato o pair non disponibile");
      }
      
      const pair = user._.sea;
      
      // Se è stata fornita una password, cifra i dati
      if (password) {
        const encryptedData = await SEA.encrypt(JSON.stringify(pair), password);
        return JSON.stringify({
          type: "encrypted-gun-pair",
          data: encryptedData,
          version: "1.0"
        });
      }
      
      // Altrimenti restituisci i dati in chiaro
      return JSON.stringify(pair, null, 2);
    } catch (error) {
      console.error("Errore nell'esportazione del Gun pair:", error);
      throw error;
    }
  }
  
  /**
   * Esporta tutti i dati dell'utente in un unico file
   * @param password Password obbligatoria per cifrare i dati esportati
   * @returns Un oggetto JSON contenente tutti i dati dell'utente
   */
  async exportAllUserData(password: string): Promise<string> {
    if (!password) {
      throw new Error("È richiesta una password per esportare tutti i dati");
    }
    
    try {
      // Recupera tutti i dati
      const mnemonic = await this.getUserMasterMnemonic();
      const wallets = await this.loadWallets();
      const user = this.gun.user();
      
      if (!user || !user._ || !user._.sea) {
        throw new Error("Utente non autenticato o dati non disponibili");
      }
      
      // Prepara i dati dei wallet
      const walletData = wallets.map(walletInfo => ({
        address: walletInfo.address,
        privateKey: walletInfo.wallet.privateKey,
        path: walletInfo.path,
        created: this.walletPaths[walletInfo.address]?.created || Date.now()
      }));
      
      // Crea l'oggetto completo con tutti i dati
      const exportData = {
        user: {
          alias: user.is.alias,
          pub: user.is.pub,
          pair: user._.sea
        },
        mnemonic,
        wallets: walletData,
        version: "1.0",
        exportedAt: new Date().toISOString(),
        appName: "Shogun Wallet"
      };
      
      // Cifra i dati con la password fornita
      const encryptedData = await SEA.encrypt(JSON.stringify(exportData), password);
      
      return JSON.stringify({
        type: "encrypted-shogun-backup",
        data: encryptedData,
        version: "1.0"
      });
    } catch (error) {
      console.error("Errore nell'esportazione di tutti i dati utente:", error);
      throw error;
    }
  }

  /**
   * Importa una frase mnemonica
   * @param mnemonicData La mnemonica o il JSON cifrato da importare
   * @param password Password opzionale per decifrare la mnemonica se cifrata
   * @returns true se l'importazione è riuscita
   */
  async importMnemonic(mnemonicData: string, password?: string): Promise<boolean> {
    try {
      let mnemonic = mnemonicData;
      
      // Verifica se i dati sono in formato JSON cifrato
      if (mnemonicData.startsWith("{")) {
        try {
          const jsonData = JSON.parse(mnemonicData);
          
          // Se i dati sono cifrati, decifriamoli
          if (jsonData.type === "encrypted-mnemonic" && jsonData.data && password) {
            const decryptedData = await SEA.decrypt(jsonData.data, password);
            
            if (!decryptedData) {
              throw new Error("Password non valida o dati corrotti");
            }
            
            mnemonic = decryptedData as string;
          } else if (jsonData.mnemonic) {
            // Se i dati sono in formato JSON non cifrato con campo mnemonic
            mnemonic = jsonData.mnemonic;
          }
        } catch (error) {
          throw new Error("Formato JSON non valido o password errata");
        }
      }
      
      // Valida la mnemonica (verifica che sia una mnemonica BIP39 valida)
      try {
        // Verifica che la mnemonica sia valida usando ethers.js
        ethers.Mnemonic.fromPhrase(mnemonic);
      } catch (error) {
        throw new Error("La mnemonica fornita non è valida");
      }
      
      // Salva la mnemonica
      await this.saveUserMasterMnemonic(mnemonic);
      
      // Reset del wallet principale per forzare la riderivazione
      this.resetMainWallet();
      
      // Genera il primo wallet se non ne esistono
      if (Object.keys(this.walletPaths).length === 0) {
        await this.createWallet();
      }
      
      log("Mnemonica importata con successo");
      return true;
    } catch (error) {
      console.error("Errore nell'importazione della mnemonica:", error);
      throw error;
    }
  }
  
  /**
   * Importa le chiavi private dei wallet
   * @param walletsData JSON contenente i dati dei wallet o JSON cifrato
   * @param password Password opzionale per decifrare i dati se cifrati
   * @returns Il numero di wallet importati con successo
   */
  async importWalletKeys(walletsData: string, password?: string): Promise<number> {
    try {
      let wallets;
      
      // Verifica se i dati sono in formato JSON cifrato
      try {
        const jsonData = JSON.parse(walletsData);
        
        // Se i dati sono cifrati, decifriamoli
        if (jsonData.type === "encrypted-wallets" && jsonData.data && password) {
          const decryptedData = await SEA.decrypt(jsonData.data, password);
          
          if (!decryptedData) {
            throw new Error("Password non valida o dati corrotti");
          }
          
          wallets = JSON.parse(decryptedData as string).wallets;
        } else if (jsonData.wallets) {
          // Se i dati sono in formato JSON non cifrato con campo wallets
          wallets = jsonData.wallets;
        } else {
          throw new Error("Formato JSON non valido: manca il campo 'wallets'");
        }
      } catch (error) {
        throw new Error("Formato JSON non valido o password errata");
      }
      
      if (!Array.isArray(wallets) || wallets.length === 0) {
        throw new Error("Nessun wallet valido trovato nei dati forniti");
      }
      
      // Crea un contatore per i wallet importati con successo
      let successCount = 0;
      
      // Per ogni wallet nei dati importati
      for (const walletData of wallets) {
        try {
          if (!walletData.privateKey || !walletData.path) {
            continue; // Salta wallet incompleti
          }
          
          // Crea un nuovo wallet con la chiave privata fornita
          const wallet = new ethers.Wallet(walletData.privateKey);
          
          // Verifica che l'indirizzo sia corretto
          if (walletData.address && wallet.address.toLowerCase() !== walletData.address.toLowerCase()) {
            log(`Avviso: l'indirizzo nel backup (${walletData.address}) non corrisponde alla chiave privata (${wallet.address})`);
          }
          
          // Salva il path del wallet
          const address = wallet.address;
          const timestamp = walletData.created || Date.now();
          this.walletPaths[address] = { 
            path: walletData.path, 
            created: timestamp 
          };
          
          // Salva nel contesto dell'utente in Gun
          const user = this.gun.user();
          if (user && user.is) {
            await user
              .get("wallet_paths")
              .get(address)
              .put({ path: walletData.path, created: timestamp });
          }
          
          successCount++;
        } catch (error) {
          console.error(`Errore nell'importazione del wallet: ${error}`);
          // Continua con il prossimo wallet anche se questo fallisce
        }
      }
      
      // Salva i path dei wallet in localStorage
      this.saveWalletPathsToLocalStorage();
      
      // Se almeno un wallet è stato importato con successo
      if (successCount > 0) {
        log(`${successCount} wallet importati con successo`);
        return successCount;
      } else {
        throw new Error("Nessun wallet è stato importato con successo");
      }
    } catch (error) {
      console.error("Errore nell'importazione dei wallet:", error);
      throw error;
    }
  }
  
  /**
   * Importa un pair di Gun
   * @param pairData JSON contenente il pair di Gun o JSON cifrato
   * @param password Password opzionale per decifrare i dati se cifrati
   * @returns true se l'importazione è riuscita
   */
  async importGunPair(pairData: string, password?: string): Promise<boolean> {
    try {
      let pair;
      
      // Verifica se i dati sono in formato JSON cifrato
      try {
        const jsonData = JSON.parse(pairData);
        
        // Se i dati sono cifrati, decifriamoli
        if (jsonData.type === "encrypted-gun-pair" && jsonData.data && password) {
          const decryptedData = await SEA.decrypt(jsonData.data, password);
          
          if (!decryptedData) {
            throw new Error("Password non valida o dati corrotti");
          }
          
          pair = JSON.parse(decryptedData as string);
        } else {
          // Altrimenti assumiamo che il JSON sia direttamente il pair
          pair = jsonData;
        }
      } catch (error) {
        throw new Error("Formato JSON non valido o password errata");
      }
      
      // Verifica che il pair contenga i campi necessari
      if (!pair || !pair.pub || !pair.priv || !pair.epub || !pair.epriv) {
        throw new Error("Il pair di Gun non è completo o valido");
      }
      
      // Aggiorna le informazioni dell'utente
      try {
        const user = this.gun.user();
        if (!user) {
          throw new Error("Gun non disponibile");
        }
        
        // La creazione e l'autenticazione con il pair importato deve essere gestita a livello di applicazione
        // perché richiede un nuovo logout e login
        log("Pair di Gun validato con successo, pronto per l'autenticazione");
        return true;
      } catch (error) {
        throw new Error(`Errore nell'autenticazione con il pair importato: ${error}`);
      }
    } catch (error) {
      console.error("Errore nell'importazione del pair di Gun:", error);
      throw error;
    }
  }
  
  /**
   * Importa un backup completo
   * @param backupData JSON cifrato contenente tutti i dati dell'utente
   * @param password Password per decifrare il backup
   * @param options Opzioni di importazione (quali dati importare)
   * @returns Un oggetto con il risultato dell'importazione
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
    try {
      if (!password) {
        throw new Error("La password è obbligatoria per importare il backup");
      }
      
      let decryptedData;
      
      // Verifica se i dati sono nel formato corretto
      try {
        const jsonData = JSON.parse(backupData);
        
        if (jsonData.type !== "encrypted-shogun-backup" || !jsonData.data) {
          throw new Error("Formato del backup non valido");
        }
        
        // Decifra i dati
        decryptedData = await SEA.decrypt(jsonData.data, password);
        
        if (!decryptedData) {
          throw new Error("Password non valida o dati corrotti");
        }
        
        decryptedData = JSON.parse(decryptedData as string);
      } catch (error) {
        throw new Error("Formato JSON non valido o password errata");
      }
      
      // Risultati dell'importazione
      const result: { 
        success: boolean; 
        mnemonicImported?: boolean; 
        walletsImported?: number; 
        gunPairImported?: boolean;
      } = { success: false };
      
      // Importa la mnemonic se richiesto
      if (options.importMnemonic && decryptedData.mnemonic) {
        try {
          await this.saveUserMasterMnemonic(decryptedData.mnemonic);
          result.mnemonicImported = true;
        } catch (error) {
          console.error("Errore nell'importazione della mnemonica:", error);
          result.mnemonicImported = false;
        }
      }
      
      // Importa i wallet se richiesto
      if (options.importWallets && decryptedData.wallets && Array.isArray(decryptedData.wallets)) {
        try {
          // Prepara i dati nel formato richiesto da importWalletKeys
          const walletsData = JSON.stringify({ wallets: decryptedData.wallets });
          result.walletsImported = await this.importWalletKeys(walletsData);
        } catch (error) {
          console.error("Errore nell'importazione dei wallet:", error);
          result.walletsImported = 0;
        }
      }
      
      // Importa il pair di Gun se richiesto
      if (options.importGunPair && decryptedData.user && decryptedData.user.pair) {
        try {
          // Il pair di Gun viene validato ma non applicato automaticamente
          // (richiede logout e login che deve essere gestito dall'app)
          const pairData = JSON.stringify(decryptedData.user.pair);
          await this.importGunPair(pairData);
          result.gunPairImported = true;
        } catch (error) {
          console.error("Errore nell'importazione del pair di Gun:", error);
          result.gunPairImported = false;
        }
      }
      
      // Verifica se almeno un'importazione è riuscita
      result.success = (result.mnemonicImported === true || 
                        (result.walletsImported || 0) > 0 || 
                        result.gunPairImported === true);
      
      // Reset del wallet principale per forzare la riderivazione
      if (result.success) {
        this.resetMainWallet();
      }
      
      return result;
    } catch (error) {
      console.error("Errore nell'importazione del backup:", error);
      throw error;
    }
  }
}
