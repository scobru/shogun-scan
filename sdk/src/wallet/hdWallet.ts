import { ethers } from "ethers";
import { HDNodeWallet } from "ethers";
import { log } from "../utils/logger";
import { GunDB } from "../gun/gun";
import { Storage } from "../storage/storage";

/**
 * Classe che gestisce le funzionalità dei wallet HD
 */
export class HDWalletManager {
  private gundb: GunDB;
  private gun: any;
  private storage: Storage;

  constructor(gundb: GunDB, gun: any, storage: Storage) {
    this.gundb = gundb;
    this.gun = gun;
    this.storage = storage;
  }

  /**
   * Crea un nuovo wallet HD
   * @param username - Nome utente
   * @param password - Password
   * @returns Wallet HD creato
   */
  async createHDWallet(username: string, password: string): Promise<{
    wallet: HDNodeWallet;
    mnemonic?: string;
    address: string;
    privateKey: string;
  }> {
    try {
      log("Creazione di un nuovo wallet HD per l'utente:", username);
      
      // Genera un nuovo wallet con mnemonic
      const { wallet, mnemonic } = this.generateMnemonicWallet();
      
      // Salva il mnemonic in GunDB
      const userPub = this.gun.user().is?.pub;
      if (userPub && mnemonic) {
        await this.saveMnemonicToGun(userPub, mnemonic);
        this.saveMnemonicToLocalStorage(mnemonic);
      }
      
      return {
        wallet,
        mnemonic,
        address: wallet.address,
        privateKey: wallet.privateKey,
      };
    } catch (error) {
      log("Errore durante la creazione del wallet HD:", error);
      throw error;
    }
  }

  /**
   * Genera un wallet con mnemonic
   * @returns Wallet e mnemonic generati
   */
  generateMnemonicWallet(): { wallet: HDNodeWallet; mnemonic: string } {
    try {
      // Genera un mnemonic casuale
      const mnemonic = ethers.Wallet.createRandom().mnemonic?.phrase || this.generateValidEntropy();
      
      // Crea un wallet dal mnemonic
      const wallet = ethers.Wallet.fromPhrase(mnemonic);
      
      return { wallet, mnemonic };
    } catch (error) {
      log("Errore durante la generazione del wallet con mnemonic:", error);
      throw error;
    }
  }

  /**
   * Ripristina un wallet da un mnemonic
   * @param mnemonic - Mnemonic da cui ripristinare il wallet
   * @returns Wallet ripristinato
   */
  restoreFromMnemonic(mnemonic: string): HDNodeWallet {
    try {
      return ethers.Wallet.fromPhrase(mnemonic);
    } catch (error) {
      log("Errore durante il ripristino del wallet dal mnemonic:", error);
      throw error;
    }
  }

  /**
   * Deriva un wallet figlio da un wallet HD
   * @param hdWallet - Wallet HD padre
   * @param index - Indice del wallet figlio
   * @returns Wallet figlio derivato
   */
  deriveChildWallet(hdWallet: HDNodeWallet, index: number): HDNodeWallet {
    try {
      const path = `m/44'/60'/0'/0/${index}`;
      return hdWallet.derivePath(path) as HDNodeWallet;
    } catch (error) {
      log("Errore durante la derivazione del wallet figlio:", error);
      throw error;
    }
  }

  /**
   * Cripta un wallet con una password
   * @param wallet - Wallet da criptare
   * @param password - Password per la crittografia
   * @returns JSON del wallet criptato
   */
  async encryptWallet(wallet: HDNodeWallet, password: string): Promise<string> {
    try {
      return await wallet.encrypt(password);
    } catch (error) {
      log("Errore durante la crittografia del wallet:", error);
      throw error;
    }
  }

  /**
   * Decripta un wallet
   * @param json - JSON del wallet criptato
   * @param password - Password per la decrittografia
   * @returns Wallet decriptato
   */
  async decryptWallet(json: string, password: string): Promise<HDNodeWallet> {
    try {
      return await ethers.Wallet.fromEncryptedJson(json, password) as HDNodeWallet;
    } catch (error) {
      log("Errore durante la decrittografia del wallet:", error);
      throw error;
    }
  }

  /**
   * Firma un messaggio con un wallet
   * @param wallet - Wallet per la firma
   * @param message - Messaggio da firmare
   * @returns Firma del messaggio
   */
  async signMessage(wallet: HDNodeWallet, message: string | Uint8Array): Promise<string> {
    try {
      return await wallet.signMessage(message);
    } catch (error) {
      log("Errore durante la firma del messaggio:", error);
      throw error;
    }
  }

  /**
   * Verifica una firma
   * @param message - Messaggio firmato
   * @param signature - Firma da verificare
   * @returns Indirizzo che ha firmato il messaggio
   */
  verifySignature(message: string | Uint8Array, signature: string): string {
    try {
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      log("Errore durante la verifica della firma:", error);
      throw error;
    }
  }

  /**
   * Firma una transazione
   * @param wallet - Wallet per la firma
   * @param toAddress - Indirizzo destinatario
   * @param value - Valore da inviare
   * @returns Transazione firmata
   */
  async signTransaction(wallet: HDNodeWallet, toAddress: string, value: string): Promise<string> {
    try {
      const tx = {
        to: toAddress,
        value: ethers.parseEther(value)
      };
      
      return await wallet.signTransaction(tx);
    } catch (error) {
      log("Errore durante la firma della transazione:", error);
      throw error;
    }
  }

  /**
   * Salva un mnemonic in GunDB
   * @param userPub - Chiave pubblica dell'utente
   * @param mnemonic - Mnemonic da salvare
   */
  async saveMnemonicToGun(userPub: string, mnemonic: string): Promise<void> {
    try {
      log("Salvataggio del mnemonic in GunDB per l'utente:", userPub);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout durante il salvataggio del mnemonic in GunDB"));
        }, 10000);
        
        this.gun.user().get("entropy").put(mnemonic, (ack: any) => {
          clearTimeout(timeout);
          
          if (ack.err) {
            log("Errore durante il salvataggio del mnemonic in GunDB:", ack.err);
            reject(new Error(ack.err));
          } else {
            log("Mnemonic salvato con successo in GunDB");
            resolve();
          }
        });
      });
    } catch (error) {
      log("Errore durante il salvataggio del mnemonic in GunDB:", error);
      throw error;
    }
  }

  /**
   * Recupera un mnemonic da GunDB
   * @param userPub - Chiave pubblica dell'utente
   * @returns Mnemonic recuperato o null se non trovato
   */
  async getMnemonicFromGun(userPub: string): Promise<string | null> {
    try {
      log("Recupero del mnemonic da GunDB per l'utente:", userPub);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          log("Timeout durante il recupero del mnemonic da GunDB");
          resolve(null);
        }, 10000);
        
        this.gun.user().get("entropy").once((data: any) => {
          clearTimeout(timeout);
          
          if (data) {
            log("Mnemonic recuperato con successo da GunDB");
            resolve(data);
          } else {
            log("Nessun mnemonic trovato in GunDB");
            resolve(null);
          }
        });
      });
    } catch (error) {
      log("Errore durante il recupero del mnemonic da GunDB:", error);
      return null;
    }
  }

  /**
   * Salva un mnemonic in localStorage
   * @param mnemonic - Mnemonic da salvare
   */
  saveMnemonicToLocalStorage(mnemonic: string): void {
    try {
      this.storage.setItem("mnemonic", mnemonic);
      log("Mnemonic salvato con successo in localStorage");
    } catch (error) {
      log("Errore durante il salvataggio del mnemonic in localStorage:", error);
      throw error;
    }
  }

  /**
   * Recupera un mnemonic da localStorage
   * @returns Mnemonic recuperato o null se non trovato
   */
  getMnemonicFromLocalStorage(): string | null {
    try {
      const mnemonic = this.storage.getItem("mnemonic");
      
      if (mnemonic) {
        log("Mnemonic recuperato con successo da localStorage");
        return mnemonic;
      } else {
        log("Nessun mnemonic trovato in localStorage");
        return null;
      }
    } catch (error) {
      log("Errore durante il recupero del mnemonic da localStorage:", error);
      return null;
    }
  }

  /**
   * Accede a un wallet HD
   * @param username - Nome utente
   * @param password - Password
   * @returns Wallet HD e informazioni correlate
   */
  async accessHDWallet(username: string, password: string): Promise<{
    wallet: HDNodeWallet;
    mnemonic?: string;
    isNew: boolean;
  }> {
    try {
      log("Accesso al wallet HD per l'utente:", username);
      
      const userPub = this.gun.user().is?.pub;
      
      if (!userPub) {
        throw new Error("Utente non autenticato");
      }
      
      // Recupera il mnemonic da GunDB
      const mnemonic = await this.getMnemonicFromGun(userPub);
      
      if (mnemonic) {
        log("Mnemonic trovato in GunDB, ripristino del wallet");
        const wallet = this.restoreFromMnemonic(mnemonic);
        return { wallet, mnemonic, isNew: false };
      } else {
        log("Nessun mnemonic trovato in GunDB, creazione di un nuovo wallet");
        const result = await this.createHDWallet(username, password);
        return { wallet: result.wallet, mnemonic: result.mnemonic, isNew: true };
      }
    } catch (error) {
      log("Errore durante l'accesso al wallet HD:", error);
      throw error;
    }
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
      
      const userPub = this.gun.user().is?.pub;
      
      if (!userPub) {
        throw new Error("Utente non autenticato");
      }
      
      // Avvia il recupero del mnemonic da GunDB in background
      const mnemonicPromise = this.getMnemonicFromGun(userPub);
      
      // Nel frattempo, controlla se c'è un mnemonic in localStorage
      const localMnemonic = this.getMnemonicFromLocalStorage();
      
      // Attendi il risultato del recupero da GunDB
      const gunMnemonic = await mnemonicPromise;
      
      // Priorità: GunDB > localStorage > nuovo wallet
      if (gunMnemonic) {
        log("Mnemonic trovato in GunDB, ripristino del wallet");
        const wallet = this.restoreFromMnemonic(gunMnemonic);
        
        // Assicurati che il mnemonic sia anche in localStorage per accessi futuri
        if (!localMnemonic || localMnemonic !== gunMnemonic) {
          this.saveMnemonicToLocalStorage(gunMnemonic);
        }
        
        return { wallet, mnemonic: gunMnemonic, isNew: false };
      } else if (localMnemonic) {
        log("Mnemonic trovato in localStorage, ripristino del wallet e salvataggio in GunDB");
        const wallet = this.restoreFromMnemonic(localMnemonic);
        
        // Salva il mnemonic in GunDB per sincronizzazione
        await this.saveMnemonicToGun(userPub, localMnemonic);
        
        return { wallet, mnemonic: localMnemonic, isNew: false };
      } else {
        log("Nessun mnemonic trovato, creazione di un nuovo wallet");
        const result = await this.createHDWallet(username, password);
        return { wallet: result.wallet, mnemonic: result.mnemonic, isNew: true };
      }
    } catch (error) {
      log("Errore durante l'accesso al wallet HD con fallback:", error);
      throw error;
    }
  }

  /**
   * Pulisce l'entropia non valida
   */
  cleanInvalidEntropy(): void {
    try {
      const mnemonic = this.storage.getItem("mnemonic");
      
      if (mnemonic) {
        try {
          ethers.Wallet.fromPhrase(mnemonic);
        } catch (e) {
          log("Entropia non valida trovata in localStorage, rimozione");
          this.storage.removeItem("mnemonic");
        }
      }
    } catch (error) {
      log("Errore durante la pulizia dell'entropia non valida:", error);
    }
  }

  /**
   * Genera un'entropia valida
   * @returns Entropia valida
   */
  private generateValidEntropy(): string {
    try {
      return ethers.Wallet.createRandom().mnemonic?.phrase || "";
    } catch (error) {
      log("Errore durante la generazione dell'entropia valida:", error);
      throw error;
    }
  }
} 