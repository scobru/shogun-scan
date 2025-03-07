import { ethers } from "ethers";
import { HDNodeWallet } from "ethers";
import { log } from "../utils/logger";
import { GunDB } from "../gun/gun";
import { Storage } from "../storage/storage";
import { HDWalletManager } from "./hdWallet";
import { WalletInfo } from "../types/shogun";

/**
 * Classe che gestisce le funzionalità dei wallet
 */
export class WalletManager {
  private gundb: GunDB;
  private gun: any;
  private storage: Storage;
  private hdWalletManager: HDWalletManager;
  private walletPaths: { [key: string]: string } = {};
  private mainWallet: HDNodeWallet | null = null;

  constructor(gundb: GunDB, gun: any, storage: Storage) {
    this.gundb = gundb;
    this.gun = gun;
    this.storage = storage;
    this.hdWalletManager = new HDWalletManager(gundb, gun, storage);
  }

  /**
   * Inizializza i percorsi dei wallet
   * @param userPub - Chiave pubblica dell'utente
   */
  async initializeWalletPaths(userPub: string): Promise<void> {
    try {
      log("Inizializzazione dei percorsi dei wallet per l'utente:", userPub);
      
      // Recupera i percorsi dei wallet da GunDB
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          log("Timeout durante il recupero dei percorsi dei wallet da GunDB");
          resolve();
        }, 10000);
        
        this.gun.user().get("walletPaths").once((data: any) => {
          clearTimeout(timeout);
          
          if (data) {
            log("Percorsi dei wallet recuperati con successo da GunDB");
            this.walletPaths = data;
          } else {
            log("Nessun percorso dei wallet trovato in GunDB");
            this.walletPaths = {};
          }
          
          resolve();
        });
      });
    } catch (error) {
      log("Errore durante l'inizializzazione dei percorsi dei wallet:", error);
      this.walletPaths = {};
    }
  }

  /**
   * Salva i percorsi dei wallet in GunDB
   */
  async saveWalletPaths(): Promise<void> {
    try {
      log("Salvataggio dei percorsi dei wallet in GunDB");
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout durante il salvataggio dei percorsi dei wallet in GunDB"));
        }, 10000);
        
        this.gun.user().get("walletPaths").put(this.walletPaths, (ack: any) => {
          clearTimeout(timeout);
          
          if (ack.err) {
            log("Errore durante il salvataggio dei percorsi dei wallet in GunDB:", ack.err);
            reject(new Error(ack.err));
          } else {
            log("Percorsi dei wallet salvati con successo in GunDB");
            resolve();
          }
        });
      });
    } catch (error) {
      log("Errore durante il salvataggio dei percorsi dei wallet in GunDB:", error);
      throw error;
    }
  }

  /**
   * Ottiene il wallet principale
   * @returns Wallet principale
   */
  getMainWallet(): HDNodeWallet | null {
    return this.mainWallet;
  }

  /**
   * Crea un nuovo wallet
   * @returns Wallet creato
   */
  async createWallet(): Promise<HDNodeWallet> {
    try {
      log("Creazione di un nuovo wallet");
      
      const userPub = this.gun.user().is?.pub;
      
      if (!userPub) {
        throw new Error("Utente non autenticato");
      }
      
      // Crea un nuovo wallet
      const wallet = ethers.Wallet.createRandom() as HDNodeWallet;
      
      // Salva il percorso del wallet
      const walletPath = `m/44'/60'/0'/0/0`;
      this.walletPaths[wallet.address] = walletPath;
      
      // Salva i percorsi dei wallet
      await this.saveWalletPaths();
      
      return wallet;
    } catch (error) {
      log("Errore durante la creazione del wallet:", error);
      throw error;
    }
  }

  /**
   * Carica i wallet
   * @returns Wallet caricati
   */
  async loadWallets(): Promise<HDNodeWallet[]> {
    try {
      log("Caricamento dei wallet");
      
      const userPub = this.gun.user().is?.pub;
      
      if (!userPub) {
        throw new Error("Utente non autenticato");
      }
      
      // Inizializza i percorsi dei wallet
      await this.initializeWalletPaths(userPub);
      
      // Recupera il wallet principale
      if (!this.mainWallet) {
        throw new Error("Wallet principale non disponibile");
      }
      
      // Deriva i wallet dai percorsi
      const wallets: HDNodeWallet[] = [];
      
      for (const [address, path] of Object.entries(this.walletPaths)) {
        try {
          // Estrai l'indice dal percorso
          const pathParts = path.split('/');
          const index = parseInt(pathParts[pathParts.length - 1], 10);
          
          if (isNaN(index)) {
            log("Indice non valido nel percorso del wallet:", path);
            continue;
          }
          
          // Deriva il wallet
          const wallet = this.hdWalletManager.deriveChildWallet(this.mainWallet, index);
          wallets.push(wallet);
        } catch (derivationError) {
          log("Errore durante la derivazione del wallet:", derivationError);
          // Continua con il prossimo wallet
        }
      }
      
      return wallets;
    } catch (error) {
      log("Errore durante il caricamento dei wallet:", error);
      return [];
    }
  }

  /**
   * Deriva un wallet
   * @param userPub - Chiave pubblica dell'utente
   * @param index - Indice del wallet
   * @returns Wallet derivato
   */
  async deriveWallet(userPub: string, index: number): Promise<HDNodeWallet> {
    try {
      log("Derivazione del wallet per l'utente:", userPub, "con indice:", index);
      
      // Verifica se il wallet principale è disponibile
      if (!this.mainWallet) {
        throw new Error("Wallet principale non disponibile");
      }
      
      // Deriva il wallet
      const wallet = this.hdWalletManager.deriveChildWallet(this.mainWallet, index);
      
      // Salva il percorso del wallet
      const walletPath = `m/44'/60'/0'/0/${index}`;
      this.walletPaths[wallet.address] = walletPath;
      
      // Salva i percorsi dei wallet
      await this.saveWalletPaths();
      
      return wallet;
    } catch (error) {
      log("Errore durante la derivazione del wallet:", error);
      throw error;
    }
  }

  /**
   * Imposta il wallet principale
   * @param wallet - Wallet principale
   */
  setMainWallet(wallet: HDNodeWallet): void {
    this.mainWallet = wallet;
  }

  /**
   * Accede a un wallet HD con fallback
   * @param username - Nome utente
   * @param password - Password
   * @returns Wallet HD e informazioni correlate
   */
  async accessHDWalletWithFallback(username: string, password: string): Promise<{
    wallet: HDNodeWallet;
    mnemonic?: string;
    isNew: boolean;
  }> {
    try {
      log("Accesso al wallet HD con fallback per l'utente:", username);
      
      const result = await this.hdWalletManager.accessHDWalletWithFallback(username, password);
      
      // Imposta il wallet principale
      this.setMainWallet(result.wallet);
      
      return result;
    } catch (error) {
      log("Errore durante l'accesso al wallet HD con fallback:", error);
      throw error;
    }
  }
} 