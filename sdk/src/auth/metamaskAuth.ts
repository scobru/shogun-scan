import { ethers } from "ethers";
import { log } from "../utils/logger";
import { GunDB } from "../gun/gun";
import { Storage } from "../storage/storage";
import { MetaMask } from "../connector/metamask";
import { AuthResult } from "../types/shogun";

/**
 * Classe che gestisce l'autenticazione con MetaMask
 */
export class MetaMaskAuth {
  private gundb: GunDB;
  private gun: any;
  private storage: Storage;
  private metamask: MetaMask;

  constructor(gundb: GunDB, gun: any, storage: Storage, metamask: MetaMask) {
    this.gundb = gundb;
    this.gun = gun;
    this.storage = storage;
    this.metamask = metamask;
  }

  /**
   * Crea un risultato di autenticazione
   * @param success - Indica se l'autenticazione è riuscita
   * @param data - Dati aggiuntivi
   * @returns Risultato dell'autenticazione
   */
  private createAuthResult(success: boolean, data: any = {}): AuthResult {
    return {
      success,
      ...data,
    };
  }

  /**
   * Normalizza un indirizzo Ethereum
   * @param address - Indirizzo da normalizzare
   * @returns Indirizzo normalizzato
   */
  private normalizeEthAddress(address: string): string {
    try {
      return ethers.getAddress(address.toLowerCase());
    } catch (error) {
      log("Errore durante la normalizzazione dell'indirizzo Ethereum:", error);
      return address.toLowerCase();
    }
  }

  /**
   * Effettua il login con MetaMask
   * @param address - Indirizzo Ethereum
   * @returns Risultato del login
   */
  async loginWithMetaMask(address: string): Promise<AuthResult> {
    try {
      log("Tentativo di login con MetaMask:", address);
      
      if (!this.metamask) {
        return this.createAuthResult(false, {
          error: "MetaMask non supportato",
        });
      }
      
      // Normalizza l'indirizzo
      const normalizedAddress = this.normalizeEthAddress(address);
      
      // Verifica se l'utente esiste
      const credentials = await this.getMetaMaskCredentials(normalizedAddress);
      
      if (!credentials) {
        return this.createAuthResult(false, {
          error: "Utente non trovato. Registrati prima di effettuare il login.",
        });
      }
      
      // Crea un messaggio da firmare con un nonce per sicurezza
      const nonce = Math.floor(Math.random() * 1000000).toString();
      const messageToSign = `Login to Shogun with address ${normalizedAddress}. Nonce: ${nonce}`;
      
      // Richiedi la firma all'utente tramite MetaMask
      let signature;
      try {
        // Usa window.ethereum direttamente per la firma
        if (!window.ethereum) {
          return this.createAuthResult(false, {
            error: "MetaMask non è installato o non è accessibile",
          });
        }
        
        signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [messageToSign, normalizedAddress],
        });
        
        if (!signature) {
          return this.createAuthResult(false, {
            error: "Firma non fornita dall'utente",
          });
        }
        
        log("Firma ottenuta con successo:", signature);
      } catch (signError) {
        log("Errore durante la firma con MetaMask:", signError);
        return this.createAuthResult(false, {
          error: signError instanceof Error ? signError.message : "Errore durante la firma con MetaMask",
        });
      }
      
      // Verifica la firma per confermare che l'utente possiede l'indirizzo
      try {
        const recoveredAddress = ethers.verifyMessage(messageToSign, signature);
        
        if (this.normalizeEthAddress(recoveredAddress) !== normalizedAddress) {
          return this.createAuthResult(false, {
            error: "Verifica della firma fallita: l'indirizzo recuperato non corrisponde",
          });
        }
        
        log("Verifica della firma completata con successo");
      } catch (verifyError) {
        log("Errore durante la verifica della firma:", verifyError);
        return this.createAuthResult(false, {
          error: "Errore durante la verifica della firma",
        });
      }
      
      // Autentica l'utente con GunDB
      try {
        await this.gundb.authenticateGunUser(credentials.username, credentials.password);
      } catch (authError) {
        log("Errore durante l'autenticazione con GunDB:", authError);
        return this.createAuthResult(false, {
          error: "Errore durante l'autenticazione con GunDB",
        });
      }
      
      const userPub = this.gun.user().is?.pub;
      
      return this.createAuthResult(true, {
        userPub,
        username: credentials.username,
      });
    } catch (error) {
      log("Errore durante il login con MetaMask:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Errore durante il login con MetaMask",
      });
    }
  }

  /**
   * Registra un nuovo utente con MetaMask
   * @param address - Indirizzo Ethereum
   * @returns Risultato della registrazione
   */
  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    try {
      log("Tentativo di registrazione con MetaMask:", address);
      
      if (!this.metamask) {
        return this.createAuthResult(false, {
          error: "MetaMask non supportato",
        });
      }
      
      // Normalizza l'indirizzo
      const normalizedAddress = this.normalizeEthAddress(address);
      
      // Verifica se l'utente esiste già
      const existingCredentials = await this.getMetaMaskCredentials(normalizedAddress);
      
      if (existingCredentials) {
        return await this.loginWithMetaMask(normalizedAddress);
      }
      
      // Crea un messaggio da firmare con un nonce per sicurezza
      const nonce = Math.floor(Math.random() * 1000000).toString();
      const messageToSign = `Sign up to Shogun with address ${normalizedAddress}. Nonce: ${nonce}`;
      
      // Richiedi la firma all'utente tramite MetaMask
      let signature;
      try {
        // Usa window.ethereum direttamente per la firma
        if (!window.ethereum) {
          return this.createAuthResult(false, {
            error: "MetaMask non è installato o non è accessibile",
          });
        }
        
        signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [messageToSign, normalizedAddress],
        });
        
        if (!signature) {
          return this.createAuthResult(false, {
            error: "Firma non fornita dall'utente",
          });
        }
        
        log("Firma ottenuta con successo:", signature);
      } catch (signError) {
        log("Errore durante la firma con MetaMask:", signError);
        return this.createAuthResult(false, {
          error: signError instanceof Error ? signError.message : "Errore durante la firma con MetaMask",
        });
      }
      
      // Verifica la firma per confermare che l'utente possiede l'indirizzo
      try {
        const recoveredAddress = ethers.verifyMessage(messageToSign, signature);
        
        if (this.normalizeEthAddress(recoveredAddress) !== normalizedAddress) {
          return this.createAuthResult(false, {
            error: "Verifica della firma fallita: l'indirizzo recuperato non corrisponde",
          });
        }
        
        log("Verifica della firma completata con successo");
      } catch (verifyError) {
        log("Errore durante la verifica della firma:", verifyError);
        return this.createAuthResult(false, {
          error: "Errore durante la verifica della firma",
        });
      }
      
      // Genera una password sicura dalla firma
      const password = ethers.keccak256(ethers.toUtf8Bytes(signature)).slice(2);
      
      // Crea un username basato sull'indirizzo
      const username = `metamask_${normalizedAddress.slice(0, 10)}`;
      
      // Crea un utente GUN
      try {
        await this.gundb.createGunUser(username, password);
      } catch (gunError) {
        if (gunError instanceof Error && gunError.message.includes("User already created")) {
          log("Utente GUN già esistente, tentativo di autenticazione...");
        } else {
          throw gunError;
        }
      }
      
      // Autentica l'utente con GunDB
      await this.gundb.authenticateGunUser(username, password);
      
      const userPub = this.gun.user()?.is?.pub;
      
      // Salva le credenziali MetaMask
      this.storage.setItem("metamask_credentials", JSON.stringify({
        username,
        password,
        address: normalizedAddress,
        nonce,
        timestamp: Date.now(),
        messageToSign
      }));
      
      return this.createAuthResult(true, {
        userPub,
        username,
      });
    } catch (error) {
      log("Errore durante la registrazione con MetaMask:", error);
      return this.createAuthResult(false, {
        error: error instanceof Error ? error.message : "Errore durante la registrazione con MetaMask",
      });
    }
  }

  /**
   * Recupera le credenziali MetaMask
   * @param address - Indirizzo Ethereum
   * @returns Credenziali MetaMask o null se non trovate
   */
  async getMetaMaskCredentials(address: string): Promise<{ username: string; password: string } | null> {
    try {
      log("Recupero delle credenziali MetaMask per l'indirizzo:", address);
      
      // Normalizza l'indirizzo
      const normalizedAddress = this.normalizeEthAddress(address);
      
      // Recupera le credenziali da localStorage
      const credentialsJson = this.storage.getItem("metamask_credentials");
      
      if (credentialsJson) {
        try {
          const credentials = JSON.parse(credentialsJson);
          
          // Verifica se le credenziali corrispondono all'indirizzo
          if (credentials.address && this.normalizeEthAddress(credentials.address) === normalizedAddress) {
            log("Credenziali MetaMask trovate in localStorage");
            return {
              username: credentials.username,
              password: credentials.password,
            };
          }
        } catch (parseError) {
          log("Errore durante il parsing delle credenziali MetaMask:", parseError);
        }
      }
      
      // Se non trovate in localStorage, cerca in GunDB
      // Implementazione futura: recupero da GunDB
      
      log("Nessuna credenziale MetaMask trovata per l'indirizzo:", normalizedAddress);
      return null;
    } catch (error) {
      log("Errore durante il recupero delle credenziali MetaMask:", error);
      return null;
    }
  }
} 